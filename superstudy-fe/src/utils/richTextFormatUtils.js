import { normalizeLegacyItalicMarkers } from './optionFormatUtils';

const HTML_TAG_REGEX = /<\/?[a-z][^>]*>/i;
const BLOCK_TAG_REGEX = /<(p|div|br|ul|ol|li|blockquote|pre|h[1-6])\b/i;
const ALLOWED_TAGS = new Set(['p', 'div', 'br', 'strong', 'em', 'u', 'ul', 'ol', 'li', 'blockquote', 'code', 'pre', 'h1', 'h2', 'h3']);
const DROP_CONTENT_TAGS = new Set(['script', 'style']);

function replaceRepeatedly(text, replacer) {
    let previous = text;
    let next = replacer(text);
    while (next !== previous) {
        previous = next;
        next = replacer(next);
    }
    return next;
}

function escapeHtml(text) {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function normalizeInlineRichTextToHtml(text) {
    if (typeof text !== 'string') return text;

    let normalized = text
        .replace(/&nbsp;/gi, ' ')
        .replace(/\u00A0/g, ' ')
        .replace(/\[B\]/gi, '<strong>')
        .replace(/\[\/B\]/gi, '</strong>')
        .replace(/\[I\]/gi, '<em>')
        .replace(/\[\/I\]/gi, '</em>')
        .replace(/\[U\]/gi, '<u>')
        .replace(/\[\/U\]/gi, '</u>')
        .replace(/<\s*b\b[^>]*>/gi, '<strong>')
        .replace(/<\s*\/\s*b\s*>/gi, '</strong>')
        .replace(/<\s*i\b[^>]*>/gi, '<em>')
        .replace(/<\s*\/\s*i\s*>/gi, '</em>')
        .replace(/<\s*strong\b[^>]*>/gi, '<strong>')
        .replace(/<\s*\/\s*strong\s*>/gi, '</strong>')
        .replace(/<\s*em\b[^>]*>/gi, '<em>')
        .replace(/<\s*\/\s*em\s*>/gi, '</em>')
        .replace(/<\s*u\b[^>]*>/gi, '<u>')
        .replace(/<\s*\/\s*u\s*>/gi, '</u>');

    normalized = replaceRepeatedly(normalizeLegacyItalicMarkers(normalized), value => value
        .replace(/\*\*(?:(?!\*\*).)+\*\*/g, match => `<strong>${match.slice(2, -2)}</strong>`)
        .replace(/~~(?:(?!~~).)+~~/g, match => `<em>${match.slice(2, -2)}</em>`)
        .replace(/__(?:(?!__).)+__/g, match => `<u>${match.slice(2, -2)}</u>`));

    return normalized;
}

function wrapPlainTextAsHtml(text) {
    const paragraphs = text
        .split(/\n{2,}/)
        .map(block => block.trim())
        .filter(Boolean);

    if (paragraphs.length === 0) {
        return '<p><br></p>';
    }

    return paragraphs
        .map(block => `<p>${block.replace(/\n/g, '<br>')}</p>`)
        .join('');
}

export function looksLikeHtml(text) {
    return typeof text === 'string' && HTML_TAG_REGEX.test(text);
}

export function normalizeRichTextHtml(text) {
    if (typeof text !== 'string') return text;

    const trimmed = text.trim();
    if (!trimmed) return '';

    if (looksLikeHtml(trimmed)) {
        const normalizedHtml = normalizeInlineRichTextToHtml(trimmed);
        if (BLOCK_TAG_REGEX.test(normalizedHtml)) {
            return normalizedHtml;
        }
        return `<p>${normalizedHtml.replace(/\n/g, '<br>')}</p>`;
    }

    const escaped = escapeHtml(trimmed);
    return wrapPlainTextAsHtml(normalizeInlineRichTextToHtml(escaped));
}

export function sanitizeRichTextHtml(html) {
    if (typeof html !== 'string' || !html.trim() || typeof document === 'undefined') {
        return html;
    }

    const template = document.createElement('template');
    template.innerHTML = html;

    const sanitizeNode = (node) => {
        Array.from(node.childNodes).forEach(child => {
            if (child.nodeType === 8) {
                child.remove();
                return;
            }

            if (child.nodeType !== 1) {
                return;
            }

            const tag = child.tagName.toLowerCase();

            if (DROP_CONTENT_TAGS.has(tag)) {
                child.remove();
                return;
            }

            sanitizeNode(child);

            if (!ALLOWED_TAGS.has(tag)) {
                const fragment = document.createDocumentFragment();
                while (child.firstChild) {
                    fragment.appendChild(child.firstChild);
                }
                child.replaceWith(fragment);
                return;
            }

            Array.from(child.attributes).forEach(attr => child.removeAttribute(attr.name));
        });
    };

    sanitizeNode(template.content);
    return template.innerHTML;
}

export function normalizeRichTextValue(text) {
    if (typeof text !== 'string') return text;
    return sanitizeRichTextHtml(normalizeRichTextHtml(text));
}
