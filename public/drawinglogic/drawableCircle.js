class DrawableCircle extends BaseDrawable {
    constructor(center, color, thickness, isFilled) {
        super();
        this.objectDrawMode = DrawMode.Circle;
        this.center = center;
        this.radius = 0;
        this.color = color;
        this.thickness = thickness;
        this.isFilled = isFilled;
        this.isPreview = true;
    }

    updatePreview(newPoint) {
            const dx = newPoint.x - this.center.x;
            const dy = newPoint.y - this.center.y;
            this.radius = Math.sqrt(dx * dx + dy * dy);
    }

    getBoundingBox() {
        return {
            x: this.center.x - this.radius,
            y: this.center.y - this.radius,
            width: this.radius * 2,
            height: this.radius * 2,
        };
    }

    isHit(queryPoint, threshold = 5.0) {
        const dist = Math.sqrt((queryPoint.x - this.center.x) ** 2 + (queryPoint.y - this.center.y) ** 2);
        if (this.isFilled) {
            return dist <= this.radius + threshold;
        } else {
            const effectiveHitRange = threshold + (this.thickness / 2);
            return Math.abs(dist - this.radius) <= effectiveHitRange;
        }
    }

    clone() {
        const newCircle = new DrawableCircle(this.center, this.color, this.thickness, this.isFilled);
        newCircle.radius = this.radius;
        super.copyBasePropertiesTo(newCircle);
        return newCircle;
    }

    translate(delta) {
        this.center.x += delta.x;
        this.center.y += delta.y;
    }
}