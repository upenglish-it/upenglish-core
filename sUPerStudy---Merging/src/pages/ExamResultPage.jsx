import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { getExam, getExamQuestions, getExamSubmission, saveExamSubmission } from '../services/examService';
import { useAuth } from '../contexts/AuthContext';
import { Home, RefreshCw, Check, X } from 'lucide-react';
import { OptionContent, isImageOption } from '../components/common/MCQImageOption';
import './TakeExamPage.css';

const hasContent = (html) => {
    if (!html) return false;
    const stripped = html.replace(/<[^>]*>/g, '').trim();
    if (stripped.length > 0) return true;
    return /<(img|iframe|video|audio|embed|object)/i.test(html);
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

    const assignmentId = searchParams.get('assignmentId');
    const studentId = searchParams.get('studentId') || user?.uid;

    const [submission, setSubmission] = useState(null);
    const [exam, setExam] = useState(null);
    const [questions, setQuestions] = useState([]);
    const [loading, setLoading] = useState(true);

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

                // Mark as viewed if student is viewing their own result
                if (studentId === user?.uid && sub.status === 'graded' && !sub.viewedByStudent) {
                    saveExamSubmission({ id: sub.id, viewedByStudent: true }).catch(console.error);
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

    // Calculate total possible score from all questions
    const totalPossibleScore = questions.reduce((sum, q) => sum + (q.points || 1), 0);
    const displayMaxScore = totalPossibleScore || submission.maxTotalScore || 0;

    // Calculate percentage based on total possible score
    const percent = displayMaxScore ? Math.round((submission.totalScore / displayMaxScore) * 100) : 0;
    const grade = percent >= 90 ? 'Xuất sắc' : percent >= 80 ? 'Giỏi' : percent >= 65 ? 'Khá' : percent >= 50 ? 'Trung bình' : 'Cần cố gắng thêm';
    const gradeColor = percent >= 90 ? '#ef4444' : percent >= 80 ? '#f97316' : percent >= 65 ? '#eab308' : percent >= 50 ? '#3b82f6' : '#1e293b';
    const gradeIcon = percent >= 90 ? '🔥' : percent >= 80 ? '🎉' : percent >= 65 ? '🌟' : percent >= 50 ? '👍' : '💪';

    const renderVisualAnswer = (q, variation, answerData) => {
        const answer = answerData?.answer;
        if (!answer) return <span style={{ color: '#ef4444', fontStyle: 'italic' }}>Em đã không hoàn thành câu hỏi này</span>;

        if (q.type === 'audio_recording') {
            if (typeof answer === 'object' && answer?.hasRecording) {
                return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontSize: '1.1rem' }}>🎤</span>
                            <span style={{ fontWeight: 600, color: '#10b981', fontSize: '0.85rem' }}>Đã ghi âm</span>
                        </div>
                        {answer.audioUrl && (
                            <audio controls src={answer.audioUrl} style={{ width: '100%', maxWidth: '400px', borderRadius: '8px' }} />
                        )}
                        {answer.transcript && (
                            <div style={{ fontSize: '0.85rem', color: '#1e293b', background: '#f8fafc', padding: '8px 12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                <span style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 600 }}>📝 Transcript: </span>
                                {answer.transcript}
                            </div>
                        )}
                    </div>
                );
            }
            return <span style={{ color: '#ef4444', fontStyle: 'italic' }}>Chưa thu âm</span>;
        }

        if (q.type === 'multiple_choice') {
            return (
                <div className="exam-result-mc">
                    {(variation?.options || []).map((opt, i) => {
                        if (!opt) return null;
                        const isSelected = opt === answer;
                        const isCorrectOpt = opt === variation?.correctOption;
                        let borderColor = '#e2e8f0';
                        let bgColor = '#f8fafc';
                        let textColor = '#64748b';
                        let opacity = 1;

                        if (isSelected) {
                            borderColor = isCorrectOpt ? '#10b981' : '#ef4444';
                            bgColor = isCorrectOpt ? '#d1fae5' : '#fee2e2';
                            textColor = isCorrectOpt ? '#065f46' : '#991b1b';
                        } else if (isCorrectOpt) {
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
                                {isSelected && (
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
                                <div className={`exam-result-match-right ${isCorrectMatch ? 'correct' : 'incorrect'}`}>
                                    {studentMatch || '—'}
                                </div>
                                {!isCorrectMatch && (
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
                            <div key={idx} className={`exam-result-ordering-item ${isCorrectPos ? 'correct' : 'incorrect'}`}>
                                <span className="exam-result-ordering-num">{idx + 1}</span>
                                <span>{item}</span>
                                {isCorrectPos ? <Check size={14} strokeWidth={3} style={{ marginLeft: 'auto' }} /> : (
                                    <span className="exam-result-ordering-correct-hint">Đúng: {correctItems[idx]}</span>
                                )}
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
                while ((mm = regex.exec(rawText)) !== null) { correctWords.push(mm[1].replace(/&nbsp;/g, ' ')); }

                let blankIdx = 0;
                return (
                    <div className="exam-result-fill-sentence">
                        {parts.map((part, i) => {
                            const match = part.match(/^\{\{(.+?)\}\}$/);
                            if (match) {
                                const idx = blankIdx++;
                                const studentWord = answer[String(idx)] || '';
                                const correctWord = correctWords[idx];
                                const isWordCorrect = studentWord.trim().toLowerCase() === correctWord.trim().toLowerCase();
                                return (
                                    <span key={i}>
                                        <span className={`exam-result-fill-blank ${isWordCorrect ? 'correct' : 'incorrect'}`}>
                                            {studentWord || '—'}
                                        </span>
                                        {!isWordCorrect && (
                                            <span className="exam-result-fill-correct-hint">({correctWord})</span>
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
            return <span style={{ color: '#0f172a', fontWeight: 500 }}>{String(answer)}</span>;
        }

        return <span style={{ color: '#0f172a', fontWeight: 500 }}>{String(answer)}</span>;
    };

    return (
        <div className="exam-result-page">
            {!isGrading && (
                <div className="exam-result-header">
                    <div className="exam-result-icon">{gradeIcon}</div>
                    <h1 className="exam-result-title">Kết quả bài tập và kiểm tra</h1>
                    <p className="exam-result-subtitle">{exam?.name || 'Bài tập và Kiểm tra'}</p>
                </div>
            )}

            {isGrading && (
                <div style={{ textAlign: 'center', padding: '40px 16px 48px' }}>
                    {/* Animated card */}
                    <div style={{
                        maxWidth: '420px', margin: '0 auto', padding: '3px', borderRadius: '24px',
                        background: 'linear-gradient(135deg, #6366f1, #8b5cf6, #a78bfa, #6366f1)',
                        backgroundSize: '300% 300%',
                        animation: 'gradientShift 4s ease infinite'
                    }}>
                        <div style={{
                            background: '#fff', borderRadius: '22px', padding: '36px 28px',
                            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px'
                        }}>
                            {/* Animated icon */}
                            <div style={{
                                width: '72px', height: '72px', borderRadius: '50%',
                                background: 'linear-gradient(135deg, #ede9fe 0%, #e0e7ff 100%)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '2rem', animation: 'pulse 2s ease-in-out infinite'
                            }}>
                                ⏳
                            </div>

                            <div>
                                <h2 style={{
                                    fontSize: '1.2rem', fontWeight: 800, color: '#1e293b', margin: '0 0 8px'
                                }}>
                                    Bài đang được giáo viên chấm
                                </h2>
                                <p style={{ fontSize: '0.88rem', color: '#64748b', margin: 0, lineHeight: 1.5 }}>
                                    Giáo viên đang chấm bài của bạn. Kết quả sẽ sớm được công bố, quay lại sau nhé!
                                </p>
                            </div>

                            {/* Status indicator */}
                            <div style={{
                                display: 'flex', alignItems: 'center', gap: '8px',
                                padding: '10px 20px', borderRadius: '12px',
                                background: '#eff6ff',
                                border: '1px solid #bfdbfe'
                            }}>
                                <div style={{
                                    width: '8px', height: '8px', borderRadius: '50%',
                                    background: '#3b82f6',
                                    animation: 'pulse 1.5s ease-in-out infinite'
                                }} />
                                <span style={{
                                    fontSize: '0.82rem', fontWeight: 700,
                                    color: '#2563eb'
                                }}>
                                    Đang xử lý bài làm của bạn
                                </span>
                            </div>

                            {/* Buttons */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%', marginTop: '4px' }}>
                                <button className="exam-btn exam-btn-primary" onClick={loadData}
                                    style={{ margin: '0 auto', minWidth: '180px', justifyContent: 'center' }}>
                                    <RefreshCw size={16} /> Kiểm tra lại
                                </button>
                                <Link to="/" className="exam-btn exam-btn-secondary"
                                    style={{ display: 'inline-flex', margin: '0 auto', minWidth: '180px', justifyContent: 'center' }}>
                                    <Home size={16} /> Về trang chủ
                                </Link>
                            </div>
                        </div>
                    </div>

                    <style>{`
                        @keyframes gradientShift {
                            0% { background-position: 0% 50%; }
                            50% { background-position: 100% 50%; }
                            100% { background-position: 0% 50%; }
                        }
                    `}</style>
                </div>
            )}

            {isGraded && (
                <>
                    {/* Score card */}
                    <div className="exam-result-score-card">
                        <div className="exam-result-score">
                            {Math.round((submission.totalScore ?? 0) * 10) / 10}
                            <span className="exam-result-max">/{displayMaxScore}</span>
                        </div>
                        <div className="exam-result-percent" style={{ background: `${gradeColor}15`, color: gradeColor }}>
                            {percent}% — {grade}
                        </div>
                    </div>

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
                                    <div style={{ marginBottom: '16px', padding: '12px 16px', background: '#f0fdf4', borderRadius: '12px', border: '1px solid #bbf7d0' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#15803d' }}>🎵 Audio ngữ cảnh</span>
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

                                    return (
                                        <div key={q.id} className="exam-result-question-item" style={{
                                            border: `1px solid ${isCorrect ? '#a7f3d0' : isPartial ? '#fde68a' : '#fecaca'}`
                                        }}>
                                            <div className="exam-result-question-header">
                                                <div className="exam-result-question-info">
                                                    <div className="exam-result-question-icon" style={{
                                                        background: isCorrect ? '#ecfdf5' : isPartial ? '#fffbeb' : '#fef2f2',
                                                        color: isCorrect ? '#10b981' : isPartial ? '#f59e0b' : '#ef4444'
                                                    }}>
                                                        {isCorrect ? <Check size={14} /> : isPartial ? <span style={{ fontSize: '0.8rem', fontWeight: 900 }}>!</span> : <X size={14} />}
                                                    </div>
                                                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1e293b' }}>Câu {qIdx + 1}</span>
                                                    <span style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{QUESTION_TYPE_LABELS[q.type] || q.type}</span>
                                                </div>
                                                <div className="exam-result-score-badge" style={{
                                                    background: isCorrect ? '#ecfdf5' : isPartial ? '#fffbeb' : '#fef2f2',
                                                    color: isCorrect ? '#10b981' : isPartial ? '#f59e0b' : '#ef4444'
                                                }}>
                                                    {effectiveScore ?? 0}/{maxPossibleScore}
                                                </div>
                                            </div>
                                            <div className="exam-result-question-text"
                                                dangerouslySetInnerHTML={{ __html: (variation?.text || '(Câu hỏi)').replace(/&nbsp;/g, ' ') }}>
                                            </div>

                                            <div className="exam-result-answer-box">
                                                <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>
                                                    Câu trả lời của bạn:
                                                </div>
                                                {renderVisualAnswer(q, variation, answer)}
                                            </div>

                                            {result?.feedback && (
                                                <div style={{ fontSize: '0.85rem', color: '#1e40af', background: '#eff6ff', padding: '10px 14px', borderRadius: '12px', marginTop: '12px', whiteSpace: 'pre-wrap' }}>
                                                    <strong>Nhận xét:</strong> <span dangerouslySetInnerHTML={{ __html: renderFeedbackHtml(result.feedback) }} />
                                                </div>
                                            )}
                                            {result?.teacherOverride?.note && (
                                                <div style={{ fontSize: '0.85rem', color: '#7c3aed', background: '#f5f3ff', padding: '10px 14px', borderRadius: '12px', marginTop: '8px', whiteSpace: 'pre-wrap' }}>
                                                    <strong>{result.teacherOverride.overriddenByName || 'Giáo viên'}:</strong> {result.teacherOverride.note}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        );
                    })}

                    <div style={{ textAlign: 'center', marginTop: '32px' }}>
                        <Link to="/" className="exam-btn exam-btn-primary" style={{ display: 'inline-flex' }}>
                            <Home size={16} /> Về trang chủ
                        </Link>
                    </div>
                </>
            )}
        </div>
    );
}
