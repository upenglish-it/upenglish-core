export function truncateText(text, maxLength = 50) {
    if (text == null) return '';

    const normalizedText = String(text).replace(/\s+/g, ' ').trim();
    if (!normalizedText) return '';
    if (normalizedText.length <= maxLength) return normalizedText;

    return `${normalizedText.slice(0, maxLength).trimEnd()}...`;
}
