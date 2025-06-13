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
		broadcast:  make(chan *Message),
		register:   make(chan *Client),
		unregister: make(chan *Client),
		rooms:      make(map[string]*Room),
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
			// If the room doesn't exist, create it.
			if !ok {
				room = &Room{
					clients: make(map[*Client]bool),
					history: make([][]byte, 0, historyCap),
				}
				h.rooms[client.room] = room
				slog.Info("Created new room", "room", client.room)
			}
			room.clients[client] = true
			h.roomsMux.Unlock()

			// Send the existing room history to the newly connected client. 
			room.historyMux.RLock()
			for _, msg := range room.history {
				// Use a select to avoid blocking if the client's send buffer is full.
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
				}
			}
			h.roomsMux.Unlock()

		// Handle incoming messages for broadcast.
		case message := <-h.broadcast:
			h.roomsMux.RLock()
			if room, ok := h.rooms[message.room]; ok {
				// Add the new message to the room's history. 
				room.historyMux.Lock()
				room.history = append(room.history, message.data)
				// Trim the history if it exceeds the capacity. 
				if len(room.history) > historyCap {
					// Slice from the second element to the end, effectively removing the oldest.
					room.history = room.history[1:]
				}
				room.historyMux.Unlock()

				// Broadcast the message to all clients in the room. 
				for client := range room.clients {
					select {
					case client.send <- message.data:
					default:
						// If the send channel is blocked, assume the client is dead or stuck.
						close(client.send)
						delete(room.clients, client)
					}
				}
			}
			h.roomsMux.RUnlock()
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
		// ReadMessage blocks until a message is received.
		_, msgData, err := c.conn.ReadMessage()
		if err != nil {
			// Log unexpected close errors.
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				slog.Warn("readPump: Unexpected close error", "error", err)
			}
			break
		}
		// Create a message and send it to the hub's broadcast channel.
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
		// Wait for a message from the client's send channel.
		case message, ok := <-c.send:
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if !ok {
				// The hub closed the channel.
				c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}
			// Write the message to the websocket connection.
			if err := c.conn.WriteMessage(websocket.BinaryMessage, message); err != nil {
				return
			}
		// Or, send a ping message at regular intervals.
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
	// Determine room type and max users based on passphrase length.
	// A 64-character passphrase is assumed to be a SHA-256 hash of a party ID.
	isPartyRoom := len(passphrase) == 64
	maxUsers := maxUsersShared
	if isPartyRoom {
		maxUsers = maxUsersParty
	}

	// Lock the hub to check room status before upgrading the connection.
	hub.roomsMux.Lock()
	if room, ok := hub.rooms[passphrase]; ok {
		// If room exists, check if it's full.
		if len(room.clients) >= maxUsers {
			hub.roomsMux.Unlock()
			http.Error(w, "Room is full", http.StatusForbidden)
			slog.Warn("Rejected connection to full room", "room", passphrase, "current", len(room.clients), "max", maxUsers)
			return
		}
	}
	hub.roomsMux.Unlock()

	// Upgrade the HTTP connection to a WebSocket connection.
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		slog.Error("Failed to upgrade connection", "error", err)
		return
	}
	// Create a new client.
	client := &Client{
		hub:  hub,
		conn: conn,
		send: make(chan []byte, 256), // Buffered channel to prevent blocking.
		room: passphrase,
	}
	// Register the new client with the hub.
	client.hub.register <- client

	// Start the read and write pumps in separate goroutines.
	go client.writePump()
	go client.readPump()
}

// main is the entry point for the application.
func main() {
	// Initialize structured JSON logger. 
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	slog.SetDefault(logger)

	// Create and run the central hub.
	hub := newHub()
	go hub.run()

	// Define HTTP routes.
	http.HandleFunc("/ws", func(w http.ResponseWriter, r *http.Request) {
		serveWs(hub, w, r)
	})
	// A simple health check endpoint.
	http.HandleFunc("/hello", func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte("Hello, AetherDraw Relay Server!"))
	})

	// Determine port from environment variables, with a fallback for local dev.
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	slog.Info("Server starting", "port", port)
	// Start the HTTP server.
	err := http.ListenAndServe(":"+port, nil)
	if err != nil {
		slog.Error("ListenAndServe failed", "error", err)
		os.Exit(1)
	}
}
