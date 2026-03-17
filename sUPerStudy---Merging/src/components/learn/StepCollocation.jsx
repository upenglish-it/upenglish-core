import { useState, useEffect, useMemo } from 'react';
import { useScrollToContent } from '../../hooks/useScrollToContent';
import { useAppSettings } from '../../contexts/AppSettingsContext';

export default function StepCollocation({ wordData, onComplete, reviewData }) {
    const isReview = !!reviewData;
    const [selected, setSelected] = useState(isReview ? reviewData.selected : null);
    const [answered, setAnswered] = useState(isReview || false);
    const [canProceed, setCanProceed] = useState(false);
    const contentRef = useScrollToContent(answered);
    const { settings } = useAppSettings();

    // Use collocationExercise data (AI-generated) if available
    const exercise = wordData.collocationExercise;

    // Fallback: use collocations[0] if no collocationExercise
    const targetColloc = wordData.collocations?.[0];

    if (!exercise && !targetColloc) {
        return (
            <div className="learn-step">
                <p>Không có bài luyện collocation.</p>
                <button className="btn btn-primary" onClick={() => onComplete(true, {})}>Tiếp tục →</button>
            </div>
        );
    }

    // Determine answer, sentence, hint based on data source
    const answer = exercise ? exercise.answer?.trim() : wordData.word.trim();
    const sentenceDisplay = exercise ? exercise.sentence : null;
    const sentenceVi = exercise ? exercise.sentenceVi : (targetColloc?.vietnamese || '');

    const isCorrect = isReview ? reviewData.isCorrect : selected === answer;

    const shuffledOptions = useMemo(() => {
        if (isReview) return reviewData.shuffledOptions;

        if (exercise && exercise.options?.length >= 2) {
            // Use AI-generated options, shuffle them
            return [...exercise.options].sort(() => Math.random() - 0.5);
        }

        // Fallback: old logic using distractors
        let pool = [answer, ...(wordData.distractors || [])];
        pool = [...new Set(pool)];
        if (pool.length < 4) {
            const fillers = ["something", "another", "word"].filter(d => !pool.includes(d));
            pool.push(...fillers);
        }
        return pool.slice(0, 4).sort(() => Math.random() - 0.5);
    }, [answer, exercise, wordData.distractors, isReview, reviewData]);

    useEffect(() => {
        if (answered && !isReview) {
            const t = setTimeout(() => setCanProceed(true), 500);
            return () => clearTimeout(t);
        }
    }, [answered, isReview]);

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Enter' && answered && canProceed && !isReview) {
                e.preventDefault();
                onComplete(isCorrect, { selected, shuffledOptions });
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [answered, canProceed, isCorrect, onComplete, selected, shuffledOptions, isReview]);

    function handleSelect(opt) {
        if (answered || isReview) return;
        setSelected(opt);
        setAnswered(true);
    }

    // Build the phrase display
    let prefix = '';
    let suffix = '';

    if (sentenceDisplay) {
        // collocationExercise.sentence has "___" as blank
        const parts = sentenceDisplay.split('___');
        prefix = parts[0] || '';
        suffix = parts.slice(1).join('___') || '';
    } else if (targetColloc) {
        // Fallback: old logic — replace main word with blank
        const regex = new RegExp(`(${wordData.word.trim()})`, 'i');
        const phraseParts = targetColloc.phrase.split(regex);
        if (phraseParts.length > 1) {
            prefix = phraseParts[0];
            suffix = phraseParts.slice(2).join('');
        } else {
            prefix = '';
            suffix = ' ' + targetColloc.phrase;
        }
    }

    // Full correct phrase for showing in result
    const fullPhrase = exercise
        ? exercise.sentence.replace('___', answer)
        : (targetColloc?.phrase || '');

    return (
        <div className="learn-step" style={{ position: 'relative' }}>
            {/* DEV SKIP */}
            {settings?.devBypassEnabled && !isReview && (
                <button
                    onClick={() => onComplete(true, { selected: answer, shuffledOptions })}
                    style={{ position: 'absolute', top: '12px', right: '12px', padding: '4px 8px', fontSize: '12px', background: 'rgba(255,255,255,0.1)', border: '1px dashed #555', borderRadius: '6px', color: '#999', cursor: 'pointer', zIndex: 10, display: 'flex', alignItems: 'center', gap: '4px' }}
                    title="Bypass step (Dev Only)"
                >
                    ⏩ Skip
                </button>
            )}

            <div className="learn-step-header">
                <h2 className="learn-step-title">🧩 Collocation</h2>
                {isReview && <div className="learn-step-review-badge">Đang xem lại</div>}
            </div>

            {/* 1-Column Centered Layout */}
            <div className="learn-collocation-container" ref={contentRef}>
                {/* Meaning Hint */}
                <div className="learn-collocation-hint-card" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span className="text-muted">Nghĩa tiếng Việt</span>
                    <strong>{sentenceVi}</strong>
                </div>

                {/* Phrase with Blank */}
                <div className="learn-collocation-phrase-box">
                    <div className="learn-collocation-phrase">
                        {prefix && <span>{prefix}</span>}

                        <span className={`learn-collocation-blank ${!answered ? '' :
                            isCorrect ? 'learn-collocation-blank--correct' : 'learn-collocation-blank--wrong'
                            }`} style={{ textTransform: 'lowercase' }}>
                            {selected || '___'}
                        </span>

                        {suffix && <span>{suffix}</span>}
                    </div>
                </div>

                {/* Options (Single Words) */}
                <div className="learn-collocation-options">
                    {shuffledOptions.map((opt, idx) => (
                        <button
                            key={idx}
                            className={`learn-option ${!answered ? '' :
                                opt === answer ? 'learn-option--correct' :
                                    opt === selected ? 'learn-option--wrong' : 'learn-option--dim'
                                }`}
                            onClick={() => handleSelect(opt)}
                            disabled={answered || isReview}
                        >
                            {opt}
                        </button>
                    ))}
                </div>
            </div>

            {/* Result Bar */}
            {answered && !isReview && (
                <div className={`learn-bottom-bar ${isCorrect ? 'learn-bottom-bar--correct' : 'learn-bottom-bar--wrong'}`}>
                    <div className="learn-bottom-bar-inner">
                        <div className="learn-bottom-bar-content">
                            <div className="learn-bottom-bar-title">{isCorrect ? 'Tuyệt vời!' : 'Chưa chính xác'}</div>
                            <div className="learn-bottom-bar-subtitle" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                {!isCorrect && <div>Đáp án đúng: <strong>{fullPhrase}</strong></div>}
                            </div>
                        </div>
                    </div>
                    <div className="learn-result-actions" style={{ marginTop: 'var(--space-md)' }}>
                        <button className="btn btn-primary" onClick={() => onComplete(isCorrect, { selected, shuffledOptions })}>Tiếp tục →</button>
                    </div>
                </div>
            )}
        </div>
    );
}
