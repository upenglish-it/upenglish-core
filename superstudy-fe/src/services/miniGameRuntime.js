const BASE_URL = import.meta.env.VITE_BASE_URL;

const SAMPLE_WORDS = [
    { word: 'apple', meaning: 'quả táo', phonetic: '/ˈae.pəl/', example: 'I eat an apple every day.', exampleTranslation: 'Tôi ăn một quả táo mỗi ngày.' },
    { word: 'banana', meaning: 'quả chuối', phonetic: '/bəˈnɑː.nə/', example: 'Bananas are yellow.', exampleTranslation: 'Chuối có màu vàng.' },
    { word: 'cat', meaning: 'con mèo', example: 'The cat is sleeping.', exampleTranslation: 'Con mèo đang ngủ.' },
    { word: 'desk', meaning: 'bàn học', example: 'My bag is on the desk.', exampleTranslation: 'Cặp sách của tôi ở trên bàn.' },
    { word: 'elephant', meaning: 'con voi', phonetic: '/ˈel.ɪ.fənt/' }
];

const SAMPLE_GRAMMAR_QUESTIONS = [
    {
        id: 'preview-q1',
        type: 'multiple_choice',
        purpose: 'preview',
        targetSkill: 'grammar',
        context: '',
        contextAudioUrl: '',
        variations: [
            {
                text: 'She ___ to school every day.',
                options: ['go', 'goes', 'going', 'gone'],
                correctAnswer: 1,
                explanation: 'Động từ chia ngôi thứ ba số ít.'
            }
        ]
    },
    {
        id: 'preview-q2',
        type: 'multiple_choice',
        purpose: 'preview',
        targetSkill: 'grammar',
        context: '',
        contextAudioUrl: '',
        variations: [
            {
                text: 'If it rains, we ___ at home.',
                options: ['stay', 'stays', 'stayed', 'staying'],
                correctAnswer: 0,
                explanation: 'Mệnh đề điều kiện loại 1 dùng hiện tại đơn.'
            }
        ]
    }
];

function toFiniteNumber(value) {
    if (value === null || value === undefined || value === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

function trimIfString(value) {
    return typeof value === 'string' ? value.trim() : value;
}

function pickFirstMeaningfulString(...values) {
    for (const value of values) {
        if (typeof value === 'string' && value.trim()) {
            return value.trim();
        }
    }
    return '';
}

function hasMeaningfulText(value) {
    return typeof value === 'string' && value.trim().length > 0;
}

function isMeaningfulArray(values) {
    return Array.isArray(values) && values.some(item => {
        if (typeof item === 'string') return item.trim().length > 0;
        if (item && typeof item === 'object') {
            return Object.values(item).some(value => {
                if (typeof value === 'string') return value.trim().length > 0;
                return value !== null && value !== undefined && value !== '';
            });
        }
        return item !== null && item !== undefined && item !== '';
    });
}

function normalizeVariation(variation = {}) {
    const normalized = {};

    if (hasMeaningfulText(variation.text)) normalized.text = variation.text;
    if (hasMeaningfulText(variation.content)) normalized.content = variation.content;
    if (Array.isArray(variation.options)) {
        normalized.options = variation.options.map(option => typeof option === 'string' ? option : option ?? '');
    }
    if (variation.correctAnswer !== undefined) normalized.correctAnswer = variation.correctAnswer;
    if (hasMeaningfulText(variation.explanation)) normalized.explanation = variation.explanation;
    if (Array.isArray(variation.distractors)) {
        normalized.distractors = variation.distractors.map(item => typeof item === 'string' ? item : item ?? '');
    }
    if (hasMeaningfulText(variation.sampleAnswer)) normalized.sampleAnswer = variation.sampleAnswer;
    if (isMeaningfulArray(variation.pairs)) normalized.pairs = variation.pairs;
    if (isMeaningfulArray(variation.groups)) normalized.groups = variation.groups;
    if (isMeaningfulArray(variation.items)) normalized.items = variation.items;

    return normalized;
}

function isMeaningfulVariation(variation) {
    if (!variation || typeof variation !== 'object') return false;

    return (
        hasMeaningfulText(variation.text) ||
        hasMeaningfulText(variation.content) ||
        hasMeaningfulText(variation.sampleAnswer) ||
        hasMeaningfulText(variation.explanation) ||
        isMeaningfulArray(variation.options) ||
        isMeaningfulArray(variation.distractors) ||
        isMeaningfulArray(variation.pairs) ||
        isMeaningfulArray(variation.groups) ||
        isMeaningfulArray(variation.items)
    );
}

export function getMiniGameDeliveryMode(game) {
    return game?.deliveryMode || 'single_html';
}

export function getMiniGameLaunchUrl(game) {
    return game?.launchUrl || game?.gameUrl || '';
}

export function getMiniGameMinItems(game) {
    return toFiniteNumber(game?.minItems) ?? toFiniteNumber(game?.minWords);
}

export function getMiniGameMaxItems(game) {
    return toFiniteNumber(game?.maxItems) ?? toFiniteNumber(game?.maxWords);
}

export function getMiniGameDefaultSource(game) {
    return game?.dataType === 'grammar' ? 'grammar' : 'vocabulary';
}

export function buildMiniGameBundleLaunchUrl(gameId, bundleVersion, entryPath = 'index.html') {
    const safeEntryPath = trimIfString(entryPath) || 'index.html';
    const encodedEntryPath = safeEntryPath
        .split('/')
        .filter(Boolean)
        .map(segment => encodeURIComponent(segment))
        .join('/');

    return `${BASE_URL}/mini-games/${encodeURIComponent(gameId)}/assets/bundles/${encodeURIComponent(bundleVersion)}/${encodedEntryPath}`;
}

export function normalizeMiniGameWords(words = []) {
    return (words || [])
        .map(word => {
            const exampleSentence = Array.isArray(word.exampleSentences) && word.exampleSentences.length > 0
                ? word.exampleSentences[0]
                : null;

            return {
                word: pickFirstMeaningfulString(word.word, word.term, word.text),
                meaning: pickFirstMeaningfulString(
                    word.meaning,
                    word.vietnameseMeaning,
                    word.translation,
                    word.definition,
                    word.viMeaning
                ),
                phonetic: pickFirstMeaningfulString(word.phonetic, word.ipa) || undefined,
                example: pickFirstMeaningfulString(
                    word.example,
                    word.exampleSentence,
                    exampleSentence?.en,
                    word.usage1,
                    word.sentenceSequence?.en
                ) || undefined,
                exampleTranslation: pickFirstMeaningfulString(
                    word.exampleTranslation,
                    word.vietnameseExample,
                    exampleSentence?.vi,
                    word.sentenceVi,
                    word.sentenceSequence?.vi
                ) || undefined,
                imageUrl: pickFirstMeaningfulString(word.imageUrl, word.image) || undefined,
                wordType: pickFirstMeaningfulString(word.wordType, word.partOfSpeech, word.pos) || undefined
            };
        })
        .filter(word => word.word && word.meaning);
}

export function normalizeMiniGameQuestions(questions = []) {
    return (questions || []).map(question => {
        const variations = (question.variations || [])
            .filter(isMeaningfulVariation)
            .map(normalizeVariation);

        return {
            id: question.id,
            type: question.type || 'multiple_choice',
            purpose: question.purpose || '',
            targetSkill: question.targetSkill || '',
            context: question.context || '',
            contextAudioUrl: question.contextAudioUrl || '',
            variations,
            primaryVariation: variations[0] || null
        };
    });
}

export function buildMiniGameVocabularyPayload(game, words = []) {
    const payload = {
        dataType: 'vocabulary',
        words: normalizeMiniGameWords(words)
    };

    if (game?.dataType === 'both') {
        payload.declaredDataType = 'both';
    }

    return payload;
}

export function buildMiniGameGrammarPayload(game, questions = []) {
    const payload = {
        dataType: 'grammar',
        questions: normalizeMiniGameQuestions(questions)
    };

    if (game?.dataType === 'both') {
        payload.declaredDataType = 'both';
    }

    return payload;
}

export function buildMiniGameMockPayload(game, sourceType = getMiniGameDefaultSource(game)) {
    return sourceType === 'grammar'
        ? buildMiniGameGrammarPayload(game, SAMPLE_GRAMMAR_QUESTIONS)
        : buildMiniGameVocabularyPayload(game, SAMPLE_WORDS);
}
