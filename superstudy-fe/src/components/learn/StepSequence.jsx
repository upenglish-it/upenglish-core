import { useState, useMemo, useEffect } from 'react';
import { useScrollToContent } from '../../hooks/useScrollToContent';
import { useAppSettings } from '../../contexts/AppSettingsContext';

export default function StepSequence({ wordData, onComplete, reviewData }) {
    const isReview = !!reviewData;
    const sequenceData = wordData.sentenceSequence ||
        (wordData.exampleSentences?.length > 0 ? wordData.exampleSentences[0] : null);

    const [selectedIndexes, setSelectedIndexes] = useState(isReview ? reviewData.selectedIndexes : []);
    const [answered, setAnswered] = useState(isReview || false);
    const [canProceed, setCanProceed] = useState(false);
    const contentRef = useScrollToContent(answered);
    const { settings } = useAppSettings();

    const { originalWords, shuffledWords } = useMemo(() => {
        if (isReview) return { originalWords: reviewData.originalWords, shuffledWords: reviewData.shuffledWords };
        if (!sequenceData || !sequenceData.en) return { originalWords: [], shuffledWords: [] };
        const words = sequenceData.en.trim().split(/\s+/);
        const wordObjs = words.map((w, i) => ({ text: w, id: i }));
        const shuffled = [...wordObjs].sort(() => Math.random() - 0.5);
        return { originalWords: words, shuffledWords: shuffled };
    }, [sequenceData, isReview, reviewData]);

    const isCorrect = isReview ? reviewData.isCorrect : selectedIndexes.map(item => item.text).join(' ') === originalWords.join(' ');

    if (!sequenceData || originalWords.length === 0) {
        return (
            <div className="learn-step">
                <p>Không có câu luyện tập cho từ này.</p>
                <button className="btn btn-primary" onClick={() => onComplete(true, {})}>Hoàn thành →</button>
            </div>
        );
    }

    function handleSelectWord(indexObj) {
        if (answered || isReview) return;
        setSelectedIndexes(prev => {
            if (prev.find(item => item.id === indexObj.id)) return prev;
            const newSelected = [...prev, indexObj];
            if (newSelected.length === shuffledWords.length) setAnswered(true);
            return newSelected;
        });
    }

    function handleDeselectWord(indexObj) {
        if (answered || isReview) return;
        setSelectedIndexes(prev => prev.filter(item => item.id !== indexObj.id));
    }

    useEffect(() => {
        if (answered && !isReview) {
            const t = setTimeout(() => setCanProceed(true), 500);
            return () => clearTimeout(t);
        }
    }, [answered, isReview]);

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Backspace' && !answered && !isReview) {
                if (selectedIndexes.length > 0) handleDeselectWord(selectedIndexes[selectedIndexes.length - 1]);
            }
            if (e.key === 'Enter' && answered && canProceed && !isReview) {
                e.preventDefault();
                onComplete(isCorrect, { selectedIndexes, originalWords, shuffledWords });
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [answered, canProceed, isCorrect, onComplete, selectedIndexes, isReview, originalWords, shuffledWords]);

    return (
        <div className="learn-step" style={{ position: 'relative' }}>
            {settings?.devBypassEnabled && !isReview && (
                <button
                    onClick={() => onComplete(true, { selectedIndexes: originalWords.map((w, i) => ({ text: w, id: i })), originalWords, shuffledWords })}
                    style={{ position: 'absolute', top: '12px', right: '12px', padding: '4px 8px', fontSize: '12px', background: 'rgba(255,255,255,0.1)', border: '1px dashed #555', borderRadius: '6px', color: '#999', cursor: 'pointer', zIndex: 10, display: 'flex', alignItems: 'center', gap: '4px' }}
                    title="Bypass step (Dev Only)"
                >
                    ⏩ Skip
                </button>
            )}

            <div className="learn-step-header">
                <h2 className="learn-step-title">🧩 Sắp xếp câu</h2>
                {isReview && <div className="learn-step-review-badge">Đang xem lại</div>}
            </div>

            <div className="learn-step-content" ref={contentRef} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', maxWidth: '600px', gap: 'var(--space-md)' }}>

                    {/* Vietnamese Target Meaning */}
                    <div className="seq-meaning-box">
                        <strong style={{ fontSize: 'calc(1.05rem * var(--font-scale, 1))', color: 'var(--color-primary-light)', lineHeight: 1.4 }}>
                            {sequenceData.vi}
                        </strong>
                    </div>

                    {/* Answer Slot */}
                    <div className={`seq-answer-zone${answered ? (isCorrect ? ' seq-answer-zone--correct' : ' seq-answer-zone--wrong') : ''}`}>
                        {selectedIndexes.length === 0 && !answered && (
                            <div style={{ color: 'var(--text-muted)', width: '100%', textAlign: 'center', alignSelf: 'center' }}>
                                Nhấn vào các từ bên dưới để ghép câu
                            </div>
                        )}
                        {selectedIndexes.map((item) => (
                            <button
                                key={`ans-${item.id}`}
                                onClick={() => handleDeselectWord(item)}
                                disabled={answered || isReview}
                                className={`seq-chip seq-chip--answer${answered ? (isCorrect ? ' seq-chip--correct' : ' seq-chip--wrong') : ''}`}
                            >
                                {item.text}
                            </button>
                        ))}
                    </div>

                    {/* Word Pool */}
                    {!answered && !isReview && (
                        <div className="seq-pool">
                            {shuffledWords.map(item => {
                                const isSelected = selectedIndexes.find(si => si.id === item.id);
                                return (
                                    <button
                                        key={`pool-${item.id}`}
                                        onClick={() => handleSelectWord(item)}
                                        disabled={isSelected || answered || isReview}
                                        className={`seq-chip${isSelected ? ' seq-chip--used' : ' seq-chip--pool'}`}
                                    >
                                        {item.text}
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    {/* Result Bar */}
                    {answered && !isReview && (
                        <div className={`learn-bottom-bar ${isCorrect ? 'learn-bottom-bar--correct' : 'learn-bottom-bar--wrong'}`}>
                            <div className="learn-bottom-bar-inner">
                                <div className="learn-bottom-bar-content" style={{ width: '100%', gap: 'var(--space-sm)' }}>
                                    <div className="learn-bottom-bar-title">{isCorrect ? '✅ Bạn xếp đúng rồi!' : '❌ Bạn xếp sai câu rồi!'}</div>
                                    {!isCorrect && (
                                        <div className="learn-explanation seq-correct-answer">
                                            <p style={{ fontSize: 'calc(0.85rem * var(--font-scale, 1))', marginBottom: '4px', opacity: 0.7 }}>Đáp án đúng:</p>
                                            <p className="learn-explanation-text" style={{ fontSize: 'calc(1.05rem * var(--font-scale, 1))', color: 'var(--color-success)', fontWeight: 'bold' }}>
                                                {originalWords.join(' ')}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="learn-result-actions" style={{ marginTop: 'var(--space-md)' }}>
                                <button className="btn btn-primary" onClick={() => onComplete(isCorrect, { selectedIndexes, originalWords, shuffledWords })}>
                                    Tiếp tục →
                                </button>
                            </div>
                        </div>
                    )}

                </div>
            </div>

            <style>{`
                @keyframes popIn {
                    0% { transform: scale(0.8); opacity: 0; }
                    100% { transform: scale(1); opacity: 1; }
                }
                .seq-meaning-box {
                    width: 100%;
                    background: rgba(255, 255, 255, 0.05);
                    padding: var(--space-md);
                    border-radius: var(--radius-md);
                    border: 1px solid var(--border-color);
                    text-align: center;
                }
                .seq-answer-zone {
                    width: 100%;
                    min-height: 80px;
                    border: 2px dashed var(--border-color);
                    border-radius: var(--radius-md);
                    padding: 12px;
                    display: flex;
                    flex-wrap: wrap;
                    align-content: flex-start;
                    gap: 8px;
                    background: rgba(0,0,0,0.2);
                    transition: border-color 0.3s ease, background 0.3s ease;
                }
                .seq-answer-zone--correct { border-color: var(--color-success) !important; }
                .seq-answer-zone--wrong   { border-color: var(--color-error) !important; }
                .seq-pool {
                    width: 100%;
                    display: flex;
                    flex-wrap: wrap;
                    justify-content: center;
                    gap: 10px;
                    margin-top: 10px;
                }
                .seq-chip {
                    padding: 8px 16px;
                    border-radius: 8px;
                    font-size: calc(1rem * var(--font-scale, 1));
                    font-weight: 500;
                    transition: all 0.2s;
                    cursor: pointer;
                }
                .seq-chip--pool {
                    background: var(--color-surface-hover, rgba(255,255,255,0.08));
                    color: var(--text-primary);
                    border: 1px solid rgba(255,255,255,0.1);
                    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
                }
                .seq-chip--pool:hover:not(:disabled) { transform: translateY(-2px); }
                .seq-chip--used {
                    background: rgba(255,255,255,0.05);
                    color: transparent;
                    border: 1px dashed var(--border-color);
                    cursor: default;
                    box-shadow: none;
                }
                .seq-chip--answer {
                    background: var(--color-surface, rgba(255,255,255,0.1));
                    color: var(--text-primary);
                    border: 1px solid rgba(255,255,255,0.1);
                    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
                    animation: popIn 0.2s ease-out;
                }
                .seq-chip--correct { background: var(--color-success) !important; color: #fff !important; border-color: var(--color-success) !important; }
                .seq-chip--wrong   { background: var(--color-error)   !important; color: #fff !important; border-color: var(--color-error)   !important; }
                .seq-correct-answer { width: 100%; margin-top: 4px; padding: 12px; border-radius: 8px; }

                /* Light theme overrides moved to src/themes/theme-light.css */
            `}</style>
        </div>
    );
}
