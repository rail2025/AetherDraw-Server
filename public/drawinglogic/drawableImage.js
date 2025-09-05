class DrawableImage extends BaseDrawable {
    constructor(drawMode, pluginResourcePath, position, drawSize, tint, rotation = 0) {
        super();
        this.objectDrawMode = drawMode;
        
        this.pluginResourcePath = pluginResourcePath;
        this.imageResourcePath = UIManager.getWebPathFromPluginPath(pluginResourcePath);

        this.position = position;
        this.width = drawSize.width;
        this.height = drawSize.height;
        this.color = tint;
        this.rotation = rotation;
        this.isFilled = true;
    }

    getRotatedCorners() {
        const halfSize = { x: this.width / 2, y: this.height / 2 };
        const angleRad = this.rotation * (Math.PI / 180);
        return HitDetection.getRotatedQuadVertices(this.position, halfSize, angleRad);
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
        const angleRad = -this.rotation * (Math.PI / 180);
        const cosA = Math.cos(angleRad);
        const sinA = Math.sin(angleRad);
        const localQueryPoint = HitDetection.imRotate({ x: queryPoint.x - this.position.x, y: queryPoint.y - this.position.y }, cosA, sinA);

        const halfSize = { x: this.width / 2, y: this.height / 2 };
        return Math.abs(localQueryPoint.x) <= halfSize.x + threshold &&
               Math.abs(localQueryPoint.y) <= halfSize.y + threshold;
    }

    clone() {
        const drawSize = { width: this.width, height: this.height };
        const newImg = new DrawableImage(this.objectDrawMode, this.pluginResourcePath, this.position, drawSize, this.color, this.rotation);
        super.copyBasePropertiesTo(newImg);
        return newImg;
    }

    translate(delta) {
        this.position.x += delta.x;
        this.position.y += delta.y;
    }
}