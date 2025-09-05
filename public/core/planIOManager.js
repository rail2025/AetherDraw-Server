/**
 * AetherDraw Web - Plan IO Manager
 * Handles loading, saving, importing, and exporting plans and images.
 * Mirrors the functionality of PlanIOManager.cs.
 *
 * NOTE: This module assumes the following external dependencies will be available:
 * - `PlanSerializer`: For serializing/deserializing plan data.
 * - `RaidPlanTranslator`: For converting raidplan.io data.
 * - `pako.js`: For GZip compression/decompression (https://github.com/nodeca/pako).
 */
const PlanIOManager = (function () {
    let pageManager = null;
    let callbacks = {}; // e.g., onPlanLoadSuccess, renderPageToKonva
    let lastError = "";

    // --- Private Helper Functions for Browser-Specific IO ---

    /**
     * Creates a file download prompt in the browser.
     * @param {string} fileName The default name for the downloaded file.
     * @param {Blob} blob The data to be saved in the file.
     */
    function _promptFileDownload(fileName, blob) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    /**
     * Opens a file picker and returns the file content as an ArrayBuffer.
     * @param {string} accept A string for the 'accept' attribute (e.g., '.adp').
     * @returns {Promise<ArrayBuffer>} A promise that resolves with the file's ArrayBuffer content.
     */
    function _promptFileUpload(accept) {
        return new Promise((resolve, reject) => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = accept;
            input.onchange = e => {
                const file = e.target.files[0];
                if (!file) {
                    reject(new Error("File selection cancelled."));
                    return;
                }
                const reader = new FileReader();
                reader.onload = res => resolve(res.target.result);
                reader.onerror = err => reject(err);
                reader.readAsArrayBuffer(file);
            };
            input.click();
        });
    }

    /**
     * Converts a Base64 string to a Uint8Array.
     */
    function _base64ToBytes(base64) {
        const binStr = atob(base64);
        const len = binStr.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binStr.charCodeAt(i);
        }
        return bytes;
    }

    /**
     * Converts a Uint8Array to a Base64 string.
     */
    function _bytesToBase64(bytes) {
        let binStr = '';
        bytes.forEach((byte) => {
            binStr += String.fromCharCode(byte);
        });
        return btoa(binStr);
    }

    // --- Public API ---

    return {
        initialize: function (pm, cbs) {
            pageManager = pm;
            callbacks = cbs || {};
            console.log("PlanIOManager: Initialized.");
        },

        getLastError: function () {
            return lastError;
        },

        requestLoadPlan: async function () {
            lastError = "";
            try {
                const fileBuffer = await _promptFileUpload(".adp");
                const loadedPlan = PlanSerializer.deserializePlanFromBytes(fileBuffer);

                if (!loadedPlan || !loadedPlan.pages) {
                    throw new Error("Failed to read plan file. It may be corrupt or an incompatible version.");
                }
                pageManager.loadPages(loadedPlan.pages);
                lastError = `Plan '${loadedPlan.planName || 'Untitled'}' loaded.`;
                if (callbacks.onPlanLoadSuccess) callbacks.onPlanLoadSuccess();

            } catch (err) {
                lastError = err.message;
                console.error("[PlanIOManager] Error loading plan:", err);
            }
        },

        requestSavePlan: function () {
            lastError = "";
            const currentPages = pageManager.getAllPages();
            if (!currentPages.some(p => p.drawables.length > 0)) {
                lastError = "Nothing to save in the current plan.";
                return;
            }

            try {
                const planBytes = PlanSerializer.serializePlanToBytes(currentPages, "MyAetherDrawPlan");
                const blob = new Blob([planBytes], { type: 'application/octet-stream' });
                _promptFileDownload("MyAetherDrawPlan.adp", blob);
                lastError = "Plan saved.";
            } catch (err) {
                lastError = `Error saving plan: ${err.message}`;
                console.error("[PlanIOManager] Error saving plan:", err);
            }
        },

        copyCurrentPlanToClipboardCompressed: function () {
            lastError = "";
            try {
                const planBytes = PlanSerializer.serializePlanToBytes(pageManager.getAllPages(), "clipboard_plan");
                if (!planBytes || planBytes.length === 0) {
                    lastError = "Nothing to copy.";
                    return;
                }
                // Assumes pako.js is loaded for GZip compression
                const compressedBytes = pako.gzip(new Uint8Array(planBytes));
                const base64String = _bytesToBase64(compressedBytes);

                navigator.clipboard.writeText(base64String).then(() => {
                    lastError = "Compressed plan data copied to clipboard!";
                }).catch(err => {
                    lastError = "Could not copy to clipboard.";
                    console.error("[PlanIOManager] Clipboard write failed:", err);
                });
            } catch (err) {
                lastError = "Failed to copy plan to clipboard.";
                console.error("[PlanIOManager] Error during copy:", err);
            }
        },

        requestLoadPlanFromText: function (base64Text) {
            lastError = "";
            if (!base64Text || base64Text.trim() === '') {
                lastError = "Pasted text is empty.";
                return;
            }
            try {
                const receivedBytes = _base64ToBytes(base64Text);
                let decompressedBytes;
                try {
                    // Assumes pako.js is loaded for GZip decompression
                    decompressedBytes = pako.inflate(receivedBytes);
                } catch (e) {
                    console.warn("[PlanIOManager] Pasted data was not GZip compressed. Loading as uncompressed.");
                    decompressedBytes = receivedBytes;
                }

                const loadedPlan = PlanSerializer.deserializePlanFromBytes(decompressedBytes.buffer);
                if (!loadedPlan || !loadedPlan.pages) {
                    throw new Error("Failed to read plan data. It might be corrupt or invalid.");
                }
                pageManager.loadPages(loadedPlan.pages);
                lastError = "Plan loaded successfully from text.";
                if (callbacks.onPlanLoadSuccess) callbacks.onPlanLoadSuccess();
            } catch (err) {
                lastError = err.message;
                console.error("[PlanIOManager] Error loading from text:", err);
            }
        },

        requestLoadPlanFromUrl: async function (url) {
            lastError = "Importing from URL...";
            let correctedUrl = url.trim();
            const pastebinMatch = correctedUrl.match(/^https?:\/\/pastebin\.com\/([a-zA-Z0-9]+)$/);
            if (pastebinMatch) {
                correctedUrl = `https://pastebin.com/raw/${pastebinMatch[1]}`;
            }

            try {
                const response = await fetch(correctedUrl);
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                const content = await response.text();

                if (new URL(correctedUrl).hostname.endsWith("raidplan.io")) {
                    await this.processRaidPlan(content);
                } else {
                    this.requestLoadPlanFromText(content);
                }
            } catch (err) {
                lastError = "Could not retrieve data from URL.";
                console.error(`[PlanIOManager] Error loading from URL ${correctedUrl}:`, err);
            }
        },

        processRaidPlan: async function (htmlContent) {
            lastError = "Parsing and translating plan...";
            try {
                const parser = new DOMParser();
                const doc = parser.parseFromString(htmlContent, 'text/html');

                const imageNode = doc.querySelector("meta[property='og:image']");
                const backgroundImageUrl = imageNode ? imageNode.getAttribute('content') : null;

                const scriptNode = doc.getElementById('__NEXT_DATA__');
                const jsonData = scriptNode ? scriptNode.innerHTML.trim() : null;
                if (!jsonData) throw new Error("Could not find '__NEXT_DATA__' script block.");

                const data = JSON.parse(jsonData);
                const planJson = data?.props?.pageProps?._plan;
                if (!planJson) throw new Error("Could not find plan data in JSON structure.");

                // Assumes RaidPlanTranslator module is available
                const resultingPages = RaidPlanTranslator.translate(planJson, backgroundImageUrl);

                if (resultingPages && resultingPages.length > 0) {
                    pageManager.loadPages(resultingPages);
                    lastError = `Successfully imported ${resultingPages.length} pages.`;
                    if (callbacks.onPlanLoadSuccess) callbacks.onPlanLoadSuccess();
                } else {
                    throw new Error("Failed to translate RaidPlan data.");
                }

            } catch (err) {
                lastError = err.message;
                console.error("[PlanIOManager] Error processing RaidPlan HTML:", err);
            }
        },
        
        requestSaveImage: async function(canvasSize) {
            lastError = "";
            const pages = pageManager.getAllPages();
            if (pages.length === 0) {
                lastError = "No pages to save.";
                return;
            }
            if (!callbacks.renderPageToDataURL) {
                lastError = "Image saving callback is not configured.";
                console.error("[PlanIOManager] `renderPageToDataURL` callback is missing.");
                return;
            }
        
            let successCount = 0;
            let failureCount = 0;
            const savedFiles = [];
        
            for (let i = 0; i < pages.length; i++) {
                const pageToSave = pages[i];
                const fileName = `${i + 1}-${pageToSave.name || 'Page'}.png`;
        
                try {
                    // This function is expected to return a data URL (e.g., "data:image/png;base64,...")
                    const dataUrl = await callbacks.renderPageToDataURL(pageToSave, canvasSize);
                    
                    const blob = await (await fetch(dataUrl)).blob();
                    _promptFileDownload(fileName, blob);
        
                    successCount++;
                    savedFiles.push(fileName);
                } catch (err) {
                    console.error(`[PlanIOManager] Failed to save page '${pageToSave.name}' to '${fileName}'.`, err);
                    failureCount++;
                }
            }
        
            if (failureCount > 0) {
                lastError = `Saved ${successCount} page(s). Failed to save ${failureCount} page(s).`;
            } else if (successCount > 0) {
                lastError = `Successfully saved: ${savedFiles.join(", ")}`;
            } else {
                lastError = "No pages were processed or saved.";
            }
        }
    };
})();