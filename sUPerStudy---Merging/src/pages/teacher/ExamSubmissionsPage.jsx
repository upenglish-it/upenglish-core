import { useState, useEffect, useRef } from 'react';
import { useParams, Link, useLocation, useNavigate } from 'react-router-dom';
import { getExam, getExamQuestions, getExamSubmission, overrideExamQuestionScore, releaseExamSubmissionResults, getExamAssignment, gradeExamSubmission, gradeSingleQuestion, regenerateExamSummaryForSubmission, toggleFollowUpRequest, gradeFollowUpAnswer, overrideFollowUpScore, releaseFollowUpResults } from '../../services/examService';
import { useAuth } from '../../contexts/AuthContext';
import { useAppSettings } from '../../contexts/AppSettingsContext';
import { ArrowLeft, Check, X, Edit, Save, Award, AlertCircle, Send, FileText, Flag, AlertTriangle, Sparkles, EyeOff, RefreshCw, MessageSquare } from 'lucide-react';
import ConfirmModal from '../../components/common/ConfirmModal';
import { getRedFlagsForStudent, addRedFlag, removeRedFlag, VIOLATION_TYPES } from '../../services/redFlagService';
import { db } from '../../config/firebase';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { OptionContent, isImageOption } from '../../components/common/MCQImageOption';
import { normalizeForComparison } from '../../utils/textNormalization';

const hasContent = (html) => {
    if (!html) return false;
    const stripped = html.replace(/<[^>]*>/g, '').trim();
    if (stripped.length > 0) return true;
    return /<(img|iframe|video|audio|embed|object)/i.test(html);
};

const renderFeedbackHtml = (text) => {
    if (!text) return '';
    let safe = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    safe = safe.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
    safe = safe.replace(/\*(.+?)\*/g, '<i>$1</i>');
    safe = safe.replace(/\n/g, '<br>');
    return safe;
};

const feedbackHtmlToMd = (html) => {
    if (!html) return '';
    let md = html;
    md = md.replace(/<(b|strong)[^>]*>/gi, '**').replace(/<\/(b|strong)>/gi, '**');
    md = md.replace(/<(i|em)[^>]*>/gi, '*').replace(/<\/(i|em)>/gi, '*');
    md = md.replace(/<br\s*\/?>/gi, '\n');
    md = md.replace(/<div[^>]*>/gi, '\n').replace(/<\/div>/gi, '');
    md = md.replace(/<p[^>]*>/gi, '\n').replace(/<\/p>/gi, '');
    md = md.replace(/<[^>]*>/g, '');
    md = md.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ');
    md = md.replace(/\n{3,}/g, '\n\n');
    return md.trim();
};

const parseContextHtml = (html) => {
    if (!html) return '';
    const regex = /<iframe[^>]*>.*?<\/iframe>|<a[^>]*href="(https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})[^"]*)"[^>]*>.*?<\/a>|(https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})[^\s<"]*)/gi;
    let parsed = html.replace(regex, (match, aUrl, aVideoId, rawUrl, rawVideoId) => {
        if (match.toLowerCase().startsWith('<iframe')) return match;
        const videoId = aVideoId || rawVideoId;
        if (videoId) {
            return `<iframe class="ql-video" style="width: 100%; aspect-ratio: 16 / 9; border-radius: 12px; border: none; height: auto;" src="https://www.youtube.com/embed/${videoId}?showinfo=0" frameborder="0" allowfullscreen></iframe>`;
        }
        return match;
    });
    return parsed.replace(/&nbsp;/g, ' ');
};

const QUESTION_TYPE_LABELS = {
    multiple_choice: 'Trắc nghiệm',
    matching: 'Kết nối',
    categorization: 'Phân loại',
    fill_in_blank: 'Chọn đáp án cho chỗ trống',
    fill_in_blanks: 'Chọn đáp án cho chỗ trống',
    fill_in_blank_typing: 'Điền vào chỗ trống',
    short_answer: 'Trả lời ngắn',
    essay: 'Tự luận',
    audio_recording: 'Thu âm',
    ordering: 'Sắp xếp thứ tự'
};

export default function ExamSubmissionsPage() {
    const { assignmentId, studentId } = useParams();
    const { user } = useAuth();
    const { settings } = useAppSettings();
    const location = useLocation();
    const navigate = useNavigate();

    const [submission, setSubmission] = useState(null);
    const [assignment, setAssignment] = useState(null);
    const [exam, setExam] = useState(null);
    const [questions, setQuestions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editingScore, setEditingScore] = useState(null); // questionId
    const [overrideData, setOverrideData] = useState({ score: 0, note: '', feedback: '' });
    const [saving, setSaving] = useState(false);
    const [releasing, setReleasing] = useState(false);
    const [toast, setToast] = useState(null);
    const [showConfirm, setShowConfirm] = useState(false);
    const [studentInfo, setStudentInfo] = useState(null);
    const [redFlags, setRedFlags] = useState([]);
    const [showRedFlagModal, setShowRedFlagModal] = useState(false);
    const [redFlagForm, setRedFlagForm] = useState({ violationType: '', note: '' });
    const [violationDropdownOpen, setViolationDropdownOpen] = useState(false);
    const [redFlagLoading, setRedFlagLoading] = useState(false);
    const [redFlagViewIndex, setRedFlagViewIndex] = useState(null);
    const feedbackEditorRef = useRef(null);
    const [removingFlagId, setRemovingFlagId] = useState(null);
    const [removeReasonText, setRemoveReasonText] = useState('');
    const [retryingGrade, setRetryingGrade] = useState(false);
    const [editingSummary, setEditingSummary] = useState(false);
    const [summaryEditText, setSummaryEditText] = useState('');
    const [savingSummary, setSavingSummary] = useState(false);
    const [generatingSummary, setGeneratingSummary] = useState(false);
    const [showRegenerateConfirm, setShowRegenerateConfirm] = useState(false);
    const [summaryClearedByOverride, setSummaryClearedByOverride] = useState(false);

    const [retryingQuestionId, setRetryingQuestionId] = useState(null);
    const [togglingFollowUp, setTogglingFollowUp] = useState(null);
    const [gradingFollowUp, setGradingFollowUp] = useState(null);
    const [editingFollowUpScore, setEditingFollowUpScore] = useState(null);
    const [followUpOverrideData, setFollowUpOverrideData] = useState({ score: 0, note: '', feedback: '' });
    const [releasingFollowUp, setReleasingFollowUp] = useState(false);
    const [showFollowUpConfirm, setShowFollowUpConfirm] = useState(false);
    const followUpFeedbackRef = useRef(null);
    const summaryEditRef = useRef(null);

    useEffect(() => { loadData(); }, [assignmentId, studentId]);
    useEffect(() => { if (toast) { const t = setTimeout(() => setToast(null), 3000); return () => clearTimeout(t); } }, [toast]);

    async function loadData() {
        setLoading(true);
        try {
            const sub = await getExamSubmission(assignmentId, studentId);
            if (sub) {
                setSubmission(sub);
                const [examData, questionsData, assignmentData, userSnap, flags] = await Promise.all([
                    getExam(sub.examId),
                    getExamQuestions(sub.examId),
                    getExamAssignment(assignmentId),
                    getDoc(doc(db, 'users', studentId)),
                    getRedFlagsForStudent(studentId)
                ]);
                // Filter out orphan questions not belonging to any active section
                const sectionIds = new Set((examData?.sections || []).map(s => s.id));
                const validQs = questionsData.filter(q => q.sectionId && sectionIds.has(q.sectionId));
                setExam(examData);
                setQuestions(validQs);
                setAssignment(assignmentData);
                if (userSnap.exists()) {
                    setStudentInfo({ uid: studentId, ...userSnap.data() });
                }
                setRedFlags(flags);
            }
        } catch (error) {
            console.error(error);
            setToast({ type: 'error', text: 'Lỗi: ' + error.message });
        }
        setLoading(false);
    }

    function openOverrideForm(questionId) {
        const result = submission?.results?.[questionId];
        setEditingScore(questionId);
        const scoreVal = result?.teacherOverride?.score ?? result?.score ?? 0;
        setOverrideData({
            score: String(scoreVal),
            note: result?.teacherOverride?.note ?? '',
            feedback: result?.feedback ?? ''
        });
    }

    async function handleSaveOverride(questionId) {
        setSaving(true);
        try {
            // Read feedback from contentEditable editor if available
            const feedbackMd = feedbackEditorRef.current
                ? feedbackHtmlToMd(feedbackEditorRef.current.innerHTML)
                : overrideData.feedback;
            const overriderName = user?.displayName || user?.email || (user?.role === 'admin' ? 'Admin' : 'Giáo viên');
            const finalScore = parseFloat(String(overrideData.score).replace(',', '.')) || 0;
            await overrideExamQuestionScore(
                submission.id, questionId, finalScore, overrideData.note, feedbackMd, user?.uid, overriderName
            );
            const hadSummary = !!submission.examSummary;
            // Reload full data from Firestore to ensure UI reflects the saved state
            const freshSub = await getExamSubmission(assignmentId, studentId);
            if (freshSub) setSubmission(freshSub);
            setEditingScore(null);
            if (hadSummary) setSummaryClearedByOverride(true);
            setToast({ type: 'success', text: 'Đã cập nhật điểm!' });
        } catch (error) {
            setToast({ type: 'error', text: 'Lỗi: ' + error.message });
        }
        setSaving(false);
    }

    async function handleReleaseResults() {
        setShowConfirm(true);
    }

    async function handleConfirmRelease() {
        setShowConfirm(false);
        setReleasing(true);
        try {
            const releaserName = user?.displayName || user?.email || (user?.role === 'admin' ? 'Admin' : 'Giáo viên');
            await releaseExamSubmissionResults(submission.id, user?.uid, releaserName);
            setSubmission(prev => ({ ...prev, resultsReleased: true }));
            setToast({ type: 'success', text: 'Đã gửi kết quả cho học sinh!' });
        } catch (error) {
            setToast({ type: 'error', text: 'Lỗi: ' + error.message });
        }
        setReleasing(false);
    }

    const isAdminView = location.pathname.startsWith('/admin');
    let backLink = isAdminView ? '/admin/exams' : '/teacher/exams';

    // Nếu đây là bài trên lớp (có groupId) -> quay về tab exams của lớp đó
    if (assignment?.groupId) {
        backLink = isAdminView ? `/admin/groups/${assignment.groupId}?tab=exams` : `/teacher/groups/${assignment.groupId}?tab=exams`;
    } else if (assignment?.targetType === 'group' && assignment?.targetId) {
        backLink = isAdminView ? `/admin/groups/${assignment.targetId}?tab=exams` : `/teacher/groups/${assignment.targetId}?tab=exams`;
    }

    if (loading) return <div className="admin-page"><div className="admin-empty-state">Đang tải...</div></div>;
    if (!submission) return <div className="admin-page"><div className="admin-empty-state">Không tìm thấy bài làm.</div></div>;
    // Helper: check if a single question has AI grading error
    const isQuestionAiError = (qId, r) => {
        if (r.feedback && (r.feedback.includes('Lỗi khi chấm') || r.feedback.includes('chấm thủ công') || r.feedback.includes('chưa được AI chấm'))) return true;
        const q = questions.find(qq => qq.id === qId);
        if (q?.type === 'audio_recording' && (r.score === 0 || r.score === undefined) && !r.feedback && !r.teacherOverride) {
            const sectionAnswers = submission.answers?.[q.sectionId] || {};
            if (sectionAnswers[qId]?.answer?.hasRecording) return true;
        }
        return false;
    };

    const hasAiGradingError = submission.results && Object.entries(submission.results).some(([qId, r]) => isQuestionAiError(qId, r));

    // Full re-grade button only when ALL AI-graded questions failed (individual failures use per-question button)
    const aiGradedQuestions = questions.filter(q => q.type === 'essay' || q.type === 'audio_recording');
    const allAiQuestionsFailed = aiGradedQuestions.length > 0 && aiGradedQuestions.every(q => {
        const r = submission.results?.[q.id];
        if (!r) return true;
        return isQuestionAiError(q.id, r);
    });

    const statusMap = {
        'in_progress': { label: 'Đang làm', color: '#f59e0b', bg: '#fef3c7' },
        'submitted': { label: 'Đã nộp - Đang chấm', color: '#3b82f6', bg: '#eff6ff' },
        'grading': { label: 'Đang chấm...', color: '#8b5cf6', bg: '#f5f3ff' },
        'graded': { label: 'AI đã chấm', color: '#10b981', bg: '#ecfdf5' },
        'released': { label: 'Đã trả kết quả', color: '#7c3aed', bg: '#f5f3ff' }
    };
    const statusKey = submission.status === 'graded' && submission.resultsReleased ? 'released' : submission.status;
    let status = statusMap[statusKey] || statusMap['submitted'];
    if (hasAiGradingError && submission.status === 'graded' && !submission.resultsReleased) {
        status = { label: 'AI chấm sót', color: '#ea580c', bg: '#fff7ed' };
    }

    const showRetryBtn = submission.status === 'submitted' || (submission.status === 'graded' && allAiQuestionsFailed && !submission.resultsReleased) || (settings?.allowRetryAiGrading && submission.status === 'graded' && !submission.resultsReleased);
    const showReleaseBtn = submission.status === 'graded' && !submission.resultsReleased;
    const canRelease = showReleaseBtn && !!submission.examSummary;
    const showReleasedBadge = submission.resultsReleased;

    // Follow-up state
    const followUpRequested = submission.followUpRequested || {};
    const followUpAnswers = submission.followUpAnswers || {};
    const followUpResults = submission.followUpResults || {};
    const hasAnyFollowUpRequest = Object.keys(followUpRequested).length > 0;
    const hasAnyFollowUpAnswer = Object.values(followUpAnswers).some(sec => Object.keys(sec || {}).length > 0);
    const showFollowUpReleaseBtn = hasAnyFollowUpAnswer && !submission.followUpResultsReleased;
    const showFollowUpReleasedBadge = submission.followUpResultsReleased;
    const showPendingFollowUpBadge = submission.resultsReleased && hasAnyFollowUpRequest && !submission.followUpResultsReleased;

    async function handleToggleFollowUp(questionId, currentlyRequested) {
        setTogglingFollowUp(questionId);
        try {
            const teacherName = user?.displayName || user?.email || 'Giáo viên';
            await toggleFollowUpRequest(submission.id, questionId, user?.uid, teacherName, !currentlyRequested);
            const freshSub = await getExamSubmission(assignmentId, studentId);
            if (freshSub) setSubmission(freshSub);
            setToast({ type: 'success', text: currentlyRequested ? 'Đã hủy yêu cầu sửa bài' : 'Đã yêu cầu học sinh sửa bài' });
        } catch (e) {
            setToast({ type: 'error', text: 'Lỗi: ' + e.message });
        }
        setTogglingFollowUp(null);
    }

    async function handleGradeFollowUp(questionId, question) {
        setGradingFollowUp(questionId);
        try {
            await gradeFollowUpAnswer(
                submission.id, questionId, question,
                exam?.sections || [],
                exam?.teacherTitle || 'thầy/cô',
                exam?.studentTitle || 'em'
            );
            const freshSub = await getExamSubmission(assignmentId, studentId);
            if (freshSub) setSubmission(freshSub);
            setToast({ type: 'success', text: 'AI đã chấm bài sửa thành công!' });
        } catch (e) {
            setToast({ type: 'error', text: 'Lỗi chấm bài sửa: ' + e.message });
        }
        setGradingFollowUp(null);
    }

    function openFollowUpOverrideForm(questionId) {
        const result = followUpResults[questionId];
        setEditingFollowUpScore(questionId);
        const scoreVal = result?.teacherOverride?.score ?? result?.score ?? 0;
        setFollowUpOverrideData({
            score: String(scoreVal),
            note: result?.teacherOverride?.note ?? '',
            feedback: result?.feedback ?? ''
        });
    }

    async function handleSaveFollowUpOverride(questionId) {
        setSaving(true);
        try {
            const feedbackMd = followUpFeedbackRef.current
                ? feedbackHtmlToMd(followUpFeedbackRef.current.innerHTML)
                : followUpOverrideData.feedback;
            const overriderName = user?.displayName || user?.email || 'Giáo viên';
            const finalScore = parseFloat(String(followUpOverrideData.score).replace(',', '.')) || 0;
            await overrideFollowUpScore(
                submission.id, questionId, finalScore, followUpOverrideData.note, feedbackMd, user?.uid, overriderName
            );
            const freshSub = await getExamSubmission(assignmentId, studentId);
            if (freshSub) setSubmission(freshSub);
            setEditingFollowUpScore(null);
            setToast({ type: 'success', text: 'Đã cập nhật điểm bài sửa!' });
        } catch (e) {
            setToast({ type: 'error', text: 'Lỗi: ' + e.message });
        }
        setSaving(false);
    }

    async function handleReleaseFollowUp() {
        setReleasingFollowUp(true);
        try {
            const releaserName = user?.displayName || user?.email || 'Giáo viên';
            await releaseFollowUpResults(submission.id, user?.uid, releaserName);
            const freshSub = await getExamSubmission(assignmentId, studentId);
            if (freshSub) setSubmission(freshSub);
            setToast({ type: 'success', text: 'Đã gửi kết quả bài sửa cho học sinh!' });
        } catch (e) {
            setToast({ type: 'error', text: 'Lỗi: ' + e.message });
        }
        setReleasingFollowUp(false);
        setShowFollowUpConfirm(false);
    }

    const retryButton = (
        <button className="admin-btn admin-btn-primary" onClick={async () => {
            setRetryingGrade(true);
            try {
                await gradeExamSubmission(
                    submission.id, submission, questions,
                    exam?.sections || [],
                    exam?.teacherTitle || '',
                    exam?.studentTitle || ''
                );
                await loadData();
                setToast({ type: 'success', text: 'AI đã chấm bài thành công!' });
            } catch (e) {
                setToast({ type: 'error', text: 'Lỗi khi AI chấm: ' + e.message });
            }
            setRetryingGrade(false);
        }} disabled={retryingGrade} style={{ background: '#f59e0b', display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 14px', fontSize: '0.82rem' }}>
            <Sparkles size={14} /> {retryingGrade ? 'Đang chấm...' : 'AI chấm lại'}
        </button>
    );

    const releaseButton = (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
            <button className="admin-btn admin-btn-primary" onClick={handleReleaseResults} disabled={releasing || !canRelease} style={{ background: canRelease ? '#10b981' : '#9ca3af', display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 14px', fontSize: '0.82rem', cursor: canRelease ? 'pointer' : 'not-allowed', opacity: canRelease ? 1 : 0.7 }}>
                <Send size={14} /> {releasing ? 'Đang gửi...' : 'Gửi kết quả'}
            </button>
            {!canRelease && showReleaseBtn && (
                <span style={{ fontSize: '0.7rem', color: '#ef4444', fontWeight: 600, maxWidth: '200px', textAlign: 'right' }}>Hãy tạo nhận xét tổng thể trước khi gửi điểm về cho học viên</span>
            )}
        </div>
    );

    const releasedBadge = (() => {
        const resultsBy = submission.releasedByName || '';
        const followUpBy = submission.followUpReleasedByName || '';
        const samePerson = resultsBy && followUpBy && resultsBy === followUpBy;
        return (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 700, fontSize: '0.78rem', padding: '5px 12px', borderRadius: '10px', background: showFollowUpReleasedBadge ? 'linear-gradient(135deg, #ecfdf5, #f5f3ff)' : '#ecfdf5', border: showFollowUpReleasedBadge ? '1px solid #c4b5fd' : '1px solid #a7f3d0' }}>
                <Check size={13} style={{ color: '#10b981' }} />
                <span style={{ color: '#10b981' }}>Đã trả kết quả</span>
                {!samePerson && resultsBy && <span style={{ color: '#94a3b8', fontWeight: 500, fontSize: '0.68rem' }}>({resultsBy})</span>}
                {showFollowUpReleasedBadge && (
                    <>
                        <span style={{ color: '#cbd5e1' }}>•</span>
                        <span style={{ color: '#8b5cf6' }}>Đã trả bài sửa</span>
                        {!samePerson && followUpBy && <span style={{ color: '#94a3b8', fontWeight: 500, fontSize: '0.68rem' }}>({followUpBy})</span>}
                    </>
                )}
                {samePerson && <span style={{ color: '#94a3b8', fontWeight: 500, fontSize: '0.68rem' }}>({resultsBy})</span>}
            </div>
        );
    })();

    const pendingFollowUpBadge = showPendingFollowUpBadge ? (
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontWeight: 700, fontSize: '0.78rem', padding: '5px 12px', borderRadius: '10px', background: '#fffbeb', border: '1px solid #fcd34d', color: '#92400e' }}>
            <span style={{ fontSize: '0.85rem' }}>🔄</span>
            <span>Đang yêu cầu sửa bài ({Object.keys(followUpRequested).length} câu)</span>
        </div>
    ) : null;

    return (
        <div className="admin-page" style={{ paddingBottom: '80px' }}>
            <style>{`
                .esp-inline-actions { display: none; }
                @media (max-width: 768px) {
                    .esp-header-actions { display: none !important; }
                    .esp-inline-actions { display: contents !important; }
                }
            `}</style>
            {toast && (
                <div style={{
                    position: 'fixed', top: '24px', right: '24px', zIndex: 10000,
                    padding: '14px 24px', borderRadius: '12px',
                    background: toast.type === 'success' ? '#ecfdf5' : '#fef2f2',
                    color: toast.type === 'success' ? '#065f46' : '#991b1b',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontWeight: 600, fontSize: '0.9rem'
                }}>{toast.text}</div>
            )}

            <ConfirmModal
                isOpen={showConfirm}
                title="Xác nhận gửi kết quả"
                message="Sau khi gửi, học sinh sẽ có thể xem điểm và đáp án chi tiết. Bạn chắc chắn chứ?"
                onConfirm={handleConfirmRelease}
                onCancel={() => setShowConfirm(false)}
                confirmText="Gửi kết quả"
                type="primary"
            />

            <ConfirmModal
                isOpen={showFollowUpConfirm}
                title="Gửi kết quả bài sửa"
                message="Sau khi gửi, học sinh sẽ xem được điểm và nhận xét bài sửa. Bạn chắc chắn chứ?"
                onConfirm={handleReleaseFollowUp}
                onCancel={() => setShowFollowUpConfirm(false)}
                confirmText="Gửi kết quả bài sửa"
                type="primary"
            />

            <ConfirmModal
                isOpen={showRegenerateConfirm}
                title="Tạo lại nhận xét AI"
                message="Tạo lại nhận xét tổng kết bằng AI cho bài này? Nhận xét hiện tại sẽ bị thay thế."
                onConfirm={async () => {
                    setShowRegenerateConfirm(false);
                    setGeneratingSummary(true);
                    try {
                        const newSummary = await regenerateExamSummaryForSubmission(submission.id, questions);
                        setSubmission(prev => ({ ...prev, examSummary: newSummary }));
                        setEditingSummary(false);
                        setSummaryClearedByOverride(false);
                    } catch (e) {
                        setToast({ type: 'error', text: 'Lỗi khi tạo nhận xét: ' + e.message });
                    }
                    setGeneratingSummary(false);
                }}
                onCancel={() => setShowRegenerateConfirm(false)}
                confirmText="Tạo lại"
                type="primary"
            />
            <div className="admin-page-header" style={{ alignItems: 'center', paddingBottom: '8px' }}>
                <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <button onClick={() => navigate(-1)} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#64748b', textDecoration: 'none', fontSize: '0.9rem', marginBottom: '4px', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                            <ArrowLeft size={16} /> Quay lại
                        </button>
                        <div className="esp-header-actions" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>

                            {showRetryBtn && retryButton}
                            {showReleaseBtn && releaseButton}
                            {showReleasedBadge && releasedBadge}
                            {pendingFollowUpBadge}
                            {showFollowUpReleaseBtn && (
                                <button className="admin-btn admin-btn-primary" onClick={() => setShowFollowUpConfirm(true)} disabled={releasingFollowUp}
                                    style={{ background: '#8b5cf6', display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 14px', fontSize: '0.82rem' }}>
                                    <MessageSquare size={14} /> {releasingFollowUp ? 'Đang gửi...' : 'Gửi kết quả bài sửa'}
                                </button>
                            )}
                        </div>
                    </div>

                    <h1 className="admin-page-title" style={{ margin: '0 0 4px 0', textAlign: 'center' }}>
                        Chi tiết bài làm
                    </h1>
                    <p className="admin-page-subtitle">Xem chi tiết, chấm điểm và nhận xét bài làm của học viên.</p>

                    <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: '6px',
                        padding: '5px 14px', background: 'linear-gradient(135deg, #eef2ff, #e0e7ff)', color: '#4338ca',
                        borderRadius: '20px', fontSize: '0.82rem', fontWeight: 600,
                        border: '1px solid #c7d2fe', letterSpacing: '0.01em'
                    }}>
                        <FileText size={13} style={{ opacity: 0.7 }} />
                        {exam?.examType === 'test' ? 'Bài kiểm tra' : 'Bài tập'}: {exam?.name || '...'}
                    </span>

                    {/* Student info + red flags */}
                    {studentInfo && (() => {
                        const activeCount = redFlags.filter(f => !f.removed).length;
                        return (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', marginTop: '6px' }}>
                                <span style={{ fontSize: '1.15rem', fontWeight: 700, color: 'rgb(30, 41, 59)' }}>
                                    {studentInfo.displayName || studentInfo.email}
                                </span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                                    {[1, 2, 3].map(i => {
                                        const isFilled = i <= activeCount;
                                        const isNext = i === activeCount + 1 && activeCount < 3;
                                        const flagColor = i >= 3 ? '#dc2626' : i === 2 ? '#ea580c' : '#ca8a04';
                                        return (
                                            <span
                                                key={i}
                                                onClick={() => {
                                                    if (isFilled) {
                                                        setRedFlagViewIndex(i);
                                                    } else if (isNext) {
                                                        setShowRedFlagModal(true);
                                                        setRedFlagForm({ violationType: '', note: '' });
                                                    }
                                                }}
                                                style={{
                                                    width: '22px', height: '22px', borderRadius: '5px',
                                                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                                    fontSize: '0.7rem',
                                                    background: isFilled ? (i >= 3 ? '#fef2f2' : i === 2 ? '#fff7ed' : '#fefce8') : 'transparent',
                                                    border: isFilled ? `1.5px solid ${flagColor}40` : '1.5px solid transparent',
                                                    cursor: (isFilled || isNext) ? 'pointer' : 'default',
                                                    opacity: isFilled ? 1 : 0.3,
                                                    filter: !isFilled ? 'grayscale(1)' : 'none',
                                                    transition: 'all 0.2s'
                                                }}
                                                title={isFilled ? `Xem cờ đỏ lần ${i}` : isNext ? `Đánh cờ đỏ lần ${i}` : ''}
                                            >
                                                🚩
                                            </span>
                                        );
                                    })}
                                    {activeCount >= 3 && (
                                        <span style={{ fontSize: '0.68rem', color: '#dc2626', fontWeight: 600, marginLeft: '4px' }}>Không còn đảm bảo đầu ra</span>
                                    )}
                                </div>
                            </div>
                        );
                    })()}
                </div>
            </div>

            {/* Stats + action row */}
            <div style={{
                display: 'flex', flexWrap: 'wrap', gap: '8px',
                marginBottom: '16px', justifyContent: 'center', alignItems: 'center'
            }}>
                {statusKey !== 'released' && (
                <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: '5px',
                    padding: '5px 12px', borderRadius: '10px',
                    background: status.bg, border: `1px solid ${status.color}22`
                }}>
                    <AlertCircle size={13} style={{ color: status.color }} />
                    <span style={{ fontSize: '0.78rem', fontWeight: 700, color: status.color }}>
                        {status.label}
                    </span>
                </div>
                )}

                <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: '5px',
                    padding: '5px 12px', borderRadius: '10px',
                    background: '#f5f3ff', border: '1px solid #ede9fe'
                }}>
                    <Award size={13} style={{ color: '#6366f1' }} />
                    <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#1e293b' }}>
                        {submission.totalScore != null ? Math.round(submission.totalScore * 10) / 10 : '--'}<span style={{ color: '#94a3b8' }}>/{submission.maxTotalScore || questions.reduce((sum, q) => {
                            const p = q.points || 1;
                            const v = q.variations?.[0];
                            if (!v) return sum + p;
                            if (['fill_in_blank','fill_in_blanks','fill_in_blank_typing'].includes(q.type)) return sum + p * ((v.text||'').match(/\{\{.+?\}\}/g)?.length||1);
                            if (q.type === 'matching') return sum + p * ((v.pairs||[]).length||1);
                            if (q.type === 'categorization') return sum + p * ((v.items||[]).length||1);
                            return sum + p;
                        }, 0) || '--'}</span>
                    </span>
                </div>

                <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: '5px',
                    padding: '5px 12px', borderRadius: '10px',
                    background: '#f0f9ff', border: '1px solid #e0f2fe'
                }}>
                    <FileText size={13} style={{ color: '#0ea5e9' }} />
                    <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#1e293b' }}>{questions.length} câu hỏi</span>
                </div>

                {submission.tabSwitchCount > 0 && (
                    <div style={{
                        display: 'inline-flex', alignItems: 'center', gap: '5px',
                        padding: '5px 12px', borderRadius: '10px',
                        background: '#fffbeb', border: '1px solid #fde68a'
                    }}>
                        <EyeOff size={13} style={{ color: '#d97706' }} />
                        <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#92400e' }}>Rời trang {submission.tabSwitchCount} lần</span>
                    </div>
                )}

                {/* Action buttons — visible only on mobile */}
                <div className="esp-inline-actions">
                
                    {showReleaseBtn && releaseButton}
                    {showRetryBtn && retryButton}    {showReleasedBadge && releasedBadge}    {pendingFollowUpBadge}
                </div>
            </div>

            {/* AI Exam Summary */}
            {submission.examSummary ? (
                <div style={{
                    margin: '0 0 24px',
                    padding: '16px 20px',
                    background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
                    borderRadius: '14px',
                    border: '1px solid #bae6fd'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '1.1rem' }}>📝</span>
                            <span style={{ fontWeight: 700, color: '#0369a1', fontSize: '0.95rem' }}>Nhận xét tổng kết</span>
                        </div>
                        <div style={{ display: 'flex', gap: '6px' }}>
                            {!editingSummary && (
                                <button
                                    onClick={() => { setEditingSummary(true); setSummaryEditText(submission.examSummary); }}
                                    style={{
                                        background: 'none', border: '1px solid #93c5fd', borderRadius: '8px',
                                        color: '#3b82f6', fontSize: '0.8rem', padding: '4px 10px', cursor: 'pointer'
                                    }}
                                >✏️ Chỉnh sửa</button>
                            )}
                            <button
                                disabled={generatingSummary}
                                onClick={() => setShowRegenerateConfirm(true)}
                                style={{
                                    background: 'none', border: '1px solid #93c5fd', borderRadius: '8px',
                                    color: '#3b82f6', fontSize: '0.8rem', padding: '4px 10px', cursor: 'pointer'
                                }}
                            >{generatingSummary ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}><span style={{ display: 'inline-block', width: '12px', height: '12px', border: '2px solid #93c5fd', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} /> Đang tạo...</span> : '🔄 Tạo lại'}</button>
                        </div>
                    </div>
                    {editingSummary ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <div
                                ref={summaryEditRef}
                                contentEditable
                                suppressContentEditableWarning
                                dangerouslySetInnerHTML={{
                                    __html: summaryEditText
                                        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                                        .split('\n')
                                        .map(line => {
                                            const trimmed = line.trim();
                                            if (trimmed.startsWith('- ')) return `<li style="margin-left:16px;margin-bottom:2px">${trimmed.slice(2)}</li>`;
                                            return line;
                                        })
                                        .join('<br/>')
                                        .replace(/<br\/><li/g, '<li')
                                        .replace(/<\/li><br\/>/g, '</li>')
                                }}
                                style={{
                                    padding: '12px', borderRadius: '10px',
                                    border: '2px solid #3b82f6', fontSize: '0.9rem', lineHeight: '1.6',
                                    background: '#fff', color: '#334155', outline: 'none',
                                    minHeight: '120px', whiteSpace: 'pre-wrap', cursor: 'text'
                                }}
                            />
                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                <button
                                    onClick={() => setEditingSummary(false)}
                                    style={{ padding: '6px 14px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#fff', color: '#64748b', fontSize: '0.85rem', cursor: 'pointer', fontWeight: 600 }}
                                >Hủy</button>
                                <button
                                    disabled={savingSummary}
                                    onClick={async () => {
                                        setSavingSummary(true);
                                        try {
                                            // Convert HTML back to markdown-like text
                                            const el = summaryEditRef.current;
                                            let html = el.innerHTML;
                                            // Convert <strong>/<b> to **text**
                                            html = html.replace(/<(strong|b)>(.*?)<\/(strong|b)>/gi, '**$2**');
                                            // Convert <li> to - text
                                            html = html.replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1');
                                            // Convert <br> and <div> to newlines
                                            html = html.replace(/<br\s*\/?>/gi, '\n');
                                            html = html.replace(/<\/div>\s*<div[^>]*>/gi, '\n');
                                            html = html.replace(/<div[^>]*>/gi, '\n');
                                            html = html.replace(/<\/div>/gi, '');
                                            // Strip remaining HTML
                                            html = html.replace(/<[^>]+>/g, '');
                                            // Decode entities
                                            const txt = document.createElement('textarea');
                                            txt.innerHTML = html;
                                            const markdown = txt.value.replace(/^\n+/, '').replace(/\n{3,}/g, '\n\n');

                                            await updateDoc(doc(db, 'exam_submissions', submission.id), {
                                                examSummary: markdown,
                                                updatedAt: serverTimestamp()
                                            });
                                            setSubmission(prev => ({ ...prev, examSummary: markdown }));
                                            setEditingSummary(false);
                                            setToast({ type: 'success', text: 'Đã lưu nhận xét tổng kết!' });
                                        } catch (e) {
                                            setToast({ type: 'error', text: 'Lỗi: ' + e.message });
                                        }
                                        setSavingSummary(false);
                                    }}
                                    style={{ padding: '6px 14px', borderRadius: '8px', border: 'none', background: '#0284c7', color: '#fff', fontSize: '0.85rem', cursor: 'pointer', fontWeight: 600 }}
                                >{savingSummary ? 'Đang lưu...' : '💾 Lưu nhận xét'}</button>
                            </div>
                        </div>
                    ) : (
                    <div style={{
                        color: '#334155',
                        fontSize: '0.9rem',
                        lineHeight: '1.6',
                        whiteSpace: 'pre-wrap'
                    }}
                        dangerouslySetInnerHTML={{
                            __html: submission.examSummary
                                .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                                .split('\n')
                                .map(line => {
                                    const trimmed = line.trim();
                                    if (trimmed.startsWith('- ')) return `<li style="margin-left:16px;margin-bottom:2px">${trimmed.slice(2)}</li>`;
                                    return line;
                                })
                                .join('<br/>')
                                .replace(/<br\/><li/g, '<li')
                                .replace(/<\/li><br\/>/g, '</li>')
                        }}
                    />
                    )}
                </div>
            ) : (submission.status === 'graded' || submission.status === 'released') && submission.totalScore > 0 && (
                <div style={{
                    margin: '0 0 24px',
                    padding: '14px 18px',
                    background: hasAiGradingError
                        ? 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)'
                        : 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)',
                    borderRadius: '14px',
                    border: hasAiGradingError ? '1px solid #fca5a5' : '1px solid #fcd34d',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                        <span style={{ fontSize: '1.1rem' }}>{hasAiGradingError ? '🚫' : '⚠️'}</span>
                        <span style={{ color: hasAiGradingError ? '#991b1b' : '#92400e', fontSize: '0.85rem' }}>
                            {hasAiGradingError
                                ? 'Hãy chấm xong tất cả các câu trước khi tạo nhận xét tổng kết.'
                                : summaryClearedByOverride
                                    ? '⚠️ Nhận xét tổng thể đã bị xóa vì điểm đã thay đổi. Hãy tạo lại nhận xét trước khi trả bài.'
                                    : 'Chưa có nhận xét tổng kết. Nhấn nút bên cạnh để tạo bằng AI.'
                            }
                        </span>
                    </div>
                    <button
                        disabled={hasAiGradingError || generatingSummary}
                        onClick={async () => {
                            setGeneratingSummary(true);
                            try {
                                const newSummary = await regenerateExamSummaryForSubmission(submission.id, questions);
                                setSubmission(prev => ({ ...prev, examSummary: newSummary }));
                                setSummaryClearedByOverride(false);
                            } catch (e) {
                                setToast({ type: 'error', text: 'Lỗi khi tạo nhận xét: ' + e.message });
                            }
                            setGeneratingSummary(false);
                        }}
                        style={{
                            background: hasAiGradingError ? '#d1d5db' : '#f59e0b', border: 'none', borderRadius: '10px',
                            color: '#fff', fontSize: '0.85rem', padding: '8px 14px',
                            cursor: (hasAiGradingError || generatingSummary) ? 'not-allowed' : 'pointer',
                            fontWeight: 600, whiteSpace: 'nowrap',
                            opacity: (hasAiGradingError || generatingSummary) ? 0.6 : 1,
                            display: 'flex', alignItems: 'center', gap: '6px'
                        }}
                    >{generatingSummary ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}><span style={{ display: 'inline-block', width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} /> Đang tạo...</span> : '✨ Tạo nhận xét AI'}</button>
                </div>
            )}

            {/* Questions by section */}
            {(exam?.sections || []).map((section, sIdx) => {
                const sectionQuestions = questions.filter(q => q.sectionId === section.id).sort((a, b) => (a.order || 0) - (b.order || 0));
                if (sectionQuestions.length === 0) return null;

                return (
                    <div key={section.id} style={{ marginBottom: '32px' }}>
                        <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#475569', marginBottom: '12px', padding: '8px 16px', background: '#f1f5f9', borderRadius: '8px' }}>
                            {section.title || `Section ${sIdx + 1}`}
                        </h3>

                        {hasContent(section.context) && (
                            <div className="exam-context" style={{
                                marginBottom: '24px',
                                padding: '16px 0',
                                borderBottom: '1px solid #e2e8f0',
                                fontSize: '0.9rem',
                                lineHeight: '1.6',
                                color: '#334155'
                            }}>
                                <div className="ql-editor" dangerouslySetInnerHTML={{ __html: parseContextHtml(section.context) }} />
                            </div>
                        )}
                        {section.contextAudioUrl && (
                            <div style={{ marginBottom: '24px', padding: '12px 16px', background: '#f0fdf4', borderRadius: '12px', border: '1px solid #bbf7d0' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#15803d' }}>🎵 Audio ngữ cảnh</span>
                                </div>
                                <audio controls src={section.contextAudioUrl} style={{ width: '100%', height: '40px' }} controlsList="nodownload" preload="metadata" />
                            </div>
                        )}
                        {sectionQuestions.map((q, qIdx) => {
                            const result = submission.results?.[q.id];
                            const variationIdx = submission.variationMap?.[q.id] || 0;
                            let variation = q.variations?.[variationIdx];
                            // Fallback: if selected variation is empty, find first valid one
                            if (!variation || (!variation.options && !variation.pairs && !variation.items && (!variation.text || variation.text.replace(/<[^>]*>/g, '').trim().length === 0))) {
                                variation = q.variations?.find(v => v && (Array.isArray(v.options) && v.options.some(o => o) || v.text?.replace(/<[^>]*>/g, '').trim().length > 0)) || q.variations?.[0];
                            }
                            const sectionAnswers = submission.answers?.[section.id] || {};
                            const answer = sectionAnswers[q.id];
                            const effectiveScore = result?.teacherOverride?.score ?? result?.score;

                            return (
                                <div key={q.id} style={{
                                    marginBottom: '12px', padding: '16px', borderRadius: '12px',
                                    border: `1px solid ${result?.isCorrect ? '#a7f3d0' : result ? '#fecaca' : '#e2e8f0'}`,
                                    background: result?.isCorrect ? '#f0fdf4' : result ? '#fef2f2' : '#fff'
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                                            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#6366f1', background: '#eff6ff', padding: '2px 8px', borderRadius: '6px' }}>
                                                Câu {qIdx + 1}
                                            </span>
                                            <span style={{ fontSize: '0.7rem', color: '#64748b', background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px' }}>
                                                {QUESTION_TYPE_LABELS[q.type] || q.type}
                                            </span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <span style={{ fontWeight: 700, color: effectiveScore >= (result?.maxScore || 1) ? '#10b981' : '#ef4444' }}>
                                                {effectiveScore ?? '--'}/{result?.maxScore ?? q.points ?? 1}
                                            </span>
                                            {result?.teacherOverride && (
                                                <span style={{ fontSize: '0.65rem', color: '#8b5cf6', background: '#f5f3ff', padding: '1px 6px', borderRadius: '4px', fontWeight: 600 }}>
                                                    {result.teacherOverride.overriddenByName ? `${result.teacherOverride.overriddenByName} sửa` : 'GV sửa'}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Question text */}
                                    <div style={{ fontSize: '0.9rem', color: '#475569', lineHeight: '1.6', marginBottom: '12px', overflowWrap: 'break-word' }}>
                                        {(() => {
                                            const text = (variation?.text || '(Câu hỏi)').replace(/&nbsp;/g, ' ');
                                            const hasMarkers = /\{\{.+?\}\}/.test(text);
                                            if ((q.type === 'fill_in_blank' || q.type === 'fill_in_blanks' || q.type === 'fill_in_blank_typing') && hasMarkers) {
                                                const parts = text.split(/(\{\{.+?\}\})/g);
                                                return (
                                                    <span style={{ lineHeight: '1.6' }}>
                                                        {parts.map((part, i) => {
                                                            const match = part.match(/^\{\{(.+?)\}\}$/);
                                                            if (match) {
                                                                return <span key={i} style={{ display: 'inline-block', minWidth: '40px', borderBottom: '1.5px solid #94a3b8', margin: '0 4px', position: 'relative', top: '2px' }}></span>;
                                                            }
                                                            return <span key={i}>{part}</span>;
                                                        })}
                                                    </span>
                                                );
                                            }
                                            return <span dangerouslySetInnerHTML={{ __html: text }} />;
                                        })()}
                                    </div>

                                    {/* Student answer */}
                                    <div style={{ padding: '10px', background: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '8px', overflowWrap: 'break-word' }}>
                                        <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600, marginBottom: '6px' }}>Câu trả lời của học viên:</div>
                                        {(() => {
                                            const studentAnswer = answer?.answer;

                                            if ((q.type === 'fill_in_blank' || q.type === 'fill_in_blanks' || q.type === 'fill_in_blank_typing')) {
                                                const rawText = variation?.text || '';
                                                const hasMarkers = /\{\{.+?\}\}/.test(rawText);

                                                if (hasMarkers) {
                                                    const sAns = typeof studentAnswer === 'object' && studentAnswer !== null ? studentAnswer : {};
                                                    const parts = rawText.split(/(\{\{.+?\}\})/g);
                                                    const correctWords = [];
                                                    const regex = /\{\{(.+?)\}\}/g;
                                                    let mm;
                                                    while ((mm = regex.exec(rawText)) !== null) { correctWords.push(mm[1].replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ')); }

                                                    let blankIdx = 0;
                                                    return (
                                                        <div style={{ fontSize: '0.9rem', lineHeight: '2.4', padding: '12px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                                            {parts.map((part, i) => {
                                                                const match = part.match(/^\{\{(.+?)\}\}$/);
                                                                if (match) {
                                                                    const idx = blankIdx++;
                                                                    const sw = sAns[String(idx)] || '';
                                                                    const cw = correctWords[idx];
                                                                    const isFilled = sw.trim().length > 0;
                                                                    const ok = normalizeForComparison(sw) === normalizeForComparison(cw);
                                                                    const isAIAccepted = !ok && isFilled && result?.aiVerdicts?.[idx] === true;

                                                                    return (
                                                                        <span key={i} style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', margin: '0 4px', verticalAlign: 'middle' }}>
                                                                            <span style={{
                                                                                padding: '2px 8px', borderRadius: '6px', fontSize: '0.85rem', fontWeight: 600, lineHeight: '1.2',
                                                                                border: ok ? '1.5px solid #10b981' : isAIAccepted ? '1.5px solid #f59e0b' : (isFilled ? '1.5px solid #ef4444' : '1.5px dashed #cbd5e1'),
                                                                                background: ok ? '#d1fae5' : isAIAccepted ? '#fef3c7' : (isFilled ? '#fee2e2' : '#f1f5f9'),
                                                                                color: ok ? '#065f46' : isAIAccepted ? '#92400e' : (isFilled ? '#991b1b' : '#64748b'),
                                                                                minWidth: '40px', textAlign: 'center'
                                                                            }}>
                                                                                {isFilled ? sw : '—'}
                                                                            </span>
                                                                            {!ok && !isAIAccepted && (
                                                                                <span style={{ fontSize: '0.7rem', color: '#10b981', fontWeight: 700, marginTop: '2px', lineHeight: '1' }}>
                                                                                    {cw}
                                                                                </span>
                                                                            )}
                                                                            {isAIAccepted && (
                                                                                <span style={{ fontSize: '0.65rem', color: '#d97706', fontWeight: 600, marginTop: '2px' }}>✓ AI ({cw})</span>
                                                                            )}
                                                                        </span>
                                                                    );
                                                                }
                                                                return <span key={i}>{part}</span>;
                                                            })}
                                                        </div>
                                                    );
                                                }
                                            }

                                            if (q.type === 'audio_recording') {
                                                if (typeof studentAnswer === 'object' && studentAnswer?.hasRecording) {
                                                    return (
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                                <span style={{ fontSize: '1.2rem' }}>🎤</span>
                                                                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#10b981' }}>Đã ghi âm</span>
                                                            </div>
                                                            {studentAnswer.audioUrl && (
                                                                <audio controls src={studentAnswer.audioUrl} style={{ width: '100%', maxWidth: '400px', borderRadius: '8px' }} />
                                                            )}
                                                            {studentAnswer.transcript && (
                                                                <div style={{ fontSize: '0.85rem', color: '#1e293b', background: '#f8fafc', padding: '8px 12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                                                    <span style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 600 }}>📝 Transcript: </span>
                                                                    {studentAnswer.transcript}
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                }
                                                return <em style={{ color: '#94a3b8', fontSize: '0.9rem' }}>Chưa thu âm</em>;
                                            }

                                            if (!studentAnswer || (typeof studentAnswer === 'object' && Object.keys(studentAnswer).length === 0)) {
                                                return <em style={{ color: '#94a3b8', fontSize: '0.9rem' }}>Em đã không hoàn thành câu hỏi này</em>;
                                            }

                                            if (q.type === 'multiple_choice') {
                                                return (
                                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '4px' }}>
                                                        {(variation?.options || []).map((opt, i) => {
                                                            if (!opt) return null;
                                                            const isSelected = opt === studentAnswer;
                                                            const isCorrectOpt = i === variation?.correctAnswer;
                                                            let borderColor = '#e2e8f0';
                                                            let bgColor = '#f8fafc';
                                                            let textColor = '#64748b';

                                                            if (isSelected) {
                                                                borderColor = isCorrectOpt ? '#10b981' : '#ef4444';
                                                                bgColor = isCorrectOpt ? '#d1fae5' : '#fee2e2';
                                                                textColor = isCorrectOpt ? '#065f46' : '#991b1b';
                                                            } else if (isCorrectOpt) {
                                                                borderColor = '#10b981';
                                                                bgColor = '#ecfdf5';
                                                                textColor = '#059669';
                                                            }

                                                            return (
                                                                <div key={i} style={{
                                                                    padding: '4px 12px', borderRadius: '8px',
                                                                    border: isSelected ? `2px solid ${borderColor}` : `1px solid ${borderColor}`,
                                                                    background: bgColor, color: textColor, fontSize: '0.8rem',
                                                                    fontWeight: isSelected || isCorrectOpt ? 700 : 500,
                                                                    display: 'flex', alignItems: 'center', gap: '6px'
                                                                }}>
                                                                    <span style={{ fontWeight: 800 }}>{String.fromCharCode(65 + i)}.</span> <OptionContent opt={opt} size={80} />
                                                                    {isSelected && (isCorrectOpt ? <Check size={12} strokeWidth={3} /> : <X size={12} strokeWidth={3} />)}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                );
                                            }

                                            if (q.type === 'matching') {
                                                const pairs = variation?.pairs || [];
                                                const matched = Array.isArray(studentAnswer) ? studentAnswer : [];
                                                return (
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px' }}>
                                                        {pairs.map((pair, pIdx) => {
                                                            const studentMatch = matched[pIdx]?.text;
                                                            const isCorrectMatch = studentMatch === pair.right;
                                                            return (
                                                                <div key={pIdx} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem' }}>
                                                                    <div style={{ padding: '4px 8px', background: '#f1f5f9', color: '#475569', fontWeight: 700, borderRadius: '6px', border: '1px solid #e2e8f0', minWidth: '80px', textAlign: 'center' }}>{pair.left}</div>
                                                                    <span style={{ color: '#94a3b8', fontWeight: 900 }}>→</span>
                                                                    <div style={{
                                                                        padding: '4px 10px', borderRadius: '6px',
                                                                        border: isCorrectMatch ? '1.5px solid #10b981' : '1.5px solid #ef4444',
                                                                        background: isCorrectMatch ? '#f0fdf4' : '#fef2f2',
                                                                        color: isCorrectMatch ? '#065f46' : '#991b1b',
                                                                        fontWeight: 600, flex: 1
                                                                    }}>
                                                                        {studentMatch || '—'}
                                                                    </div>
                                                                    {!isCorrectMatch && (
                                                                        <div style={{ color: '#059669', fontSize: '0.75rem', fontWeight: 700, background: '#ecfdf5', padding: '2px 8px', borderRadius: '4px', border: '1px solid #a7f3d0' }}>
                                                                            Đúng: {pair.right}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                );
                                            }

                                            if (q.type === 'categorization') {
                                                const groups = variation?.groups || [];
                                                const studentCats = typeof studentAnswer === 'object' ? studentAnswer : {};
                                                return (
                                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px', marginTop: '4px' }}>
                                                        {groups.map((group, gIdx) => {
                                                            const assignedItems = Object.entries(studentCats).filter(([_, g]) => g === group).map(([t]) => t);
                                                            return (
                                                                <div key={gIdx} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '8px' }}>
                                                                    <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#64748b', borderBottom: '1px solid #e2e8f0', marginBottom: '6px', paddingBottom: '2px', textAlign: 'center', textTransform: 'uppercase' }}>{group}</div>
                                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                                        {assignedItems.length > 0 ? assignedItems.map(item => (
                                                                            <div key={item} style={{ fontSize: '0.75rem', padding: '2px 6px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '4px', color: '#334155', fontWeight: 600, textAlign: 'center' }}>{item}</div>
                                                                        )) : <div style={{ fontSize: '0.65rem', color: '#94a3b8', textAlign: 'center', fontStyle: 'italic' }}>Trống</div>}
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                );
                                            }

                                            if (q.type === 'ordering') {
                                                const correctItems = variation?.items || [];
                                                const studentOrder = Array.isArray(studentAnswer) ? studentAnswer : [];
                                                return (
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px' }}>
                                                        {studentOrder.map((item, idx) => {
                                                            const isCorrectPos = item === correctItems[idx];
                                                            return (
                                                                <div key={idx} style={{
                                                                    display: 'flex', alignItems: 'center', gap: '8px',
                                                                    padding: '4px 10px', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 600,
                                                                    border: isCorrectPos ? '1.5px solid #10b981' : '1.5px solid #ef4444',
                                                                    background: isCorrectPos ? '#d1fae5' : '#fee2e2',
                                                                    color: isCorrectPos ? '#065f46' : '#991b1b'
                                                                }}>
                                                                    <span style={{
                                                                        width: '20px', height: '20px', borderRadius: '50%',
                                                                        background: isCorrectPos ? '#10b981' : '#ef4444', color: '#fff',
                                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                        fontSize: '0.65rem', fontWeight: 900, flexShrink: 0
                                                                    }}>{idx + 1}</span>
                                                                    <span>{item}</span>
                                                                    {!isCorrectPos && (
                                                                        <span style={{ marginLeft: 'auto', fontSize: '0.7rem', color: '#059669', fontWeight: 700 }}>Đúng: {correctItems[idx]}</span>
                                                                    )}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                );
                                            }

                                            return <div style={{ fontSize: '0.9rem', color: '#0f172a', whiteSpace: 'pre-wrap' }}>{String(studentAnswer)}</div>;
                                        })()}
                                    </div>

                                    {/* Correct answer summary for text-based questions (fallback for non-marker fill in blanks) */}
                                    {((q.type === 'fill_in_blank' || q.type === 'fill_in_blanks') && !(/\{\{.+?\}\}/.test(variation?.text || ''))) && (
                                        <div style={{ fontSize: '0.8rem', color: '#059669', marginBottom: '8px', fontWeight: 600, background: '#ecfdf5', padding: '6px 12px', borderRadius: '8px', border: '1px solid #a7f3d0' }}>
                                            ✅ Đáp án đúng: {variation?.correctAnswer}
                                        </div>
                                    )}

                                    {/* AI Feedback */}
                                    {result?.feedback ? (
                                        <div style={{ fontSize: '0.8rem', color: '#1e40af', background: '#eff6ff', padding: '8px 12px', borderRadius: '8px', marginBottom: '8px', whiteSpace: 'pre-wrap' }}>
                                            💬 <span dangerouslySetInnerHTML={{ __html: renderFeedbackHtml(result.feedback) }} />
                                        </div>
                                    ) : (q.type === 'audio_recording' && (result?.score === 0 || result?.score === undefined) && answer?.answer?.hasRecording) ? (
                                        <div style={{ fontSize: '0.8rem', color: '#92400e', background: '#fffbeb', padding: '8px 12px', borderRadius: '8px', marginBottom: '8px' }}>
                                            ⏳ AI chưa chấm được câu này. Bấm "AI chấm lại" hoặc chấm thủ công bên dưới.
                                        </div>
                                    ) : null}

                                    {/* Teacher override */}
                                    {result?.teacherOverride?.note && (
                                        <div style={{ fontSize: '0.8rem', color: '#7c3aed', background: '#f5f3ff', padding: '8px 12px', borderRadius: '8px', marginBottom: '8px', whiteSpace: 'pre-wrap' }}>
                                            📝 GV: {result.teacherOverride.note}
                                        </div>
                                    )}

                                    {/* Override button */}
                                    {editingScore === q.id ? (
                                        <div style={{ display: 'flex', gap: '8px', flexDirection: 'column', marginTop: '8px', background: '#f8fafc', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                                                <input type="text" inputMode="decimal" className="admin-form-input" style={{ width: '80px', margin: 0 }}
                                                    value={overrideData.score} onChange={e => {
                                                        const raw = e.target.value;
                                                        // Allow digits, dot, comma, and empty string
                                                        if (raw === '' || /^[0-9]*[.,]?[0-9]*$/.test(raw)) {
                                                            setOverrideData({ ...overrideData, score: raw });
                                                        }
                                                    }} />
                                                <input type="text" className="admin-form-input" style={{ flex: 1, margin: 0 }} placeholder="Ghi chú (tùy chọn)"
                                                    value={overrideData.note} onChange={e => setOverrideData({ ...overrideData, note: e.target.value })} />
                                            </div>
                                            <div style={{ display: 'flex', gap: '4px', marginBottom: '4px' }}>
                                                {[{ label: 'B', cmd: 'bold', style: { fontWeight: 900 } }, { label: 'I', cmd: 'italic', style: { fontStyle: 'italic' } }].map(btn => (
                                                    <button key={btn.label} type="button" style={{
                                                        width: '28px', height: '28px', borderRadius: '6px',
                                                        border: '1px solid #e2e8f0', background: '#fff',
                                                        cursor: 'pointer', fontSize: '0.8rem', display: 'flex',
                                                        alignItems: 'center', justifyContent: 'center', ...btn.style
                                                    }} onMouseDown={e => {
                                                        e.preventDefault();
                                                        document.execCommand(btn.cmd, false, null);
                                                    }}>{btn.label}</button>
                                                ))}
                                            </div>
                                            <div
                                                ref={feedbackEditorRef}
                                                contentEditable
                                                suppressContentEditableWarning
                                                className="admin-form-input"
                                                style={{ minHeight: '60px', resize: 'vertical', margin: 0, fontSize: '0.85rem', whiteSpace: 'pre-wrap', overflowY: 'auto', outline: 'none' }}
                                                dangerouslySetInnerHTML={{ __html: renderFeedbackHtml(overrideData.feedback) }}
                                                onPaste={e => {
                                                    e.preventDefault();
                                                    const text = e.clipboardData.getData('text/plain');
                                                    document.execCommand('insertText', false, text);
                                                }}
                                            />
                                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                                <button className="admin-btn admin-btn-secondary" style={{ padding: '6px 12px' }} onClick={() => setEditingScore(null)}>Hủy</button>
                                                <button className="admin-btn admin-btn-primary" style={{ padding: '6px 12px' }} onClick={() => handleSaveOverride(q.id)} disabled={saving}>
                                                    <Save size={14} /> Lưu
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap', marginTop: '4px' }}>
                                            {result && (
                                                <button className="admin-btn admin-btn-outline" style={{ padding: '4px 12px', fontSize: '0.8rem' }}
                                                    onClick={() => openOverrideForm(q.id)}>
                                                    <Edit size={14} /> Sửa điểm
                                                </button>
                                            )}
                                            {/* Follow-up checkbox — only before releasing results, and only if student hasn't submitted yet */}
                                            {result && !submission.resultsReleased && !followUpAnswers[section.id]?.[q.id] && (
                                                <label style={{
                                                    display: 'inline-flex', alignItems: 'center', gap: '6px',
                                                    padding: '4px 12px', fontSize: '0.8rem', cursor: 'pointer',
                                                    borderRadius: '8px', fontWeight: 600,
                                                    background: followUpRequested[q.id] ? '#fef3c7' : '#f8fafc',
                                                    border: followUpRequested[q.id] ? '1.5px solid #f59e0b' : '1px solid #e2e8f0',
                                                    color: followUpRequested[q.id] ? '#92400e' : '#64748b',
                                                    opacity: togglingFollowUp === q.id ? 0.6 : 1,
                                                    transition: 'all 0.2s'
                                                }}>
                                                    <input
                                                        type="checkbox"
                                                        checked={!!followUpRequested[q.id]}
                                                        disabled={togglingFollowUp === q.id}
                                                        onChange={() => handleToggleFollowUp(q.id, !!followUpRequested[q.id])}
                                                        style={{ accentColor: '#f59e0b', width: '16px', height: '16px', cursor: 'pointer' }}
                                                    />
                                                    📝 Yêu cầu sửa bài
                                                </label>
                                            )}
                                            {/* Per-question AI re-grade — auto-show for error questions, no admin setting needed */}
                                            {(q.type === 'audio_recording' || q.type === 'essay' || q.type === 'short_answer') && !submission.resultsReleased && (
                                                isQuestionAiError(q.id, result || {})
                                                || (showRetryBtn && !result?.feedback && (result?.score === 0 || result?.score === undefined))
                                            ) && (
                                                <button
                                                    className="admin-btn admin-btn-outline"
                                                    style={{ padding: '4px 12px', fontSize: '0.8rem', color: '#f59e0b', borderColor: '#fde68a', background: retryingQuestionId === q.id ? '#fffbeb' : undefined }}
                                                    disabled={retryingQuestionId === q.id}
                                                    onClick={async () => {
                                                        setRetryingQuestionId(q.id);
                                                        try {
                                                            await gradeSingleQuestion(
                                                                submission.id, q.id, q,
                                                                exam?.sections || [],
                                                                exam?.teacherTitle || '',
                                                                exam?.studentTitle || ''
                                                            );
                                                            await loadData();
                                                            setToast({ type: 'success', text: `Đã chấm lại câu ${qIdx + 1} thành công!` });
                                                        } catch (e) {
                                                            setToast({ type: 'error', text: `Lỗi chấm câu ${qIdx + 1}: ${e.message}` });
                                                        }
                                                        setRetryingQuestionId(null);
                                                    }}
                                                >
                                                    <Sparkles size={14} /> {retryingQuestionId === q.id ? 'Đang chấm...' : 'AI chấm lại câu này'}
                                                </button>
                                            )}
                                        </div>

                                        {/* ── FOLLOW-UP ANSWER SECTION ── */}
                                        {(() => {
                                            const fuAnswer = followUpAnswers[section.id]?.[q.id];
                                            const fuResult = followUpResults[q.id];
                                            const isRequested = !!followUpRequested[q.id];
                                            if (!isRequested && !fuAnswer) return null;

                                            return (
                                                <div style={{
                                                    marginTop: '12px', padding: '12px', borderRadius: '12px',
                                                    background: 'linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%)',
                                                    border: '1.5px solid #c4b5fd'
                                                }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', justifyContent: 'space-between', flexWrap: 'wrap' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                            <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#7c3aed' }}>📝 Bài sửa (lần 2)</span>
                                                            {fuAnswer && <span style={{ fontSize: '0.65rem', color: '#10b981', fontWeight: 700, background: '#ecfdf5', padding: '2px 6px', borderRadius: '4px' }}>Đã nộp</span>}
                                                            {isRequested && !fuAnswer && <span style={{ fontSize: '0.65rem', color: '#f59e0b', fontWeight: 700, background: '#fef3c7', padding: '2px 6px', borderRadius: '4px' }}>Đang chờ</span>}
                                                            {fuResult?.teacherOverride && (
                                                                <span style={{ fontSize: '0.65rem', color: '#8b5cf6', background: '#f5f3ff', padding: '1px 6px', borderRadius: '4px', fontWeight: 600 }}>
                                                                    {fuResult.teacherOverride.overriddenByName || 'GV'} sửa
                                                                </span>
                                                            )}
                                                        </div>
                                                        {fuResult && (
                                                            <span style={{
                                                                fontWeight: 800, fontSize: '0.85rem',
                                                                color: (fuResult.teacherOverride?.score ?? fuResult.score) >= fuResult.maxScore ? '#10b981' : '#ef4444',
                                                                background: (fuResult.teacherOverride?.score ?? fuResult.score) >= fuResult.maxScore ? '#ecfdf5' : '#fef2f2',
                                                                padding: '3px 10px', borderRadius: '8px'
                                                            }}>
                                                                Điểm sửa: {fuResult.teacherOverride?.score ?? fuResult.score}/{fuResult.maxScore}
                                                                <span style={{ fontSize: '0.65rem', fontWeight: 400, color: '#94a3b8', marginLeft: '6px', fontStyle: 'italic' }}>(không ảnh hưởng điểm gốc)</span>
                                                            </span>
                                                        )}
                                                    </div>

                                                    {fuAnswer ? (
                                                        <>
                                                            {/* Student's follow-up answer */}
                                                            <div style={{ padding: '8px 12px', background: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '8px', fontSize: '0.85rem', color: '#1e293b' }}>
                                                                <div style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 600, marginBottom: '4px' }}>Câu trả lời sửa:</div>
                                                                {(() => {
                                                                    const fuAns = fuAnswer.answer;

                                                                    // Multiple choice — show selected option
                                                                    if (q.type === 'multiple_choice') {
                                                                        return (
                                                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                                                                {(variation?.options || []).map((opt, i) => {
                                                                                    if (!opt) return null;
                                                                                    const isSelected = opt === fuAns;
                                                                                    const isCorrectOpt = i === variation?.correctAnswer;
                                                                                    return (
                                                                                        <div key={i} style={{
                                                                                            padding: '3px 10px', borderRadius: '6px', fontSize: '0.8rem', fontWeight: isSelected ? 700 : 500,
                                                                                            border: isSelected ? `2px solid ${isCorrectOpt ? '#10b981' : '#ef4444'}` : '1px solid #e2e8f0',
                                                                                            background: isSelected ? (isCorrectOpt ? '#d1fae5' : '#fee2e2') : '#f8fafc',
                                                                                            color: isSelected ? (isCorrectOpt ? '#065f46' : '#991b1b') : '#64748b'
                                                                                        }}>
                                                                                            <span style={{ fontWeight: 800 }}>{String.fromCharCode(65 + i)}.</span> {opt}
                                                                                            {isSelected && (isCorrectOpt ? ' ✓' : ' ✗')}
                                                                                        </div>
                                                                                    );
                                                                                })}
                                                                            </div>
                                                                        );
                                                                    }

                                                                    // Fill in blank — show sentence with filled slots
                                                                    if ((q.type === 'fill_in_blank' || q.type === 'fill_in_blanks' || q.type === 'fill_in_blank_typing') && typeof fuAns === 'object' && fuAns !== null && !Array.isArray(fuAns)) {
                                                                        const rawText = variation?.text || '';
                                                                        const hasMarkers = /\{\{.+?\}\}/.test(rawText);
                                                                        if (hasMarkers) {
                                                                            const parts = rawText.replace(/&nbsp;/g, ' ').split(/(\{\{.+?\}\})/g);
                                                                            let blankIdx = 0;
                                                                            return (
                                                                                <div style={{ lineHeight: '2.2', fontSize: '0.85rem' }}>
                                                                                    {parts.map((part, i) => {
                                                                                        const match = part.match(/^\{\{(.+?)\}\}$/);
                                                                                        if (match) {
                                                                                            const idx = blankIdx++;
                                                                                            const filled = fuAns[String(idx)] || '';
                                                                                            return (
                                                                                                <span key={i} style={{
                                                                                                    display: 'inline-block', padding: '1px 8px', borderRadius: '6px',
                                                                                                    border: filled ? '1.5px solid #8b5cf6' : '1.5px dashed #cbd5e1',
                                                                                                    background: filled ? '#f5f3ff' : '#f1f5f9',
                                                                                                    color: filled ? '#5b21b6' : '#94a3b8',
                                                                                                    fontWeight: 600, margin: '0 3px', minWidth: '40px', textAlign: 'center'
                                                                                                }}>
                                                                                                    {filled || '—'}
                                                                                                </span>
                                                                                            );
                                                                                        }
                                                                                        return <span key={i}>{part}</span>;
                                                                                    })}
                                                                                </div>
                                                                            );
                                                                        }
                                                                        // No markers — show as key-value
                                                                        return (
                                                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                                                                {Object.entries(fuAns).map(([k, v]) => (
                                                                                    <span key={k} style={{ padding: '2px 8px', borderRadius: '6px', background: '#f5f3ff', border: '1px solid #c4b5fd', color: '#5b21b6', fontWeight: 600, fontSize: '0.8rem' }}>
                                                                                        {v || '—'}
                                                                                    </span>
                                                                                ))}
                                                                            </div>
                                                                        );
                                                                    }

                                                                    // Matching — show pairs with arrows
                                                                    if (q.type === 'matching' && Array.isArray(fuAns)) {
                                                                        const pairs = variation?.pairs || [];
                                                                        return (
                                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                                                {pairs.map((pair, pIdx) => {
                                                                                    const studentMatch = fuAns[pIdx]?.text || fuAns[pIdx] || '';
                                                                                    const isCorrectMatch = studentMatch === pair.right;
                                                                                    return (
                                                                                        <div key={pIdx} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem' }}>
                                                                                            <div style={{ padding: '3px 8px', background: '#f1f5f9', color: '#475569', fontWeight: 700, borderRadius: '6px', border: '1px solid #e2e8f0', minWidth: '70px', textAlign: 'center' }}>{pair.left}</div>
                                                                                            <span style={{ color: '#94a3b8', fontWeight: 900 }}>→</span>
                                                                                            <div style={{
                                                                                                padding: '3px 8px', borderRadius: '6px', fontWeight: 600, flex: 1,
                                                                                                border: isCorrectMatch ? '1.5px solid #10b981' : '1.5px solid #ef4444',
                                                                                                background: isCorrectMatch ? '#f0fdf4' : '#fef2f2',
                                                                                                color: isCorrectMatch ? '#065f46' : '#991b1b'
                                                                                            }}>
                                                                                                {studentMatch || '—'}
                                                                                            </div>
                                                                                            {!isCorrectMatch && (
                                                                                                <div style={{ color: '#059669', fontSize: '0.7rem', fontWeight: 700, background: '#ecfdf5', padding: '1px 6px', borderRadius: '4px' }}>Đúng: {pair.right}</div>
                                                                                            )}
                                                                                        </div>
                                                                                    );
                                                                                })}
                                                                            </div>
                                                                        );
                                                                    }

                                                                    // Categorization — show groups grid
                                                                    if (q.type === 'categorization' && typeof fuAns === 'object' && !Array.isArray(fuAns)) {
                                                                        const groups = variation?.groups || [];
                                                                        return (
                                                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '6px' }}>
                                                                                {groups.map((group, gIdx) => {
                                                                                    const assignedItems = Object.entries(fuAns).filter(([_, g]) => g === group).map(([t]) => t);
                                                                                    return (
                                                                                        <div key={gIdx} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '6px' }}>
                                                                                            <div style={{ fontSize: '0.68rem', fontWeight: 800, color: '#64748b', borderBottom: '1px solid #e2e8f0', marginBottom: '4px', paddingBottom: '2px', textAlign: 'center', textTransform: 'uppercase' }}>{group}</div>
                                                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                                                                                {assignedItems.length > 0 ? assignedItems.map(item => (
                                                                                                    <div key={item} style={{ fontSize: '0.75rem', padding: '2px 6px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '4px', color: '#334155', fontWeight: 600, textAlign: 'center' }}>{item}</div>
                                                                                                )) : <div style={{ fontSize: '0.65rem', color: '#94a3b8', textAlign: 'center', fontStyle: 'italic' }}>Trống</div>}
                                                                                            </div>
                                                                                        </div>
                                                                                    );
                                                                                })}
                                                                            </div>
                                                                        );
                                                                    }

                                                                    // Ordering — show numbered list
                                                                    if (q.type === 'ordering' && Array.isArray(fuAns)) {
                                                                        const correctItems = variation?.items || [];
                                                                        return (
                                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                                                                {fuAns.map((item, idx) => {
                                                                                    const isCorrectPos = item === correctItems[idx];
                                                                                    return (
                                                                                        <div key={idx} style={{
                                                                                            display: 'flex', alignItems: 'center', gap: '6px',
                                                                                            padding: '3px 8px', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 600,
                                                                                            border: isCorrectPos ? '1.5px solid #10b981' : '1.5px solid #ef4444',
                                                                                            background: isCorrectPos ? '#d1fae5' : '#fee2e2',
                                                                                            color: isCorrectPos ? '#065f46' : '#991b1b'
                                                                                        }}>
                                                                                            <span style={{
                                                                                                width: '18px', height: '18px', borderRadius: '50%',
                                                                                                background: isCorrectPos ? '#10b981' : '#ef4444', color: '#fff',
                                                                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                                                fontSize: '0.6rem', fontWeight: 900, flexShrink: 0
                                                                                            }}>{idx + 1}</span>
                                                                                            <span>{item}</span>
                                                                                            {!isCorrectPos && (
                                                                                                <span style={{ marginLeft: 'auto', fontSize: '0.68rem', color: '#059669', fontWeight: 700 }}>Đúng: {correctItems[idx]}</span>
                                                                                            )}
                                                                                        </div>
                                                                                    );
                                                                                })}
                                                                            </div>
                                                                        );
                                                                    }

                                                                    // Default: string or fallback
                                                                    if (typeof fuAns === 'string') {
                                                                        return <div style={{ whiteSpace: 'pre-wrap' }}>{fuAns}</div>;
                                                                    }
                                                                    return <div style={{ whiteSpace: 'pre-wrap', fontSize: '0.8rem', color: '#64748b' }}>{JSON.stringify(fuAns, null, 2)}</div>;
                                                                })()}
                                                            </div>
                                                            <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginBottom: '8px' }}>
                                                                Nộp lúc: {new Date(fuAnswer.submittedAt).toLocaleString('vi-VN')}
                                                            </div>

                                                            {/* Follow-up feedback & teacher note */}
                                                            {fuResult ? (
                                                                <div style={{ marginBottom: '8px' }}>
                                                                    {fuResult.feedback && (
                                                                        <div style={{ fontSize: '0.8rem', color: '#1e40af', background: '#eff6ff', padding: '8px 12px', borderRadius: '8px', marginBottom: '6px', whiteSpace: 'pre-wrap' }}>
                                                                            💬 <span dangerouslySetInnerHTML={{ __html: renderFeedbackHtml(fuResult.feedback) }} />
                                                                        </div>
                                                                    )}
                                                                    {fuResult.teacherOverride?.note && (
                                                                        <div style={{ fontSize: '0.8rem', color: '#7c3aed', background: '#f5f3ff', padding: '8px 12px', borderRadius: '8px', marginBottom: '6px', whiteSpace: 'pre-wrap' }}>
                                                                            📝 GV: {fuResult.teacherOverride.note}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            ) : null}

                                                            {/* Actions: AI grade + edit score */}
                                                            {editingFollowUpScore === q.id ? (
                                                                <div style={{ display: 'flex', gap: '8px', flexDirection: 'column', background: '#fff', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                                                                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                                                                        <input type="text" inputMode="decimal" className="admin-form-input" style={{ width: '80px', margin: 0 }}
                                                                            value={followUpOverrideData.score} onChange={e => {
                                                                                const raw = e.target.value;
                                                                                if (raw === '' || /^[0-9]*[.,]?[0-9]*$/.test(raw)) setFollowUpOverrideData({ ...followUpOverrideData, score: raw });
                                                                            }} />
                                                                        <input type="text" className="admin-form-input" style={{ flex: 1, margin: 0 }} placeholder="Ghi chú"
                                                                            value={followUpOverrideData.note} onChange={e => setFollowUpOverrideData({ ...followUpOverrideData, note: e.target.value })} />
                                                                    </div>
                                                                    <div
                                                                        ref={followUpFeedbackRef}
                                                                        contentEditable
                                                                        suppressContentEditableWarning
                                                                        className="admin-form-input"
                                                                        style={{ minHeight: '60px', resize: 'vertical', margin: 0, fontSize: '0.85rem', whiteSpace: 'pre-wrap', overflowY: 'auto', outline: 'none' }}
                                                                        dangerouslySetInnerHTML={{ __html: renderFeedbackHtml(followUpOverrideData.feedback) }}
                                                                        onPaste={e => { e.preventDefault(); document.execCommand('insertText', false, e.clipboardData.getData('text/plain')); }}
                                                                    />
                                                                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                                                        <button className="admin-btn admin-btn-secondary" style={{ padding: '6px 12px' }} onClick={() => setEditingFollowUpScore(null)}>Hủy</button>
                                                                        <button className="admin-btn admin-btn-primary" style={{ padding: '6px 12px' }} onClick={() => handleSaveFollowUpOverride(q.id)} disabled={saving}>
                                                                            <Save size={14} /> Lưu
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>

                                                                    {showRetryBtn && !fuResult && (
                                                                        <button className="admin-btn admin-btn-outline"
                                                                            style={{ padding: '4px 12px', fontSize: '0.8rem', color: '#8b5cf6', borderColor: '#c4b5fd' }}
                                                                            disabled={gradingFollowUp === q.id}
                                                                            onClick={() => handleGradeFollowUp(q.id, q)}>
                                                                            <Sparkles size={14} /> {gradingFollowUp === q.id ? 'Đang chấm...' : 'AI chấm bài sửa'}
                                                                        </button>
                                                                    )}
                                                                    {fuResult && (
                                                                        <>
                                                                            <button className="admin-btn admin-btn-outline" style={{ padding: '4px 12px', fontSize: '0.8rem' }}
                                                                                onClick={() => openFollowUpOverrideForm(q.id)}>
                                                                                <Edit size={14} /> Sửa điểm bài sửa
                                                                            </button>
                                                                            {showRetryBtn && (
                                                                                <button className="admin-btn admin-btn-outline"
                                                                                    style={{ padding: '4px 12px', fontSize: '0.8rem', color: '#8b5cf6', borderColor: '#c4b5fd' }}
                                                                                    disabled={gradingFollowUp === q.id}
                                                                                    onClick={() => handleGradeFollowUp(q.id, q)}>
                                                                                    <RefreshCw size={14} /> {gradingFollowUp === q.id ? 'Đang chấm...' : 'AI chấm lại'}
                                                                                </button>
                                                                            )}
                                                                        </>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </>
                                                    ) : (
                                                        submission.resultsReleased ? (
                                                            <div style={{ fontSize: '0.82rem', color: '#94a3b8', fontStyle: 'italic' }}>
                                                                Đang chờ học sinh nộp bài sửa...
                                                            </div>
                                                        ) : (
                                                            <div style={{ fontSize: '0.82rem', color: '#c4b5fd', fontStyle: 'italic' }}>
                                                                Sẽ yêu cầu học sinh sửa khi trả bài.
                                                            </div>
                                                        )
                                                    )}
                                                </div>
                                            );
                                        })()}
                                        </>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                );
            })}
            {/* Red Flag View/History Modal */}
            {redFlagViewIndex !== null && studentInfo && (() => {
                const activeCount = redFlags.filter(f => !f.removed).length;
                const isTerminated = activeCount >= 3;
                const activeFlags = redFlags.filter(f => !f.removed);
                const removedFlags = redFlags.filter(f => f.removed);
                const viewIdx = redFlagViewIndex;
                const flagsToShow = activeFlags.filter(f => f.flagNumber === viewIdx);
                const removedToShow = removedFlags.filter(f => f.flagNumber === viewIdx);
                const roleLabels = { admin: 'QTV', teacher: 'GV', staff: 'NV' };
                return (
                    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
                        onClick={() => setRedFlagViewIndex(null)}>
                        <div onClick={e => e.stopPropagation()} style={{
                            width: '90%', maxWidth: '520px', borderRadius: '20px', overflow: 'hidden',
                            background: 'var(--bg-primary)', boxShadow: '0 25px 60px rgba(0,0,0,0.3)',
                            animation: 'slideUp 0.3s ease', maxHeight: '80vh', display: 'flex', flexDirection: 'column'
                        }}>
                            {/* Header */}
                            <div style={{
                                background: isTerminated ? 'linear-gradient(135deg, #991b1b 0%, #dc2626 100%)' : 'linear-gradient(135deg, #334155 0%, #475569 100%)',
                                padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0
                            }}>
                                <div>
                                    <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#fff', marginBottom: '4px' }}>
                                        🚩 Cờ đỏ lần {viewIdx}
                                    </div>
                                    <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.85)', fontWeight: 500 }}>
                                        {studentInfo.displayName || studentInfo.email}
                                    </div>
                                </div>
                                <button onClick={() => setRedFlagViewIndex(null)} style={{
                                    background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '10px',
                                    width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    cursor: 'pointer', color: '#fff'
                                }}><X size={18} /></button>
                            </div>

                            {/* Tab navigation */}
                            {activeCount > 1 && (
                                <div style={{ display: 'flex', gap: '0', borderBottom: '1px solid var(--border-color, #e2e8f0)', flexShrink: 0 }}>
                                    {[1, 2, 3].map(i => {
                                        const hasFlag = i <= activeCount;
                                        const isActive = viewIdx === i;
                                        const tabColor = i >= 3 ? '#dc2626' : i === 2 ? '#ea580c' : '#ca8a04';
                                        return (
                                            <button key={i}
                                                onClick={() => hasFlag ? setRedFlagViewIndex(i) : null}
                                                style={{
                                                    flex: 1, padding: '10px 0', border: 'none',
                                                    cursor: hasFlag ? 'pointer' : 'default',
                                                    fontSize: '0.78rem', fontWeight: 700,
                                                    background: isActive ? `${tabColor}08` : 'transparent',
                                                    color: hasFlag ? (isActive ? tabColor : '#64748b') : '#cbd5e1',
                                                    borderBottom: isActive ? `2.5px solid ${tabColor}` : '2.5px solid transparent',
                                                    transition: 'all 0.2s'
                                                }}
                                            >
                                                {hasFlag ? '🚩' : '⚪'} Cờ {i}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}

                            {/* Body */}
                            <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
                                {flagsToShow.length === 0 && removedToShow.length === 0 ? (
                                    <div style={{ textAlign: 'center', padding: '32px', color: '#94a3b8' }}>Cờ này đã được gỡ.</div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                        {/* Active flags */}
                                        {flagsToShow.map((flag) => {
                                            const date = flag.createdAt?.toDate ? flag.createdAt.toDate() : (flag.createdAt ? new Date(flag.createdAt) : null);
                                            const bg = flag.flagNumber >= 3 ? '#fef2f2' : flag.flagNumber === 2 ? '#fff7ed' : '#fefce8';
                                            const color = flag.flagNumber >= 3 ? '#dc2626' : flag.flagNumber === 2 ? '#ea580c' : '#ca8a04';
                                            const border = flag.flagNumber >= 3 ? '#fecaca' : flag.flagNumber === 2 ? '#fed7aa' : '#fde68a';
                                            return (
                                                <div key={flag.id} style={{ padding: '16px 18px', borderRadius: '16px', background: bg, border: `1.5px solid ${border}` }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                                                        <span style={{ fontSize: '0.88rem', fontWeight: 800, color }}>
                                                            🚩 Cờ đỏ lần {flag.flagNumber}
                                                        </span>
                                                        <span style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 500 }}>
                                                            {date ? date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
                                                        </span>
                                                    </div>
                                                    <div style={{ fontSize: '0.92rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
                                                        {flag.violationLabel || flag.violationType}
                                                    </div>
                                                    {flag.note && (
                                                        <div style={{ fontSize: '0.82rem', color: '#64748b', fontStyle: 'italic', paddingLeft: '12px', borderLeft: `3px solid ${border}`, lineHeight: 1.5, marginBottom: '10px' }}>
                                                            {flag.note}
                                                        </div>
                                                    )}
                                                    <div style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 500 }}>
                                                        👤 {roleLabels[flag.flaggedByRole] || 'GV'} {flag.flaggedByName}
                                                    </div>

                                                    {/* Remove button */}
                                                    {removingFlagId === flag.id ? (
                                                        <div style={{ marginTop: '14px' }}>
                                                            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Lý do gỡ cờ</label>
                                                            <textarea
                                                                value={removeReasonText}
                                                                onChange={e => setRemoveReasonText(e.target.value)}
                                                                placeholder="Nhập lý do gỡ cờ đỏ..."
                                                                rows={2}
                                                                style={{
                                                                    width: '100%', padding: '10px 12px',
                                                                    border: '1.5px solid var(--border-color)', borderRadius: '10px',
                                                                    fontSize: '0.82rem', fontWeight: 500,
                                                                    background: 'var(--bg-secondary)', color: 'var(--text-primary)',
                                                                    outline: 'none', resize: 'vertical', fontFamily: 'inherit',
                                                                    marginBottom: '8px', lineHeight: 1.4
                                                                }}
                                                                autoFocus
                                                            />
                                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                                <button onClick={() => { setRemovingFlagId(null); setRemoveReasonText(''); }} style={{
                                                                    flex: 1, padding: '8px', borderRadius: '8px',
                                                                    border: '1px solid var(--border-color)', background: 'var(--bg-secondary)',
                                                                    color: 'var(--text-secondary)', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer'
                                                                }}>Huỷ</button>
                                                                <button
                                                                    disabled={!removeReasonText.trim() || redFlagLoading}
                                                                    onClick={async () => {
                                                                        if (!removeReasonText.trim()) return;
                                                                        setRedFlagLoading(true);
                                                                        try {
                                                                            await removeRedFlag({
                                                                                flagId: flag.id,
                                                                                removedBy: user?.uid,
                                                                                removedByName: user?.displayName || user?.email?.split('@')[0] || '',
                                                                                removedByRole: user?.role || 'teacher',
                                                                                removeReason: removeReasonText.trim()
                                                                            });
                                                                            const updated = await getRedFlagsForStudent(studentId);
                                                                            setRedFlags(updated);
                                                                            setRedFlagViewIndex(null);
                                                                            setRemovingFlagId(null);
                                                                            setRemoveReasonText('');
                                                                            setToast({ type: 'success', text: 'Đã gỡ cờ đỏ!' });
                                                                        } catch (err) {
                                                                            setToast({ type: 'error', text: 'Lỗi: ' + err.message });
                                                                        }
                                                                        setRedFlagLoading(false);
                                                                    }}
                                                                    style={{
                                                                        flex: 2, padding: '8px', borderRadius: '8px',
                                                                        border: 'none',
                                                                        background: !removeReasonText.trim() ? '#e2e8f0' : 'linear-gradient(135deg, #10b981, #059669)',
                                                                        color: !removeReasonText.trim() ? '#94a3b8' : '#fff',
                                                                        fontSize: '0.78rem', fontWeight: 700,
                                                                        cursor: !removeReasonText.trim() ? 'not-allowed' : 'pointer'
                                                                    }}
                                                                >✅ Xác nhận gỡ cờ</button>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div
                                                            onClick={() => { setRemovingFlagId(flag.id); setRemoveReasonText(''); }}
                                                            style={{
                                                                marginTop: '14px', padding: '9px 0', borderRadius: '10px',
                                                                background: 'rgba(16,185,129,0.08)',
                                                                color: '#10b981', fontSize: '0.78rem', fontWeight: 700,
                                                                cursor: 'pointer', textAlign: 'center',
                                                                transition: 'all 0.2s'
                                                            }}
                                                            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(16,185,129,0.16)'; }}
                                                            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(16,185,129,0.08)'; }}
                                                        >
                                                            ✅ Gỡ cờ đỏ này
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}

                                        {/* Removed flags */}
                                        {removedToShow.length > 0 && (
                                            <>
                                                <div style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: '4px' }}>
                                                    Cờ đã gỡ
                                                </div>
                                                {removedToShow.map(flag => {
                                                    const removedDate = flag.removedAt?.toDate ? flag.removedAt.toDate() : (flag.removedAt ? new Date(flag.removedAt) : null);
                                                    return (
                                                        <div key={flag.id} style={{
                                                            padding: '12px 14px', borderRadius: '12px',
                                                            background: 'var(--bg-input, #f1f5f9)', border: '1px solid var(--border-color, #e2e8f0)',
                                                            opacity: 0.6
                                                        }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                                                                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#94a3b8', textDecoration: 'line-through' }}>
                                                                    🚩 {flag.violationLabel || flag.violationType}
                                                                </span>
                                                                <span style={{ fontSize: '0.68rem', color: '#10b981', fontWeight: 600 }}>✅ Đã gỡ</span>
                                                            </div>
                                                            <div style={{ fontSize: '0.7rem', color: '#10b981', fontWeight: 500 }}>
                                                                Gỡ bởi {roleLabels[flag.removedByRole] || ''} {flag.removedByName}
                                                                {removedDate && <span style={{ color: '#94a3b8', marginLeft: '6px' }}>
                                                                    {removedDate.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                                </span>}
                                                            </div>
                                                            {flag.removeReason && (
                                                                <div style={{ fontSize: '0.72rem', color: '#64748b', fontStyle: 'italic', marginTop: '2px' }}>
                                                                    Lý do: {flag.removeReason}
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                );
            })()}
            {/* Red Flag Modal */}
            {showRedFlagModal && studentInfo && (() => {
                const currentCount = redFlags.filter(f => !f.removed).length;
                const nextFlag = currentCount + 1;
                const isThirdFlag = nextFlag >= 3;
                const hasHistory = redFlags.length > 0;
                return (
                <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
                    onClick={() => setShowRedFlagModal(false)}>
                    <style>{`
                        .rfm-body { display: flex; flex-direction: row; flex: 1; overflow: hidden; min-height: 0; }
                        .rfm-form { flex: 1; min-width: 0; overflow-y: auto; }
                        .rfm-history { width: 280px; flex-shrink: 0; border-left: 1px solid var(--border-color, #e2e8f0); overflow-y: auto; }
                        @media (max-width: 700px) {
                            .rfm-body { flex-direction: column; overflow-y: auto; }
                            .rfm-form { overflow-y: visible; }
                            .rfm-history { width: 100%; border-left: none; border-top: 1px solid var(--border-color, #e2e8f0); overflow-y: visible; }
                        }
                    `}</style>
                    <div onClick={e => e.stopPropagation()} style={{
                        width: '90%', maxWidth: hasHistory ? '780px' : '480px', borderRadius: '20px', overflow: 'hidden',
                        background: 'var(--bg-primary)', boxShadow: '0 25px 60px rgba(0,0,0,0.3)',
                        animation: 'slideUp 0.3s ease', maxHeight: '90vh', display: 'flex', flexDirection: 'column'
                    }}>
                        {/* Header */}
                        <div style={{
                            background: isThirdFlag ? 'linear-gradient(135deg, #991b1b 0%, #dc2626 100%)' : 'linear-gradient(135deg, #92400e 0%, #d97706 100%)',
                            padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0
                        }}>
                            <div>
                                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#fff', marginBottom: '4px' }}>
                                    🚩 Đánh cờ đỏ lần {nextFlag}/3
                                </div>
                                <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.85)', fontWeight: 500 }}>
                                    {studentInfo.displayName || studentInfo.email}
                                </div>
                            </div>
                            <button onClick={() => setShowRedFlagModal(false)} style={{
                                background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '10px',
                                width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                cursor: 'pointer', color: '#fff', transition: 'background 0.2s'
                            }}
                                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.3)'}
                                onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
                            ><X size={18} /></button>
                        </div>

                        {/* Body - two columns */}
                        <div className="rfm-body">
                            {/* Left: Form */}
                            <div className="rfm-form" style={{ padding: '20px 24px' }}>
                                {/* Warning Banner */}
                                {isThirdFlag && (
                                    <div style={{
                                        padding: '14px 16px', borderRadius: '14px', marginBottom: '20px',
                                        background: '#fef2f2', border: '1.5px solid #fecaca',
                                        display: 'flex', alignItems: 'flex-start', gap: '10px'
                                    }}>
                                        <AlertTriangle size={20} style={{ color: '#dc2626', flexShrink: 0, marginTop: '1px' }} />
                                        <div>
                                            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#dc2626', marginBottom: '2px' }}>
                                                Cờ đỏ lần 3 — Không còn đảm bảo đầu ra!
                                            </div>
                                            <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                                                Hành động này sẽ chấm dứt hợp đồng đảm bảo chất lượng đầu ra của học viên.
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Progress dots */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px', justifyContent: 'center' }}>
                                    {[1, 2, 3].map(i => (
                                        <div key={i} style={{
                                            width: '40px', height: '40px', borderRadius: '12px',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            fontSize: '0.85rem', fontWeight: 800,
                                            background: i <= currentCount ? (i === 3 ? '#fef2f2' : i === 2 ? '#fff7ed' : '#fefce8') : 'var(--bg-secondary)',
                                            color: i <= currentCount ? (i === 3 ? '#dc2626' : i === 2 ? '#ea580c' : '#ca8a04') : i === nextFlag ? (isThirdFlag ? '#dc2626' : '#d97706') : '#cbd5e1',
                                            border: i === nextFlag ? `2px dashed ${isThirdFlag ? '#fecaca' : '#fed7aa'}` : i <= currentCount ? `1.5px solid ${i === 3 ? '#fecaca' : i === 2 ? '#fed7aa' : '#fde68a'}` : '1.5px solid var(--border-color)',
                                            transition: 'all 0.2s'
                                        }}>
                                            {i <= currentCount ? '🚩' : i}
                                        </div>
                                    ))}
                                </div>

                                {/* Violation Type */}
                                <div style={{ marginBottom: '16px', position: 'relative' }}>
                                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                        Loại vi phạm
                                    </label>
                                    <div
                                        onClick={() => setViolationDropdownOpen(prev => !prev)}
                                        style={{
                                            width: '100%', padding: '12px 16px',
                                            border: `1.5px solid ${violationDropdownOpen ? '#d97706' : 'var(--border-color)'}`, borderRadius: '14px',
                                            fontSize: '0.9rem', fontWeight: 500,
                                            background: 'var(--bg-secondary)', color: redFlagForm.violationType ? 'var(--text-primary)' : '#94a3b8',
                                            cursor: 'pointer', transition: 'border-color 0.2s',
                                            display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxSizing: 'border-box'
                                        }}
                                    >
                                        <span>{redFlagForm.violationType ? VIOLATION_TYPES.find(v => v.value === redFlagForm.violationType)?.label : '— Chọn loại vi phạm —'}</span>
                                        <span style={{ fontSize: '0.7rem', transition: 'transform 0.2s', transform: violationDropdownOpen ? 'rotate(180deg)' : 'rotate(0)' }}>▼</span>
                                    </div>
                                    {violationDropdownOpen && (
                                        <>
                                            <div style={{ position: 'fixed', inset: 0, zIndex: 1 }} onClick={() => setViolationDropdownOpen(false)} />
                                            <div style={{
                                                position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 2,
                                                marginTop: '4px', borderRadius: '14px', overflow: 'hidden',
                                                background: 'var(--bg-primary)', border: '1.5px solid var(--border-color)',
                                                boxShadow: '0 8px 24px rgba(0,0,0,0.12)', maxHeight: '200px', overflowY: 'auto'
                                            }}>
                                                {VIOLATION_TYPES.map(vt => (
                                                    <div
                                                        key={vt.value}
                                                        onClick={() => { setRedFlagForm(prev => ({ ...prev, violationType: vt.value })); setViolationDropdownOpen(false); }}
                                                        style={{
                                                            padding: '11px 16px', fontSize: '0.88rem', fontWeight: 500,
                                                            color: redFlagForm.violationType === vt.value ? '#d97706' : 'var(--text-primary)',
                                                            background: redFlagForm.violationType === vt.value ? '#fffbeb' : 'transparent',
                                                            cursor: 'pointer', transition: 'background 0.15s',
                                                            borderBottom: '1px solid var(--border-color)'
                                                        }}
                                                        onMouseEnter={e => { if (redFlagForm.violationType !== vt.value) e.currentTarget.style.background = 'var(--bg-secondary)'; }}
                                                        onMouseLeave={e => { e.currentTarget.style.background = redFlagForm.violationType === vt.value ? '#fffbeb' : 'transparent'; }}
                                                    >
                                                        {vt.label}
                                                    </div>
                                                ))}
                                            </div>
                                        </>
                                    )}
                                </div>

                                {/* Note */}
                                <div style={{ marginBottom: '20px' }}>
                                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                        Ghi chú lý do
                                    </label>
                                    <textarea
                                        value={redFlagForm.note}
                                        onChange={e => setRedFlagForm(prev => ({ ...prev, note: e.target.value }))}
                                        placeholder="Mô tả chi tiết lý do đánh cờ đỏ..."
                                        rows={3}
                                        style={{
                                            width: '100%', padding: '12px 16px',
                                            border: '1.5px solid var(--border-color)', borderRadius: '14px',
                                            fontSize: '0.9rem', fontWeight: 500,
                                            background: 'var(--bg-secondary)', color: 'var(--text-primary)',
                                            outline: 'none', resize: 'vertical', fontFamily: 'inherit',
                                            transition: 'border-color 0.2s', lineHeight: 1.5
                                        }}
                                        onFocus={e => e.target.style.borderColor = '#d97706'}
                                        onBlur={e => e.target.style.borderColor = 'var(--border-color)'}
                                    />
                                </div>

                                {/* Actions */}
                                <div style={{ display: 'flex', gap: '10px' }}>
                                    <button onClick={() => setShowRedFlagModal(false)} style={{
                                        flex: 1, padding: '12px', borderRadius: '14px',
                                        border: '1.5px solid var(--border-color)', background: 'var(--bg-secondary)',
                                        color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 700,
                                        cursor: 'pointer', transition: 'all 0.2s'
                                    }}>Huỷ bỏ</button>
                                    <button
                                        disabled={!redFlagForm.violationType || !redFlagForm.note.trim() || redFlagLoading}
                                        style={{
                                            flex: 2, padding: '12px', borderRadius: '14px',
                                            border: 'none',
                                            background: (!redFlagForm.violationType || !redFlagForm.note.trim()) ? '#e2e8f0' : isThirdFlag ? 'linear-gradient(135deg, #991b1b 0%, #dc2626 100%)' : 'linear-gradient(135deg, #92400e 0%, #d97706 100%)',
                                            color: (!redFlagForm.violationType || !redFlagForm.note.trim()) ? '#94a3b8' : '#fff',
                                            fontSize: '0.9rem', fontWeight: 800,
                                            cursor: (!redFlagForm.violationType || !redFlagForm.note.trim() || redFlagLoading) ? 'not-allowed' : 'pointer',
                                            transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
                                        }}
                                        onClick={async () => {
                                            setRedFlagLoading(true);
                                            try {
                                                const vt = VIOLATION_TYPES.find(v => v.value === redFlagForm.violationType);
                                                const activeCount = redFlags.filter(f => !f.removed).length;
                                                await addRedFlag({
                                                    studentId,
                                                    studentName: studentInfo.displayName || studentInfo.email,
                                                    studentEmail: studentInfo.email,
                                                    groupId: assignment?.groupId || assignment?.targetId || '',
                                                    groupName: assignment?.groupName || '',
                                                    violationType: redFlagForm.violationType,
                                                    violationLabel: vt?.label || redFlagForm.violationType,
                                                    note: redFlagForm.note.trim(),
                                                    flaggedBy: user?.uid,
                                                    flaggedByName: user?.displayName || user?.email?.split('@')[0] || '',
                                                    flaggedByRole: user?.role || 'teacher',
                                                    flagNumber: activeCount + 1
                                                });
                                                const updated = await getRedFlagsForStudent(studentId);
                                                setRedFlags(updated);
                                                setShowRedFlagModal(false);
                                                setToast({ type: 'success', text: 'Đã đánh cờ đỏ!' });
                                            } catch (err) {
                                                console.error(err);
                                                setToast({ type: 'error', text: 'Lỗi: ' + err.message });
                                            }
                                            setRedFlagLoading(false);
                                        }}
                                    >
                                        {redFlagLoading ? 'Đang xử lý...' : (isThirdFlag ? '🔴 Xác nhận — Mất đảm bảo đầu ra' : '🚩 Xác nhận đánh cờ đỏ')}
                                    </button>
                                </div>
                            </div>

                            {/* Right: History */}
                            {hasHistory && (
                                <div className="rfm-history" style={{ padding: '20px 16px' }}>
                                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px' }}>Lịch sử cờ đỏ</div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                        {[...redFlags].sort((a, b) => { const ta = a.createdAt?.toDate ? a.createdAt.toDate() : (a.createdAt ? new Date(a.createdAt) : new Date(0)); const tb = b.createdAt?.toDate ? b.createdAt.toDate() : (b.createdAt ? new Date(b.createdAt) : new Date(0)); return tb - ta; }).map(f => {
                                            const d = f.createdAt?.toDate ? f.createdAt.toDate() : (f.createdAt ? new Date(f.createdAt) : null);
                                            const flagColor = f.flagNumber >= 3 ? '#dc2626' : f.flagNumber === 2 ? '#ea580c' : '#ca8a04';
                                            return (
                                                <div key={f.id} style={{
                                                    padding: '10px 12px', borderRadius: '10px',
                                                    background: f.removed ? 'var(--bg-input, #f1f5f9)' : (f.flagNumber >= 3 ? '#fef2f2' : f.flagNumber === 2 ? '#fff7ed' : '#fefce8'),
                                                    border: `1px solid ${f.removed ? 'var(--border-color, #e2e8f0)' : (f.flagNumber >= 3 ? '#fecaca' : f.flagNumber === 2 ? '#fed7aa' : '#fde68a')}`,
                                                    opacity: f.removed ? 0.6 : 1
                                                }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4px' }}>
                                                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: f.removed ? '#94a3b8' : flagColor, textDecoration: f.removed ? 'line-through' : 'none' }}>
                                                            🚩 Cờ {f.flagNumber}: {f.violationLabel || f.violationType}
                                                        </span>
                                                        {f.removed && <span style={{ fontSize: '0.6rem', color: '#10b981', fontWeight: 600, flexShrink: 0 }}>✅ Đã gỡ</span>}
                                                    </div>
                                                    {f.note && (
                                                        <div style={{ fontSize: '0.72rem', color: '#64748b', fontStyle: 'italic', marginTop: '4px', lineHeight: 1.4 }}>
                                                            {f.note}
                                                        </div>
                                                    )}
                                                    <div style={{ fontSize: '0.65rem', color: '#94a3b8', marginTop: '4px' }}>
                                                        {d ? d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
                                                        {' · '}{f.removed ? `Gỡ bởi ${f.removedByName || ''}` : `Bởi ${f.flaggedByName || ''}`}
                                                    </div>
                                                    {f.removed && f.removeReason && (
                                                        <div style={{ fontSize: '0.68rem', color: '#10b981', marginTop: '4px', fontStyle: 'italic' }}>
                                                            Lý do gỡ: {f.removeReason}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
                );
            })()}

        </div>
    );
}
