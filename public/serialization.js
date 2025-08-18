/**
 * AetherDraw Web Serialization Module (for Konva.js)
 * Handles binary serialization and deserialization of drawable objects and network payloads
 * to ensure compatibility with the AetherDraw C# plugin.
 */

const DrawMode = {
    Pen: 0, StraightLine: 1, Rectangle: 2, Circle: 3, Arrow: 4, Cone: 5, Dash: 6, Donut: 7, Triangle: 8,
    Select: 9, Eraser: 10, Image: 11, EmojiImage: 12, BossImage: 13, CircleAoEImage: 14, DonutAoEImage: 15,
    FlareImage: 16, LineStackImage: 17, SpreadImage: 18, StackImage: 19, Waymark1Image: 20, Waymark2Image: 21,
    Waymark3Image: 22, Waymark4Image: 23, WaymarkAImage: 24, WaymarkBImage: 25, WaymarkCImage: 26, WaymarkDImage: 27,
    RoleTankImage: 28, RoleHealerImage: 29, RoleMeleeImage: 30, RoleRangedImage: 31, TriangleImage: 32,
    SquareImage: 33, PlusImage: 34, CircleMarkImage: 35, Party1Image: 36, Party2Image: 37, Party3Image: 38,
    Party4Image: 39, Party5Image: 40, Party6Image: 41, Party7Image: 42, Party8Image: 43, TextTool: 44,
    StackIcon: 19, SpreadIcon: 18, TetherIcon: 47, BossIconPlaceholder: 48, AddMobIcon: 49, Dot1Image: 50,
    Dot2Image: 51, Dot3Image: 52, Dot4Image: 53, Dot5Image: 54, Dot6Image: 55, Dot7Image: 56, Dot8Image: 57,
};

const PayloadActionType = {
    AddObjects: 0,
    DeleteObjects: 1,
    UpdateObjects: 2,
    ClearPage: 3,
    ReplacePage: 4,
};

const SERIALIZATION_VERSION = 1;

class BufferHandler {
    constructor(buffer) {
        this.buffer = buffer || new ArrayBuffer(1024);
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
    writeBytes(bytes) { this.ensureCapacity(bytes.length); new Uint8Array(this.buffer, this.offset, bytes.length).set(bytes); this.offset += bytes.length; }
    writeString(str) {
        const buffer = new TextEncoder().encode(str);
        let len = buffer.length;
        this.writeUint8(len); // Using simple length prefix for compatibility with C# BinaryWriter
        this.writeBytes(buffer);
    }
    
    writeGuid(guid) {
        const hex = guid.replace(/-/g, '');
        const bytes = new Uint8Array(16);
        for (let i = 0; i < 16; i++) {
            bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
        }
        
        [bytes[0], bytes[1], bytes[2], bytes[3]] = [bytes[3], bytes[2], bytes[1], bytes[0]];
        [bytes[4], bytes[5]] = [bytes[5], bytes[4]];
        [bytes[6], bytes[7]] = [bytes[7], bytes[6]];
        
        this.writeBytes(bytes);
    }

    readUint8() { const v = this.dataView.getUint8(this.offset, true); this.offset += 1; return v; }
    readFloat32() { const v = this.dataView.getFloat32(this.offset, true); this.offset += 4; return v; }
    readInt32() { const v = this.dataView.getInt32(this.offset, true); this.offset += 4; return v; }
    readBytes(len) { const b = this.buffer.slice(this.offset, this.offset + len); this.offset += len; return new Uint8Array(b); }
    readString() {
        let len = 0, shift = 0, b;
        do { b = this.readUint8(); len |= (b & 0x7F) << shift; shift += 7; } while ((b & 0x80) !== 0);
        const buffer = this.readBytes(len);
        return new TextDecoder().decode(buffer);
    }

    readGuid() {
        const bytes = Array.from(this.readBytes(16));
        
        [bytes[0], bytes[1], bytes[2], bytes[3]] = [bytes[3], bytes[2], bytes[1], bytes[0]];
        [bytes[4], bytes[5]] = [bytes[5], bytes[4]];
        [bytes[6], bytes[7]] = [bytes[7], bytes[6]];

        const s = (b, o, l) => b.slice(o, o + l).map(x => x.toString(16).padStart(2, '0')).join('');
        return `${s(bytes, 0, 4)}-${s(bytes, 4, 2)}-${s(bytes, 6, 2)}-${s(bytes, 8, 2)}-${s(bytes, 10, 6)}`;
    }

    getBuffer() { return this.buffer.slice(0, this.offset); }
}

function serializeSingleDrawable(writer, drawable) {
    writer.writeUint8(drawable.objectDrawMode);

    const colorStr = drawable.stroke || drawable.fill || '#FFFFFF';
    const rgba = Konva.Util.getRGB(colorStr);
    
    writer.writeFloat32(rgba.r / 255);
    writer.writeFloat32(rgba.g / 255);
    writer.writeFloat32(rgba.b / 255);
    writer.writeFloat32(rgba.a !== undefined ? rgba.a : 1.0);

    writer.writeFloat32(drawable.strokeWidth || 1);
    writer.writeUint8(drawable.fill && drawable.fill !== 'transparent' ? 1 : 0);
    writer.writeGuid(drawable.uniqueId);

    switch (drawable.objectDrawMode) {
        case DrawMode.Pen:
        case DrawMode.Dash:
        case DrawMode.Triangle:
            writer.writeInt32(drawable.points.length);
            drawable.points.forEach(p => { writer.writeFloat32(p.x); writer.writeFloat32(p.y); });
            if (drawable.objectDrawMode === DrawMode.Dash) {
                // MODIFIED: This logic is a placeholder and incorrect.
                // It should serialize actual DashLength and GapLength properties.
                writer.writeFloat32(drawable.strokeWidth * 2.5);
                writer.writeFloat32(drawable.strokeWidth * 1.25);
            }
            break;
        default:
            if (drawable.objectDrawMode >= DrawMode.Image && drawable.objectDrawMode <= DrawMode.Dot8Image) {
                // MODIFIED: Write the C# compatible resource path instead of the local URL.
                writer.writeString(drawable.pluginResourcePath || '');
                writer.writeFloat32(drawable.left); 
                writer.writeFloat32(drawable.top);
                writer.writeFloat32(drawable.width);
                writer.writeFloat32(drawable.height);
                writer.writeFloat32(drawable.angle * (Math.PI / 180)); // Convert degrees to radians
            } else {
                console.warn("Serialization for mode not implemented:", drawable.objectDrawMode);
            }
            break;
    }
}

// MODIFIED: Function now accepts reverse maps to find local URLs for rendering
function deserializeSingleDrawable(reader, pluginResourcePathToToolName, allModeDetails) {
    const mode = reader.readUint8();
    const r = reader.readFloat32() * 255;
    const g = reader.readFloat32() * 255;
    const b = reader.readFloat32() * 255;
    const a = reader.readFloat32();
    const color = `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${a})`;
    const thickness = reader.readFloat32();
    const isFilled = reader.readUint8() === 1;
    const uniqueId = reader.readGuid();

    let drawable = { uniqueId, objectDrawMode: mode, strokeWidth: thickness };

    switch (mode) {
        case DrawMode.Pen:
        case DrawMode.Dash:
        case DrawMode.Triangle:
            const pointCount = reader.readInt32();
            drawable.points = [];
            for (let i = 0; i < pointCount; i++) drawable.points.push({ x: reader.readFloat32(), y: reader.readFloat32() });
            drawable.stroke = color;
            drawable.fill = isFilled ? color : 'transparent';
            if (mode === DrawMode.Dash) {
                drawable.dashLength = reader.readFloat32();
                drawable.gapLength = reader.readFloat32();
            }
            break;
        default:
            if (mode >= DrawMode.Image && mode <= DrawMode.Dot8Image) {
                const pluginResourcePath = reader.readString();
                drawable.pluginResourcePath = pluginResourcePath;

                // NEW: Look up the local tool details using the C# path
                const toolName = pluginResourcePathToToolName[pluginResourcePath];
                const toolDetails = allModeDetails[toolName];
                drawable.imageResourcePath = toolDetails ? toolDetails.icon : ''; // Set local renderable URL

                drawable.left = reader.readFloat32();
                drawable.top = reader.readFloat32();
                drawable.width = reader.readFloat32();
                drawable.height = reader.readFloat32();
                drawable.angle = reader.readFloat32() * (180 / Math.PI); // Convert radians to degrees
                drawable.tint = color; 
                drawable.stroke = color;
                drawable.fill = isFilled ? color : 'transparent';
            } else {
                console.warn("Deserialization for mode not implemented:", mode);
                return null;
            }
            break;
    }
    return drawable;
}


function serializePageToBytes(drawables) {
    const writer = new BufferHandler();
    writer.writeInt32(SERIALIZATION_VERSION);
    writer.writeInt32(drawables.length);
    drawables.forEach(drawable => serializeSingleDrawable(writer, drawable));
    return writer.getBuffer();
}

// MODIFIED: Function now accepts and passes down the reverse maps
function deserializePageFromBytes(data, pluginResourcePathToToolName, allModeDetails) {
    if (!data) return [];
    const reader = new BufferHandler(data);
    const version = reader.readInt32();
    if (version !== SERIALIZATION_VERSION) {
        console.error("Serialization version mismatch!");
        return [];
    }
    const count = reader.readInt32();
    const drawables = [];
    for (let i = 0; i < count; i++) {
        const drawable = deserializeSingleDrawable(reader, pluginResourcePathToToolName, allModeDetails);
        if (drawable) drawables.push(drawable);
    }
    return drawables;
}

function serializePayload(payload) {
    const writer = new BufferHandler();
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

function deserializePayload(data) {
    const reader = new BufferHandler(data);
    const pageIndex = reader.readInt32();
    const action = reader.readUint8();
    const dataLength = reader.readInt32();
    const payloadData = dataLength > 0 ? reader.readBytes(dataLength).buffer : null;
    return { pageIndex, action, data: payloadData };
}