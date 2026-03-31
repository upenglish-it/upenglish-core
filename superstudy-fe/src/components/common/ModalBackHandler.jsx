import { useEffect, useRef } from 'react';

/**
 * Global component: watches for teacher-modal-overlay / admin-modal-overlay 
 * appearing in the DOM. When one appears, pushes a history state.
 * When the user presses the browser back button, the overlay is closed
 * by simulating a click on the overlay (or its close button).
 * 
 * Drop this once inside <App /> — no per-modal changes needed.
 */
export default function ModalBackHandler() {
    const isModalOpen = useRef(false);

    useEffect(() => {
        let pushed = false;

        function getOverlay() {
            return document.querySelector('.teacher-modal-overlay, .admin-modal-overlay');
        }

        function closeOverlay() {
            const overlay = getOverlay();
            if (!overlay) return;

            // Try clicking the close button first
            const closeBtn = overlay.querySelector(
                '.teacher-modal-close, .admin-modal-close, [class*="modal-close"], button[title="Đóng"]'
            );
            if (closeBtn) {
                closeBtn.click();
                return;
            }

            // Try clicking a cancel button
            const cancelBtn = overlay.querySelector(
                'button[class*="cancel"], button[class*="secondary"]'
            );
            if (cancelBtn) {
                cancelBtn.click();
                return;
            }

            // Fallback: click the overlay itself (many modals close on overlay click)
            overlay.click();
        }

        function onModalOpened() {
            if (!pushed) {
                window.history.pushState({ modal: true }, '');
                pushed = true;
                isModalOpen.current = true;
            }
        }

        function onModalClosed() {
            if (pushed) {
                pushed = false;
                isModalOpen.current = false;
                // Remove the extra history entry we pushed
                if (window.history.state?.modal) {
                    window.history.back();
                }
            }
        }

        function handlePopState() {
            if (pushed && isModalOpen.current) {
                pushed = false;
                isModalOpen.current = false;
                closeOverlay();
            }
        }

        // Check initial state
        if (getOverlay()) {
            onModalOpened();
        }

        // Watch for overlay appearing/disappearing
        const observer = new MutationObserver(() => {
            const overlay = getOverlay();
            if (overlay && !isModalOpen.current) {
                onModalOpened();
            } else if (!overlay && isModalOpen.current) {
                onModalClosed();
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true,
        });

        window.addEventListener('popstate', handlePopState);

        return () => {
            observer.disconnect();
            window.removeEventListener('popstate', handlePopState);
        };
    }, []);

    return null; // renders nothing
}
