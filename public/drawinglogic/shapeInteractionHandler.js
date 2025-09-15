const ShapeInteractionHandler = (function () {
    let undoManager = null;
    let pageManager = null;
    let appState = null;
    let callbacks = {};

    let isMarqueeSelecting = false;
    let marqueeStartPos = { x: 0, y: 0 };

    function rectIntersects(r1, r2) {
        return !(r2.x > r1.x + r1.width ||
                 r2.x + r2.width < r1.x ||
                 r2.y > r1.y + r1.height ||
                 r2.y + r2.height < r1.y);
    }

    function rectContains(r1, r2) {
        return (r2.x >= r1.x &&
                r2.x + r2.width <= r1.x + r1.width &&
                r2.y >= r1.y &&
                r2.y + r2.height <= r1.y + r1.height);
    }
    
    let isMouseDownOnObject = false; // Is the mouse button currently down on a shape?
    let isDraggingObject = false;    // Has the mouse moved enough to be considered a drag?
    let dragStartMousePos = { x: 0, y: 0 };
    let dragStartObjectStates = [];
    const DRAG_THRESHOLD = 5; // The distance in pixels the mouse must move to start a drag
    let originalMouseDownEvent = null; // Store the original mousedown event
    
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
        isMarqueeSelecting: function() {
            return isMarqueeSelecting;
        },
        isObjectBeingDragged: function (uniqueId) {
            return isDraggingObject && dragStartObjectStates.some(s => s.uniqueId === uniqueId);
        },
        getMarqueeStartPos: function() {
             return marqueeStartPos;
        },
        initialize: function (um, pm, state, cbs) {
            undoManager = um;
            pageManager = pm;
            appState = state;
            callbacks = cbs;
        },
        
        startMarqueeSelection: function(e) {
            console.log('[DEBUG] Marquee selection started.');
            const stage = e.target.getStage();
            if (!stage) return;
            isMarqueeSelecting = true;
            marqueeStartPos = stage.getPointerPosition();
            console.log('[DEBUG] Marquee start position:', marqueeStartPos);
            
            if (!e.evt.shiftKey) {
                 callbacks.onSelectionChange([]);
            }
        },

        finalizeMarqueeSelection: function (e) {
            if (!isMarqueeSelecting) return;
            console.log('[DEBUG] Marquee selection finalizing...');
            
            const stage = e.target.getStage();
            if (!stage) return;
            const endPos = stage.getPointerPosition();
            console.log('[DEBUG] Marquee end position:', endPos);

            const min = {
                x: Math.min(marqueeStartPos.x, endPos.x),
                y: Math.min(marqueeStartPos.y, endPos.y)
            };
            const max = {
                x: Math.max(marqueeStartPos.x, endPos.x),
                y: Math.max(marqueeStartPos.y, endPos.y)
            };

            const marqueeRect = {
                x: min.x,
                y: min.y,
                width: max.x - min.x,
                height: max.y - min.y
            };
            
            const isCrossing = endPos.x < marqueeStartPos.x;
            console.log(`[DEBUG] Marquee rect calculated:`, marqueeRect);
            console.log(`[DEBUG] Is crossing selection: ${isCrossing}`);

            const allDrawables = pageManager.getCurrentPageDrawables();
            const newlySelected = [];

            allDrawables.forEach(drawable => {
                const bbox = drawable.getBoundingBox(); 
                if (!bbox) return;

                const shouldSelect = isCrossing ? rectIntersects(marqueeRect, bbox) : rectContains(marqueeRect, bbox);

                if (shouldSelect) {
                    newlySelected.push(drawable);
                }
            });

            console.log(`[DEBUG] Found ${newlySelected.length} items inside marquee.`);
            const currentSelection = e.evt.shiftKey ? appState.selectedDrawables : [];
            const finalSelection = [...new Set([...currentSelection, ...newlySelected])];
            callbacks.onSelectionChange(finalSelection);

            isMarqueeSelecting = false;
            console.log('[DEBUG] Marquee selection finished.');
        },

        handleBackgroundClick: function (e) {
            if (!e.evt.shiftKey && appState.selectedDrawables.length > 0) {
                console.log(`... Clearing selection of ${appState.selectedDrawables.length} object(s).`);
                callbacks.onSelectionChange([]);
            }
        },

        handleDragInitiation: function (e) {
            console.log('[Drag Debug] handleDragInitiation started.');
            // Get stage and pointer position immediately, before any re-renders can occur.
            const stage = e.target.getStage();
            if (!stage) return; // Safety check
            dragStartMousePos = stage.getPointerPosition();
            console.log(`[Drag Debug]   - Mouse down at: {x: ${dragStartMousePos.x}, y: ${dragStartMousePos.y}}`);

            
            isMouseDownOnObject = true; // Set the flag that a shape was clicked
            console.log('[Drag Debug]   - isMouseDownOnObject set to true.');
            const hitDrawable = getDrawableFromKonvaNode(e.target);
            if (!hitDrawable) return;

            const isSelected = appState.selectedDrawables.some(d => d.uniqueId === hitDrawable.uniqueId);
            
            if (e.evt.shiftKey) {
                const newSelection = isSelected 
                    ? appState.selectedDrawables.filter(d => d.uniqueId !== hitDrawable.uniqueId)
                    : [...appState.selectedDrawables, hitDrawable];
                callbacks.onSelectionChange(newSelection);
            } else {
                if (!isSelected) {
                    callbacks.onSelectionChange([hitDrawable]);
                }
            }

            // Prepare for a potential drag by caching the start positions.
            //dragStartMousePos = e.target.getStage().getPointerPosition();
            dragStartObjectStates = appState.selectedDrawables.map(drawable => ({
                uniqueId: drawable.uniqueId,
                originalState: JSON.parse(JSON.stringify(drawable))
            }));
            /*const hitObject = e.target;
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

                //undoManager.recordAction(pageManager.getCurrentPageDrawables(), "Move Object");
            }*/
        },

        // Handles the visual movement during a drag.
        handleCustomDrag: function (e) {
            if (!isMouseDownOnObject) return; // Only run if the mouse is down on an object.
            console.log('[Drag Debug] handleCustomDrag running...');

            const stage = e.target.getStage();
            if (!stage) return;
            const currentMousePos = stage.getPointerPosition();
            
            // Check if the drag threshold has been passed to start the drag.
            if (!isDraggingObject) {
                const dx = currentMousePos.x - dragStartMousePos.x;
                const dy = currentMousePos.y - dragStartMousePos.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                console.log(`[Drag Debug]   - Checking threshold. Distance: ${distance.toFixed(2)}, Threshold: ${DRAG_THRESHOLD}`);

               if (distance > DRAG_THRESHOLD) {
                    console.log('%c[Drag Debug]   - Drag threshold passed. Starting drag!', 'color: lightgreen; font-weight: bold;');
                    isDraggingObject = true; // Threshold passed. We are now officially dragging.
                    undoManager.recordAction(pageManager.getCurrentPageDrawables(), "Move Object");
                }
            }
            
            if (!isDraggingObject) return;
            console.log('[Drag Debug]   - isDraggingObject is true. Applying movement.');

            const delta = {
                x: currentMousePos.x - dragStartMousePos.x,
                y: currentMousePos.y - dragStartMousePos.y
            };

            const modifiedDrawables = [];

                dragStartObjectStates.forEach(({ uniqueId, originalState }) => {
                    const liveDrawable = appState.selectedDrawables.find(d => d.uniqueId === uniqueId);
                    if (!liveDrawable) return;

                    // Safely apply the calculated delta to the live object's properties
                    // without overwriting the entire object.
                    if (liveDrawable.center) { // For Circles
                        liveDrawable.center.x = originalState.center.x + delta.x;
                        liveDrawable.center.y = originalState.center.y + delta.y;
                    }
                    if (liveDrawable.position) { // For Images
                        liveDrawable.position.x = originalState.position.x + delta.x;
                        liveDrawable.position.y = originalState.position.y + delta.y;
                    }
                    if (liveDrawable.startPoint && liveDrawable.endPoint) { // For Rectangles, Arrows, etc.
                        liveDrawable.startPoint.x = originalState.startPoint.x + delta.x;
                        liveDrawable.startPoint.y = originalState.startPoint.y + delta.y;
                        liveDrawable.endPoint.x = originalState.endPoint.x + delta.x;
                        liveDrawable.endPoint.y = originalState.endPoint.y + delta.y;
                    }
                    if (liveDrawable.vertices) { // For Triangles
                        liveDrawable.vertices.forEach((v, index) => {
                            v.x = originalState.vertices[index].x + delta.x;
                            v.y = originalState.vertices[index].y + delta.y;
                        });
                    }
                    if (liveDrawable.points) { // For Pen strokes
                        liveDrawable.points.forEach((p, index) => {
                            p.x = originalState.points[index].x + delta.x;
                            p.y = originalState.points[index].y + delta.y;
                        });
                    }

                    modifiedDrawables.push(liveDrawable);
                });

                if (modifiedDrawables.length > 0) {
                    const positionUpdates = modifiedDrawables.map(drawable => ({
                        uniqueId: drawable.uniqueId,
                        position: drawable.position,
                        center: drawable.center, // If it's a circle
                    }));

                    callbacks.onObjectsUpdatedLive(positionUpdates);
                    //e.target.getStage().batchDraw();
                }
            },

            handleDragTermination: function (e) {
                console.log('[Drag Debug] handleDragTermination started.');
                if (isDraggingObject) {
                    console.log('[Drag Debug]   - Was dragging. Committing changes.');
                    callbacks.onObjectsCommitted(appState.selectedDrawables);
                } else {
                    console.log('[Drag Debug]   - Was NOT dragging (was a click). Nothing to commit.');
                }
                isMouseDownOnObject = false;
                isDraggingObject = false;
                dragStartObjectStates = [];
                //originalMouseDownEvent = null;
                console.log('[Drag Debug]   - All drag flags reset.');
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
