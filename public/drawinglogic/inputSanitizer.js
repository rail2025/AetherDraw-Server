/**
 * AetherDraw Web - Input Sanitizer
 * Provides a utility to sanitize text input to prevent formatting issues.
 * Mirrors the functionality of InputSanitizer.cs.
 */
const InputSanitizer = (function () {

    // --- Public API ---
    return {
        /**
         * Sanitizes text input to prevent unintended formatting issues.
         * The main purpose is to break up "%%" sequences which can be misinterpreted
         * by some UI formatting libraries.
         * @param {string} inputText - The text to sanitize.
         * @returns {string} The sanitized text.
         */
        sanitize: function (inputText) {
            if (!inputText) {
                console.debug("[InputSanitizer] Sanitize: Input is null or empty, returning empty string.");
                return "";
            }

            // In C#, string.Replace() replaces all occurrences. The JS equivalent is replaceAll().
            const sanitizedText = inputText.replaceAll("%%", "% %");

            if (inputText !== sanitizedText) {
                console.debug(`[InputSanitizer] Sanitize: Text was modified.`);
            }

            return sanitizedText;
        }
    };
})();