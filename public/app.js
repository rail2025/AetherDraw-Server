document.addEventListener('DOMContentLoaded', () => {
    console.log("AetherDraw: DOM content loaded. Initializing application.");

    const state = {
        pages: [],
        currentPageIndex: 0,
        pageClipboard: null,
        currentToolName: 'select',
        currentDrawMode: 9, // Corresponds to DrawMode.Select
        brushColor: '#FFFFFF',
        brushWidth: 4,
        isShapeFilled: false,
    };

    const network = new NetworkManager();

    // Map from web tool names to their corresponding enum values
    const toolNameToDrawMode = {
        pen: 0, line: 1, rectangle: 2, circle: 3, arrow: 4, cone: 5, dash: 6, donut: 7, triangle: 8,
        select: 9, eraser: 10,
        squareImage: 33, circleMarkImage: 35, triangleImage: 32, plusImage: 34,
        tankImage: 28, healerImage: 29, meleeImage: 30, rangedImage: 31,
        party1Image: 36, party2Image: 37, party3Image: 38, party4Image: 39,
        party5Image: 40, party6Image: 41, party7Image: 42, party8Image: 43,
        waymarkAImage: 24, waymarkBImage: 25, waymarkCImage: 26, waymarkDImage: 27,
        waymark1Image: 20, waymark2Image: 21, waymark3Image: 22, waymark4Image: 23,
        text: 44, emoji: 12,
        stackImage: 19, spreadImage: 18, lineStackImage: 17, flareImage: 16,
        donutAoEImage: 15, circleAoEImage: 14, bossImage: 13,
        dot1Image: 50, dot2Image: 51, dot3Image: 52, dot4Image: 53,
        dot5Image: 54, dot6Image: 55, dot7Image: 56, dot8Image: 57
    };
    
    // NEW: Map from web tool names to the C# plugin's embedded resource paths
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
        tankImage: 'PluginImages.toolbar.Tank.JPG',
        healerImage: 'PluginImages.toolbar.Healer.JPG',
        meleeImage: 'PluginImages.toolbar.Melee.JPG',
        rangedImage: 'PluginImages.toolbar.Ranged.JPG',
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

    // NEW: Reverse map for deserialization, built dynamically after UI is initialized
    let pluginResourcePathToToolName = {};

    const app = {
        getCurrentPage: () => state.pages[state.currentPageIndex],

        onUndo: () => {
            console.log("Undo action triggered.");
        },
        onClearAll: () => {
            console.log("Clear All action triggered.");
            const page = app.getCurrentPage();
            if (page) {
                page.drawables = [];
                CanvasManager.renderPage(page);
            }
        },
        onToolSelect: (toolName) => {
            state.currentToolName = toolName;
            state.currentDrawMode = toolNameToDrawMode[toolName];
            console.log(`Tool selected: ${toolName}, DrawMode: ${state.currentDrawMode}`);
            CanvasManager.updateSelectionMode(state.currentToolName === 'select');
            UIManager.updateToolbar(state);
        },
        onCanvasMouseDown: (pointer, target) => {
            const toolDetails = UIManager.getModeDetailsByToolName(state.currentToolName);

            if (toolDetails && toolDetails.icon) {
                const pluginResourcePath = toolNameToPluginResourcePath[state.currentToolName];
                if (!pluginResourcePath) {
                    console.error(`AetherDraw Error: No pluginResourcePath found for tool '${state.currentToolName}'. Check toolNameToPluginResourcePath map.`);
                    return;
                }
                console.log(`Placing image: ${state.currentToolName} with local URL '${toolDetails.icon}' and plugin path '${pluginResourcePath}'`);
                CanvasManager.placeImage(pointer, toolDetails.icon, state.currentToolName, state.currentDrawMode, pluginResourcePath);
                app.onToolSelect('select');
            }
            else if (state.currentToolName !== 'select') {
                const options = {
                    drawMode: state.currentDrawMode,
                    color: state.brushColor,
                    strokeWidth: state.brushWidth,
                    fill: state.isShapeFilled ? state.brushColor : 'transparent'
                };
                CanvasManager.startDrawing(state.currentToolName, pointer, options);
            }
        },
        onObjectAdded: (drawable, preventRerender = false) => {
            if (!drawable) {
                console.error("AetherDraw Error: onObjectAdded received a null drawable.");
                return;
            }
            console.log("Local: Adding object to page", drawable);
            app.getCurrentPage().drawables.push(drawable);

            // MODIFIED: Send new object over the network if connected
            if (network.isConnected()) {
                try {
                    console.log("Network: Preparing to send new object", drawable);
                    const objectBytes = serializePageToBytes([drawable]); 
                    const payload = {
                        pageIndex: state.currentPageIndex,
                        action: PayloadActionType.AddObjects,
                        data: objectBytes,
                    };
                    network.sendStateUpdate(payload);
                    console.log("Network: New object sent successfully.");
                } catch (ex) {
                    console.error("AetherDraw Error: Failed to serialize and send new object.", ex);
                }
            }

            if (!preventRerender) {
                CanvasManager.renderPage(app.getCurrentPage());
            }
        },
        onObjectModified: (drawable) => {
            console.log("Object modified:", drawable);
        },
        onObjectsDeleted: (ids) => {
            console.log("Objects deleted:", ids);
        },
        onAddPage: () => {
            const newPageName = (state.pages.length + 1).toString();
            state.pages.push({ name: newPageName, drawables: [], undoStack: [] });
            app.onPageSwitch(state.pages.length - 1);
        },
        onPageSwitch: (index) => {
            if (index >= 0 && index < state.pages.length) {
                state.currentPageIndex = index;
                console.log(`Switched to page index ${index}`);
                CanvasManager.renderPage(app.getCurrentPage());
                UIManager.renderPageTabs(state.pages, state.currentPageIndex, app.onPageSwitch);
            } else {
                console.error(`AetherDraw Error: Attempted to switch to invalid page index ${index}.`);
            }
        },
        onDeletePage: () => {
            if (state.pages.length > 1) {
                state.pages.splice(state.currentPageIndex, 1);
                const newIndex = Math.min(state.pages.length - 1, state.currentPageIndex);
                app.onPageSwitch(newIndex);
            }
        },
        onColorChange: (color) => { state.brushColor = color; UIManager.updateToolbar(state); },
        onThicknessChange: (thickness) => { state.brushWidth = thickness; UIManager.updateToolbar(state); },
        onFillToggle: () => { state.isShapeFilled = !state.isShapeFilled; UIManager.updateToolbar(state); },
        onConnect: () => {
            const passphrase = UIManager.getPassphraseInput();
            if (passphrase) {
                UIManager.updateConnectionStatus("Connecting...");
                network.connect('wss://aetherdraw-server.onrender.com/ws', passphrase);
            }
        },
        onDisconnect: () => { network.disconnect(); },
        isNetworkConnected: () => network.isConnected(),
    };

    network.onConnected = () => { UIManager.updateConnectionStatus("Connected"); UIManager.hideLiveModal(); };
    network.onDisconnected = () => { UIManager.updateConnectionStatus("Disconnected"); };
    network.onError = (err) => { UIManager.updateConnectionStatus(`Error: ${err}`); };

    network.onStateUpdateReceived = (payload) => {
        console.log("Network: Received state update payload.", payload);
        if (!payload || payload.data === undefined) {
            console.error("AetherDraw Error: Received invalid payload.");
            return;
        }

        try {
            if (payload.action === PayloadActionType.AddObjects && payload.data) {
                const newDrawables = deserializePageFromBytes(payload.data, pluginResourcePathToToolName, UIManager.getAllModeDetails());
                console.log("Network: Deserialized new objects to add:", newDrawables);
                
                while(state.pages.length <= payload.pageIndex){
                    app.onAddPage();
                }
                state.pages[payload.pageIndex].drawables.push(...newDrawables);

                if (payload.pageIndex === state.currentPageIndex) {
                    CanvasManager.renderPage(app.getCurrentPage());
                }
            } else if (payload.action === PayloadActionType.ReplacePage && payload.data) {
                const newDrawables = deserializePageFromBytes(payload.data, pluginResourcePathToToolName, UIManager.getAllModeDetails());
                console.log("Network: Deserialized objects to replace page:", newDrawables);
                
                while(state.pages.length <= payload.pageIndex){
                    app.onAddPage();
                }
                state.pages[payload.pageIndex].drawables = newDrawables;

                if (payload.pageIndex === state.currentPageIndex) {
                    CanvasManager.renderPage(app.getCurrentPage());
                }
            }
        } catch (ex) {
            console.error("AetherDraw Error: Failed to process received network payload.", ex);
        }
    };

    const callbacks = {
        onToolSelect: app.onToolSelect,
        onUndo: app.onUndo,
        onClearAll: app.onClearAll,
        onAddPage: app.onAddPage,
        onDeletePage: app.onDeletePage,
        onPageSwitch: app.onPageSwitch,
        onColorChange: app.onColorChange,
        onThicknessChange: app.onThicknessChange,
        onFillToggle: app.onFillToggle,
        onConnect: app.onConnect,
        onDisconnect: app.onDisconnect,
        isNetworkConnected: app.isNetworkConnected,
    };

    UIManager.initialize(callbacks);
    CanvasManager.initialize({
        onObjectAdded: app.onObjectAdded,
        onObjectModified: app.onObjectModified,
        onObjectsDeleted: app.onObjectsDeleted,
        onCanvasMouseDown: app.onCanvasMouseDown,
    });
    
    // NEW: Build the reverse map for deserialization after the UI Manager is initialized
    pluginResourcePathToToolName = Object.entries(toolNameToPluginResourcePath)
        .reduce((acc, [key, value]) => {
            acc[value] = key;
            return acc;
        }, {});
    console.log("AetherDraw: Reverse map for deserialization created.", pluginResourcePathToToolName);

    app.onAddPage();
    console.log("AetherDraw: Application initialization complete.");
});