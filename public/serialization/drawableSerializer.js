class BufferHandler {
    constructor(buffer) {
        this.buffer = buffer || new ArrayBuffer(1024);
        this.dataView = new DataView(this.buffer);
        this.offset = 0;
    }

    _ensureCapacity(needed) {
        if (this.offset + needed > this.buffer.byteLength) {
            const newSize = Math.max(this.buffer.byteLength * 2, this.offset + needed);
            const newBuffer = new ArrayBuffer(newSize);
            new Uint8Array(newBuffer).set(new Uint8Array(this.buffer));
            this.buffer = newBuffer;
            this.dataView = new DataView(this.buffer);
        }
    }

    writeUint8(val) { this._ensureCapacity(1); this.dataView.setUint8(this.offset, val); this.offset += 1; }
    writeInt32(val) { this._ensureCapacity(4); this.dataView.setInt32(this.offset, val, true); this.offset += 4; }
    writeFloat32(val) { this._ensureCapacity(4); this.dataView.setFloat32(this.offset, val, true); this.offset += 4; }
    writeBoolean(val) { this.writeUint8(val ? 1 : 0); }
    writeBytes(bytes) { this._ensureCapacity(bytes.length); new Uint8Array(this.buffer, this.offset).set(bytes); this.offset += bytes.length; }

    write7BitEncodedInt(value) {
        let num = value;
        while (num >= 0x80) {
            this.writeUint8((num | 0x80));
            num >>>= 7;
        }
        this.writeUint8(num);
    }
    
    writeString(str) {
        const buffer = new TextEncoder().encode(str);
        this.write7BitEncodedInt(buffer.length);
        this.writeBytes(buffer);
    }

    writeGuid(guid) {
        const hex = guid.replace(/-/g, '');
        const bytes = new Uint8Array(16);
        for (let i = 0; i < 16; i++) {
            bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
        }
        
        const finalBytes = new Uint8Array([
            bytes[3], bytes[2], bytes[1], bytes[0],
            bytes[5], bytes[4],
            bytes[7], bytes[6],
            bytes[8], bytes[9], bytes[10], bytes[11], bytes[12], bytes[13], bytes[14], bytes[15]
        ]);
        this.writeBytes(finalBytes);
    }
    
    readUint8() { const v = this.dataView.getUint8(this.offset); this.offset += 1; return v; }
    readInt32() { const v = this.dataView.getInt32(this.offset, true); this.offset += 4; return v; }
    readFloat32() { const v = this.dataView.getFloat32(this.offset, true); this.offset += 4; return v; }
    readBoolean() { return this.readUint8() === 1; }
    readBytes(len) { const b = this.buffer.slice(this.offset, this.offset + len); this.offset += len; return new Uint8Array(b); }
    
    read7BitEncodedInt() {
        let result = 0;
        let shift = 0;
        let byte;
        do {
            if (this.offset >= this.buffer.byteLength) {
                throw new Error("Buffer overrun while reading 7-bit encoded int.");
            }
            byte = this.readUint8();
            result |= (byte & 0x7F) << shift;
            shift += 7;
        } while ((byte & 0x80) !== 0);
        return result;
    }

    readString() {
        const len = this.read7BitEncodedInt();
        const buffer = this.readBytes(len);
        return new TextDecoder().decode(buffer);
    }

    readGuid() {
        const b = this.readBytes(16);
        const bytes = [
            b[3], b[2], b[1], b[0], 
            b[5], b[4], 
            b[7], b[6],
            b[8], b[9], b[10], b[11], 
            b[12], b[13], b[14], b[15]
        ];
        const s = (arr) => arr.map(x => x.toString(16).padStart(2, '0')).join('');
        return `${s(bytes.slice(0,4))}-${s(bytes.slice(4,6))}-${s(bytes.slice(6,8))}-${s(bytes.slice(8,10))}-${s(bytes.slice(10,16))}`;
    }

    getBuffer() { return this.buffer.slice(0, this.offset); }
}

const DrawableSerializer = (function () {
    const SERIALIZATION_VERSION = 1;
    const MAX_DRAWABLES_PER_PAGE = 10000;
    const MAX_POINTS_PER_OBJECT = 50000;

    function _serializeSingleDrawable(writer, drawable) {
        writer.writeUint8(drawable.objectDrawMode);

        writer.writeFloat32(drawable.color.r);
        writer.writeFloat32(drawable.color.g);
        writer.writeFloat32(drawable.color.b);
        writer.writeFloat32(drawable.color.a);
        writer.writeFloat32(drawable.thickness);
        writer.writeBoolean(drawable.isFilled);
        writer.writeGuid(drawable.uniqueId);

        switch (drawable.objectDrawMode) {
            case DrawMode.Pen: {
                writer.writeInt32(drawable.points.length);
                drawable.points.forEach(p => { writer.writeFloat32(p.x); writer.writeFloat32(p.y); });
                break;
            }
            case DrawMode.StraightLine: {
                writer.writeFloat32(drawable.startPoint.x); writer.writeFloat32(drawable.startPoint.y);
                writer.writeFloat32(drawable.endPoint.x); writer.writeFloat32(drawable.endPoint.y);
                break;
            }
            case DrawMode.Rectangle: {
                writer.writeFloat32(drawable.startPoint.x); writer.writeFloat32(drawable.startPoint.y);
                writer.writeFloat32(drawable.endPoint.x); writer.writeFloat32(drawable.endPoint.y);
                writer.writeFloat32(drawable.rotation * (Math.PI / 180));
                break;
            }
            case DrawMode.Arrow: {
                writer.writeFloat32(drawable.startPoint.x); writer.writeFloat32(drawable.startPoint.y);
                writer.writeFloat32(drawable.endPoint.x); writer.writeFloat32(drawable.endPoint.y);
                writer.writeFloat32(drawable.rotation * (Math.PI / 180));
                writer.writeFloat32(drawable.arrowheadLengthOffset);
                writer.writeFloat32(drawable.arrowheadWidthScale);
                break;
            }
            case DrawMode.Circle:
            case DrawMode.Donut: {
                writer.writeFloat32(drawable.center.x); writer.writeFloat32(drawable.center.y);
                writer.writeFloat32(drawable.radius);
                break;
            }
            case DrawMode.Cone: {
                writer.writeFloat32(drawable.apex.x); writer.writeFloat32(drawable.apex.y);
                writer.writeFloat32(drawable.baseCenter.x); writer.writeFloat32(drawable.baseCenter.y);
                writer.writeFloat32(drawable.rotation * (Math.PI / 180));
                break;
            }
            case DrawMode.Dash: {
                writer.writeInt32(drawable.points.length);
                drawable.points.forEach(p => { writer.writeFloat32(p.x); writer.writeFloat32(p.y); });
                writer.writeFloat32(drawable.dashLength);
                writer.writeFloat32(drawable.gapLength);
                break;
            }
            case DrawMode.Triangle: {
                drawable.vertices.forEach(v => { writer.writeFloat32(v.x); writer.writeFloat32(v.y); });
                break;
            }
            case DrawMode.TextTool: {
                writer.writeString(drawable.text);
                writer.writeFloat32(drawable.position.x); writer.writeFloat32(drawable.position.y);
                writer.writeFloat32(drawable.fontSize);
                writer.writeFloat32(drawable.wrappingWidth);
                break;
            }
            default: {
                 if (drawable.objectDrawMode >= DrawMode.Image && drawable.objectDrawMode <= DrawMode.Dot8Image) {
                    writer.writeString(drawable.pluginResourcePath || "");
                    writer.writeFloat32(drawable.position.x); writer.writeFloat32(drawable.position.y);
                    writer.writeFloat32(drawable.width); writer.writeFloat32(drawable.height);
                    writer.writeFloat32(drawable.rotation * (Math.PI / 180));
                }
                break;
            }
        }
    }

    function _deserializeSingleDrawable(reader) {
        const mode = reader.readUint8();
        const color = { r: reader.readFloat32(), g: reader.readFloat32(), b: reader.readFloat32(), a: reader.readFloat32() };
        const thickness = reader.readFloat32();
        const isFilled = reader.readBoolean();
        const uniqueId = reader.readGuid();
        let drawable = null;

        switch (mode) {
            case DrawMode.Pen: {
                const pointCount = reader.readInt32();
                if (pointCount < 0 || pointCount > MAX_POINTS_PER_OBJECT) return null;
                const points = Array.from({ length: pointCount }, () => ({ x: reader.readFloat32(), y: reader.readFloat32() }));
                drawable = new DrawablePath(points[0], color, thickness);
                drawable.points = points;
                break;
            }
            case DrawMode.StraightLine: {
                const startPoint = { x: reader.readFloat32(), y: reader.readFloat32() };
                const endPoint = { x: reader.readFloat32(), y: reader.readFloat32() };
                drawable = new DrawableStraightLine(startPoint, color, thickness);
                drawable.endPoint = endPoint;
                break;
            }
            case DrawMode.Rectangle: {
                const startPoint = { x: reader.readFloat32(), y: reader.readFloat32() };
                const endPoint = { x: reader.readFloat32(), y: reader.readFloat32() };
                const rotationRad = reader.readFloat32();
                drawable = new DrawableRectangle(startPoint, color, thickness, isFilled);
                drawable.endPoint = endPoint;
                drawable.rotation = rotationRad * (180 / Math.PI);
                break;
            }
            case DrawMode.Arrow: {
                const startPoint = { x: reader.readFloat32(), y: reader.readFloat32() };
                const endPoint = { x: reader.readFloat32(), y: reader.readFloat32() };
                const rotationRad = reader.readFloat32();
                const arrowheadLengthOffset = reader.readFloat32();
                const arrowheadWidthScale = reader.readFloat32();
                drawable = new DrawableArrow(startPoint, color, thickness);
                drawable.endPoint = endPoint;
                drawable.rotation = rotationRad * (180 / Math.PI);
                drawable.arrowheadLengthOffset = arrowheadLengthOffset;
                drawable.arrowheadWidthScale = arrowheadWidthScale;
                break;
            }
            case DrawMode.Circle:
            case DrawMode.Donut: {
                const center = { x: reader.readFloat32(), y: reader.readFloat32() };
                const radius = reader.readFloat32();
                drawable = new DrawableCircle(center, color, thickness, isFilled);
                drawable.radius = radius;
                drawable.objectDrawMode = mode;
                break;
            }
            case DrawMode.Cone: {
                const apex = { x: reader.readFloat32(), y: reader.readFloat32() };
                const baseCenter = { x: reader.readFloat32(), y: reader.readFloat32() };
                const rotationRad = reader.readFloat32();
                drawable = new DrawableCone(apex, color, thickness, isFilled);
                drawable.baseCenter = baseCenter;
                drawable.rotation = rotationRad * (180 / Math.PI);
                break;
            }
            case DrawMode.Dash: {
                const pointCount = reader.readInt32();
                if (pointCount < 0 || pointCount > MAX_POINTS_PER_OBJECT) return null;
                const points = Array.from({ length: pointCount }, () => ({ x: reader.readFloat32(), y: reader.readFloat32() }));
                const dashLength = reader.readFloat32();
                const gapLength = reader.readFloat32();
                drawable = new DrawableDash(points[0], color, thickness);
                drawable.points = points;
                drawable.dashLength = dashLength;
                drawable.gapLength = gapLength;
                break;
            }
            case DrawMode.Triangle: {
                 const v1 = { x: reader.readFloat32(), y: reader.readFloat32() };
                 const v2 = { x: reader.readFloat32(), y: reader.readFloat32() };
                 const v3 = { x: reader.readFloat32(), y: reader.readFloat32() };
                 drawable = new DrawableTriangle(v1, color);
                 drawable.vertices = [v1, v2, v3];
                 break;
            }
            case DrawMode.TextTool: {
                const text = reader.readString();
                const position = { x: reader.readFloat32(), y: reader.readFloat32() };
                const fontSize = reader.readFloat32();
                const wrappingWidth = reader.readFloat32();
                drawable = new DrawableText(position, text, color, fontSize, wrappingWidth);
                break;
            }
            default: {
                 if (mode >= DrawMode.Image && mode <= DrawMode.Dot8Image) {
                    const pluginResourcePath = reader.readString();
                    const position = { x: reader.readFloat32(), y: reader.readFloat32() };
                    const drawSize = { width: reader.readFloat32(), height: reader.readFloat32() };
                    const rotationRad = reader.readFloat32();
                    drawable = new DrawableImage(mode, pluginResourcePath, position, drawSize, color, rotationRad * (180 / Math.PI));
                }
                break;
            }
        }

        if (drawable) {
            drawable.uniqueId = uniqueId;
            drawable.color = color;
            drawable.thickness = thickness;
            drawable.isFilled = isFilled;
            drawable.isPreview = false;
        }
        return drawable;
    }

    return Object.freeze({
        serializePageToBytes: function (drawables) {
            if (!drawables) throw new Error("drawables cannot be null.");
            const writer = new BufferHandler();
            writer.writeInt32(SERIALIZATION_VERSION);
            writer.writeInt32(drawables.length);
            drawables.forEach(drawable => _serializeSingleDrawable(writer, drawable));
            return writer.getBuffer();
        },

        deserializePageFromBytes: function (data) {
            if (!data || data.byteLength === 0) return [];
            const reader = new BufferHandler(data);
            const version = reader.readInt32();
            if (version !== SERIALIZATION_VERSION) {
                console.error(`Deserialization version mismatch. Expected ${SERIALIZATION_VERSION}, got ${version}.`);
                return [];
            }

            const drawableCount = reader.readInt32();
            if (drawableCount < 0 || drawableCount > MAX_DRAWABLES_PER_PAGE) {
                console.error(`Invalid drawable count in data: ${drawableCount}.`);
                return [];
            }

            const deserialized = [];
            for (let i = 0; i < drawableCount; i++) {
                const drawable = _deserializeSingleDrawable(reader);
                if (drawable) deserialized.push(drawable);
            }
            return deserialized;
        }
    });
})();