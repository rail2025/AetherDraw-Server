class BufferHandler {
    constructor(buffer) {
        this.buffer = buffer || new ArrayBuffer(1024); // Start with a 1KB buffer for writing.
        this.view = new DataView(this.buffer);
        this.offset = 0;
        this.textEncoder = new TextEncoder();
        this.textDecoder = new TextDecoder();
    }

    ensureCapacity(byteLength) {
        if (this.offset + byteLength > this.buffer.byteLength) {
            const newBuffer = new ArrayBuffer(Math.max(this.offset + byteLength, this.buffer.byteLength * 2));
            new Uint8Array(newBuffer).set(new Uint8Array(this.buffer)); 
            this.buffer = newBuffer;
            this.view = new DataView(this.buffer);
        }
    }

    // --- WRITE METHODS ---

    writeBytes(bytes) {
        this.ensureCapacity(bytes.length);
        new Uint8Array(this.buffer).set(bytes, this.offset);
        this.offset += bytes.length;
    }

    writeInt32(value) {
        this.ensureCapacity(4);
        this.view.setInt32(this.offset, value, true); // true for little-endian
        this.offset += 4;
    }

    writeUint16(value) {
        this.ensureCapacity(2);
        this.view.setUint16(this.offset, value, true); // true for little-endian
        this.offset += 2;
    }

    writeUint8(value) {
        this.ensureCapacity(1);
        this.view.setUint8(this.offset, value);
        this.offset += 1;
    }
    
    writeString(str) {
        const encodedString = this.textEncoder.encode(str);
        this.writeUint16(encodedString.length); // Write length prefix (as 2 bytes)
        this.writeBytes(encodedString);
    }
    
    // --- READ METHODS ---

    readBytes(length) {
        if (this.offset + length > this.buffer.byteLength) {
            throw new Error("Attempted to read past the end of the buffer.");
        }
        const bytes = new Uint8Array(this.buffer, this.offset, length);
        this.offset += length;
        return bytes;
    }

    readInt32() {
        const value = this.view.getInt32(this.offset, true);
        this.offset += 4;
        return value;
    }
    
    readUint16() {
        const value = this.view.getUint16(this.offset, true);
        this.offset += 2;
        return value;
    }

    readUint8() {
        const value = this.view.getUint8(this.offset);
        this.offset += 1;
        return value;
    }

    readString() {
        const length = this.readUint16(); // Read length prefix
        const bytes = this.readBytes(length);
        return this.textDecoder.decode(bytes);
    }

    // --- UTILITY ---

    getBuffer() {
        return this.buffer.slice(0, this.offset);
    }
}