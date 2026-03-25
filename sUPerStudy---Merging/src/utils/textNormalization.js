/**
 * Shared text normalization utilities for fill-in-blank answer comparison.
 * Ensures flexible, fair grading by handling contractions, HTML artifacts,
 * punctuation differences, and various space/quote characters.
 */

const CONTRACTIONS = {
    "aren't": "are not",
    "can't": "cannot",
    "couldn't": "could not",
    "didn't": "did not",
    "doesn't": "does not",
    "don't": "do not",
    "hadn't": "had not",
    "hasn't": "has not",
    "haven't": "have not",
    "he'd": "he would",
    "he'll": "he will",
    "he's": "he is",
    "i'd": "i would",
    "i'll": "i will",
    "i'm": "i am",
    "i've": "i have",
    "isn't": "is not",
    "it'd": "it would",
    "it'll": "it will",
    "it's": "it is",
    "let's": "let us",
    "mustn't": "must not",
    "needn't": "need not",
    "shan't": "shall not",
    "she'd": "she would",
    "she'll": "she will",
    "she's": "she is",
    "shouldn't": "should not",
    "that's": "that is",
    "there's": "there is",
    "they'd": "they would",
    "they'll": "they will",
    "they're": "they are",
    "they've": "they have",
    "wasn't": "was not",
    "we'd": "we would",
    "we'll": "we will",
    "we're": "we are",
    "we've": "we have",
    "weren't": "were not",
    "what's": "what is",
    "who'd": "who would",
    "who'll": "who will",
    "who's": "who is",
    "won't": "will not",
    "wouldn't": "would not",
    "you'd": "you would",
    "you'll": "you will",
    "you're": "you are",
    "you've": "you have",
};

/**
 * Strip HTML tags from a string.
 * Used to clean content extracted from Quill editor markers.
 */
export function stripHtmlTags(str) {
    if (!str) return '';
    return str.replace(/<[^>]*>/g, '');
}

/**
 * Normalize text for flexible fill-in-blank comparison:
 * 1. Strip HTML tags (e.g. <strong>, <em> from Quill editor)
 * 2. Replace non-breaking spaces with regular spaces
 * 3. Normalize various apostrophe characters (' ' ʼ) to standard '
 * 4. Normalize smart double quotes (" ") to standard "
 * 5. Expand contractions to full forms (hadn't → had not)
 * 6. Strip leading/trailing punctuation (. , ! ? ; :)
 * 7. Collapse multiple spaces, trim, lowercase
 */
export function normalizeForComparison(str) {
    if (!str) return '';
    let s = str
        .replace(/<[^>]*>/g, '')                // strip HTML tags
        .replace(/&nbsp;/g, ' ')                // HTML entity &nbsp; → space
        .replace(/\u00a0/g, ' ')                // non-breaking space char → space
        .replace(/[\u2018\u2019\u02BC]/g, "'")  // smart single quotes & modifier apostrophe → '
        .replace(/[\u201C\u201D]/g, '"')        // smart double quotes → "
        .trim()
        .toLowerCase();

    // Expand contractions (word boundary aware)
    for (const [contraction, expanded] of Object.entries(CONTRACTIONS)) {
        const regex = new RegExp(`\\b${contraction.replace("'", "'")}\\b`, 'gi');
        s = s.replace(regex, expanded);
    }

    // Strip leading/trailing punctuation (. , ! ? ; :) that teacher may accidentally include
    s = s.replace(/^[.,!?;:\s]+|[.,!?;:\s]+$/g, '');

    // Collapse multiple spaces
    s = s.replace(/\s+/g, ' ').trim();
    return s;
}
