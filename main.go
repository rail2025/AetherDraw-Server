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

type Message struct {
	room string
	data []byte
}

type Client struct {
	hub  *Hub
	conn *websocket.Conn
	send chan []byte
	room string
}

type Room struct {
	clients map[*Client]bool
}

type Hub struct {
	serverID   string
	rooms      map[string]*Room
	roomsMux   sync.RWMutex
	broadcast  chan *Message
	register   chan *Client
	unregister chan *Client
}

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true },
}

func newHub() *Hub {
	return &Hub{
		serverID:   uuid.New().String(),
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
				room = &Room{clients: make(map[*Client]bool)}
				h.rooms[client.room] = room
				slog.Info("Created new room", "room", client.room, "serverID", h.serverID)
			}
			room.clients[client] = true
			h.roomsMux.Unlock()
			slog.Info("Client registered", "room", client.room, "serverID", h.serverID)

		case client := <-h.unregister:
			h.roomsMux.Lock()
			if room, ok := h.rooms[client.room]; ok {
				if _, ok := room.clients[client]; ok {
					delete(room.clients, client)
					close(client.send)
					slog.Info("Client unregistered", "room", client.room, "serverID", h.serverID)
				}
			}
			h.roomsMux.Unlock()

		case message := <-h.broadcast:
			slog.Info("Hub received message to broadcast", "room", message.room, "serverID", h.serverID, "dataLen", len(message.data))
			h.roomsMux.RLock()
			if room, ok := h.rooms[message.room]; ok {
				slog.Info("Broadcasting to clients in room", "room", message.room, "clientCount", len(room.clients))
				for client := range room.clients {
					slog.Info("Attempting to send message to client", "room", message.room, "clientAddr", client.conn.RemoteAddr())
					select {
					case client.send <- message.data:
						slog.Info("Message successfully queued for client", "clientAddr", client.conn.RemoteAddr())
					default:
						slog.Warn("Send channel full, closing client", "clientAddr", client.conn.RemoteAddr())
						close(client.send)
						delete(room.clients, client)
					}
				}
			} else {
				slog.Warn("Hub received broadcast for non-existent room", "room", message.room)
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
				slog.Warn("readPump: Unexpected close error", "error", err)
			} else {
				slog.Info("readPump: Normal closure or error", "error", err)
			}
			break
		}
		slog.Info("Message received from client", "clientAddr", c.conn.RemoteAddr(), "dataLen", len(msgData))
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
				slog.Info("writePump: send channel closed", "clientAddr", c.conn.RemoteAddr())
				c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}
			slog.Info("writePump sending message to client", "clientAddr", c.conn.RemoteAddr(), "dataLen", len(message))
			if err := c.conn.WriteMessage(websocket.BinaryMessage, message); err != nil {
				slog.Warn("writePump: Error writing message", "error", err)
				return
			}
			slog.Info("writePump message sent successfully", "clientAddr", c.conn.RemoteAddr())
		case <-ticker.C:
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				slog.Warn("writePump: Error sending ping", "error", err)
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
