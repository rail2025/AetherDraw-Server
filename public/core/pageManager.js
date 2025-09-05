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
            { mode: DrawMode.WaymarkAImage, path: "icons/A.png", angle: 3 * Math.PI / 2 },
            { mode: DrawMode.WaymarkBImage, path: "icons/B.png", angle: 0 },
            { mode: DrawMode.WaymarkCImage, path: "icons/C.png", angle: Math.PI / 2 },
            { mode: DrawMode.WaymarkDImage, path: "icons/D.png", angle: Math.PI },
            { mode: DrawMode.Waymark1Image, path: "icons/1_waymark.png", angle: 5 * Math.PI / 4 },
            { mode: DrawMode.Waymark2Image, path: "icons/2_waymark.png", angle: 7 * Math.PI / 4 },
            { mode: DrawMode.Waymark3Image, path: "icons/3_waymark.png", angle: Math.PI / 4 },
            { mode: DrawMode.Waymark4Image, path: "icons/4_waymark.png", angle: 3 * Math.PI / 4 }
        ];

        const whiteTint = { r: 1, g: 1, b: 1, a: 1 };

        waymarksToPreload.forEach(wm => {
            const x = canvasCenter.x + waymarkPlacementRadius * Math.cos(wm.angle);
            const y = canvasCenter.y + waymarkPlacementRadius * Math.sin(wm.angle);
            const drawableImage = new DrawableImage(wm.mode, wm.path, {x, y}, waymarkImageUnscaledSize, whiteTint, 0);
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
            livePages = [_createDefaultPage("1")];
            currentPageIndex = 0;
        },

        exitLiveMode: function () {
            isLiveMode = false;
            currentPageIndex = 0;
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
            this.pageClipboard = JSON.parse(JSON.stringify(sourcePage));
        },

        pastePageFromClipboard: function () {
            const pages = _getPages();
            if (!this.pageClipboard || pages.length === 0 || currentPageIndex < 0 || currentPageIndex >= pages.length) return false;

            const targetPage = pages[currentPageIndex];
            const clonedDrawables = JSON.parse(JSON.stringify(this.pageClipboard.drawables));
            targetPage.drawables = cloned.Drawables;
            return true;
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
            pages.push(...loadedPagesData);
            currentPageIndex = 0;
            if (pages.length === 0) {
                _initializeDefaultPage();
            }
        }
    };
})();