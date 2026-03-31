import { useEffect, useCallback, useRef } from 'react';

/**
 * Hook: close a modal when the browser back button is pressed.
 * 
 * When the modal opens, pushes a history state. When the user presses back,
 * the popstate event fires and the modal closes — instead of navigating away.
 *
 * @param {boolean} isOpen - Whether the modal is currently open
 * @param {Function} onClose - Function to call to close the modal
 */
export function useBackButtonClose(isOpen, onClose) {
    const pushed = useRef(false);
    const stableOnClose = useCallback(() => onClose(), [onClose]);

    useEffect(() => {
        if (isOpen && !pushed.current) {
            window.history.pushState({ modal: true }, '');
            pushed.current = true;
        }

        if (!isOpen && pushed.current) {
            pushed.current = false;
            if (window.history.state?.modal) {
                window.history.back();
            }
        }
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return;

        const handlePopState = () => {
            if (pushed.current) {
                pushed.current = false;
                stableOnClose();
            }
        };

        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, [isOpen, stableOnClose]);
}
