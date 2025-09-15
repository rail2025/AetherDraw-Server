document.addEventListener('DOMContentLoaded', () => {

    const appState = {
        currentToolName: 'Select',
        brushColor: '#FFFFFF',
        brushWidth: 4,
        isShapeFilled: false,
        selectedDrawables: [],
        hoveredDrawable: null,
        isErasing: false,
        lastEraseTime: 0,
    };
    
    const pendingEchoIds = new Set();
    
    //let clickTimeout = null;
    //let lastClickedTarget = null;

    let initialStateReceived = false;

    const toolNameToPluginResourcePath = {
        bossImage: 'PluginImages.svg.boss.svg',
        circleAoEImage: 'PluginImages.svg.prox_aoe.svg',
        donutAoEImage: 'PluginImages.svg.donut.svg',
        flareImage: 'PluginImages.svg.flare.svg',
        lineStackImage: 'PluginImages.svg.line_stack.svg',
        spreadImage: 'PluginImages.svg.spread.svg',
        stackImage: 'PluginImages.svg.stack.svg',
        waymark1Image: 'PluginImages.toolbar.1_waymark.png',
        waymark2Image: 'PluginImages.toolbar.2_waymark.png',
        waymark3Image: 'PluginImages.toolbar.3_waymark.png',
        waymark4Image: 'PluginImages.toolbar.4_waymark.png',
        waymarkAImage: 'PluginImages.toolbar.A.png',
        waymarkBImage: 'PluginImages.toolbar.B.png',
        waymarkCImage: 'PluginImages.toolbar.C.png',
        waymarkDImage: 'PluginImages.toolbar.D.png',
        tankImage: 'PluginImages.toolbar.Tank.jpg',
        healerImage: 'PluginImages.toolbar.Healer.JPG',
        meleeImage: 'PluginImages.toolbar.Melee.JPG',
        rangedImage: 'PluginImages.toolbar.Ranged.jpg',
        party1Image: 'PluginImages.toolbar.Party1.png',
        party2Image: 'PluginImages.toolbar.Party2.png',
        party3Image: 'PluginImages.toolbar.Party3.png',
        party4Image: 'PluginImages.toolbar.Party4.png',
        party5Image: 'PluginImages.toolbar.Party5.png',
        party6Image: 'PluginImages.toolbar.Party6.png',
        party7Image: 'PluginImages.toolbar.Party7.png',
        party8Image: 'PluginImages.toolbar.Party8.png',
        squareImage: 'PluginImages.toolbar.Square.png',
        circleMarkImage: 'PluginImages.toolbar.CircleMark.png',
        triangleImage: 'PluginImages.toolbar.Triangle.png',
        plusImage: 'PluginImages.toolbar.Plus.png',
        dot1Image: 'PluginImages.svg.1dot.svg',
        dot2Image: 'PluginImages.svg.2dot.svg',
        dot3Image: 'PluginImages.svg.3dot.svg',
        dot4Image: 'PluginImages.svg.4dot.svg',
        dot5Image: 'PluginImages.svg.5dot.svg',
        dot6Image: 'PluginImages.svg.6dot.svg',
        dot7Image: 'PluginImages.svg.7dot.svg',
        dot8Image: 'PluginImages.svg.8dot.svg',
    };

    const pageManager = PageManager;
    const undoManager = UndoManager;
    const networkManager = new NetworkManager();
    const canvasManager = CanvasManager;
    const canvasController = CanvasController;
    const shapeInteractionHandler = ShapeInteractionHandler;
    const inPlaceTextEditor = InPlaceTextEditor;
    const uiManager = UIManager;

    const uiCallbacks = {
        onToolSelect: (toolName) => {
           if (inPlaceTextEditor.isEditing()) {
                inPlaceTextEditor.endInPlaceEdit(true); // Commit changes if tool is switched
            }
            inPlaceTextEditor.hideSidePanel();
            appState.currentToolName = toolName;
            uiManager.updateToolbar(appState);
            canvasManager.updateSelection([]);
            appState.selectedDrawables = [];
            controllerCallbacks.onStateChanged();
        },
        onColorChange: (color) => {
            appState.brushColor = color;
            uiManager.updateToolbar(appState);
            // If text is selected, apply color change immediately
            if (appState.selectedDrawables.length === 1 && appState.selectedDrawables[0] instanceof DrawableText) {
                const textDrawable = appState.selectedDrawables[0];
                textDrawable.color = hexToRgbaObject(color);
                interactionHandlerCallbacks.onObjectsCommitted([textDrawable]); // Send update
                inPlaceTextEditor.showSidePanel(textDrawable); // Refresh panel
            }
        },
        onThicknessChange: (thickness) => {
            appState.brushWidth = parseFloat(thickness);
            uiManager.updateToolbar(appState);
        },
        onFillToggle: () => {
            appState.isShapeFilled = !appState.isShapeFilled;
            uiManager.updateToolbar(appState);
        },
        onUndo: () => {
            const undoneState = undoManager.undo();
            if (undoneState) {
                pageManager.setCurrentPageDrawables(undoneState);
                if (networkManager.isConnected) {
                    const payload = {
                        pageIndex: pageManager.getCurrentPageIndex(),
                        action: PayloadActionType.ReplacePage,
                        data: DrawableSerializer.serializePageToBytes(undoneState)
                    };
                    networkManager.sendStateUpdateAsync(payload);
                }
                controllerCallbacks.onStateChanged();
            }
        },
        onClearAll: () => {
            const currentPage = pageManager.getCurrentPageDrawables();
            if (currentPage.length > 0) {
                undoManager.recordAction(currentPage, "Clear All");
                currentPage.length = 0;
                if (networkManager.isConnected) {
                     const payload = {
                        pageIndex: pageManager.getCurrentPageIndex(),
                        action: PayloadActionType.ClearPage,
                        data: null
                    };
                    networkManager.sendStateUpdateAsync(payload);
                }
                controllerCallbacks.onStateChanged();
            }
        },
        onAddPage: () => {
            if (networkManager.isConnected) {
                // In live mode, send a command to the server and wait for the echo.
                const payload = {
                    pageIndex: pageManager.getAllPages().length, // The new page will be at this index
                    action: PayloadActionType.AddNewPage,
                    data: null
                };
                networkManager.sendStateUpdateAsync(payload);
            } else {
                // In offline mode, add the page locally immediately.
                pageManager.addNewPage();
                undoManager.clearHistory();
                uiManager.renderPageTabs(pageManager.getAllPages(), pageManager.getCurrentPageIndex(), uiCallbacks.onPageSwitch);
                controllerCallbacks.onStateChanged();
            }
        },
        onDeletePage: () => {
                if (networkManager.isConnected) {
                const payload = {
                    pageIndex: pageManager.getCurrentPageIndex(),
                    action: PayloadActionType.DeletePage,
                    data: null
                };
                networkManager.sendStateUpdateAsync(payload);
            } else {
                pageManager.deleteCurrentPage();
                undoManager.clearHistory();
                uiManager.renderPageTabs(pageManager.getAllPages(), pageManager.getCurrentPageIndex(), uiCallbacks.onPageSwitch);
                controllerCallbacks.onStateChanged();
            }
        },
        onCopyPage: () => {
             pageManager.copyCurrentPageToClipboard();
             uiManager.setPasteButtonEnabled(pageManager.hasCopiedPage());
        },
        onPastePage: () => {
            undoManager.recordAction(pageManager.getCurrentPageDrawables(), "Paste Page");
            pageManager.pastePageFromClipboard();
            if(networkManager.isConnected){
                 const payload = {
                    pageIndex: pageManager.getCurrentPageIndex(),
                    action: PayloadActionType.ReplacePage,
                    data: DrawableSerializer.serializePageToBytes(pageManager.getCurrentPageDrawables())
                };
                networkManager.sendStateUpdateAsync(payload);
            }
            setTimeout(() => {
                controllerCallbacks.onStateChanged();
            }, 0);
        },
        onPageSwitch: (index) => {
            pageManager.switchToPage(index);
            undoManager.clearHistory();
            appState.selectedDrawables = [];
            canvasController.setCurrentPageDrawables(pageManager.getCurrentPageDrawables());
            uiManager.renderPageTabs(pageManager.getAllPages(), pageManager.getCurrentPageIndex(), uiCallbacks.onPageSwitch);
            controllerCallbacks.onStateChanged();
        },
        onConnect: () => {
            const passphrase = uiManager.getPassphraseInput();
            if (passphrase) {
                uiManager.updateConnectionStatus("Connecting...");
                networkManager.connectAsync('wss://aetherdraw-server.onrender.com/ws', passphrase);
            }
        },
        onDisconnect: () => networkManager.disconnectAsync(),
        isNetworkConnected: () => networkManager.isConnected,
        onSavePlan: async () => {
            try {
                const allPages = pageManager.getAllPages();
                const planData = PlanSerializer.serializePlanToBytes(allPages, "My Saved Plan");

                uiManager.showSavingStatus("Saving...");
                const response = await fetch('https://aetherdraw-server.onrender.com/plan/save', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/octet-stream' },
                    body: planData
                });

                if (!response.ok) {
                    throw new Error(`Server responded with status: ${response.status}`);
                }

                const result = await response.json();
                const planId = result.id;
                
                const newUrl = `${window.location.origin}${window.location.pathname}?plan=${planId}`;
                window.history.pushState({ path: newUrl }, '', newUrl);
                
                navigator.clipboard.writeText(newUrl);
                uiManager.showSavingStatus("Saved! Link copied to clipboard.");

            } catch (error) {
                console.error("Failed to save plan:", error);
                uiManager.showSavingStatus("Error saving plan.");
            }
        },
    };

    const controllerCallbacks = {
        onDrawingStarted: () => {
            undoManager.recordAction(pageManager.getCurrentPageDrawables());
        },
        onDrawingCancelled: () => {
            const undoneState = undoManager.undo();
            if (undoneState) {
                pageManager.setCurrentPageDrawables(undoneState);
            }
            controllerCallbacks.onStateChanged();
        },
        onObjectAdded: (drawable, isAtomic = false) => {
            if (isAtomic) {
                undoManager.recordAction(pageManager.getCurrentPageDrawables());
            }
            pageManager.getCurrentPageDrawables().push(drawable);
            
            // Add the new object's ID to the ignore list to prevent echo.
            pendingEchoIds.add(drawable.uniqueId);
            setTimeout(() => pendingEchoIds.delete(drawable.uniqueId), 500);

            if (networkManager.isConnected) {
                const payload = {
                    pageIndex: pageManager.getCurrentPageIndex(),
                    action: PayloadActionType.AddObjects,
                    data: DrawableSerializer.serializePageToBytes([drawable]),
                };
                networkManager.sendStateUpdateAsync(payload);
            }
            controllerCallbacks.onStateChanged();
        },
        onRequestBackgroundUrl: () => {
            console.log("[App] Background URL request initiated. Showing modal.");
            uiManager.showBackgroundUrlModal((url) => {
                console.log(`[App] Received URL for background: ${url}`);
                undoManager.recordAction(pageManager.getCurrentPageDrawables(), "Import Background");

                // Get the current canvas size to make the background fit.
                const stage = canvasManager.getStage();
                const canvasSize = { width: stage.width(), height: stage.height() };
                const canvasCenter = { x: canvasSize.width / 2, y: canvasSize.height / 2 };

                const backgroundImage = new DrawableImage(
                    DrawMode.Image,
                    url,
                    canvasCenter,
                    canvasSize,
                    { r: 1, g: 1, b: 1, a: 1 },
                    0
                );
                
                pageManager.setBackgroundImage(backgroundImage);

                if (networkManager.isConnected) {
                    console.log("[App] Live session active, sending ReplacePage payload for new background.");
                    const payload = {
                        pageIndex: pageManager.getCurrentPageIndex(),
                        action: PayloadActionType.ReplacePage,
                        data: DrawableSerializer.serializePageToBytes(pageManager.getCurrentPageDrawables())
                    };
                    networkManager.sendStateUpdateAsync(payload);
                }

                // Trigger a full re-render to show the new background.
                controllerCallbacks.onStateChanged();
            });
        },
        onStateChanged: (isQuickUpdate = false, previewDrawable = null) => {
            const currentDrawables = pageManager.getCurrentPageDrawables();
            canvasController.setCurrentPageDrawables(currentDrawables);
            canvasManager.renderPage(currentDrawables, isQuickUpdate, previewDrawable);
            canvasManager.updateSelection(appState.selectedDrawables);
        },
        getToolDetails: (toolName) => uiManager.getModeDetailsByToolName(toolName),
        onBeginTextEdit: (drawable, konvaShape) => {
            // This function is called to open the text editor UI
            inPlaceTextEditor.beginInPlaceEdit(drawable, konvaShape, canvasManager.getStage());
        },
        findKonvaShape: (id) => {return canvasManager.findShapeById(id);
        },
        onNewShapeDrawn: (shape) => {
        console.log("app.js: onNewShapeDrawn callback triggered.");
        canvasManager.addTemporaryShape(shape);
        },
        onObjectDeleted: (deletedObjectIds) => {
             // Get the current state *before* any changes are made.
            const drawables = pageManager.getCurrentPageDrawables();
            // ALWAYS record this state to the undo stack.
            undoManager.recordAction(drawables, "Erase Object(s)");

            if (networkManager.isConnected) {
                // In a live session, just tell the server what to delete.
                const payload = {
                    pageIndex: pageManager.getCurrentPageIndex(),
                    action: PayloadActionType.DeleteObjects,
                    data: PlanSerializer.serializeGuids(deletedObjectIds)
                };
                networkManager.sendStateUpdateAsync(payload);
                // The server's echo will handle the deletion and Undo history.
            } else {
                // If not connected, perform deletion and record Undo locally.
                const newDrawables = drawables.filter(d => !deletedObjectIds.includes(d.uniqueId));
                pageManager.setCurrentPageDrawables(newDrawables);
                controllerCallbacks.onStateChanged();
            }
        }
        
    };
    
    const interactionHandlerCallbacks = {
        onObjectsCommitted: (modifiedDrawables) => {
            if (modifiedDrawables && modifiedDrawables.length > 0) {
                modifiedDrawables.forEach(d => {
                    pendingEchoIds.add(d.uniqueId);
                    setTimeout(() => pendingEchoIds.delete(d.uniqueId), 500);
                });

                if (networkManager.isConnected) {
                    console.log('SENDER: Committing object with ID:', modifiedDrawables[0].uniqueId);
                    const payload = {
                        pageIndex: pageManager.getCurrentPageIndex(),
                        action: PayloadActionType.UpdateObjects,
                        data: DrawableSerializer.serializePageToBytes(modifiedDrawables),
                    };
                    networkManager.sendStateUpdateAsync(payload);
                }
            }
            // The final re-render after committing data is still needed.
            controllerCallbacks.onStateChanged(false);
        },
        onObjectsUpdatedLive: (modifiedDrawables) => {
            // Live updates during a drag must trigger a full re-render,
            // not a quick/preview render, to ensure state consistency.
            controllerCallbacks.onStateChanged(false); 
        },
        onSelectionChange: (newSelection) => {
            if (inPlaceTextEditor.isEditing()) {
                 inPlaceTextEditor.endInPlaceEdit(true); // Commit changes on deselection
            }
            appState.selectedDrawables = newSelection;
            // Show/hide side panel based on selection
            if (newSelection.length === 1 && newSelection[0] instanceof DrawableText) {
                inPlaceTextEditor.showSidePanel(newSelection[0]);
            } else {
                inPlaceTextEditor.hideSidePanel();
            }
           
            // controllerCallbacks.onStateChanged(); // This causes a full re-render, which breaks the drag event stream.
            // canvasManager.updateSelection(appState.selectedDrawables); // This still modifies the DOM synchronously, interrupting the event stream.
            
            // By deferring the selection update, we allow the mousedown event to complete before changing the DOM.
            setTimeout(() => {
                canvasManager.updateSelection(appState.selectedDrawables);
            }, 0);
        },
        onDeselectAll: () => {
            appState.selectedDrawables = [];
            inPlaceTextEditor.hideSidePanel();
            controllerCallbacks.onStateChanged();
        }
    };

    networkManager.onConnected = () => {
        pageManager.enterLiveMode(); // creates a default page with waymarks
        uiManager.updateConnectionStatus("Connected");
        uiManager.hideLiveModal();
        // Send the new default page as a "candidate" for the initial room state,
        // mimicking the C# client's behavior in MainWindow.cs.
        setTimeout(() => {
            const currentPageDrawables = pageManager.getCurrentPageDrawables();
            if (currentPageDrawables && currentPageDrawables.length > 0) {
                const payload = {
                    pageIndex: pageManager.getCurrentPageIndex(),
                    action: PayloadActionType.ReplacePage,
                    data: DrawableSerializer.serializePageToBytes(currentPageDrawables)
                };
                networkManager.sendStateUpdateAsync(payload);
            }
        }, 100); // A small 100ms delay is sufficient.

        uiCallbacks.onPageSwitch(0);
    };
    networkManager.onDisconnected = () => {
        pageManager.exitLiveMode();
        uiManager.updateConnectionStatus("Disconnected");
        uiCallbacks.onPageSwitch(0);
    };
    networkManager.onError = (err) => uiManager.updateConnectionStatus(`Error: ${err}`);
    networkManager.onStateUpdateReceived = (payload) => {
        initialStateReceived = true;
        const allPages = pageManager.getAllPages();
        if (payload.pageIndex < 0) return;

        if (payload.action === PayloadActionType.ReplacePage || payload.action === PayloadActionType.AddNewPage) {
            while (allPages.length <= payload.pageIndex) {
                pageManager.addNewPage(false);
            }
        }

        // Abort if the page index is still invalid after attempting to add pages.
        if (payload.pageIndex < 0 || payload.pageIndex >= allPages.length) {
             console.warn(`Received state update for invalid page index: ${payload.PageIndex}`);
             return;
        }

         // Re-define the targetPageDrawables variable so the switch statement can use it.
        const targetPageDrawables = allPages[payload.pageIndex].drawables;

        switch (payload.action) {
            case PayloadActionType.AddObjects: { 
                const receivedObjects = DrawableSerializer.deserializePageFromBytes(payload.data);
                const filteredObjects = receivedObjects.filter(obj => !pendingEchoIds.has(obj.uniqueId));
                if (filteredObjects.length > 0) {
                    targetPageDrawables.push(...filteredObjects);
                } else {
                    return;
                }
                break;
            } 

            case PayloadActionType.DeleteObjects: { 
                const guidsToDelete = PlanSerializer.deserializeGuids(payload.data);
                for (let i = targetPageDrawables.length - 1; i >= 0; i--) {
                    if (guidsToDelete.includes(targetPageDrawables[i].uniqueId)) {
                        targetPageDrawables.splice(i, 1);
                    }
                }
                break;
            } 

            case PayloadActionType.UpdateObjects: {
                const updatedObjects = DrawableSerializer.deserializePageFromBytes(payload.data);
                const filteredObjects = updatedObjects.filter(updatedObj =>
                    !pendingEchoIds.has(updatedObj.uniqueId)
                );
                if (filteredObjects.length < updatedObjects.length) {
                    console.log("[Network] Ignored echo for updated object(s).");
                }
                if (filteredObjects.length > 0) {
                    filteredObjects.forEach(updatedObj => {
                        console.log('RECEIVER: Received update for ID:', updatedObj.uniqueId);
                        console.log('RECEIVER: Searching for match in these IDs:', targetPageDrawables.map(d => d.uniqueId));
                        const index = targetPageDrawables.findIndex(d => d.uniqueId === updatedObj.uniqueId);
                        if (index !== -1) {
                            targetPageDrawables[index] = updatedObj;
                        } else {
                            // If the object doesn't exist, add it. This handles out-of-order messages.
                            targetPageDrawables.push(updatedObj);
                        }
                    });
                } else {
                    return;
                }
                break;
            }
            case PayloadActionType.ClearPage:
                targetPageDrawables.length = 0;
                break;
            
            case PayloadActionType.ReplacePage:
                allPages[payload.pageIndex].drawables = DrawableSerializer.deserializePageFromBytes(payload.data);
                break;
            // handle page management commands from the server.
            case PayloadActionType.AddNewPage:
                // need to refresh the UI.
                uiManager.renderPageTabs(allPages, pageManager.getCurrentPageIndex(), uiCallbacks.onPageSwitch);
                break;
            case PayloadActionType.DeletePage:
                pageManager.deleteCurrentPage(); // handle the local deletion
                uiManager.renderPageTabs(allPages, pageManager.getCurrentPageIndex(), uiCallbacks.onPageSwitch);
                break;
        }

        if (payload.pageIndex === pageManager.getCurrentPageIndex()) {
            controllerCallbacks.onStateChanged();
        }
    };


    const canvasCallbacks = {
        onCanvasMouseDown: (e) => {
            if (inPlaceTextEditor.isEditing()) return;
            const isShapeClick = e.target !== e.target.getStage();

            if (appState.currentToolName === 'Select') {
                if (isShapeClick) {
                    // Call the new handler for preparing a drag.
                    shapeInteractionHandler.handleDragInitiation(e);
                } else {
                    shapeInteractionHandler.startMarqueeSelection(e);
                }
            } else {
                canvasController.handleMouseDown(e);
            }
        },
        onCanvasMouseMove: (e) => {
            // This now correctly handles the drag threshold logic.
            shapeInteractionHandler.handleCustomDrag(e);
            
            if (shapeInteractionHandler.isMarqueeSelecting()) {
                const stage = e.target.getStage();
                if (stage) {
                    const startPos = shapeInteractionHandler.getMarqueeStartPos();
                    const endPos = stage.getPointerPosition();
                    canvasManager.updateMarqueeVisual(startPos, endPos);
                }
            }
            else if (!shapeInteractionHandler.isDragging()) { // Prevent drawing while dragging
                canvasController.handleMouseMove(e);
            }
        },
        onCanvasMouseUp: (e) => {
            if (shapeInteractionHandler.isMarqueeSelecting()) {
                shapeInteractionHandler.finalizeMarqueeSelection(e);
                canvasManager.hideMarqueeVisual();
            }
            canvasController.handleMouseUp(e);
            // This now correctly finalizes either a click or a drag.
            shapeInteractionHandler.handleDragTermination(e);
        },
        onBeginTextEdit: controllerCallbacks.onBeginTextEdit,
        onObjectCommitted: (drawables) => {
            interactionHandlerCallbacks.onObjectsCommitted(drawables);
        }
    };
    
    // Helper function for color changes
    function hexToRgbaObject(hex) {
        if (!hex || hex.length < 4) return { r: 1, g: 1, b: 1, a: 1 };
        const r = parseInt(hex.slice(1, 3), 16) / 255;
        const g = parseInt(hex.slice(3, 5), 16) / 255;
        const b = parseInt(hex.slice(5, 7), 16) / 255;
        return { r, g, b, a: 1.0 };
    }

    uiManager.initialize(uiCallbacks);
    undoManager.clearHistory();
    pageManager.initialize();
    
    TextureManager.initialize({onLoad: () => {controllerCallbacks.onStateChanged();}});
    canvasManager.initialize(canvasCallbacks);
    canvasController.initialize(appState, controllerCallbacks, pageManager.getCurrentPageDrawables(), uiCallbacks.onToolSelect);
    shapeInteractionHandler.initialize(undoManager, pageManager, appState, interactionHandlerCallbacks);
    inPlaceTextEditor.initialize(undoManager, pageManager, {
        onStateChanged: controllerCallbacks.onStateChanged,
        onUpdateObject: (drawable) => interactionHandlerCallbacks.onObjectsCommitted([drawable]),
        onDeselectAll: interactionHandlerCallbacks.onDeselectAll
    });

    const loadPlanFromUrl = async () => {
        const urlParams = new URLSearchParams(window.location.search);
        const planId = urlParams.get('plan');

        if (planId) {
            try {
                console.log(`[App] Found plan ID in URL, attempting to load: ${planId}`);
                const response = await fetch(`https://aetherdraw-server.onrender.com/plan/load/${planId}`);
                if (!response.ok) throw new Error(`Server responded with status: ${response.status}`);
                    
                const planDataBytes = await response.arrayBuffer();
                const deserializedPlan = PlanSerializer.deserializePlanFromBytes(planDataBytes);
                    
                if (deserializedPlan && deserializedPlan.pages) {
                    pageManager.loadPages(deserializedPlan.pages);
                    uiCallbacks.onPageSwitch(0); // Render the first page of the loaded plan
                    console.log("[App] Successfully loaded and rendered plan from URL.");
                } else {
                    throw new Error("Failed to deserialize plan data.");
                }
            } catch (error) {
                console.error("Failed to load plan from URL:", error);
                uiCallbacks.onPageSwitch(0); // Load default page on error
            }
        } else {
            uiCallbacks.onPageSwitch(0); // Load default page if no plan ID is in the URL
        }
    };
    loadPlanFromUrl();

    //debug only remove for live:
    window.controllerCallbacks = controllerCallbacks;
});