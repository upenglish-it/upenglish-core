import { useState, useCallback, useEffect } from 'react';
import { Volume2 } from 'lucide-react';
import { textToSpeech, playTTS } from '../../services/aiService';
import { useScrollToContent } from '../../hooks/useScrollToContent';
import { useAppSettings } from '../../contexts/AppSettingsContext';

export default function StepListening({ wordData, onComplete, reviewData }) {
    const isReview = !!reviewData;
    const [playing, setPlaying] = useState(false);
    const [selected, setSelected] = useState(isReview ? reviewData.selected : null);
    const [answered, setAnswered] = useState(isReview || false);
    const [canProceed, setCanProceed] = useState(false);
    const contentRef = useScrollToContent(answered);
    const { settings } = useAppSettings();

    const [options] = useState(() => isReview ? reviewData.options : shuffleOnce(wordData));
    const isCorrect = isReview ? reviewData.isCorrect : selected === wordData.word;

    const handlePlay = useCallback(async () => {
        if (playing) return;
        setPlaying(true);
        try {
            const blob = await textToSpeech(wordData.word);
            await playTTS(blob);
        } catch (e) {
            console.warn('TTS error:', e);
        }
        setPlaying(false);
    }, [wordData.word, playing]);

    function handleSelect(word) {
        if (answered || isReview) return;
        setSelected(word);
        setAnswered(true);
    }

    function handleNext() {
        onComplete(isCorrect, { selected, options });
    }

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
                handleNext();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [answered, canProceed, handleNext, isReview]);

    return (
        <div className="learn-step" style={{ position: 'relative' }}>
            {settings?.devBypassEnabled && !isReview && (
                <button
                    onClick={() => onComplete(true, { selected: wordData.word, options })}
                    style={{ position: 'absolute', top: '12px', right: '12px', padding: '4px 8px', fontSize: '12px', background: 'rgba(255,255,255,0.1)', border: '1px dashed #555', borderRadius: '6px', color: '#999', cursor: 'pointer', zIndex: 10, display: 'flex', alignItems: 'center', gap: '4px' }}
                    title="Bypass step (Dev Only)"
                >
                    ⏩ Skip
                </button>
            )}
            <div className="learn-step-header">
                <h2 className="learn-step-title">🎧 Nghe & Nhận dạng</h2>
                {isReview && <div className="learn-step-review-badge">Đang xem lại</div>}
            </div>

            {/* 2-Column Desktop Grid Layout */}
            <div className="learn-step-content" ref={contentRef}>
                {/* Left Column: Context / Media */}
                <div className="learn-col-left">
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
                        {/* Word Image */}
                        {wordData.image && (
                            <img
                                src={wordData.image}
                                alt={wordData.word}
                                style={{
                                    width: '250px',
                                    height: '250px',
                                    objectFit: 'cover',
                                    borderRadius: '16px',
                                    border: '2px solid rgba(255,255,255,0.15)',
                                    marginBottom: 'var(--space-md)',
                                    boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
                                }}
                            />
                        )}
                        {/* Play Button */}
                        <button
                            className={`learn-play-btn ${playing ? 'learn-play-btn--playing' : ''}`}
                            onClick={handlePlay}
                        >
                            <Volume2 size={32} />
                            <span>{playing ? 'Đang phát...' : 'Nghe phát âm'}</span>
                        </button>

                    </div>
                </div>

                {/* Right Column: Interaction / Input */}
                <div className="learn-col-right">
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', maxWidth: '400px', gap: 'var(--space-md)' }}>
                        {/* Options */}
                        <div className="learn-options" style={{ width: '100%' }}>
                            {options.map((opt) => (
                                <button
                                    key={opt}
                                    className={`learn-option ${!answered ? '' :
                                        opt === wordData.word ? 'learn-option--correct' :
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
                </div>

                {/* Result + Next (outside columns so it spans full width on desktop) */}
                {answered && !isReview && (
                    <div className={`learn-bottom-bar ${isCorrect ? 'learn-bottom-bar--correct' : 'learn-bottom-bar--wrong'}`}>
                        <div className="learn-bottom-bar-inner">
                            <div className="learn-bottom-bar-content">
                                <div className="learn-bottom-bar-title">{isCorrect ? 'Chính xác!' : 'Chưa chính xác'}</div>
                                <div className="learn-bottom-bar-subtitle">
                                    {!isCorrect && <span style={{ marginRight: '8px' }}>Đáp án: <strong>{wordData.word}</strong></span>}
                                    <span>{wordData.phonetic}</span>
                                </div>
                            </div>
                        </div>
                        <div className="learn-result-actions" style={{ marginTop: 'var(--space-md)' }}>
                            <button className="btn btn-primary" onClick={handleNext}>Tiếp tục →</button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

// Shuffle distractors + correct word (memoized per render)
let _cache = {};
function shuffleOnce(wordData) {
    const key = wordData.word;
    if (_cache[key]) return _cache[key];
    const distractors = wordData.distractors || [];
    const arr = [wordData.word, ...distractors.slice(0, 3)];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    _cache[key] = arr;
    return arr;
}
