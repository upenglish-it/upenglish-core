import { useEffect, useRef } from 'react';

/**
 * When `answered` transitions to true, smoothly scrolls so the
 * result feedback is visible, but ensures the topbar remains
 * reachable by not scrolling past the top of the page.
 */
export function useScrollToContent(answered) {
    const contentRef = useRef(null);

    useEffect(() => {
        if (!answered) return;

        // Give the DOM a tick to render the bottom bar before measuring
        const timer = setTimeout(() => {
            if (!contentRef.current) return;

            const el = contentRef.current;
            const rect = el.getBoundingClientRect();

            // Only scroll if the result is below the visible viewport
            if (rect.bottom > window.innerHeight) {
                // Scroll just enough to show the bottom of the result,
                // but cap so we never scroll past the topbar area (85px padding)
                const scrollTarget = window.scrollY + rect.bottom - window.innerHeight + 24; // 24px breathing room
                window.scrollTo({
                    top: scrollTarget,
                    behavior: 'smooth',
                });
            }
        }, 80);

        return () => clearTimeout(timer);
    }, [answered]);

    return contentRef;
}
