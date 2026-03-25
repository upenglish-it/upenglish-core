/**
 * SPerStudy Game SDK v1.0
 * Include this file in every mini-game to communicate with the SPerStudy app.
 * 
 * Usage:
 *   <script src="game-sdk.js"></script>
 *   <script>
 *     SuperStudySDK.onData((data) => {
 *       // data.dataType = "vocabulary" | "grammar"
 *       // data.words = [...] (if vocabulary)
 *       // data.questions = [...] (if grammar)
 *       startGame(data);
 *     });
 *   </script>
 */
(function () {
    'use strict';

    window.SuperStudySDK = {
        _data: null,
        _onDataCallbacks: [],

        /**
         * Register a callback to receive game data from SPerStudy.
         * If data has already been received, the callback fires immediately.
         * @param {Function} callback - function(data) where data contains words or questions
         */
        onData: function (callback) {
            if (typeof callback !== 'function') return;
            if (this._data) {
                callback(this._data);
            } else {
                this._onDataCallbacks.push(callback);
            }
        },

        /**
         * Notify the parent app that the game has finished.
         * This is optional — the app will show a "Play Again" or "Close" button.
         * @param {Object} summary - optional summary object (not saved to DB)
         */
        notifyComplete: function (summary) {
            try {
                window.parent.postMessage({
                    type: 'GAME_COMPLETE',
                    summary: summary || {}
                }, '*');
            } catch (e) {
                // Silently fail if parent is not accessible
            }
        },

        /**
         * Request the parent app to reload data (e.g. for "Play Again" with same data).
         */
        requestReload: function () {
            try {
                window.parent.postMessage({ type: 'GAME_REQUEST_RELOAD' }, '*');
            } catch (e) {
                // Silently fail
            }
        }
    };

    // Listen for data from the parent SPerStudy app
    window.addEventListener('message', function (event) {
        if (event.data && event.data.type === 'GAME_DATA') {
            window.SuperStudySDK._data = event.data;
            window.SuperStudySDK._onDataCallbacks.forEach(function (cb) {
                try { cb(event.data); } catch (e) { console.error('SDK callback error:', e); }
            });
            window.SuperStudySDK._onDataCallbacks = [];
        }
    });
})();
