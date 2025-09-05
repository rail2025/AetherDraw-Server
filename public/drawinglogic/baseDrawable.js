class BaseDrawable {
    constructor() {
        if (this.constructor === BaseDrawable) {
            throw new Error("Abstract class 'BaseDrawable' cannot be instantiated directly.");
        }

        this.uniqueId = crypto.randomUUID();
        this.objectDrawMode = null;
        this.color = { r: 1, g: 1, b: 1, a: 1 };
        this.thickness = 1;
        this.isFilled = false;
        this.isPreview = false;
        this.isSelected = false;
        this.isHovered = false;
    }

    getBoundingBox() {
        throw new Error("Method 'getBoundingBox()' must be implemented by subclasses.");
    }

    isHit(queryPoint, hitThreshold = 5.0) {
        throw new Error("Method 'isHit()' must be implemented by subclasses.");
    }

    clone() {
        throw new Error("Method 'clone()' must be implemented by subclasses.");
    }

    translate(delta) {
        throw new Error("Method 'translate()' must be implemented by subclasses.");
    }

    updatePreview(currentPoint) {
    }

    copyBasePropertiesTo(target) {
        
        target.objectDrawMode = this.objectDrawMode;
        target.color = { ...this.color };
        target.thickness = this.thickness;
        target.isFilled = this.isFilled;
        target.isPreview = false;
        target.isSelected = false;
        target.isHovered = false;
    }
}