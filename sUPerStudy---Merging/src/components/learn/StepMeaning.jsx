import { useState, useEffect } from 'react';
import { Volume2 } from 'lucide-react';
import { textToSpeech, playTTS } from '../../services/aiService';
import { useScrollToContent } from '../../hooks/useScrollToContent';
import { useAppSettings } from '../../contexts/AppSettingsContext';

export default function StepMeaning({ wordData, onComplete, reviewData }) {
    const isReview = !!reviewData;
    const [selected, setSelected] = useState(isReview ? reviewData.selected : null);
    const [answered, setAnswered] = useState(isReview || false);
    const [canProceed, setCanProceed] = useState(false);
    const contentRef = useScrollToContent(answered);
    const { settings } = useAppSettings();

    // Build options once on mount to prevent reshuffling on re-render, or use review data options
    const [options] = useState(() => isReview ? reviewData.options : buildMeaningOptions(wordData));
    const isCorrect = isReview ? reviewData.isCorrect : selected === wordData.vietnameseMeaning;

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
                onComplete(isCorrect, { selected, options });
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [answered, canProceed, isCorrect, onComplete, isReview, selected, options]);

    function handleSelect(meaning) {
        if (answered || isReview) return;
        setSelected(meaning);
        setAnswered(true);
    }

    async function handlePlayExample() {
        const sentence = wordData.exampleSentences?.[0]?.en;
        if (!sentence) return;
        try {
            const blob = await textToSpeech(sentence);
            await playTTS(blob);
        } catch (e) { console.warn(e); }
    }



    return (
        <div className="learn-step" style={{ position: 'relative' }}>
            {/* DEV SKIP */}
            {settings?.devBypassEnabled && !isReview && (
                <button
                    onClick={() => onComplete(true, { selected: wordData.vietnameseMeaning, options })}
                    style={{ position: 'absolute', top: '12px', right: '12px', padding: '4px 8px', fontSize: '12px', background: 'rgba(255,255,255,0.1)', border: '1px dashed #555', borderRadius: '6px', color: '#999', cursor: 'pointer', zIndex: 10, display: 'flex', alignItems: 'center', gap: '4px' }}
                    title="Bypass step (Dev Only)"
                >
                    ⏩ Skip
                </button>
            )}

            <div className="learn-step-header">
                <h2 className="learn-step-title">💡 Giải nghĩa & Ngữ cảnh</h2>
                {isReview && <div className="learn-step-review-badge">Đang xem lại</div>}
            </div>

            {/* Centered Word Display */}
            <div className="learn-word-display-centered">
                <h3 className="learn-word-big">{wordData.word}</h3>
                <span className="learn-word-pos">{wordData.partOfSpeech}</span>
                <p className="learn-word-phonetic">{wordData.phonetic}</p>
            </div>

            {/* Hero Image (if available) */}
            {wordData.image && (
                <div style={{ width: '100%', display: 'flex', justifyContent: 'center', marginBottom: 'var(--space-lg)' }}>
                    <img
                        src={wordData.image}
                        alt={wordData.word}
                        className="learn-meaning-hero-img"
                    />
                </div>
            )}

            {/* Context + Options in vertical flow */}
            <div className="learn-step-content" ref={contentRef} style={{ alignItems: 'flex-start' }}>
                {/* Left Column: Context Guide */}
                <div className="learn-col-left">
                    <div className="learn-example glass-card--static" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)', width: '100%', padding: 'var(--space-md) var(--space-sm)' }}>
                        {/* Explanation */}
                        {wordData.explanation && (
                            <div style={{
                                fontSize: '0.95rem',
                                color: 'var(--text-secondary)',
                                lineHeight: 1.5,
                                textAlign: 'left',
                                borderBottom: wordData.exampleSentences?.[0] ? '1px solid rgba(255,255,255,0.05)' : 'none',
                                paddingBottom: wordData.exampleSentences?.[0] ? 'var(--space-sm)' : 0
                            }}>
                                <span style={{ fontSize: '1.1rem', marginRight: '6px' }}>💡</span>
                                {wordData.explanation}
                            </div>
                        )}

                        {/* Example sentence */}
                        {wordData.exampleSentences?.[0] && (
                            <div style={{ width: '100%' }}>
                                <div className="learn-example-header" style={{ marginBottom: 'var(--space-xs)' }}>
                                    <span className="text-sm text-muted">Ví dụ:</span>
                                    <button className="learn-mini-play" onClick={handlePlayExample} title="Nghe">
                                        <Volume2 size={14} />
                                    </button>
                                </div>
                                <p className="learn-example-en">"{wordData.exampleSentences[0].en}"</p>
                                {answered && (
                                    <p className="learn-example-vi">{wordData.exampleSentences[0].vi}</p>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Column: Interaction & Results */}
                <div className="learn-col-right">
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', gap: 'var(--space-sm)' }}>

                        {/* Options */}
                        <div className="learn-options learn-options--vertical" style={{ width: '100%' }}>
                            {options.map((opt, i) => (
                                <button
                                    key={i}
                                    className={`learn-option ${!answered ? '' :
                                        opt === wordData.vietnameseMeaning ? 'learn-option--correct' :
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

                {/* Result (outside columns so it spans full width on desktop) */}
                {answered && !isReview && (
                    <div className={`learn-bottom-bar ${isCorrect ? 'learn-bottom-bar--correct' : 'learn-bottom-bar--wrong'}`}>
                        <div className="learn-bottom-bar-inner">
                            <div className="learn-bottom-bar-content">
                                <div className="learn-bottom-bar-title">{isCorrect ? 'Chính xác!' : 'Chưa chính xác'}</div>
                                {!isCorrect && <div className="learn-bottom-bar-subtitle">Đáp án: <strong>{wordData.vietnameseMeaning}</strong></div>}
                            </div>
                        </div>
                        <div className="learn-result-actions" style={{ marginTop: 'var(--space-md)' }}>
                            <button className="btn btn-primary" onClick={() => onComplete(isCorrect, { selected, options })}>Tiếp tục →</button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

const FAKE_MEANINGS = [
    'cải thiện, nâng cao',
    'giảm bớt, hạ thấp',
    'xem xét, đánh giá',
    'phân tích, nghiên cứu',
    'thay thế, đổi mới',
    'mở rộng, phát triển',
    'tổ chức, sắp xếp',
    'kiểm soát, quản lý',
    'kết nối, liên kết',
    'tham khảo, trích dẫn',
];

function buildMeaningOptions(wordData) {
    const correct = wordData.vietnameseMeaning;
    const fakes = FAKE_MEANINGS.filter((m) => m !== correct);
    // Pick 2 random fakes
    const shuffled = [...fakes].sort(() => Math.random() - 0.5);
    const options = [correct, shuffled[0], shuffled[1]];
    return options.sort(() => Math.random() - 0.5);
}
