const decodeHtmlEntities = (text) => {
    if (!text) return '';

    return String(text)
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&quot;/gi, '"')
        .replace(/&#39;/gi, "'");
};

const escapeHtml = (text) => {
    if (!text) return '';

    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
};

export const renderFeedbackHtml = (text) => {
    if (!text) return '';

    let safe = escapeHtml(String(text).replace(/\r\n?/g, '\n'));
    safe = safe.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    safe = safe.replace(/\*(.+?)\*/g, '<em>$1</em>');
    safe = safe.replace(/__(.+?)__/g, '<u>$1</u>');
    safe = safe.replace(/\n/g, '<br>');
    return safe;
};

export const feedbackHtmlToMd = (html) => {
    if (!html) return '';

    let md = String(html).replace(/\r\n?/g, '\n');

    md = md.replace(/<(?:strong|b)\b[^>]*>/gi, '**').replace(/<\/(?:strong|b)>/gi, '**');
    md = md.replace(/<(?:em|i)\b[^>]*>/gi, '*').replace(/<\/(?:em|i)>/gi, '*');
    md = md.replace(/<u\b[^>]*>/gi, '__').replace(/<\/u>/gi, '__');

    md = md.replace(/<br\b[^>]*>/gi, '\n');
    md = md.replace(/<(?:div|p)\b[^>]*>/gi, '\n');
    md = md.replace(/<\/(?:div|p)>/gi, '');

    md = md.replace(/<li\b[^>]*>/gi, '- ');
    md = md.replace(/<\/li>/gi, '\n');
    md = md.replace(/<\/?(?:ul|ol)\b[^>]*>/gi, '');

    md = md.replace(/<[^>]*>/g, '');
    md = decodeHtmlEntities(md).replace(/\u00a0/g, ' ');
    md = md.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n');

    return md.trim();
};
