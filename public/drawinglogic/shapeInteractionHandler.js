const ShapeInteractionHandler = (function () {
    let undoManager = null;
    let pageManager = null;
    let appState = null;
    let callbacks = {};

    // --- State for our custom drag-and-drop logic ---
    let isDraggingObject = false;
    let dragStartMousePos = { x: 0, y: 0 };
    // Stores the original state of drawables at the start of a drag
    let dragStartObjectStates = [];
    // ---

    let draggedVertexIndex = -1; // State for triangle reshaping

    function getDrawableFromKonvaNode(konvaNode) {
        if (!konvaNode) return null;
        const id = konvaNode.getAttr('uniqueId') || konvaNode.getAttr('ownerId');
        if (!id) return null;
        return pageManager.getCurrentPageDrawables().find(d => d.uniqueId === id);
    }

    return {
        isDragging: function () {
            return isDraggingObject;
        },
        isObjectBeingDragged: function (uniqueId) {
            return isDraggingObject && dragStartObjectStates.some(s => s.uniqueId === uniqueId);
        },

        initialize: function (um, pm, state, cbs) {
            undoManager = um;
            pageManager = pm;
            appState = state;
            callbacks = cbs;
        },

        handleBackgroundClick: function (e) {
            if (!e.evt.shiftKey && appState.selectedDrawables.length > 0) {
                console.log(`... Clearing selection of ${appState.selectedDrawables.length} object(s).`);
                callbacks.onSelectionChange([]);
            }
        },

        handleDragInitiation: function (e) {
            const hitObject = e.target;
            const stage = hitObject.getStage();
            if (!stage) return;

            if (hitObject.getAttr('isVertexHandle')) return;

            const hitDrawable = getDrawableFromKonvaNode(hitObject);
            if (!hitDrawable) return;

            const isSelected = appState.selectedDrawables.some(d => d.uniqueId === hitDrawable.uniqueId);
            if (!e.evt.shiftKey) {
                if (!isSelected) {
                    callbacks.onSelectionChange([hitDrawable]);
                }
            } else {
                if (isSelected) {
                    const newSelection = appState.selectedDrawables.filter(d => d.uniqueId !== hitDrawable.uniqueId);
                    callbacks.onSelectionChange(newSelection);
                } else {
                    callbacks.onSelectionChange([...appState.selectedDrawables, hitDrawable]);
                }
            }

            if (appState.selectedDrawables.length > 0) {
                isDraggingObject = true;
                dragStartMousePos = stage.getPointerPosition();
                dragStartObjectStates = appState.selectedDrawables.map(drawable => ({
                    uniqueId: drawable.uniqueId,
                    originalState: JSON.parse(JSON.stringify(drawable))
                }));

                undoManager.recordAction(pageManager.getCurrentPageDrawables(), "Move Object");
            }
        },

        // Handles the visual movement during a drag.
        handleCustomDrag: function (e) {
            if (!isDraggingObject) return;

            const stage = e.target.getStage();
            if (!stage) return;

            const currentMousePos = stage.getPointerPosition();
            const delta = {
                x: currentMousePos.x - dragStartMousePos.x,
                y: currentMousePos.y - dragStartMousePos.y
            };

            const modifiedDrawables = [];

                dragStartObjectStates.forEach(({ uniqueId, originalState }) => {
                    const liveDrawable = appState.selectedDrawables.find(d => d.uniqueId === uniqueId);
                    if (!liveDrawable) return;

                    // Create a new state object based on the original state plus the drag delta.
                    // This avoids using the live object's current state in the calculation,
                    // preventing the cumulative "warping" error.
                    const newState = JSON.parse(JSON.stringify(originalState)); // Create a working copy

                    if (newState.center) { // For Circles
                        newState.center.x += delta.x;
                        newState.center.y += delta.y;
                    }
                    if (newState.position) { // For Images
                        newState.position.x += delta.x;
                        newState.position.y += delta.y;
                    }
                    if (newState.startPoint && newState.endPoint) { // For Rectangles, Arrows, etc.
                        newState.startPoint.x += delta.x;
                        newState.startPoint.y += delta.y;
                        newState.endPoint.x += delta.x;
                        newState.endPoint.y += delta.y;
                    }
                    if (newState.vertices) { // For Triangles
                        newState.vertices.forEach(v => {
                            v.x += delta.x;
                            v.y += delta.y;
                        });
                    }
                    if (newState.points) { // For Pen strokes
                        newState.points.forEach(p => {
                            p.x += delta.x;
                            p.y += delta.y;
                        });
                    }

                    // Apply the calculated new state to the live drawable.
                    Object.assign(liveDrawable, newState);
                    modifiedDrawables.push(liveDrawable);
                });

                if (modifiedDrawables.length > 0) {
                    callbacks.onObjectsUpdatedLive(modifiedDrawables);
                }
            },

            // Finalizes the drag, updating the data model.
            handleDragTermination: function (e) {

            if (!isDraggingObject) return;

            if (dragStartObjectStates.length > 0) {
                callbacks.onObjectsCommitted(appState.selectedDrawables);
            }

            isDraggingObject = false;
            dragStartObjectStates = [];
        },

        handleTriangleVertexDragStart: function (konvaHandle) {
            draggedVertexIndex = konvaHandle.getAttr('vertexIndex');
            undoManager.recordAction(pageManager.getCurrentPageDrawables(), "Reshape Triangle");
        },

        handleTriangleVertexDragMove: function (konvaHandle) {
            if (draggedVertexIndex === -1) return;
            const drawable = getDrawableFromKonvaNode(konvaHandle);
            if (!drawable) return;

            const newPos = { x: konvaHandle.x(), y: konvaHandle.y() };
            drawable.vertices[draggedVertexIndex] = newPos;

            const triangleShape = konvaHandle.getStage().findOne('#' + drawable.uniqueId);
            if (triangleShape) {
                triangleShape.points(drawable.vertices.flatMap(p => [p.x, p.y]));
            }
        },

        handleTriangleVertexDragEnd: function (konvaHandle) {
            if (draggedVertexIndex === -1) return;
            const drawable = getDrawableFromKonvaNode(konvaHandle);
            if (drawable) {
                callbacks.onObjectsCommitted([drawable]);
            }
            draggedVertexIndex = -1;
        },

        handleArrowHandleDragStart: function (konvaHandle, drawable) {
            dragStartObjectStates = {
                mousePos: konvaHandle.getStage().getPointerPosition(),
                startPoint: drawable.startPoint,
                endPoint: drawable.endPoint,
                rotation: drawable.rotation
            };
            undoManager.recordAction(pageManager.getCurrentPageDrawables(), "Reshape Arrow");
        },

        handleArrowHandleDragMove: function (konvaHandle, drawable) {
            const mousePos = konvaHandle.getStage().getPointerPosition();
            const handleType = konvaHandle.getAttr('handleType');

            const imRotate = (v, cosA, sinA) => ({
                x: v.x * cosA - v.y * sinA,
                y: v.x * sinA + v.y * cosA
            });

            switch (handleType) {
                case 'ArrowStart':
                    const delta = {
                        x: mousePos.x - dragStartObjectStates.mousePos.x,
                        y: mousePos.y - dragStartObjectStates.mousePos.y
                    };
                    drawable.setStartPoint({
                        x: dragStartObjectStates.startPoint.x + delta.x,
                        y: dragStartObjectStates.startPoint.y + delta.y
                    });
                    break;
                case 'ArrowEnd':
                    const mouseRelativeToStart = {
                        x: mousePos.x - drawable.startPoint.x,
                        y: mousePos.y - drawable.startPoint.y
                    };
                    const angleRad = -drawable.rotation * (Math.PI / 180);
                    const cosA = Math.cos(angleRad);
                    const sinA = Math.sin(angleRad);
                    const unrotated = imRotate(mouseRelativeToStart, cosA, sinA);
                    drawable.setEndPoint({
                        x: drawable.startPoint.x + unrotated.x,
                        y: drawable.startPoint.y + unrotated.y
                    });
                    break;
                case 'ArrowRotate':
                    const pivot = drawable.startPoint;
                    const angleNow = Math.atan2(mousePos.y - pivot.y, mousePos.x - pivot.x);
                    const angleThen = Math.atan2(dragStartObjectStates.mousePos.y - pivot.y, dragStartObjectStates.mousePos.x - pivot.x);
                    const angleDeltaRad = angleNow - angleThen;
                    drawable.rotation = dragStartObjectStates.rotation + (angleDeltaRad * 180 / Math.PI);
                    break;
            }

            callbacks.onObjectsUpdatedLive([drawable]);
        },

        handleArrowHandleDragEnd: function (konvaHandle, drawable) {
            callbacks.onObjectsCommitted([drawable]);
            dragStartObjectStates = {};
        },

        handleTransformEnd: function (konvaNodes) {
            const modifiedDrawables = [];
            let transformOccurred = false;

            konvaNodes.forEach(node => {
                if (node.scaleX() !== 1 || node.scaleY() !== 1 || node.rotation() !== 0) {
                    transformOccurred = true;
                    const drawable = getDrawableFromKonvaNode(node);

                    if (drawable && drawable instanceof DrawableRectangle) {
                        const newWidth = node.width() * node.scaleX();
                        const newHeight = node.height() * node.scaleY();
                        const newRotation = node.rotation();
                        const newPosition = { x: node.x(), y: node.y() };

                        drawable.startPoint = {
                            x: newPosition.x - newWidth / 2,
                            y: newPosition.y - newHeight / 2
                        };
                        drawable.endPoint = {
                            x: newPosition.x + newWidth / 2,
                            y: newPosition.y + newHeight / 2
                        };
                        drawable.rotation = newRotation;

                        node.scaleX(1);
                        node.scaleY(1);
                        node.rotation(0);

                        modifiedDrawables.push(drawable);
                    } else if (drawable && drawable instanceof DrawableCircle) {
                        const newPosition = { x: node.x(), y: node.y() };
                        const scale = (node.scaleX() + node.scaleY()) / 2;
                        const newRadius = drawable.radius * scale;

                        drawable.center = newPosition;
                        drawable.radius = newRadius;

                        node.scaleX(1);
                        node.scaleY(1);

                        modifiedDrawables.push(drawable);
                    } else if (drawable && drawable instanceof DrawableImage) {
                        drawable.position = { x: node.x(), y: node.y() };
                        drawable.width = node.width() * node.scaleX();
                        drawable.height = node.height() * node.scaleY();
                        drawable.rotation = node.rotation();

                        node.scaleX(1);
                        node.scaleY(1);
                        node.rotation(0);

                        modifiedDrawables.push(drawable);
                    }
                }
            });

            if (transformOccurred) {
                undoManager.recordAction(pageManager.getCurrentPageDrawables(), "Transform Object(s)");
                if (modifiedDrawables.length > 0) {
                    callbacks.onObjectsCommitted(modifiedDrawables);
                }
            }
        }
    };
})();
