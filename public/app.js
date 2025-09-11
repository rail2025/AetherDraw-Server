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
            console.log(`[app.js] onToolSelect received tool: '${toolName}'`);
            appState.currentToolName = toolName;
            console.log(`[app.js] appState.currentToolName is now: '${appState.currentToolName}'`);
            uiManager.updateToolbar(appState);
            canvasManager.updateSelection([]);
            appState.selectedDrawables = [];
            controllerCallbacks.onStateChanged();
        },
        onColorChange: (color) => {
            appState.brushColor = color;
            uiManager.updateToolbar(appState);
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
        onStateChanged: (isQuickUpdate = false, previewDrawable = null) => {
            const currentDrawables = pageManager.getCurrentPageDrawables();

            // Give the controller the fresh, up-to-date list of objects.
            canvasController.setCurrentPageDrawables(currentDrawables);

            // Now, render the page and selection with the correct data.
            canvasManager.renderPage(currentDrawables, isQuickUpdate, previewDrawable);
            canvasManager.updateSelection(appState.selectedDrawables);
        },
        getToolDetails: (toolName) => uiManager.getModeDetailsByToolName(toolName),
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
            appState.selectedDrawables = newSelection;
            controllerCallbacks.onStateChanged();
        }
    };

    networkManager.onConnected = () => {
        pageManager.enterLiveMode(); // creates a default page with waymarks
        uiManager.updateConnectionStatus("Connected");
        uiManager.hideLiveModal();
        // The client now simply shows its local default page and waits for the server's
        // authoritative state, which will overwrite it if the room is not new.
        // This removes all race conditions and guesswork.
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
            console.log(`[app.js] Canvas mouse down detected. Current tool is: '${appState.currentToolName}'`);
            if (inPlaceTextEditor.isEditing()) return;
            
            // Determine if the click was on a shape or the empty background (the stage)
            const isShapeClick = e.target !== e.target.getStage();

            if (appState.currentToolName === 'Select') {
                // If the select tool is active, perform selection/deselection.
                if (isShapeClick) {
                    shapeInteractionHandler.handleDragInitiation(e);
                } else {
                    console.log('[DEBUG] Background click detected. Starting marquee selection.');
                    shapeInteractionHandler.startMarqueeSelection(e);
                }
            } else {
                // If ANY other tool (drawing, icon, etc.) is active,
                // let the canvasController handle it to create the new object.
                canvasController.handleMouseDown(e);
            }
        },
        onCanvasMouseMove: (e) => {
            // Pass the mousemove event to BOTH controllers.
            // Each controller has internal checks to know if it should respond.
            //canvasController.handleMouseMove(e);      // Handles drawing previews.
            //shapeInteractionHandler.handleCustomDrag(e); // Handles dragging selected objects.
            // By checking the state, we prevent the drawing controller
            // from running and creating a ghost image during a drag.
            if (shapeInteractionHandler.isDragging()) {
                shapeInteractionHandler.handleCustomDrag(e);
            } else if (shapeInteractionHandler.isMarqueeSelecting()) {
                console.log('[DEBUG] Mouse move during marquee selection.');
                const stage = e.target.getStage();
                if (stage) {
                    const startPos = shapeInteractionHandler.getMarqueeStartPos();
                    const endPos = stage.getPointerPosition();
                    canvasManager.updateMarqueeVisual(startPos, endPos);
                }
            }
            else {
                canvasController.handleMouseMove(e);
            }
        },
        onCanvasMouseUp: (e) => {
            if (shapeInteractionHandler.isMarqueeSelecting()) {
                console.log('[DEBUG] Mouse up detected. Finalizing marquee selection.');
                shapeInteractionHandler.finalizeMarqueeSelection(e);
                canvasManager.hideMarqueeVisual();
            }
            // Pass the mouseup event to BOTH controllers.
            canvasController.handleMouseUp(e);          // Finalizes a new drawing.
            shapeInteractionHandler.handleDragTermination(e); // Finalizes a drag.
        }
    };
    
    pageManager.initialize();
    undoManager.clearHistory();
    uiManager.initialize(uiCallbacks);
    TextureManager.initialize({
        onLoad: () => {
            controllerCallbacks.onStateChanged();
        }
    });
    canvasManager.initialize(canvasCallbacks, shapeInteractionHandler);
    canvasController.initialize(appState, controllerCallbacks, pageManager.getCurrentPageDrawables(), uiCallbacks.onToolSelect);
    shapeInteractionHandler.initialize(undoManager, pageManager, appState, interactionHandlerCallbacks);
    inPlaceTextEditor.initialize(undoManager, pageManager, { ...interactionHandlerCallbacks, onUpdateObject: interactionHandlerCallbacks.onObjectsModified });
    
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
});