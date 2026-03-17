import { useState, useRef, useEffect, useCallback } from 'react';
import { Volume2, Delete } from 'lucide-react';
import { textToSpeech, playTTS } from '../../services/aiService';
import { useScrollToContent } from '../../hooks/useScrollToContent';
import { useAppSettings } from '../../contexts/AppSettingsContext';

export default function StepSpelling({ wordData, onComplete, reviewData }) {
    const isReview = !!reviewData;
    const [input, setInput] = useState(isReview ? reviewData.input : '');
    const [answered, setAnswered] = useState(isReview || false);
    const [canProceed, setCanProceed] = useState(false);
    const [playing, setPlaying] = useState(false);
    const contentRef = useScrollToContent(answered);
    const { settings } = useAppSettings();

    const inputRef = useRef(null);
    const isPlayingRef = useRef(false);
    const hasAutoPlayedRef = useRef(false);

    const isCorrect = isReview ? reviewData.isCorrect : input.toLowerCase().trim() === wordData.word.toLowerCase().trim();

    const handlePlay = useCallback(async () => {
        if (isPlayingRef.current) return;
        isPlayingRef.current = true;
        setPlaying(true);
        try {
            const blob = await textToSpeech(wordData.word);
            await playTTS(blob);
        } catch (e) { console.warn(e); }
        isPlayingRef.current = false;
        setPlaying(false);
    }, [wordData.word]);

    useEffect(() => {
        if (!isReview) inputRef.current?.focus();
        // Add safeguard against React StrictMode double render
        if (!hasAutoPlayedRef.current) {
            hasAutoPlayedRef.current = true;
            handlePlay();
        }
    }, [handlePlay, isReview]);

    function handleSubmit(e) {
        e.preventDefault();
        if (!input.trim() || answered || isReview) return;
        setAnswered(true);
    }

    function handleKeyDown(e) {
        if (e.key === 'Enter' && !answered && !isReview) handleSubmit(e);
    }

    useEffect(() => {
        if (answered && !isReview) {
            const t = setTimeout(() => setCanProceed(true), 500);
            return () => clearTimeout(t);
        }
    }, [answered, isReview]);

    useEffect(() => {
        const handleGlobalKeyDown = (e) => {
            if (e.key === 'Enter' && answered && canProceed && !isReview) {
                e.preventDefault();
                onComplete(isCorrect, { input });
            }
        };
        window.addEventListener('keydown', handleGlobalKeyDown);
        return () => window.removeEventListener('keydown', handleGlobalKeyDown);
    }, [answered, canProceed, isCorrect, onComplete, isReview, input]);

    return (
        <div className="learn-step" style={{ position: 'relative' }}>
            {/* DEV SKIP */}
            {settings?.devBypassEnabled && !isReview && (
                <button
                    onClick={() => onComplete(true, { input: wordData.word })}
                    style={{ position: 'absolute', top: '12px', right: '12px', padding: '4px 8px', fontSize: '12px', background: 'rgba(255,255,255,0.1)', border: '1px dashed #555', borderRadius: '6px', color: '#999', cursor: 'pointer', zIndex: 10, display: 'flex', alignItems: 'center', gap: '4px' }}
                    title="Bypass step (Dev Only)"
                >
                    ⏩ Skip
                </button>
            )}

            <div className="learn-step-header">
                <h2 className="learn-step-title">✍️ Chính tả</h2>
                {isReview && <div className="learn-step-review-badge">Đang xem lại</div>}
            </div>

            <div className="learn-spelling-container" ref={contentRef}>
                {/* Hint & Audio Section */}
                {/* Unified Interactive Box */}
                <div className="learn-spelling-interactive-card">
                    <div className="learn-spelling-hint-section">
                        <span className="text-muted">Nghĩa tiếng Việt:</span>
                        <strong className="learn-spelling-meaning">{wordData.vietnameseMeaning}</strong>
                    </div>

                    <div className="learn-spelling-divider" />

                    <div className="learn-spelling-audio-section">
                        <button
                            className={`learn-play-btn ${playing ? 'learn-play-btn--playing' : ''}`}
                            onClick={handlePlay}
                        >
                            <Volume2 size={24} />
                            <span>{playing ? 'Đang phát...' : 'Nghe lại'}</span>
                        </button>
                    </div>
                </div>


                {/* Input Section */}
                <form className="learn-spelling-form" onSubmit={handleSubmit} style={{ width: '100%', maxWidth: '500px' }}>
                    <div className="learn-spelling-input-wrapper">
                        <input
                            ref={inputRef}
                            type="text"
                            className={`learn-spelling-input ${answered ? (isCorrect ? 'learn-spelling-input--correct' : 'learn-spelling-input--wrong') : ''}`}
                            value={input}
                            onChange={(e) => !answered && !isReview && setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="..."
                            disabled={answered || isReview}
                            autoCapitalize="none"
                            autoCorrect="off"
                            spellCheck={false}
                        />
                    </div>

                    {!answered && !isReview && (
                        <button
                            type="submit"
                            className="btn btn-primary btn-full"
                            disabled={!input.trim()}
                        >
                            Kiểm tra
                        </button>
                    )}
                </form>

                {/* Result Bar */}
                {answered && !isReview && (
                    <div className={`learn-bottom-bar ${isCorrect ? 'learn-bottom-bar--correct' : 'learn-bottom-bar--wrong'}`}>
                        <div className="learn-bottom-bar-inner">
                            <div className="learn-bottom-bar-content">
                                <div className="learn-bottom-bar-title">{isCorrect ? 'Chính xác!' : 'Chưa chính xác'}</div>
                                {!isCorrect && (
                                    <div className="learn-bottom-bar-subtitle">
                                        Đáp án: <strong>{wordData.word.trim()}</strong>
                                        <span style={{ margin: '0 8px', opacity: 0.5 }}>|</span>
                                        Bạn gõ: <span style={{ color: 'var(--color-error-light)' }}>{input || '(trống)'}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="learn-result-actions" style={{ marginTop: 'var(--space-md)' }}>
                            <button className="btn btn-primary" onClick={() => onComplete(isCorrect, { input })}>Tiếp tục →</button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
