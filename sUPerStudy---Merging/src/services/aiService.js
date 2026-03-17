/**
 * AI Service — DEV/PROD conditional API calls
 *
 * DEV:  Uses Web Speech API for TTS (no key needed), or direct API if keys are in .env
 * PROD: Routes everything through api_handler.php (server picks model & key)
 *
 * This project is STANDARD tier → modelProfile: "STANDARD"
 */

const PROXY_URL = import.meta.env.VITE_PROXY_URL || '';
const IS_PROD = import.meta.env.PROD;
const MODEL_PROFILE = 'STANDARD';

// Load dynamic ENV in dev mode so we don't need to restart vite when changing .env models
import * as virtualEnv from 'virtual:dynamic-env';

function getEnvValue(key) {
    if (import.meta.env.DEV) {
        try {
            const envObj = virtualEnv.getDynamicEnv();
            return envObj[key];
        } catch (e) {
            return import.meta.env[key]; // Fail safe
        }
    }
    return import.meta.env[key]; // Fallback if prod
}

function getPrimaryModel() {
    if (MODEL_PROFILE === 'PREMIUM') return getEnvValue('PREMIUM_MODEL_PRIMARY') || getEnvValue('STANDARD_MODEL_PRIMARY');
    if (MODEL_PROFILE === 'FREE') return getEnvValue('FREE_MODEL_PRIMARY') || getEnvValue('STANDARD_MODEL_PRIMARY');
    return getEnvValue('STANDARD_MODEL_PRIMARY');
}

function getMediaListeningModel() {
    if (MODEL_PROFILE === 'PREMIUM') return getEnvValue('PREMIUM_MEDIA_LISTENING') || getEnvValue('STANDARD_MEDIA_LISTENING');
    return getEnvValue('STANDARD_MEDIA_LISTENING');
}

// ============================================================
// PUBLIC API
// ============================================================

/**
 * Text-to-Speech: returns an audio Blob
 */
export async function textToSpeech(text, lang = 'en-US') {
    if (!text) return null;

    // Force a falling (declarative) intonation by ensuring strong punctuation at the end.
    let pronText = text.trim();
    if (!/[.!?]$/.test(pronText)) {
        pronText += '.';
    }

    // --- PRODUCTION: use api_handler.php gtts route ---
    if (IS_PROD && PROXY_URL) {
        return fetchGttsFromProxy(pronText, lang);
    }

    // --- DEV: Try using the provided Google API key for high-quality TTS ---
    const googleKey = import.meta.env.VITE_GOOGLE_API_KEY || import.meta.env.DEV_GOOGLE_API_KEY;
    if (googleKey) {
        try {
            return await fetchGttsDirect(pronText, lang, googleKey);
        } catch (e) {
            console.warn('Google TTS with Key failed, falling back...', e);
        }
    }

    // --- DEV Fallback 1: Free scraping endpoint ---
    try {
        return await fetchGttsDirectFreeScrape(pronText, lang);
    } catch {
        // --- DEV Fallback 2: Web Speech API (browser built-in, robotic voice) ---
        return speakWithWebSpeechAPI(pronText, lang);
    }
}

/**
 * Chat completion: returns { text: string }
 */
export async function chatCompletion({ systemPrompt, userContent, responseFormat, thinkingLevel }) {
    if (IS_PROD && PROXY_URL) {
        return fetchChatFromProxy({ systemPrompt, userContent, responseFormat, thinkingLevel });
    }

    // DEV: try OpenRouter or Google direct based on model config
    const rawModel = getPrimaryModel();
    const isOpenRouter = rawModel.startsWith('openrouter:');

    const orKey = import.meta.env.DEV_OPENROUTER_API_KEY;
    const googleKey = import.meta.env.DEV_GOOGLE_API_KEY;

    if (isOpenRouter && orKey) {
        return fetchChatOpenRouter({ systemPrompt, userContent, responseFormat, apiKey: orKey });
    }

    if (!isOpenRouter && googleKey) {
        return fetchChatGoogle({ systemPrompt, userContent, responseFormat, apiKey: googleKey, thinkingLevel });
    }

    // Fallbacks if specified config key is missing
    if (googleKey) {
        return fetchChatGoogle({ systemPrompt, userContent, responseFormat, apiKey: googleKey, thinkingLevel });
    }
    if (orKey) {
        return fetchChatOpenRouter({ systemPrompt, userContent, responseFormat, apiKey: orKey });
    }

    throw new Error('No API key configured for chat. Add GOOGLE_API_KEY_FREE or OPENROUTER_API_KEY_FREE to .env');
}

/**
 * Chat completion with an inline file (PDF, image, etc.): returns { text: string }
 * Sends the file as inline_data to Gemini API.
 * Only works with Google Gemini (not OpenRouter).
 */
export async function chatCompletionWithFile({ systemPrompt, userContent, fileBase64, fileMimeType, responseFormat, thinkingLevel }) {
    if (IS_PROD && PROXY_URL) {
        // Production proxy: send file as inline data
        return fetchChatWithFileFromProxy({ systemPrompt, userContent, fileBase64, fileMimeType, responseFormat, thinkingLevel });
    }

    // DEV: use Google Gemini direct (supports inline files natively)
    const googleKey = import.meta.env.VITE_GOOGLE_API_KEY || import.meta.env.DEV_GOOGLE_API_KEY;
    if (googleKey) {
        return fetchChatWithFileGoogle({ systemPrompt, userContent, fileBase64, fileMimeType, responseFormat, apiKey: googleKey, thinkingLevel });
    }

    throw new Error('Cần Google API Key để phân tích file. OpenRouter không hỗ trợ inline files.');
}

/**
 * Helper: Count syllables in an English word
 */
function countSyllables(word) {
    word = word.toLowerCase().replace(/[^a-z]/g, '');
    if (word.length <= 3) return 1;
    const vowelGroups = word.match(/[aeiouy]+/g);
    if (!vowelGroups) return 1;
    let count = vowelGroups.length;
    const endsWithConsonantLE = /[bcdfghjklmnpqrstvwxz]le$/.test(word);
    if (word.endsWith('e') && !endsWithConsonantLE && count > 1) count--;
    return Math.max(1, count);
}

/**
 * Helper: Determine evaluation type based on word
 */
function getEvaluationType(text) {
    const words = text.trim().split(/\s+/).filter(w => w.length > 0);
    if (words.length === 1) {
        const syllables = countSyllables(words[0]);
        if (syllables === 1) return 'single_syllable';
        return 'multi_syllable_word';
    }
    return 'phrase';
}

/**
 * Pronunciation Evaluation — ported from pronunciation-coach
 */
export async function evaluatePronunciation(audioBlob, targetWord, targetIpa) {
    if (!audioBlob) throw new Error('No audio provided');

    const base64Audio = await blobToBase64(audioBlob);
    const audioMimeType = audioBlob.type || 'audio/webm';

    const evaluationType = getEvaluationType(targetWord);

    // Build criteria and JSON sections based on evaluation type
    let criteriaSection = '';
    let jsonScoreSection = '';
    let jsonFeedbackSection = '';

    if (evaluationType === 'single_syllable') {
        criteriaSection = `
EVALUATION CRITERIA (CHỈ ĐÁNH GIÁ ÂM RIÊNG LẺ - Đây là TỪ ĐƠN 1 âm tiết):

**Individual Sounds (0-100)** - FOCUS ON VIETNAMESE LEARNER ERRORS:
   - **Consonants Vietnamese speakers struggle with:**
     • /θ/ and /ð/ (often replaced with /t/, /d/, /s/, /z/) - "think" → "tink", "this" → "dis"
     • Final consonants /t/, /d/, /k/, /g/, /p/, /b/ (often dropped or unreleased) - "cat" → "ca", "big" → "bi"
     • /r/ vs /l/ confusion
     • /v/ vs /w/ (Vietnamese lacks real /w/) - "work" → "vork"
     • /ʃ/ and /ʒ/ (often replaced with /s/, /z/)
     • Consonant clusters /str/, /spr/, /skr/ (often add vowels) - "street" → "sa-treet"
   - **Vowels Vietnamese speakers struggle with:**
     • /æ/ vs /e/ (cap vs kept)
     • /ɪ/ vs /i:/ (ship vs sheep)
     • /ʊ/ vs /u:/ (full vs fool)
   - **Endings (major issue for Vietnamese):**
     • -ed endings: /t/, /d/, /ɪd/ distinctions
     • -s endings: /s/, /z/, /ɪz/ distinctions
     • Final -ing (often drops the /g/)

NOTE: Các tiêu chí khác (Nhấn âm, Nối âm, Trôi chảy, Nhịp điệu) KHÔNG áp dụng cho từ đơn 1 âm tiết.`;
        jsonScoreSection = `"individualSounds": number (0-100)`;
        jsonFeedbackSection = `"individualSounds": "Nhận xét về cách phát âm các âm trong từ này"`;
    } else {
        // multi_syllable_word (most common case for vocabulary app)
        criteriaSection = `
EVALUATION CRITERIA (CHỈ ĐÁNH GIÁ 2 TIÊU CHÍ - Đây là TỪ có nhiều âm tiết):

1. **Individual Sounds (0-50)** - FOCUS ON VIETNAMESE LEARNER ERRORS:
   - **Consonants Vietnamese speakers struggle with:**
     • /θ/ and /ð/ (often replaced with /t/, /d/, /s/, /z/) - "think" → "tink", "this" → "dis"
     • Final consonants /t/, /d/, /k/, /g/, /p/, /b/ (often dropped or unreleased) - "cat" → "ca", "big" → "bi"
     • /r/ vs /l/ confusion
     • /v/ vs /w/ (Vietnamese lacks real /w/) - "work" → "vork"
     • /ʃ/ and /ʒ/ (often replaced with /s/, /z/)
     • Consonant clusters /str/, /spr/, /skr/ (often add vowels) - "street" → "sa-treet"
   - **Vowels Vietnamese speakers struggle with:**
     • /æ/ vs /e/ (cap vs kept)
     • /ɪ/ vs /i:/ (ship vs sheep)
     • /ʊ/ vs /u:/ (full vs fool)
     • Reduced vowel /ə/ (schwa) in unstressed syllables
   - **Endings (major issue for Vietnamese):**
     • -ed endings: /t/, /d/, /ɪd/ distinctions
     • -s endings: /s/, /z/, /ɪz/ distinctions
     • Final -ing (often drops the /g/)

2. **Word Stress (0-50)**:
   - Correct syllable stress (e.g., eco-NO-mic, not e-co-no-mic)
   - Vietnamese speakers often stress all syllables equally - watch for this!

NOTE: Các tiêu chí khác (Nối âm, Trôi chảy, Nhịp điệu) KHÔNG áp dụng cho từ đơn.`;
        jsonScoreSection = `"individualSounds": number (0-50),
    "wordStress": number (0-50)`;
        jsonFeedbackSection = `"individualSounds": "Nhận xét về cách phát âm các âm",
    "wordStress": "Nhận xét về trọng âm trong từ"`;
    }

    const systemPrompt = `You are an expert English pronunciation coach. Listen to this audio and evaluate pronunciation quality.

**IMPORTANT: The student is a VIETNAMESE NATIVE SPEAKER.**

**CRITICAL — SILENCE/NO-SPEECH DETECTION:**
- If the audio is SILENT, contains ONLY background noise, or has NO CLEAR HUMAN SPEECH, you MUST return totalScore: 0 with transcript: "" and feedback explaining no speech was detected.
- Do NOT hallucinate or imagine hearing the expected word. Only evaluate what is ACTUALLY audible in the audio.
- If you are unsure whether there is speech, err on the side of 0 score.

EXPECTED TEXT: "${targetWord}"
EXPECTED IPA: ${targetIpa}
EVALUATION TYPE: ${evaluationType === 'single_syllable' ? 'TỪ ĐƠN 1 ÂM TIẾT' : 'TỪ NHIỀU ÂM TIẾT'}

**JUDGING PHILOSOPHY:**
- **Naturalness is Key:** Even if technically perfect, if it sounds robotic, deduct points. If it sounds natural/native-like but has minor technical flaws, be lenient.
- Focus on clarity and major errors specific to Vietnamese speakers.
- If the student said a COMPLETELY DIFFERENT WORD than expected, totalScore must be at most 25.

${criteriaSection}

SCORING GUIDELINES (USE FULL RANGE!):
- **90-100%**: Near-native, flawless, natural. Only for truly excellent performance.
- **80-89%**: Very good with minor issues that don't affect understanding.
- **60-79%**: Acceptable but noticeable errors. Clear room for improvement.
- **40-59%**: Significant issues affecting clarity. Many errors.
- **0-39%**: Major problems. Very difficult to understand.

DO NOT cluster all scores in the middle range. Use the FULL range based on actual performance!

FEEDBACK RULES (tiếng Việt):
- Nếu điểm cao (>= 90%): Chỉ khen ngắn gọn, KHÔNG cần ví dụ.
- Nếu điểm thấp hơn: Liệt kê lỗi cụ thể + ví dụ từ audio.
- Luôn xuống dòng giữa nhận xét và ví dụ.

Return JSON ONLY:
{
  "transcript": "exact transcription of what was said",
  "totalScore": number (0-100),
  "evaluationType": "${evaluationType}",
  "score": {
    ${jsonScoreSection}
  },
  "feedback": {
    ${jsonFeedbackSection},
    "generalComment": "Nhận xét khích lệ tổng thể"
  },
  "problemWords": [
    {
      "word": "the problematic word",
      "errorPart": "the specific letter(s) or part that was mispronounced",
      "ipa": "/correct IPA/",
      "tip": "Mẹo cải thiện ngắn gọn bằng tiếng Việt (1 câu)"
    }
  ],
  "word_letters": [{"letter": "c", "status": "correct"}, {"letter": "a", "status": "error"}]
}

For word_letters: break the target word/phrase into individual letters AND spaces between words. For space characters between words, use {"letter": " ", "status": "correct"}. Example for "breach of contract": [{"letter":"b","status":"correct"}, ..., {"letter":"h","status":"correct"}, {"letter":" ","status":"correct"}, {"letter":"o","status":"correct"}, {"letter":"f","status":"correct"}, {"letter":" ","status":"correct"}, {"letter":"c","status":"correct"}, ...]. Status is "correct", "warning", or "error". Spaces are always "correct".`;

    const userContent = `Evaluate the pronunciation in this audio.`;

    if (IS_PROD && PROXY_URL) {
        return fetchAudioEvalFromProxy({ systemPrompt, userContent, base64Audio, audioMimeType });
    }

    const googleKey = import.meta.env.VITE_GOOGLE_API_KEY || import.meta.env.DEV_GOOGLE_API_KEY;
    if (googleKey) {
        return fetchAudioEvalGoogle({ systemPrompt, userContent, base64Audio, apiKey: googleKey, audioMimeType });
    }

    throw new Error('No API key configured for audio evaluation. Add GOOGLE_API_KEY_FREE to .env');
}

/**
 * Generate a custom word list from a topic and settings using AI.
 * Returns an array of objects: { word, phonetic, vietnameseMeaning, exampleSentence, vietnameseExample }
 */
export async function generateWordListFromTopic({ topic, count, type, level = 'A2' }) {
    if (!topic || !count) throw new Error('Missing parameters');

    const amount = Number(count);
    let instructionContext = '';

    if (type === 'phrases') {
        instructionContext = `You are focusing on useful English PHRASES, IDIOMS, or COLLOCATIONS suitable for CEFR proficiency level ${level}.`;
    } else {
        instructionContext = `You are focusing on distinct English vocabulary VOCABULARY WORDS suitable for CEFR proficiency level ${level}.`;
    }

    const systemPrompt = `You are an expert English teacher creating comprehensive vocabulary lists for Vietnamese learners.
The topic or theme is: "${topic}". Target CEFR level: ${level}.

${instructionContext}

CRITICAL RULES:
1. Provide highly accurate, natural English usage and precise Vietnamese translations.
2. For each new item, you MUST provide EXACTLY this full JSON structure so the learning games function correctly:
   - "word": the English word or phrase.
   - "phonetic": IPA pronunciation (e.g., "/ˈæp.əl/").
   - "partOfSpeech": "noun", "verb", "adjective", etc.
   - "vietnameseMeaning": precise short Vietnamese translation.
   - "explanation": a detailed Vietnamese explanation of what the word means and how to use it.
   - "pronunciationTip": a short tip in Vietnamese on how to pronounce it, showing stressed syllables.
   - "distractors": an array of EXACTLY 3 English words that look or sound similar to the main word, used to trick the student in listening exercises (e.g. ["appal", "ample", "amble"]).
   - "collocations": an array of 1 to 3 objects, each with "phrase" (a common English collocation using the word) and "vietnamese" (its translation).
   - "collocationExercise": an object for a fill-in-the-blank exercise. CRITICAL RULES:
       1. The main word being studied MUST APPEAR in the sentence as-is. DO NOT blank it out.
       2. The blank (___) replaces a DIFFERENT word that typically collocates with the main word.
       3. Example: if the word is "sleep", sentence = "I usually sleep ___ at night." answer = "well". NOT "I usually ___ well at night." with answer "sleep".
       Fields:
       "sentence": English sentence containing the main word, with a DIFFERENT collocating word replaced by "___"
       "sentenceVi": Vietnamese translation of the full sentence
       "options": array of 4 English words (the correct answer + 3 plausible but wrong alternatives)
       "answer": the correct word that fills the blank (must NOT be the main word)
   - "exampleSentences": an array of at least 1 object with "en" (English sentence) and "vi" (Vietnamese translation).
   - "sentenceSequence": an object containing a natural English sentence for the user to practice building, along with its Vietnamese translation. 
       "en": a natural, grammatically correct English sentence using the word. The complexity and grammar of this sentence MUST be appropriate for CEFR level ${level}.
       "vi": exact Vietnamese translation of the English sentence.

Output your response ENTIRELY and STRICTLY as a JSON array of objects. Do not wrap it in markdown blockquotes like \`\`\`json. Example format:
[
  {
    "word": "negotiate",
    "phonetic": "/nɪˈɡoʊ.ʃi.eɪt/",
    "partOfSpeech": "verb",
    "vietnameseMeaning": "thương lượng",
    "explanation": "Trao đổi, thảo luận với đối tác nhằm đi đến một thỏa hiệp.",
    "distractors": ["navigate", "negligent", "nominate"],
    "pronunciationTip": "Nhấn trọng âm ở âm tiết thứ 2: ne-GO-shi-ate",
    "collocations": [
      { "phrase": "negotiate a deal", "vietnamese": "thương lượng thỏa thuận" }
    ],
    "collocationExercise": {
      "sentence": "We need to negotiate a ___ with the supplier.",
      "sentenceVi": "Chúng ta cần thương lượng một thỏa thuận với nhà cung cấp.",
      "options": ["deal", "term", "price", "product"],
      "answer": "deal"
    },
    "exampleSentences": [
      { "en": "They spent weeks negotiating the contract.", "vi": "Họ đã dành nhiều tuần để đàm phán." }
    ],
    "sentenceSequence": {
      "en": "We negotiated with the client successfully.",
      "vi": "Chúng tôi đã đàm phán thành công với khách hàng."
    }
  }
]`;

    try {
        const response = await chatCompletion({
            systemPrompt: systemPrompt,
            userContent: `Generate ${count} ${type === 'phrases' ? 'phrases' : 'words'} about "${topic}".`,
            responseFormat: 'json'
        });

        // The AI output is expected to be a valid JSON array or object
        const cleanedText = response.text.replace(/```json/gi, '').replace(/```/g, '').trim();
        let data = JSON.parse(cleanedText);

        // Sometimes the AI returns { "words": [...] } or similar wrappers
        if (data && typeof data === 'object' && !Array.isArray(data)) {
            // Find the first array value inside the object
            for (const key in data) {
                if (Array.isArray(data[key])) {
                    data = data[key];
                    break;
                }
            }
        }

        if (!Array.isArray(data)) {
            throw new Error('AI did not return a valid list format.');
        }

        return data;
    } catch (e) {
        console.error('Failed to generate word list:', e);
        throw new Error('Không thể tạo danh sách từ. Vui lòng thử lại.');
    }
}

/**
 * Append words to an existing custom word list using AI.
 * Handles both "number of words to add" and "Vietnamese meaning to translate".
 * Prompts the AI to avoid generating words already present in the existing list.
 */
export async function appendWordListToTopic({ topic, type, existingWords, appendInput, level = 'A2' }) {
    if (!topic || !appendInput) throw new Error('Missing parameters');

    const amount = parseInt(appendInput, 10);
    const isAmount = !isNaN(amount) && amount > 0;
    const existingWordListTexts = existingWords ? existingWords.map(w => w.word).join(', ') : '';

    let instructionContext = '';

    if (isAmount) {
        instructionContext = `The user wants exactly ${amount} MORE ${type === 'phrases' ? 'phrases/collocations' : 'single vocabulary words'}, tailored to CEFR level ${level}.`;
    } else {
        instructionContext = `The user wants you to provide the English ${type === 'phrases' ? 'phrase' : 'vocabulary word'} that best matches the Vietnamese meaning: "${appendInput}" appropriate for CEFR level ${level}. 
IMPORTANT: Return EXACTLY 1 object representing the most common, direct translation. Do NOT return multiple distinct species or variations (e.g. if they type "hoa lan", return ONLY "orchid", do not list 5 different orchids). Only return up to 2 items IF AND ONLY IF there are two universally interchangeable synonyms.`;
    }

    const systemPrompt = `You are an expert English teacher creating comprehensive vocabulary lists for Vietnamese learners.
The topic or theme is: "${topic}". Target CEFR level: ${level}.

${instructionContext}

CRITICAL RULES:
1. DO NOT generate any of the following words which are already in the list: [${existingWordListTexts}]
2. For each new item, you MUST provide EXACTLY this full JSON structure so the learning games function correctly:
   - "word": the English word or phrase.
   - "phonetic": IPA pronunciation (e.g., "/ˈæp.əl/").
   - "partOfSpeech": "noun", "verb", "adjective", etc.
   - "vietnameseMeaning": precise short Vietnamese translation.
   - "explanation": a detailed Vietnamese explanation of what the word means and how to use it.
   - "pronunciationTip": a short tip in Vietnamese on how to pronounce it, showing stressed syllables.
   - "distractors": an array of EXACTLY 3 English words that look or sound similar to the main word, used to trick the student in listening exercises (e.g. ["appal", "ample", "amble"]).
   - "collocations": an array of 1 to 3 objects, each with "phrase" (a common English collocation using the word) and "vietnamese" (its translation).
   - "collocationExercise": an object for a fill-in-the-blank exercise. CRITICAL RULES:
       1. The main word being studied MUST APPEAR in the sentence as-is. DO NOT blank it out.
       2. The blank (___) replaces a DIFFERENT word that typically collocates with the main word.
       3. Example: if the word is "sleep", sentence = "I usually sleep ___ at night." answer = "well". NOT "I usually ___ well at night." with answer "sleep".
       Fields:
       "sentence": English sentence containing the main word, with a DIFFERENT collocating word replaced by "___"
       "sentenceVi": Vietnamese translation of the full sentence
       "options": array of 4 English words (the correct answer + 3 plausible but wrong alternatives)
       "answer": the correct word that fills the blank (must NOT be the main word)
   - "exampleSentences": an array of at least 1 object with "en" (English sentence) and "vi" (Vietnamese translation).
   - "sentenceSequence": an object containing a natural English sentence for the user to practice building, along with its Vietnamese translation. 
       "en": a natural, grammatically correct English sentence using the word. The complexity and grammar of this sentence MUST be appropriate for CEFR level ${level}.
       "vi": exact Vietnamese translation of the English sentence.

Output your response ENTIRELY and STRICTLY as a JSON array of objects. Do not wrap it in markdown blockquotes like \`\`\`json. Example format:
[
  {
    "word": "negotiate",
    "phonetic": "/nɪˈɡoʊ.ʃi.eɪt/",
    "partOfSpeech": "verb",
    "vietnameseMeaning": "thương lượng",
    "explanation": "Trao đổi, thảo luận với đối tác nhằm đi đến một thỏa hiệp.",
    "distractors": ["navigate", "negligent", "nominate"],
    "pronunciationTip": "Nhấn trọng âm ở âm tiết thứ 2: ne-GO-shi-ate",
    "collocations": [
      { "phrase": "negotiate a deal", "vietnamese": "thương lượng thỏa thuận" }
    ],
    "collocationExercise": {
      "sentence": "We need to negotiate a ___ with the supplier.",
      "sentenceVi": "Chúng ta cần thương lượng một thỏa thuận với nhà cung cấp.",
      "options": ["deal", "term", "price", "product"],
      "answer": "deal"
    },
    "exampleSentences": [
      { "en": "They spent weeks negotiating the contract.", "vi": "Họ đã dành nhiều tuần để đàm phán." }
    ],
    "sentenceSequence": {
      "en": "We negotiated with the client successfully.",
      "vi": "Chúng tôi đã đàm phán thành công với khách hàng."
    }
  }
]`;

    try {
        const response = await chatCompletion({
            systemPrompt: systemPrompt,
            userContent: isAmount
                ? `Generate ${amount} additional ${type === 'phrases' ? 'phrases' : 'words'} for the topic "${topic}".`
                : `Translate "${appendInput}" to a single English ${type === 'phrases' ? 'phrase' : 'word'} in the context of "${topic}".`,
            responseFormat: 'json'
        });

        const cleanedText = response.text.replace(/```json/gi, '').replace(/```/g, '').trim();
        let data = JSON.parse(cleanedText);

        if (data && typeof data === 'object' && !Array.isArray(data)) {
            for (const key in data) {
                if (Array.isArray(data[key])) {
                    data = data[key];
                    break;
                }
            }
        }

        if (!Array.isArray(data)) {
            data = [data]; // Wrap into array if the AI occasionally returns a single object
        }

        return data;
    } catch (e) {
        console.error('Failed to append word list:', e);
        throw new Error('Không thể thêm từ. Vui lòng thử lại.');
    }
}

export function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            // Remove the data URI header (e.g. data:audio/webm;base64,)
            const base64String = reader.result.split(',')[1];
            resolve(base64String);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

/**
 * Evaluate an audio answer for grammar/exam questions.
 * Sends the audio to AI with the question context for grading.
 * @param {Blob} audioBlob The recorded audio blob
 * @param {string} questionText The question text shown to the student
 * @param {string} purpose The learning purpose / grading criteria
 * @param {string} specialRequirement Optional special requirements for grading
 * @param {number} maxPoints The maximum score for this question (default: 10)
 * @param {string} context Optional section context (reading passage / listening transcript) the question is based on
 * @returns {Promise<Object>} { score (0-maxPoints), feedback, transcript, teacherNote }
 */
export async function evaluateAudioAnswer(audioBlob, questionText, purpose, specialRequirement = '', maxPoints = 10, context = '', teacherTitle = '', studentTitle = '', questionIndex = 0, previousResults = [], totalQuestions = 0, cefrLevel = '') {
    if (!audioBlob) throw new Error('No audio provided');

    const base64Audio = await blobToBase64(audioBlob);
    const audioMimeType = audioBlob.type || 'audio/webm';

    // Strip HTML tags from context for a cleaner prompt
    const plainContext = context ? context.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() : '';

    // Use provided titles or fall back to defaults
    const finalTeacherTitle = teacherTitle || 'thầy/cô';
    const finalStudentTitle = studentTitle || 'em';

    const greetingInstruction = questionIndex > 0
        ? `\nĐây là câu hỏi thứ ${questionIndex + 1}${totalQuestions > 0 ? '/' + totalQuestions : ''} trong bài. KHÔNG chào lại học viên (đã chào ở câu 1). Đi thẳng vào nhận xét nội dung.`
        : (totalQuestions > 0 ? `\nĐây là câu hỏi đầu tiên trong bài gồm ${totalQuestions} câu.` : '');

    const totalQuestionsInfo = totalQuestions > 0
        ? `\n\nQUAN TRỌNG VỀ NGỮ CẢNH BÀI LÀM: Học viên đang làm MỘT bài kiểm tra/bài tập duy nhất gồm ${totalQuestions} câu hỏi, và nộp bài MỘT LẦN duy nhất. Đây KHÔNG phải là nhiều lần nộp bài riêng lẻ. Bạn đang chấm câu hỏi thứ ${questionIndex + 1}/${totalQuestions} trong bài này.`
        : '';

    const previousResultsContext = previousResults.length > 0
        ? `\nKẾT QUẢ CÁC CÂU TRƯỚC TRONG CÙNG BÀI (đây là các câu khác nhau trong CÙNG MỘT bài kiểm tra, KHÔNG phải các lần nộp bài riêng lẻ):\n${previousResults.map(r => {
            let detail = `- Câu ${r.questionNumber} (${r.typeName}${r.purpose ? ' - ' + r.purpose : ''}): ${r.isCorrect ? 'ĐÚNG' : 'SAI'} — ${r.score}/${r.maxScore} điểm`;
            if (r.questionText) detail += `\n  Đề bài: "${r.questionText}"`;
            if (!r.isCorrect) {
                if (r.studentAnswer) detail += `\n  Học viên trả lời: "${r.studentAnswer}"`;
                if (r.correctAnswer) detail += `\n  Đáp án đúng: "${r.correctAnswer}"`;
            }
            if (r.feedback && r.feedback !== 'Chính xác!') {
                detail += `\n  Nhận xét: "${r.feedback}"`;
            }
            return detail;
        }).join('\n')}\nNhận xét cho câu này nên có cách diễn đạt khác với các câu trước.`
        : '';

    const systemPrompt = `Bạn là giáo viên tiếng Anh đang chấm bài nói (speaking) cho học viên Việt Nam. Gọi học viên bằng "${finalStudentTitle}". Có thể xưng "${finalTeacherTitle}" nhưng KHÔNG nhất thiết phải xưng hô trong mọi câu — đôi khi chỉ cần nhận xét trực tiếp về bài làm là đủ.${totalQuestionsInfo}${greetingInstruction}
${cefrLevel ? `Trình độ mục tiêu của học viên: ${cefrLevel}. Hãy chấm và gợi ý phù hợp với trình độ này.` : ''}
${previousResultsContext}
${plainContext ? `\nNGỮ CẢNH / ĐỀ BÀI (Đây là đoạn văn / bài nghe mà câu hỏi dựa vào. Chấm điểm phải xem xét nội dung này):\n"""\n${plainContext}\n"""` : ''}

CÂU HỎI / ĐỀ BÀI:
    """
${questionText}
    """

MỤC ĐÍCH KIỂM TRA: ${purpose || 'Kiểm tra khả năng nói tiếng Anh'}
${specialRequirement ? `\nYÊU CẦU ĐẶC BIỆT TỪ GIÁO VIÊN (Rất quan trọng, ưu tiên chấm theo tiêu chí này):\n"""\n${specialRequirement}\n"""` : ''}

NHIỆM VỤ:
    1. Nghe bản thu âm của học viên.
2. Ghi lại chính xác những gì học viên nói(transcript).
3. Đánh giá câu trả lời dựa trên:
    - Nội dung: Câu trả lời có đúng yêu cầu đề bài không ? ${plainContext ? ' Có dựa trên nội dung Ngữ cảnh không?' : ''}
    - Tính đầy đủ: Câu trả lời có bao quát ĐẦY ĐỦ tất cả thông tin mà câu hỏi yêu cầu không ?
        - Ngữ pháp: Có sử dụng đúng cấu trúc ngữ pháp không ?
            - Phát âm: Có rõ ràng, dễ hiểu không ?
                - Từ vựng: Có phù hợp với trình độ và chủ đề không ?
                    4. Chấm điểm từ 0 đến ${maxPoints}.
5. Nếu không cho điểm tối đa, hãy GIẢI THÍCH NGẮN GỌN vì sao bị trừ điểm (ví dụ: thiếu thông tin gì, lỗi ngữ pháp nào, phát âm sai chỗ nào).
6. Ngoài việc sửa lỗi, hãy gợi ý cách diễn đạt TỰ NHIÊN hơn cho câu trả lời (nếu nghe gượng hoặc máy móc). Ví dụ: cách dùng từ nối, cách rút gọn, cụm từ phổ biến trong giao tiếp thực tế.

TIÊU CHÍ CHẤM NGHIÊM NGẶT — TÍNH ĐẦY ĐỦ(RẤT QUAN TRỌNG):
    - Nếu Ngữ cảnh hoặc đề bài chứa NHIỀU mục thông tin(ví dụ: nhiều mức giá, nhiều điều kiện, nhiều bước, nhiều đối tượng...) mà câu hỏi hỏi về, thì câu trả lời PHẢI đề cập TẤT CẢ các mục đó.Ví dụ: Nếu câu hỏi hỏi "How much does it cost?" và Ngữ cảnh có giá cho cả adults($75) VÀ children($50), thì chỉ nói giá adults mà bỏ sót giá children = THIẾU THÔNG TIN → trừ điểm đáng kể.
- Câu trả lời đúng nhưng THIẾU thông tin quan trọng: tối đa 50 - 60 % điểm tối đa.
- Câu trả lời chỉ đề cập được một phần nhỏ: tối đa 30 - 40 % điểm tối đa.
- Nếu câu trả lời bổ sung thêm chi tiết liên quan từ Ngữ cảnh: thưởng thêm điểm.

HƯỚNG DẪN CHẤM ĐIỂM(theo tỷ lệ phần trăm của điểm tối đa ${maxPoints}):
    - 90 % -100 %: Xuất sắc — trả lời đúng VÀ ĐẦY ĐỦ, ngữ pháp tốt, phát âm rõ
        - 70 % -80 %: Tốt — trả lời đúng và khá đầy đủ nhưng có lỗi nhỏ
            - 50 % -60 %: Trung bình — hiểu được nhưng thiếu thông tin hoặc nhiều lỗi
                - 30 % -40 %: Yếu — thiếu nhiều thông tin quan trọng hoặc khó hiểu
                    - 0 % -20 %: Rất yếu — không liên quan hoặc không nghe được

LƯU Ý:
- Viết feedback bằng TIẾNG VIỆT, ngắn gọn (2-4 câu). Gọi học viên bằng "${finalStudentTitle}". Có thể xưng "${finalTeacherTitle}" nhưng không cần xưng hô ở mọi câu.
- TRÁNH mở đầu bằng các cụm khuôn mẫu như "Thầy khen em", "Thầy thấy em", "Đúng hướng rồi", "Em làm tốt lắm". Thay vào đó, đi thẳng vào nhận xét cụ thể về bài làm.
- Viết tự nhiên, tập trung vào kiến thức cụ thể. Mỗi câu hỏi cần nhận xét với cách diễn đạt khác nhau.
- KHÔNG nhắc đến "các câu trước" hay "như đã nói" trừ khi có dữ liệu KẾT QUẢ CÁC CÂU TRƯỚC được cung cấp ở trên.
- Nếu đưa ví dụ/câu mẫu, phải chính xác theo Ngữ cảnh. Không bịa thông tin.
- KHÔNG dùng Markdown formatting (**, *, #). Dùng text thuần, ngoặc kép hoặc ngoặc đơn để nhấn mạnh.

Trả về JSON:
    {
        "score": number(0 - ${maxPoints}),
            "transcript": "Nội dung học viên đã nói",
                "feedback": "Nhận xét chi tiết cho học viên bằng tiếng Việt",
                    "teacherNote": "Ghi chú ngắn cho giáo viên bằng tiếng Việt"
    } `;

    const userContent = `Hãy nghe bản thu âm và chấm điểm câu trả lời của học viên.`;

    if (IS_PROD && PROXY_URL) {
        return fetchAudioEvalFromProxy({ systemPrompt, userContent, base64Audio, audioMimeType });
    }

    const googleKey = import.meta.env.VITE_GOOGLE_API_KEY || import.meta.env.DEV_GOOGLE_API_KEY;
    if (googleKey) {
        return fetchAudioEvalGoogle({ systemPrompt, userContent, base64Audio, apiKey: googleKey, audioMimeType });
    }

    throw new Error('No API key configured for audio evaluation.');
}

// ============================================================
// PRODUCTION PROXY CALLS
// ============================================================

async function fetchGttsFromProxy(text, lang) {
    const res = await fetch(PROXY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'gtts', text, lang }),
    });

    const data = await res.json();
    if (data.error) throw new Error(data.error);

    // Convert base64 audio to Blob
    const binary = atob(data.audio);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: data.contentType || 'audio/mpeg' });
}

async function fetchChatFromProxy({ systemPrompt, userContent, responseFormat, thinkingLevel }) {
    const body = {
        modelProfile: MODEL_PROFILE,
        mode: 'chat',
        systemPrompt: systemPrompt || '',
        userContent: userContent || '',
        responseFormat: responseFormat === 'json' ? 'json_object' : null,
    };
    if (thinkingLevel) body.thinkingLevel = thinkingLevel.toUpperCase();

    const res = await fetch(PROXY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });

    const data = await res.json();
    if (data.error) throw new Error(data.error.message || data.error);

    return { text: data.choices?.[0]?.message?.content || '' };
}

async function fetchAudioEvalFromProxy({ systemPrompt, userContent, base64Audio, audioMimeType = 'audio/webm' }) {
    // Match pronunciation-coach proxy call structure EXACTLY
    const res = await fetch(PROXY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            modelProfile: MODEL_PROFILE,
            mode: 'audio',
            systemPrompt: systemPrompt || '',
            userContent: userContent || '',
            audio: base64Audio,
            mimeType: audioMimeType,
            responseFormat: 'json_object'
        }),
    });

    const data = await res.json();
    if (data.error) throw new Error(data.error.message || data.error);

    const text = data.choices?.[0]?.message?.content || '';
    try {
        const cleanedText = text.replace(/```[a - z] *\n ? /gi, '').replace(/```/g, '').trim();
        return JSON.parse(cleanedText);
    } catch {
        return { score: 50, transcript: '(Lỗi phân tích)', feedback: text };
    }
}

// ============================================================
// DEV DIRECT CALLS
// ============================================================

async function fetchGttsDirect(text, lang, apiKey) {
    // Attempt to use Google Cloud TTS API with the provided key
    const url = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`;
    const payload = {
        input: { text },
        voice: { languageCode: lang, name: lang === 'en-US' ? 'en-US-Journey-F' : `${lang}-Standard-A` },
        audioConfig: { audioEncoding: 'MP3' }
    };

    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    if (!res.ok) {
        const errInfo = await res.text();
        throw new Error(`Google Cloud TTS failed: ${res.status} ${errInfo}`);
    }

    const data = await res.json();
    if (!data.audioContent) throw new Error('No audio content returned');

    // Convert base64 to Blob
    const binary = atob(data.audioContent);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: 'audio/mpeg' });
}

async function fetchGttsDirectFreeScrape(text, lang) {
    // Use Google Translate TTS (free scrape, no quota issues)
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=${encodeURIComponent(lang)}&q=${encodeURIComponent(text)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Google Translate scrape failed');
    return res.blob();
}

async function fetchChatOpenRouter({ systemPrompt, userContent, responseFormat, apiKey }) {
    const rawModel = getPrimaryModel();
    const model = rawModel.replace(/^(google|openrouter):/, '');

    const messages = [];
    if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
    messages.push({ role: 'user', content: userContent });

    const body = { model, messages };
    if (responseFormat === 'json') body.response_format = { type: 'json_object' };

    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
    });

    const data = await res.json();
    if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));

    return { text: data.choices?.[0]?.message?.content || '' };
}

async function fetchChatGoogle({ systemPrompt, userContent, responseFormat, apiKey, thinkingLevel }) {
    const rawModel = getPrimaryModel();
    const model = rawModel.replace(/^(google|openrouter):/, '');
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const payload = {
        contents: [{ role: 'user', parts: [{ text: userContent }] }],
    };
    if (systemPrompt) payload.system_instruction = { parts: { text: systemPrompt } };

    // Build generationConfig
    const genConfig = {};
    if (responseFormat === 'json') genConfig.responseMimeType = 'application/json';
    if (thinkingLevel) genConfig.thinkingConfig = { thinkingLevel: thinkingLevel.toUpperCase() };
    if (Object.keys(genConfig).length > 0) payload.generationConfig = genConfig;

    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (data.error) throw new Error(data.error.message);

    // When thinking is enabled, the response may contain thought parts before the text part
    const parts = data.candidates?.[0]?.content?.parts || [];
    const textPart = parts.find(p => p.text !== undefined && !p.thought);
    return { text: textPart?.text || parts[parts.length - 1]?.text || '' };
}

async function fetchAudioEvalGoogle({ systemPrompt, userContent, base64Audio, apiKey, audioMimeType = 'audio/webm' }) {
    const rawModel = getMediaListeningModel();
    const model = rawModel.replace(/^(google|openrouter):/, '');
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    // Match the working pronunciation-coach structure:
    // Prompt and audio in the SAME contents message (not split into system_instruction)
    const payload = {
        contents: [{
            parts: [
                { text: systemPrompt + "\n\n" + userContent },
                {
                    inline_data: {
                        mime_type: audioMimeType,
                        data: base64Audio
                    }
                }
            ]
        }],
        generationConfig: {
            responseMimeType: "application/json"
        }
    };

    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (data.error) throw new Error(data.error.message);

    const txt = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    try {
        const cleanedTxt = txt.replace(/```[a-z]*\n?/gi, '').replace(/```/g, '').trim();
        return JSON.parse(cleanedTxt);
    } catch {
        return { score: 50, transcript: '(Lỗi JSON AI)', feedback: txt };
    }
}

// ============================================================
// WEB SPEECH API FALLBACK (always available in browsers)
// ============================================================

function speakWithWebSpeechAPI(text, lang) {
    return new Promise((resolve) => {
        // Return a "fake blob" — we'll play it directly via SpeechSynthesis
        // Store the utterance config so the caller can use playTTS()
        window.__ttsQueue = { text, lang };
        resolve(null); // null blob signals "use Web Speech"
    });
}

/**
 * Play TTS — handles both Blob audio and Web Speech fallback
 */
export function playTTS(blob) {
    return new Promise((resolve, reject) => {
        if (blob instanceof Blob) {
            const url = URL.createObjectURL(blob);
            const audio = new Audio(url);
            audio.onended = () => { URL.revokeObjectURL(url); resolve(); };
            audio.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Audio playback failed')); };
            audio.play().catch(reject);
        } else if (window.__ttsQueue) {
            // Web Speech API fallback
            const { text, lang } = window.__ttsQueue;
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = lang;
            utterance.rate = 0.9;
            utterance.onend = () => resolve();
            utterance.onerror = () => resolve(); // Don't break flow
            speechSynthesis.cancel();
            speechSynthesis.speak(utterance);
            window.__ttsQueue = null;
        } else {
            resolve();
        }
    });
}

/**
 * Generate basic learning data for a batch of words (for bulk import).
 * Returns ONLY essential fields: word, vietnameseMeaning, partOfSpeech, phonetic.
 * 
 * @param {string[]} wordsList - Array of English words or "word, meaning" strings
 * @param {string} level - CEFR level (A1-C2)
 * @param {string} topic - The topic name for context
 * @returns {Object[]} - Array of basic word objects
 */
export async function generateBasicWordsDetails(wordsList, level = 'B1', topic = 'General') {
    if (!wordsList || wordsList.length === 0) return [];

    // Convert array to a numbered list string for the prompt
    const listString = wordsList.map((w, i) => `${i + 1}. ${w}`).join('\n');

    const systemPrompt = `You are an expert English teacher creating basic vocabulary lists for Vietnamese learners.
Context topic: "${topic}". Target CEFR level: ${level}.

You are given a list of English words (some might include Vietnamese meanings provided by the user).
Your task is to return a JSON array containing EXACTLY the basic dictionary details for each word on the list.

CRITICAL RULES:
1. Return EXACTLY an array of objects. Do not wrap it in anything else.
2. For each word, include ONLY these fields:
   - "word": the exact English word.
   - "vietnameseMeaning": precise short Vietnamese translation (use the user's translation if provided, otherwise generate it).
   - "partOfSpeech": exactly one of these abbreviations: n., v., adj., adv., prep., conj., pron., int., phrase, idiom.
   - "phonetic": accurate IPA pronunciation (e.g., "/ˈæp.əl/").
3. DO NOT generate any other fields (no examples, no collocations, etc.). This needs to be fast and minimal.

Example format:
[
  {
    "word": "negotiate",
    "vietnameseMeaning": "thương lượng",
    "partOfSpeech": "v.",
    "phonetic": "/nɪˈɡoʊ.ʃi.eɪt/"
  }
]`;

    try {
        const response = await chatCompletion({
            systemPrompt: systemPrompt,
            userContent: `Please process this list of words:\n${listString}`,
            responseFormat: 'json'
        });

        const cleanedText = response.text.replace(/```json/gi, '').replace(/```/g, '').trim();
        let data = JSON.parse(cleanedText);

        if (data && typeof data === 'object' && !Array.isArray(data)) {
            for (const key in data) {
                if (Array.isArray(data[key])) {
                    data = data[key];
                    break;
                }
            }
        }

        if (!Array.isArray(data)) {
            throw new Error('AI did not return a valid list format.');
        }

        return data;
    } catch (e) {
        console.error('Failed to generate basic words details:', e);
        throw new Error('Không thể xử lý danh sách bằng AI. Vui lòng thử lại.');
    }
}

/**
 * Generate full 6-step learning data for a batch of words.
 * Takes basic word objects (word + vietnameseMeaning) and enriches them with
 * phonetic, distractors, collocations, collocationExercise, exampleSentences, sentenceSequence etc.
 * Processes words one at a time to avoid overwhelming the AI with too many at once.
 * 
 * @param {Object} params
 * @param {string} params.topic - The topic name for context
 * @param {Object} params.wordObj - Single word object { word, vietnameseMeaning }
 * @param {string} params.level - CEFR level (A1-C2)
 * @returns {Object} - Enriched word object with full learning data
 */
export async function generateFullWordData({ topic, wordObj, level = 'A2' }) {
    const systemPrompt = `You are an expert English teacher creating comprehensive learning content for Vietnamese learners.
The topic or theme is: "${topic}". Target CEFR level: ${level}.

You are given a word and its Vietnamese meaning. Your job is to generate COMPLETE learning data for this word.

CRITICAL RULES:
1. Keep the original "word" EXACTLY as provided. 
   - If "vietnameseMeaning" is provided, keep it EXACTLY. Otherwise, generate a highly accurate, short Vietnamese meaning.
   - If "partOfSpeech" is provided, keep it. Otherwise, determine the correct part of speech.
2. Generate ALL of the following fields with high accuracy:
   - "phonetic": IPA pronunciation (e.g., "/ˈæp.əl/").
   - "partOfSpeech": "noun", "verb", "adjective", etc.
   - "explanation": a detailed Vietnamese explanation of what the word means and how to use it.
   - "pronunciationTip": a short tip in Vietnamese on how to pronounce it, showing stressed syllables.
   - "distractors": an array of EXACTLY 3 English words that look or sound similar to the main word, used to trick the student in listening exercises (e.g. ["appal", "ample", "amble"]).
   - "collocations": an array of EXACTLY 3 objects, each with "phrase" (a common English collocation using the word) and "vietnamese" (its translation).
   - "collocationExercise": an object for a fill-in-the-blank exercise. CRITICAL RULES:
       1. The main word being studied MUST APPEAR in the sentence as-is. DO NOT blank it out.
       2. The blank (___) replaces a DIFFERENT word that typically collocates with the main word.
       3. Example: if the word is "sleep", sentence = "I usually sleep ___ at night." answer = "well". NOT "I usually ___ well at night." with answer "sleep".
       Fields:
       "sentence": English sentence containing the main word, with a DIFFERENT collocating word replaced by "___"
       "sentenceVi": Vietnamese translation of the full sentence
       "options": array of 4 English words (the correct answer + 3 plausible but wrong alternatives)
       "answer": the correct word that fills the blank (must NOT be the main word)
   - "exampleSentences": an array of 1 object with "en" (English sentence) and "vi" (Vietnamese translation).
   - "sentenceSequence": an object with:
       "en": a natural, grammatically correct English sentence using the word. Complexity appropriate for CEFR level ${level}.
       "vi": exact Vietnamese translation of the English sentence.

Output STRICTLY as a single JSON object (NOT an array). Do not wrap in markdown.
Example:
{
  "word": "negotiate",
  "phonetic": "/nɪˈɡoʊ.ʃi.eɪt/",
  "partOfSpeech": "verb",
  "vietnameseMeaning": "thương lượng",
  "explanation": "Trao đổi, thảo luận với đối tác nhằm đi đến một thỏa hiệp.",
  "pronunciationTip": "Nhấn trọng âm ở âm tiết thứ 2: ne-GO-shi-ate",
  "distractors": ["navigate", "negligent", "nominate"],
  "collocations": [
    { "phrase": "negotiate a deal", "vietnamese": "thương lượng thỏa thuận" },
    { "phrase": "negotiate terms", "vietnamese": "thương lượng điều khoản" },
    { "phrase": "negotiate with", "vietnamese": "thương lượng với ai đó" }
  ],
  "collocationExercise": {
    "sentence": "We need to negotiate a ___ with the supplier.",
    "sentenceVi": "Chúng ta cần thương lượng một thỏa thuận với nhà cung cấp.",
    "options": ["deal", "term", "price", "product"],
    "answer": "deal"
  },
  "exampleSentences": [
    { "en": "They spent weeks negotiating the contract.", "vi": "Họ đã dành nhiều tuần để đàm phán." }
  ],
  "sentenceSequence": {
    "en": "We negotiated with the client successfully.",
    "vi": "Chúng tôi đã đàm phán thành công với khách hàng."
  }
}`;

    try {
        const promptContent = [];
        promptContent.push(`Word: "${wordObj.word}"`);
        if (wordObj.vietnameseMeaning && wordObj.vietnameseMeaning.trim() !== '') {
            promptContent.push(`Vietnamese meaning: "${wordObj.vietnameseMeaning}"`);
        }
        if (wordObj.partOfSpeech && wordObj.partOfSpeech.trim() !== '') {
            promptContent.push(`Required Part of Speech: "${wordObj.partOfSpeech}"`);
        }

        const response = await chatCompletion({
            systemPrompt,
            userContent: `Generate full learning data for this word:\n${promptContent.join('\n')}`,
            responseFormat: 'json',
            thinkingLevel: 'LOW'
        });

        const cleanedText = response.text.replace(/```json/gi, '').replace(/```/g, '').trim();
        let data = JSON.parse(cleanedText);
        // If AI returns an array, take the first item
        if (Array.isArray(data)) data = data[0];
        // Merge user-provided fields back in. If user had provided 'vietnameseMeaning' or 'partOfSpeech' manually, they override AI.
        const finalizedData = {
            ...data,
            ...wordObj, // this overwrites data with whatever was passed in wordObj
        };

        // Sometimes users might pass empty strings in wordObj which would overwrite AI's good answers. Let's strictly only overwrite if NOT empty.
        Object.keys(wordObj).forEach(key => {
            if (wordObj[key] === null || wordObj[key] === undefined || String(wordObj[key]).trim() === '') {
                finalizedData[key] = data[key];
            }
        });

        return finalizedData;
    } catch (e) {
        console.error('Failed to generate full word data:', e);
        throw new Error(`Không thể sinh nội dung cho từ "${wordObj.word}". Vui lòng thử lại.`);
    }
}

/**
 * Generate just details for a list of words (simpler version of generateFullWordData for TeacherTopics)
 * Returns array of objects with pos, ipa, meaning, collocations, etc.
 */
export async function generateWordsDetails(words, level = 'B1', topic = 'General') {
    if (!words || words.length === 0) return [];

    const systemPrompt = `You are an expert English teacher helping a Vietnamese teacher create vocabulary lists.
The topic or context is: "${topic}". Target CEFR level: ${level}.

The user will provide a list of English words. For each word, generate detailed information.
Output STRICTLY as a JSON array of objects, one for each input word. Do not wrap in markdown.
Example format for input ["apple"]:
[
  {
    "word": "apple",
    "pos": "n.",
    "ipa": "/ˈæp.əl/",
    "meaning": "quả táo",
    "usage1": "I ate a green apple.",
    "usage2": "An apple a day keeps the doctor away.",
    "collocations": ["eat an apple", "apple pie", "rotten apple"]
  }
]`;

    try {
        const wordListStr = Array.isArray(words) ? words.join(', ') : words;
        const response = await chatCompletion({
            systemPrompt,
            userContent: `Generate details for these words: ${wordListStr}`,
            responseFormat: 'json'
        });

        const cleanedText = response.text.replace(/```json/gi, '').replace(/```/g, '').trim();
        let data = JSON.parse(cleanedText);
        if (!Array.isArray(data)) {
            // Handle case where AI wraps it
            for (const key in data) {
                if (Array.isArray(data[key])) {
                    data = data[key];
                    break;
                }
            }
        }
        if (!Array.isArray(data)) {
            data = [data];
        }
        return data;
    } catch (e) {
        console.error('Failed to generate words details:', e);
        throw new Error('Lỗi khi dùng AI tạo thông tin từ vựng.');
    }
}

// ============================================================
// FILE-BASED CHAT COMPLETION (for PDF, images, etc.)
// ============================================================

async function fetchChatWithFileFromProxy({ systemPrompt, userContent, fileBase64, fileMimeType, responseFormat, thinkingLevel }) {
    const body = {
        modelProfile: MODEL_PROFILE,
        mode: 'file_chat',
        systemPrompt: systemPrompt || '',
        userContent: userContent || '',
        fileData: fileBase64,
        fileMimeType: fileMimeType || 'application/pdf',
        responseFormat: responseFormat === 'json' ? 'json_object' : null,
    };
    if (thinkingLevel) body.thinkingLevel = thinkingLevel.toUpperCase();

    const res = await fetch(PROXY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });

    const data = await res.json();
    if (data.error) throw new Error(data.error.message || data.error);

    return { text: data.choices?.[0]?.message?.content || '' };
}

async function fetchChatWithFileGoogle({ systemPrompt, userContent, fileBase64, fileMimeType, responseFormat, apiKey, thinkingLevel }) {
    const rawModel = getPrimaryModel();
    const model = rawModel.replace(/^(google|openrouter):/, '');
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const payload = {
        contents: [{
            role: 'user',
            parts: [
                { text: userContent },
                {
                    inline_data: {
                        mime_type: fileMimeType || 'application/pdf',
                        data: fileBase64
                    }
                }
            ]
        }],
    };
    if (systemPrompt) payload.system_instruction = { parts: { text: systemPrompt } };

    // Build generationConfig
    const genConfig = {};
    if (responseFormat === 'json') genConfig.responseMimeType = 'application/json';
    if (thinkingLevel) genConfig.thinkingConfig = { thinkingLevel: thinkingLevel.toUpperCase() };
    if (Object.keys(genConfig).length > 0) payload.generationConfig = genConfig;

    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (data.error) throw new Error(data.error.message);

    // When thinking is enabled, the response may contain thought parts before the text part
    const parts = data.candidates?.[0]?.content?.parts || [];
    const textPart = parts.find(p => p.text !== undefined && !p.thought);
    return { text: textPart?.text || parts[parts.length - 1]?.text || '' };
}
