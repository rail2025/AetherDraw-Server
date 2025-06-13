package main

import (
	"context"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"sync"
	"syscall"
	"time"

	"github.com/gorilla/websocket"
	"golang.org/x/time/rate"
)

// Constants for WebSocket and Hub configuration.
const (
	// To adjust the rate limit, change the number in rate.Limit(10).
	rateLimit = rate.Limit(10) // 10 messages per second
	// To adjust the burst allowance, change the number here.
	burstSize = 20

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
	// roomLifetime is the maximum duration a room can exist before being closed.
	roomLifetime = 2 * time.Hour
	// roomCheckInterval is the frequency at which to check for expired rooms.
	roomCheckInterval = 5 * time.Minute
)

// warningMessage is the byte sequence sent to clients before the room is closed.
var warningMessage = []byte{5}

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
	// Rate limiter for this client.
	limiter *rate.Limiter
}

// Room represents a single chat room.
type Room struct {
	// Registered clients.
	clients map[*Client]bool
	// In-memory message history for the room.
	history [][]byte
	// Mutex to protect access to the history slice.
	historyMux sync.RWMutex
	// Timer that triggers cleanup when only one client is left.
	cleanupTimer *time.Timer
	// The time the room was created.
	creationTime time.Time
}

// Hub maintains the set of active rooms and broadcasts messages.
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
		case client := <-h.register:
			h.roomsMux.Lock()
			room, ok := h.rooms[client.room]
			if !ok {
				room = &Room{
					clients:      make(map[*Client]bool),
					history:      make([][]byte, 0, historyCap),
					creationTime: time.Now(),
				}
				h.rooms[client.room] = room
				slog.Info("Created new room", "room", client.room)
			}
			room.clients[client] = true
			if room.cleanupTimer != nil {
				room.cleanupTimer.Stop()
				room.cleanupTimer = nil
				slog.Info("Stopped cleanup timer for room", "room", client.room)
			}
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

		case client := <-h.unregister:
			h.roomsMux.Lock()
			if room, ok := h.rooms[client.room]; ok {
				if _, ok := room.clients[client]; ok {
					delete(room.clients, client)
					close(client.send)
					slog.Info("Client unregistered", "room", client.room, "clients_in_room", len(room.clients))

					if len(room.clients) == 0 {
						if room.cleanupTimer != nil {
							room.cleanupTimer.Stop()
						}
						delete(h.rooms, client.room)
						slog.Info("Room is empty, deleting", "room", client.room)
					} else if len(room.clients) == 1 {
						slog.Info("Only one client left in room, starting cleanup timer", "room", client.room, "timeout", loneClientTimeout)
						room.cleanupTimer = time.AfterFunc(loneClientTimeout, func() {
							h.cleanupRoom <- client.room
						})
					}
				}
			}
			h.roomsMux.Unlock()

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

		case roomName := <-h.cleanupRoom:
			h.roomsMux.Lock()
			if room, ok := h.rooms[roomName]; ok {
				slog.Info("Sending closing warning to room", "room", roomName)
				for client := range room.clients {
					client.send <- warningMessage
				}

				time.Sleep(100 * time.Millisecond)

				for client := range room.clients {
					close(client.send)
				}
				delete(h.rooms, roomName)
				slog.Info("Closed room due to timeout", "room", roomName)
			}
			h.roomsMux.Unlock()
		}
	}
}

// cleanupExpiredRooms iterates through rooms and schedules them for cleanup if they are past their lifetime.
func (h *Hub) cleanupExpiredRooms() {
	h.roomsMux.RLock()
	var expiredRooms []string
	for name, room := range h.rooms {
		if time.Since(room.creationTime) > roomLifetime {
			expiredRooms = append(expiredRooms, name)
		}
	}
	h.roomsMux.RUnlock()

	for _, roomName := range expiredRooms {
		slog.Info("Room has expired, scheduling for cleanup", "room", roomName, "lifetime", roomLifetime)
		h.cleanupRoom <- roomName
	}
}

func (c *Client) readPump() {
	defer func() {
		c.hub.unregister <- c
		c.conn.Close()
	}()
	c.conn.SetReadLimit(maxMessageSize)
	c.conn.SetReadDeadline(time.Now().Add(pongWait))
	c.conn.SetPongHandler(func(string) error { c.conn.SetReadDeadline(time.Now().Add(pongWait)); return nil })

	for {
		// Check the rate limiter after reading a message.
		if !c.limiter.Allow() {
			slog.Warn("Rate limit exceeded, ignoring message", "room", c.room)
			continue // Ignore the message and continue the loop.
		}

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
	// Create and initialize the rate limiter for the new client.
	limiter := rate.NewLimiter(rateLimit, burstSize)

	client := &Client{
		hub:     hub,
		conn:    conn,
		send:    make(chan []byte, 256),
		room:    passphrase,
		limiter: limiter,
	}
	client.hub.register <- client

	go client.writePump()
	go client.readPump()
}

// main is the entry point for the application.
func main() {
	// Setup structured logging.
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	slog.SetDefault(logger)

	// Create and run the central hub in a separate goroutine.
	hub := newHub()
	go hub.run()

	// Start a goroutine for periodically cleaning up old rooms.
	go func() {
		ticker := time.NewTicker(roomCheckInterval)
		defer ticker.Stop()
		for range ticker.C {
			hub.cleanupExpiredRooms()
		}
	}()

	// Configure the HTTP server.
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	server := &http.Server{
		Addr: ":" + port,
	}
	http.HandleFunc("/ws", func(w http.ResponseWriter, r *http.Request) {
		serveWs(hub, w, r)
	})
	http.HandleFunc("/hello", func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte("Hello, AetherDraw Relay Server!"))
	})

	// Start the server in a goroutine so it doesn't block.
	go func() {
		slog.Info("Server starting", "port", port)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			slog.Error("ListenAndServe failed", "error", err)
			os.Exit(1)
		}
	}()

	// --- Graceful Shutdown Logic ---
	// Create a channel to receive OS signals.
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)

	// Block until a signal is received.
	<-quit
	slog.Warn("Shutdown signal received, shutting down gracefully...")

	// Create a context with a timeout to allow existing connections to finish.
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// Attempt to gracefully shut down the server.
	if err := server.Shutdown(ctx); err != nil {
		slog.Error("Server forced to shutdown", "error", err)
		os.Exit(1)
	}

	slog.Info("Server gracefully stopped")
}
