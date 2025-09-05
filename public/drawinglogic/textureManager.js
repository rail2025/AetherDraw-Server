const TextureManager = (function () {
    const loadedTextures = new Map();
    const pendingLoads = new Set();
    const failedDownloads = new Set();
    let onLoadCallback = () => {};

    async function _generateAndLoadEmojiTexture(emojiChar) {
        try {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const size = 64;
            canvas.width = canvas.height = size;

            ctx.font = `bold ${size * 0.8}px 'Segoe UI Emoji', 'Apple Color Emoji', sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(emojiChar, size / 2, size / 2);

            const dataUrl = canvas.toDataURL();

            return _loadFromSource(dataUrl);
        } catch (ex) {
            throw ex;
        }
    }

    function _loadFromSource(src) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error(`Failed to load image from source: ${src}`));
            img.src = src;
        });
    }

    async function _loadTextureInBackground(resourcePath) {
        if (pendingLoads.has(resourcePath)) return;

        try {
            pendingLoads.add(resourcePath);
            
            let imageElement;
            if (resourcePath.startsWith("emoji:")) {
                const emojiChar = resourcePath.substring("emoji:".length);
                imageElement = await _generateAndLoadEmojiTexture(emojiChar);
            } else {
                const url = resourcePath.startsWith("http") ? resourcePath : `./${resourcePath.replace(/\\/g, '/')}`;
                imageElement = await _loadFromSource(url);
            }

            loadedTextures.set(resourcePath, imageElement);
            onLoadCallback();

        } catch (ex) {
            failedDownloads.add(resourcePath);
        } finally {
            pendingLoads.delete(resourcePath);
        }
    }

    return {
        initialize: function(callbacks) {
            onLoadCallback = callbacks.onLoad || onLoadCallback;
        },

        getTexture: function (resourcePath) {
            if (!resourcePath) return null;
            if (failedDownloads.has(resourcePath)) return null;

            if (loadedTextures.has(resourcePath)) {
                return loadedTextures.get(resourcePath);
            }

            if (!pendingLoads.has(resourcePath)) {
                _loadTextureInBackground(resourcePath);
            }

            return null;
        },

        preloadEmojiTexture: function (emojiChar) {
            if (!emojiChar) return;
            const resourcePath = "emoji:" + emojiChar;
            if (loadedTextures.has(resourcePath) || pendingLoads.has(resourcePath)) {
                return;
            }
            _loadTextureInBackground(resourcePath);
        },
        
        dispose: function() {
            loadedTextures.clear();
            pendingLoads.clear();
            failedDownloads.clear();
        }
    };
})();