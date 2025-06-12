package main

import (
	"log/slog"
	"net/http"
	"os"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/websocket"
)

const (
	writeWait      = 10 * time.Second
	pongWait       = 60 * time.Second
	pingPeriod     = (pongWait * 9) / 10
	maxMessageSize = 16 * 1024
)

// Message is a container for data sent from a client to the hub.
type Message struct {
	room string
	data []byte
}

// Client is a middleman between the websocket connection and the hub.
type Client struct {
	hub  *Hub
	conn *websocket.Conn
	send chan []byte
	room string
}

// Room holds the set of clients.
type Room struct {
	clients map[*Client]bool
}

// Hub maintains the set of active clients and broadcasts messages to the correct rooms.
type Hub struct {
	serverID   string // A unique ID for this server instance.
	rooms      map[string]*Room
	roomsMux   sync.RWMutex
	broadcast  chan *Message
	register   chan *Client
	unregister chan *Client
}

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

func newHub() *Hub {
	return &Hub{
		serverID:   uuid.New().String(), // Assign a unique ID on startup.
		broadcast:  make(chan *Message),
		register:   make(chan *Client),
		unregister: make(chan *Client),
		rooms:      make(map[string]*Room),
	}
}

func (h *Hub) run() {
	slog.Info("Hub is running", "serverID", h.serverID)
	for {
		select {
		case client := <-h.register:
			h.roomsMux.Lock()
			room, ok := h.rooms[client.room]
			if !ok {
				room = &Room{
					clients: make(map[*Client]bool),
				}
				h.rooms[client.room] = room
				slog.Info("Created new room", "room", client.room, "serverID", h.serverID)
			}
			room.clients[client] = true
			h.roomsMux.Unlock()
			slog.Info("Client registered", "room", client.room, "serverID", h.serverID, "remoteAddr", client.conn.RemoteAddr())

		case client := <-h.unregister:
			h.roomsMux.Lock()
			if room, ok := h.rooms[client.room]; ok {
				if _, ok := room.clients[client]; ok {
					delete(room.clients, client)
					close(client.send)
					slog.Info("Client unregistered", "room", client.room, "serverID", h.serverID, "remoteAddr", client.conn.RemoteAddr())
				}
			}
			h.roomsMux.Unlock()

		case message := <-h.broadcast:
			h.roomsMux.RLock()
			if room, ok := h.rooms[message.room]; ok {
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
		}
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
		_, msgData, err := c.conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				slog.Warn("Unexpected close error", "error", err, "serverID", c.hub.serverID)
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
		slog.Warn("Connection attempt without passphrase", "serverID", hub.serverID)
		http.Error(w, "Passphrase is required", http.StatusBadRequest)
		return
	}
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		slog.Error("Failed to upgrade connection", "error", err, "serverID", hub.serverID)
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
