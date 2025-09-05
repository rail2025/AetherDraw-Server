class DrawableRectangle extends BaseDrawable {
    constructor(startPoint, color, thickness, isFilled) {
        super();
        this.objectDrawMode = DrawMode.Rectangle;
        this.startPoint = startPoint;
        this.endPoint = startPoint;
        this.color = color;
        this.thickness = thickness;
        this.isFilled = isFilled;
        this.isPreview = true;
        this.rotation = 0; // Stored in degrees
    }

    updatePreview(newPoint) {
        this.endPoint = newPoint;
    }

    getGeometry() {
        const min = { x: Math.min(this.startPoint.x, this.endPoint.x), y: Math.min(this.startPoint.y, this.endPoint.y) };
        const max = { x: Math.max(this.startPoint.x, this.endPoint.x), y: Math.max(this.startPoint.y, this.endPoint.y) };
        const center = { x: (min.x + max.x) / 2, y: (min.y + max.y) / 2 };
        const halfSize = { x: (max.x - min.x) / 2, y: (max.y - min.y) / 2 };
        return { center, halfSize };
    }

    getRotatedCorners() {
        const { center, halfSize } = this.getGeometry();
        const angleRad = this.rotation * (Math.PI / 180);
        return HitDetection.getRotatedQuadVertices(center, halfSize, angleRad);
    }

    getBoundingBox() {
        const corners = this.getRotatedCorners();
        const minX = Math.min(...corners.map(c => c.x));
        const minY = Math.min(...corners.map(c => c.y));
        const maxX = Math.max(...corners.map(c => c.x));
        const maxY = Math.max(...corners.map(c => c.y));
        return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
    }

    isHit(queryPoint, threshold = 5.0) {
        const { center, halfSize } = this.getGeometry();
        const angleRad = -this.rotation * (Math.PI / 180);
        const cosA = Math.cos(angleRad);
        const sinA = Math.sin(angleRad);
        const localQueryPoint = HitDetection.imRotate({ x: queryPoint.x - center.x, y: queryPoint.y - center.y }, cosA, sinA);

        if (this.isFilled) {
            return Math.abs(localQueryPoint.x) <= halfSize.x + threshold &&
                   Math.abs(localQueryPoint.y) <= halfSize.y + threshold;
        } else {
            const effectiveEdgeDist = threshold + this.thickness / 2;
            const withinOuter = Math.abs(localQueryPoint.x) <= halfSize.x + effectiveEdgeDist &&
                                Math.abs(localQueryPoint.y) <= halfSize.y + effectiveEdgeDist;
            const outsideInner = Math.abs(localQueryPoint.x) >= halfSize.x - effectiveEdgeDist ||
                                 Math.abs(localQueryPoint.y) >= halfSize.y - effectiveEdgeDist;
            return withinOuter && outsideInner;
        }
    }

    clone() {
        const newRect = new DrawableRectangle(this.startPoint, this.color, this.thickness, this.isFilled);
        newRect.endPoint = { ...this.endPoint };
        newRect.rotation = this.rotation;
        super.copyBasePropertiesTo(newRect);
        return newRect;
    }

    translate(delta) {
        this.startPoint.x += delta.x;
        this.startPoint.y += delta.y;
        this.endPoint.x += delta.x;
        this.endPoint.y += delta.y;
    }
}