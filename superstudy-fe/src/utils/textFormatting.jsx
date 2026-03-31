import React from 'react';

/**
 * Parses a string containing basic markdown (**, *, __) and placeholders ({{...}})
 * into an array of React elements.
 * 
 * @param {string} text The raw text to parse
 * @param {function} renderBlankFn (word, key) => React.Node to render blanks. If omitted, renders the {{word}} as is.
 * @param {string} keyPrefix Used internally for React keys
 * @returns React.Node | Array<React.Node>
 */
export function renderFormattedText(text, renderBlankFn, keyPrefix = 'rt') {
    if (!text) return null;

    // Matches from left to right: {{word}}, **bold**, *italic*, __underline__
    const regex = /(\{\{(?:(?!\}\}).)+\}\})|(\*\*(?:(?!\*\*).)+\*\*)|(\_\_(?:(?!__).)+\_\_)|(\*(?:(?!\*).)+\*)/g;

    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(text)) !== null) {
        if (match.index > lastIndex) {
            parts.push(text.slice(lastIndex, match.index));
        }

        const fullMatch = match[0];
        const key = `${keyPrefix}-${lastIndex}`;

        if (fullMatch.startsWith('{{') && fullMatch.endsWith('}}')) {
            const word = fullMatch.slice(2, -2);
            parts.push(renderBlankFn ? renderBlankFn(word, key) : <span key={key}>{fullMatch}</span>);
        } else if (fullMatch.startsWith('**') && fullMatch.endsWith('**')) {
            const content = fullMatch.slice(2, -2);
            parts.push(<strong key={key}>{renderFormattedText(content, renderBlankFn, key)}</strong>);
        } else if (fullMatch.startsWith('__') && fullMatch.endsWith('__')) {
            const content = fullMatch.slice(2, -2);
            parts.push(<u key={key}>{renderFormattedText(content, renderBlankFn, key)}</u>);
        } else if (fullMatch.startsWith('*') && fullMatch.endsWith('*')) {
            const content = fullMatch.slice(1, -1);
            parts.push(<em key={key}>{renderFormattedText(content, renderBlankFn, key)}</em>);
        }

        lastIndex = regex.lastIndex;
    }

    if (lastIndex < text.length) {
        parts.push(text.slice(lastIndex));
    }

    if (parts.length === 0) return null;
    if (parts.length === 1) return parts[0];
    return parts;
}

/**
 * Applies Markdown wrapper to selected text in textarea.
 */
export function applyFormatToSelection(textarea, formatToken) {
    if (!textarea) return null;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentText = textarea.value;

    const selectedText = currentText.substring(start, end);
    const newText = currentText.substring(0, start) + `${formatToken}${selectedText}${formatToken}` + currentText.substring(end);

    // Calculate new cursor position
    const newStart = start + formatToken.length;
    const newEnd = start + selectedText.length + formatToken.length;

    return {
        newText,
        newStart,
        newEnd
    };
}
