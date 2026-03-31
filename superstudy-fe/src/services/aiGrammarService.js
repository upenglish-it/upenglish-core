import { chatCompletion } from './aiService';

/**
 * Shuffle options for a multiple-choice variation so the correct answer
 * is NOT always at index 0. Updates correctAnswer index accordingly.
 */
function shuffleMultipleChoiceOptions(variation) {
    if (!variation || !Array.isArray(variation.options) || variation.options.length < 2) return variation;
    const correctIdx = typeof variation.correctAnswer === 'number' ? variation.correctAnswer : 0;
    const correctOption = variation.options[correctIdx];
    // Fisher-Yates shuffle
    const opts = [...variation.options];
    for (let i = opts.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [opts[i], opts[j]] = [opts[j], opts[i]];
    }
    const newCorrectIdx = opts.indexOf(correctOption);
    return { ...variation, options: opts, correctAnswer: newCorrectIdx >= 0 ? newCorrectIdx : 0 };
}

/**
 * Generate 4 additional variations for a given grammar question and improve the original.
 * @param {Object} originalQuestion The original question data (variation 1)
 * @param {string} purpose The learning purpose of this question
 * @param {string} type The type of question (e.g., "multiple_choice", "fill_in_blank")
 * @param {Object} settings Optional settings like { targetLevel: 'A1', targetAge: '10-15' }
 * @returns {Promise<Object>} Object containing "improved_original" and "variations" (Array of 4)
 */
export async function generateGrammarVariations(originalQuestion, purpose, type, settings = {}) {
    const { targetLevel = 'Không xác định', targetAge = 'Không xác định', hasContext = false, contextHtml = '', isVietnameseQuestion = false, vocabularyWords = [], vocabularyTopicName = '' } = settings;

    const vocabInstruction = vocabularyWords.length > 0 ? `
[CHỦ ĐỀ TỪ VỰNG ƯU TIÊN]
Khi tạo câu hỏi và đáp án, hãy ƯU TIÊN sử dụng các từ vựng sau (từ chủ đề "${vocabularyTopicName}"):
${vocabularyWords.slice(0, 50).map(w => `- ${w.word}${w.meaning ? ' (' + w.meaning + ')' : ''}`).join('\n')}
Lưu ý: Không bắt buộc dùng tất cả, nhưng hãy cố gắng lồng ghép tự nhiên vào nội dung câu hỏi, đáp án, hoặc ngữ cảnh. Ưu tiên sáng tạo câu hỏi xoay quanh chủ đề và từ vựng này. KHÔNG được in đậm hay đánh dấu đặc biệt từ vựng chỉ vì nó nằm trong danh sách — chỉ format (bold, italic, underline) khi cần thiết để trình bày câu hỏi chuyên nghiệp và dễ nhìn cho học viên.
` : '';

    const contextInstruction = hasContext ? `
[QUAN TRỌNG: CÂU HỎI CÓ KÈM THEO ĐOẠN NGỮ CẢNH (BÀI ĐỌC/VIDEO)]
Nội dung Ngữ cảnh:
"""
${contextHtml}
"""
YÊU CẦU BẮT BUỘC: 
- Học viên phải dựa vào NGỮ CẢNH trên để trả lời.
- KHÔNG TỰ BỊA RA ngữ cảnh khác, bài đọc khác, hay tình huống không có trong Ngữ cảnh đã cho.
- Các câu hỏi (variations) phải đặt câu hỏi trực tiếp để hỏi về thông tin trong Ngữ cảnh. Ví dụ: THAY VÌ "Read the news: 'X did Y'. Question: Who did Y?", HÃY VIẾT: "According to the passage, who did Y?".
` : '';

    // Count items from original question for enforcing in prompt
    let itemCountInstruction = '';
    let typeInstruction = '';
    if (type === 'fill_in_blank' || type === 'fill_in_blanks') {
        const blankCount = (originalQuestion.text || '').match(/\{\{.+?\}\}/g)?.length || 0;
        itemCountInstruction = blankCount > 0 ? `\n- CỰC KỲ QUAN TRỌNG: Mỗi variation (kể cả improved_original) PHẢI có ĐÚNG ${blankCount} chỗ trống \`{{...}}\`. Không được nhiều hơn hoặc ít hơn vì điểm số được tính theo số lượng chỗ trống.` : '';
        typeInstruction = `
- ĐỐI VỚI DẠNG ĐIỀN VÀO CHỖ TRỐNG: 
  + Đề bài (\`text\`) phải là một câu hoàn chỉnh trong đó các từ cần điền được bọc bằng dấu ngoặc nhọn kép \`{{từ}}\`. Ví dụ: "She {{is}} a talented doctor at the local hospital."
  + KHÔNG dùng \`___\` hay \`correctAnswer\`. Đáp án đúng được trích xuất tự động từ {{...}}.
  + Thêm trường \`distractors\` chứa mảng 2-4 từ gây nhiễu. Ví dụ: \"distractors\": ["am", "are", "be"]
  + CỰC KỲ QUAN TRỌNG VỀ DISTRACTORS: Từ gây nhiễu PHẢI là từ SAI hoàn toàn trong ngữ cảnh câu hỏi — tức là nếu điền vào chỗ trống sẽ tạo ra câu SAI ngữ pháp hoặc SAI nghĩa. TUYỆT ĐỐI KHÔNG được dùng từ đồng nghĩa, từ có thể thay thế được, hoặc từ cũng đúng ngữ pháp trong ngữ cảnh đó làm distractor. Ví dụ: nếu đáp án là "if" trong câu "let me know {{if}} the delivery will arrive" thì KHÔNG được dùng "whether" làm distractor vì "whether" cũng đúng trong câu này. Hãy chọn từ cùng loại từ nhưng SAI ngữ pháp/ngữ nghĩa rõ ràng.
  + Mỗi variation phải có cấu trúc: { "text": "câu có {{từ cần điền}}", "distractors": [...], "explanation": "..." }${itemCountInstruction}`;
    } else if (type === 'fill_in_blank_typing') {
        const blankCount = (originalQuestion.text || '').match(/\{\{.+?\}\}/g)?.length || 0;
        itemCountInstruction = blankCount > 0 ? `\n- CỰC KỲ QUAN TRỌNG: Mỗi variation (kể cả improved_original) PHẢI có ĐÚNG ${blankCount} chỗ trống \`{{...}}\`. Không được nhiều hơn hoặc ít hơn vì điểm số được tính theo số lượng chỗ trống.` : '';
        typeInstruction = `
- ĐỐI VỚI DẠNG ĐIỀN VÀO CHỖ TRỐNG (TỰ NHẬP):
  + Đề bài (\`text\`) phải là một câu hoàn chỉnh trong đó các từ cần điền được bọc bằng dấu ngoặc nhọn kép \`{{từ}}\`. Ví dụ: "She {{is}} a talented doctor at the local hospital."
  + KHÔNG dùng \`___\` hay \`correctAnswer\`. Đáp án đúng được trích xuất tự động từ {{...}}.
  + KHÔNG cần trường \`distractors\` vì học viên sẽ tự nhập câu trả lời.
  + Mỗi variation phải có cấu trúc: { "text": "câu có {{từ cần điền}}", "explanation": "..." }${itemCountInstruction}`;
    } else if (type === 'matching') {
        const pairCount = (originalQuestion.pairs || []).length;
        itemCountInstruction = pairCount > 0 ? `\n  + CỰC KỲ QUAN TRỌNG: Mỗi variation PHẢI có ĐÚNG ${pairCount} cặp trong mảng \`pairs\`. Không được nhiều hơn hoặc ít hơn vì điểm số được tính theo số lượng cặp ghép.` : '';
        typeInstruction = `\n- ĐỐI VỚI DẠNG KẾT NỐI (MATCHING): Sinh ra các cặp câu/từ mới trong mảng \`pairs\` (gồm \`left\` và \`right\` ghép đúng với nhau).${itemCountInstruction}`;
    } else if (type === 'categorization') {
        const itemCount = (originalQuestion.items || []).length;
        const groupNames = (originalQuestion.groups || []).join(', ');
        itemCountInstruction = itemCount > 0 ? `\n  + CỰC KỲ QUAN TRỌNG: Mỗi variation PHẢI có ĐÚNG ${itemCount} mục trong mảng \`items\` và giữ nguyên các nhóm: [${groupNames}]. Không được nhiều hơn hoặc ít hơn vì điểm số được tính theo số lượng mục phân loại.` : '';
        typeInstruction = `\n- ĐỐI VỚI DẠNG PHÂN LOẠI (CATEGORIZATION): Giữ nguyên ý nghĩa các nhóm trong \`groups\`, sinh ra các mục từ/câu mới trong mảng \`items\` và chỉ định trường \`group\` chuẩn xác cho mỗi \`item\`.${itemCountInstruction}`;
    } else if (type === 'ordering') {
        const itemCount = (originalQuestion.items || []).length;
        itemCountInstruction = itemCount > 0 ? `\n  + CỰC KỲ QUAN TRỌNG: Variation PHẢI có ĐÚNG ${itemCount} mục trong mảng \`items\`. Không được nhiều hơn hoặc ít hơn vì điểm số được tính theo số lượng mục.` : '';
        typeInstruction = `\n- ĐỐI VỚI DẠNG SẮP XẾP THỨ TỰ (ORDERING): Sinh ra mảng \`items\` mới chứa các mục cần sắp xếp, được liệt kê THEO ĐÚNG THỨ TỰ (hệ thống sẽ xáo trộn khi hiển thị cho học viên).${itemCountInstruction}`;
    } else if (type === 'essay') {
        typeInstruction = `\n- ĐỐI VỚI DẠNG VIẾT LUẬN / TỰ LUẬN (ESSAY): Chỉ sinh trường \`text\` (nội dung câu hỏi/đề bài) và \`explanation\` (gợi ý đáp án mẫu hoặc hướng dẫn viết). KHÔNG CÓ trường \`options\`, \`correctAnswer\`, \`pairs\`, hay \`items\`. Mỗi variation phải có cấu trúc: { "text": "đề bài viết luận...", "explanation": "gợi ý/đáp án mẫu..." }`;
    } else if (type === 'audio_recording') {
        typeInstruction = `\n- ĐỐI VỚI DẠNG THU ÂM / GHI ÂM (AUDIO RECORDING): Chỉ sinh trường \`text\` (câu hỏi/đề bài yêu cầu học viên nói) và \`explanation\` (đáp án mẫu hoặc gợi ý trả lời). KHÔNG CÓ trường \`options\`, \`correctAnswer\`, \`pairs\`, hay \`items\`. Mỗi variation phải có cấu trúc: { "text": "đề bài nói...", "explanation": "đáp án mẫu/gợi ý..." }`;
    }

    // Multiple choice: add comprehensive structure instruction
    if (type === 'multiple_choice') {
        const optionCount = (originalQuestion.options || []).length || 4;
        typeInstruction += `
- ĐỐI VỚI DẠNG TRẮC NGHIỆM (MULTIPLE CHOICE):
  + Mỗi variation PHẢI có ĐÚNG ${optionCount} đáp án trong mảng \`options\`.
  + Trường \`correctAnswer\` là INDEX (số nguyên, bắt đầu từ 0) của đáp án đúng trong mảng \`options\`.
  + Các đáp án SAI (distractors) phải tự nhiên, hợp lý và đáng tin — KHÔNG được dùng đáp án vô nghĩa hoặc quá dễ phân biệt. NHƯNG cũng KHÔNG được dùng đáp án mà CŨNG ĐÚNG trong ngữ cảnh câu hỏi — phải đảm bảo chỉ có DUY NHẤT MỘT đáp án đúng.
  + VỊ TRÍ ĐÁP ÁN ĐÚNG (\`correctAnswer\`) PHẢI ĐƯỢC XÁO TRỘN NGẪU NHIÊN giữa các variations — KHÔNG ĐƯỢC luôn để đáp án đúng ở vị trí 0 (đáp án A). Hãy phân bổ đều vị trí đáp án đúng: một số ở vị trí 0, một số ở vị trí 1, 2, hoặc 3.
  + Cấu trúc: { "text": "câu hỏi...", "options": ["A", "B", "C", "D"], "correctAnswer": 2, "explanation": "giải thích..." }`;
    }

    const systemPrompt = `Bạn là một chuyên gia thiết kế bài luyện ngữ pháp/đọc hiểu tiếng Anh.
Loại câu hỏi: "${type}"
Mục đích kiểm tra: "${purpose}"
Độ tuổi học viên mục tiêu: ${targetAge}
Trình độ học viên mục tiêu: ${targetLevel}
${contextInstruction}

Nhiệm vụ của bạn là:
1. Sửa lỗi chính tả, ngữ pháp hoặc cấu trúc câu/đáp án của Đề bài gốc (nếu có) để câu hỏi trở nên chuẩn xác, tự nhiên và rõ ràng nhất có thể. Đặt vào trường "improved_original".
2. Tạo thêm 4 phiên bản (variations) hoàn toàn mới dựa trên Đề bài gốc mang tính tương đương.

[CỰC KỲ QUAN TRỌNG — BẢO TOÀN CẤU TRÚC VĂN BẢN CỦA GIÁO VIÊN]
Trước khi tạo variations, hãy PHÂN TÍCH KỸ cấu trúc trường \`text\` của Đề bài gốc:
- Nếu giáo viên viết NHIỀU DÒNG (ví dụ: dòng 1 là hướng dẫn/yêu cầu, dòng 2 là nội dung câu hỏi chính), thì TẤT CẢ variations (bao gồm improved_original) PHẢI GIỮ NGUYÊN số dòng và vai trò của từng dòng.
- KHÔNG ĐƯỢC TỰ Ý bỏ đi dòng hướng dẫn, gộp các dòng lại, hoặc tách 1 dòng thành nhiều dòng.
- KHÔNG ĐƯỢC thay đổi cấu trúc trình bày: nếu giáo viên dùng ngắt dòng (\n hoặc <br>), thì variations cũng phải dùng y hệt.
- Giữ nguyên các HTML tag format (<b>, <i>, <u>, <strong>, <em>) mà giáo viên đã dùng. Chỉ thêm format khi cần thiết để cải thiện trình bày chuyên nghiệp.
- Đối với improved_original: CHỈ sửa chính tả, cải thiện ngôn ngữ cho dễ hiểu hơn, hoặc thêm format in đậm/nghiêng/gạch chân khi phù hợp. TUYỆT ĐỐI KHÔNG thay đổi cấu trúc hay bỏ nội dung.
- Đối với variations 2-5: Tạo nội dung mới nhưng PHẢI theo ĐÚNG cấu trúc/mẫu trình bày của Variation 1 (cùng số dòng, cùng vai trò từng dòng, cùng kiểu format).

Các phiên bản mới phải:
- Kiểm tra cùng một điểm ngữ pháp và bám sát mục đích kiểm tra.
- Mọi cấu trúc dữ liệu JSON sinh ra phải y hệt như cấu trúc của Đề bài gốc.${typeInstruction}
- Vô cùng quan trọng: TỪ VỰNG VÀ NGỮ CẢNH phải phù hợp tuyệt đối với Độ tuổi mục tiêu (${targetAge}) và Trình độ mục tiêu (${targetLevel}) của học viên. Ví dụ: Kids (5-8) dùng từ vật nuôi/đồ chơi đơn giản; Đối tượng B2/IELTS dùng từ vựng học thuật/công sở.
${vocabInstruction}
- Độ khó về mặt ngữ pháp tương đương với câu hỏi gốc.
- TOÀN BỘ PHẦN GIẢI THÍCH (trường \`explanation\` trong từng variation) PHẢI ĐƯỢC VIẾT BẰNG TIẾNG VIỆT để học viên dễ hiểu.
${isVietnameseQuestion ? '- Cực kỳ quan trọng: NỘI DUNG CÂU HỎI (trường `text` trong từng variation) PHẢI ĐƯỢC DỊCH/VIẾT BẰNG TIẾNG VIỆT để học viên dễ hiểu (các đáp án đi kèm hoặc nội dung điền/nối thì giữ nguyên tuỳ thuộc vào câu hỏi và ngữ pháp đang kiểm tra).' : ''}

Trả về kết quả chuẩn JSON với format CHÍNH XÁC như sau:
{
  "improved_original": { /* Dữ liệu Variation 1 đã được sửa lỗi/hoàn thiện */ },
  "variations": [
    { /* variation 2 data */ },
    { /* variation 3 data */ },
    { /* variation 4 data */ },
    { /* variation 5 data */ }
  ]
}`;

    const userContent = `Đề bài gốc (Variation 1):\n${JSON.stringify(originalQuestion, null, 2)}`;

    try {
        const response = await chatCompletion({
            systemPrompt: systemPrompt,
            userContent: userContent,
            responseFormat: 'json',
            thinkingLevel: 'high'
        });

        const data = JSON.parse(response.text);

        if (data.improved_original && data.variations && data.variations.length >= 4) {
            // Shuffle multiple choice options so correct answer isn't always A
            if (type === 'multiple_choice') {
                data.improved_original = shuffleMultipleChoiceOptions(data.improved_original);
                data.variations = data.variations.map(v => shuffleMultipleChoiceOptions(v));
            }
            return data;
        }

        // Return mock variations if API failed to format properly
        return {
            improved_original: { ...originalQuestion, text: "[Improved AI] " + (originalQuestion.text || originalQuestion.content || "") },
            variations: [
                { ...originalQuestion, text: "[Variation 2] " + (originalQuestion.text || originalQuestion.content || "") },
                { ...originalQuestion, text: "[Variation 3] " + (originalQuestion.text || originalQuestion.content || "") },
                { ...originalQuestion, text: "[Variation 4] " + (originalQuestion.text || originalQuestion.content || "") },
                { ...originalQuestion, text: "[Variation 5] " + (originalQuestion.text || originalQuestion.content || "") }
            ]
        };
    } catch (error) {
        console.error("Error generating variations from AI:", error);
        throw new Error('Không thể tự động tạo Variations. Kiểm tra lại API Key hoặc cấu hình.');
    }
}

/**
 * Generate 1 single additional variation for a given grammar question.
 * @param {Object} originalQuestion The original question data (variation 1)
 * @param {string} purpose The learning purpose of this question
 * @param {string} type The type of question (e.g., "multiple_choice", "fill_in_blank")
 * @param {Object} settings Optional settings like { targetLevel: 'A1', targetAge: '10-15' }
 * @returns {Promise<Object>} Object containing the new variation data
 */
export async function generateSingleGrammarVariation(originalQuestion, purpose, type, settings = {}) {
    const { targetLevel = 'Không xác định', targetAge = 'Không xác định', hasContext = false, contextHtml = '', isVietnameseQuestion = false, vocabularyWords = [], vocabularyTopicName = '' } = settings;

    const vocabInstruction = vocabularyWords.length > 0 ? `
[CHỦ ĐỀ TỪ VỰNG ƯU TIÊN]
Khi tạo câu hỏi và đáp án, hãy ƯU TIÊN sử dụng các từ vựng sau (từ chủ đề "${vocabularyTopicName}"):
${vocabularyWords.slice(0, 50).map(w => `- ${w.word}${w.meaning ? ' (' + w.meaning + ')' : ''}`).join('\n')}
Lưu ý: Không bắt buộc dùng tất cả, nhưng hãy cố gắng lồng ghép tự nhiên vào nội dung câu hỏi, đáp án, hoặc ngữ cảnh. Ưu tiên sáng tạo câu hỏi xoay quanh chủ đề và từ vựng này.
` : '';

    const contextInstruction = hasContext ? `
[QUAN TRỌNG: CÂU HỎI CÓ KÈM THEO ĐOẠN NGỮ CẢNH (BÀI ĐỌC/VIDEO)]
Nội dung Ngữ cảnh:
"""
${contextHtml}
"""
YÊU CẦU BẮT BUỘC: 
- Học viên phải dựa vào NGỮ CẢNH trên để trả lời.
- KHÔNG TỰ BỊA RA ngữ cảnh khác, bài đọc khác, hay tình huống không có trong Ngữ cảnh đã cho.
- Câu hỏi (variation) phải đặt câu hỏi trực tiếp để hỏi về thông tin trong Ngữ cảnh.
` : '';

    // Count items from original question for enforcing in prompt
    let itemCountInstruction = '';
    let typeInstruction = '';
    if (type === 'fill_in_blank' || type === 'fill_in_blanks') {
        const blankCount = (originalQuestion.text || '').match(/\{\{.+?\}\}/g)?.length || 0;
        itemCountInstruction = blankCount > 0 ? `\n  + CỰC KỲ QUAN TRỌNG: Variation PHẢI có ĐÚNG ${blankCount} chỗ trống \`{{...}}\`. Không được nhiều hơn hoặc ít hơn vì điểm số được tính theo số lượng chỗ trống.` : '';
        typeInstruction = `
- ĐỐI VỚI DẠNG ĐIỀN VÀO CHỖ TRỐNG: 
  + Đề bài (\`text\`) phải là một câu hoàn chỉnh trong đó các từ cần điền được bọc bằng dấu ngoặc nhọn kép \`{{từ}}\`. Ví dụ: "She {{is}} a talented doctor at the local hospital."
  + KHÔNG dùng \`___\` hay \`correctAnswer\`. Đáp án đúng được trích xuất tự động từ {{...}}.
  + Thêm trường \`distractors\` chứa mảng 2-4 từ gây nhiễu. Ví dụ: \"distractors\": ["am", "are", "be"]
  + CỰC KỲ QUAN TRỌNG VỀ DISTRACTORS: Từ gây nhiễu PHẢI là từ SAI hoàn toàn trong ngữ cảnh câu hỏi — tức là nếu điền vào chỗ trống sẽ tạo ra câu SAI ngữ pháp hoặc SAI nghĩa. TUYỆT ĐỐI KHÔNG được dùng từ đồng nghĩa, từ có thể thay thế được, hoặc từ cũng đúng ngữ pháp trong ngữ cảnh đó làm distractor. Ví dụ: nếu đáp án là "if" trong câu "let me know {{if}} the delivery will arrive" thì KHÔNG được dùng "whether" làm distractor vì "whether" cũng đúng trong câu này. Hãy chọn từ cùng loại từ nhưng SAI ngữ pháp/ngữ nghĩa rõ ràng.
  + Mỗi variation phải có cấu trúc: { "text": "câu có {{từ cần điền}}", "distractors": [...], "explanation": "..." }${itemCountInstruction}`;
    } else if (type === 'fill_in_blank_typing') {
        const blankCount = (originalQuestion.text || '').match(/\{\{.+?\}\}/g)?.length || 0;
        itemCountInstruction = blankCount > 0 ? `\n  + CỰC KỲ QUAN TRỌNG: Variation PHẢI có ĐÚNG ${blankCount} chỗ trống \`{{...}}\`. Không được nhiều hơn hoặc ít hơn vì điểm số được tính theo số lượng chỗ trống.` : '';
        typeInstruction = `
- ĐỐI VỚI DẠNG ĐIỀN VÀO CHỖ TRỐNG (TỰ NHẬP):
  + Đề bài (\`text\`) phải là một câu hoàn chỉnh trong đó các từ cần điền được bọc bằng dấu ngoặc nhọn kép \`{{từ}}\`. Ví dụ: "She {{is}} a talented doctor at the local hospital."
  + KHÔNG dùng \`___\` hay \`correctAnswer\`. Đáp án đúng được trích xuất tự động từ {{...}}.
  + KHÔNG cần trường \`distractors\` vì học viên sẽ tự nhập câu trả lời.
  + Mỗi variation phải có cấu trúc: { "text": "câu có {{từ cần điền}}", "explanation": "..." }${itemCountInstruction}`;
    } else if (type === 'matching') {
        const pairCount = (originalQuestion.pairs || []).length;
        itemCountInstruction = pairCount > 0 ? `\n  + CỰC KỲ QUAN TRỌNG: Variation PHẢI có ĐÚNG ${pairCount} cặp trong mảng \`pairs\`. Không được nhiều hơn hoặc ít hơn vì điểm số được tính theo số lượng cặp ghép.` : '';
        typeInstruction = `\n- ĐỐI VỚI DẠNG KẾT NỐI (MATCHING): Sinh ra các cặp câu/từ mới trong mảng \`pairs\` (gồm \`left\` và \`right\` ghép đúng với nhau).${itemCountInstruction}`;
    } else if (type === 'categorization') {
        const itemCount = (originalQuestion.items || []).length;
        const groupNames = (originalQuestion.groups || []).join(', ');
        itemCountInstruction = itemCount > 0 ? `\n  + CỰC KỲ QUAN TRỌNG: Variation PHẢI có ĐÚNG ${itemCount} mục trong mảng \`items\` và giữ nguyên các nhóm: [${groupNames}]. Không được nhiều hơn hoặc ít hơn vì điểm số được tính theo số lượng mục phân loại.` : '';
        typeInstruction = `\n- ĐỐI VỚI DẠNG PHÂN LOẠI (CATEGORIZATION): Giữ nguyên ý nghĩa các nhóm trong \`groups\`, sinh ra các mục từ/câu mới trong mảng \`items\` và chỉ định trường \`group\` chuẩn xác cho mỗi \`item\`.${itemCountInstruction}`;
    } else if (type === 'ordering') {
        const itemCount = (originalQuestion.items || []).length;
        itemCountInstruction = itemCount > 0 ? `\n  + CỰC KỲ QUAN TRỌNG: Variation PHẢI có ĐÚNG ${itemCount} mục trong mảng \`items\`. Không được nhiều hơn hoặc ít hơn vì điểm số được tính theo số lượng mục.` : '';
        typeInstruction = `\n- ĐỐI VỚI DẠNG SẮP XẾP THỨ TỰ (ORDERING): Sinh ra mảng \`items\` mới chứa các mục cần sắp xếp, được liệt kê THEO ĐÚNG THỨ TỰ (hệ thống sẽ xáo trộn khi hiển thị cho học viên).${itemCountInstruction}`;
    } else if (type === 'essay') {
        typeInstruction = `\n- ĐỐI VỚI DẠNG VIẾT LUẬN / TỰ LUẬN (ESSAY): Chỉ sinh trường \`text\` (nội dung câu hỏi/đề bài) và \`explanation\` (gợi ý đáp án mẫu hoặc hướng dẫn viết). KHÔNG CÓ trường \`options\`, \`correctAnswer\`, \`pairs\`, hay \`items\`. Cấu trúc: { "text": "đề bài viết luận...", "explanation": "gợi ý/đáp án mẫu..." }`;
    } else if (type === 'audio_recording') {
        typeInstruction = `\n- ĐỐI VỚI DẠNG THU ÂM / GHI ÂM (AUDIO RECORDING): Chỉ sinh trường \`text\` (câu hỏi/đề bài yêu cầu học viên nói) và \`explanation\` (đáp án mẫu hoặc gợi ý trả lời). KHÔNG CÓ trường \`options\`, \`correctAnswer\`, \`pairs\`, hay \`items\`. Cấu trúc: { "text": "đề bài nói...", "explanation": "đáp án mẫu/gợi ý..." }`;
    }

    // Multiple choice: add comprehensive structure instruction
    if (type === 'multiple_choice') {
        const optionCount = (originalQuestion.options || []).length || 4;
        typeInstruction += `
- ĐỐI VỚI DẠNG TRẮC NGHIỆM (MULTIPLE CHOICE):
  + Mỗi variation PHẢI có ĐÚNG ${optionCount} đáp án trong mảng \`options\`.
  + Trường \`correctAnswer\` là INDEX (số nguyên, bắt đầu từ 0) của đáp án đúng trong mảng \`options\`.
  + Các đáp án SAI (distractors) phải tự nhiên, hợp lý và đáng tin — KHÔNG được dùng đáp án vô nghĩa hoặc quá dễ phân biệt. NHƯNG cũng KHÔNG được dùng đáp án mà CŨNG ĐÚNG trong ngữ cảnh câu hỏi — phải đảm bảo chỉ có DUY NHẤT MỘT đáp án đúng.
  + VỊ TRÍ ĐÁP ÁN ĐÚNG PHẢI ĐƯỢC XÁO TRỘN NGẪU NHIÊN giữa các variations.
  + Cấu trúc: { "text": "câu hỏi...", "options": ["A", "B", "C", "D"], "correctAnswer": 2, "explanation": "giải thích..." }`;
    }

    const systemPrompt = `Bạn là một chuyên gia thiết kế bài luyện ngữ pháp/đọc hiểu tiếng Anh.
Loại câu hỏi: "${type}"
Mục đích kiểm tra: "${purpose}"
Độ tuổi học viên mục tiêu: ${targetAge}
Trình độ học viên mục tiêu: ${targetLevel}
${contextInstruction}

Nhiệm vụ của bạn là:
1. Tạo 1 phiên bản (variation) hoàn toàn mới dựa trên Đề bài gốc mang tính tương đương.

[CỰC KỲ QUAN TRỌNG — BẢO TOÀN CẤU TRÚC VĂN BẢN CỦA GIÁO VIÊN]
Hãy PHÂN TÍCH KỸ cấu trúc trường \`text\` của Đề bài gốc:
- Nếu giáo viên viết NHIỀU DÒNG (ví dụ: dòng 1 là hướng dẫn/yêu cầu, dòng 2 là nội dung câu hỏi chính), thì variation mới PHẢI GIỮ NGUYÊN số dòng và vai trò của từng dòng.
- KHÔNG ĐƯỢC TỰ Ý bỏ đi dòng hướng dẫn, gộp các dòng lại, hoặc tách 1 dòng thành nhiều dòng.
- KHÔNG ĐƯỢC thay đổi cấu trúc trình bày: nếu giáo viên dùng ngắt dòng (\n hoặc <br>), thì variation cũng phải dùng y hệt.
- Giữ nguyên các HTML tag format (<b>, <i>, <u>, <strong>, <em>) mà giáo viên đã dùng. Chỉ thêm format khi cải thiện trình bày.
- Tạo nội dung mới nhưng PHẢI theo ĐÚNG cấu trúc/mẫu trình bày của Variation 1 (cùng số dòng, cùng vai trò từng dòng, cùng kiểu format).

Phiên bản mới phải:
- Kiểm tra cùng một điểm ngữ pháp và bám sát mục đích kiểm tra.
- Mọi cấu trúc dữ liệu JSON sinh ra phải y hệt như cấu trúc của Đề bài gốc.${typeInstruction}
- Vô cùng quan trọng: TỪ VỰNG VÀ NGỮ CẢNH phải phù hợp tuyệt đối với Độ tuổi mục tiêu (${targetAge}) và Trình độ mục tiêu (${targetLevel}) của học viên.
${vocabInstruction}
- Độ khó về mặt ngữ pháp tương đương với câu hỏi gốc.
- TOÀN BỘ PHẦN GIẢI THÍCH (trường \`explanation\`) PHẢI ĐƯỢC VIẾT BẰNG TIẾNG VIỆT để học viên dễ hiểu.
${isVietnameseQuestion ? '- Cực kỳ quan trọng: NỘI DUNG CÂU HỎI (trường `text` trong từng variation) PHẢI ĐƯỢC DỊCH/VIẾT BẰNG TIẾNG VIỆT để học viên dễ hiểu (các đáp án đi kèm hoặc nội dung điền/nối thì giữ nguyên tuỳ thuộc vào câu hỏi và ngữ pháp đang kiểm tra).' : ''}

Trả về kết quả chuẩn JSON (chỉ trả về một Object chứa cấu trúc giống Đề bài gốc).`;

    const userContent = `Đề bài gốc (Variation 1):\n${JSON.stringify(originalQuestion, null, 2)}`;

    try {
        const response = await chatCompletion({
            systemPrompt: systemPrompt,
            userContent: userContent,
            responseFormat: 'json',
            thinkingLevel: 'high'
        });

        let data = JSON.parse(response.text);
        // Shuffle multiple choice options so correct answer isn't always A
        if (type === 'multiple_choice') {
            data = shuffleMultipleChoiceOptions(data);
        }
        return data; // Assume the AI correctly returns the variation object directly
    } catch (error) {
        console.error("Error generating single variation from AI:", error);
        throw new Error('Không thể tự động tạo Variation. Kiểm tra lại API Key hoặc cấu hình.');
    }
}

/**
 * Generate an explanation for a specific variation by imitating Variation 1's explanation style.
 * @param {Object} v1Data Variation 1 data (used as style reference for explanation)
 * @param {Object} targetVariationData The variation that needs an explanation
 * @param {string} purpose The learning purpose of this question
 * @param {string} type The question type
 * @returns {Promise<string>} The generated explanation text
 */
export async function generateVariationExplanation(v1Data, targetVariationData, purpose, type) {
    const v1Explanation = v1Data?.explanation || '';
    const styleInstruction = v1Explanation.trim()
        ? `[MẪU GIẢI THÍCH TỪ VARIATION 1]
Hãy BẮT CHƯỚC CHÍNH XÁC phong cách, giọng văn, độ dài, và cách trình bày của lời giải thích mẫu sau:
"""
${v1Explanation}
"""
Áp dụng cùng cách diễn đạt, format, mức độ chi tiết — nhưng NỘI DUNG phải phù hợp với câu hỏi mới bên dưới.`
        : `Viết giải thích ngắn gọn, rõ ràng, bằng TIẾNG VIỆT. Giải thích vì sao đáp án đúng là đáp án đúng, và nếu có đáp án sai thì giải thích vì sao chúng sai.`;

    const systemPrompt = `Bạn là giáo viên tiếng Anh chuyên viết giải thích đáp án cho bài luyện.
Loại câu hỏi: "${type}"
Mục đích kiểm tra: "${purpose}"

${styleInstruction}

YÊU CẦU:
- Viết giải thích BẰNG TIẾNG VIỆT.
- Giải thích NỘI DUNG phải dựa trên câu hỏi và đáp án bên dưới (KHÔNG phải câu mẫu).
- KHÔNG trả về JSON. Chỉ trả về đoạn văn bản giải thích thuần túy.`;

    const userContent = `Câu hỏi cần giải thích:\n${JSON.stringify(targetVariationData, null, 2)}`;

    try {
        const response = await chatCompletion({
            systemPrompt,
            userContent,
            responseFormat: 'text'
        });
        return response.text?.trim() || '';
    } catch (error) {
        console.error("Error generating explanation from AI:", error);
        throw new Error('Không thể tạo giải thích bằng AI.');
    }
}

/**
 * Grade a student's answer using AI.
 * @param {Object} question The variation of the question that the student answered
 * @param {any} studentAnswer The student's submitted answer
 * @param {string} purpose The learning purpose of this question
 * @param {string} type The type of question
 * @param {string} specialRequirement Optional special requirements for grading
 * @param {string} context Optional section context (reading passage / listening transcript) for comprehension-based grading
 * @returns {Promise<Object>} Object containing score, feedback, and teacherNote
 */
export async function gradeGrammarSubmissionWithAI(question, studentAnswer, purpose, type, specialRequirement = '', context = '', teacherTitle = '', studentTitle = '', questionIndex = 0, totalQuestions = 0, cefrLevel = '', maxPoints = 10, useDefaultCriteria = true) {
    // Strip HTML tags from context for cleaner prompt
    const plainContext = context ? context.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() : '';

    // Use provided titles or fall back to defaults
    const finalTeacherTitle = teacherTitle || 'thầy/cô';
    const finalStudentTitle = studentTitle || 'em';

    const totalQuestionsInfo = totalQuestions > 0
        ? `\n\nQUAN TRỌNG VỀ NGỮ CẢNH BÀI LÀM: Học viên đang làm MỘT bài kiểm tra/bài tập duy nhất gồm ${totalQuestions} câu hỏi, và nộp bài MỘT LẦN duy nhất. Đây KHÔNG phải là nhiều lần nộp bài riêng lẻ. Bạn đang chấm câu hỏi thứ ${questionIndex + 1}/${totalQuestions} trong bài này.`
        : '';

    const greetingInstruction = questionIndex > 0
        ? `\nĐây là câu hỏi thứ ${questionIndex + 1}${totalQuestions > 0 ? '/' + totalQuestions : ''} trong bài. KHÔNG chào lại học viên (đã chào ở câu 1). Đi thẳng vào nhận xét nội dung.`
        : (totalQuestions > 0 ? `\nĐây là câu hỏi đầu tiên trong bài gồm ${totalQuestions} câu.` : '');

    const systemPrompt = `Bạn là giáo viên chấm bài luyện tiếng Anh. Gọi học viên bằng "${finalStudentTitle}". Có thể xưng "${finalTeacherTitle}" nhưng KHÔNG nhất thiết phải xưng hô trong mọi câu.${totalQuestionsInfo}${greetingInstruction}
${cefrLevel ? `Trình độ mục tiêu của học viên: ${cefrLevel}. Hãy chấm và gợi ý phù hợp với trình độ này (không yêu cầu quá cao hoặc quá thấp so với level).` : ''}
Loại bài luyện: ${type}
Mục đích kiểm tra: ${purpose}
${plainContext ? `\nNGỮ CẢNH / ĐỀ BÀI (Đây là đoạn văn / bài nghe mà câu hỏi dựa vào. Chấm điểm dựa trên nội dung này):\n"""\n${plainContext}\n"""` : ''}
${specialRequirement ? `\nYÊU CẦU ĐẶC BIỆT TỪ GIÁO VIÊN (Rất quan trọng, ưu tiên chấm theo tiêu chí này):\n"""\n${specialRequirement}\n"""` : ''}

Hãy phân tích câu trả lời của học sinh. 
Trọng tâm là kiểm tra xem học sinh có đáp ứng được "Mục đích kiểm tra" cấu trúc ngữ pháp hay không.
${plainContext ? 'Nếu câu hỏi yêu cầu dựa trên Ngữ cảnh, hãy kiểm tra xem học sinh có hiểu và trả lời đúng dựa trên nội dung đó không.' : ''}

${useDefaultCriteria ? `TIÊU CHÍ CHẤM NGHIÊM NGẶT — TÍNH ĐẦY ĐỦ (RẤT QUAN TRỌNG):
- Kiểm tra xem câu trả lời có bao quát ĐẦY ĐỦ tất cả thông tin mà câu hỏi yêu cầu không.
- Nếu Ngữ cảnh hoặc đề bài chứa NHIỀU mục thông tin (ví dụ: nhiều mức giá, nhiều điều kiện, nhiều bước, nhiều đối tượng...) mà câu hỏi hỏi về, thì câu trả lời PHẢI đề cập TẤT CẢ các mục đó.
- Ví dụ: Nếu câu hỏi hỏi "How much does it cost?" và Ngữ cảnh có giá cho cả adults ($75) VÀ children ($50), thì chỉ nói giá adults mà bỏ sót giá children = THIẾU THÔNG TIN → trừ điểm đáng kể.
- Câu trả lời đúng nhưng THIẾU thông tin quan trọng: tối đa ${Math.round(maxPoints * 0.55)}-${Math.round(maxPoints * 0.6)}/${maxPoints}.
- Câu trả lời chỉ đề cập được một phần nhỏ: tối đa ${Math.round(maxPoints * 0.3)}-${Math.round(maxPoints * 0.4)}/${maxPoints}.
- Nếu câu trả lời bổ sung thêm chi tiết liên quan từ Ngữ cảnh: thưởng thêm điểm.` : 'Chấm điểm dựa trên YÊU CẦU ĐẶC BIỆT TỪ GIÁO VIÊN ở trên (nếu có) và Mục đích kiểm tra. Không áp dụng tiêu chí mặc định của hệ thống.'}

Chỉ ra lỗi sai (nếu có), giải thích lý do, và đề xuất điểm số từ 0 đến ${maxPoints}.
Nếu không cho điểm tối đa, hãy GIẢI THÍCH NGẮN GỌN vì sao bị trừ điểm (ví dụ: thiếu thông tin gì, lỗi ngữ pháp nào, phát âm sai chỗ nào).
Ngoài việc sửa lỗi, hãy gợi ý cách diễn đạt TỰ NHIÊN hơn cho câu trả lời (nếu câu trả lời nghe gượng hoặc máy móc). Ví dụ: cách dùng từ nối, cách rút gọn, cụm từ phổ biến trong giao tiếp thực tế.

LƯU Ý:
- Viết feedback bằng TIẾNG VIỆT, súc tích không dài dòng nhưng THOROUGH — liệt kê TẤT CẢ lỗi, không bỏ sót. Gọi học viên bằng "${finalStudentTitle}". Có thể xưng "${finalTeacherTitle}" nhưng không cần xưng hô ở mọi câu.
- TRÁNH mở đầu bằng các cụm khuôn mẫu như "Thầy khen em", "Thầy thấy em", "Đúng hướng rồi", "Em làm tốt lắm". Thay vào đó, đi thẳng vào nhận xét cụ thể về bài làm.
- Viết tự nhiên như đang nói chuyện với học viên về bài làm cụ thể của họ. Tập trung vào kiến thức, không khen/chê chung chung. Nếu có nhiều lỗi, liệt kê bằng bullet points (•).
- KHÔNG nhắc đến "các câu trước" hay "như đã nói" trừ khi có dữ liệu KẾT QUẢ CÁC CÂU TRƯỚC được cung cấp ở trên.
- Mỗi câu hỏi cần nhận xét với cách diễn đạt KHÁC NHAU — không lặp cùng cụm mở đầu/kết thúc giữa các câu.
- Nếu đưa ví dụ/câu mẫu trong feedback, phải chính xác theo Ngữ cảnh. Không bịa thông tin.
- Dùng **in đậm** để nhấn mạnh từ khoá. Không dùng heading (#) hay code block.

Trả về kết quả chuẩn JSON với format:
{
  "score": number, // Điểm số (0-${maxPoints})
  "feedback": "Nhận xét chi tiết và hướng dẫn sửa lỗi cho học sinh bằng TIẾNG VIỆT",
  "teacherNote": "Ghi chú ngắn gọn cho giáo viên bằng TIẾNG VIỆT",
  "detectedErrors": ["key1", "key2"] // Danh sách các loại lỗi phát hiện trong câu trả lời. CHỈ dùng key từ danh sách sau: verb_tense, article, preposition, word_form, subject_verb_agreement, pronoun, conjunction, comparison, passive_voice, conditional, modal_verb, relative_clause, reported_speech, gerund_infinitive, quantifier, grammar_sentence_structure, vocabulary_meaning, vocabulary_usage, vocabulary_collocation, vocabulary_spelling, vocabulary_idiom_phrasal, writing_structure, writing_coherence, writing_task_response, writing_punctuation, pronunciation_sounds, pronunciation_stress_intonation, fluency, speaking_interaction, listening_detail, listening_main_idea, listening_inference, listening_purpose_attitude, reading_detail, reading_main_idea, reading_inference, reading_context_vocab. KHÔNG dùng "other". Để mảng rỗng [] nếu không phát hiện lỗi.
}`;

    const userContent = `Dữ liệu câu hỏi:\n${JSON.stringify(question, null, 2)}\n\nCâu trả lời của học sinh:\n${JSON.stringify(studentAnswer, null, 2)}`;

    try {
        const response = await chatCompletion({
            systemPrompt: systemPrompt,
            userContent: userContent,
            responseFormat: 'json',
            thinkingLevel: 'high'
        });

        const data = JSON.parse(response.text);
        return data;
    } catch (error) {
        console.error("Error grading submission with AI:", error);
        throw new Error('Không thể tự chấm điểm bằng AI vào lúc này.');
    }
}

/**
 * Lightweight AI grading for fill-in-blank-typing questions.
 * Evaluates each blank individually and returns per-blank verdicts.
 * @param {string} questionText - The question text with blanks rendered as ___
 * @param {Array<{idx: number, expected: string, studentAnswer: string, exactMatch: boolean}>} blanks
 * @param {string} context - Optional section context
 * @returns {Promise<boolean[]>} Array of true/false for each blank
 */
export async function gradeFillInBlankBlanksWithAI(questionText, blanks, context = '') {
    const plainContext = context ? context.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() : '';

    const blankDetails = blanks.map(b => 
        `Chỗ trống ${b.idx + 1}: Đáp án gợi ý="${b.expected}", Học viên="${b.studentAnswer}" → ${b.exactMatch ? '✅ Đã đúng (exact match)' : '❓ Cần AI đánh giá'}`
    ).join('\n');

    const systemPrompt = `Bạn là giáo viên chấm bài điền vào chỗ trống tiếng Anh.
${plainContext ? `\nNGỮ CẢNH:\n"""\n${plainContext}\n"""` : ''}

Câu hỏi (${blanks.length} chỗ trống):
"${questionText}"

${blankDetails}

NHIỆM VỤ: Với những chỗ trống "❓ Cần AI đánh giá", hãy xác định câu trả lời của học viên có chấp nhận được không.
Chấp nhận nếu: đồng nghĩa, đúng ngữ pháp trong câu, phù hợp ngữ cảnh.
Không chấp nhận nếu: sai nghĩa, sai ngữ pháp, không phù hợp ngữ cảnh.

Trả về JSON với format CHÍNH XÁC:
{ "verdicts": [true, false, ...] }

Mảng "verdicts" có đúng ${blanks.length} phần tử, mỗi phần tử là true (chấp nhận) hoặc false (không chấp nhận) cho từng chỗ trống theo thứ tự.
Với chỗ trống đã đúng (exact match), luôn trả true.`;

    try {
        const response = await chatCompletion({
            systemPrompt,
            userContent: 'Đánh giá từng chỗ trống.',
            responseFormat: 'json'
        });

        const data = JSON.parse(response.text);
        if (Array.isArray(data.verdicts) && data.verdicts.length === blanks.length) {
            return data.verdicts;
        }
        // Fallback: try to find array in response
        if (Array.isArray(data)) return data;
        return null;
    } catch (error) {
        console.error("Error grading fill-in-blank with AI:", error);
        return null;
    }
}

// ═══════════════════════════════════════════════
// ERROR CATEGORY CLASSIFICATION
// ═══════════════════════════════════════════════

const ERROR_CATEGORIES = {
    grammar: [
        'verb_tense', 'article', 'preposition', 'word_form',
        'subject_verb_agreement', 'pronoun', 'conjunction', 'comparison',
        'passive_voice', 'conditional', 'modal_verb', 'relative_clause',
        'reported_speech', 'question_form', 'gerund_infinitive', 'quantifier'
    ],
    listening: ['listening_detail', 'listening_main_idea', 'listening_inference'],
    speaking: ['pronunciation_sounds', 'pronunciation_stress', 'pronunciation_intonation', 'fluency'],
    reading: ['reading_detail', 'reading_main_idea', 'reading_inference', 'reading_vocabulary'],
    writing: ['writing_structure', 'writing_coherence', 'writing_grammar'],
    vocabulary: ['vocabulary_meaning', 'vocabulary_usage', 'vocabulary_collocation'],
};

const CATEGORY_LABELS = {
    verb_tense: 'Thì / Chia động từ',
    article: 'Mạo từ (a/an/the)',
    preposition: 'Giới từ',
    word_form: 'Loại từ (N/V/Adj/Adv)',
    subject_verb_agreement: 'Hòa hợp chủ-vị',
    pronoun: 'Đại từ',
    conjunction: 'Liên từ / Mệnh đề',
    comparison: 'So sánh',
    passive_voice: 'Câu bị động',
    conditional: 'Câu điều kiện',
    modal_verb: 'Động từ khuyết thiếu',
    relative_clause: 'Mệnh đề quan hệ',
    reported_speech: 'Câu tường thuật',
    question_form: 'Dạng câu hỏi',
    gerund_infinitive: 'Danh động từ / Nguyên mẫu',
    quantifier: 'Lượng từ (some/any/much/many)',
    listening_detail: 'Nghe lấy chi tiết',
    listening_main_idea: 'Nghe ý chính',
    listening_inference: 'Suy luận từ nghe',
    pronunciation_sounds: 'Phát âm âm riêng lẻ',
    pronunciation_stress: 'Trọng âm từ',
    pronunciation_intonation: 'Ngữ điệu / Nhịp điệu',
    fluency: 'Độ trôi chảy khi nói',
    reading_detail: 'Đọc lấy chi tiết',
    reading_main_idea: 'Đọc ý chính / chủ đề',
    reading_inference: 'Suy luận từ đọc',
    reading_vocabulary: 'Từ vựng trong ngữ cảnh',
    writing_structure: 'Cấu trúc bài viết',
    writing_coherence: 'Mạch lạc / Liên kết',
    writing_grammar: 'Ngữ pháp trong viết',
    vocabulary_meaning: 'Nghĩa từ vựng',
    vocabulary_usage: 'Cách dùng từ trong ngữ cảnh',
    vocabulary_collocation: 'Kết hợp từ',
    other: 'Khác',
};

export { ERROR_CATEGORIES, CATEGORY_LABELS };

/**
 * Auto-classify the error/skill category for a question using AI.
 * Lightweight prompt — no thinkingLevel needed.
 *
 * @param {Object} params
 * @param {string} params.targetSkill - The skill this question targets (grammar, listening, speaking, reading, writing, vocabulary)
 * @param {string} params.type - Question type (multiple_choice, fill_in_blank, audio_recording, essay, etc.)
 * @param {string} params.purpose - The teacher-entered purpose/objective
 * @param {string} params.questionText - The text content of variation 1
 * @param {string[]} [params.options] - MCQ options (if applicable)
 * @returns {Promise<string>} One of the ERROR_CATEGORIES values, or 'other'
 */
export async function classifyErrorCategory({ targetSkill, type, purpose, questionText, options }) {
    // Determine which skill group to use
    let skillGroup = targetSkill || 'grammar';
    // audio_recording type always maps to speaking
    if (type === 'audio_recording') skillGroup = 'speaking';

    const validCategories = ERROR_CATEGORIES[skillGroup] || ERROR_CATEGORIES.grammar;
    const categoryList = validCategories.map(c => `"${c}" (${CATEGORY_LABELS[c]})`).join(', ');

    // Strip HTML from questionText for cleaner prompt
    const plainText = (questionText || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

    const systemPrompt = `Classify the following English learning question into exactly ONE category.

Available categories: ${categoryList}, "other" (Khác)

Based on:
- Skill: ${skillGroup}
- Purpose: "${purpose || 'N/A'}"
- Question text: "${plainText.slice(0, 300)}"
${options && Array.isArray(options) ? `- Options: ${options.filter(Boolean).join(', ')}` : ''}

Return JSON: { "category": "<one_of_the_categories>" }`;

    try {
        const response = await chatCompletion({
            systemPrompt,
            userContent: 'Classify this question.',
            responseFormat: 'json'
        });

        const data = JSON.parse(response.text);
        const category = data.category || 'other';

        // Validate against allowed categories
        if ([...validCategories, 'other'].includes(category)) {
            return category;
        }
        // If AI returned a category from a different skill group, still accept if valid overall
        const allCategories = Object.values(ERROR_CATEGORIES).flat();
        if (allCategories.includes(category)) {
            return category;
        }
        return 'other';
    } catch (error) {
        console.warn('Error classifying error category:', error);
        return 'other';
    }
}
