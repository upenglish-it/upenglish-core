import { useState, useEffect, useRef } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { getExam, getExamQuestions, getExamSubmission, saveExamSubmission, saveAllFollowUpAnswers, gradeFollowUpAnswer, uploadAudioAnswer } from '../services/examService';
import { saveAudioToCache, removeAudioFromCache } from '../services/audioOfflineService';
import { useAuth } from '../contexts/AuthContext';
import { Home, RefreshCw, Check, X, Send } from 'lucide-react';
import { OptionContent, isImageOption } from '../components/common/MCQImageOption';
import './TakeExamPage.css';
import { normalizeForComparison } from '../utils/textNormalization';

const hasContent = (html) => {
    if (!html) return false;
    const stripped = html.replace(/<[^>]*>/g, '').trim();
    if (stripped.length > 0) return true;
    return /<(img|iframe|video|audio|embed|object)/i.test(html);
};

const decodeHtmlEntities = (str) => {
    if (!str) return '';
    const textarea = document.createElement('textarea');
    textarea.innerHTML = str;
    return textarea.value
        .replace(/<[^>]*>/g, '')
        .replace(/\u00a0/g, ' ');
};

const renderFeedbackHtml = (text) => {
    if (!text) return '';
    // Escape HTML first for safety
    let safe = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    // Convert markdown to HTML: **bold**, *italic*
    safe = safe.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
    safe = safe.replace(/\*(.+?)\*/g, '<i>$1</i>');
    // Convert newlines to <br> for rendering
    safe = safe.replace(/\n/g, '<br>');
    return safe;
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

export default function ExamResultPage() {
    const [searchParams] = useSearchParams();
    const { user } = useAuth();
    const navigate = useNavigate();

    const assignmentId = searchParams.get('assignmentId');
    const studentId = searchParams.get('studentId') || user?.uid;

    const [submission, setSubmission] = useState(null);
    const [exam, setExam] = useState(null);
    const [questions, setQuestions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [followUpInputs, setFollowUpInputs] = useState({});
    const [submittingFollowUp, setSubmittingFollowUp] = useState(null);
    const [followUpToast, setFollowUpToast] = useState(null);
    const [fuRecordingQId, setFuRecordingQId] = useState(null);
    const fuRecordersRef = useRef({});
    const fuAudioChunksRef = useRef({});
    const fuAudioBlobsRef = useRef({});

    // Auto-save follow-up inputs to localStorage
    const fuAutoSaveKey = assignmentId && studentId ? `fu_inputs_${assignmentId}_${studentId}` : null;
    const fuInputsInitialized = useRef(false);

    // Save follow-up inputs whenever they change (skip initial empty state)
    useEffect(() => {
        if (!fuAutoSaveKey || !fuInputsInitialized.current) return;
        try {
            // Don't save audio preview URLs (they're ephemeral object URLs)
            const toSave = {};
            for (const [k, v] of Object.entries(followUpInputs)) {
                if (typeof v === 'object' && v !== null && !Array.isArray(v) && v.hasRecording) {
                    toSave[k] = { hasRecording: true }; // Don't save previewUrl/blob
                } else {
                    toSave[k] = v;
                }
            }
            localStorage.setItem(fuAutoSaveKey, JSON.stringify(toSave));
        } catch (e) { /* quota exceeded — ignore */ }
    }, [followUpInputs, fuAutoSaveKey]);

    // Back button → go to home page instead of back to exam
    useEffect(() => {
        window.history.replaceState(null, '', window.location.href);
        const handlePopState = () => {
            navigate('/', { replace: true });
        };
        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, [navigate]);

    useEffect(() => { loadData(); }, [assignmentId, studentId]);

    async function loadData() {
        setLoading(true);
        try {
            const sub = await getExamSubmission(assignmentId, studentId);
            if (sub) {
                setSubmission(sub);
                const [examData, questionsData] = await Promise.all([
                    getExam(sub.examId),
                    getExamQuestions(sub.examId)
                ]);
                setExam(examData);
                // Filter out orphan questions not belonging to any active section
                const sectionIds = new Set((examData?.sections || []).map(s => s.id));
                setQuestions(questionsData.filter(q => q.sectionId && sectionIds.has(q.sectionId)));

                // Restore saved follow-up inputs from localStorage
                if (fuAutoSaveKey) {
                    try {
                        const saved = localStorage.getItem(fuAutoSaveKey);
                        if (saved) {
                            const parsed = JSON.parse(saved);
                            if (parsed && typeof parsed === 'object') {
                                setFollowUpInputs(parsed);
                            }
                        }
                    } catch (e) { /* corrupted data — ignore */ }
                    fuInputsInitialized.current = true;
                }

                // Mark as viewed if student is viewing their own result
                if (studentId === user?.uid && sub.status === 'graded' && !sub.viewedByStudent) {
                    saveExamSubmission({ id: sub.id, viewedByStudent: true }).catch(console.error);
                }
                // Mark follow-up results as viewed
                if (studentId === user?.uid && sub.followUpResultsReleased && !sub.followUpResultsViewedByStudent) {
                    saveExamSubmission({ id: sub.id, followUpResultsViewedByStudent: true }).catch(console.error);
                }
            }
        } catch (error) {
            console.error(error);
        }
        setLoading(false);
    }

    if (loading) return (
        <div className="exam-loading"><div className="exam-loading-spinner"></div><p>Đang tải kết quả...</p></div>
    );
    if (!submission) return (
        <div className="exam-loading"><p>Không tìm thấy bài làm.</p><Link to="/" className="exam-btn exam-btn-primary" style={{ marginTop: '16px' }}><Home size={16} /> Về trang chủ</Link></div>
    );

    const isGraded = submission.status === 'graded' && submission.resultsReleased;
    const isGrading = submission.status === 'submitted' || submission.status === 'grading' || (submission.status === 'graded' && !submission.resultsReleased);

    // Calculate total possible score from all questions (perItem × itemCount)
    const totalPossibleScore = questions.reduce((sum, q) => {
        const p = q.points || 1;
        const v = q.variations?.[0];
        if (!v) return sum + p;
        if (['fill_in_blank','fill_in_blanks','fill_in_blank_typing'].includes(q.type)) return sum + p * ((v.text||'').match(/\{\{.+?\}\}/g)?.length||1);
        if (q.type === 'matching') return sum + p * ((v.pairs||[]).length||1);
        if (q.type === 'categorization') return sum + p * ((v.items||'').length||1);
        return sum + p;
    }, 0);
    const displayMaxScore = submission.maxTotalScore || totalPossibleScore || 0;

    // Calculate percentage based on total possible score
    const percent = displayMaxScore ? Math.round((submission.totalScore / displayMaxScore) * 100) : 0;
    const grade = percent >= 90 ? 'Xuất sắc' : percent >= 80 ? 'Giỏi' : percent >= 65 ? 'Khá' : percent >= 50 ? 'Trung bình' : 'Cần cố gắng thêm';
    const gradeColor = percent >= 90 ? '#ef4444' : percent >= 80 ? '#f97316' : percent >= 65 ? '#eab308' : percent >= 50 ? '#3b82f6' : 'var(--text-muted)';
    const gradeIcon = percent >= 90 ? '🔥' : percent >= 80 ? '🎉' : percent >= 65 ? '🌟' : percent >= 50 ? '👍' : '💪';

    const renderVisualAnswer = (q, variation, answerData, result, hideCorrectAnswers = false) => {
        const answer = answerData?.answer;
        if (!answer) return <span style={{ color: 'var(--color-error, #ef4444)', fontStyle: 'italic' }}>Em đã không hoàn thành câu hỏi này</span>;

        if (q.type === 'audio_recording') {
            if (typeof answer === 'object' && answer?.hasRecording) {
                return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px 16px', background: 'var(--bg-input, #f8fafc)', borderRadius: '10px', border: '1px solid var(--border-color, #e2e8f0)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontSize: '1.1rem' }}>🎤</span>
                            <span style={{ fontWeight: 600, color: '#10b981', fontSize: '0.85rem' }}>Đã ghi âm</span>
                        </div>
                        {answer.audioUrl && (
                            <audio controls src={answer.audioUrl} style={{ width: '100%', maxWidth: '400px', borderRadius: '8px' }} />
                        )}
                        {answer.transcript && (
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)', background: 'var(--bg-input)', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>📝 Transcript: </span>
                                {answer.transcript}
                            </div>
                        )}
                    </div>
                );
            }
            return <span style={{ color: 'var(--color-error, #ef4444)', fontStyle: 'italic' }}>Chưa thu âm</span>;
        }

        if (q.type === 'multiple_choice') {
            const correctAnswerText = variation?.options?.[variation?.correctAnswer];
            return (
                <div className="exam-result-mc">
                    {(variation?.options || []).map((opt, i) => {
                        if (!opt) return null;
                        const isSelected = opt === answer;
                        const isCorrectOpt = opt === correctAnswerText;
                        let borderColor = 'var(--border-color)';
                        let bgColor = 'var(--bg-input)';
                        let textColor = 'var(--text-secondary)';
                        let opacity = 1;

                        if (isSelected) {
                            if (hideCorrectAnswers) {
                                // Only show that it was selected, without revealing if correct
                                borderColor = '#94a3b8';
                                bgColor = '#f1f5f9';
                                textColor = '#475569';
                            } else {
                                borderColor = isCorrectOpt ? '#10b981' : '#ef4444';
                                bgColor = isCorrectOpt ? '#d1fae5' : '#fee2e2';
                                textColor = isCorrectOpt ? '#065f46' : '#991b1b';
                            }
                        } else if (isCorrectOpt && !hideCorrectAnswers) {
                            borderColor = '#10b981';
                            bgColor = '#ecfdf5';
                            textColor = '#059669';
                            opacity = 0.7;
                        }

                        return (
                            <div key={i} className="exam-result-mc-opt" style={{
                                border: isSelected ? `2px solid ${borderColor}` : `1px solid ${borderColor}`,
                                background: bgColor, color: textColor,
                                fontWeight: isSelected ? 800 : 500,
                                opacity
                            }}>
                                <span className="exam-result-mc-opt-letter">{String.fromCharCode(65 + i)}.</span>
                                <span className="exam-result-mc-opt-text"><OptionContent opt={opt} size={80} /></span>
                                {isSelected && !hideCorrectAnswers && (
                                    <div className="exam-result-mc-opt-icon">
                                        {isCorrectOpt ? <Check size={14} strokeWidth={3} /> : <X size={14} strokeWidth={3} />}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            );
        }

        if (q.type === 'matching') {
            const pairs = variation?.pairs || [];
            const matched = Array.isArray(answer) ? answer : [];
            return (
                <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {pairs.map((pair, pIdx) => {
                        const studentMatch = matched[pIdx]?.text;
                        const isCorrectMatch = studentMatch === pair.right;
                        return (
                            <div key={pIdx} className="exam-result-match-row">
                                <div className="exam-result-match-left">{pair.left}</div>
                                <span className="exam-result-match-arrow">→</span>
                                <div className={`exam-result-match-right ${hideCorrectAnswers ? '' : (isCorrectMatch ? 'correct' : 'incorrect')}`}
                                    style={hideCorrectAnswers ? { border: '1.5px solid #94a3b8', background: '#f1f5f9', color: '#475569' } : undefined}>
                                    {studentMatch || '—'}
                                </div>
                                {!isCorrectMatch && !hideCorrectAnswers && (
                                    <div className="exam-result-match-correct-answer">
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
            const studentCats = typeof answer === 'object' ? answer : {};
            return (
                <div className="exam-result-cat-container">
                    {groups.map((group, gIdx) => {
                        const assignedItems = Object.entries(studentCats).filter(([_, g]) => g === group).map(([t]) => t);
                        return (
                            <div key={gIdx} className="exam-result-cat-group">
                                <div className="exam-result-cat-group-title">{group}</div>
                                <div className="exam-result-cat-items">
                                    {assignedItems.length > 0 ? assignedItems.map(item => (
                                        <div key={item} className="exam-result-cat-item">{item}</div>
                                    )) : <div className="exam-result-cat-empty">Trống</div>}
                                </div>
                            </div>
                        );
                    })}
                </div>
            );
        }

        if (q.type === 'ordering') {
            const correctItems = variation?.items || [];
            const studentOrder = Array.isArray(answer) ? answer : [];
            return (
                <div className="exam-result-ordering-list">
                    {studentOrder.map((item, idx) => {
                        const isCorrectPos = item === correctItems[idx];
                        return (
                            <div key={idx} className={`exam-result-ordering-item ${hideCorrectAnswers ? '' : (isCorrectPos ? 'correct' : 'incorrect')}`}
                                style={hideCorrectAnswers ? { border: '1.5px solid #94a3b8', background: '#f1f5f9', color: '#475569' } : undefined}>
                                <span className="exam-result-ordering-num" style={hideCorrectAnswers ? { background: '#94a3b8' } : undefined}>{idx + 1}</span>
                                <span>{item}</span>
                                {!hideCorrectAnswers && (isCorrectPos ? <Check size={14} strokeWidth={3} style={{ marginLeft: 'auto' }} /> : (
                                    <span className="exam-result-ordering-correct-hint">Đúng: {correctItems[idx]}</span>
                                ))}
                            </div>
                        );
                    })}
                </div>
            );
        }

        if (q.type === 'fill_in_blank' || q.type === 'fill_in_blanks' || q.type === 'fill_in_blank_typing') {
            const rawText = variation?.text || '';
            const hasMarkers = /\{\{.+?\}\}/.test(rawText);

            if (hasMarkers && typeof answer === 'object' && answer !== null) {
                // New format: show sentence with filled blanks
                const parts = rawText.split(/(\{\{.+?\}\})/g);
                const correctWords = [];
                const regex = /\{\{(.+?)\}\}/g;
                let mm;
                while ((mm = regex.exec(rawText)) !== null) { correctWords.push(mm[1].replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ')); }

                let blankIdx = 0;
                return (
                    <div className="exam-result-fill-sentence">
                        {parts.map((part, i) => {
                            const match = part.match(/^\{\{(.+?)\}\}$/);
                            if (match) {
                                const idx = blankIdx++;
                                const studentWord = answer[String(idx)] || '';
                                const correctWord = correctWords[idx];
                                const isWordCorrect = normalizeForComparison(studentWord) === normalizeForComparison(correctWord);
                                const isAIAccepted = !isWordCorrect && result?.aiVerdicts?.[idx] === true;
                                return (
                                    <span key={i}>
                                        <span className={`exam-result-fill-blank ${hideCorrectAnswers ? '' : (isWordCorrect ? 'correct' : isAIAccepted ? 'correct' : 'incorrect')}`}
                                            style={hideCorrectAnswers ? { background: '#f1f5f9', borderColor: '#94a3b8', color: '#475569' } : (isAIAccepted ? { background: '#fef3c7', borderColor: '#f59e0b', color: '#92400e' } : undefined)}
                                        >
                                            {studentWord || '—'}
                                        </span>
                                        {!hideCorrectAnswers && !isWordCorrect && !isAIAccepted && (
                                            <span className="exam-result-fill-correct-hint">({correctWord})</span>
                                        )}
                                        {!hideCorrectAnswers && isAIAccepted && (
                                            <span style={{ fontSize: '0.7rem', color: '#d97706', fontWeight: 600, marginLeft: '4px' }}>✓ AI ({correctWord})</span>
                                        )}
                                    </span>
                                );
                            }
                            return <span key={i}>{part}</span>;
                        })}
                    </div>
                );
            }

            // Legacy: just show the string
            return <span style={{ color: 'var(--text-primary)', fontWeight: 500, display: 'block', padding: '12px 16px', background: 'var(--bg-input, #f8fafc)', borderRadius: '10px', border: '1px solid var(--border-color, #e2e8f0)' }}>{String(answer)}</span>;
        }

        return <div style={{ color: 'var(--text-primary)', fontWeight: 500, whiteSpace: 'pre-wrap', padding: '12px 16px', background: 'var(--bg-input, #f8fafc)', borderRadius: '10px', border: '1px solid var(--border-color, #e2e8f0)' }}>{String(answer)}</div>;
    };

    return (
        <div className="exam-result-page">
            {isGrading && (
                <div className="exam-result-summary-card" style={{ textAlign: 'center' }}>
                    <div className="exam-result-icon" style={{ animation: 'pulse 2s ease-in-out infinite' }}>⏳</div>
                    <h1 className="exam-result-title">Bài đang được giáo viên chấm</h1>
                    <p className="exam-result-subtitle" style={{ marginBottom: '16px' }}>
                        Giáo viên đang chấm bài của bạn. Kết quả sẽ sớm được công bố, quay lại sau nhé!
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'center', marginTop: '8px' }}>
                        <button className="exam-btn exam-btn-primary" onClick={() => navigate(`/take-exam?assignmentId=${assignmentId}`)}
                            style={{ minWidth: '180px', justifyContent: 'center' }}>
                            <RefreshCw size={16} /> Kiểm tra lại
                        </button>
                        <Link to="/" className="exam-btn exam-btn-secondary"
                            style={{ display: 'inline-flex', minWidth: '180px', justifyContent: 'center' }}>
                            <Home size={16} /> Về trang chủ
                        </Link>
                    </div>
                </div>
            )}

            {isGraded && (
                <>
                    {/* Unified result card: header + score + summary */}
                    <div className="exam-result-summary-card">
                        {/* Top: title */}
                        <div className="exam-result-summary-top">
                            <h1 className="exam-result-title">Kết quả {exam?.examType === 'test' ? 'bài kiểm tra' : 'bài tập'}</h1>
                            <p className="exam-result-subtitle">{exam?.name || (exam?.examType === 'test' ? 'Bài kiểm tra' : 'Bài tập')}</p>
                        </div>

                        {/* Score */}
                        <div className="exam-result-score-area">
                            <div className="exam-result-score">
                                {Math.round((submission.totalScore ?? 0) * 10) / 10}
                                <span className="exam-result-max">/{displayMaxScore}</span>
                            </div>
                            <div className="exam-result-percent" style={{ background: `${gradeColor}15`, color: gradeColor }}>
                                {percent}% — {grade}
                            </div>
                        </div>

                        {/* AI Summary */}
                        {submission.examSummary && (
                            <>
                                <div className="exam-result-summary-divider" />
                                <div className="exam-result-summary-header">
                                    <span style={{ fontSize: '1.1rem' }}>📝</span>
                                    <span className="exam-result-summary-title">Nhận xét tổng kết</span>
                                </div>
                                <div className="exam-result-summary-body"
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
                            </>
                        )}
                    </div>

                    {/* Follow-up banner */}
                    {(() => {
                        const followUpRequested = submission.followUpRequested || {};
                        const followUpAnswers = submission.followUpAnswers || {};
                        const requestedIds = Object.keys(followUpRequested);
                        const pendingCount = requestedIds.filter(qId => {
                            const answered = Object.values(followUpAnswers).some(sec => sec?.[qId]);
                            return !answered;
                        }).length;
                        if (requestedIds.length === 0) return null;
                        const followUpResultsReleased = submission?.followUpResultsReleased;
                        return (
                            <div style={{
                                padding: '16px', borderRadius: '16px', marginBottom: '24px',
                                maxWidth: '1000px', marginLeft: 'auto', marginRight: 'auto',
                                background: pendingCount > 0 ? 'linear-gradient(135deg, #fef3c7, #fde68a)' : followUpResultsReleased ? 'linear-gradient(135deg, #ede9fe, #ddd6fe)' : 'linear-gradient(135deg, #ecfdf5, #d1fae5)',
                                border: pendingCount > 0 ? '2px solid #f59e0b' : followUpResultsReleased ? '2px solid #8b5cf6' : '2px solid #10b981',
                                textAlign: 'center', boxSizing: 'border-box'
                            }}>
                                <div style={{ fontSize: '1.3rem', marginBottom: '4px' }}>{pendingCount > 0 ? '✍️' : followUpResultsReleased ? '📝' : '✅'}</div>
                                <div style={{ fontWeight: 800, color: pendingCount > 0 ? '#92400e' : followUpResultsReleased ? '#5b21b6' : '#065f46', fontSize: '0.95rem' }}>
                                    {pendingCount > 0
                                        ? `Giáo viên yêu cầu bạn sửa lại để hoàn thiện ${pendingCount} câu bên dưới`
                                        : followUpResultsReleased
                                            ? 'Giáo viên đã trả kết quả bài sửa! Xem nhận xét bên dưới.'
                                            : 'Đã nộp hết bài sửa! Chờ giáo viên chấm nhé.'
                                    }
                                </div>
                                {pendingCount > 0 && (
                                    <div style={{ fontSize: '0.82rem', color: '#92400e', marginTop: '4px', opacity: 0.8 }}>
                                        Hãy xem lại nhận xét và sửa lại câu trả lời cho tốt hơn.
                                    </div>
                                )}
                                <div style={{ fontSize: '0.72rem', color: pendingCount > 0 ? '#92400e' : followUpResultsReleased ? '#6d28d9' : '#065f46', marginTop: '6px', opacity: 0.6, fontStyle: 'italic' }}>
                                    Lưu ý: Điểm bài sửa chỉ mang tính tham khảo, không thay đổi điểm bài kiểm tra gốc.
                                </div>
                            </div>
                        );
                    })()}

                    {/* Detail by section */}
                    {(exam?.sections || []).map((section, sIdx) => {
                        const sectionQuestions = questions.filter(q => q.sectionId === section.id).sort((a, b) => (a.order || 0) - (b.order || 0));
                        if (sectionQuestions.length === 0) return null;

                        return (
                            <div key={section.id} className="exam-result-section">
                                <h3 className="exam-result-section-title">
                                    {section.title || `Section ${sIdx + 1}`}
                                </h3>
                                {hasContent(section.context) && (
                                    <div className="exam-result-context">
                                        <div className="ql-editor" dangerouslySetInnerHTML={{ __html: parseContextHtml(section.context) }} />
                                    </div>
                                )}
                                {section.contextAudioUrl && (
                                    <div style={{ marginBottom: '16px', padding: '12px 16px', background: 'var(--bg-input)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>🎵 Audio ngữ cảnh</span>
                                        </div>
                                        <audio controls src={section.contextAudioUrl} style={{ width: '100%', height: '40px' }} controlsList="nodownload" preload="metadata" />
                                    </div>
                                )}
                                {sectionQuestions.map((q, qIdx) => {
                                    const result = submission.results?.[q.id];
                                    const varIdx = submission.variationMap?.[q.id] || 0;
                                    let variation = q.variations?.[varIdx];
                                    // Fallback: if selected variation is empty, find first valid one
                                    if (!variation || (!variation.options && !variation.pairs && !variation.items && (!variation.text || variation.text.replace(/<[^>]*>/g, '').trim().length === 0))) {
                                        variation = q.variations?.find(v => v && (Array.isArray(v.options) && v.options.some(o => o) || v.text?.replace(/<[^>]*>/g, '').trim().length > 0)) || q.variations?.[0];
                                    }
                                    const sectionAnswers = submission.answers?.[section.id] || {};
                                    const answer = sectionAnswers[q.id];
                                    const effectiveScore = result?.teacherOverride?.score ?? result?.score;
                                    const maxPossibleScore = result?.maxScore ?? q.points ?? 1;
                                    const isCorrect = effectiveScore >= maxPossibleScore;
                                    const isPartial = effectiveScore > 0 && effectiveScore < maxPossibleScore;

                                    // Follow-up status for visual emphasis
                                    const fuRequested = !!(submission.followUpRequested || {})[q.id];
                                    const fuAnswered = !!Object.values(submission.followUpAnswers || {}).find(sec => sec?.[q.id])?.[q.id];
                                    const needsFollowUp = fuRequested && !fuAnswered;
                                    const followUpDone = fuRequested && fuAnswered;
                                    const hasAnyFollowUp = Object.keys(submission.followUpRequested || {}).length > 0;

                                    return (
                                        <div key={q.id} className={`exam-result-question-item ${needsFollowUp ? 'follow-up-pending' : followUpDone ? 'follow-up-done' : ''} ${hasAnyFollowUp && !fuRequested ? 'follow-up-dimmed' : ''}`} style={{
                                            border: needsFollowUp
                                                ? '2px solid #f59e0b'
                                                : followUpDone
                                                    ? '2px solid #8b5cf6'
                                                    : `1px solid ${isCorrect ? '#a7f3d0' : isPartial ? '#fde68a' : '#fecaca'}`,
                                            ...(needsFollowUp ? {
                                                background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)',
                                                boxShadow: '0 0 0 3px rgba(245, 158, 11, 0.15), 0 4px 12px rgba(245, 158, 11, 0.1)',
                                                position: 'relative'
                                            } : {}),
                                            ...(hasAnyFollowUp && !fuRequested ? { opacity: 0.55 } : {})
                                        }}>
                                            <div className="exam-result-question-header">
                                                <div className="exam-result-question-info">
                                                    <div className="exam-result-question-icon" style={{
                                                        background: isCorrect ? '#ecfdf5' : isPartial ? '#fffbeb' : '#fef2f2',
                                                        color: isCorrect ? '#10b981' : isPartial ? '#f59e0b' : '#ef4444'
                                                    }}>
                                                        {isCorrect ? <Check size={14} /> : isPartial ? <span style={{ fontSize: '0.8rem', fontWeight: 900 }}>!</span> : <X size={14} />}
                                                    </div>
                                                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>Câu {qIdx + 1}</span>
                                                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{QUESTION_TYPE_LABELS[q.type] || q.type}</span>
                                                </div>
                                                <div className="exam-result-score-badge" style={{
                                                    background: isCorrect ? '#ecfdf5' : isPartial ? '#fffbeb' : '#fef2f2',
                                                    color: isCorrect ? '#10b981' : isPartial ? '#f59e0b' : '#ef4444'
                                                }}>
                                                    {effectiveScore ?? 0}/{maxPossibleScore}
                                                </div>
                                            </div>
                                            {needsFollowUp && (
                                                <div style={{
                                                    display: 'flex', alignItems: 'center', gap: '6px',
                                                    padding: '6px 12px', borderRadius: '8px', marginBottom: '8px',
                                                    background: 'linear-gradient(135deg, #fbbf24, #f59e0b)',
                                                    color: '#fff', fontWeight: 800, fontSize: '0.75rem',
                                                    textTransform: 'uppercase', letterSpacing: '0.5px',
                                                    animation: 'followUpPulse 2s ease-in-out infinite'
                                                }}>
                                                    ✍️ Cần sửa bài
                                                </div>
                                            )}
                                            <div className="exam-result-question-text"
                                                dangerouslySetInnerHTML={{ __html: (variation?.text || '(Câu hỏi)').replace(/&nbsp;/g, ' ').replace(/\{\{.+?\}\}/g, '<span style="display:inline-block;min-width:60px;border-bottom:2px solid currentColor;margin:0 4px;text-align:center;">______</span>') }}>
                                            </div>

                                            <div className={needsFollowUp ? '' : 'exam-result-answer-box'}>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    {needsFollowUp ? 'Câu trả lời cũ của bạn:' : 'Câu trả lời của bạn:'}
                                                    {needsFollowUp && !['essay', 'short_answer', 'audio_recording'].includes(q.type) && (() => {
                                                        const isRight = result?.isCorrect || effectiveScore >= maxPossibleScore;
                                                        const isPartial = !isRight && effectiveScore > 0;
                                                        return (
                                                            <span style={{
                                                                fontSize: '0.65rem', fontWeight: 800, color: '#fff',
                                                                background: isRight ? '#10b981' : isPartial ? '#f59e0b' : '#ef4444',
                                                                padding: '1px 8px', borderRadius: '4px', textTransform: 'none', letterSpacing: 0
                                                            }}>
                                                                {isRight ? '✓ Đúng' : isPartial ? `${effectiveScore}/${maxPossibleScore}` : '✗ Sai'}
                                                            </span>
                                                        );
                                                    })()}
                                                </div>
                                                {renderVisualAnswer(q, variation, answer, result, needsFollowUp)}
                                            </div>

                                            {(() => {
                                                const isAIGraded = ['essay', 'short_answer', 'audio_recording'].includes(q.type);
                                                const showFeedback = !needsFollowUp || isAIGraded;
                                                return (
                                                    <>
                                                        {showFeedback && result?.feedback ? (
                                                            <div style={{ fontSize: '0.85rem', color: 'var(--color-info, #1e40af)', background: 'var(--bg-input)', padding: '10px 14px', borderRadius: '12px', marginTop: '12px', border: '1px solid var(--border-color)' }}>
                                                                <strong>Nhận xét:</strong>
                                                                <div dangerouslySetInnerHTML={{ __html: renderFeedbackHtml(result.feedback) }} style={{ marginTop: '4px' }} />
                                                            </div>
                                                        ) : showFeedback && (q.type === 'audio_recording' && effectiveScore === 0 && answer?.answer?.hasRecording) ? (
                                                            <div style={{ fontSize: '0.85rem', color: '#92400e', background: '#fffbeb', padding: '10px 14px', borderRadius: '12px', marginTop: '12px' }}>
                                                                ⏳ Câu trả lời chưa được AI chấm điểm. Giáo viên sẽ chấm thủ công.
                                                            </div>
                                                        ) : null}
                                                        {showFeedback && result?.teacherOverride?.note && (
                                                            <div style={{ fontSize: '0.85rem', color: '#7c3aed', background: '#f5f3ff', padding: '10px 14px', borderRadius: '12px', marginTop: '8px', whiteSpace: 'pre-wrap' }}>
                                                                <strong>{result.teacherOverride.overriddenByName || 'Giáo viên'}:</strong> {result.teacherOverride.note}
                                                            </div>
                                                        )}
                                                    </>
                                                );
                                            })()}

                                            {/* ── FOLLOW-UP SECTION for student ── */}
                                            {(() => {
                                                const followUpRequested = submission.followUpRequested || {};
                                                const followUpAnswers = submission.followUpAnswers || {};
                                                const followUpResults = submission.followUpResults || {};
                                                const isRequested = !!followUpRequested[q.id];
                                                const fuAnswer = Object.values(followUpAnswers).find(sec => sec?.[q.id])?.[q.id];
                                                const fuResult = followUpResults[q.id];
                                                const followUpReleased = submission.followUpResultsReleased;

                                                if (!isRequested && !fuAnswer) return null;

                                                return (
                                                    <div style={{
                                                        marginTop: '12px', padding: '14px', borderRadius: '14px',
                                                        background: 'linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%)',
                                                        border: '1.5px solid #c4b5fd'
                                                    }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
                                                            <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#7c3aed' }}>✍️ Sửa bài</span>
                                                            {fuAnswer && <span style={{ fontSize: '0.65rem', color: '#10b981', fontWeight: 700, background: '#ecfdf5', padding: '2px 8px', borderRadius: '6px' }}>Đã nộp</span>}

                                                        </div>

                                                        {/* Already submitted follow-up answer */}
                                                        {fuAnswer ? (
                                                            <>
                                                                <div style={{ padding: '10px 14px', background: '#fff', borderRadius: '10px', border: '1px solid #e2e8f0', marginBottom: '8px', fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                                                                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '4px' }}>Câu trả lời sửa của bạn:</div>
                                                                    {(() => {
                                                                        const ans = fuAnswer.answer;
                                                                        if (typeof ans === 'string') return <span style={{ whiteSpace: 'pre-wrap' }}>{ans}</span>;
                                                                        // Matching: array of strings or objects
                                                                        if (q.type === 'matching' && Array.isArray(ans)) {
                                                                            const pairs = variation?.pairs || [];
                                                                            return <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>{pairs.map((p, i) => (
                                                                                <div key={i} style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                                                                    <span style={{ fontWeight: 700, fontSize: '0.8rem' }}>{p.left}</span>
                                                                                    <span style={{ color: '#94a3b8' }}>→</span>
                                                                                    <span style={{ fontWeight: 600, color: '#7c3aed', fontSize: '0.8rem' }}>{(typeof ans[i] === 'object' ? ans[i]?.text : ans[i]) || '—'}</span>
                                                                                </div>
                                                                            ))}</div>;
                                                                        }
                                                                        // Ordering: array of items
                                                                        if (q.type === 'ordering' && Array.isArray(ans)) {
                                                                            return <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>{ans.map((item, i) => (
                                                                                <div key={i} style={{ display: 'flex', gap: '6px', alignItems: 'center', fontSize: '0.8rem' }}>
                                                                                    <span style={{ fontWeight: 800, color: '#7c3aed', minWidth: '18px' }}>{i + 1}.</span>
                                                                                    <span style={{ fontWeight: 600 }}>{item}</span>
                                                                                </div>
                                                                            ))}</div>;
                                                                        }
                                                                        // Categorization: { item: group }
                                                                        if (q.type === 'categorization' && typeof ans === 'object') {
                                                                            const groups = variation?.groups || [];
                                                                            return <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>{groups.map(g => {
                                                                                const items = Object.entries(ans).filter(([_, v]) => v === g).map(([k]) => k);
                                                                                return <div key={g} style={{ padding: '6px 10px', borderRadius: '8px', background: '#f5f3ff', border: '1px solid #c4b5fd' }}>
                                                                                    <span style={{ fontWeight: 700, fontSize: '0.75rem', color: '#7c3aed' }}>{g}: </span>
                                                                                    <span style={{ fontSize: '0.8rem' }}>{items.join(', ') || '—'}</span>
                                                                                </div>;
                                                                            })}</div>;
                                                                        }
                                                                        // Fill-in-blank: { "0": "word", "1": "word" }
                                                                        if (typeof ans === 'object' && !Array.isArray(ans)) {
                                                                            return <span style={{ whiteSpace: 'pre-wrap' }}>{Object.values(ans).join(', ')}</span>;
                                                                        }
                                                                        return <span>{JSON.stringify(ans)}</span>;
                                                                    })()}
                                                                </div>

                                                                {/* Show grading results if released */}
                                                                {fuResult && followUpReleased && (
                                                                    <div style={{ marginTop: '8px' }}>
                                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
                                                                            <span style={{
                                                                                fontWeight: 700, fontSize: '0.85rem',
                                                                                color: (fuResult.teacherOverride?.score ?? fuResult.score) >= fuResult.maxScore ? '#10b981' : '#ef4444'
                                                                            }}>
                                                                                Điểm sửa: {fuResult.teacherOverride?.score ?? fuResult.score}/{fuResult.maxScore}
                                                                            </span>
                                                                            <span style={{ fontSize: '0.7rem', color: '#94a3b8', fontStyle: 'italic' }}>
                                                                                (không ảnh hưởng điểm gốc)
                                                                            </span>
                                                                        </div>
                                                                        {fuResult.feedback && (
                                                                            <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)', background: '#fafaf9', padding: '10px 14px', borderRadius: '12px', border: '1px solid #e7e5e4' }}>
                                                                                <strong style={{ color: '#7c3aed' }}>Nhận xét bài sửa:</strong>
                                                                                <div dangerouslySetInnerHTML={{ __html: renderFeedbackHtml(fuResult.feedback) }} style={{ marginTop: '4px', lineHeight: 1.6 }} />
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                )}
                                                                {fuResult && !followUpReleased && (
                                                                    <div style={{ fontSize: '0.82rem', color: '#94a3b8', fontStyle: 'italic', marginTop: '4px' }}>
                                                                        Đang chờ giáo viên chấm bài sửa...
                                                                    </div>
                                                                )}
                                                            </>
                                                        ) : (
                                                            /* Input area for follow-up answer — type-specific */
                                                            <div>
                                                                {/* Essay / Short Answer — textarea */}
                                                                {(q.type === 'essay' || q.type === 'short_answer' || !q.type) && (
                                                                    <textarea
                                                                        value={followUpInputs[q.id] || ''}
                                                                        onChange={e => {
                                                                            setFollowUpInputs({ ...followUpInputs, [q.id]: e.target.value });
                                                                            e.target.style.height = 'auto';
                                                                            e.target.style.height = e.target.scrollHeight + 'px';
                                                                        }}
                                                                        placeholder="Viết lại câu trả lời tốt hơn..."
                                                                        style={{
                                                                            width: '100%', minHeight: '80px', padding: '10px 14px',
                                                                            borderRadius: '10px', border: '1.5px solid #c4b5fd',
                                                                            background: '#fff', fontSize: '0.88rem', resize: 'none',
                                                                            outline: 'none', fontFamily: 'inherit', color: 'var(--text-primary)',
                                                                            boxSizing: 'border-box', overflow: 'hidden'
                                                                        }}
                                                                        onFocus={e => e.target.style.borderColor = '#8b5cf6'}
                                                                        onBlur={e => e.target.style.borderColor = '#c4b5fd'}
                                                                    />
                                                                )}

                                                                {/* Multiple Choice — same as TakeExamPage */}
                                                                {q.type === 'multiple_choice' && (
                                                                    <div className="exam-options">
                                                                        {(variation?.options || []).map((opt, oIdx) => {
                                                                            if (!opt) return null;
                                                                            return (
                                                                                <button key={oIdx}
                                                                                    className={`exam-option ${followUpInputs[q.id] === opt ? 'selected' : ''}`}
                                                                                    style={isImageOption(opt) ? { padding: '8px', justifyContent: 'center' } : {}}
                                                                                    onClick={() => setFollowUpInputs({ ...followUpInputs, [q.id]: opt })}>
                                                                                    <span className="exam-option-letter">{String.fromCharCode(65 + oIdx)}</span>
                                                                                    <span>{isImageOption(opt) ? <OptionContent opt={opt} /> : opt}</span>
                                                                                </button>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                )}

                                                                {/* Fill in blank typing — same as TakeExamPage */}
                                                                {q.type === 'fill_in_blank_typing' && (() => {
                                                                    const rawText = variation?.text || '';
                                                                    const hasMarkers = /\{\{.+?\}\}/.test(rawText);
                                                                    if (!hasMarkers) {
                                                                        return (
                                                                            <input type="text" className="exam-input"
                                                                                placeholder="Nhập câu trả lời..."
                                                                                value={followUpInputs[q.id] || ''}
                                                                                autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false}
                                                                                onChange={e => setFollowUpInputs({ ...followUpInputs, [q.id]: e.target.value })} />
                                                                        );
                                                                    }
                                                                    const blankRegex = /\{\{(.+?)\}\}/g;
                                                                    const correctAnswers = [];
                                                                    let m;
                                                                    while ((m = blankRegex.exec(rawText)) !== null) {
                                                                        correctAnswers.push(decodeHtmlEntities(m[1]));
                                                                    }
                                                                    const normalizedText = rawText
                                                                        .replace(/<p><br><\/p>/gi, '\n').replace(/<\/p>/gi, '\n')
                                                                        .replace(/<\/div>/gi, '\n').replace(/<br\s*\/?>/gi, '\n')
                                                                        .replace(/<p[^>]*>/gi, '').replace(/<div[^>]*>/gi, '');
                                                                    const segments = normalizedText.split(/(\{\{.+?\}\})/g);
                                                                    const filledAnswers = (typeof followUpInputs[q.id] === 'object' && followUpInputs[q.id] !== null) ? followUpInputs[q.id] : {};
                                                                    let slotCounter = 0;
                                                                    return (
                                                                        <div className="exam-fill-blank-modern">
                                                                            <div className="exam-fill-sentence" style={{ lineHeight: 2.2, wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>
                                                                                {segments.map((seg, sIdx) => {
                                                                                    const blankMatch = seg.match(/^\{\{(.+?)\}\}$/);
                                                                                    if (blankMatch) {
                                                                                        const idx = slotCounter++;
                                                                                        const filled = filledAnswers[String(idx)] || '';
                                                                                        return (
                                                                                            <span key={sIdx} style={{ display: 'inline-block', verticalAlign: 'middle', margin: '2px 4px', maxWidth: '100%' }}>
                                                                                                <input type="text" value={filled} placeholder={`(${idx + 1})`}
                                                                                                    autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false}
                                                                                                    onChange={e => {
                                                                                                        const newAns = { ...filledAnswers, [String(idx)]: e.target.value };
                                                                                                        setFollowUpInputs({ ...followUpInputs, [q.id]: newAns });
                                                                                                    }}
                                                                                                    style={{
                                                                                                        display: 'inline-block', boxSizing: 'border-box',
                                                                                                        minWidth: '60px', maxWidth: '100%',
                                                                                                        width: `${Math.max(6, Math.ceil(filled.length * 0.8) + 1)}ch`,
                                                                                                        padding: '6px 8px', fontSize: '1rem', fontWeight: 600,
                                                                                                        borderRadius: '8px', border: '2px solid #e2e8f0',
                                                                                                        background: '#fff', color: '#1e293b', outline: 'none',
                                                                                                        textAlign: 'left', fontFamily: 'inherit', transition: 'all 0.2s ease'
                                                                                                    }}
                                                                                                    onFocus={e => { e.target.style.borderColor = '#6366f1'; }}
                                                                                                    onBlur={e => { e.target.style.borderColor = '#e2e8f0'; }}
                                                                                                />
                                                                                            </span>
                                                                                        );
                                                                                    }
                                                                                    const trimSeg = seg.trim();
                                                                                    return trimSeg ? <span key={sIdx} dangerouslySetInnerHTML={{ __html: trimSeg }} /> : null;
                                                                                })}
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                })()}

                                                                {/* Fill in blank — word bank — same as TakeExamPage */}
                                                                {(q.type === 'fill_in_blank' || q.type === 'fill_in_blanks') && (() => {
                                                                    const rawText = variation?.text || '';
                                                                    const hasMarkers = /\{\{.+?\}\}/.test(rawText);
                                                                    if (!hasMarkers) {
                                                                        return (
                                                                            <input type="text" className="exam-input" placeholder="Nhập câu trả lời..."
                                                                                value={followUpInputs[q.id] || ''}
                                                                                onChange={e => setFollowUpInputs({ ...followUpInputs, [q.id]: e.target.value })} />
                                                                        );
                                                                    }
                                                                    const blankRegex = /\{\{(.+?)\}\}/g;
                                                                    const correctAnswers = [];
                                                                    let m;
                                                                    while ((m = blankRegex.exec(rawText)) !== null) {
                                                                        correctAnswers.push(decodeHtmlEntities(m[1]));
                                                                    }
                                                                    const distractors = (variation?.distractors || []).map(d => decodeHtmlEntities(d));
                                                                    const allWords = [...correctAnswers, ...distractors];
                                                                    const shuffledPool = allWords.sort((a, b) => {
                                                                        const ha = (a + q.id).split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
                                                                        const hb = (b + q.id).split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
                                                                        return ha - hb;
                                                                    });
                                                                    const filledAnswers = (typeof followUpInputs[q.id] === 'object' && followUpInputs[q.id] !== null) ? followUpInputs[q.id] : {};
                                                                    const usedWords = Object.values(filledAnswers).filter(Boolean);
                                                                    const poolAvailable = [];
                                                                    const usedTracker = {};
                                                                    usedWords.forEach(w => { usedTracker[w] = (usedTracker[w] || 0) + 1; });
                                                                    const wordCounts = {};
                                                                    shuffledPool.forEach(w => { wordCounts[w] = (wordCounts[w] || 0) + 1; });
                                                                    const addedToPool = {};
                                                                    shuffledPool.forEach(w => {
                                                                        const available = (wordCounts[w] || 0) - (usedTracker[w] || 0);
                                                                        const already = addedToPool[w] || 0;
                                                                        if (already < available) { poolAvailable.push(w); addedToPool[w] = already + 1; }
                                                                    });
                                                                    const handleDragStart = (e, word, source, sourceIdx) => {
                                                                        e.dataTransfer.setData('text', word);
                                                                        e.dataTransfer.setData('source', source);
                                                                        e.dataTransfer.setData('sourceIdx', sourceIdx ?? '');
                                                                    };
                                                                    const handleDropOnSlot = (e, slotIdx) => {
                                                                        e.preventDefault();
                                                                        const word = e.dataTransfer.getData('text');
                                                                        const source = e.dataTransfer.getData('source');
                                                                        const sourceIdx = e.dataTransfer.getData('sourceIdx');
                                                                        const newAnswer = { ...filledAnswers };
                                                                        if (source === 'slot' && sourceIdx !== '') delete newAnswer[sourceIdx];
                                                                        newAnswer[String(slotIdx)] = word;
                                                                        setFollowUpInputs({ ...followUpInputs, [q.id]: newAnswer });
                                                                    };
                                                                    const handleDropOnPool = (e) => {
                                                                        e.preventDefault();
                                                                        const source = e.dataTransfer.getData('source');
                                                                        const sourceIdx = e.dataTransfer.getData('sourceIdx');
                                                                        if (source === 'slot' && sourceIdx !== '') {
                                                                            const newAnswer = { ...filledAnswers };
                                                                            delete newAnswer[sourceIdx];
                                                                            setFollowUpInputs({ ...followUpInputs, [q.id]: newAnswer });
                                                                        }
                                                                    };
                                                                    const handleDragOver = (e) => e.preventDefault();
                                                                    const normalizedText = rawText
                                                                        .replace(/<p><br><\/p>/gi, '\n').replace(/<\/p>/gi, '\n')
                                                                        .replace(/<\/div>/gi, '\n').replace(/<br\s*\/?>/gi, '\n')
                                                                        .replace(/<p[^>]*>/gi, '').replace(/<div[^>]*>/gi, '');
                                                                    const segments = normalizedText.split(/(\{\{.+?\}\})/g);
                                                                    let slotCounter = 0;
                                                                    return (
                                                                        <div className="exam-fill-blank-modern">
                                                                            <div className="exam-fill-sentence" style={{ lineHeight: 2.2, wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>
                                                                                {segments.map((seg, sIdx) => {
                                                                                    const blankMatch = seg.match(/^\{\{(.+?)\}\}$/);
                                                                                    if (blankMatch) {
                                                                                        const idx = slotCounter++;
                                                                                        const filledWord = filledAnswers[String(idx)];
                                                                                        return (
                                                                                            <span key={sIdx}
                                                                                                className={`exam-fill-slot ${filledWord ? 'filled' : 'empty'}`}
                                                                                                style={{ display: 'inline-flex', whiteSpace: 'nowrap', verticalAlign: 'middle' }}
                                                                                                onDrop={e => handleDropOnSlot(e, idx)}
                                                                                                onDragOver={handleDragOver}>
                                                                                                {filledWord ? (
                                                                                                    <span draggable className="exam-fill-chip in-slot"
                                                                                                        onDragStart={e => handleDragStart(e, filledWord, 'slot', idx)}
                                                                                                        onClick={() => {
                                                                                                            const newAnswer = { ...filledAnswers };
                                                                                                            delete newAnswer[String(idx)];
                                                                                                            setFollowUpInputs({ ...followUpInputs, [q.id]: newAnswer });
                                                                                                        }}
                                                                                                        style={{ cursor: 'pointer' }}>
                                                                                                        {filledWord}
                                                                                                    </span>
                                                                                                ) : (
                                                                                                    <span className="exam-fill-slot-placeholder">({idx + 1})</span>
                                                                                                )}
                                                                                            </span>
                                                                                        );
                                                                                    }
                                                                                    const trimSeg = seg.trim();
                                                                                    return trimSeg ? <span key={sIdx} dangerouslySetInnerHTML={{ __html: trimSeg }} /> : null;
                                                                                })}
                                                                            </div>
                                                                            <div className="exam-fill-bank-container" onDrop={handleDropOnPool} onDragOver={handleDragOver}>
                                                                                <div className="exam-fill-bank-title">Word Bank</div>
                                                                                <div className="exam-fill-bank">
                                                                                    {poolAvailable.length === 0 ? (
                                                                                        <div className="exam-fill-bank-empty">Đã sử dụng hết các từ</div>
                                                                                    ) : (
                                                                                        poolAvailable.map((w, i) => (
                                                                                            <span key={i} draggable className="exam-fill-chip"
                                                                                                onDragStart={e => handleDragStart(e, w, 'pool', null)}
                                                                                                style={{ cursor: 'pointer' }}
                                                                                                onClick={() => {
                                                                                                    const newAnswer = { ...filledAnswers };
                                                                                                    for (let bi = 0; bi < correctAnswers.length; bi++) {
                                                                                                        if (!newAnswer[String(bi)]) {
                                                                                                            newAnswer[String(bi)] = w;
                                                                                                            break;
                                                                                                        }
                                                                                                    }
                                                                                                    setFollowUpInputs({ ...followUpInputs, [q.id]: newAnswer });
                                                                                                }}>
                                                                                                {w}
                                                                                            </span>
                                                                                        ))
                                                                                    )}
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                })()}

                                                                {/* Matching — drag-to-reorder — same as TakeExamPage */}
                                                                {q.type === 'matching' && (() => {
                                                                    const pairs = variation?.pairs || [];
                                                                    const allRights = pairs.map(p => p.right || '');
                                                                    let currentSlots = Array.isArray(followUpInputs[q.id]) && followUpInputs[q.id].length === pairs.length
                                                                        ? followUpInputs[q.id] : null;
                                                                    if (!currentSlots) {
                                                                        const shuffled = [...allRights].sort((a, b) => {
                                                                            const ha = (a + q.id + 'fu-salt').split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
                                                                            const hb = (b + q.id + 'fu-salt').split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
                                                                            return ha - hb;
                                                                        });
                                                                        currentSlots = shuffled.map(t => ({ text: t }));
                                                                        setTimeout(() => setFollowUpInputs(prev => ({ ...prev, [q.id]: currentSlots })), 0);
                                                                    }
                                                                    const handleDragStart = (e, pIdx) => {
                                                                        e.dataTransfer.setData('fromIdx', String(pIdx));
                                                                        e.dataTransfer.effectAllowed = 'move';
                                                                        e.target.style.opacity = '0.4';
                                                                        window._fuDragFrom = pIdx;
                                                                        window._fuDragQId = q.id;
                                                                    };
                                                                    const handleDragEnd = (e) => {
                                                                        e.target.style.opacity = '1';
                                                                        window._fuDragFrom = null;
                                                                    };
                                                                    const handleDragOver = (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; };
                                                                    const handleDrop = (e, toIdx) => {
                                                                        e.preventDefault();
                                                                        const fromIdx = parseInt(e.dataTransfer.getData('fromIdx'));
                                                                        if (isNaN(fromIdx) || fromIdx === toIdx) return;
                                                                        const newAnswer = [...currentSlots];
                                                                        const [moved] = newAnswer.splice(fromIdx, 1);
                                                                        newAnswer.splice(toIdx, 0, moved);
                                                                        setFollowUpInputs({ ...followUpInputs, [q.id]: newAnswer });
                                                                    };
                                                                    return (
                                                                        <div className="exam-matching-swap" data-match-q={`fu-${q.id}`}>
                                                                            <div className="exam-match-swap-instruction">
                                                                                Kéo thả đáp án bên phải để sắp xếp lại
                                                                            </div>
                                                                            <div className="exam-match-swap-pairs">
                                                                                {pairs.map((pair, pIdx) => {
                                                                                    const slotValue = currentSlots[pIdx]?.text || '';
                                                                                    return (
                                                                                        <div key={pIdx} className="exam-match-swap-row"
                                                                                            onDragOver={handleDragOver}
                                                                                            onDrop={e => handleDrop(e, pIdx)}>
                                                                                            <div className="exam-match-swap-num">{pIdx + 1}</div>
                                                                                            <div className="exam-match-swap-left">{pair.left}</div>
                                                                                            <div className="exam-match-swap-divider">—</div>
                                                                                            <div className="exam-match-swap-right"
                                                                                                draggable
                                                                                                onDragStart={e => handleDragStart(e, pIdx)}
                                                                                                onDragEnd={handleDragEnd}>
                                                                                                <span className="exam-match-swap-grip">⠿</span>
                                                                                                <span className="exam-match-swap-value">{slotValue}</span>
                                                                                            </div>
                                                                                        </div>
                                                                                    );
                                                                                })}
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                })()}

                                                                {/* Categorization — drag-and-drop — same as TakeExamPage */}
                                                                {q.type === 'categorization' && (() => {
                                                                    const items = variation?.items || [];
                                                                    const groups = variation?.groups || [];
                                                                    const currentAnswer = (typeof followUpInputs[q.id] === 'object' && followUpInputs[q.id] !== null && !Array.isArray(followUpInputs[q.id]))
                                                                        ? followUpInputs[q.id] : {};
                                                                    const uncategorizedItems = items.filter(item => !currentAnswer[item.text || item]);
                                                                    const handleDragStart = (e, itemText) => {
                                                                        e.dataTransfer.setData('itemText', itemText);
                                                                    };
                                                                    const handleDropOnGroup = (e, groupName) => {
                                                                        e.preventDefault();
                                                                        const itemText = e.dataTransfer.getData('itemText');
                                                                        const newAnswer = { ...currentAnswer, [itemText]: groupName };
                                                                        setFollowUpInputs({ ...followUpInputs, [q.id]: newAnswer });
                                                                    };
                                                                    const handleDropOnPool = (e) => {
                                                                        e.preventDefault();
                                                                        const itemText = e.dataTransfer.getData('itemText');
                                                                        const newAnswer = { ...currentAnswer };
                                                                        delete newAnswer[itemText];
                                                                        setFollowUpInputs({ ...followUpInputs, [q.id]: newAnswer });
                                                                    };
                                                                    const handleDragOver = (e) => e.preventDefault();
                                                                    return (
                                                                        <div className="exam-cat-dnd">
                                                                            <div className="exam-cat-pool" onDrop={handleDropOnPool} onDragOver={handleDragOver}>
                                                                                <div className="exam-cat-pool-title">Mục cần phân loại</div>
                                                                                <div className="exam-cat-pool-items">
                                                                                    {uncategorizedItems.length === 0 && <div className="exam-cat-pool-empty">Đã phân loại hết các mục</div>}
                                                                                    {uncategorizedItems.map((item, iIdx) => {
                                                                                        const text = item.text || item;
                                                                                        return (
                                                                                            <div key={iIdx} draggable className="exam-cat-chip"
                                                                                                onDragStart={e => handleDragStart(e, text)}>
                                                                                                {text}
                                                                                            </div>
                                                                                        );
                                                                                    })}
                                                                                </div>
                                                                            </div>
                                                                            <div className="exam-cat-groups">
                                                                                {groups.map((group, gIdx) => {
                                                                                    const assignedItems = Object.entries(currentAnswer).filter(([_, g]) => g === group);
                                                                                    return (
                                                                                        <div key={gIdx}
                                                                                            className={`exam-cat-group ${assignedItems.length > 0 ? 'active' : ''}`}
                                                                                            onDrop={e => handleDropOnGroup(e, group)}
                                                                                            onDragOver={handleDragOver}>
                                                                                            <div className="exam-cat-group-title">{group}</div>
                                                                                            <div className="exam-cat-group-items">
                                                                                                {assignedItems.map(([text, _]) => (
                                                                                                    <div key={text} draggable className="exam-cat-chip assigned"
                                                                                                        onDragStart={e => handleDragStart(e, text)}>
                                                                                                        {text}
                                                                                                    </div>
                                                                                                ))}
                                                                                                {assignedItems.length === 0 &&
                                                                                                    <div className="exam-cat-group-placeholder">Kéo vào đây</div>
                                                                                                }
                                                                                            </div>
                                                                                        </div>
                                                                                    );
                                                                                })}
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                })()}

                                                                {/* Ordering — drag-to-reorder — same as TakeExamPage */}
                                                                {q.type === 'ordering' && (() => {
                                                                    const correctItems = variation?.items || [];
                                                                    let currentOrder = Array.isArray(followUpInputs[q.id]) ? followUpInputs[q.id] : [];
                                                                    // Compute pool items (not yet placed in answer)
                                                                    const poolItems = correctItems.filter(item => !currentOrder.includes(item));
                                                                    // If nothing initialized yet and pool is full, shuffle pool for initial display
                                                                    if (currentOrder.length === 0 && !followUpInputs.hasOwnProperty(q.id)) {
                                                                        setTimeout(() => setFollowUpInputs(prev => ({ ...prev, [q.id]: [] })), 0);
                                                                    }

                                                                    const handleSelectItem = (item) => {
                                                                        setFollowUpInputs(prev => ({ ...prev, [q.id]: [...(prev[q.id] || []), item] }));
                                                                    };
                                                                    const handleRemoveItem = (idx) => {
                                                                        const newOrder = [...currentOrder];
                                                                        newOrder.splice(idx, 1);
                                                                        setFollowUpInputs(prev => ({ ...prev, [q.id]: newOrder }));
                                                                    };
                                                                    const handleDragStart = (e, item, source, idx) => {
                                                                        e.dataTransfer.setData('item', item);
                                                                        e.dataTransfer.setData('source', source);
                                                                        if (idx !== null) e.dataTransfer.setData('sourceIdx', String(idx));
                                                                        e.dataTransfer.effectAllowed = 'move';
                                                                    };
                                                                    const handleDropOnSlot = (e, toIdx) => {
                                                                        e.preventDefault();
                                                                        const item = e.dataTransfer.getData('item');
                                                                        const source = e.dataTransfer.getData('source');
                                                                        if (source === 'pool') {
                                                                            const newOrder = [...currentOrder];
                                                                            newOrder.splice(toIdx, 0, item);
                                                                            setFollowUpInputs(prev => ({ ...prev, [q.id]: newOrder }));
                                                                        } else {
                                                                            const sourceIdx = parseInt(e.dataTransfer.getData('sourceIdx'));
                                                                            if (!isNaN(sourceIdx) && sourceIdx !== toIdx) {
                                                                                const newOrder = [...currentOrder];
                                                                                const [moved] = newOrder.splice(sourceIdx, 1);
                                                                                newOrder.splice(toIdx, 0, moved);
                                                                                setFollowUpInputs(prev => ({ ...prev, [q.id]: newOrder }));
                                                                            }
                                                                        }
                                                                    };
                                                                    const handleDropOnPool = (e) => {
                                                                        e.preventDefault();
                                                                        const source = e.dataTransfer.getData('source');
                                                                        if (source === 'answer') {
                                                                            const sourceIdx = parseInt(e.dataTransfer.getData('sourceIdx'));
                                                                            if (!isNaN(sourceIdx)) {
                                                                                const newOrder = currentOrder.filter((_, i) => i !== sourceIdx);
                                                                                setFollowUpInputs(prev => ({ ...prev, [q.id]: newOrder }));
                                                                            }
                                                                        }
                                                                    };
                                                                    const handleDragOver = (e) => e.preventDefault();

                                                                    return (
                                                                        <div className="exam-ordering-container">
                                                                            <div className="exam-ordering-answer-zone">
                                                                                <div className="exam-ordering-answer-title">Thứ tự của bạn:</div>
                                                                                <div className="exam-ordering-answer-list">
                                                                                    {currentOrder.length === 0 && (
                                                                                        <div className="exam-ordering-placeholder"
                                                                                            onDrop={e => handleDropOnSlot(e, 0)}
                                                                                            onDragOver={handleDragOver}>
                                                                                            Nhấn vào các thẻ bên dưới theo đúng thứ tự
                                                                                        </div>
                                                                                    )}
                                                                                    {currentOrder.map((item, idx) => (
                                                                                        <div key={`ans-${idx}`}
                                                                                            className="exam-ordering-chip answer"
                                                                                            draggable
                                                                                            onDragStart={e => handleDragStart(e, item, 'answer', idx)}
                                                                                            onDrop={e => handleDropOnSlot(e, idx)}
                                                                                            onDragOver={handleDragOver}
                                                                                            onClick={() => handleRemoveItem(idx)}
                                                                                            style={{ cursor: 'pointer' }}>
                                                                                            <span className="exam-ordering-chip-number">{idx + 1}</span>
                                                                                            <span>{item}</span>
                                                                                        </div>
                                                                                    ))}
                                                                                </div>
                                                                            </div>
                                                                            <div className="exam-ordering-pool"
                                                                                onDrop={handleDropOnPool}
                                                                                onDragOver={handleDragOver}>
                                                                                <div className="exam-ordering-pool-title">Các mục cần sắp xếp</div>
                                                                                <div className="exam-ordering-pool-items">
                                                                                    {poolItems.length === 0 && currentOrder.length > 0 && (
                                                                                        <div className="exam-ordering-pool-empty">Đã sắp xếp hết các mục</div>
                                                                                    )}
                                                                                    {poolItems.map((item, idx) => (
                                                                                        <div key={`pool-${idx}`}
                                                                                            className="exam-ordering-chip pool"
                                                                                            draggable
                                                                                            onDragStart={e => handleDragStart(e, item, 'pool', null)}
                                                                                            onClick={() => handleSelectItem(item)}
                                                                                            style={{ cursor: 'pointer' }}>
                                                                                            {item}
                                                                                        </div>
                                                                                    ))}
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                })()}

                                                                {/* Audio recording — re-record */}
                                                                {q.type === 'audio_recording' && (() => {
                                                                    const isRecording = fuRecordingQId === q.id;
                                                                    const hasRecorded = !!followUpInputs[q.id]?.hasRecording;
                                                                    const previewUrl = followUpInputs[q.id]?.previewUrl;
                                                                    return (
                                                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', padding: '8px 0' }}>
                                                                            <button
                                                                                type="button"
                                                                                onClick={async () => {
                                                                                    if (isRecording) {
                                                                                        fuRecordersRef.current[q.id]?.stop();
                                                                                        setFuRecordingQId(null);
                                                                                    } else {
                                                                                        try {
                                                                                            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                                                                                            const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm'
                                                                                                : MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4' : 'audio/aac';
                                                                                            const recorder = new MediaRecorder(stream, { mimeType });
                                                                                            fuAudioChunksRef.current[q.id] = [];
                                                                                            recorder.ondataavailable = (e) => {
                                                                                                if (e.data.size > 0) {
                                                                                                    if (!fuAudioChunksRef.current[q.id]) fuAudioChunksRef.current[q.id] = [];
                                                                                                    fuAudioChunksRef.current[q.id].push(e.data);
                                                                                                }
                                                                                            };
                                                                                            recorder.onstop = () => {
                                                                                                const blob = new Blob(fuAudioChunksRef.current[q.id] || [], { type: mimeType });
                                                                                                fuAudioBlobsRef.current[q.id] = blob;
                                                                                                stream.getTracks().forEach(t => t.stop());
                                                                                                const url = URL.createObjectURL(blob);
                                                                                                setFollowUpInputs(prev => ({ ...prev, [q.id]: { hasRecording: true, previewUrl: url } }));
                                                                                                // Cache to IndexedDB for offline safety
                                                                                                if (submission?.id) {
                                                                                                    const fuKey = `fu_${q.id}`;
                                                                                                    saveAudioToCache(submission.id, fuKey, blob, mimeType).catch(() => {});
                                                                                                    // Background upload to Firebase Storage
                                                                                                    (async () => {
                                                                                                        try {
                                                                                                            const audioUrl = await uploadAudioAnswer(blob, submission.id, q.id);
                                                                                                            if (audioUrl) {
                                                                                                                setFollowUpInputs(prev => ({ ...prev, [q.id]: { hasRecording: true, previewUrl: url, audioUrl } }));
                                                                                                                removeAudioFromCache(submission.id, fuKey).catch(() => {});
                                                                                                            }
                                                                                                        } catch (err) {
                                                                                                            console.warn('[FollowUp] Background audio upload failed (cached in IndexedDB):', err);
                                                                                                        }
                                                                                                    })();
                                                                                                }
                                                                                            };
                                                                                            fuRecordersRef.current[q.id] = recorder;
                                                                                            recorder.start();
                                                                                            setFuRecordingQId(q.id);
                                                                                        } catch (err) {
                                                                                            alert('Không thể truy cập microphone: ' + err.message);
                                                                                        }
                                                                                    }
                                                                                }}
                                                                                className={`exam-btn ${isRecording ? 'exam-btn-danger' : 'exam-btn-primary'}`}
                                                                                style={{
                                                                                    minWidth: '200px', justifyContent: 'center',
                                                                                    animation: isRecording ? 'pulse 1.5s ease-in-out infinite' : 'none'
                                                                                }}
                                                                            >
                                                                                {isRecording ? '⏹ Dừng thu âm' : hasRecorded ? '🎤 Thu âm lại' : '🎤 Bắt đầu thu âm'}
                                                                            </button>
                                                                            {hasRecorded && previewUrl && (
                                                                                <div style={{ width: '100%', maxWidth: '400px' }}>
                                                                                    <div style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 700, marginBottom: '4px', textAlign: 'center' }}>✓ Đã thu âm xong</div>
                                                                                    <audio controls src={previewUrl} style={{ width: '100%', borderRadius: '8px' }} />
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    );
                                                                })()}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                    );
                                })}
                            </div>
                        );
                    })}

                    {/* Global follow-up submit button */}
                    {(() => {
                        const followUpRequested = submission.followUpRequested || {};
                        const followUpAnswers = submission.followUpAnswers || {};
                        const pendingIds = Object.keys(followUpRequested).filter(qId => {
                            return !Object.values(followUpAnswers).some(sec => sec?.[qId]);
                        });
                        if (pendingIds.length === 0) return null;
                        // Type-aware "is filled" check
                        const isFollowUpFilled = (qId) => {
                            const val = followUpInputs[qId];
                            const q = questions.find(qq => qq.id === qId);
                            if (!q || val === undefined || val === null) return false;
                            if (typeof val === 'string') return val.trim().length > 0;
                            if (Array.isArray(val)) {
                                // matching: all should be non-empty; ordering: all items placed from pool
                                if (q.type === 'matching') return val.every(v => v && v !== '');
                                if (q.type === 'ordering') {
                                    const totalItems = (q.variations?.[submission.variationMap?.[q.id] || 0]?.items || []).length;
                                    return val.length === totalItems;
                                }
                                return val.length > 0;
                            }
                            if (typeof val === 'object') {
                                // audio_recording: check hasRecording flag
                                if (q.type === 'audio_recording') return !!val.hasRecording;
                                // fill_in_blank: all slots filled; categorization: all items assigned
                                if (q.type === 'categorization') {
                                    const items = q.variations?.[submission.variationMap?.[q.id] || 0]?.items || [];
                                    return items.every(item => val[item]);
                                }
                                return Object.keys(val).length > 0 && Object.values(val).some(v => v);
                            }
                            return false;
                        };
                        const allFilled = pendingIds.every(qId => isFollowUpFilled(qId));
                        return (
                            <div style={{ textAlign: 'center', marginTop: '24px', marginBottom: '8px' }}>
                                <button
                                    onClick={async () => {
                                        setSubmittingFollowUp('all');
                                        try {
                                            const answersToSave = [];
                                            for (const qId of pendingIds) {
                                                if (!isFollowUpFilled(qId)) continue;
                                                const q = questions.find(qq => qq.id === qId);
                                                if (!q) continue;
                                                let val = followUpInputs[qId];
                                                // For audio: use pre-uploaded URL from background upload, or re-upload now
                                                if (q.type === 'audio_recording' && val?.hasRecording) {
                                                    if (val.audioUrl) {
                                                        // Background upload already succeeded
                                                        val = { hasRecording: true, audioUrl: val.audioUrl };
                                                    } else if (fuAudioBlobsRef.current[qId]) {
                                                        try {
                                                            const audioUrl = await uploadAudioAnswer(fuAudioBlobsRef.current[qId], submission.id, qId);
                                                            val = { hasRecording: true, audioUrl: audioUrl || '' };
                                                            // Clear IndexedDB cache on success
                                                            removeAudioFromCache(submission.id, `fu_${qId}`).catch(() => {});
                                                        } catch (uploadErr) {
                                                            console.error('Audio upload failed:', uploadErr);
                                                            val = { hasRecording: true, audioUrl: '' };
                                                        }
                                                    }
                                                }
                                                answersToSave.push({ sectionId: q.sectionId, questionId: qId, answer: typeof val === 'string' ? val.trim() : val, question: q });
                                            }
                                            if (answersToSave.length === 0) return;
                                            await saveAllFollowUpAnswers(submission.id, answersToSave);
                                            setFollowUpToast({ type: 'success', text: `Đã nộp ${answersToSave.length} bài sửa! Đang chấm điểm...` });

                                            // Auto-grade all follow-up answers
                                            let gradedCount = 0;
                                            for (const item of answersToSave) {
                                                try {
                                                    await gradeFollowUpAnswer(
                                                        submission.id,
                                                        item.questionId,
                                                        { ...item.question, sectionId: item.sectionId },
                                                        exam?.sections || [],
                                                        exam?.teacherTitle || 'thầy/cô',
                                                        exam?.studentTitle || 'em'
                                                    );
                                                    gradedCount++;
                                                } catch (gradeErr) {
                                                    console.warn(`Follow-up grading failed for ${item.questionId}:`, gradeErr);
                                                }
                                            }
                                            setFollowUpToast({ type: 'success', text: `Đã chấm xong ${gradedCount}/${answersToSave.length} bài sửa!` });
                                            // Clear auto-save after successful submission
                                            if (fuAutoSaveKey) {
                                                try { localStorage.removeItem(fuAutoSaveKey); } catch (e) {}
                                            }
                                            await loadData();
                                        } catch (err) {
                                            setFollowUpToast({ type: 'error', text: 'Lỗi: ' + err.message });
                                        }
                                        setSubmittingFollowUp(null);
                                        setTimeout(() => setFollowUpToast(null), 4000);
                                    }}
                                    disabled={submittingFollowUp === 'all' || !allFilled}
                                    style={{
                                        display: 'inline-flex', alignItems: 'center', gap: '8px',
                                        padding: '14px 32px', borderRadius: '14px', border: 'none',
                                        background: allFilled ? 'linear-gradient(135deg, #8b5cf6, #6d28d9)' : '#d4d4d8',
                                        color: '#fff', fontWeight: 800, fontSize: '1rem',
                                        cursor: allFilled ? 'pointer' : 'default',
                                        opacity: submittingFollowUp === 'all' ? 0.6 : 1,
                                        boxShadow: allFilled ? '0 4px 16px rgba(139, 92, 246, 0.4)' : 'none',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    <Send size={18} /> {submittingFollowUp === 'all' ? 'Đang nộp...' : `Nộp tất cả bài sửa (${pendingIds.length} câu)`}
                                </button>
                                {!allFilled && (
                                    <div style={{ fontSize: '0.82rem', color: '#94a3b8', marginTop: '8px' }}>
                                        Hãy điền đầy đủ tất cả các câu cần sửa trước khi nộp.
                                    </div>
                                )}
                            </div>
                        );
                    })()}

                    <div style={{ textAlign: 'center', marginTop: '32px' }}>
                        <Link to="/" className="exam-btn exam-btn-primary" style={{ display: 'inline-flex' }}>
                            <Home size={16} /> Về trang chủ
                        </Link>
                    </div>

                    {/* Follow-up toast */}
                    {followUpToast && (
                        <div style={{
                            position: 'fixed', top: '20px', right: '20px', zIndex: 10000,
                            padding: '12px 20px', borderRadius: '12px',
                            background: followUpToast.type === 'success' ? '#ecfdf5' : '#fef2f2',
                            color: followUpToast.type === 'success' ? '#065f46' : '#991b1b',
                            boxShadow: '0 4px 16px rgba(0,0,0,0.12)', fontWeight: 600, fontSize: '0.88rem'
                        }}>{followUpToast.text}</div>
                    )}
                </>
            )}
        </div>
    );
}
