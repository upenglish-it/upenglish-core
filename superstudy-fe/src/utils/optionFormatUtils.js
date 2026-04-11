const INTERNAL_FORMAT_REGEX = /\*\*.+?\*\*|~~.+?~~|__.+?__/;

function replaceRepeatedly(text, replacer) {
    let previous = text;
    let next = replacer(text);
    while (next !== previous) {
        previous = next;
        next = replacer(next);
    }
    return next;
}

export function normalizeLegacyItalicMarkers(text) {
    if (typeof text !== 'string') return text;
    return text.replace(/(^|[^*])\*([^*\n]+)\*(?=[^*]|$)/g, (match, prefix, content) => `${prefix}~~${content}~~`);
}

export function normalizeOptionFormatMarkers(text) {
    if (typeof text !== 'string') return text;

    let normalized = text.replace(/&nbsp;/gi, ' ').replace(/\u00A0/g, ' ');

    normalized = replaceRepeatedly(normalized, value => value
        .replace(/<\s*(strong|b)\b[^>]*>/gi, '**')
        .replace(/<\s*\/\s*(strong|b)\s*>/gi, '**')
        .replace(/<\s*(em|i)\b[^>]*>/gi, '~~')
        .replace(/<\s*\/\s*(em|i)\s*>/gi, '~~')
        .replace(/<\s*u\b[^>]*>/gi, '__')
        .replace(/<\s*\/\s*u\s*>/gi, '__')
        .replace(/\[B\]/gi, '**')
        .replace(/\[\/B\]/gi, '**')
        .replace(/\[I\]/gi, '~~')
        .replace(/\[\/I\]/gi, '~~')
        .replace(/\[U\]/gi, '__')
        .replace(/\[\/U\]/gi, '__'));

    return normalizeLegacyItalicMarkers(normalized);
}

export function toAiOptionFormatMarkup(text) {
    if (typeof text !== 'string') return text;

    let normalized = normalizeOptionFormatMarkers(text);

    normalized = replaceRepeatedly(normalized, value => value
        .replace(/\*\*(?:(?!\*\*).)+\*\*/g, match => `[B]${match.slice(2, -2)}[/B]`)
        .replace(/~~(?:(?!~~).)+~~/g, match => `[I]${match.slice(2, -2)}[/I]`)
        .replace(/__(?:(?!__).)+__/g, match => `[U]${match.slice(2, -2)}[/U]`));

    return normalized;
}

export function stripOptionFormatMarkers(text) {
    if (typeof text !== 'string') return text;

    let stripped = normalizeOptionFormatMarkers(text);

    stripped = replaceRepeatedly(stripped, value => value
        .replace(/\*\*(?:(?!\*\*).)+\*\*/g, match => match.slice(2, -2))
        .replace(/~~(?:(?!~~).)+~~/g, match => match.slice(2, -2))
        .replace(/__(?:(?!__).)+__/g, match => match.slice(2, -2)));

    return stripped;
}

export function hasOptionFormatMarkers(text) {
    if (typeof text !== 'string') return false;
    return INTERNAL_FORMAT_REGEX.test(normalizeOptionFormatMarkers(text));
}
