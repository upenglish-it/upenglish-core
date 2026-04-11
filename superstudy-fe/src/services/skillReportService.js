/**
 * Skill Report Service
 * AI-powered report generation + Nest-backed CRUD for skill reports
 */

import { skillReportsService, usersService } from '../models';
import { chatCompletion } from './aiService';
import { buildEmailHtml, createNotification, queueEmail } from './notificationService';

const SKILL_LABELS = {
    listening: 'Listening (Nghe)',
    speaking: 'Speaking (Nói)',
    reading: 'Reading (Đọc)',
    writing: 'Writing (Viết)',
    grammar: 'Grammar (Ngữ pháp)',
    vocabulary: 'Vocabulary (Từ vựng)',
};

const ERROR_CATEGORY_LABELS = {
    verb_tense: 'Thì động từ',
    article: 'Mạo từ (a/an/the)',
    preposition: 'Giới từ',
    word_form: 'Dạng từ',
    subject_verb_agreement: 'Hòa hợp chủ-vị',
    pronoun: 'Đại từ',
    conjunction: 'Liên từ',
    comparison: 'So sánh',
    passive_voice: 'Câu bị động',
    conditional: 'Câu điều kiện',
    modal_verb: 'Động từ khiếm khuyết',
    relative_clause: 'Mệnh đề quan hệ',
    reported_speech: 'Câu tường thuật',
    question_form: 'Dạng câu hỏi',
    gerund_infinitive: 'V-ing / To V',
    quantifier: 'Lượng từ',
    grammar_sentence_structure: 'Cấu trúc câu (Đơn/Ghép/Phức)',
    listening_detail: 'Nghe chi tiết',
    listening_main_idea: 'Nghe ý chính',
    listening_inference: 'Nghe suy luận',
    listening_purpose_attitude: 'Nghe mục đích và thái độ',
    pronunciation_sounds: 'Phát âm',
    pronunciation_stress: 'Trọng âm',
    pronunciation_intonation: 'Ngữ điệu',
    pronunciation_stress_intonation: 'Trọng âm và ngữ điệu',
    fluency: 'Độ lưu loát',
    speaking_interaction: 'Tương tác giao tiếp',
    reading_detail: 'Đọc chi tiết',
    reading_main_idea: 'Đọc ý chính',
    reading_inference: 'Đọc suy luận',
    reading_vocabulary: 'Từ vựng trong bài đọc',
    reading_context_vocab: 'Đoán từ qua ngữ cảnh',
    writing_structure: 'Cấu trúc bài viết',
    writing_coherence: 'Tính mạch lạc',
    writing_grammar: 'Ngữ pháp trong viết',
    writing_task_response: 'Đáp ứng yêu cầu đề',
    writing_punctuation: 'Dấu câu và Viết hoa',
    vocabulary_meaning: 'Nghĩa từ vựng',
    vocabulary_usage: 'Cách dùng từ',
    vocabulary_collocation: 'Kết hợp từ (Collocations)',
    vocabulary_spelling: 'Chính tả',
    vocabulary_idiom_phrasal: 'Thành ngữ và Cụm động từ',
};

function unwrapResult(result) {
    return result?.data || result || null;
}

function ensureArray(result) {
    const data = unwrapResult(result);
    return Array.isArray(data) ? data : [];
}

function getTimeValue(value) {
    if (!value) return 0;
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
        const parsed = Date.parse(value);
        return Number.isNaN(parsed) ? 0 : parsed;
    }
    if (typeof value?.toDate === 'function') return value.toDate().getTime();
    if (typeof value?.toMillis === 'function') return value.toMillis();
    return 0;
}

/**
 * Generate a skill report using AI
 * @param {string} studentName
 * @param {Object} skillData - Output from analyzeStudentSkills()
 * @param {Object} options - { teacherName, groupName, startDate, endDate }
 * @returns {Promise<Object>} { summary, strengths, weaknesses, recommendations, overallLevel }
 */
export async function generateSkillReport(studentName, skillData, options = {}) {
    const { teacherName = 'Giáo viên', groupName = '', startDate = '', endDate = '', previousReport = null, redFlags = [] } = options;

    const skillsWithData = Object.entries(skillData.skills).filter(([, val]) => val.score !== null);
    const skillsWithoutData = Object.entries(skillData.skills).filter(([, val]) => val.score === null);
    const skillSummary = skillsWithData
        .map(([key, val]) => `- ${SKILL_LABELS[key] || key}: ${val.score}/100`)
        .join('\n');
    const noDataNote = skillsWithoutData.length > 0
        ? `\n\nCác kỹ năng CHƯA CÓ DỮ LIỆU (KHÔNG nhận xét về những kỹ năng này): ${skillsWithoutData.map(([key]) => SKILL_LABELS[key] || key).join(', ')}`
        : '';

    const dateRange = startDate && endDate ? `từ ${startDate} đến ${endDate}` : 'trong kỳ đánh giá gần đây';

    const systemPrompt = `Bạn là giáo viên tiếng Anh đang viết báo cáo kỹ năng cho học viên. Phong cách: chuyên nghiệp, tích cực, khích lệ nhưng trung thực. Xưng hô: ${teacherName} gọi học viên là "em".

THÔNG TIN HỌC VIÊN
- Tên: ${studentName}
- Lớp: ${groupName || 'Không xác định'}
- Thời gian đánh giá: ${dateRange}

DỮ LIỆU KỸ NĂNG
${skillSummary}${noDataNote}

SỐ LIỆU BỔ SUNG
- Từ vựng: ${skillData.totalWordsLearned || 0}/${skillData.totalWordsStudied || 0} từ đã thuộc (tỷ lệ ghi nhớ: ${skillData.vocabRetentionRate ?? 'N/A'}%)
- Kỹ năng/Ngữ pháp: ${skillData.totalGrammarQuestions || 0} câu đã luyện (độ chính xác: ${skillData.grammarAccuracyRate ?? 'N/A'}%)
- Bài kiểm tra: ${skillData.totalExamsTaken || 0} bài (điểm TB: ${skillData.examAverageScore ?? 'N/A'}%)
${skillData.grammarWeakPoints?.length > 0 ? `\nĐIỂM NGỮ PHÁP THƯỜNG SAI\n${skillData.grammarWeakPoints.map(w => `- ${w.purpose}${w.errorCategory ? ` [${ERROR_CATEGORY_LABELS[w.errorCategory] || w.errorCategory}]` : ''} (${w.accuracy}% đúng)`).join('\n')}` : ''}
${skillData.errorCategoryBreakdown?.length > 0 ? `\nPHÂN TÍCH LỖI CHI TIẾT THEO DẠNG\n${skillData.errorCategoryBreakdown.map(item => `- ${ERROR_CATEGORY_LABELS[item.category] || item.category}: ${item.accuracy}% đúng (${item.totalAttempts} lần làm)`).join('\n')}` : ''}
${skillData.examSummaries?.length > 0 ? `\nNHẬN XÉT TỔNG KẾT CÁC BÀI KIỂM TRA\n${skillData.examSummaries.map((s, i) => `${i + 1}. Bài kiểm tra - Điểm: ${s.totalScore}/${s.maxTotalScore}\n   Nhận xét:\n${s.summary.split('\n').map(line => `   ${line}`).join('\n')}`).join('\n\n')}` : ''}
${previousReport ? `\nBÁO CÁO KỲ TRƯỚC\n- Điểm mạnh kỳ trước: ${previousReport.strengths?.join(', ') || 'Không có'}\n- Điểm yếu kỳ trước: ${previousReport.weaknesses?.join(', ') || 'Không có'}\n- Trình độ kỳ trước: ${previousReport.overallLevel || 'Không có'}\nBẮT BUỘC so sánh: điểm yếu nào đã cải thiện, điểm nào vẫn còn, có điểm yếu mới nào không.` : ''}
${(() => {
    const activeRedFlags = redFlags.filter(flag => !flag.removed);
    if (activeRedFlags.length === 0) return '';
    return `\nCỜ ĐỎ CẢNH BÁO TRONG KỲ BÁO CÁO\nHọc viên nhận ${activeRedFlags.length} cờ đỏ trong giai đoạn này:\n${activeRedFlags.map((flag, index) => `${index + 1}. Loại vi phạm: ${flag.violationLabel || flag.violationType}\n   Ghi chú: ${flag.note || 'Không có'}\n   Ngày: ${flag.createdAt || ''}`).join('\n')}\nChỉ nhắc đến cờ đỏ trong phần kỷ luật và thái độ. Nhắc nhở nhẹ nhàng, khích lệ học viên cải thiện.`;
})()}

QUY TẮC QUAN TRỌNG
1. Không dùng mã tiếng Anh như writing_structure hay verb_tense.
2. Chỉ nhận xét những kỹ năng có dữ liệu.
3. Tận dụng nhận xét bài kiểm tra để đưa ví dụ cụ thể nếu có.
4. Nếu có báo cáo kỳ trước, bắt buộc so sánh xu hướng tiến bộ hoặc thụt lùi.
5. Tuyệt đối không nhắc đến AI trong báo cáo.

Hãy trả về JSON:
{
  "summary": "Tổng kết ngắn gọn 2-3 câu",
  "strengths": ["Điểm mạnh 1", "Điểm mạnh 2"],
  "weaknesses": ["Điểm cần cải thiện 1", "Điểm cần cải thiện 2"],
  "recommendations": ["Lời khuyên cụ thể 1", "Lời khuyên cụ thể 2"],
  "detailedReport": "Báo cáo HTML đầy đủ",
  "overallLevel": "A1/A2/B1/B2/C1"
}`;

    try {
        const response = await chatCompletion({
            systemPrompt,
            userContent: `Hãy viết báo cáo kỹ năng cho học viên ${studentName}.`,
            responseFormat: 'json',
            thinkingLevel: 'high',
        });

        return JSON.parse(response.text);
    } catch (error) {
        console.error('Error generating skill report:', error);
        throw new Error('Không thể tạo báo cáo kỹ năng. Vui lòng thử lại.');
    }
}

/**
 * Save a skill report to NestJS backend
 */
export async function saveSkillReport(reportData) {
    const { id, ...data } = reportData;
    const payload = {
        ...data,
        startDate: data.startDate || '',
        endDate: data.endDate || '',
        periodId: data.periodId || '',
        periodLabel: data.periodLabel || '',
        redFlagsSummary: Array.isArray(data.redFlagsSummary) ? data.redFlagsSummary : [],
        finalReport: data.finalReport || '',
    };

    if (id) {
        await skillReportsService.update(id, payload);
        return id;
    }

    const created = unwrapResult(await skillReportsService.create(payload));
    return created?.id || created?._id;
}

/**
 * Get a single skill report by ID
 */
export async function getSkillReport(reportId) {
    if (!reportId) return null;
    try {
        return unwrapResult(await skillReportsService.findOne(reportId));
    } catch {
        return null;
    }
}

/**
 * Get all reports for a student in a group
 */
export async function getSkillReports(groupId, studentId) {
    const reports = await ensureArray(await skillReportsService.findAll({ groupId, studentId }));
    return reports.sort((a, b) => getTimeValue(b.createdAt) - getTimeValue(a.createdAt));
}

/**
 * Get reports sent to a student (for dashboard)
 */
export async function getStudentSentReports(studentId) {
    const reports = await ensureArray(await skillReportsService.findAll({ studentId, status: 'sent' }));
    return reports.sort((a, b) => {
        const aTime = getTimeValue(a.sentAt) || getTimeValue(a.createdAt);
        const bTime = getTimeValue(b.sentAt) || getTimeValue(b.createdAt);
        return bTime - aTime;
    });
}

/**
 * Delete a skill report
 */
export async function deleteSkillReport(reportId) {
    if (!reportId) return;
    await skillReportsService.remove(reportId);
}

/**
 * Send a skill report to the student
 * - Updates status to 'sent'
 * - Creates a notification for the student
 */
export async function sendSkillReport(reportId, { studentId, studentName, teacherName, groupName }) {
    if (!reportId) throw new Error('Missing reportId');

    await skillReportsService.update(reportId, {
        status: 'sent',
        sentAt: new Date().toISOString(),
    });

    await createNotification({
        userId: studentId,
        type: 'skill_report',
        title: '📊 Báo cáo kỹ năng mới',
        message: `${teacherName || 'Giáo viên'} đã gửi báo cáo đánh giá kỹ năng của bạn${groupName ? ` trong lớp ${groupName}` : ''}. Hãy xem ngay!`,
        link: '/dashboard?scrollTo=reports',
    });

    try {
        const student = unwrapResult(await usersService.findOne(studentId));
        if (student?.email) {
            await queueEmail(student.email, {
                subject: `Báo cáo kỹ năng mới từ ${teacherName || 'Giáo viên'}`,
                html: buildEmailHtml({
                    emoji: '📊',
                    heading: 'Báo cáo kỹ năng mới',
                    headingColor: '#06b6d4',
                    greeting: 'Chào bạn 👋',
                    body: `<p>Thầy/cô <strong>${teacherName || 'Giáo viên'}</strong> vừa gửi báo cáo đánh giá kỹ năng của bạn${groupName ? ` trong lớp <strong>${groupName}</strong>` : ''}. Vào xem để biết mình đang tiến bộ thế nào nhé! 💪</p>`,
                    ctaText: 'Xem báo cáo',
                    ctaLink: 'https://upenglishvietnam.com/preview/superstudy/dashboard?scrollTo=reports',
                    ctaColor: '#06b6d4',
                    ctaColor2: '#22d3ee',
                }),
            });
        }
    } catch (error) {
        console.error('Error sending skill report email:', error);
    }
}
