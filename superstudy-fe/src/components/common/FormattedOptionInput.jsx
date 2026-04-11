import { useState, useRef, useEffect } from 'react';
import { renderFormattedText, applyFormatToSelection } from '../../utils/textFormatting';
import { hasOptionFormatMarkers } from '../../utils/optionFormatUtils';

/**
 * An option input that renders formatted text (bold, italic, underline)
 * directly in the field when not focused, and shows raw markdown when editing.
 *
 * Supports Ctrl/⌘ + B/I/U keyboard shortcuts.
 */
export default function FormattedOptionInput({
    value,
    onChange,
    placeholder,
    disabled,
    className = 'admin-form-input',
    style,
}) {
    const [focused, setFocused] = useState(false);
    const inputRef = useRef(null);
    const hasFormat = hasOptionFormatMarkers(value);

    // When switching from formatted view to input, restore cursor at end
    useEffect(() => {
        if (focused && inputRef.current) {
            inputRef.current.focus();
        }
    }, [focused]);

    const handleKeyDown = (e) => {
        const isMod = e.ctrlKey || e.metaKey;
        if (!isMod) return;
        let token = null;
        if (e.key === 'b' || e.key === 'B') token = '**';
        else if (e.key === 'i' || e.key === 'I') token = '~~';
        else if (e.key === 'u' || e.key === 'U') token = '__';
        if (!token) return;
        e.preventDefault();
        const result = applyFormatToSelection(e.target, token);
        if (result) {
            onChange(result.newText);
            setTimeout(() => {
                e.target.focus();
                e.target.setSelectionRange(result.newStart, result.newEnd);
            }, 0);
        }
    };

    // When blurred and has formatting, show rendered view
    if (!focused && hasFormat && !disabled) {
        return (
            <div
                className={className}
                style={{
                    ...style,
                    cursor: 'text',
                    minHeight: '36px',
                    display: 'flex',
                    alignItems: 'center',
                }}
                onClick={() => setFocused(true)}
                tabIndex={0}
                onFocus={() => setFocused(true)}
            >
                <span style={{ flex: 1 }}>{renderFormattedText(value)}</span>
            </div>
        );
    }

    return (
        <input
            ref={inputRef}
            type="text"
            className={className}
            style={style}
            placeholder={placeholder}
            value={value}
            onChange={e => onChange(e.target.value)}
            disabled={disabled}
            onKeyDown={handleKeyDown}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
        />
    );
}
