package main

import (
	"log/slog"
	"net/http"
	"os"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

// Constants for WebSocket and Hub configuration.
const (
	// writeWait is the time allowed to write a message to the peer.
	writeWait = 10 * time.Second
	// pongWait is the time allowed to read the next pong message from the peer.
	pongWait = 60 * time.Second
	// pingPeriod is the interval for sending pings to the peer. Must be less than pongWait.
	pingPeriod = (pongWait * 9) / 10
	// maxMessageSize is the maximum message size allowed from a peer.
	maxMessageSize = 16 * 1024 // 16 KB
	// historyCap is the maximum number of messages to store in a room's history.
	historyCap = 5000
	// maxUsersParty is the maximum number of users allowed in a party-based room.
	maxUsersParty = 8
	// maxUsersShared is the maximum number of users allowed in a passphrase-based room.
	maxUsersShared = 48
	// loneClientTimeout is the duration to wait before closing a room with only one client.
	loneClientTimeout = 3 * time.Minute
)

// Message represents a single message to be broadcast to a room.
type Message struct {
	room string
	data []byte
}

// Client is a middleman between the websocket connection and the hub.
type Client struct {
	hub *Hub
	// The websocket connection.
	conn *websocket.Conn
	// Buffered channel of outbound messages.
	send chan []byte
	// The room this client is connected to.
	room string
}

// Room represents a single chat room, maintaining a set of active clients and a message history.
type Room struct {
	// Registered clients.
	clients map[*Client]bool
	// In-memory message history for the room.
	history [][]byte
	// Mutex to protect access to the history slice.
	historyMux sync.RWMutex
	// Timer that triggers cleanup when only one client is left.
	cleanupTimer *time.Timer
}

// Hub maintains the set of active rooms and broadcasts messages to the correct rooms.
type Hub struct {
	// Registered rooms.
	rooms map[string]*Room
	// Mutex to protect access to the rooms map.
	roomsMux sync.RWMutex
	// Inbound messages from the clients.
	broadcast chan *Message
	// Register requests from the clients.
	register chan *Client
	// Unregister requests from clients.
	unregister chan *Client
	// Room cleanup requests.
	cleanupRoom chan string
}

// upgrader upgrades HTTP connections to the WebSocket protocol.
var upgrader = websocket.Upgrader{
	// CheckOrigin allows all connections, useful for development.
	// For production, this should be restricted to the client's domain.
	CheckOrigin: func(r *http.Request) bool { return true },
}

// newHub creates a new Hub instance.
func newHub() *Hub {
	return &Hub{
		broadcast:   make(chan *Message),
		register:    make(chan *Client),
		unregister:  make(chan *Client),
		cleanupRoom: make(chan string),
		rooms:       make(map[string]*Room),
	}
}

// run starts the Hub's message processing loop.
func (h *Hub) run() {
	for {
		select {
		// Handle client registration.
		case client := <-h.register:
			h.roomsMux.Lock()
			room, ok := h.rooms[client.room]
			if !ok {
				room = &Room{
					clients: make(map[*Client]bool),
					history: make([][]byte, 0, historyCap),
				}
				h.rooms[client.room] = room
				slog.Info("Created new room", "room", client.room)
			}

			room.clients[client] = true

			// If a cleanup timer was running, stop it because we now have more than one user.
			if room.cleanupTimer != nil {
				room.cleanupTimer.Stop()
				room.cleanupTimer = nil
				slog.Info("Stopped cleanup timer for room", "room", client.room)
			}
			
			// **FIX**: If this new client is the *only* one in the room, start the timeout.
			if len(room.clients) == 1 {
				slog.Info("First client in room, starting cleanup timer", "room", client.room, "timeout", loneClientTimeout)
				room.cleanupTimer = time.AfterFunc(loneClientTimeout, func() {
					h.cleanupRoom <- client.room
				})
			}

			h.roomsMux.Unlock()

			room.historyMux.RLock()
			for _, msg := range room.history {
				select {
				case client.send <- msg:
				default:
					slog.Warn("Failed to send history message to client, send channel full", "room", client.room)
				}
			}
			room.historyMux.RUnlock()
			slog.Info("Client registered and history sent", "room", client.room, "clients_in_room", len(room.clients))

		// Handle client unregistration.
		case client := <-h.unregister:
			h.roomsMux.Lock()
			if room, ok := h.rooms[client.room]; ok {
				if _, ok := room.clients[client]; ok {
					delete(room.clients, client)
					close(client.send)
					slog.Info("Client unregistered", "room", client.room, "clients_in_room", len(room.clients))

					if len(room.clients) == 0 {
						// If the room is now empty, ensure any existing timer is stopped and delete the room.
						if room.cleanupTimer != nil {
							room.cleanupTimer.Stop()
						}
						delete(h.rooms, client.room)
						slog.Info("Room is empty, deleting", "room", client.room)
					} else if len(room.clients) == 1 {
						// If only one client remains, start the cleanup timer.
						slog.Info("Only one client left in room, starting cleanup timer", "room", client.room, "timeout", loneClientTimeout)
						room.cleanupTimer = time.AfterFunc(loneClientTimeout, func() {
							h.cleanupRoom <- client.room
						})
					}
				}
			}
			h.roomsMux.Unlock()

		// Handle incoming messages for broadcast.
		case message := <-h.broadcast:
			h.roomsMux.RLock()
			if room, ok := h.rooms[message.room]; ok {
				room.historyMux.Lock()
				room.history = append(room.history, message.data)
				if len(room.history) > historyCap {
					room.history = room.history[1:]
				}
				room.historyMux.Unlock()

				for client := range room.clients {
					select {
					case client.send <- message.data:
					default:
						close(client.send)
						delete(room.clients, client)
					}
				}
			}
			h.roomsMux.RUnlock()

		// Handle room cleanup requests from timers.
		case roomName := <-h.cleanupRoom:
			h.roomsMux.Lock()
			if room, ok := h.rooms[roomName]; ok {
				if len(room.clients) == 1 {
					for client := range room.clients {
						close(client.send)
					}
					delete(h.rooms, roomName)
					slog.Info("Closed room due to lone client timeout", "room", roomName)
				}
			}
			h.roomsMux.Unlock()
		}
	}
}

// readPump pumps messages from the websocket connection to the hub.
func (c *Client) readPump() {
	defer func() {
		c.hub.unregister <- c
		c.conn.Close()
	}()
	c.conn.SetReadLimit(maxMessageSize)
	c.conn.SetReadDeadline(time.Now().Add(pongWait))
	c.conn.SetPongHandler(func(string) error { c.conn.SetReadDeadline(time.Now().Add(pongWait)); return nil })

	for {
		_, msgData, err := c.conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				slog.Warn("readPump: Unexpected close error", "error", err)
			}
			break
		}
		message := &Message{room: c.room, data: msgData}
		c.hub.broadcast <- message
	}
}

// writePump pumps messages from the hub to the websocket connection.
func (c *Client) writePump() {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		c.conn.Close()
	}()
	for {
		select {
		case message, ok := <-c.send:
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if !ok {
				c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}
			if err := c.conn.WriteMessage(websocket.BinaryMessage, message); err != nil {
				return
			}
		case <-ticker.C:
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

// serveWs handles websocket requests from the peer.
func serveWs(hub *Hub, w http.ResponseWriter, r *http.Request) {
	passphrase := r.URL.Query().Get("passphrase")
	if passphrase == "" {
		http.Error(w, "Passphrase is required", http.StatusBadRequest)
		return
	}
	isPartyRoom := len(passphrase) == 64
	maxUsers := maxUsersShared
	if isPartyRoom {
		maxUsers = maxUsersParty
	}

	hub.roomsMux.Lock()
	if room, ok := hub.rooms[passphrase]; ok {
		if len(room.clients) >= maxUsers {
			hub.roomsMux.Unlock()
			http.Error(w, "Room is full", http.StatusForbidden)
			slog.Warn("Rejected connection to full room", "room", passphrase, "current", len(room.clients), "max", maxUsers)
			return
		}
	}
	hub.roomsMux.Unlock()

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		slog.Error("Failed to upgrade connection", "error", err)
		return
	}
	client := &Client{
		hub:  hub,
		conn: conn,
		send: make(chan []byte, 256),
		room: passphrase,
	}
	client.hub.register <- client

	go client.writePump()
	go client.readPump()
}

// main is the entry point for the application.
func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	slog.SetDefault(logger)

	hub := newHub()
	go hub.run()

	http.HandleFunc("/ws", func(w http.ResponseWriter, r *http.Request) {
		serveWs(hub, w, r)
	})
	http.HandleFunc("/hello", func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte("Hello, AetherDraw Relay Server!"))
	})

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	slog.Info("Server starting", "port", port)
	err := http.ListenAndServe(":"+port, nil)
	if err != nil {
		slog.Error("ListenAndServe failed", "error", err)
		os.Exit(1)
	}
}
