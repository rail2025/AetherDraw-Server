package main

import (
	"log/slog"
	"net/http"
	"os"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

// Constants for WebSocket configuration
const (
	writeWait      = 10 * time.Second    // Time allowed to write a message to the peer.
	pongWait       = 60 * time.Second    // Time allowed to read the next pong message from the peer.
	pingPeriod     = (pongWait * 9) / 10 // Send pings to peer with this period. Must be less than pongWait.
	maxMessageSize = 16 * 1024           // Maximum message size allowed from peer (16KB).
)

// --- Core Data Structures ---

// Client represents a single user connected via WebSocket.
type Client struct {
	hub  *Hub
	conn *websocket.Conn
	send chan []byte // Buffered channel of outbound messages.
	room string      // The ID of the room the client is in.
}

// Room holds the set of clients in a room and the message history.
type Room struct {
	clients    map[*Client]bool
	broadcast  chan []byte
	history    [][]byte
	historyMux sync.RWMutex
}

// Hub maintains the set of active rooms and broadcasts messages.
type Hub struct {
	rooms      map[string]*Room
	roomsMux   sync.RWMutex
	register   chan *Client
	unregister chan *Client
}

// --- Global State ---

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

// --- Hub Methods ---

func newHub() *Hub {
	return &Hub{
		register:   make(chan *Client),
		unregister: make(chan *Client),
		rooms:      make(map[string]*Room),
	}
}

func (h *Hub) run() {
	for {
		select {
		case client := <-h.register:
			h.roomsMux.Lock()
			room, ok := h.rooms[client.room]
			if !ok {
				// Create the room if it doesn't exist.
				room = &Room{
					clients:   make(map[*Client]bool),
					broadcast: make(chan []byte),
					history:   make([][]byte, 0),
				}
				h.rooms[client.room] = room
				slog.Info("Created new room", "room", client.room)
				// We will run the room's broadcast loop in a future step.
			}
			room.clients[client] = true
			h.roomsMux.Unlock()
			slog.Info("Client registered", "room", client.room, "remoteAddr", client.conn.RemoteAddr())

		case <-h.unregister:
			//  corrected line.
			// Unregistration logic will be added here.
		}
	}
}

// --- Client Methods ---

// readPump pumps messages from the websocket connection to the hub.
func (c *Client) readPump() {
	// Unregister client on exit
	defer func() {
		c.hub.unregister <- c
		c.conn.Close()
	}()
	c.conn.SetReadLimit(maxMessageSize)
	c.conn.SetReadDeadline(time.Now().Add(pongWait))
	c.conn.SetPongHandler(func(string) error { c.conn.SetReadDeadline(time.Now().Add(pongWait)); return nil })

	// Message reading loop
	for {
		_, message, err := c.conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				slog.Warn("Unexpected close error", "error", err)
			}
			break
		}
		// We will add message broadcasting logic here later.
		_ = message // Placeholder to avoid unused variable error
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
				// The hub closed the channel.
				c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}
			// Send the message
			if err := c.conn.WriteMessage(websocket.BinaryMessage, message); err != nil {
				return
			}
		case <-ticker.C:
			// Send a ping to the client
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

// --- HTTP Handler ---

func serveWs(hub *Hub, w http.ResponseWriter, r *http.Request) {
	passphrase := r.URL.Query().Get("passphrase")
	if passphrase == "" {
		slog.Warn("Connection attempt without passphrase")
		http.Error(w, "Passphrase is required", http.StatusBadRequest)
		return
	}

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		slog.Error("Failed to upgrade connection", "error", err)
		return
	}

	client := &Client{
		hub:  hub,
		conn: conn,
		send: make(chan []byte, 256), // 256-message send buffer
		room: passphrase,
	}
	client.hub.register <- client

	// Start the read and write pumps as concurrent goroutines
	go client.writePump()
	go client.readPump()
}

// --- Main Application ---

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
