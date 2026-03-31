import { useEffect } from 'react';

/**
 * Hook to prevent text selection, copying, and context menu
 * on student-facing exercise/exam pages.
 * 
 * Blocks: copy, cut, contextmenu (right-click), dragstart (text dragging out)
 * Does NOT affect: button clicks, input/textarea typing, drag-and-drop answers
 */
export function useAntiCopy() {
    useEffect(() => {
        const handleCopy = (e) => {
            // Allow copy inside input/textarea (for user convenience when editing their own answer)
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
            e.preventDefault();
        };

        const handleCut = (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
            e.preventDefault();
        };

        const handleContextMenu = (e) => {
            // Allow right-click on input/textarea for paste etc.
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
            e.preventDefault();
        };

        document.addEventListener('copy', handleCopy);
        document.addEventListener('cut', handleCut);
        document.addEventListener('contextmenu', handleContextMenu);

        return () => {
            document.removeEventListener('copy', handleCopy);
            document.removeEventListener('cut', handleCut);
            document.removeEventListener('contextmenu', handleContextMenu);
        };
    }, []);
}
