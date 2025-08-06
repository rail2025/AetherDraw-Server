// AetherDraw/Serialization/DrawableSerializer.js (and others)

// Replicating C# Enums for compatibility
const DrawMode = {
    Pen: 0,
    StraightLine: 1,
    Rectangle: 2,
    Circle: 3,
    Arrow: 4,
    Cone: 5,
    Dash: 6,
    Donut: 7,
    Triangle: 8,
    Select: 9,
    Eraser: 10,
    Image: 11,
    EmojiImage: 12,
    BossImage: 13,
    CircleAoEImage: 14,
    DonutAoEImage: 15,
    FlareImage: 16,
    LineStackImage: 17,
    SpreadImage: 18,
    StackImage: 19,
    Waymark1Image: 20,
    Waymark2Image: 21,
    Waymark3Image: 22,
    Waymark4Image: 23,
    WaymarkAImage: 24,
    WaymarkBImage: 25,
    WaymarkCImage: 26,
    WaymarkDImage: 27,
    RoleTankImage: 28,
    RoleHealerImage: 29,
    RoleMeleeImage: 30,
    RoleRangedImage: 31,
    TriangleImage: 32,
    SquareImage: 33,
    PlusImage: 34,
    CircleMarkImage: 35,
    Party1Image: 36,
    Party2Image: 37,
    Party3Image: 38,
    Party4Image: 39,
    Party5Image: 40,
    Party6Image: 41,
    Party7Image: 42,
    Party8Image: 43,
    TextTool: 44,
    StackIcon: 45,
    SpreadIcon: 46,
    TetherIcon: 47,
    BossIconPlaceholder: 48,
    AddMobIcon: 49,
    Dot1Image: 50,
    Dot2Image: 51,
    Dot3Image: 52,
    Dot4Image: 53,
    Dot5Image: 54,
    Dot6Image: 55,
    Dot7Image: 56,
    Dot8Image: 57,
};

const PayloadActionType = {
    AddObjects: 0,
    DeleteObjects: 1,
    UpdateObjects: 2,
    ClearPage: 3,
    ReplacePage: 4,
};

const SERIALIZATION_VERSION = 1;

// Helper to write string to buffer
function writeString(writer, str) {
    const buffer = new TextEncoder().encode(str);
    // C# BinaryWriter uses a variable-length quantity for string length.
    // This is a simple implementation for lengths up to 127.
    writer.writeUint8(buffer.length);
    for (let i = 0; i < buffer.length; i++) {
        writer.writeUint8(buffer[i]);
    }
}

// Helper to write a GUID to a buffer
function writeGuid(writer, guid) {
    const bytes = guid.replace(/-/g, '').match(/.{1,2}/g).map(byte => parseInt(byte, 16));
    bytes.forEach(b => writer.writeUint8(b));
}

// Custom BufferWriter to simplify writing to ArrayBuffer
class BufferWriter {
    constructor(size = 1024) {
        this.buffer = new ArrayBuffer(size);
        this.dataView = new DataView(this.buffer);
        this.offset = 0;
    }

    ensureCapacity(needed) {
        if (this.offset + needed > this.buffer.byteLength) {
            const newSize = Math.max(this.buffer.byteLength * 2, this.offset + needed);
            const newBuffer = new ArrayBuffer(newSize);
            new Uint8Array(newBuffer).set(new Uint8Array(this.buffer));
            this.buffer = newBuffer;
            this.dataView = new DataView(this.buffer);
        }
    }

    writeUint8(val) { this.ensureCapacity(1); this.dataView.setUint8(this.offset, val, true); this.offset += 1; }
    writeFloat32(val) { this.ensureCapacity(4); this.dataView.setFloat32(this.offset, val, true); this.offset += 4; }
    writeInt32(val) { this.ensureCapacity(4); this.dataView.setInt32(this.offset, val, true); this.offset += 4; }
    writeBytes(bytes) {
        this.ensureCapacity(bytes.length);
        new Uint8Array(this.buffer, this.offset).set(bytes);
        this.offset += bytes.length;
    }

    getBuffer() { return this.buffer.slice(0, this.offset); }
}


function serializeSingleDrawable(writer, drawable) {
    writer.writeUint8(drawable.objectDrawMode);

    // Common BaseDrawable Properties
    writer.writeFloat32(drawable.color.r);
    writer.writeFloat32(drawable.color.g);
    writer.writeFloat32(drawable.color.b);
    writer.writeFloat32(drawable.color.a);
    writer.writeFloat32(drawable.thickness);
    writer.writeUint8(drawable.isFilled ? 1 : 0);
    writeGuid(writer, drawable.uniqueId);

    // Type-Specific Properties
    switch (drawable.objectDrawMode) {
        case DrawMode.Pen:
        case DrawMode.Dash:
            writer.writeInt32(drawable.points.length);
            drawable.points.forEach(p => {
                writer.writeFloat32(p.x);
                writer.writeFloat32(p.y);
            });
            if (drawable.objectDrawMode === DrawMode.Dash) {
                writer.writeFloat32(drawable.dashLength);
                writer.writeFloat32(drawable.gapLength);
            }
            break;
        case DrawMode.StraightLine:
            writer.writeFloat32(drawable.startPoint.x);
            writer.writeFloat32(drawable.startPoint.y);
            writer.writeFloat32(drawable.endPoint.x);
            writer.writeFloat32(drawable.endPoint.y);
            break;
        case DrawMode.Rectangle:
            writer.writeFloat32(drawable.startPoint.x);
            writer.writeFloat32(drawable.startPoint.y);
            writer.writeFloat32(drawable.endPoint.x);
            writer.writeFloat32(drawable.endPoint.y);
            writer.writeFloat32(drawable.rotation);
            break;
        case DrawMode.Circle:
        case DrawMode.Donut:
            writer.writeFloat32(drawable.center.x);
            writer.writeFloat32(drawable.center.y);
            writer.writeFloat32(drawable.radius);
            break;
        case DrawMode.Arrow:
            writer.writeFloat32(drawable.startPoint.x);
            writer.writeFloat32(drawable.startPoint.y);
            writer.writeFloat32(drawable.endPoint.x);
            writer.writeFloat32(drawable.endPoint.y);
            writer.writeFloat32(drawable.rotation);
            writer.writeFloat32(drawable.arrowheadLengthOffset);
            writer.writeFloat32(drawable.arrowheadWidthScale);
            break;
        case DrawMode.Cone:
             writer.writeFloat32(drawable.apex.x);
             writer.writeFloat32(drawable.apex.y);
             writer.writeFloat32(drawable.baseCenter.x);
             writer.writeFloat32(drawable.baseCenter.y);
             writer.writeFloat32(drawable.rotation);
            break;
        case DrawMode.Triangle:
            drawable.vertices.forEach(v => {
                writer.writeFloat32(v.x);
                writer.writeFloat32(v.y);
            });
            break;
        case DrawMode.TextTool:
            writeString(writer, drawable.text);
            writer.writeFloat32(drawable.position.x);
            writer.writeFloat32(drawable.position.y);
            writer.writeFloat32(drawable.fontSize);
            writer.writeFloat32(drawable.wrappingWidth);
            break;
        // Image types
        default:
             if (drawable.objectDrawMode >= DrawMode.Image && drawable.objectDrawMode <= DrawMode.Dot8Image) {
                writeString(writer, drawable.imageResourcePath);
                writer.writeFloat32(drawable.position.x);
                writer.writeFloat32(drawable.position.y);
                writer.writeFloat32(drawable.drawSize.x);
                writer.writeFloat32(drawable.drawSize.y);
                writer.writeFloat32(drawable.rotation);
             }
            break;
    }
}

function serializePageToBytes(drawables) {
    const writer = new BufferWriter(1024 * 16); // 16KB initial buffer

    writer.writeInt32(SERIALIZATION_VERSION);
    writer.writeInt32(drawables.length);

    drawables.forEach(drawable => {
        serializeSingleDrawable(writer, drawable);
    });

    return writer.getBuffer();
}

function serializePayload(payload) {
    const writer = new BufferWriter(1024 * 16);
    
    writer.writeInt32(payload.pageIndex);
    writer.writeUint8(payload.action);
    
    if (payload.data && payload.data.byteLength > 0) {
        writer.writeInt32(payload.data.byteLength);
        writer.writeBytes(new Uint8Array(payload.data));
    } else {
        writer.writeInt32(0);
    }

    return writer.getBuffer();
}
