/**
 * AetherDraw Web - Hit Detection Library
 * Provides static helper methods for geometric calculations and collision detection.
 * Mirrors the functionality of HitDetection.cs.
 */
const HitDetection = (function () {

    // --- Private Vector Math Helpers ---
    // A minimal set of helpers to replace System.Numerics.Vector2 operations.
    const vec = {
        subtract: (v1, v2) => ({ x: v1.x - v2.x, y: v1.y - v2.y }),
        add: (v1, v2) => ({ x: v1.x + v2.x, y: v1.y + v2.y }),
        scale: (v, s) => ({ x: v.x * s, y: v.y * s }),
        dot: (v1, v2) => v1.x * v2.x + v1.y * v2.y,
        distanceSq: (v1, v2) => {
            const dx = v1.x - v2.x;
            const dy = v1.y - v2.y;
            return dx * dx + dy * dy;
        },
        distance: (v1, v2) => Math.sqrt(vec.distanceSq(v1, v2)),
    };

    // --- Public API ---
    return {
        /**
         * Calculates the shortest distance from a point to a line segment.
         * @param {object} p - The point {x, y}.
         * @param {object} a - The start point of the line segment {x, y}.
         * @param {object} b - The end point of the line segment {x, y}.
         * @returns {number} The shortest distance.
         */
        distancePointToLineSegment: function (p, a, b) {
            const l2 = vec.distanceSq(a, b);
            if (l2 === 0.0) return vec.distance(p, a);
            const t = Math.max(0, Math.min(1, vec.dot(vec.subtract(p, a), vec.subtract(b, a)) / l2));
            const proj = vec.add(a, vec.scale(vec.subtract(b, a), t));
            return vec.distance(p, proj);
        },

        /**
         * Checks if a point is inside a triangle.
         * @param {object} pt - The point to check {x, y}.
         * @param {object} v1 - Vertex 1 of the triangle {x, y}.
         * @param {object} v2 - Vertex 2 of the triangle {x, y}.
         * @param {object} v3 - Vertex 3 of the triangle {x, y}.
         * @returns {boolean} True if the point is inside the triangle.
         */
        pointInTriangle: function (pt, v1, v2, v3) {
            const d1 = (pt.x - v2.x) * (v1.y - v2.y) - (v1.x - v2.x) * (pt.y - v2.y);
            const d2 = (pt.x - v3.x) * (v2.y - v3.y) - (v2.x - v3.x) * (pt.y - v3.y);
            const d3 = (pt.x - v1.x) * (v3.y - v1.y) - (v3.x - v1.x) * (pt.y - v1.y);
            const hasNegative = (d1 < 0) || (d2 < 0) || (d3 < 0);
            const hasPositive = (d1 > 0) || (d2 > 0) || (d3 > 0);
            return !(hasNegative && hasPositive);
        },

        /**
         * Rotates a 2D vector by a given sine and cosine of an angle.
         * @param {object} v - The vector to rotate {x, y}.
         * @param {number} cosA - The cosine of the rotation angle.
         * @param {number} sinA - The sine of the rotation angle.
         * @returns {object} The rotated vector {x, y}.
         */
        imRotate: function (v, cosA, sinA) {
            return {
                x: v.x * cosA - v.y * sinA,
                y: v.x * sinA + v.y * cosA
            };
        },

        /**
         * Calculates the world-space vertices of a rotated rectangle.
         * @param {object} center - The center of the rectangle {x, y}.
         * @param {object} halfSize - Half the width and height {x, y}.
         * @param {number} angleInRadians - The rotation angle.
         * @returns {Array<object>} An array of 4 vertex points {x, y}.
         */
        getRotatedQuadVertices: function (center, halfSize, angleInRadians) {
            const cosA = Math.cos(angleInRadians);
            const sinA = Math.sin(angleInRadians);

            const corners = [
                this.imRotate({ x: -halfSize.x, y: -halfSize.y }, cosA, sinA), // Top-Left
                this.imRotate({ x:  halfSize.x, y: -halfSize.y }, cosA, sinA), // Top-Right
                this.imRotate({ x:  halfSize.x, y:  halfSize.y }, cosA, sinA), // Bottom-Right
                this.imRotate({ x: -halfSize.x, y:  halfSize.y }, cosA, sinA)  // Bottom-Left
            ];

            return corners.map(c => vec.add(center, c));
        },

        // --- Other Intersection Functions (Directly Ported) ---

        intersectCircleAABB: function (cC, cR, rMin, rMax) {
            if (cR <= 0) return false;
            const cX = Math.max(rMin.x, Math.min(cC.x, rMax.x));
            const cY = Math.max(rMin.y, Math.min(cC.y, rMax.y));
            const dX = cC.x - cX;
            const dY = cC.y - cY;
            return (dX * dX + dY * dY) < (cR * cR);
        },

        intersectCircleCircle: function (c1, r1, c2, r2) {
            if (r1 < 0 || r2 < 0) return false;
            return vec.distanceSq(c1, c2) < (r1 + r2) * (r1 + r2);
        },

        intersectCircleTriangle: function (cC, cR, t1, t2, t3) {
            if (cR <= 0) return false;
            if (this.pointInTriangle(cC, t1, t2, t3)) return true;
            if (this.distancePointToLineSegment(cC, t1, t2) < cR) return true;
            if (this.distancePointToLineSegment(cC, t2, t3) < cR) return true;
            if (this.distancePointToLineSegment(cC, t3, t1) < cR) return true;
            if (vec.distanceSq(cC, t1) < cR * cR) return true;
            if (vec.distanceSq(cC, t2) < cR * cR) return true;
            if (vec.distanceSq(cC, t3) < cR * cR) return true;
            return false;
        }
    };
})();