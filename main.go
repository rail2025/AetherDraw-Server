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
	writeWait      = 10 * time.Second
	pongWait       = 60 * time.Second
	pingPeriod     = (pongWait * 9) / 10
	maxMessageSize = 16 * 1024
)

// --- Core Data Structures ---

// Client represents a single user connected via WebSocket.
type Client struct {
	hub  *Hub
	conn *websocket.Conn
	send chan []byte
	room *Room // Pointer to the Room this client is in.
}

// Room holds the set of clients in a room and the message history.
type Room struct {
	id         string
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
			room, ok := h.rooms[client.room.id]
			if !ok {
				room = &Room{
					id:        client.room.id,
					clients:   make(map[*Client]bool),
					broadcast: make(chan []byte),
					history:   make([][]byte, 0),
				}
				h.rooms[client.room.id] = room
				go room.run() // Start the room's own event loop.
				slog.Info("Created new room", "room", client.room.id)
			}
			room.clients[client] = true
			client.room = room // Give the client a direct pointer to the room struct.
			h.roomsMux.Unlock()
			slog.Info("Client registered", "room", client.room.id, "remoteAddr", client.conn.RemoteAddr())

		case client := <-h.unregister:
			h.roomsMux.RLock()
			room, ok := h.rooms[client.room.id]
			if ok {
				if _, ok := room.clients[client]; ok {
					delete(room.clients, client)
					close(client.send)
					slog.Info("Client unregistered", "room", room.id, "remoteAddr", client.conn.RemoteAddr())
					// Room cleanup logic will be added later.
				}
			}
			h.roomsMux.RUnlock()
		}
	}
}

// --- Room Methods ---

func (r *Room) run() {
	for {
		select {
		case message := <-r.broadcast:
			// For now, we just broadcast. History logic will be added later.
			for client := range r.clients {
				select {
				case client.send <- message:
				default:
					// Assume slow client, disconnect them.
					close(client.send)
					delete(r.clients, client)
				}
			}
		}
	}
}

// --- Client Methods ---

func (c *Client) readPump() {
	defer func() {
		c.hub.unregister <- c
		c.conn.Close()
	}()
	c.conn.SetReadLimit(maxMessageSize)
	c.conn.SetReadDeadline(time.Now().Add(pongWait))
	c.conn.SetPongHandler(func(string) error { c.conn.SetReadDeadline(time.Now().Add(pongWait)); return nil })

	for {
		_, message, err := c.conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				slog.Warn("Unexpected close error", "error", err)
			}
			break
		}
		c.room.broadcast <- message // Send the received message to the room's broadcast channel.
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

	// Create a temporary room struct just to pass the ID to the hub.
	// The hub will assign the client to the real room struct.
	tempRoom := &Room{id: passphrase}

	client := &Client{
		hub:  hub,
		conn: conn,
		send: make(chan []byte, 256),
		room: tempRoom,
	}
	client.hub.register <- client

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
