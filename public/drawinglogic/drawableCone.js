class DrawableCone extends BaseDrawable {
    constructor(apexPoint, color, thickness, isFilled) {
        super();
        this.objectDrawMode = DrawMode.Cone;
        this.apex = apexPoint;
        this.baseCenter = apexPoint; // Initially a point, expands during preview
        this.color = color;
        this.thickness = thickness;
        this.isFilled = isFilled;
        this.isPreview = true;
        this.rotation = 0; // Stored in degrees
    }

    // A factor that determines the cone's base width relative to its height.
    static coneWidthFactor = 0.3;

    updatePreview(newPoint) {
        this.baseCenter = newPoint;
    }

    /**
     * Calculates the three world-space vertices of the cone triangle.
     * @returns {Array<object>} An array containing the three vertex points {x, y}.
     */
    getVertices() {
        // Calculate the vector from the apex to the base center
        const vec = { x: this.baseCenter.x - this.apex.x, y: this.baseCenter.y - this.apex.y };
        const height = Math.sqrt(vec.x * vec.x + vec.y * vec.y);

        // If height is negligible, the cone is just a point at the apex.
        if (height < 0.1) {
            return [this.apex, this.apex, this.apex];
        }

        const baseHalfWidth = height * DrawableCone.coneWidthFactor;

        // Get the direction and a perpendicular vector
        const dir = { x: vec.x / height, y: vec.y / height };
        const perp = { x: dir.y, y: -dir.x };

        // Calculate the two base vertices of the unrotated cone
        const b1 = { x: this.baseCenter.x + perp.x * baseHalfWidth, y: this.baseCenter.y + perp.y * baseHalfWidth };
        const b2 = { x: this.baseCenter.x - perp.x * baseHalfWidth, y: this.baseCenter.y - perp.y * baseHalfWidth };

        // If there's no rotation, we're done
        if (this.rotation === 0) {
            return [this.apex, b1, b2];
        }

        // Apply rotation around the apex
        const angleRad = this.rotation * (Math.PI / 180);
        const cosA = Math.cos(angleRad);
        const sinA = Math.sin(angleRad);

        // Translate base points to be relative to the apex for rotation
        const b1Local = { x: b1.x - this.apex.x, y: b1.y - this.apex.y };
        const b2Local = { x: b2.x - this.apex.x, y: b2.y - this.apex.y };

        // Rotate
        const b1Rotated = HitDetection.imRotate(b1Local, cosA, sinA);
        const b2Rotated = HitDetection.imRotate(b2Local, cosA, sinA);

        // Translate back to world space
        const finalB1 = { x: b1Rotated.x + this.apex.x, y: b1Rotated.y + this.apex.y };
        const finalB2 = { x: b2Rotated.x + this.apex.x, y: b2Rotated.y + this.apex.y };

        return [this.apex, finalB1, finalB2];
    }

    getBoundingBox() {
        const vertices = this.getVertices();
        const minX = Math.min(vertices[0].x, vertices[1].x, vertices[2].x);
        const minY = Math.min(vertices[0].y, vertices[1].y, vertices[2].y);
        const maxX = Math.max(vertices[0].x, vertices[1].x, vertices[2].x);
        const maxY = Math.max(vertices[0].y, vertices[1].y, vertices[2].y);
        return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
    }

    isHit(queryPoint, threshold = 5.0) {
        const vertices = this.getVertices();
        if (this.isFilled) {
            // For filled cones, check if the point is inside the triangle
            return HitDetection.intersectCircleTriangle(queryPoint, vertices[0], vertices[1], vertices[2]);
        } else {
            // For outlined cones, check distance to each line segment
            const effectiveDist = threshold + this.thickness / 2;
            if (HitDetection.distancePointToLineSegment(queryPoint, vertices[0], vertices[1]) <= effectiveDist) return true;
            if (HitDetection.distancePointToLineSegment(queryPoint, vertices[0], vertices[2]) <= effectiveDist) return true;
            if (HitDetection.distancePointToLineSegment(queryPoint, vertices[1], vertices[2]) <= effectiveDist) return true;
            return false;
        }
    }

    clone() {
        const newCone = new DrawableCone(this.apex, this.color, this.thickness, this.isFilled);
        newCone.baseCenter = { ...this.baseCenter };
        newCone.rotation = this.rotation;
        super.copyBasePropertiesTo(newCone);
        return newCone;
    }

    translate(delta) {
        if (!delta) return;
        this.apex.x += delta.x;
        this.apex.y += delta.y;
        this.baseCenter.x += delta.x;
        this.baseCenter.y += delta.y;
    }
}