const CanvasManager = (function () {
    let stage = null;
    let gridLayer = null; // Layer for the grid and background
    let mainLayer = null;
    let handleLayer = null;
    let transformer = null;
    let eraserPreview = null;
    let triangleHandles = [];
    let currentlyHandledTriangleId = null;

    // Function to draw the background and grid
    function _drawGrid() {
        if (!gridLayer) return;
        const width = stage.width();
        const height = stage.height();
        const gridSize = 40; // You can make this dynamic if needed

        // Clear previous grid
        gridLayer.destroyChildren();

        // Add a background color rect
        const background = new Konva.Rect({
            x: 0,
            y: 0,
            width: width,
            height: height,
            fill: '#26262b', // Equivalent to new Vector4(0.15f, 0.15f, 0.17f, 1.0f)
            listening: false, // background ignore mouse clicks
        });
        gridLayer.add(background);

        // Draw vertical lines
        for (let i = 0; i < width / gridSize; i++) {
            gridLayer.add(new Konva.Line({
                points: [Math.round(i * gridSize) + 0.5, 0, Math.round(i * gridSize) + 0.5, height],
                stroke: '#4d4d4d', // Equivalent to new Vector4(0.3f, 0.3f, 0.3f, 1.0f)
                strokeWidth: 1,
            }));
        }

        // Draw horizontal lines
        for (let j = 0; j < height / gridSize; j++) {
            gridLayer.add(new Konva.Line({
                points: [0, Math.round(j * gridSize), width, Math.round(j * gridSize)],
                stroke: '#4d4d4d',
                strokeWidth: 1,
            }));
        }
        gridLayer.batchDraw();
    }


    function _destroyTriangleHandles() {
        if (currentlyHandledTriangleId) {
            const shape = mainLayer.findOne('#' + currentlyHandledTriangleId);
            if (shape) {
                shape.draggable(true);
            }
            currentlyHandledTriangleId = null;
        }
        if (triangleHandles.length > 0) {
                triangleHandles.forEach(h => h.destroy());
                triangleHandles = [];
            }
            handleLayer.batchDraw();
        }

    function _createTriangleHandles(drawable) {
        if (!drawable || !(drawable instanceof DrawableTriangle)) return;
        _destroyTriangleHandles();
        const shape = mainLayer.findOne('#' + drawable.uniqueId);
        if (shape) {
            //shape.draggable(false);
            currentlyHandledTriangleId = drawable.uniqueId;
        }
    function _createArrowHandles(drawable) {
            if (!drawable || !(drawable instanceof DrawableArrow)) return;
            _destroyTriangleHandles();
            transformer.nodes([]);

            const shape = mainLayer.findOne('#' + drawable.uniqueId);
            if (shape) {
                shape.draggable(false);
            }

            const angleRad = drawable.rotation * (Math.PI / 180);
            const shaftVector = { x: drawable.endPoint.x - drawable.startPoint.x, y: drawable.endPoint.y - drawable.startPoint.y };
            const imRotate = (v, cosA, sinA) => ({ x: v.x * cosA - v.y * sinA, y: v.x * sinA + v.y * cosA });
            const cosA = Math.cos(angleRad);
            const sinA = Math.sin(angleRad);

            const handlePositions = {
                start: drawable.startPoint,
                end: { x: drawable.startPoint.x + (shaftVector.x * cosA - shaftVector.y * sinA), y: drawable.startPoint.y + (shaftVector.x * sinA + shaftVector.y * cosA) },
                rot: { x: drawable.startPoint.x - (20 * sinA), y: drawable.startPoint.y + (20 * cosA) }
            };

            const startHandle = new Konva.Circle({ x: handlePositions.start.x, y: handlePositions.start.y, radius: 6, fill: 'white', stroke: 'black', strokeWidth: 1, draggable: true, handleType: 'ArrowStart' });
            const endHandle = new Konva.Circle({ x: handlePositions.end.x, y: handlePositions.end.y, radius: 6, fill: 'white', stroke: 'black', strokeWidth: 1, draggable: true, handleType: 'ArrowEnd' });
            const rotHandle = new Konva.Circle({ x: handlePositions.rot.x, y: handlePositions.rot.y, radius: 6, fill: 'lightgreen', stroke: 'black', strokeWidth: 1, draggable: true, handleType: 'ArrowRotate' });

            [startHandle, endHandle, rotHandle].forEach(handle => {
                handle.on('dragstart', (e) => ShapeInteractionHandler.handleArrowHandleDragStart(e.target, drawable));
                handle.on('dragmove', (e) => ShapeInteractionHandler.handleArrowHandleDragMove(e.target, drawable));
                handle.on('dragend', (e) => ShapeInteractionHandler.handleArrowHandleDragEnd(e.target, drawable));
                handleLayer.add(handle);
                triangleHandles.push(handle);
            });

            handleLayer.batchDraw();
        }

            drawable.vertices.forEach((vertex, index) => {
                const handle = new Konva.Circle({
                    x: vertex.x, y: vertex.y, radius: 6, fill: 'white', stroke: 'black',
                    strokeWidth: 1, draggable: true, isVertexHandle: true, vertexIndex: index,
                    ownerId: drawable.uniqueId
                });
                handle.on('dragstart', (e) => ShapeInteractionHandler.handleTriangleVertexDragStart(e.target));
                handle.on('dragmove', (e) => ShapeInteractionHandler.handleTriangleVertexDragMove(e.target));
                handle.on('dragend', (e) => ShapeInteractionHandler.handleTriangleVertexDragEnd(e.target));
                handleLayer.add(handle);
                triangleHandles.push(handle);
            });
            handleLayer.batchDraw();
        }

    function _updateEraserPreview(pos, radius) {
        if (!eraserPreview) {
            eraserPreview = new Konva.Circle({
                radius: radius,
                stroke: 'red',
                strokeWidth: 1,
                listening: false, // Prevents the cursor from interfering with clicks
            });
            handleLayer.add(eraserPreview);
        }
        eraserPreview.position(pos);
        eraserPreview.radius(radius);
        eraserPreview.show();
        handleLayer.batchDraw();
    }

    function _attachEvents(konvaNode, drawable) {
        konvaNode.on('mousedown', (e) => { e.cancelBubble = true; _callbacks.onCanvasMouseDown(e);});
        //konvaNode.on('dragstart', (e) => {e.cancelBubble = true; ShapeInteractionHandler.handleDragStart(e.target, e) });
        //konvaNode.on('dragmove', (e) => e.target.getStage().batchDraw());
        //konvaNode.on('dragend', (e) => ShapeInteractionHandler.handleDragEnd(e.target, e));
    }

    function _createShapeFromDrawable(drawable, isPreview = false) {
        //console.log('[PREVIEW LOG] _createShapeFromDrawable received:', JSON.parse(JSON.stringify(drawable)));
        if (!drawable) return null;
        let shape = null;
        const commonAttrs = {
            id: isPreview ? 'preview-shape' : drawable.uniqueId,
            uniqueId: drawable.uniqueId,
            draggable: false,
            listening: !isPreview,
        };
        const color = `rgba(${drawable.color.r * 255}, ${drawable.color.g * 255}, ${drawable.color.b * 255}, ${drawable.color.a})`;
        const attrs = {
            ...commonAttrs,
            strokeWidth: drawable.thickness,
            fill: drawable.isFilled ? color : null,
            stroke: !drawable.isFilled ? color : null,
        };
        
        if (drawable.objectDrawMode >= DrawMode.Image) { // Assumes all image modes have higher enum values
            const imageObj = new Image();
            imageObj.src = drawable.imageResourcePath;

            const konvaImage = new Konva.Image({
                ...commonAttrs,
                x: drawable.position.x,
                y: drawable.position.y,
                image: imageObj,
                width: drawable.width,
                height: drawable.height,
                offsetX: drawable.width / 2,
                offsetY: drawable.height / 2,
                rotation: drawable.rotation,
            });

            // Konva needs to redraw the layer once the image is loaded
            imageObj.onload = function () {
                mainLayer.batchDraw();
            };
            
            shape = konvaImage;

        } else {    
        switch (drawable.objectDrawMode) {
            case DrawMode.Rectangle:
                const rectGeom = drawable.getGeometry();
                shape = new Konva.Rect({ ...attrs, x: rectGeom.center.x, y: rectGeom.center.y, width: rectGeom.halfSize.x * 2, height: rectGeom.halfSize.y * 2, rotation: drawable.rotation, offsetX: rectGeom.halfSize.x, offsetY: rectGeom.halfSize.y });
                break;
            case DrawMode.Circle:
                 shape = new Konva.Circle({ ...attrs, x: drawable.center.x, y: drawable.center.y, radius: drawable.radius });
                break;
            case DrawMode.Cone:
                const coneVertices = drawable.getVertices();
                if (!coneVertices) return null;
                shape = new Konva.Line({ ...attrs, points: coneVertices.flatMap(p => [p.x, p.y]), closed: true });
                break;
            case DrawMode.Triangle:
                shape = new Konva.Line({ ...attrs, points: drawable.vertices.flatMap(p => [p.x, p.y]), closed: true });
                break;
            case DrawMode.Pen:
                shape = new Konva.Line({ ...attrs, points: drawable.points.flatMap(p => [p.x, p.y]), lineCap: 'round', lineJoin: 'round' });
                break;
            case DrawMode.Arrow:
                const vertices = drawable.getTransformedVertices();
                if (!vertices) return null;

                const shaft = new Konva.Line({
                    points: [vertices[0].x, vertices[0].y, vertices[1].x, vertices[1].y],
                    stroke: color,
                    strokeWidth: drawable.thickness,
                    lineCap: 'round',
                    lineJoin: 'round',
                });

                const arrowhead = new Konva.Line({
                    points: [vertices[2].x, vertices[2].y, vertices[3].x, vertices[3].y, vertices[4].x, vertices[4].y],
                    fill: color,
                    closed: true
                });

                shape = new Konva.Group({ ...commonAttrs });
                shape.add(shaft, arrowhead);
                break;
            }
        }
        if (shape && !isPreview) {
            _attachEvents(shape, drawable);
        }
        //console.log('[PREVIEW LOG] _createShapeFromDrawable is returning:', shape);
        return shape;
    }

    return {
        initialize: function (callbacks) {
            _callbacks = callbacks;
            const container = document.getElementById('canvas-container');
            stage = new Konva.Stage({ container: 'konva-container', width: container.offsetWidth, height: container.offsetHeight });
            
            gridLayer = new Konva.Layer(); // Initialize grid layer
            mainLayer = new Konva.Layer();
            handleLayer = new Konva.Layer();
            stage.add(gridLayer, mainLayer, handleLayer); // Add grid layer first (bottom)
            
            // Configure the transformer to not interfere with dragging the shape body.
            transformer = new Konva.Transformer({
                borderEnabled: false,
                anchorStroke: 'rgb(0, 161, 255)',
                anchorFill: 'rgb(0, 161, 255)',
                anchorSize: 10,
                rotateAnchorOffset: 30,
            });
            
            handleLayer.add(transformer);
            
            transformer.on('transformend', (e) => {
                // The shapeInteractionHandler will update the data model.
                ShapeInteractionHandler.handleTransformEnd(transformer.nodes());
            });

            // Listener for deselecting by clicking the background
            stage.on('mousedown', (e) => callbacks.onCanvasMouseDown(e));
            stage.on('mousemove', (e) => callbacks.onCanvasMouseMove(e));
            stage.on('mouseup', (e) => callbacks.onCanvasMouseUp(e));
            
            _drawGrid(); // Draw the grid on initialization
            window.addEventListener('resize', _drawGrid); // Redraw grid on resize
        },
        renderPage: function (drawables, isQuickUpdate = false, previewDrawable = null) {
    if (!mainLayer) return;

    console.log('--- RENDER START --- Layer children before changes:', mainLayer.getChildren().map(c => c.id()));
    
    let oldPreview = mainLayer.findOne('#preview-shape');
    if (oldPreview) {
        oldPreview.destroy();
    }

    if (isQuickUpdate && previewDrawable) {
        const previewKonvaShape = _createShapeFromDrawable(previewDrawable, true);
        if (previewKonvaShape){
            previewKonvaShape.listening(false);
            mainLayer.add(previewKonvaShape);
        }
        mainLayer.draw();
    } else {
        transformer.nodes([]);
        _destroyTriangleHandles();
        mainLayer.destroyChildren();
        if (drawables) {
            drawables.forEach(drawable => {
                const shape = _createShapeFromDrawable(drawable);
                if(shape) mainLayer.add(shape);
            });
        }
        mainLayer.batchDraw();
    }

    // DIAGNOSTIC TEST START
    console.log('--- RENDER END --- Layer children after changes:', mainLayer.getChildren().map(c => c.id()));
    // DIAGNOSTIC TEST END
},
        updateSelection(selectedDrawables) {
            // NEW LOG
            console.log(`[Canvas.js] updateSelection called with ${selectedDrawables.length} selected item(s).`);

            _destroyTriangleHandles();
            transformer.nodes([]);

            if (selectedDrawables.length > 0 && selectedDrawables[0] instanceof DrawableTriangle && selectedDrawables.length === 1) {
                // NEW LOG
                console.log('[Canvas.js] Handling special case for single Triangle selection.');
                _createTriangleHandles(selectedDrawables[0]);

            } else if (selectedDrawables.length > 0 && selectedDrawables[0].objectDrawMode === DrawMode.Arrow && selectedDrawables.length === 1) {
                // NEW LOG
                console.log('[Canvas.js] Handling special case for single Arrow selection.');
                _createArrowHandles(selectedDrawables[0]);

            } else if (selectedDrawables.length > 0) {
                // NEW LOG
                console.log('[Canvas.js] Handling generic selection. Searching for nodes...');
                
                const selectedNodes = selectedDrawables.map(d => {
                    const selector = '#' + d.uniqueId;
                    const foundNode = mainLayer.findOne(selector);
                    // NEW LOG
                    console.log(`[Canvas.js]   - Searching for node with ID selector: "${selector}". Found:`, foundNode ? `Node (id=${foundNode.id()})` : 'null');
                    return foundNode;
                }).filter(Boolean); // filter(Boolean) removes any null/undefined entries

                // NEW LOG
                console.log(`[Canvas.js] Found ${selectedNodes.length} Konva nodes to attach transformer to.`);

                transformer.nodes(selectedNodes);
            } else {
                 // NEW LOG
                console.log('[Canvas.js] Selection is empty. Clearing transformer.');
            }
            handleLayer.batchDraw();
        },
        hideEraserPreview: function() {
        if (eraserPreview) {
            eraserPreview.hide();
            handleLayer.batchDraw();
        }
        }
    };
})();