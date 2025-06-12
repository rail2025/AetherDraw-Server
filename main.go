package main

import (
	"log"
	"net/http"

	"github.com/gorilla/websocket"
)

// Configure the upgrader
var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		// Allow all connections for now (you might want to restrict this in production)
		return true
	},
}

// Define a handler for WebSocket connections
func handleConnections(w http.ResponseWriter, r *http.Request) {
	// Upgrade initial GET request to a WebSocket
	ws, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("Error upgrading to WebSocket: %v", err)
		return
	}
	// Make sure we close the connection when the function returns
	defer ws.Close()

	log.Println("Client Connected")

	for {
		// Read message from browser
		messageType, p, err := ws.ReadMessage()
		if err != nil {
			log.Printf("Error reading message: %v", err)
			// Check if it's a normal closure
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("Unexpected close error: %v", err)
			}
			break // Break the loop to close conn and end goroutine
		}

		log.Printf("Received message: %s", string(p))

		// Write message back to browser (echo)
		if err := ws.WriteMessage(messageType, p); err != nil {
			log.Printf("Error writing message: %v", err)
			break // Break the loop
		}
	}
}

func main() {
	// Configure WebSocket route
	http.HandleFunc("/ws", handleConnections)

	// Configure the /hello route from before (optional, can be removed)
	http.HandleFunc("/hello", func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte("Hello, AetherDraw Server with WebSocket support!"))
	})

	port := "8080"
	log.Printf("Server starting on port %s, WebSocket on /ws\n", port)

	// Start the server
	err := http.ListenAndServe(":"+port, nil)
	if err != nil {
		log.Fatalf("ListenAndServe: %v", err)
	}
}
