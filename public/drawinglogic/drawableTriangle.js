class DrawableTriangle extends BaseDrawable {
    constructor(startPointOrVertices, color, thickness, isFilled) {
        super();
        this.objectDrawMode = DrawMode.Triangle;
        this.color = color;
        this.thickness = thickness;
        this.isFilled = isFilled;

        if (Array.isArray(startPointOrVertices)) {
            this.vertices = startPointOrVertices;
        } else {
            this.vertices = [startPointOrVertices, startPointOrVertices, startPointOrVertices];
        }
    }

    updatePreview(newPoint) {
        this.vertices[1] = { x: newPoint.x, y: this.vertices[0].y };
        this.vertices[2] = newPoint;
    }

    getBoundingBox() {
        if (!this.vertices || this.vertices.length < 3) return { x: 0, y: 0, width: 0, height: 0 };
        const minX = Math.min(this.vertices[0].x, this.vertices[1].x, this.vertices[2].x);
        const minY = Math.min(this.vertices[0].y, this.vertices[1].y, this.vertices[2].y);
        const maxX = Math.max(this.vertices[0].x, this.vertices[1].x, this.vertices[2].x);
        const maxY = Math.max(this.vertices[0].y, this.vertices[1].y, this.vertices[2].y);
        return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
    }

    isHit(queryPoint, threshold = 5.0) {
        if (!this.vertices || this.vertices.length < 3) return false;
        return HitDetection.intersectCircleTriangle(queryPoint, this.vertices[0], this.vertices[1], this.vertices[2]);
    }

    clone() {
        const newTriangle = new DrawableTriangle(
            this.vertices.map(v => ({ ...v })),
            this.color,
            this.thickness,
            this.isFilled
        );
        super.copyBasePropertiesTo(newTriangle);
        return newTriangle;
    }

    translate(delta) {
        if (!delta) return;
        for (let i = 0; i < this.vertices.length; i++) {
            this.vertices[i].x += delta.x;
            this.vertices[i].y += delta.y;
        }
    }
}