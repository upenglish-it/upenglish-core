/**
 * Scheduled Notifications — Cloud Functions (v1)
 * ────────────────────────────────────────────────
 * #8  checkDeadlineExpired — every 30 min, reminds teachers to grade expired assignments
 * #12 monthlySkillReportReminder — day 28 of each month, reminds teachers to write skill reports
 * #15 checkExpiringAccounts — daily, emails admins about accounts expiring within 7 days
 *
 * All functions send BOTH in-app notification + email (synchronized).
 */

const functions = require("firebase-functions/v1");
const admin = require("firebase-admin");
const nodemailer = require("nodemailer");

const SMTP_EMAIL = process.env.SMTP_EMAIL;
const SMTP_PASSWORD = process.env.SMTP_PASSWORD;
const SMTP_FROM_NAME = process.env.SMTP_FROM_NAME || "sUPerStudy";

let transporter = null;
function getTransporter() {
    if (!transporter) {
        transporter = nodemailer.createTransport({
            service: "gmail",
            auth: { user: SMTP_EMAIL, pass: SMTP_PASSWORD },
        });
    }
    return transporter;
}

async function sendEmail(to, subject, html) {
    const transport = getTransporter();
    await transport.sendMail({
        from: `"${SMTP_FROM_NAME}" <${SMTP_EMAIL}>`,
        to, subject, html,
    });
}

/**
 * Build branded email HTML (same as client-side version).
 */
function buildEmailHtml({ emoji = '📬', heading, headingColor = '#4f46e5', body,
    highlight, highlightBg = '#eef2ff', highlightBorder = '#4f46e5',
    ctaText, ctaColor = '#4f46e5', ctaColor2 = '#3b82f6', greeting }) {
    const logoUrl = 'https://upenglishvietnam.com/logo.png';
    const appUrl = 'https://upenglishvietnam.com/preview/superstudy';
    const highlightBlock = highlight ? `<div style="background:${highlightBg};padding:16px 20px;border-radius:12px;margin:16px 0;border-left:4px solid ${highlightBorder};">${highlight}</div>` : '';
    const greetingBlock = greeting ? `<p style="color:#334155;font-size:1.05rem;line-height:1.6;margin-bottom:4px;">${greeting}</p>` : '';
    const ctaBlock = ctaText ? `<div style="text-align:center;margin-top:28px;"><a href="${appUrl}" style="display:inline-block;background:linear-gradient(135deg,${ctaColor},${ctaColor2});color:white;padding:13px 36px;border-radius:12px;text-decoration:none;font-weight:700;font-size:0.95rem;box-shadow:0 4px 14px rgba(0,0,0,0.1);">${ctaText}</a></div>` : '';
    return `<div style="font-family:'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;max-width:540px;margin:0 auto;padding:0;background:#f8fafc;"><div style="text-align:center;padding:28px 24px 16px;"><img src="${logoUrl}" alt="UP English" style="height:48px;width:auto;margin-bottom:8px;" /><p style="color:#94a3b8;font-size:0.75rem;margin:0;letter-spacing:0.5px;">Trung tâm Ngoại ngữ UP</p></div><div style="background:#ffffff;margin:0 16px;padding:28px 24px;border-radius:16px;border:1px solid #e2e8f0;box-shadow:0 2px 8px rgba(0,0,0,0.04);"><h2 style="color:${headingColor};margin:0 0 16px;font-size:1.35rem;text-align:center;">${emoji} ${heading}</h2>${greetingBlock}<div style="color:#334155;font-size:0.95rem;line-height:1.7;">${body}</div>${highlightBlock}${ctaBlock}</div><div style="text-align:center;padding:20px 24px 28px;"><p style="color:#94a3b8;font-size:0.75rem;margin:0;">Bạn nhận email này vì đang là thành viên của sUPerStudy.</p><p style="color:#cbd5e1;font-size:0.7rem;margin:6px 0 0;">© ${new Date().getFullYear()} Trung tâm Ngoại ngữ UP — upenglishvietnam.com</p></div></div>`;
}

/**
 * Create an in-app notification for a user (using Admin SDK).
 */
async function createNotification(db, { userId, type, title, message, link }) {
    if (!userId) return;
    const ref = db.collection("notifications").doc();
    await ref.set({
        userId, type, title, message, link: link || "/",
        read: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
}

/**
 * Create in-app notifications for all admins/staff.
 */
async function createNotificationForAdmins(db, notifData) {
    const adminsSnap = await db.collection("users")
        .where("role", "in", ["admin", "staff"])
        .get();
    const batch = db.batch();
    adminsSnap.forEach(a => {
        const ref = db.collection("notifications").doc();
        batch.set(ref, {
            userId: a.id, ...notifData,
            read: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
    });
    await batch.commit();
}

// ════════════════════════════════════════════════════════
// #8: Check deadline expired — remind teachers to grade
// Runs every 30 minutes
// ════════════════════════════════════════════════════════

exports.checkDeadlineExpired = functions
    .region("asia-southeast1")
    .pubsub.schedule("every 30 minutes")
    .timeZone("Asia/Ho_Chi_Minh")
    .onRun(async () => {
        const db = admin.firestore();
        const now = admin.firestore.Timestamp.now();

        // Check vocabulary assignments
        try {
            const assignmentsSnap = await db.collection("assignments")
                .where("dueDate", "<=", now)
                .get();

            for (const doc of assignmentsSnap.docs) {
                const data = doc.data();
                if (data.deadlineNotified) continue;

                const groupId = data.groupId;
                if (!groupId) continue;

                const topicName = data.topicName || "bài luyện";

                const usersSnap = await db.collection("users")
                    .where("groupIds", "array-contains", groupId)
                    .get();

                const teachers = [];
                usersSnap.forEach(u => {
                    const ud = u.data();
                    if (ud.role === "teacher" && ud.email) {
                        const prefs = ud.emailPreferences;
                        const wantsEmail = !prefs || prefs.deadline_expired !== false;
                        teachers.push({ uid: u.id, email: ud.email, wantsEmail });
                    }
                });

                for (const t of teachers) {
                    await createNotification(db, {
                        userId: t.uid,
                        type: "deadline_expired",
                        title: `⏰ Bài "${topicName}" đã hết hạn`,
                        message: `Bài luyện "${topicName}" đã hết deadline. Hãy vào kiểm tra kết quả.`,
                        link: "/"
                    });
                    // Email (respect preference)
                    if (t.wantsEmail) {
                        await sendEmail(t.email,
                            `Bài "${topicName}" đã hết hạn`,
                            buildEmailHtml({
                                emoji: '⏰', heading: 'Bài đã hết hạn', headingColor: '#ef4444',
                                body: `<p>Bài luyện <strong>"${topicName}"</strong> đã hết deadline. Học viên đã nộp bài, hãy vào kiểm tra và đánh giá kết quả nhé!</p>`,
                                ctaText: 'Vào kiểm tra', ctaColor: '#ef4444', ctaColor2: '#f87171'
                            })
                        );
                    }
                }

                await doc.ref.update({ deadlineNotified: true });
            }
        } catch (e) {
            console.error("Error checking assignment deadlines:", e);
        }

        // Check exam assignments
        try {
            const examAssignmentsSnap = await db.collection("exam_assignments")
                .where("dueDate", "<=", now)
                .get();

            for (const doc of examAssignmentsSnap.docs) {
                const data = doc.data();
                if (data.deadlineNotified || data.isDeleted) continue;
                if (data.targetType !== "group" || !data.targetId) continue;

                const examName = data.examName || data.examTitle || "bài";

                const usersSnap = await db.collection("users")
                    .where("groupIds", "array-contains", data.targetId)
                    .get();

                const teachers = [];
                usersSnap.forEach(u => {
                    const ud = u.data();
                    if (ud.role === "teacher" && ud.email) {
                        const prefs = ud.emailPreferences;
                        const wantsEmail = !prefs || prefs.deadline_expired !== false;
                        teachers.push({ uid: u.id, email: ud.email, wantsEmail });
                    }
                });

                for (const t of teachers) {
                    await createNotification(db, {
                        userId: t.uid,
                        type: "deadline_expired",
                        title: `⏰ Bài "${examName}" đã hết hạn`,
                        message: `Bài "${examName}" đã hết deadline. Hãy vào chấm bài cho học viên.`,
                        link: "/"
                    });
                    // Email (respect preference)
                    if (t.wantsEmail) {
                        await sendEmail(t.email,
                            `Bài "${examName}" đã hết hạn — cần chấm`,
                            buildEmailHtml({
                                emoji: '⏰', heading: 'Bài đã hết hạn', headingColor: '#ef4444',
                                body: `<p>Bài <strong>"${examName}"</strong> đã hết deadline. Học viên đã nộp bài, hãy vào chấm điểm nhé!</p>`,
                                ctaText: 'Vào chấm bài', ctaColor: '#ef4444', ctaColor2: '#f87171'
                            })
                        );
                    }
                }

                await doc.ref.update({ deadlineNotified: true });
            }
        } catch (e) {
            console.error("Error checking exam assignment deadlines:", e);
        }

        return null;
    });

// ════════════════════════════════════════════════════════
// #12: Monthly skill report reminder — day 28
// ════════════════════════════════════════════════════════

exports.monthlySkillReportReminder = functions
    .region("asia-southeast1")
    .pubsub.schedule("0 9 28 * *")
    .timeZone("Asia/Ho_Chi_Minh")
    .onRun(async () => {
        const db = admin.firestore();

        try {
            const usersSnap = await db.collection("users")
                .where("role", "in", ["teacher"])
                .get();

            const month = new Date().toLocaleString("vi-VN", { month: "long", year: "numeric" });

            for (const userDoc of usersSnap.docs) {
                const ud = userDoc.data();

                // In-app notification
                await createNotification(db, {
                    userId: userDoc.id,
                    type: "skill_report_reminder",
                    title: `📊 Nhắc nhở: Viết báo cáo kỹ năng`,
                    message: `Đã gần cuối tháng! Hãy viết báo cáo đánh giá kỹ năng cho các học viên.`,
                    link: "/"
                });

                // Email (check preference)
                if (ud.email) {
                    const prefs = ud.emailPreferences;
                    if (!prefs || prefs.skill_report_reminder !== false) {
                        await sendEmail(ud.email,
                            `Nhắc nhở: Viết báo cáo kỹ năng tháng ${month}`,
                            buildEmailHtml({
                                emoji: '📊', heading: 'Nhắc nhở cuối tháng', headingColor: '#8b5cf6',
                                body: `<p>Đã gần cuối tháng rồi! Bạn nhớ viết <strong>báo cáo đánh giá kỹ năng</strong> cho các học viên trong các lớp bạn phụ trách nhé.</p><p style="color:#64748b;font-size:0.9rem;">Vào <strong>Tiến trình học viên → Báo cáo kỹ năng</strong> để tạo báo cáo.</p>`,
                                ctaText: 'Mở sUPerStudy', ctaColor: '#8b5cf6', ctaColor2: '#a78bfa'
                            })
                        );
                    }
                }
            }

            console.log(`Sent monthly skill report reminder to ${usersSnap.size} teachers`);
        } catch (e) {
            console.error("Error sending monthly skill report reminder:", e);
        }

        return null;
    });

// ════════════════════════════════════════════════════════
// #15: Check expiring accounts — daily
// ════════════════════════════════════════════════════════

exports.checkExpiringAccounts = functions
    .region("asia-southeast1")
    .pubsub.schedule("0 8 * * *")
    .timeZone("Asia/Ho_Chi_Minh")
    .onRun(async () => {
        const db = admin.firestore();

        try {
            const now = new Date();
            const sevenDaysLater = new Date(now.getTime() + 7 * 86400000);
            const sevenDaysTimestamp = admin.firestore.Timestamp.fromDate(sevenDaysLater);
            const nowTimestamp = admin.firestore.Timestamp.fromDate(now);

            const expiringSnap = await db.collection("users")
                .where("expiresAt", ">=", nowTimestamp)
                .where("expiresAt", "<=", sevenDaysTimestamp)
                .get();

            if (expiringSnap.empty) return null;

            const expiringUsers = [];
            expiringSnap.forEach(u => {
                const ud = u.data();
                if (ud.status === "approved" && !ud.expiryNotifiedAt) {
                    expiringUsers.push({
                        name: ud.displayName || ud.email || "N/A",
                        email: ud.email || "N/A",
                        expiresAt: ud.expiresAt.toDate().toLocaleDateString("vi-VN"),
                        ref: u.ref,
                    });
                }
            });

            if (expiringUsers.length === 0) return null;

            const userList = expiringUsers.map(u => `<li><strong>${u.name}</strong> (${u.email}) — hết hạn: ${u.expiresAt}</li>`).join("");

            // In-app notification for admins
            await createNotificationForAdmins(db, {
                type: "accounts_expiring",
                title: `⚠️ ${expiringUsers.length} tài khoản sắp hết hạn`,
                message: `Có ${expiringUsers.length} tài khoản sẽ hết hạn trong 7 ngày tới. Hãy vào kiểm tra và gia hạn.`,
                link: "/admin/users"
            });

            // Email to admins
            const adminsSnap = await db.collection("users")
                .where("role", "in", ["admin", "staff"])
                .get();

            const adminEmails = [];
            adminsSnap.forEach(a => {
                if (a.data().email) adminEmails.push(a.data().email);
            });

            for (const email of adminEmails) {
                // Check email preference
                const adminDoc = adminsSnap.docs.find(a => a.data().email === email);
                const prefs = adminDoc ? adminDoc.data().emailPreferences : null;
                if (prefs && prefs.accounts_expiring === false) continue; // user opted out

                await sendEmail(email,
                    `${expiringUsers.length} tài khoản sắp hết hạn`,
                    buildEmailHtml({
                        emoji: '⚠️', heading: 'Tài khoản sắp hết hạn', headingColor: '#f59e0b',
                        body: `<p>Các tài khoản sau sẽ hết hạn trong 7 ngày tới:</p><ul style="line-height:1.8;padding-left:20px;">${userList}</ul>`,
                        ctaText: 'Gia hạn tài khoản', ctaColor: '#f59e0b', ctaColor2: '#fbbf24'
                    })
                );
            }

            // Mark as notified
            const batch = db.batch();
            expiringUsers.forEach(u => {
                batch.update(u.ref, { expiryNotifiedAt: admin.firestore.FieldValue.serverTimestamp() });
            });
            await batch.commit();

            console.log(`Sent expiring account alerts for ${expiringUsers.length} users to ${adminEmails.length} admins`);
        } catch (e) {
            console.error("Error checking expiring accounts:", e);
        }

        return null;
    });

// ════════════════════════════════════════════════════════
// AUTO-SUBMIT EXPIRED EXAMS — every 2 minutes
// ════════════════════════════════════════════════════════

/**
 * Helper: call Gemini API for AI grading (essay questions) from server-side.
 * Uses the same secrets as aiProxy.
 */
async function callGeminiForGrading(systemPrompt, userContent) {
    // Try to get model config from Firestore, fallback to a default model
    const db = admin.firestore();
    let model = "gemini-2.5-flash-lite"; // safe fallback
    try {
        const configDoc = await db.collection("app_config").doc("ai_models").get();
        if (configDoc.exists) {
            const cfg = configDoc.data();
            const primaryModel = cfg.STANDARD_MODEL_PRIMARY || cfg.FREE_MODEL_PRIMARY || "";
            // Extract model name (remove "google:" prefix)
            if (primaryModel.startsWith("google:")) model = primaryModel.substring(7);
            else if (primaryModel && !primaryModel.includes(":")) model = primaryModel;
        }
    } catch (e) {
        console.warn("Could not load AI model config, using fallback:", e.message);
    }

    // Get API key from environment (set via Firebase Functions config)
    const apiKey = process.env.GOOGLE_API_KEY_FREE || process.env.GOOGLE_API_KEY_PAID;
    if (!apiKey) {
        throw new Error("No Google API key configured for server-side AI grading");
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const payload = {
        contents: [{ role: "user", parts: [{ text: userContent }] }],
        generationConfig: {
            responseMimeType: "application/json",
            thinkingConfig: { thinkingLevel: "HIGH" }
        }
    };
    if (systemPrompt) {
        payload.system_instruction = { parts: { text: systemPrompt } };
    }

    const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(60000)
    });

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Gemini API Error ${response.status}: ${errText}`);
    }

    const data = await response.json();
    const parts = data.candidates?.[0]?.content?.parts || [];
    let text = "";
    for (const part of parts) {
        if (part.thought === true) continue;
        text += part.text || "";
    }
    return text.trim();
}

/**
 * Grade an essay question using AI on the server.
 */
async function gradeEssayOnServer(variation, studentAnswer, purpose, type, specialRequirement, context, teacherTitle, studentTitle, questionIndex, previousResults) {
    const plainContext = context ? context.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim() : "";
    const finalTeacherTitle = teacherTitle || "thầy/cô";
    const finalStudentTitle = studentTitle || "em";

    const greetingInstruction = questionIndex > 0
        ? `\nĐây là câu hỏi thứ ${questionIndex + 1} trong bài. KHÔNG chào lại học viên (đã chào ở câu 1). Đi thẳng vào nhận xét nội dung.`
        : "";

    const previousResultsContext = previousResults.length > 0
        ? `\nKẾT QUẢ CÁC CÂU TRƯỚC TRONG CÙNG BÀI:\n${previousResults.map(r => `- Câu ${r.questionNumber} (${r.typeName}): ${r.isCorrect ? "ĐÚNG" : "SAI"} — ${r.score}/${r.maxScore} điểm`).join("\n")}`
        : "";

    const systemPrompt = `Bạn là giáo viên chấm bài luyện tiếng Anh. Khi xưng hô, hãy xưng là "${finalTeacherTitle}".${greetingInstruction}
Loại bài luyện: ${type}
Mục đích kiểm tra: ${purpose}
${plainContext ? `\nNGỮ CẢNH / ĐỀ BÀI:\n"""\n${plainContext}\n"""` : ""}
${specialRequirement ? `\nYÊU CẦU ĐẶC BIỆT TỪ GIÁO VIÊN:\n"""\n${specialRequirement}\n"""` : ""}
${previousResultsContext}

Hãy phân tích câu trả lời của học sinh. Chấm điểm từ 0 đến 10.

LƯU Ý: Toàn bộ phản hồi bằng TIẾNG VIỆT. KHÔNG dùng Markdown formatting.

Trả về JSON:
{
  "score": number,
  "feedback": "Nhận xét chi tiết bằng TIẾNG VIỆT",
  "teacherNote": "Ghi chú cho giáo viên bằng TIẾNG VIỆT",
  "detectedErrors": []
}`;

    const userContent = `Dữ liệu câu hỏi:\n${JSON.stringify(variation, null, 2)}\n\nCâu trả lời của học sinh:\n${JSON.stringify(studentAnswer, null, 2)}`;

    const responseText = await callGeminiForGrading(systemPrompt, userContent);
    return JSON.parse(responseText);
}

/**
 * Full grading logic — mirrors client-side gradeExamSubmission.
 * Grades all question types including essay (via Gemini API).
 */
async function gradeSubmissionOnServer(db, submissionId, submission, questions, sections, teacherTitle, studentTitle) {
    const results = {};
    let totalScore = 0;
    const maxTotalScore = questions.reduce((sum, q) => sum + (q.points || 1), 0);

    const questionsMap = {};
    questions.forEach(q => { questionsMap[q.id] = q; });

    const sectionsMap = {};
    (sections || []).forEach(s => {
        if (s?.id) {
            let fullContext = s.context || "";
            if (s.contextScript) fullContext += `\n\n[SCRIPT]:\n${s.contextScript}`;
            sectionsMap[s.id] = fullContext;
        }
    });

    const TYPE_LABELS = {
        multiple_choice: "Trắc nghiệm", matching: "Ghép nối", categorization: "Phân loại",
        fill_in_blank: "Điền từ", fill_in_blanks: "Điền từ", fill_in_blank_typing: "Điền từ (nhập)",
        essay: "Tự luận", audio_recording: "Thu âm", ordering: "Sắp xếp thứ tự"
    };

    let essayAudioIndex = 0;
    const previousResults = [];
    let questionCounter = 0;

    for (const sectionId of Object.keys(submission.answers || {})) {
        const sectionAnswers = submission.answers[sectionId] || {};
        for (const questionId of Object.keys(sectionAnswers)) {
            const question = questionsMap[questionId];
            if (!question) continue;

            const answerData = sectionAnswers[questionId];
            const variationIndex = submission.variationMap?.[questionId] || 0;
            let variation = question.variations?.[variationIndex];
            if (!variation || (!variation.options && !variation.pairs && !variation.items && (!variation.text || variation.text.replace(/<[^>]*>/g, "").trim().length === 0))) {
                variation = question.variations?.find(v => v && (Array.isArray(v.options) && v.options.some(o => o) || v.text?.replace(/<[^>]*>/g, "").trim().length > 0)) || question.variations?.[0];
            }
            if (!variation) continue;

            const maxScore = question.points || 1;

            try {
                let isCorrect = false;
                let score = 0;
                let feedback = "";
                let teacherNote = "";
                let detectedErrors = [];

                if (question.type === "multiple_choice") {
                    const correctAnswerText = variation.options[variation.correctAnswer];
                    isCorrect = answerData.answer === correctAnswerText;
                    score = isCorrect ? maxScore : 0;
                    const isImg = typeof correctAnswerText === "string" && (correctAnswerText.startsWith("https://firebasestorage.googleapis.com/") || correctAnswerText.startsWith("https://storage.googleapis.com/"));
                    feedback = isCorrect ? "Chính xác!" : `Đáp án đúng: ${isImg ? "Đáp án " + String.fromCharCode(65 + variation.correctAnswer) : correctAnswerText}`;
                } else if (question.type === "fill_in_blank" || question.type === "fill_in_blanks" || question.type === "fill_in_blank_typing") {
                    const markerRegex = /\{\{(.+?)\}\}/g;
                    const correctWords = [];
                    let mm;
                    while ((mm = markerRegex.exec(variation.text || "")) !== null) {
                        correctWords.push(mm[1]);
                    }
                    if (correctWords.length > 0 && typeof answerData.answer === "object" && answerData.answer !== null) {
                        let correctCount = 0;
                        correctWords.forEach((cw, idx) => {
                            const studentWord = answerData.answer[String(idx)];
                            if (typeof studentWord === "string" && studentWord.trim().toLowerCase() === cw.trim().toLowerCase()) correctCount++;
                        });
                        score = correctWords.length > 0 ? (correctCount / correctWords.length) * maxScore : 0;
                        score = Math.round(score * 10) / 10;
                        isCorrect = correctCount === correctWords.length && correctWords.length > 0;
                        feedback = isCorrect ? "Chính xác!" : `Bạn đã điền đúng ${correctCount}/${correctWords.length} chỗ trống.`;
                    } else {
                        isCorrect = typeof answerData.answer === "string" && answerData.answer.trim().toLowerCase() === variation.correctAnswer?.trim().toLowerCase();
                        score = isCorrect ? maxScore : 0;
                        feedback = isCorrect ? "Chính xác!" : `Đáp án đúng: ${variation.correctAnswer}`;
                    }
                } else if (question.type === "matching") {
                    const pairs = variation.pairs || [];
                    const total = pairs.length;
                    let correctCount = 0;
                    pairs.forEach((pair, i) => { if (answerData.answer?.[i]?.text === pair.right) correctCount++; });
                    score = total > 0 ? (correctCount / total) * maxScore : 0;
                    score = Math.round(score * 10) / 10;
                    isCorrect = correctCount === total && total > 0;
                    feedback = isCorrect ? "Chính xác!" : `Bạn đã ghép đúng ${correctCount}/${total} cặp.`;
                } else if (question.type === "categorization") {
                    const items = variation.items || [];
                    const total = items.length;
                    let correctCount = 0;
                    const studentAnswers = answerData.answer || {};
                    items.forEach(item => { if (studentAnswers[item.text] === item.group) correctCount++; });
                    score = total > 0 ? (correctCount / total) * maxScore : 0;
                    score = Math.round(score * 10) / 10;
                    isCorrect = correctCount === total && total > 0;
                    feedback = isCorrect ? "Chính xác!" : `Bạn đã phân loại đúng ${correctCount}/${total} mục.`;
                } else if (question.type === "ordering") {
                    const correctItems = variation.items || [];
                    const total = correctItems.length;
                    let correctCount = 0;
                    const studentOrder = Array.isArray(answerData.answer) ? answerData.answer : [];
                    correctItems.forEach((item, i) => { if (studentOrder[i] === item) correctCount++; });
                    score = total > 0 ? (correctCount / total) * maxScore : 0;
                    score = Math.round(score * 10) / 10;
                    isCorrect = correctCount === total && total > 0;
                    feedback = isCorrect ? "Chính xác!" : `Bạn đã xếp đúng vị trí ${correctCount}/${total} mục.`;
                } else if (question.type === "essay") {
                    try {
                        const sectionContext = sectionsMap[sectionId] || "";
                        const gradeResult = await gradeEssayOnServer(
                            variation, answerData.answer, question.purpose, question.type,
                            question.specialRequirement || "", sectionContext,
                            teacherTitle, studentTitle, essayAudioIndex, previousResults
                        );
                        essayAudioIndex++;
                        const numericScore = parseInt(gradeResult.score, 10);
                        score = Math.round((numericScore / 10) * maxScore * 10) / 10;
                        isCorrect = numericScore >= 8;
                        feedback = gradeResult.feedback || "";
                        teacherNote = gradeResult.teacherNote || "";
                        detectedErrors = Array.isArray(gradeResult.detectedErrors) ? gradeResult.detectedErrors : [];
                    } catch (aiErr) {
                        console.error(`Server AI grading failed for question ${questionId}:`, aiErr.message);
                        score = 0;
                        feedback = "Lỗi khi chấm bài bằng AI. Giáo viên sẽ chấm thủ công.";
                    }
                } else if (question.type === "audio_recording") {
                    const audioAnswer = answerData.answer || {};
                    if (audioAnswer.aiScore !== undefined) {
                        const numericScore = parseFloat(audioAnswer.aiScore);
                        score = numericScore;
                        isCorrect = numericScore >= (maxScore * 0.8);
                        feedback = audioAnswer.aiFeedback || "";
                    } else {
                        score = 0;
                        feedback = audioAnswer.transcript
                            ? "Bài thu âm chưa được AI chấm điểm. Giáo viên sẽ chấm thủ công."
                            : "Học viên chưa thu âm câu trả lời.";
                    }
                }

                totalScore += score;
                questionCounter++;
                const resultEntry = { score, maxScore, isCorrect, feedback, teacherOverride: null };
                if (teacherNote) resultEntry.teacherNote = teacherNote;
                if (detectedErrors.length > 0) resultEntry.detectedErrors = detectedErrors;
                results[questionId] = resultEntry;

                previousResults.push({
                    questionNumber: questionCounter,
                    typeName: TYPE_LABELS[question.type] || question.type,
                    purpose: question.purpose || "",
                    isCorrect, score, maxScore, feedback: feedback || ""
                });
            } catch (err) {
                console.error(`Error grading question ${questionId}:`, err);
                results[questionId] = { score: 0, maxScore, isCorrect: false, feedback: "Lỗi khi chấm câu hỏi này.", teacherOverride: null };
            }
        }
    }

    // Mark unanswered questions as 0
    for (const question of questions) {
        if (!results[question.id]) {
            results[question.id] = { score: 0, maxScore: question.points || 1, isCorrect: false, feedback: "", teacherOverride: null };
        }
    }

    totalScore = Math.round(totalScore * 10) / 10;

    await db.collection("exam_submissions").doc(submissionId).update({
        results, totalScore, maxTotalScore,
        status: "graded",
        gradedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return { results, totalScore, maxTotalScore };
}

exports.autoSubmitExpiredExams = functions
    .region("asia-southeast1")
    .runWith({ timeoutSeconds: 540, memory: "512MB", secrets: ["GOOGLE_API_KEY_FREE", "GOOGLE_API_KEY_PAID"] })
    .pubsub.schedule("every 10 minutes")
    .timeZone("Asia/Ho_Chi_Minh")
    .onRun(async () => {
        const db = admin.firestore();
        const now = admin.firestore.Timestamp.now();

        try {
            // Query all in-progress submissions where examEndTime has passed
            const expiredSnap = await db.collection("exam_submissions")
                .where("status", "==", "in_progress")
                .where("examEndTime", "<=", now)
                .get();

            if (expiredSnap.empty) return null;

            console.log(`[AutoSubmit] Found ${expiredSnap.size} expired exam submissions to auto-submit.`);

            for (const subDoc of expiredSnap.docs) {
                const subData = subDoc.data();
                const submissionId = subDoc.id;

                try {
                    // 1. Mark as submitted
                    await subDoc.ref.update({
                        status: "submitted",
                        submittedAt: admin.firestore.FieldValue.serverTimestamp(),
                        autoSubmitted: true,
                        updatedAt: admin.firestore.FieldValue.serverTimestamp()
                    });

                    // 2. Load exam and questions for grading
                    const examId = subData.examId;
                    if (!examId) {
                        console.warn(`[AutoSubmit] Submission ${submissionId} has no examId, skipping grading.`);
                        continue;
                    }

                    const examDoc = await db.collection("exams").doc(examId).get();
                    if (!examDoc.exists) {
                        console.warn(`[AutoSubmit] Exam ${examId} not found for submission ${submissionId}.`);
                        continue;
                    }
                    const examData = examDoc.data();

                    // Fetch exam questions
                    const questionsSnap = await db.collection("exam_questions")
                        .where("examId", "==", examId)
                        .get();
                    const questions = questionsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

                    // Get teacher titles for AI grading
                    let teacherTitle = "";
                    let studentTitle = "";
                    if (examData.teacherTitle) {
                        teacherTitle = examData.teacherTitle;
                        studentTitle = examData.studentTitle || "";
                    } else if (examData.createdBy) {
                        const userDoc = await db.collection("users").doc(examData.createdBy).get();
                        if (userDoc.exists) {
                            teacherTitle = userDoc.data().teacherTitle || "";
                            studentTitle = userDoc.data().studentTitle || "";
                        }
                    }

                    // 3. Grade the submission
                    await gradeSubmissionOnServer(
                        db, submissionId, subData, questions,
                        examData.sections || [], teacherTitle, studentTitle
                    );

                    console.log(`[AutoSubmit] Successfully auto-submitted and graded submission ${submissionId}.`);

                    // 4. Notify group teachers about auto-submission
                    if (subData.assignmentId) {
                        try {
                            const asgnDoc = await db.collection("exam_assignments").doc(subData.assignmentId).get();
                            if (asgnDoc.exists) {
                                const asgnData = asgnDoc.data();
                                if (asgnData.targetType === "group" && asgnData.targetId) {
                                    // Get student name
                                    let studentName = "Học viên";
                                    if (subData.studentId) {
                                        const studentDoc = await db.collection("users").doc(subData.studentId).get();
                                        if (studentDoc.exists) {
                                            studentName = studentDoc.data().displayName || studentDoc.data().email || "Học viên";
                                        }
                                    }

                                    const examName = asgnData.examName || asgnData.examTitle || examData.name || "Bài tập";

                                    // Find teachers in the group
                                    const usersSnap = await db.collection("users")
                                        .where("groupIds", "array-contains", asgnData.targetId)
                                        .get();

                                    for (const uDoc of usersSnap.docs) {
                                        if (uDoc.data().role === "teacher") {
                                            await createNotification(db, {
                                                userId: uDoc.id,
                                                type: "exam_submitted",
                                                title: "📩 Bài tự động nộp",
                                                message: `Bài "${examName}" của ${studentName} đã được hệ thống tự động nộp do hết giờ.`,
                                                link: `/teacher/exam-submissions/${subData.assignmentId}`
                                            });
                                        }
                                    }
                                }
                            }
                        } catch (notifErr) {
                            console.error(`[AutoSubmit] Notification error for ${submissionId}:`, notifErr.message);
                        }
                    }

                } catch (subErr) {
                    console.error(`[AutoSubmit] Error processing submission ${submissionId}:`, subErr.message);
                }
            }
        } catch (e) {
            console.error("[AutoSubmit] Error in autoSubmitExpiredExams:", e);
        }

        return null;
    });
