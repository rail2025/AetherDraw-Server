class NetworkManager {
    constructor() {
        this.webSocket = null;
        this.onConnected = () => {};
        this.onDisconnected = () => {};
        this.onError = (err) => {};
        this.onStateUpdateReceived = (payload) => {};
        this.onRoomClosingWarning = () => {};
    }

    get isConnected() {
        return this.webSocket?.readyState === WebSocket.OPEN;
    }

    async connectAsync(serverUri, passphrase) {
        if (this.isConnected) return;

        try {
            const connectUri = `${serverUri}?passphrase=${encodeURIComponent(passphrase)}&client=ad-web`;
            this.webSocket = new WebSocket(connectUri);
            this.webSocket.binaryType = 'arraybuffer';

            this.webSocket.onopen = () => {
                this.onConnected();
            };

            this.webSocket.onclose = () => {
                this.webSocket = null;
                this.onDisconnected();
            };

            this.webSocket.onerror = (event) => {
                this.onError("WebSocket connection error.");
            };

            this.webSocket.onmessage = (event) => {
                this._handleReceivedMessage(event.data);
            };

        } catch (ex) {
            this.onError(`Connection failed: ${ex.message}`);
            await this.disconnectAsync();
        }
    }

    async disconnectAsync() {
        if (!this.webSocket) return;

        if (this.webSocket.readyState === WebSocket.OPEN) {
            try {
                this.webSocket.close(1000, "Client disconnecting");
            } catch (ex) {
                // Ignore errors on close
            }
        }
        
        this.webSocket = null;
        this.onDisconnected();
    }

    _handleReceivedMessage(messageBytes) {
        if (!(messageBytes instanceof ArrayBuffer) || messageBytes.byteLength < 1) return;

        const view = new Uint8Array(messageBytes);
        const type = view[0];
        const payloadBytes = messageBytes.slice(1);

        switch (type) {
            case MessageType.STATE_UPDATE:
                const payload = PayloadSerializer.deserialize(payloadBytes);
                if (payload) {
                    this.onStateUpdateReceived(payload);
                }
                break;

            case MessageType.ROOM_CLOSING_IMMINENTLY:
                this.onRoomClosingWarning();
                break;
        }
    }

    async sendStateUpdateAsync(payload) {
        if (!this.isConnected) return;

        try {
            const payloadBytes = PayloadSerializer.serialize(payload);
            const messageToSend = new Uint8Array(1 + payloadBytes.byteLength);
            
            messageToSend[0] = MessageType.STATE_UPDATE;
            messageToSend.set(new Uint8Array(payloadBytes), 1);

            this.webSocket.send(messageToSend.buffer);
        } catch (ex) {
            this.onError(`Failed to send message: ${ex.message}`);
            await this.disconnectAsync();
        }
    }

    dispose() {
        this.disconnectAsync();
    }
}