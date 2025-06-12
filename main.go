package main

import (
	"log/slog"
	"net/http"
	"os"
	"sync"

	"github.com/gorilla/websocket"
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
		// In production, you should validate the origin.
		// For now, we allow any origin for development purposes.
		return true
	},
}

// newHub creates and initializes a new Hub.
func newHub() *Hub {
	return &Hub{
		register:   make(chan *Client),
		unregister: make(chan *Client),
		rooms:      make(map[string]*Room),
	}
}

// run starts the Hub's event loop for managing client registrations.
func (h *Hub) run() {
	// This loop will handle new client connections and disconnections.
	// We will implement the logic in a future step.
	for {
		select {
		case <-h.register:
			// Registration logic will be added here.
		case <-h.unregister:
			// Unregistration logic will be added here.
		}
	}
}

// --- HTTP Handler ---

// serveWs handles websocket requests from the peer.
func serveWs(hub *Hub, w http.ResponseWriter, r *http.Request) {
	// Passphrase will be used as the room name.
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

	// Client creation logic will be added here to connect to the hub and room.
	// For now, we just log the connection and close it.
	slog.Info("Client connected", "room", passphrase, "remoteAddr", conn.RemoteAddr())
	// In this temporary state, the connection will be immediately closed
	// because we are not yet creating a Client struct and its read/write loops.
	defer conn.Close()
}

// --- Main Application ---

func main() {
	// Use structured logging
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	slog.SetDefault(logger)

	hub := newHub()
	go hub.run()

	http.HandleFunc("/ws", func(w http.ResponseWriter, r *http.Request) {
		serveWs(hub, w, r)
	})

	// For health checks and initial verification
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
