const _layoutCanvasContext = document.createElement('canvas').getContext('2d');
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
        // Set font properties on the context to match Konva's rendering
        // NOTE: You may need to adjust "sans-serif" if you use a different default font
        _layoutCanvasContext.font = `${this.#fontSize}px Arial`;

        const lines = this.#rawText.split('\n');
        const laidOutLines = [];
        let maxWidth = 0;
        // Handle word wrapping if a wrappingWidth is set
        if (this.#wrappingWidth > 0) {
            lines.forEach(line => {
                const words = line.split(' ');
                let currentLine = '';
                if (words.length > 0) {
                    currentLine = words[0];
                    for (let i = 1; i < words.length; i++) {
                        const testLine = `${currentLine} ${words[i]}`;
                        if (_layoutCanvasContext.measureText(testLine).width > this.#wrappingWidth) {
                            laidOutLines.push(currentLine);
                            currentLine = words[i];
                        } else {
                            currentLine = testLine;
                        }
                    }
                }
                laidOutLines.push(currentLine);
            });
        } else {
            laidOutLines.push(...lines);
        }
        // Calculate the max width from the resulting lines
        laidOutLines.forEach(line => {
            maxWidth = Math.max(maxWidth, _layoutCanvasContext.measureText(line).width);
        });
        // Approximate line height. Konva's default is around 1.2x font size.
        const lineHeight = this.#fontSize * 1.2;
        const totalHeight = laidOutLines.length > 0 ? laidOutLines.length * lineHeight : this.#fontSize;

        this.boundingBoxSize = {
            x: maxWidth,
            y: totalHeight,
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