import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check } from 'lucide-react';
import './CustomSelect.css';

/**
 * CustomSelect — drop-in replacement for native <select>
 * Uses a portal so the menu is never clipped by overflow:hidden parents.
 */
export default function CustomSelect({
    value,
    onChange,
    options = [],
    placeholder = 'Chọn...',
    label,
    labelIcon,
    disabled = false,
    className,
    style,
}) {
    const [open, setOpen] = useState(false);
    const triggerRef = useRef(null);
    const menuRef = useRef(null);
    const [menuStyle, setMenuStyle] = useState({});

    // Position the floating menu relative to the trigger
    const updatePosition = useCallback(() => {
        if (!triggerRef.current) return;
        const rect = triggerRef.current.getBoundingClientRect();

        const spaceBelow = window.innerHeight - rect.bottom - 10;
        const spaceAbove = rect.top - 10;

        // Prefer opening down strongly.
        // Only open up if space below is critically small (< 120px) AND there's significantly more space above.
        const idealHeight = 250;
        let openUp = false;
        let maxHeight = idealHeight;

        if (spaceBelow < 120 && spaceAbove > spaceBelow) {
            openUp = true;
            maxHeight = Math.min(idealHeight, spaceAbove);
        } else {
            // Give it as much room as possible downwards, up to idealHeight
            maxHeight = Math.min(idealHeight, Math.max(spaceBelow, 120));
        }

        setMenuStyle({
            position: 'fixed',
            left: rect.left,
            width: rect.width,
            maxHeight: `${maxHeight}px`,
            ...(openUp
                ? { bottom: window.innerHeight - rect.top + 4 }
                : { top: rect.bottom + 4 }),
            zIndex: 99999,
        });
    }, []);

    useEffect(() => {
        if (!open) return;
        updatePosition();
        // Reposition on scroll / resize (modal might scroll)
        const handler = () => updatePosition();
        window.addEventListener('scroll', handler, true);
        window.addEventListener('resize', handler);
        return () => {
            window.removeEventListener('scroll', handler, true);
            window.removeEventListener('resize', handler);
        };
    }, [open, updatePosition]);

    // Close on outside click
    useEffect(() => {
        if (!open) return;
        function handleClick(e) {
            if (
                triggerRef.current && !triggerRef.current.contains(e.target) &&
                menuRef.current && !menuRef.current.contains(e.target)
            ) {
                setOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, [open]);

    const selected = options.find(o => o.value === value);

    const menu = open
        ? createPortal(
            <ul className="cs-menu" ref={menuRef} style={menuStyle} role="listbox">
                {options.map(opt => (
                    <li
                        key={opt.value}
                        role="option"
                        aria-selected={opt.value === value}
                        className={`cs-option${opt.value === value ? ' cs-selected' : ''}`}
                        onClick={() => {
                            onChange(opt.value);
                            setOpen(false);
                        }}
                    >
                        {opt.icon && <span className="cs-item-icon">{opt.icon}</span>}
                        <span className="cs-option-label">{opt.label}</span>
                        {opt.value === value && <Check size={14} className="cs-check" />}
                    </li>
                ))}
            </ul>,
            document.body
        )
        : null;

    return (
        <div className={`admin-form-group ${className || ''}`} style={style}>
            {label && (
                <label>
                    {labelIcon && <span className="cs-label-icon">{labelIcon}</span>}
                    {label}
                </label>
            )}
            <div className={`cs-wrapper${disabled ? ' cs-disabled' : ''}`}>
                <button
                    type="button"
                    ref={triggerRef}
                    className={`cs-trigger${open ? ' cs-open' : ''}`}
                    onClick={() => !disabled && setOpen(o => !o)}
                    aria-haspopup="listbox"
                    aria-expanded={open}
                >
                    <span className={`cs-value${!selected ? ' cs-placeholder' : ''}`}>
                        {selected ? (
                            <>
                                {selected.icon && <span className="cs-item-icon">{selected.icon}</span>}
                                {selected.label}
                            </>
                        ) : placeholder}
                    </span>
                    <ChevronDown size={16} className={`cs-chevron${open ? ' cs-chevron-up' : ''}`} />
                </button>
                {menu}
            </div>
        </div>
    );
}
