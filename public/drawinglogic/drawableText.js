class DrawableText extends BaseDrawable {
    #rawText = "";
    #fontSize = 16;
    #wrappingWidth = 0;
    #konvaShapeForLayout = new Konva.Text({ text: '' });

    constructor(position, rawText, color, fontSize, wrappingWidth = 0) {
        super();
        this.objectDrawMode = DrawMode.TextTool;
        this.position = position;
        this.color = color;
        this.thickness = 1;
        this.isFilled = true;
        this.isPreview = false;
        this.boundingBoxSize = { x: 0, y: 0 };
        this.#fontSize = Math.max(1, fontSize);
        this.#wrappingWidth = wrappingWidth;
        this.text = rawText;
    }

    get text() { return this.#rawText; }
    set text(value) {
        const sanitizedValue = InputSanitizer.sanitize(value || "");
        if (this.#rawText !== sanitizedValue) {
            this.#rawText = sanitizedValue;
            this.performLayout();
        }
    }

    get fontSize() { return this.#fontSize; }
    set fontSize(value) {
        const newSize = Math.max(1, value);
        if (Math.abs(this.#fontSize - newSize) > 0.001) {
            this.#fontSize = newSize;
            this.performLayout();
        }
    }

    get wrappingWidth() { return this.#wrappingWidth; }
    set wrappingWidth(value) {
        if (Math.abs(this.#wrappingWidth - value) > 0.001) {
            this.#wrappingWidth = value;
            this.performLayout();
        }
    }

    performLayout() {
        if (!this.#rawText) {
            this.boundingBoxSize = { x: 0, y: 0 };
            return;
        }
        this.#konvaShapeForLayout.setAttrs({
            text: this.#rawText,
            fontSize: this.#fontSize,
            width: this.#wrappingWidth > 0 ? this.#wrappingWidth : 'auto',
        });
        this.boundingBoxSize = {
            x: this.#konvaShapeForLayout.width(),
            y: this.#konvaShapeForLayout.height(),
        };
    }

    getBoundingBox() {
        return {
            x: this.position.x,
            y: this.position.y,
            width: this.boundingBoxSize.x,
            height: this.boundingBoxSize.y,
        };
    }

    isHit(queryPoint, threshold = 5.0) {
        if (!this.#rawText) return false;
        return (queryPoint.x >= this.position.x - threshold) &&
               (queryPoint.x <= this.position.x + this.boundingBoxSize.x + threshold) &&
               (queryPoint.y >= this.position.y - threshold) &&
               (queryPoint.y <= this.position.y + this.boundingBoxSize.y + threshold);
    }

    clone() {
        const newText = new DrawableText(this.position, this.text, this.color, this.fontSize, this.wrappingWidth);
        super.copyBasePropertiesTo(newText);
        return newText;
    }

    translate(delta) {
        this.position.x += delta.x;
        this.position.y += delta.y;
    }
}