class DrawableDash extends BaseDrawable {
    constructor(startPoint, color, thickness) {
        super();
        this.objectDrawMode = DrawMode.Dash;
        this.points = startPoint ? [startPoint] : [];
        this.color = color;
        this.thickness = thickness;
        this.isFilled = false;
        this.isPreview = true;

        this.dashLength = Math.max(5, thickness * 2.5);
        this.gapLength = Math.max(3, thickness * 1.25);
    }

    addPoint(point) {
        const lastPoint = this.points[this.points.length - 1];
        if (!lastPoint || ((point.x - lastPoint.x) ** 2 + (point.y - lastPoint.y) ** 2) > 4.0) {
            this.points.push(point);
        } else if (this.isPreview) {
            this.points[this.points.length - 1] = point;
        }
    }

    getBoundingBox() {
        if (this.points.length === 0) return { x: 0, y: 0, width: 0, height: 0 };
        const minX = Math.min(...this.points.map(p => p.x));
        const minY = Math.min(...this.points.map(p => p.y));
        const maxX = Math.max(...this.points.map(p => p.x));
        const maxY = Math.max(...this.points.map(p => p.y));
        return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
    }

    isHit(queryPoint, threshold = 5.0) {
        if (this.points.length < 2) return false;
        const effectiveHitRange = threshold + (this.thickness / 2);
        for (let i = 0; i < this.points.length - 1; i++) {
            if (HitDetection.distancePointToLineSegment(queryPoint, this.points[i], this.points[i + 1]) <= effectiveHitRange) {
                return true;
            }
        }
        return false;
    }

    clone() {
        const startPoint = this.points.length > 0 ? { ...this.points[0] } : undefined;
        const newDash = new DrawableDash(startPoint, this.color, this.thickness);
        newDash.points = this.points.map(p => ({ ...p }));
        newDash.dashLength = this.dashLength;
        newDash.gapLength = this.gapLength;
        super.copyBasePropertiesTo(newDash);
        return newDash;
    }

    translate(delta) {
        for (let i = 0; i < this.points.length; i++) {
            this.points[i].x += delta.x;
            this.points[i].y += delta.y;
        }
    }
}