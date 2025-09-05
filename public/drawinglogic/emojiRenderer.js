const EmojiRenderer = (function () {

    return {
        renderEmojiToDataURL: async function (emoji, size = 128) {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            const font = `${size}px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif`;
            ctx.font = font;

            const metrics = ctx.measureText(emoji);
            const width = metrics.width;
            const height = metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent;

            if (width <= 0 || height <= 0) {
                throw new Error(`Invalid emoji dimensions for character: ${emoji}`);
            }

            canvas.width = width;
            canvas.height = height;

            ctx.font = font;
            ctx.fillStyle = "#FFFFFF";
            ctx.textBaseline = 'top';
            ctx.fillText(emoji, 0, 0);

            return canvas.toDataURL();
        }
    };

})();