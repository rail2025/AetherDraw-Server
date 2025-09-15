// pageManager.js

const PageManager = (function () {
    let localPages = [];
    let livePages = [];
    let currentPageIndex = 0;
    let pageClipboard = null;

    let isLiveMode = false;

    function _createDefaultPage(name) {
        const newPage = { name: name, drawables: [] };

        const logicalRefCanvasWidth = (850 * 0.75) - 125;
        const logicalRefCanvasHeight = 550;
        const canvasCenter = { x: logicalRefCanvasWidth / 2, y: logicalRefCanvasHeight / 2 };
        const waymarkPlacementRadius = Math.min(logicalRefCanvasWidth, logicalRefCanvasHeight) * 0.40;
        const waymarkImageUnscaledSize = { width: 30, height: 30 };

        const waymarksToPreload = [
            { toolName: 'WaymarkAImage', angle: 3 * Math.PI / 2 },
            { toolName: 'WaymarkBImage', angle: 0 },
            { toolName: 'WaymarkCImage', angle: Math.PI / 2 },
            { toolName: 'WaymarkDImage', angle: Math.PI },
            { toolName: 'Waymark1Image', angle: 5 * Math.PI / 4 },
            { toolName: 'Waymark2Image', angle: 7 * Math.PI / 4 },
            { toolName: 'Waymark3Image', angle: Math.PI / 4 },
            { toolName: 'Waymark4Image', angle: 3 * Math.PI / 4 }
        ];

        const whiteTint = { r: 1, g: 1, b: 1, a: 1 };

        waymarksToPreload.forEach(wm => {
            const details = UIManager.getModeDetailsByToolName(wm.toolName);
            if (!details || !details.pluginResourcePath) return;

            const x = canvasCenter.x + waymarkPlacementRadius * Math.cos(wm.angle);
            const y = canvasCenter.y + waymarkPlacementRadius * Math.sin(wm.angle);

            const drawableImage = new DrawableImage(
                DrawMode[wm.toolName],
                details.pluginResourcePath,
                { x, y },
                waymarkImageUnscaledSize,
                whiteTint,
                0
            );
            newPage.drawables.push(drawableImage);
        });
        return newPage;
    }

    function _initializeDefaultPage() {
        if (localPages.length === 0) {
            localPages.push(_createDefaultPage("1"));
            currentPageIndex = 0;
        }
    }

    function _getPages() {
        return isLiveMode ? livePages : localPages;
    }

    return {
        initialize: function () {
            _initializeDefaultPage();
        },

        enterLiveMode: function () {
            isLiveMode = true;
            livePages.length = 0;
            livePages.push(_createDefaultPage("1"));
            currentPageIndex = 0;
            console.log("[PageManager] Entered live mode. Created initial live page with default layout.");
        },

        exitLiveMode: function () {
            isLiveMode = false;
            currentPageIndex = 0;
        },
        
        // NEW: Function to be called by the host client to seed the session.
        createDefaultWaymarks: function() {
            const pages = _getPages();
            if (pages.length > 0 && currentPageIndex >= 0 && currentPageIndex < pages.length) {
                const currentPage = pages[currentPageIndex];
                const defaultPageWithWaymarks = _createDefaultPage(currentPage.name);
                
                // Mutate the array to populate the blank page.
                currentPage.drawables.length = 0;
                currentPage.drawables.push(...defaultPageWithWaymarks.drawables);
            }
        },

        getAllPages: _getPages,

        getCurrentPageIndex: function () {
            return currentPageIndex;
        },

        getCurrentPageDrawables: function () {
            const pages = _getPages();
            if (pages.length > 0 && currentPageIndex >= 0 && currentPageIndex < pages.length) {
                return pages[currentPageIndex].drawables;
            }
            return [];
        },

        setCurrentPageDrawables: function (drawables) {
            const pages = _getPages();
            if (pages.length > 0 && currentPageIndex >= 0 && currentPageIndex < pages.length) {
                pages[currentPageIndex].drawables = drawables;
            } else if (isLiveMode && pages.length === 0) {
                const newPage = { name: "1", drawables: drawables };
                pages.push(newPage);
                currentPageIndex = 0;
            }
        },
        setBackgroundImage: function(backgroundImageDrawable) {
            console.log("[PageManager] Setting new background image.", backgroundImageDrawable);
            const drawables = this.getCurrentPageDrawables();
            if (!drawables) return;

            // Filter out any existing background image (identified by DrawMode.Image)
            const drawablesWithoutBackground = drawables.filter(d => d.objectDrawMode !== DrawMode.Image);
            console.log(`[PageManager] Removed ${drawables.length - drawablesWithoutBackground.length} existing background(s).`);

            // Add the new background to the beginning of the array so it renders first (behind everything)
            drawablesWithoutBackground.unshift(backgroundImageDrawable);
            
            this.setCurrentPageDrawables(drawablesWithoutBackground);
            console.log("[PageManager] New drawable list with background:", this.getCurrentPageDrawables());
        },
        clearCurrentPageDrawables: function() {
            const pages = _getPages();
            if (pages.length > 0 && currentPageIndex >= 0 && currentPageIndex < pages.length) {
                pages[currentPageIndex].drawables.length = 0; // .Clear() equivalent
                if (pages.length === 1 && currentPageIndex === 0) {
                    pages[currentPageIndex].name = "1";
                }
            }
        },

        findTopmostDrawableAt: function(point, threshold) {
            const drawables = this.getCurrentPageDrawables();
            // Iterate backwards to find the topmost object (last drawn)
            for (let i = drawables.length - 1; i >= 0; i--) {
                if (drawables[i].isHit(point, threshold)) {
                    return drawables[i];
                }
            }
            return null;
        },

        addNewPage: function (switchToPage = true) {
            const pages = _getPages();
            const existingNumbers = pages.map(p => parseInt(p.name, 10)).filter(n => !isNaN(n));
            const newPageNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : 1;
            pages.push(_createDefaultPage(String(newPageNumber)));

            if (switchToPage) {
                this.switchToPage(pages.length - 1);
            }
            return true;
        },

        deleteCurrentPage: function () {
            const pages = _getPages();
            if (pages.length <= 1) return false;
            pages.splice(currentPageIndex, 1);
            currentPageIndex = Math.max(0, Math.min(currentPageIndex, pages.length - 1));
            return true;
        },

        hasCopiedPage: function () {
            return pageClipboard != null;
        },

        copyCurrentPageToClipboard: function () {
            const pages = _getPages();
            if (pages.length === 0 || currentPageIndex < 0 || currentPageIndex >= pages.length) return;
            const sourcePage = pages[currentPageIndex];

            // Create a new clipboard object with proper clones.
            pageClipboard = {
                name: sourcePage.name,
                drawables: sourcePage.drawables.map(d => d.clone())
            };
        },

        pastePageFromClipboard: function () {
            const pages = _getPages();
            if (!pageClipboard || pages.length === 0 || currentPageIndex < 0 || currentPageIndex >= pages.length) return false;
            
            const targetPage = pages[currentPageIndex];
            
            // Clones are perfect copies. We clone them again on paste
            // to ensure you can paste multiple times without issue.
            const newDrawables = pageClipboard.drawables.map(d => d.clone());

            // Replace the current page's content with the new clones.
            targetPage.drawables = newDrawables;

            return true;
        },

        switchToPage: function (newPageIndex, forceSwitch = false) {
            const pages = _getPages();
            if (newPageIndex < 0 || newPageIndex >= pages.length) return false;
            if (!forceSwitch && newPageIndex === currentPageIndex) return true;
            currentPageIndex = newPageIndex;
            return true;
        },

        loadPages: function (loadedPagesData) {
            const pages = _getPages();
            pages.length = 0;
            loadedPagesData.forEach(page => {
                if (page.drawables && Array.isArray(page.drawables)) {
                    page.drawables = page.drawables.map(state => DrawableFactory.createFromState(state));
                }
            });
            pages.push(...loadedPagesData);
            currentPageIndex = 0;
            if (pages.length === 0) {
                _initializeDefaultPage();
            }
        }
    };
})();