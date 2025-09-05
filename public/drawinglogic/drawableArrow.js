class DrawableArrow extends BaseDrawable {
    constructor(startPoint, color, thickness, isFilled = true) {
        super();
        this.objectDrawMode = DrawMode.Arrow;
        this.startPoint = startPoint;
        this.endPoint = startPoint;
        this.color = color;
        this.thickness = Math.max(1, thickness);
        this.isFilled = isFilled;
        this.isPreview = true;
        this.rotation = 0;

        const defaultLengthFactor = 5.0;
        const defaultWidthFactor = 3.0;
        const minAbsoluteDim = 5.0;

        this.arrowheadLengthOffset = Math.max(minAbsoluteDim, this.thickness * defaultLengthFactor);
        this.arrowheadWidthScale = defaultWidthFactor;
    }

    updatePreview(newPoint) {
        this.endPoint = newPoint;
    }

    clone() {
        const newArrow = new DrawableArrow(this.startPoint, this.color, this.thickness, this.isFilled);
        newArrow.endPoint = this.endPoint;
        newArrow.rotation = this.rotation;
        newArrow.arrowheadLengthOffset = this.arrowheadLengthOffset;
        newArrow.arrowheadWidthScale = this.arrowheadWidthScale;
        super.copyBasePropertiesTo(newArrow);
        return newArrow;
    }

    translate(delta) {
        this.startPoint.x += delta.x;
        this.startPoint.y += delta.y;
        this.endPoint.x += delta.x;
        this.endPoint.y += delta.y;
    }

    setStartPoint(newStart) {
         const diff = { x: newStart.x - this.startPoint.x, y: newStart.y - this.startPoint.y };
         this.startPoint = newStart;
         this.endPoint.x += diff.x;
         this.endPoint.y += diff.y;
    }
 
     setEndPoint(newEnd) {
         this.endPoint = newEnd;
    }

    getArrowheadGeometricPoints(shaftEnd, shaftDir) {
        const minAbsoluteDim = 5.0;
        const actualArrowheadLength = Math.max(minAbsoluteDim, this.arrowheadLengthOffset);
        const actualArrowheadHalfWidth = Math.max(minAbsoluteDim / 2.0, (this.thickness * this.arrowheadWidthScale) / 2.0);

        const visualTipPoint = {
            x: shaftEnd.x + shaftDir.x * actualArrowheadLength,
            y: shaftEnd.y + shaftDir.y * actualArrowheadLength
        };

        const perpendicularOffset = { x: shaftDir.y * actualArrowheadHalfWidth, y: -shaftDir.x * actualArrowheadHalfWidth };
        const basePoint1 = { x: shaftEnd.x + perpendicularOffset.x, y: shaftEnd.y + perpendicularOffset.y };
        const basePoint2 = { x: shaftEnd.x - perpendicularOffset.x, y: shaftEnd.y - perpendicularOffset.y };

        return { visualTip: visualTipPoint, base1: basePoint1, base2: basePoint2 };
    }

    getTransformedVertices() {
        const shaftStart = this.startPoint;
        const shaftEnd = this.endPoint;
        const shaftVector = { x: shaftEnd.x - shaftStart.x, y: shaftEnd.y - shaftStart.y };

        const lengthSq = shaftVector.x * shaftVector.x + shaftVector.y * shaftVector.y;
        if (lengthSq < 0.01) {
            return [shaftStart, shaftStart, shaftStart, shaftStart, shaftStart];
        }

        const length = Math.sqrt(lengthSq);
        const shaftDir = { x: shaftVector.x / length, y: shaftVector.y / length };

        const { visualTip, base1, base2 } = this.getArrowheadGeometricPoints(shaftVector, shaftDir);

        const angleRad = this.rotation * (Math.PI / 180);
        const cosA = Math.cos(angleRad);
        const sinA = Math.sin(angleRad);

        const transform = (p) => {
            const rotatedX = p.x * cosA - p.y * sinA;
            const rotatedY = p.x * sinA + p.y * cosA;
            return { x: rotatedX + shaftStart.x, y: rotatedY + shaftStart.y };
        };
        
        return [
            transform({x: 0, y: 0}),
            transform(shaftVector),
            transform(visualTip),
            transform(base1),
            transform(base2)
        ];
    }
    
    getBoundingBox() {
        const vertices = this.getTransformedVertices();
        const minX = Math.min(...vertices.map(v => v.x));
        const minY = Math.min(...vertices.map(v => v.y));
        const maxX = Math.max(...vertices.map(v => v.x));
        const maxY = Math.max(...vertices.map(v => v.y));
        return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
    }

    isHit(queryPoint, threshold = 5.0) {
        const angleRad = -this.rotation * (Math.PI / 180);
        const cosA = Math.cos(angleRad);
        const sinA = Math.sin(angleRad);
        const localQueryPoint = {
            x: (queryPoint.x - this.startPoint.x) * cosA - (queryPoint.y - this.startPoint.y) * sinA,
            y: (queryPoint.x - this.startPoint.x) * sinA + (queryPoint.y - this.startPoint.y) * cosA
        };
        
        const localShaftStart = { x: 0, y: 0 };
        const localShaftEnd = { x: this.endPoint.x - this.startPoint.x, y: this.endPoint.y - this.startPoint.y };

        const effectiveHitRangeShaft = threshold + (this.thickness / 2.0);
        if (HitDetection.distancePointToLineSegment(localQueryPoint, localShaftStart, localShaftEnd) <= effectiveHitRangeShaft) return true;

        const lengthSq = localShaftEnd.x * localShaftEnd.x + localShaftEnd.y * localShaftEnd.y;
        const shaftDir = lengthSq > 0.001 ? { x: localShaftEnd.x / Math.sqrt(lengthSq), y: localShaftEnd.y / Math.sqrt(lengthSq) } : { x: 0, y: -1};

        const { visualTip, base1, base2 } = this.getArrowheadGeometricPoints(localShaftEnd, shaftDir);
        return HitDetection.intersectCircleTriangle(localQueryPoint, visualTip, base1, base2);
    }
}