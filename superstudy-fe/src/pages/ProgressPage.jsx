import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getAllWordProgressMap } from '../services/spacedRepetition';
import { getUserOverallGrammarStats } from '../services/grammarSpacedRepetition';
import { getExamSubmissionsForStudent, getExam, getExamAssignment } from '../services/examService';
import { BookOpen, PenLine, FileCheck, X, Flag, AlertTriangle, Users } from 'lucide-react';
import './ProgressPage.css';

const MASTERY_LEVELS = [
    { key: 0, label: 'Đang học', color: '#f59e0b' },
    { key: 1, label: 'Mới nhớ', color: '#3b82f6' },
    { key: 2, label: 'Quen dần', color: '#06b6d4' },
    { key: 3, label: 'Nhớ tốt', color: '#14b8a6' },
    { key: 4, label: 'Thành thạo', color: '#22c55e' },
    { key: 5, label: 'Xuất sắc', color: '#10b981' },
];

function getGrade(percent) {
    if (percent >= 90) return { label: 'Xuất sắc', color: '#10b981', bg: '#ecfdf5' };
    if (percent >= 80) return { label: 'Giỏi', color: '#f97316', bg: '#fff7ed' };
    if (percent >= 65) return { label: 'Khá', color: '#eab308', bg: '#fefce8' };
    if (percent >= 50) return { label: 'Trung bình', color: '#3b82f6', bg: '#eff6ff' };
    return { label: 'Cần cố gắng', color: '#64748b', bg: '#f8fafc' };
}

/**
 * ProgressModal — shows student's learning progress as a bottom-sheet popup
 * @param {{ isOpen: boolean, onClose: () => void, redFlags: Array, groupIdToName: Object }} props
 */
export default function ProgressModal({ isOpen, onClose, redFlags = [], groupIdToName = {} }) {
    const { user } = useAuth();
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [vocabStats, setVocabStats] = useState({ total: 0, learned: 0, levelDist: {} });
    const [grammarStats, setGrammarStats] = useState({ learned: 0, totalCorrect: 0, totalWrong: 0 });
    const [examHistory, setExamHistory] = useState([]);

    // Tab state for multi-group students
    const groupEntries = Object.entries(groupIdToName);
    const hasMultipleGroups = groupEntries.length > 1;
    const [activeGroupTab, setActiveGroupTab] = useState('all');

    useEffect(() => {
        if (!user?.uid || !isOpen) return;
        loadAll();
    }, [user?.uid, isOpen]);

    async function loadAll() {
        setLoading(true);
        try {
            const [wordMap, gStats, submissions] = await Promise.all([
                getAllWordProgressMap(user.uid),
                getUserOverallGrammarStats(user.uid),
                getExamSubmissionsForStudent(user.uid)
            ]);

            // Process vocab stats
            const levelDist = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
            let learned = 0;
            const totalWords = Object.keys(wordMap).length;

            for (const key in wordMap) {
                const w = wordMap[key];
                const level = w.level ?? 0;
                const completed = w.stepsCompleted ?? 0;
                if (completed >= 6) {
                    learned++;
                    levelDist[Math.min(level, 5)]++;
                } else if (completed > 0) {
                    levelDist[0]++;
                }
            }

            setVocabStats({ total: totalWords, learned, levelDist });
            setGrammarStats(gStats);

            // Process exam submissions — only graded ones with results released
            const gradedSubs = submissions.filter(s =>
                s.status === 'graded' && s.resultsReleased
            );

            // Fetch exam details and assignment details for each unique examId/assignmentId
            const uniqueExamIds = [...new Set(gradedSubs.map(s => s.examId))];
            const uniqueAssignmentIds = [...new Set(gradedSubs.map(s => s.assignmentId).filter(Boolean))];
            const examDetailsMap = {};
            const assignmentDetailsMap = {};

            await Promise.all([
                ...uniqueExamIds.map(async (eid) => {
                    try {
                        const exam = await getExam(eid);
                        if (exam) examDetailsMap[eid] = exam;
                    } catch (e) { /* ignore */ }
                }),
                ...uniqueAssignmentIds.map(async (aid) => {
                    try {
                        const assignment = await getExamAssignment(aid);
                        if (assignment) assignmentDetailsMap[aid] = assignment;
                    } catch (e) { /* ignore */ }
                })
            ]);

            const history = gradedSubs.map(s => {
                const exam = examDetailsMap[s.examId] || {};
                const assignment = assignmentDetailsMap[s.assignmentId] || {};
                const maxScore = s.maxTotalScore || 0;
                const percent = maxScore ? Math.round((s.totalScore / maxScore) * 100) : 0;
                // Determine groupId from assignment
                const groupId = assignment.targetType === 'group' ? assignment.targetId : null;
                return {
                    id: s.id,
                    assignmentId: s.assignmentId,
                    examName: exam.name || 'Bài kiểm tra',
                    examIcon: exam.icon || '📋',
                    examColor: exam.color || '#6366f1',
                    examType: exam.examType || 'homework',
                    totalScore: s.totalScore ?? 0,
                    maxTotalScore: maxScore,
                    percent,
                    grade: getGrade(percent),
                    groupId,
                    submittedAt: s.submittedAt?.toDate ? s.submittedAt.toDate() : (s.submittedAt ? new Date(s.submittedAt) : null),
                };
            }).sort((a, b) => {
                const ta = a.submittedAt?.getTime() || 0;
                const tb = b.submittedAt?.getTime() || 0;
                return tb - ta;
            });

            setExamHistory(history);
        } catch (err) {
            console.error('ProgressModal: error loading data', err);
        }
        setLoading(false);
    }

    if (!isOpen) return null;

    const totalGrammarAttempts = (grammarStats.totalCorrect || 0) + (grammarStats.totalWrong || 0);
    const grammarAccuracy = totalGrammarAttempts > 0 ? Math.round((grammarStats.totalCorrect / totalGrammarAttempts) * 100) : 0;

    // Mastery bar total
    const masteryTotal = Object.values(vocabStats.levelDist).reduce((s, v) => s + v, 0);

    // SVG ring calculations
    const ringRadius = 42;
    const ringCircumference = 2 * Math.PI * ringRadius;
    const ringOffset = ringCircumference - (grammarAccuracy / 100) * ringCircumference;
    const ringColor = grammarAccuracy >= 80 ? '#10b981' : grammarAccuracy >= 60 ? '#f59e0b' : '#ef4444';

    // Filter data by active group tab
    const filteredRedFlags = activeGroupTab === 'all'
        ? redFlags
        : redFlags.filter(f => f.groupId === activeGroupTab);

    const filteredExamHistory = activeGroupTab === 'all'
        ? examHistory
        : examHistory.filter(e => e.groupId === activeGroupTab);

    // Helper to render red flags section
    const renderRedFlags = (flags) => {
        if (flags.length === 0) return null;
        const flagsByGroup = {};
        flags.forEach(f => {
            if (!flagsByGroup[f.groupId]) flagsByGroup[f.groupId] = [];
            flagsByGroup[f.groupId].push(f);
        });
        const groupEntries2 = Object.entries(flagsByGroup);
        // When viewing a specific tab, don't show group badge since it's already clear
        const showGroupBadge = activeGroupTab === 'all' && groupEntries2.length > 1;
        return (
            <section className="progress-section" style={{ marginTop: '4px' }}>
                <h3 className="progress-section-title">
                    <Flag size={16} />
                    Cờ cảnh báo
                </h3>
                <div className="mastery-card">
                    {groupEntries2.map(([gid, gFlags]) => {
                        const count = gFlags.length;
                        const groupName = gFlags[0]?.groupName || gid;
                        const isTerminated = count >= 3;
                        const accentColor = isTerminated ? '#ef4444' : count === 2 ? '#f97316' : '#eab308';
                        return (
                            <div key={gid} style={{ marginBottom: groupEntries2.length > 1 ? '16px' : 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px', flexWrap: 'wrap' }}>
                                    <div style={{ display: 'flex', gap: '6px' }}>
                                        {[1, 2, 3].map(i => (
                                            <div key={i} style={{
                                                width: '28px', height: '28px', borderRadius: '8px',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                fontSize: '0.75rem', fontWeight: 800,
                                                background: i <= count ? `${accentColor}18` : 'var(--bg-input)',
                                                color: i <= count ? accentColor : 'var(--text-muted)',
                                                border: `1.5px solid ${i <= count ? `${accentColor}40` : 'var(--border-color)'}`,
                                            }}>
                                                {i <= count ? '🚩' : i}
                                            </div>
                                        ))}
                                    </div>
                                    {showGroupBadge && (
                                        <span style={{
                                            fontSize: '0.68rem', padding: '3px 8px', borderRadius: '6px',
                                            background: 'var(--bg-input)', color: 'var(--text-muted)',
                                            border: '1px solid var(--border-color)',
                                            display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 600
                                        }}>
                                            <Users size={10} />
                                            {groupName}
                                        </span>
                                    )}
                                </div>
                                {isTerminated && (
                                    <div style={{
                                        display: 'flex', alignItems: 'flex-start', gap: '8px',
                                        padding: '10px 14px', borderRadius: '10px', marginBottom: '12px',
                                        background: `${accentColor}0a`,
                                        border: `1px solid ${accentColor}25`
                                    }}>
                                        <AlertTriangle size={15} style={{ color: accentColor, flexShrink: 0, marginTop: '2px' }} />
                                        <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                                            Hợp đồng đảm bảo đầu ra cho lớp <strong>{groupName}</strong> đã bị chấm dứt. Bạn vẫn được tham gia lớp cho đến hết khóa.
                                        </div>
                                    </div>
                                )}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {gFlags.map(flag => {
                                        const date = flag.createdAt?.toDate ? flag.createdAt.toDate() : (flag.createdAt ? new Date(flag.createdAt) : null);
                                        const flagBg = flag.flagNumber >= 3 ? 'rgba(239,68,68,0.12)' : flag.flagNumber === 2 ? 'rgba(249,115,22,0.10)' : 'rgba(234,179,8,0.08)';
                                        const flagBorder = flag.flagNumber >= 3 ? 'rgba(239,68,68,0.2)' : flag.flagNumber === 2 ? 'rgba(249,115,22,0.18)' : 'rgba(234,179,8,0.15)';
                                        return (
                                            <div key={flag.id} style={{
                                                padding: '10px 14px', borderRadius: '12px',
                                                background: flagBg,
                                                border: `1px solid ${flagBorder}`
                                            }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                                    <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                                                        {flag.violationLabel}
                                                    </span>
                                                    <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                                                        {date ? date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : ''}
                                                    </span>
                                                </div>
                                                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontStyle: 'italic', lineHeight: 1.4 }}>
                                                    {flag.note}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </section>
        );
    };

    // Helper to render exam history section
    const renderExamHistory = () => (
        <section className="progress-section">
            <h3 className="progress-section-title">
                <FileCheck size={16} />
                Lịch sử bài thi
            </h3>
            {hasMultipleGroups && (
                <div className="progress-group-tabs">
                    <button
                        className={`progress-group-tab ${activeGroupTab === 'all' ? 'progress-group-tab--active' : ''}`}
                        onClick={() => setActiveGroupTab('all')}
                    >
                        Tất cả
                    </button>
                    {groupEntries.map(([gid, gname]) => (
                        <button
                            key={gid}
                            className={`progress-group-tab ${activeGroupTab === gid ? 'progress-group-tab--active' : ''}`}
                            onClick={() => setActiveGroupTab(gid)}
                        >
                            {gname}
                        </button>
                    ))}
                </div>
            )}
            {filteredExamHistory.length > 0 ? (
                <div className="exam-history-list">
                    {filteredExamHistory.map(exam => (
                        <div
                            key={exam.id}
                            className="exam-history-item"
                            onClick={() => { onClose(); navigate(`/exam-result?assignmentId=${exam.assignmentId}&studentId=${user?.uid}`); }}
                        >
                            <div className="exam-history-icon" style={{ background: `${exam.examColor}20` }}>
                                {exam.examIcon}
                            </div>
                            <div className="exam-history-info">
                                <div className="exam-history-name">{exam.examName}</div>
                                <div className="exam-history-meta">
                                    <span>{exam.examType === 'test' ? '🔴 Kiểm tra' : '🔵 Bài tập'}</span>
                                    <span>•</span>
                                    <span>{exam.submittedAt ? exam.submittedAt.toLocaleDateString('vi-VN') : 'N/A'}</span>
                                </div>
                            </div>
                            <div className="exam-history-score">
                                <span className="exam-history-score-value" style={{ color: exam.grade.color }}>
                                    {Math.round(exam.totalScore * 10) / 10}/{exam.maxTotalScore}
                                </span>
                                <span className="exam-history-grade" style={{ background: exam.grade.bg, color: exam.grade.color }}>
                                    {exam.grade.label}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="progress-empty">
                    📋 Bạn chưa có kết quả bài thi nào.
                </div>
            )}
        </section>
    );

    return (
        <div className="progress-modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="progress-modal">
                <button className="progress-modal-close" onClick={onClose}>
                    <X size={18} />
                </button>

                <h2 className="progress-modal-title">📊 Tiến trình của tôi</h2>

                {loading ? (
                    <div className="progress-loading" style={{ minHeight: '30vh' }}>
                        <div className="progress-loading-spinner"></div>
                        <p>Đang tải tiến trình...</p>
                    </div>
                ) : (
                    <>
                        {/* Red Flags Section */}
                        {renderRedFlags(redFlags)}

                        {/* Vocabulary Mastery — global, always shown */}
                        <section className="progress-section">
                            <h3 className="progress-section-title">
                                <BookOpen size={16} />
                                Mức độ ghi nhớ từ vựng
                            </h3>
                            <div className="mastery-card">
                                {masteryTotal > 0 ? (
                                    <>
                                        <div className="mastery-bar-container">
                                            {MASTERY_LEVELS.map(ml => {
                                                const count = vocabStats.levelDist[ml.key] || 0;
                                                const pct = masteryTotal > 0 ? (count / masteryTotal) * 100 : 0;
                                                if (pct === 0) return null;
                                                return (
                                                    <div
                                                        key={ml.key}
                                                        className="mastery-bar-segment"
                                                        style={{ width: `${pct}%`, background: ml.color }}
                                                        title={`${ml.label}: ${count} từ (${Math.round(pct)}%)`}
                                                    />
                                                );
                                            })}
                                        </div>
                                        <div className="mastery-legend">
                                            {MASTERY_LEVELS.map(ml => (
                                                <div key={ml.key} className="mastery-legend-item">
                                                    <div className="mastery-legend-dot" style={{ background: ml.color }} />
                                                    <div className="mastery-legend-info">
                                                        <span className="mastery-legend-label">{ml.label}</span>
                                                        <span className="mastery-legend-count">{vocabStats.levelDist[ml.key] || 0}</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </>
                                ) : (
                                    <div className="progress-empty">
                                        📚 Bạn chưa học từ vựng nào. Hãy bắt đầu học ngay!
                                    </div>
                                )}
                            </div>
                        </section>

                        {/* Grammar Performance — global, always shown */}
                        <section className="progress-section">
                            <h3 className="progress-section-title">
                                <PenLine size={16} />
                                Hiệu suất kỹ năng
                            </h3>
                            <div className="grammar-stats-card">
                                {totalGrammarAttempts > 0 ? (
                                    <>
                                        <div className="grammar-accuracy-ring">
                                            <svg viewBox="0 0 100 100">
                                                <circle className="ring-bg" cx="50" cy="50" r={ringRadius} />
                                                <circle
                                                    className="ring-fill"
                                                    cx="50" cy="50" r={ringRadius}
                                                    stroke={ringColor}
                                                    strokeDasharray={ringCircumference}
                                                    strokeDashoffset={ringOffset}
                                                />
                                            </svg>
                                            <div className="grammar-accuracy-text">
                                                <span className="grammar-accuracy-value">{grammarAccuracy}%</span>
                                                <span className="grammar-accuracy-label">Chính xác</span>
                                            </div>
                                        </div>
                                        <div className="grammar-detail-stats">
                                            <div className="grammar-detail-item">
                                                <span className="grammar-detail-value">{grammarStats.learned}</span>
                                                <span className="grammar-detail-label">Câu đã làm</span>
                                            </div>
                                            <div className="grammar-detail-item">
                                                <span className="grammar-detail-value" style={{ color: '#10b981' }}>{grammarStats.totalCorrect}</span>
                                                <span className="grammar-detail-label">Đúng</span>
                                            </div>
                                            <div className="grammar-detail-item">
                                                <span className="grammar-detail-value" style={{ color: '#ef4444' }}>{grammarStats.totalWrong}</span>
                                                <span className="grammar-detail-label">Sai</span>
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                    <div className="progress-empty" style={{ width: '100%' }}>
                                        ✍️ Bạn chưa làm bài kỹ năng nào. Hãy thử ngay!
                                    </div>
                                )}
                            </div>
                        </section>

                        {/* Exam History — with group filter tabs inside */}
                        {renderExamHistory()}

                    </>
                )}
            </div>
        </div>
    );
}
