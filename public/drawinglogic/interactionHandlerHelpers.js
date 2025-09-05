/**
 * AetherDraw Web - Interaction Handler Helpers
 * Provides methods for the main ShapeInteractionHandler to draw custom manipulation handles
 * and process drag updates for specific complex shape types like Arrows and Triangles.
 * Mirrors the necessary functionality of InteractionHandlerHelpers.cs.
 */
const InteractionHandlerHelpers = (function () {

    // --- Private Vector Math Helpers ---
    // These replicate the functionality of System.Numerics.Vector2 for this module.
    const vec = {
        add: (v1, v2) => ({ x: v1.x + v2.x, y: v1.y + v2.y }),
        subtract: (v1, v2) => ({ x: v1.x - v2.x, y: v1.y - v2.y }),
        scale: (v, s) => ({ x: v.x * s, y: v.y * s }),
        lengthSq: (v) => v.x * v.x + v.y * v.y,
        length: (v) => Math.sqrt(v.x * v.x + v.y * v.y),
        normalize: (v) => {
            const len = Math.sqrt(v.x * v.x + v.y * v.y);
            return len > 0.0001 ? { x: v.x / len, y: v.y / len } : { x: 0, y: 0 };
        },
        dot: (v1, v2) => v1.x * v2.x + v1.y * v2.y,
        rotate: (v, angleRad) => {
            const cos = Math.cos(angleRad);
            const sin = Math.sin(angleRad);
            return { x: v.x * cos - v.y * sin, y: v.x * sin + v.y * cos };
        }
    };

    // --- Public API ---
    return {

        // --- Handle Drawing ---

        processTriangleHandles: function (dTri, mousePos, handler) {
            let mouseOverAny = false;
            for (let i = 0; i < 3; i++) {
                if (handler.drawAndCheckHandle(dTri.vertices[i], mousePos, {})) {
                    mouseOverAny = true;
                    handler.draggedHandleIndex = i;
                }
            }
            return mouseOverAny;
        },

        processArrowHandles: function (dArrow, mousePos, handler) {
            let mouseOverAny = false;
            const angleRad = dArrow.rotation * (Math.PI / 180);

            const logicalStart = dArrow.startPoint;
            const shaftVectorUnrotated = vec.subtract(dArrow.endPoint, dArrow.startPoint);
            const logicalRotatedShaftEnd = vec.add(logicalStart, vec.rotate(shaftVectorUnrotated, angleRad));

            // Start and End point handles
            if (handler.drawAndCheckHandle(logicalStart, mousePos, { cursor: 'move' })) {
                mouseOverAny = true;
                handler.draggedHandleIndex = 0;
            }
            if (handler.drawAndCheckHandle(logicalRotatedShaftEnd, mousePos, { cursor: 'move' })) {
                mouseOverAny = true;
                handler.draggedHandleIndex = 1;
            }

            // Rotation handle
            const rotHandleOffsetLocal = { x: 0, y: -20 }; // 20px offset
            const rotHandleLogical = vec.add(logicalStart, vec.rotate(rotHandleOffsetLocal, angleRad));
            if (handler.drawAndCheckHandle(rotHandleLogical, mousePos, { isRotation: true })) {
                mouseOverAny = true;
                handler.draggedHandleIndex = 2;
            }

            // Thickness handle
            const shaftMidLogicalRotated = vec.add(logicalStart, vec.scale(vec.rotate(shaftVectorUnrotated, angleRad), 0.5));
            const shaftDirRotated = vec.normalize(vec.rotate(shaftVectorUnrotated, angleRad));
            const perpOffsetThick = vec.scale({ x: -shaftDirRotated.y, y: shaftDirRotated.x }, (dArrow.strokeWidth / 2 + 10));

            if (handler.drawAndCheckHandle(vec.add(shaftMidLogicalRotated, perpOffsetThick), mousePos, { cursor: 'ns-resize', isSpecial: true })) {
                mouseOverAny = true;
                handler.draggedHandleIndex = 3;
            }
            return mouseOverAny;
        },

        // Stubs for other complex shapes to be translated later
        processPathHandles: function() { return false; },
        processConeHandles: function() { return false; },
        processTextHandles: function() { return false; },


        // --- Drag Update Logic ---

        updateRotationDrag: function (item, mousePos, handler) {
            const pivot = handler.dragStartObjectPivotLogical;
            const angleNowRad = Math.atan2(mousePos.y - pivot.y, mousePos.x - pivot.x);
            const angleThenRad = Math.atan2(handler.dragStartMousePosLogical.y - pivot.y, handler.dragStartMousePosLogical.x - pivot.x);
            const newAngleRad = handler.dragStartRotationAngleRad + (angleNowRad - angleThenRad);

            item.rotation = newAngleRad * (180 / Math.PI); // Konva uses degrees
        },

        updateTriangleResizeDrag: function (dTri, mousePos, handler) {
            if (handler.draggedHandleIndex >= 0 && handler.draggedHandleIndex < 3) {
                dTri.vertices[handler.draggedHandleIndex] = mousePos;
            }
        },

        updateArrowStartDrag: function (dArrow, mousePos, handler) {
            const delta = vec.subtract(mousePos, handler.dragStartMousePosLogical);
            // In the C# version, SetStartPoint also moves the end point. We replicate that.
            dArrow.startPoint = vec.add(handler.dragStartPoints[0], delta);
            dArrow.endPoint = vec.add(handler.dragStartPoints[1], delta);
        },

        updateArrowEndDrag: function (dArrow, mousePos) {
            const angleRad = dArrow.rotation * (Math.PI / 180);
            const mouseRelativeToStart = vec.subtract(mousePos, dArrow.startPoint);
            // Transform mouse into arrow's local unrotated space to set the new end point
            const unrotatedMouseRelativeToStart = vec.rotate(mouseRelativeToStart, -angleRad);
            dArrow.endPoint = vec.add(dArrow.startPoint, unrotatedMouseRelativeToStart);
        },

        updateArrowThicknessDrag: function (dArrow, mousePos, handler) {
            const angleRad = handler.dragStartRotationAngleRad;
            const initialShaftVec = vec.subtract(handler.dragStartPoints[1], handler.dragStartPoints[0]);
            const initialShaftDir = vec.normalize(initialShaftVec);
            const perpDir = { x: -initialShaftDir.y, y: initialShaftDir.x };

            const mouseDeltaUnrotated = vec.rotate(vec.subtract(mousePos, handler.dragStartMousePosLogical), -angleRad);

            // Project the mouse movement onto the perpendicular vector to find thickness change
            const thicknessDeltaProjection = vec.dot(mouseDeltaUnrotated, perpDir);
            dArrow.strokeWidth = Math.max(1, handler.dragStartValue + thicknessDeltaProjection);

            // Also update arrowhead size based on new thickness
            dArrow.arrowheadLength = Math.max(5, dArrow.strokeWidth * 5.0);
            dArrow.arrowheadWidth = dArrow.strokeWidth * 3.0;
        },
    };
})();