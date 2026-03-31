import { chatCompletion } from './aiService';

/**
 * Extract questions from pasted text content using AI.
 * Returns an array of question objects ready to be saved via saveExamQuestion.
 *
 * @param {string} text - The pasted text content
 * @param {Object} examSettings - { cefrLevel, sectionId, examId }
 * @returns {Promise<Object[]>} Array of question objects
 */
export async function extractQuestionsFromText(text, examSettings = {}) {
    if (!text || !text.trim()) throw new Error('Nội dung trống. Vui lòng dán nội dung câu hỏi.');

    const { cefrLevel = 'A1', sectionId, examId } = examSettings;

    const systemPrompt = buildExtractionPrompt(cefrLevel);
    const userContent = `NỘI DUNG TÀI LIỆU CẦN PHÂN TÍCH:\n\"\"\"\n${text.trim()}\n\"\"\"`;

    try {
        const response = await chatCompletion({
            systemPrompt,
            userContent,
            responseFormat: 'json',
            thinkingLevel: 'high'
        });

        const cleanedText = response.text.replace(/```json/gi, '').replace(/```/g, '').trim();
        let data = JSON.parse(cleanedText);

        // Handle wrapper objects like { "questions": [...] }
        if (data && typeof data === 'object' && !Array.isArray(data)) {
            for (const key in data) {
                if (Array.isArray(data[key])) {
                    data = data[key];
                    break;
                }
            }
        }

        if (!Array.isArray(data)) {
            throw new Error('AI không trả về danh sách câu hỏi hợp lệ.');
        }

        // Normalize and attach exam metadata
        return data.map((q, idx) => normalizeQuestion(q, idx, sectionId, examId));
    } catch (e) {
        console.error('Failed to extract questions from text:', e);
        if (e.message.includes('JSON')) {
            throw new Error('Không thể phân tích kết quả AI. Vui lòng thử lại.');
        }
        throw e;
    }
}

/**
 * Extract questions from a PDF file using AI (Gemini supports inline PDF).
 * Falls back to text extraction if PDF inline is not available.
 *
 * @param {File} pdfFile - The PDF file
 * @param {Object} examSettings - { cefrLevel, sectionId, examId }
 * @returns {Promise<Object[]>} Array of question objects
 */
export async function extractQuestionsFromPDF(pdfFile, examSettings = {}) {
    if (!pdfFile) throw new Error('Không có file PDF.');

    // Validate file type
    if (pdfFile.type !== 'application/pdf') {
        throw new Error('File không phải PDF. Vui lòng chọn file PDF.');
    }

    // Validate file size (max 10MB)
    if (pdfFile.size > 10 * 1024 * 1024) {
        throw new Error('File quá lớn (tối đa 10MB).');
    }

    const { cefrLevel = 'A1', sectionId, examId } = examSettings;

    // Try to count pages using pdf.js-like approach via reading the PDF
    const pageCount = await estimatePDFPageCount(pdfFile);
    if (pageCount > 5) {
        throw new Error(`File PDF có ${pageCount} trang, vượt quá giới hạn 5 trang. Vui lòng cắt bớt tài liệu.`);
    }

    // Convert PDF to base64
    const base64 = await fileToBase64(pdfFile);

    const systemPrompt = buildExtractionPrompt(cefrLevel);
    const userContent = 'Phân tích tài liệu PDF đính kèm và trích xuất tất cả câu hỏi.';

    try {
        // Use chatCompletionWithFile which sends the PDF inline to Gemini
        const { chatCompletionWithFile } = await import('./aiService');
        const response = await chatCompletionWithFile({
            systemPrompt,
            userContent,
            fileBase64: base64,
            fileMimeType: 'application/pdf',
            responseFormat: 'json',
            thinkingLevel: 'high'
        });

        const cleanedText = response.text.replace(/```json/gi, '').replace(/```/g, '').trim();
        let data = JSON.parse(cleanedText);

        // Handle wrapper objects
        if (data && typeof data === 'object' && !Array.isArray(data)) {
            for (const key in data) {
                if (Array.isArray(data[key])) {
                    data = data[key];
                    break;
                }
            }
        }

        if (!Array.isArray(data)) {
            throw new Error('AI không trả về danh sách câu hỏi hợp lệ.');
        }

        return data.map((q, idx) => normalizeQuestion(q, idx, sectionId, examId));
    } catch (e) {
        console.error('Failed to extract questions from PDF:', e);
        if (e.message.includes('JSON')) {
            throw new Error('Không thể phân tích kết quả AI. Vui lòng thử lại.');
        }
        throw e;
    }
}

/**
 * Build the system prompt for question extraction.
 */
function buildExtractionPrompt(cefrLevel) {
    return `Bạn là một chuyên gia phân tích đề thi và bài tập tiếng Anh. Trình độ mục tiêu: ${cefrLevel}.

NHIỆM VỤ: Phân tích nội dung tài liệu được cung cấp và trích xuất TẤT CẢ câu hỏi thành dạng JSON có cấu trúc.

CÁC LOẠI CÂU HỎI ĐƯỢC HỖ TRỢ:
1. "multiple_choice" — Trắc nghiệm (có 4 đáp án, 1 đáp án đúng)
2. "fill_in_blank" — Điền vào chỗ trống (có word bank cho học viên chọn)
3. "fill_in_blank_typing" — Điền vào chỗ trống tự nhập (không có word bank)
4. "matching" — Nối cặp (ghép left-right)
5. "ordering" — Sắp xếp thứ tự
6. "essay" — Tự luận / viết đoạn văn

HƯỚNG DẪN FORMAT CHO TỪNG LOẠI:

### multiple_choice
{
  "type": "multiple_choice",
  "purpose": "Mục tiêu kiểm tra bằng tiếng Việt",
  "targetSkill": "grammar|reading|listening|vocabulary|writing|speaking",
  "points": 1,
  "variations": [{
    "text": "Nội dung câu hỏi",
    "options": ["Đáp án A", "Đáp án B", "Đáp án C", "Đáp án D"],
    "correctAnswer": 0,
    "explanation": "Giải thích bằng tiếng Việt"
  }]
}
Lưu ý: "correctAnswer" là INDEX (0-3) của đáp án đúng trong mảng "options".

### fill_in_blank (có word bank)
{
  "type": "fill_in_blank",
  "purpose": "Mục tiêu kiểm tra bằng tiếng Việt",
  "targetSkill": "grammar|vocabulary",
  "points": 1,
  "variations": [{
    "text": "She {{is}} a talented doctor at the hospital.",
    "distractors": ["am", "are", "be"],
    "explanation": "Giải thích bằng tiếng Việt"
  }]
}
Lưu ý: Từ cần điền được bọc bằng {{từ}}. KHÔNG dùng ___ hay correctAnswer. Đáp án đúng nằm trong {{...}}.

### fill_in_blank_typing (tự nhập, không có word bank)
{
  "type": "fill_in_blank_typing",
  "purpose": "...",
  "targetSkill": "grammar|vocabulary",
  "points": 1,
  "variations": [{
    "text": "They {{have been}} living here since 2010.",
    "explanation": "Giải thích bằng tiếng Việt"
  }]
}

### matching (nối cặp)
{
  "type": "matching",
  "purpose": "...",
  "targetSkill": "vocabulary|reading",
  "points": 1,
  "variations": [{
    "text": "Nối từ với nghĩa phù hợp",
    "pairs": [
      { "left": "abundant", "right": "dồi dào" },
      { "left": "scarce", "right": "khan hiếm" }
    ],
    "explanation": "Giải thích bằng tiếng Việt"
  }]
}

### ordering (sắp xếp thứ tự)
{
  "type": "ordering",
  "purpose": "...",
  "targetSkill": "grammar|reading",
  "points": 1,
  "variations": [{
    "text": "Sắp xếp các từ thành câu hoàn chỉnh",
    "items": ["I", "have", "been", "to", "Paris"],
    "explanation": "Giải thích bằng tiếng Việt"
  }]
}
Lưu ý: Mảng "items" phải được liệt kê THEO ĐÚNG THỨ TỰ (hệ thống sẽ xáo trộn khi hiển thị).

### essay (tự luận)
{
  "type": "essay",
  "purpose": "...",
  "targetSkill": "writing|speaking",
  "points": 10,
  "variations": [{
    "text": "Nội dung câu hỏi tự luận",
    "explanation": "Hướng dẫn chấm điểm bằng tiếng Việt"
  }]
}

QUY TẮC QUAN TRỌNG:
1. Mỗi câu hỏi CHỈ CÓ 1 variation (Variation 1 duy nhất) trong mảng "variations".
2. Trường "purpose" mô tả mục tiêu kiểm tra bằng tiếng Việt (ví dụ: "Kiểm tra cấu trúc thì hiện tại đơn").
3. Trường "targetSkill" PHẢI là một trong: "listening", "speaking", "reading", "writing", "grammar", "vocabulary".
4. Trường "explanation" trong mỗi variation PHẢI viết bằng TIẾNG VIỆT.
5. Trường "points" mặc định = 1 cho trắc nghiệm/điền từ, = 10 cho tự luận. Nếu đề ghi rõ điểm thì dùng điểm trong đề.
6. Nếu không thể xác định loại câu hỏi, mặc định dùng "multiple_choice".
7. Nếu tài liệu không chứa câu hỏi nào, trả về mảng rỗng [].
8. Phải trích xuất CHÍNH XÁC nội dung câu hỏi và đáp án từ tài liệu, KHÔNG tự bịa thêm hay sửa đổi.

Trả về JSON dạng mảng:
[
  { câu hỏi 1 },
  { câu hỏi 2 },
  ...
]`;
}

/**
 * Normalize a raw AI question into the app's expected format.
 */
function normalizeQuestion(rawQ, index, sectionId, examId) {
    const type = rawQ.type || 'multiple_choice';
    const validTypes = ['multiple_choice', 'fill_in_blank', 'fill_in_blank_typing', 'matching', 'ordering', 'categorization', 'essay', 'audio_recording'];
    const finalType = validTypes.includes(type) ? type : 'multiple_choice';

    // Validate targetSkill
    const validSkills = ['listening', 'speaking', 'reading', 'writing', 'grammar', 'vocabulary'];
    const targetSkill = validSkills.includes(rawQ.targetSkill) ? rawQ.targetSkill : 'grammar';

    // Ensure variations array exists with at least 1 variation
    let variations = rawQ.variations;
    if (!Array.isArray(variations) || variations.length === 0) {
        // Try to construct from top-level fields (fallback)
        variations = [{
            text: rawQ.text || rawQ.question || '',
            options: rawQ.options || undefined,
            correctAnswer: rawQ.correctAnswer ?? undefined,
            pairs: rawQ.pairs || undefined,
            items: rawQ.items || undefined,
            distractors: rawQ.distractors || undefined,
            explanation: rawQ.explanation || ''
        }];
    }

    // Keep only 1 variation (Variation 1)
    variations = [variations[0]];

    // Validate variation structure based on type
    const v = variations[0];
    if (finalType === 'multiple_choice') {
        if (!Array.isArray(v.options)) v.options = ['', '', '', ''];
        while (v.options.length < 4) v.options.push('');
        if (typeof v.correctAnswer !== 'number' || v.correctAnswer < 0 || v.correctAnswer >= v.options.length) {
            v.correctAnswer = 0;
        }
    } else if (finalType === 'fill_in_blank') {
        if (!Array.isArray(v.distractors)) v.distractors = [];
    } else if (finalType === 'matching') {
        if (!Array.isArray(v.pairs)) v.pairs = [{ left: '', right: '' }];
    } else if (finalType === 'ordering') {
        if (!Array.isArray(v.items)) v.items = [''];
    }

    return {
        type: finalType,
        purpose: rawQ.purpose || '',
        targetSkill,
        points: rawQ.points || (finalType === 'essay' ? 10 : 1),
        hasContext: false,
        sectionId: sectionId || '',
        examId: examId || '',
        variations
    };
}

/**
 * Estimate the number of pages in a PDF file by reading the binary.
 * This is a heuristic — counts /Type /Page occurrences (excluding /Pages).
 */
async function estimatePDFPageCount(file) {
    try {
        const buffer = await file.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        // Look for /Type /Page pattern in the PDF binary
        const text = new TextDecoder('latin1').decode(bytes);
        // Count /Type /Page but not /Type /Pages
        const matches = text.match(/\/Type\s*\/Page(?!s)/g);
        return matches ? matches.length : 1;
    } catch {
        return 1; // Default to 1 if can't determine
    }
}

/**
 * Convert a File to base64 string (without data URI prefix).
 */
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const base64String = reader.result.split(',')[1];
            resolve(base64String);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}
