function toTrimmedString(value) {
    return typeof value === 'string' ? value.trim() : '';
}

export function looksLikeOpaqueUserId(value) {
    const str = toTrimmedString(value);
    if (!str || str.includes('@')) return false;

    return (
        /^UPE[A-Z0-9-]+$/i.test(str) ||
        /^[a-f0-9]{24}$/i.test(str) ||
        /^[A-Za-z0-9_-]{20,}$/.test(str)
    );
}

export function getResolvedUserLabel(user = {}, fallbackName = '', fallbackEmail = '') {
    const candidates = [
        user?.displayName,
        user?.fullName,
        [user?.firstName, user?.lastName].filter(Boolean).join(' '),
        fallbackName,
        user?.email,
        fallbackEmail,
    ];

    for (const candidate of candidates) {
        const text = toTrimmedString(candidate);
        if (!text) continue;
        if (looksLikeOpaqueUserId(text)) continue;
        return text;
    }

    return 'Unknown';
}

export function getResolvedUserEmail(user = {}, fallbackEmail = '') {
    const directEmail = toTrimmedString(user?.email);
    if (directEmail) return directEmail;

    const fallback = toTrimmedString(fallbackEmail);
    return fallback.includes('@') ? fallback : 'Unknown user';
}
