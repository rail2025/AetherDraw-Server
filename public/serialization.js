// AetherDraw/Serialization/DrawableSerializer.js (and others)

// Replicating C# Enums for compatibility
const DrawMode = {
    Pen: 0, StraightLine: 1, Rectangle: 2, Circle: 3, Arrow: 4, Cone: 5, Dash: 6, Donut: 7, Triangle: 8,
    Select: 9, Eraser: 10, Image: 11, EmojiImage: 12,
    // Omitting the rest for brevity, but they would be mapped here
};

const PayloadActionType = {
    AddObjects: 0, DeleteObjects: 1, UpdateObjects: 2, ClearPage: 3, ReplacePage: 4,
};

const SERIALIZATION_VERSION = 1;

// Helper to write string to buffer
function writeString(writer, str) {
    const buffer = new TextEncoder().encode(str);
    writer.writeUint8(buffer.length); // Assuming length fits in a byte for simplicity
    for (let i = 0; i < buffer.length; i++) {
        writer.writeUint8(buffer[i]);
    }
}

// Helper to write a UUID to a buffer
function writeGuid(writer, guid) {
    const bytes = guid.split('-').join('').match(/.{1,2}/g).map(byte => parseInt(byte, 16));
    bytes.forEach(b => writer.writeUint8(b));
}

// Custom BufferWriter to simplify writing to ArrayBuffer
class BufferWriter {
    constructor(size) {
        this.buffer = new ArrayBuffer(size);
        this.dataView = new DataView(this.buffer);
        this.offset = 0;
    }
    writeUint8(val) { this.dataView.setUint8(this.offset, val); this.offset += 1; }
    writeFloat32(val) { this.dataView.setFloat32(this.offset, val, true); this.offset += 4; }
    writeInt32(val) { this.dataView.setInt32(this.offset, val, true); this.offset += 4; }
    getBuffer() { return this.buffer.slice(0, this.offset); }
}


function serializeSingleDrawable(writer, drawable) {
    // 1. Write Type Discriminator
    writer.writeUint8(drawable.objectDrawMode);

    // 2. Write Common BaseDrawable Properties
    writer.writeFloat32(drawable.color.r);
    writer.writeFloat32(drawable.color.g);
    writer.writeFloat32(drawable.color.b);
    writer.writeFloat32(drawable.color.a);
    writer.writeFloat32(drawable.thickness);
    writer.writeUint8(drawable.isFilled ? 1 : 0);
    // writeGuid(writer, drawable.uniqueId); // We'll add this later

    // 3. Write Type-Specific Properties
    switch (drawable.objectDrawMode) {
        case DrawMode.Rectangle:
            writer.writeFloat32(drawable.startPoint.x);
            writer.writeFloat32(drawable.startPoint.y);
            writer.writeFloat32(drawable.endPoint.x);
            writer.writeFloat32(drawable.endPoint.y);
            writer.writeFloat32(drawable.rotation);
            break;
        // Add other shapes here as we implement them
    }
}

function serializePageToBytes(drawables) {
    // Estimate buffer size (this is a rough guess, can be improved)
    const writer = new BufferWriter(1024 * 10); // 10KB buffer

    writer.writeInt32(SERIALIZATION_VERSION);
    writer.writeInt32(drawables.length);

    drawables.forEach(drawable => {
        serializeSingleDrawable(writer, drawable);
    });

    return writer.getBuffer();
}
