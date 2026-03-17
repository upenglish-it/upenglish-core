import confetti from 'canvas-confetti';
import { useEffect } from 'react';
import { ArrowLeft, RotateCcw } from 'lucide-react';

export default function LearningComplete({ results, topicName, onGoHome, onRestart }) {
    const total = results.length;

    // Aggregate stats
    const totalCorrect = results.reduce((sum, r) => sum + r.totalCorrect, 0);
    const totalWrong = results.reduce((sum, r) => sum + r.totalWrong, 0);
    const totalAttempts = totalCorrect + totalWrong;

    // Efficiency: correct / total attempts
    const efficiency = totalAttempts > 0 ? Math.round((totalCorrect / totalAttempts) * 100) : 100;

    useEffect(() => {
        if (efficiency >= 50) {
            confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } });
            setTimeout(() => confetti({ particleCount: 60, spread: 100, origin: { y: 0.5 } }), 400);
        }
    }, []);

    const ringColor = efficiency >= 90 ? 'var(--color-success)'
        : efficiency >= 70 ? 'var(--color-warning)'
            : 'var(--color-error)';

    const heading = efficiency >= 90 ? 'Xuất sắc!'
        : efficiency >= 70 ? 'Tốt lắm!'
            : efficiency >= 50 ? 'Khá tốt!'
                : 'Cần cố gắng thêm!';

    const icon = efficiency >= 90 ? '🏆' : efficiency >= 70 ? '🎉' : efficiency >= 50 ? '👍' : '💪';

    const passCount = results.filter(r => r.totalWrong === 0).length;
    const failCount = results.filter(r => r.totalWrong > 0).length;

    return (
        <div className="learn-complete animate-slide-up">
            {/* Header section */}
            <div className="learn-complete-header">
                <div className="learn-complete-icon">{icon}</div>
                <h1 className="learn-complete-title">{heading}</h1>
                <p className="learn-complete-topic">{topicName}</p>

                {/* Completion badge */}
                <div style={{ marginTop: 'var(--space-sm)' }}>
                    <span style={{
                        background: 'var(--color-success)',
                        color: '#fff',
                        padding: '6px 16px',
                        borderRadius: '20px',
                        fontSize: '0.85rem',
                        fontWeight: 600
                    }}>
                        ✅ Hoàn thành 100% • {total}/{total} từ
                    </span>
                </div>
            </div>

            {/* Desktop 2-column layout */}
            <div className="learn-complete-body">
                {/* Left: Score ring + stats */}
                <div className="learn-complete-stats-panel">
                    <div className="learn-complete-score">
                        <div className="learn-complete-score-ring">
                            <svg viewBox="0 0 100 100" className="learn-score-svg">
                                <circle cx="50" cy="50" r="42" fill="none" stroke="var(--border-color)" strokeWidth="8" />
                                <circle cx="50" cy="50" r="42" fill="none"
                                    stroke={ringColor}
                                    strokeWidth="8" strokeLinecap="round"
                                    strokeDasharray={`${efficiency * 2.64} 264`}
                                    transform="rotate(-90 50 50)"
                                    className="learn-score-circle"
                                />
                            </svg>
                            <span className="learn-complete-pct">{efficiency}%</span>
                        </div>
                        <p className="learn-complete-detail" style={{ fontWeight: 600, fontSize: '1.05rem' }}>
                            Hiệu quả học tập
                        </p>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '4px' }}>
                            {totalCorrect} đúng / {totalAttempts} lần trả lời
                            {totalWrong > 0 && <span style={{ color: 'var(--color-error)' }}> • {totalWrong} lỗi sai</span>}
                        </p>
                    </div>

                    {/* Quick stat cards */}
                    <div className="learn-complete-quick-stats">
                        <div className="learn-complete-stat-card learn-complete-stat-card--success">
                            <span className="stat-card-num">{passCount}</span>
                            <span className="stat-card-label">Hoàn hảo</span>
                        </div>
                        <div className={`learn-complete-stat-card ${failCount > 0 ? 'learn-complete-stat-card--error' : 'learn-complete-stat-card--success'}`}>
                            <span className="stat-card-num">{failCount}</span>
                            <span className="stat-card-label">Có lỗi</span>
                        </div>
                    </div>
                </div>

                {/* Right: Word list */}
                <div className="learn-complete-words-panel">
                    <h3 className="learn-complete-words-title">Chi tiết từng từ</h3>
                    <div className="learn-complete-words">
                        {results.map((r, i) => (
                            <div key={i} className={`learn-complete-word ${r.totalWrong === 0 ? 'learn-complete-word--pass' : 'learn-complete-word--fail'}`}>
                                <span>{r.totalWrong === 0 ? '✅' : '⚠️'}</span>
                                <span className="learn-complete-word-text">{r.word}</span>
                                <span className="learn-complete-word-score" style={{
                                    display: 'flex',
                                    gap: '8px',
                                    alignItems: 'center',
                                    fontSize: '0.8rem'
                                }}>
                                    {r.totalWrong > 0 ? (
                                        <span style={{ color: 'var(--color-error)' }}>{r.totalWrong} lỗi</span>
                                    ) : (
                                        <span style={{ color: 'var(--color-success)' }}>Hoàn hảo</span>
                                    )}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Actions */}
            <div className="learn-complete-actions" style={{ justifyContent: 'center' }}>
                {onRestart && (
                    <button className="btn btn-secondary" onClick={onRestart} style={{ minWidth: '120px' }}>
                        <RotateCcw size={18} /> Ôn lại từ đầu
                    </button>
                )}
                <button className="btn btn-primary" onClick={onGoHome} style={{ minWidth: '120px' }}>
                    <ArrowLeft size={20} /> Trang chủ
                </button>
            </div>
        </div>
    );
}
