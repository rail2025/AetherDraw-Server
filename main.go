package main

import (
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"sync"
	"sync/atomic"
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
	// aetherBreakerMaxUsers is the maximum number of users in a 1v1 room.
	aetherBreakerMaxUsers = 2
	// loneClientTimeout is the duration to wait before closing a room with only one client.
	loneClientTimeout = 3 * time.Minute
	// roomLifetime is the maximum duration a room can exist before being closed.
	roomLifetime = 2 * time.Hour
	// roomCheckInterval is the frequency at which to check for expired rooms.
	roomCheckInterval = 5 * time.Minute
)

// warningMessage is the byte sequence sent to clients before the room is closed.
var warningMessage = []byte{5}

// --- BeastieBuddy Data Structures ---

// SourceMobInfo matches the structure of the ffxiv_patch_..._mobs.json files.
type SourceMobInfo struct {
	Name        string `json:"name"`
	Coordinates []struct {
		Zone string  `json:"zone"`
		X    float32 `json:"x"`
		Y    float32 `json:"y"`
	} `json:"coordinates"`
	Dungeon *string `json:"dungeon"`
}

// SearchableMobData is the flattened, in-memory structure used for searching.
// This is also the structure that will be sent to the client.
type SearchableMobData struct {
	Name string  `json:"Name"`
	Zone string  `json:"Zone"`
	X    float32 `json:"X"`
	Y    float32 `json:"Y"`
}

var mobDatabase []SearchableMobData

// --- Usage Tracking ---
type UsageStats struct {
	AetherDraw    atomic.Int64 `json:"aetherDraw"`
	AetherBreaker atomic.Int64 `json:"aetherBreaker"`
	BeastieBuddy  atomic.Int64 `json:"beastieBuddy"`
}

var stats = &UsageStats{}

// --- WebSocket Structures ---

// Message represents a single message to be broadcast to a room.
type Message struct {
	room   string
	data   []byte
	source *Client // The client that sent the message
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
	// Type of client ("ad" or "ab").
	clientType string
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

// --- GitHub API Structure ---
type RepoContent struct {
	Name        string `json:"name"`
	DownloadURL string `json:"download_url"`
	Type        string `json:"type"`
}

// --- Rate Limiter for HTTP Endpoints ---
type clientLimiter struct {
	limiter    *rate.Limiter
	lastSeen   time.Time
	dailyCount int
	dailyReset time.Time
}

var (
	httpClients = make(map[string]*clientLimiter)
	mu          sync.Mutex
)

// getLimiter retrieves or creates a rate limiter for a given IP address.
func getLimiter(ip string) *clientLimiter {
	mu.Lock()
	defer mu.Unlock()

	limiter, exists := httpClients[ip]
	if !exists {
		limiter = &clientLimiter{
			limiter:    rate.NewLimiter(2, 4), // 2 requests per second with a burst of 4
			dailyReset: time.Now().Add(24 * time.Hour),
		}
		httpClients[ip] = limiter
	}

	limiter.lastSeen = time.Now()
	return limiter
}

// rateLimitMiddleware applies rate limiting and a daily cap to an HTTP handler.
func rateLimitMiddleware(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ip := r.RemoteAddr
		limiter := getLimiter(ip)

		// Reset the daily count if 24 hours have passed
		if time.Now().After(limiter.dailyReset) {
			limiter.dailyCount = 0
			limiter.dailyReset = time.Now().Add(24 * time.Hour)
		}

		// Check the daily cap (e.g., 200 requests per day)
		if limiter.dailyCount >= 200 {
			http.Error(w, "Daily request limit exceeded", http.StatusTooManyRequests)
			return
		}

		if !limiter.limiter.Allow() {
			http.Error(w, http.StatusText(http.StatusTooManyRequests), http.StatusTooManyRequests)
			return
		}

		limiter.dailyCount++
		next.ServeHTTP(w, r)
	}
}

// cleanupLimiters periodically removes old entries from the httpClients map.
func cleanupLimiters() {
	for {
		time.Sleep(10 * time.Minute)
		mu.Lock()
		for ip, client := range httpClients {
			if time.Since(client.lastSeen) > 15*time.Minute {
				delete(httpClients, ip)
			}
		}
		mu.Unlock()
	}
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
			// Increment stats based on client type
			if client.clientType == "ad" {
				stats.AetherDraw.Add(1)
			} else if client.clientType == "ab" {
				stats.AetherBreaker.Add(1)
			}
			slog.Info("Client registered", "room", client.room, "clientType", client.clientType)

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
			slog.Info("Client history sent", "room", client.room, "clients_in_room", len(room.clients))

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
				// Only store history for AetherDraw clients, not for AetherBreaker games.
				if message.source.clientType != "ab" {
					room.history = append(room.history, message.data)
					if len(room.history) > historyCap {
						room.history = room.history[1:]
					}
				}
				room.historyMux.Unlock()

				// If the message is from an "ab" client, send only to the other player.
				if message.source.clientType == "ab" {
					for client := range room.clients {
						if client != message.source {
							select {
							case client.send <- message.data:
							default:
								close(client.send)
								delete(room.clients, client)
							}
						}
					}
				} else {
					// Otherwise (for "ad" clients), broadcast to everyone.
					for client := range room.clients {
						select {
						case client.send <- message.data:
						default:
							close(client.send)
							delete(room.clients, client)
						}
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
		// Include the client 'c' as the source of the message.
		message := &Message{room: c.room, data: msgData, source: c}
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
	// Get the client type from the query parameters.
	clientType := r.URL.Query().Get("client")

	isPartyRoom := len(passphrase) == 64
	maxUsers := maxUsersShared
	if isPartyRoom {
		maxUsers = maxUsersParty
	}
	// If the client is AetherBreaker, enforce the 2-player limit.
	if clientType == "ab" {
		maxUsers = aetherBreakerMaxUsers
	}

	hub.roomsMux.Lock()
	if room, ok := hub.rooms[passphrase]; ok {
		if len(room.clients) >= maxUsers {
			hub.roomsMux.Unlock()
			http.Error(w, "Room is full", http.StatusForbidden)
			slog.Warn("Rejected connection to full room", "room", passphrase, "current", len(room.clients), "max", maxUsers, "clientType", clientType)
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
		hub:        hub,
		conn:       conn,
		send:       make(chan []byte, 256),
		room:       passphrase,
		clientType: clientType, // Store the client type.
		limiter:    limiter,
	}
	client.hub.register <- client

	go client.writePump()
	go client.readPump()
}

// --- BeastieBuddy Search Handler ---
func handleBeastieBuddySearch(w http.ResponseWriter, r *http.Request) {
	stats.BeastieBuddy.Add(1) // Increment counter

	query := r.URL.Query().Get("query")
	if query == "" {
		http.Error(w, "Query parameter is required", http.StatusBadRequest)
		return
	}

	var results []SearchableMobData
	for _, mob := range mobDatabase {
		if strings.Contains(strings.ToLower(mob.Name), strings.ToLower(query)) {
			results = append(results, mob)
		}
	}

	// Return top 10 results
	if len(results) > 10 {
		results = results[:10]
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(results)
}

// --- Stats Handler ---
func handleStats(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	// Create a temporary struct to read atomic values for JSON encoding
	data := struct {
		AetherDraw    int64 `json:"aetherDraw"`
		AetherBreaker int64 `json:"aetherBreaker"`
		BeastieBuddy  int64 `json:"beastieBuddy"`
	}{
		AetherDraw:    stats.AetherDraw.Load(),
		AetherBreaker: stats.AetherBreaker.Load(),
		BeastieBuddy:  stats.BeastieBuddy.Load(),
	}
	json.NewEncoder(w).Encode(data)
}

// --- CORS Middleware ---
func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// --- Data Loading and Transformation ---
func loadAndTransformMobData() {
	githubToken := os.Getenv("GITHUB_TOKEN")
	repoURL := os.Getenv("DATABASE_REPO_URL")

	if githubToken == "" || repoURL == "" {
		slog.Error("GITHUB_TOKEN and DATABASE_REPO_URL environment variables must be set")
		os.Exit(1)
	}

	client := &http.Client{}
	req, err := http.NewRequest("GET", "https://"+repoURL, nil)
	if err != nil {
		slog.Error("Failed to create request for repo contents", "error", err)
		os.Exit(1)
	}
	req.Header.Set("Authorization", "Bearer "+githubToken)
	req.Header.Set("Accept", "application/vnd.github.v3+json")

	resp, err := client.Do(req)
	if err != nil {
		slog.Error("Failed to fetch repo contents from GitHub", "error", err)
		os.Exit(1)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		slog.Error("GitHub API returned non-200 status for repo contents", "status", resp.Status, "body", string(bodyBytes))
		os.Exit(1)
	}

	var contents []RepoContent
	if err := json.NewDecoder(resp.Body).Decode(&contents); err != nil {
		slog.Error("Failed to decode GitHub repo contents JSON", "error", err)
		os.Exit(1)
	}

	var sourceMobs []SourceMobInfo
	var wg sync.WaitGroup
	var mobsMutex sync.Mutex

	for _, content := range contents {
		if content.Type == "file" && strings.HasSuffix(content.Name, ".json") {
			wg.Add(1)
			go func(fileContent RepoContent) {
				defer wg.Done()
				slog.Info("Downloading mob data file", "file", fileContent.Name)
				fileReq, _ := http.NewRequest("GET", fileContent.DownloadURL, nil)
				fileReq.Header.Set("Authorization", "Bearer "+githubToken)

				fileResp, err := client.Do(fileReq)
				if err != nil {
					slog.Error("Failed to download file content", "file", fileContent.Name, "error", err)
					return
				}
				defer fileResp.Body.Close()

				if fileResp.StatusCode != http.StatusOK {
					slog.Error("GitHub API returned non-200 status for file download", "file", fileContent.Name, "status", fileResp.Status)
					return
				}

				var mobs []SourceMobInfo
				if err := json.NewDecoder(fileResp.Body).Decode(&mobs); err != nil {
					slog.Error("Failed to unmarshal mob data from file", "file", fileContent.Name, "error", err)
					return
				}
				mobsMutex.Lock()
				sourceMobs = append(sourceMobs, mobs...)
				mobsMutex.Unlock()
			}(content)
		}
	}

	wg.Wait()

	// Transform the source data into the simple, searchable format.
	for _, mob := range sourceMobs {
		if mob.Dungeon != nil && *mob.Dungeon != "" {
			mobDatabase = append(mobDatabase, SearchableMobData{
				Name: mob.Name,
				Zone: *mob.Dungeon,
				X:    0,
				Y:    0,
			})
		} else {
			for _, coord := range mob.Coordinates {
				mobDatabase = append(mobDatabase, SearchableMobData{
					Name: mob.Name,
					Zone: coord.Zone,
					X:    coord.X,
					Y:    coord.Y,
				})
			}
		}
	}
	slog.Info("Successfully loaded and transformed mob database from GitHub", "entries", len(mobDatabase))
}


// main is the entry point for the application.
func main() {
	// Setup structured logging.
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	slog.SetDefault(logger)

	// Load and process mob data.
	loadAndTransformMobData()

	// Start the limiter cleanup goroutine
	go cleanupLimiters()

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

	// Goroutine to ping itself to prevent the Render free tier from sleeping.
	go func() {
		// Wait a moment for the server to start before the first ping.
		time.Sleep(1 * time.Minute)
		ticker := time.NewTicker(13 * time.Minute)
		defer ticker.Stop()
		for {
			select {
			case <-ticker.C:
				port := os.Getenv("PORT")
				if port == "" {
					port = "8080"
				}
				url := "http://localhost:" + port + "/hello"
				
				resp, err := http.Get(url)
				if err != nil {
					slog.Error("Self-ping failed", "error", err)
					continue
				}
				resp.Body.Close()
				slog.Info("Successfully pinged self to prevent idling.")
			}
		}
	}()

	// Configure the HTTP server.
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/ws", func(w http.ResponseWriter, r *http.Request) {
		serveWs(hub, w, r)
	})
	mux.HandleFunc("/hello", func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte("Hello, AetherDraw Relay Server!"))
	})
	mux.HandleFunc("/beastiebuddy/search", rateLimitMiddleware(handleBeastieBuddySearch))
	mux.HandleFunc("/stats", handleStats)

	server := &http.Server{
		Addr:    ":" + port,
		Handler: corsMiddleware(mux),
	}

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
