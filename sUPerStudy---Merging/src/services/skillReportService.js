/**
 * Skill Report Service
 * AI-powered report generation + Firestore CRUD for skill_reports collection
 */

import { collection, doc, setDoc, getDoc, getDocs, deleteDoc, query, where, orderBy, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { chatCompletion } from './aiService';
import { createNotification } from './notificationService';

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
    listening_purpose_attitude: 'Nghe mục đích & thái độ',
    pronunciation_sounds: 'Phát âm',
    pronunciation_stress: 'Trọng âm',
    pronunciation_intonation: 'Ngữ điệu',
    pronunciation_stress_intonation: 'Trọng âm & Ngữ điệu',
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
    writing_punctuation: 'Dấu câu & Viết hoa',
    vocabulary_meaning: 'Nghĩa từ vựng',
    vocabulary_usage: 'Cách dùng từ',
    vocabulary_collocation: 'Kết hợp từ (Collocations)',
    vocabulary_spelling: 'Chính tả',
    vocabulary_idiom_phrasal: 'Thành ngữ & Cụm động từ',
};

/**
 * Generate a skill report using AI
 * @param {string} studentName
 * @param {Object} skillData - Output from analyzeStudentSkills()
 * @param {Object} options - { teacherName, groupName, startDate, endDate }
 * @returns {Promise<Object>} { summary, strengths, weaknesses, recommendations, overallLevel }
 */
export async function generateSkillReport(studentName, skillData, options = {}) {
    const { teacherName = 'Giáo viên', groupName = '', startDate = '', endDate = '', previousReport = null, redFlags = [] } = options;

    // Only include skills that have actual data (score !== null)
    const skillsWithData = Object.entries(skillData.skills).filter(([, val]) => val.score !== null);
    const skillsWithoutData = Object.entries(skillData.skills).filter(([, val]) => val.score === null);
    const skillSummary = skillsWithData
        .map(([key, val]) => `- ${SKILL_LABELS[key] || key}: ${val.score}/100`)
        .join('\n');
    const noDataNote = skillsWithoutData.length > 0
        ? `\n\nCác kỹ năng CHƯA CÓ DỮ LIỆU (KHÔNG nhận xét về những kỹ năng này): ${skillsWithoutData.map(([key]) => SKILL_LABELS[key] || key).join(', ')}`
        : '';

    const dateRange = startDate && endDate ? `từ ${startDate} đến ${endDate}` : 'trong kỳ đánh giá gần đây';

    const systemPrompt = `Bạn là giáo viên tiếng Anh đang viết báo cáo kỹ năng cho học viên. Phong cách: chuyên nghiệp, tích cực, khích lệ nhưng trung thực. Xưng hô: ${teacherName} (thầy/cô) gọi học viên là "em".

═══ THÔNG TIN HỌC VIÊN ═══
- Tên: ${studentName}
- Lớp: ${groupName || 'Không xác định'}
- Thời gian đánh giá: ${dateRange}

═══ DỮ LIỆU KỸ NĂNG (điểm 0-100) ═══
${skillSummary}${noDataNote}

═══ SỐ LIỆU BỔ SUNG ═══
- Từ vựng: ${skillData.totalWordsLearned || 0}/${skillData.totalWordsStudied || 0} từ đã thuộc (tỷ lệ ghi nhớ: ${skillData.vocabRetentionRate ?? 'N/A'}%)
- Kỹ năng/Ngữ pháp: ${skillData.totalGrammarQuestions || 0} câu đã luyện (độ chính xác: ${skillData.grammarAccuracyRate ?? 'N/A'}%)
- Bài kiểm tra: ${skillData.totalExamsTaken || 0} bài (điểm TB: ${skillData.examAverageScore ?? 'N/A'}%)
${skillData.grammarWeakPoints?.length > 0 ? `\n═══ ĐIỂM NGỮ PHÁP THƯỜNG SAI ═══\n${skillData.grammarWeakPoints.map(w => `- ${w.purpose}${w.errorCategory ? ` [${ERROR_CATEGORY_LABELS[w.errorCategory] || w.errorCategory}]` : ''} (${w.accuracy}% đúng)`).join('\n')}` : ''}
${skillData.errorCategoryBreakdown?.length > 0 ? `\n═══ PHÂN TÍCH LỖI CHI TIẾT THEO DẠNG ═══\n${skillData.errorCategoryBreakdown.map(item => `- ${ERROR_CATEGORY_LABELS[item.category] || item.category}: ${item.accuracy}% đúng (${item.totalAttempts} lần làm)`).join('\n')}` : ''}
${skillData.examSummaries?.length > 0 ? `\n═══ NHẬN XÉT TỔNG KẾT CÁC BÀI KIỂM TRA (rất quan trọng — dùng để trích dẫn ví dụ cụ thể) ═══\n${skillData.examSummaries.map((s, i) => `${i + 1}. Bài kiểm tra — Điểm: ${s.totalScore}/${s.maxTotalScore}\n   Nhận xét:\n${s.summary.split('\n').map(line => '   ' + line).join('\n')}`).join('\n\n')}` : ''}
${previousReport ? `\n═══ BÁO CÁO KỲ TRƯỚC (dùng để so sánh) ═══\n- Điểm mạnh kỳ trước: ${previousReport.strengths?.join(', ') || 'Không có'}\n- Điểm yếu kỳ trước: ${previousReport.weaknesses?.join(', ') || 'Không có'}\n- Trình độ kỳ trước: ${previousReport.overallLevel || 'Không có'}\nBẮT BUỘC so sánh: điểm yếu nào đã cải thiện, điểm nào vẫn còn, có điểm yếu mới nào không.` : ''}
${(() => {
    const activeRedFlags = redFlags.filter(f => !f.removed);
    if (activeRedFlags.length === 0) return '';
    return `\n═══ CỜ ĐỎ CẢNH BÁO TRONG KỲ BÁO CÁO ═══\nHọc viên nhận ${activeRedFlags.length} cờ đỏ trong giai đoạn này:\n${activeRedFlags.map((f, i) => `${i + 1}. Loại vi phạm: ${f.violationLabel || f.violationType}\n   Ghi chú: ${f.note || 'Không có'}\n   Ngày: ${f.createdAt?.toDate ? f.createdAt.toDate().toLocaleDateString('vi-VN') : ''}`).join('\n')}\n\nQUY TẮC VỀ CỜ ĐỎ: Chỉ nhắc đến cờ đỏ trong phần 4 (Kỷ luật & Thái độ). Nhắc nhở nhẹ nhàng, khích lệ học viên cải thiện dựa vào lý do cụ thể. KHÔNG đe dọa. Giọng điệu ấm áp, quan tâm.`;
})()}

═══ QUY TẮC QUAN TRỌNG ═══
1. KHÔNG BAO GIỜ dùng tên mã tiếng Anh (writing_structure, verb_tense, fluency...). Luôn dùng tên tiếng Việt dễ hiểu.
2. Chỉ nhận xét những kỹ năng CÓ dữ liệu. KHÔNG bịa hoặc đoán kỹ năng không có điểm.
3. Tận dụng nhận xét tổng kết bài kiểm tra để trích dẫn ví dụ CỤ THỂ khi phân tích điểm yếu (nếu có).
4. Nếu có báo cáo kỳ trước, BẮT BUỘC so sánh xu hướng tiến bộ/thụt lùi.
5. TUYỆT ĐỐI KHÔNG nhắc đến "AI" trong báo cáo. Mọi nhận xét đều là của thầy/cô giáo viên.


═══ CẤU TRÚC BÁO CÁO (viết theo đúng cấu trúc này) ═══
Viết bài báo cáo dạng HTML trong field "detailedReport" theo cấu trúc sau:

[Không cần tiêu đề] Lời mở đầu: 1-2 câu chào học viên và nêu kỳ báo cáo (thời gian đánh giá). KHÔNG giới thiệu lại giáo viên là ai. KHÔNG đặt tiêu đề <h3> cho phần này.

<h3>1. Tổng quan</h3>
2-3 câu nhận xét chung: trình độ ước tính, xu hướng học tập, mức độ nỗ lực.
${previousReport ? 'So sánh với kỳ trước nếu có dữ liệu.' : ''}

<h3>2. Phân tích từng kỹ năng</h3>
Với MỖI kỹ năng có dữ liệu (score ≠ null), viết 2-3 câu bao gồm:
- Điểm số và ý nghĩa (tốt/khá/cần cải thiện)
- ĐIỂM MẠNH của kỹ năng đó (nếu có)
- ĐIỂM YẾU của kỹ năng đó (nếu có), kèm ví dụ cụ thể (trích từ nhận xét bài kiểm tra nếu có)
- So sánh kỳ trước nếu có

<h3>3. Lời khuyên</h3>
Đưa ra 2-3 lời khuyên CỤ THỂ, HÀNH ĐỘNG ĐƯỢC (không chung chung kiểu "cần cải thiện thêm"). Ví dụ: "Nên ôn lại cách dùng thì hiện tại hoàn thành vs quá khứ đơn bằng cách..."

${redFlags.filter(f => !f.removed).length > 0 ? `<h3>4. Kỷ luật & Thái độ</h3>
Nhắc đến cờ đỏ mà học viên nhận trong kỳ báo cáo này. Nhắc nhở nhẹ nhàng, khích lệ dựa vào lý do vi phạm cụ thể. KHÔNG đe dọa hay phê bình nặng. Giọng điệu quan tâm, ấm áp. Chỉ nhắc cờ đỏ MỚI trong giai đoạn này, KHÔNG nhắc cờ đỏ cũ.

` : ''}[Không cần tiêu đề] Lời kết: 1-2 câu động viên, khích lệ học viên tiếp tục cố gắng. KHÔNG đặt tiêu đề <h3> cho phần này.

═══ ĐỊNH DẠNG HTML ═══
Dùng: <h3> cho tiêu đề phần, <p> cho đoạn văn, <strong> cho in đậm, <em> cho in nghiêng, <ul><li> cho liệt kê.

NHIỆM VỤ: Viết báo cáo bằng TIẾNG VIỆT. Trả về JSON:
{
  "summary": "Tổng kết ngắn gọn 2-3 câu",
  "strengths": ["Điểm mạnh 1", "Điểm mạnh 2"],
  "weaknesses": ["Điểm cần cải thiện 1", "Điểm cần cải thiện 2"],
  "recommendations": ["Lời khuyên cụ thể 1", "Lời khuyên cụ thể 2"],
  "detailedReport": "Bài báo cáo HTML đầy đủ 6 phần như cấu trúc trên",
  "overallLevel": "A1/A2/B1/B2/C1"
}`;

    const userContent = `Hãy viết báo cáo kỹ năng cho học viên ${studentName}.`;

    try {
        const response = await chatCompletion({
            systemPrompt,
            userContent,
            responseFormat: 'json',
            thinkingLevel: 'high'
        });

        return JSON.parse(response.text);
    } catch (error) {
        console.error('Error generating skill report:', error);
        throw new Error('Không thể tạo báo cáo kỹ năng. Vui lòng thử lại.');
    }
}

// ═══════════════════════════════════════════════
// FIRESTORE CRUD
// ═══════════════════════════════════════════════

/**
 * Save a skill report to Firestore
 */
export async function saveSkillReport(reportData) {
    const { id, ...data } = reportData;
    let reportRef;

    if (id) {
        reportRef = doc(db, 'skill_reports', id);
        await updateDoc(reportRef, { ...data, updatedAt: serverTimestamp() });
        return id;
    } else {
        reportRef = doc(collection(db, 'skill_reports'));
        await setDoc(reportRef, { ...data, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
        return reportRef.id;
    }
}

/**
 * Get a single skill report by ID
 */
export async function getSkillReport(reportId) {
    const ref = doc(db, 'skill_reports', reportId);
    const snap = await getDoc(ref);
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

/**
 * Get all reports for a student in a group
 */
export async function getSkillReports(groupId, studentId) {
    const q = query(
        collection(db, 'skill_reports'),
        where('groupId', '==', groupId),
        where('studentId', '==', studentId)
    );
    const snap = await getDocs(q);
    const reports = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    // Sort newest first client-side
    reports.sort((a, b) => {
        const tA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
        const tB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
        return tB - tA;
    });
    return reports;
}

/**
 * Get reports sent to a student (for dashboard)
 */
export async function getStudentSentReports(studentId) {
    const q = query(
        collection(db, 'skill_reports'),
        where('studentId', '==', studentId),
        where('status', '==', 'sent')
    );
    const snap = await getDocs(q);
    const reports = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    reports.sort((a, b) => {
        const tA = a.sentAt?.toMillis ? a.sentAt.toMillis() : (a.createdAt?.toMillis ? a.createdAt.toMillis() : 0);
        const tB = b.sentAt?.toMillis ? b.sentAt.toMillis() : (b.createdAt?.toMillis ? b.createdAt.toMillis() : 0);
        return tB - tA;
    });
    return reports;
}

/**
 * Delete a skill report
 */
export async function deleteSkillReport(reportId) {
    await deleteDoc(doc(db, 'skill_reports', reportId));
}

/**
 * Send a skill report to the student
 * - Updates status to 'sent'
 * - Creates a notification for the student
 */
export async function sendSkillReport(reportId, { studentId, studentName, teacherName, groupName }) {
    const ref = doc(db, 'skill_reports', reportId);
    await updateDoc(ref, {
        status: 'sent',
        sentAt: serverTimestamp(),
        updatedAt: serverTimestamp()
    });

    // Create notification for the student
    await createNotification({
        userId: studentId,
        type: 'skill_report',
        title: '📊 Báo cáo kỹ năng mới',
        message: `${teacherName || 'Giáo viên'} đã gửi báo cáo đánh giá kỹ năng của bạn${groupName ? ` trong lớp ${groupName}` : ''}. Hãy xem ngay!`,
        link: '/dashboard?scrollTo=reports'
    });

    // #6: Email to student
    try {
        const { getDoc, doc: firestoreDoc } = await import('firebase/firestore');
        const { db: database } = await import('../config/firebase');
        const studentSnap = await getDoc(firestoreDoc(database, 'users', studentId));
        if (studentSnap.exists() && studentSnap.data().email) {
            const { queueEmail, buildEmailHtml } = await import('./notificationService');
            await queueEmail(studentSnap.data().email, {
                subject: `Báo cáo kỹ năng mới từ ${teacherName || 'Giáo viên'}`,
                html: buildEmailHtml({
                    emoji: '📊', heading: 'Báo cáo kỹ năng mới', headingColor: '#06b6d4',
                    greeting: 'Chào bạn 👋',
                    body: `<p>Thầy/cô <strong>${teacherName || 'Giáo viên'}</strong> vừa gửi báo cáo đánh giá kỹ năng của bạn${groupName ? ` trong lớp <strong>${groupName}</strong>` : ''}. Vào xem để biết mình đang tiến bộ thế nào nhé! 💪</p>`,
                    ctaText: 'Xem báo cáo', ctaLink: 'https://upenglishvietnam.com/preview/superstudy/dashboard?scrollTo=reports', ctaColor: '#06b6d4', ctaColor2: '#22d3ee'
                })
            });
        }
    } catch (e) {
        console.error('Error sending skill report email:', e);
    }
}
