class DrawableStraightLine extends BaseDrawable {
    constructor(startPoint, color, thickness) {
        super();
        this.objectDrawMode = DrawMode.StraightLine;
        this.startPoint = startPoint;
        this.endPoint = startPoint;
        this.color = color;
        this.thickness = thickness;
        this.isFilled = false;
        this.isPreview = true;
    }

    updatePreview(newPoint) {
        this.endPoint = newPoint;
    }

    getBoundingBox() {
        const minX = Math.min(this.startPoint.x, this.endPoint.x);
        const minY = Math.min(this.startPoint.y, this.endPoint.y);
        const maxX = Math.max(this.startPoint.x, this.endPoint.x);
        const maxY = Math.max(this.startPoint.y, this.endPoint.y);
        return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
    }

    isHit(queryPoint, threshold = 5.0) {
        const effectiveHitRange = threshold + (this.thickness / 2);
        return HitDetection.distancePointToLineSegment(queryPoint, this.startPoint, this.endPoint) <= effectiveHitRange;
    }

    clone() {
        const newLine = new DrawableStraightLine(this.startPoint, this.color, this.thickness);
        newLine.endPoint = { ...this.endPoint };
        super.copyBasePropertiesTo(newLine);
        return newLine;
    }

    translate(delta) {
        this.startPoint.x += delta.x;
        this.startPoint.y += delta.y;
        this.endPoint.x += delta.x;
        this.endPoint.y += delta.y;
    }
}