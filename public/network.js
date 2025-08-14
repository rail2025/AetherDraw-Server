/**
 * AetherDraw Web Network Module
 * Manages WebSocket connection, message sending, and message receiving.
 */

const MessageType = {
    STATE_UPDATE: 0,
    ROOM_CLOSING_IMMINENTLY: 1,
};

class NetworkManager {
    constructor() {
        this.webSocket = null;
        // Callbacks to be set by the main application
        this.onConnected = () => { };
        this.onDisconnected = () => { };
        this.onError = (err) => console.error(err);
        this.onStateUpdateReceived = (payload) => { };
        this.onRoomClosingWarning = () => { };
    }

    isConnected() {
        return this.webSocket && this.webSocket.readyState === WebSocket.OPEN;
    }

    /**
     * Connects to the WebSocket server with a given passphrase.
     * @param {string} serverUri The WebSocket server URL.
     * @param {string} passphrase The room identifier.
     */
    async connect(serverUri, passphrase) {
        if (this.isConnected()) {
            await this.disconnect();
        }

        try {
            const connectUri = `${serverUri}?passphrase=${encodeURIComponent(passphrase)}&client=ad-web`;
            this.webSocket = new WebSocket(connectUri);
            this.webSocket.binaryType = 'arraybuffer';

            this.webSocket.onopen = () => {
                console.log("WebSocket connected successfully.");
                this.onConnected();
            };

            this.webSocket.onclose = (event) => {
                console.log("WebSocket disconnected.", event.reason);
                this.webSocket = null;
                this.onDisconnected();
            };

            this.webSocket.onerror = (event) => {
                console.error("WebSocket error observed:", event);
                this.onError("WebSocket connection error.");
            };

            this.webSocket.onmessage = (event) => {
                this.handleReceivedMessage(event.data);
            };

        } catch (ex) {
            this.onError(`Connection failed: ${ex.message}`);
        }
    }

    /**
     * Disconnects from the server gracefully.
     */
    async disconnect() {
        if (this.webSocket && this.webSocket.readyState === WebSocket.OPEN) {
            this.webSocket.close(1000, "Client disconnecting");
        }
        this.webSocket = null;
    }

    /**
     * Parses incoming binary messages from the server.
     * @param {ArrayBuffer} messageBytes The raw message data.
     */
    handleReceivedMessage(messageBytes) {
        if (messageBytes.byteLength < 1) return;

        const reader = new BufferHandler(messageBytes);
        const type = reader.readUint8();
        const payloadBytes = messageBytes.slice(1);

        switch (type) {
            case MessageType.STATE_UPDATE:
                const payload = deserializePayload(payloadBytes);
                if (payload) {
                    this.onStateUpdateReceived(payload);
                }
                break;
            case MessageType.ROOM_CLOSING_IMMINENTLY:
                this.onRoomClosingWarning();
                break;
        }
    }

    /**
     * Serializes and sends a state update payload to the server.
     * @param {object} payload The payload object { pageIndex, action, data }.
     */
    async sendStateUpdate(payload) {
        if (!this.isConnected()) {
            console.warn("Attempted to send state update while disconnected.");
            return;
        }

        try {
            const payloadBytes = serializePayload(payload);
            const message = new Uint8Array(1 + payloadBytes.byteLength);

            message[0] = MessageType.STATE_UPDATE;
            message.set(new Uint8Array(payloadBytes), 1);

            this.webSocket.send(message.buffer);
        } catch (ex) {
            this.onError(`Failed to send message: ${ex.message}`);
            await this.disconnect();
        }
    }
}