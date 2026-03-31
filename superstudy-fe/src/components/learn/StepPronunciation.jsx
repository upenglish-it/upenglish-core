import { useState, useRef, useEffect } from 'react';
import { Mic, Volume2, Loader2, AlertTriangle } from 'lucide-react';
import { textToSpeech, playTTS, evaluatePronunciation } from '../../services/aiService';
// preprocessAudio removed — raw audio is sent directly to AI
import { useScrollToContent } from '../../hooks/useScrollToContent';
import { useAppSettings } from '../../contexts/AppSettingsContext';

export default function StepPronunciation({ wordData, onComplete, reviewData }) {
    const isReview = !!reviewData;
    const [status, setStatus] = useState(isReview ? reviewData.status : 'idle'); // idle | listening | evaluating | done
    const [evalResult, setEvalResult] = useState(isReview ? reviewData.evalResult : null);
    const [attempts, setAttempts] = useState(isReview ? reviewData.attempts : 0); // Max 2 attempts
    const [recordedAudioUrl, setRecordedAudioUrl] = useState(isReview ? reviewData.recordedAudioUrl : null); // For playback
    const [canProceed, setCanProceed] = useState(false);
    const contentRef = useScrollToContent(status === 'done');
    const { settings } = useAppSettings();

    const mediaRecorderRef = useRef(null);
    const audioChunksRef = useRef([]);
    const MAX_ATTEMPTS = 2;

    useEffect(() => {
        return () => {
            if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
                mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop());
            }
        };
    }, []);

    useEffect(() => {
        if (status === 'done') {
            const t = setTimeout(() => setCanProceed(true), 500);
            return () => clearTimeout(t);
        } else {
            setCanProceed(false); // Reset when not done
        }
    }, [status]);

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Enter' && status === 'done' && (evalResult || attempts >= MAX_ATTEMPTS) && canProceed && !isReview) {
                e.preventDefault();
                handleNext();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [status, evalResult, attempts, canProceed, isReview]);

    async function handlePlayReference() {
        try {
            const blob = await textToSpeech(wordData.word);
            await playTTS(blob);
        } catch (e) {
            console.warn('TTS error:', e);
        }
    }

    async function handleStartRecording() {
        if (attempts >= MAX_ATTEMPTS) return;

        try {
            // Match pronunciation-coach microphone settings
            const audioConstraints = {
                channelCount: 1,
                sampleRate: 48000,
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
            };
            const stream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints });

            // Chọn định dạng audio tốt nhất được hỗ trợ để tăng chất lượng cho AI chấm điểm
            let options = { mimeType: 'audio/webm' };
            if (window.MediaRecorder && MediaRecorder.isTypeSupported) {
                if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
                    options = { mimeType: 'audio/webm;codecs=opus', audioBitsPerSecond: 128000 };
                } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
                    options = { mimeType: 'audio/mp4', audioBitsPerSecond: 128000 };
                } else if (MediaRecorder.isTypeSupported('audio/aac')) {
                    options = { mimeType: 'audio/aac', audioBitsPerSecond: 128000 };
                }
            }

            const mediaRecorder = new MediaRecorder(stream, options);
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];

            // ONLY run pre-filter on desktop. Mobile browsers (especially iOS/Safari) 
            // have notoriously unreliable SpeechRecognition implementations that block valid audio.
            const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            let preFilterTranscript = '';
            let recognition = null;
            let recognitionFailed = false;

            if (SpeechRecognition && !isMobile) {
                recognition = new SpeechRecognition();
                recognition.lang = 'en-US';
                recognition.continuous = true;
                recognition.interimResults = true;
                recognition.onresult = (e) => {
                    let t = '';
                    for (let i = 0; i < e.results.length; i++) t += e.results[i][0].transcript + ' ';
                    preFilterTranscript = t.trim().toLowerCase();
                };
                recognition.onerror = (e) => {
                    // SpeechRecognition failed (network issue, not allowed, etc.)
                    // Mark as failed so we skip pre-filter and let AI handle it
                    console.warn('SpeechRecognition error, will skip pre-filter:', e.error);
                    recognitionFailed = true;
                };
                try {
                    recognition.start();
                } catch (recStartErr) {
                    console.warn('SpeechRecognition.start() failed:', recStartErr);
                    recognitionFailed = true;
                    recognition = null;
                }
            }
            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) audioChunksRef.current.push(event.data);
            };

            mediaRecorder.onstop = async () => {
              try {
                const actualMimeType = options.mimeType || 'audio/webm';
                const rawBlob = new Blob(audioChunksRef.current, { type: actualMimeType });
                stream.getTracks().forEach(track => track.stop());

                if (recognition) { try { recognition.stop(); } catch { } }

                // Use raw blob directly — no preprocessing to preserve audio quality
                const audioBlob = rawBlob;

                // Save a URL for playback (use processed audio)
                const url = URL.createObjectURL(audioBlob);
                setRecordedAudioUrl(url);

                // === SILENCE DETECTION (cross-platform, works on mobile + desktop) ===
                try {
                    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
                    const arrayBuffer = await audioBlob.arrayBuffer();
                    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
                    const channelData = audioBuffer.getChannelData(0);

                    // Calculate RMS (Root Mean Square) volume
                    let sumSquares = 0;
                    for (let i = 0; i < channelData.length; i++) {
                        sumSquares += channelData[i] * channelData[i];
                    }
                    const rms = Math.sqrt(sumSquares / channelData.length);

                    // Threshold: RMS < 0.005 is essentially silence/background noise
                    // Typical speech RMS is 0.05-0.3
                    if (rms < 0.005) {
                        audioContext.close();
                        // Don't count as an attempt — let student retry
                        setEvalResult({
                            score: 0,
                            transcript: '',
                            feedback: `Hệ thống không phát hiện giọng nói trong bản thu âm. Vui lòng đọc to và rõ ràng từ "${wordData.word}" rồi thử lại.`
                        });
                        setStatus('done');
                        return;
                    }
                    audioContext.close();
                } catch (volumeErr) {
                    // If AudioContext fails (rare), continue to AI evaluation
                    console.warn('Volume check failed, proceeding to AI:', volumeErr);
                }

                // === DESKTOP SPEECH RECOGNITION PRE-FILTER ===
                // Skip pre-filter if SpeechRecognition errored (e.g. network issue on Windows)
                if (SpeechRecognition && !isMobile && !recognitionFailed) {
                    const transcript = preFilterTranscript.trim();
                    if (transcript === '') {
                        // Don't count as an attempt — let student retry
                        setEvalResult({
                            score: 0,
                            transcript: '',
                            feedback: `Hệ thống chưa nhận diện được giọng nói của bạn. Vui lòng đọc to và rõ ràng hơn.`
                        });
                        setStatus('done');
                        return;
                    }

                    const sim = similarity(transcript, wordData.word.toLowerCase());
                    if (sim < 80 && !transcript.includes(wordData.word.toLowerCase())) {
                        setAttempts(prev => prev + 1);
                        setEvalResult({
                            score: 0,
                            transcript: transcript,
                            feedback: `Hệ thống nhận diện bạn đọc là "${transcript}". Vui lòng đọc rõ từ "${wordData.word}" hơn để AI chấm điểm chi tiết.`
                        });
                        setStatus('done');
                        return;
                    }
                }

                setAttempts(prev => prev + 1);
                await handleEvaluateAudio(audioBlob);
              } catch (onstopErr) {
                // Catch-all: prevent silent failures (especially on Windows)
                console.error('onstop handler error:', onstopErr);
                setEvalResult({ score: 0, transcript: '', feedback: 'Đã xảy ra lỗi khi xử lý âm thanh. Vui lòng thử lại.' });
                setStatus('done');
              }
            };

            mediaRecorder.start();
            setStatus('listening');
            setEvalResult(null);
            // Clear previous recording URL
            if (recordedAudioUrl) { URL.revokeObjectURL(recordedAudioUrl); setRecordedAudioUrl(null); }

            setTimeout(() => {
                if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
                    mediaRecorderRef.current.stop();
                }
            }, 5000);

        } catch (err) {
            console.error('Error accessing microphone:', err);
            setEvalResult({ score: 0, transcript: '', feedback: 'Không thể truy cập Micro của bạn.' });
            setStatus('done');
        }
    }

    function handleStopRecording() {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            mediaRecorderRef.current.stop();
        }
    }

    async function handleEvaluateAudio(blob) {
        setStatus('evaluating');
        try {
            const result = await evaluatePronunciation(blob, wordData.word, wordData.phonetic);
            setEvalResult(result);
        } catch (error) {
            console.warn('Evaluation failed:', error);
            setEvalResult({ score: 0, transcript: '', feedback: 'Máy chấm điểm đang bận, vui lòng thử lại.' });
            setAttempts(prev => Math.max(0, prev - 1));
        } finally {
            setStatus('done');
        }
    }

    function isPassing(result) {
        if (!result) return false;
        const score = result.totalScore ?? result.score ?? 0;
        return score >= 65;
    }

    function getScore(result) {
        if (!result) return 0;
        return result.totalScore ?? result.score ?? 0;
    }

    function getPronunciationTitle(result) {
        if (!result) return '';
        const score = getScore(result);
        if (score >= 90) return 'Xuất sắc! Phát âm rất chuẩn 🤩';
        if (score >= 80) return 'Phát âm rất tốt! 👏';
        if (score >= 65) return 'Khá tốt, tiếp tục phát huy nhé! 👍';
        if (score >= 50) return 'Cần chú ý cải thiện thêm 🧐';
        return 'Hãy nghe mẫu và luyện tập lại nhé 💪';
    }

    function handleNext() {
        onComplete(isReview ? reviewData.isCorrect : isPassing(evalResult), { status, evalResult, attempts, recordedAudioUrl });
    }

    function similarity(a, b) {
        if (!a || !b) return 0;
        if (a === b) return 100;
        if (a.includes(b) || b.includes(a)) return 80;
        let matches = 0;
        for (const c of b) { if (a.includes(c)) matches++; }
        return Math.round((matches / b.length) * 100);
    }

    const isGood = isPassing(evalResult);
    const isBlocked = evalResult && evalResult.score === 0;
    // Show retry if there are still attempts remaining, regardless of pass/fail
    const canRetry = attempts < MAX_ATTEMPTS;
    const triesLeft = MAX_ATTEMPTS - attempts;



    return (
        <div className="learn-step" style={{ position: 'relative' }}>
            {/* DEV SKIP */}
            {settings?.devBypassEnabled && !isReview && (
                <button
                    onClick={() => onComplete(true, { status: 'done', evalResult: { score: 100, target_word: wordData.word, standard_ipa: wordData.phonetic, actual_heard_ipa: wordData.phonetic, error_details: [], advice: 'Bypass mode' }, attempts: 1, recordedAudioUrl: null })}
                    style={{ position: 'absolute', top: '12px', right: '12px', padding: '4px 8px', fontSize: '12px', background: 'rgba(255,255,255,0.1)', border: '1px dashed #555', borderRadius: '6px', color: '#999', cursor: 'pointer', zIndex: 10, display: 'flex', alignItems: 'center', gap: '4px' }}
                    title="Bypass step (Dev Only)"
                >
                    ⏩ Skip
                </button>
            )}

            <div className="learn-step-header">
                <h2 className="learn-step-title">🗣 Phát âm</h2>
                {isReview && <div className="learn-step-review-badge">Đang xem lại</div>}
            </div>

            {/* Compact Single Column Layout */}
            <div ref={contentRef} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', maxWidth: '600px', margin: '0 auto', gap: 'var(--space-md)' }}>

                {/* Word Card */}
                <div style={{ textAlign: 'center', width: '100%' }}>
                    <h3 className="learn-word-big">{wordData.word}</h3>
                    <p className="learn-word-phonetic">{wordData.phonetic}</p>
                    {wordData.pronunciationTip && (
                        <p style={{ marginTop: '8px', fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.5, padding: '0 var(--space-md)' }}>
                            💡 {wordData.pronunciationTip}
                        </p>
                    )}
                </div>

                {/* Listen Reference Button */}
                <button className="learn-play-btn learn-play-btn--small" onClick={handlePlayReference}>
                    <Volume2 size={18} /> Nghe mẫu
                </button>

                {/* Mic / Status Area */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-sm)', width: '100%' }}>
                    {status === 'idle' && attempts < MAX_ATTEMPTS && !isReview && (
                        <>
                            <button className="learn-mic-btn" onClick={handleStartRecording}>
                                <Mic size={36} />
                            </button>
                            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Nhấn để thu âm • Tối đa {MAX_ATTEMPTS} lần</p>
                        </>
                    )}

                    {status === 'idle' && attempts >= MAX_ATTEMPTS && !isReview && (
                        <div className="learn-result learn-result--wrong" style={{ textAlign: 'center', width: '100%', maxWidth: '500px' }}>
                            <AlertTriangle size={28} style={{ color: 'var(--color-error-light)', margin: '0 auto' }} />
                            <p style={{ fontWeight: 600 }}>Đã hết {MAX_ATTEMPTS} lượt đọc</p>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Hãy tiếp tục và ôn lại từ này sau nhé!</p>
                            <button className="btn btn-primary" onClick={handleNext}>Tiếp tục →</button>
                        </div>
                    )}

                    {status === 'listening' && (
                        <div className="learn-mic-active" onClick={handleStopRecording} style={{ cursor: 'pointer' }}>
                            <div className="learn-mic-pulse"><Mic size={28} /></div>
                            <p>Đang nghe... (Nhấn để dừng)</p>
                        </div>
                    )}

                    {status === 'evaluating' && (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-sm)', color: 'var(--color-primary-light)' }}>
                            <Loader2 size={36} className="animate-spin" />
                            <p style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>AI đang chấm điểm...</p>
                        </div>
                    )}
                </div>

                {/* Result: Blocked by pre-filter */}
                {status === 'done' && isBlocked && (
                    <div className="learn-bottom-bar learn-bottom-bar--wrong">
                        <div className="learn-bottom-bar-inner">
                            <div className="learn-bottom-bar-content">
                                <div className="learn-bottom-bar-title">Chưa nhận diện được</div>
                                <div className="learn-bottom-bar-subtitle">Vui lòng thử lại</div>
                            </div>

                            {/* Detail inside popup */}
                            <div className="pron-detail-box">
                                <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', lineHeight: 1.5, margin: 0 }}>
                                    {evalResult.feedback}
                                </p>
                                {evalResult.transcript && (
                                    <div style={{ marginTop: '10px', padding: '6px 10px', background: 'rgba(255, 99, 105, 0.1)', borderRadius: '6px', borderLeft: '3px solid var(--color-error)' }}>
                                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Mic thu được: </span>
                                        <span style={{ color: 'var(--color-error-light)', fontSize: '0.85rem', fontStyle: 'italic', fontWeight: 500 }}>
                                            "{evalResult.transcript}"
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="learn-result-actions" style={{ marginTop: 'var(--space-md)' }}>
                            {canRetry && !isReview && (
                                <button className="btn btn-secondary" onClick={() => setStatus('idle')}>
                                    🔄 Đọc lại ({triesLeft})
                                </button>
                            )}
                            {!isReview && (
                                <button className="btn btn-primary" onClick={handleNext}>
                                    Bỏ qua →
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {/* Result: AI evaluation */}
                {status === 'done' && evalResult && !isBlocked && (
                    <div className={`learn-bottom-bar ${isGood ? 'learn-bottom-bar--correct' : 'learn-bottom-bar--wrong'}`}>
                        <div className="learn-bottom-bar-inner">
                            <div className="learn-bottom-bar-content">
                                <div className="learn-bottom-bar-title">{getPronunciationTitle(evalResult)}</div>
                                <div className="learn-bottom-bar-subtitle">
                                    Điểm: <strong>{getScore(evalResult)}</strong>/100
                                    {!isGood && (
                                        <span style={{ fontSize: '0.8rem', color: 'var(--color-error)', marginLeft: '8px', fontWeight: '500' }}>
                                            (Bạn cần 65 điểm để vượt qua)
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Word Highlighting Output */}
                            {evalResult.word_letters && evalResult.word_letters.length > 0 && (
                                <div style={{
                                    width: '100%',
                                    textAlign: 'center',
                                    padding: '8px 0',
                                    fontSize: '2rem',
                                    fontWeight: 800,
                                    letterSpacing: '2px',
                                    display: 'flex',
                                    justifyContent: 'center',
                                    gap: '2px',
                                    flexWrap: 'wrap'
                                }}>
                                    {evalResult.word_letters.map((wl, idx) => {
                                        // Khoảng trắng: render một khoảng cách thực sự
                                        if (wl.letter === ' ' || wl.letter === '\u00a0') {
                                            return (
                                                <span key={idx} style={{ display: 'inline-block', width: '0.5em' }} />
                                            );
                                        }

                                        let color = 'var(--text-primary)';
                                        if (wl.status === 'correct') color = 'var(--color-success)';
                                        else if (wl.status === 'warning') color = 'var(--color-warning)';
                                        else if (wl.status === 'error') color = 'var(--color-error)';

                                        return (
                                            <span key={idx} style={{ color, transition: 'color 0.3s ease' }}>
                                                {wl.letter}
                                            </span>
                                        );
                                    })}

                                </div>
                            )}



                            {/* Playback */}
                            {recordedAudioUrl && (
                                <div style={{ width: '100%' }}>
                                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '6px' }}>🎤 Giọng bạn đọc:</p>
                                    <audio
                                        src={recordedAudioUrl}
                                        controls
                                        style={{
                                            width: '100%',
                                            height: '36px',
                                            borderRadius: 'var(--radius-md)',
                                            outline: 'none',
                                            accentColor: 'var(--color-primary)',
                                            filter: 'invert(1) hue-rotate(180deg)',
                                            opacity: 0.85,
                                        }}
                                    />
                                </div>
                            )}

                            {/* Score Breakdown */}
                            {evalResult.score && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%', marginTop: '4px' }}>
                                    {[{ key: 'individualSounds', label: 'Âm riêng lẻ', icon: '🔊', max: evalResult.evaluationType === 'single_syllable' ? 100 : 50 },
                                    { key: 'wordStress', label: 'Nhấn âm', icon: '🎯', max: 50 }]
                                        .filter(c => evalResult.score[c.key] !== undefined)
                                        .map(({ key, label, icon, max }) => {
                                            const val = evalResult.score[key] ?? 0;
                                            const pct = Math.round((val / max) * 100);
                                            const barColor = pct >= 80 ? 'var(--color-success)' : pct >= 50 ? 'var(--color-warning)' : 'var(--color-error)';
                                            const fb = evalResult.feedback?.[key];
                                            return (
                                                <div key={key} className="pron-detail-box" style={{ padding: '10px 12px' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                                        <span style={{ fontWeight: 600, fontSize: '0.8rem', color: 'var(--text-primary)' }}>{icon} {label}</span>
                                                        <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '0.85rem', color: barColor }}>{val}/{max}</span>
                                                    </div>
                                                    <div className="pron-progress-track">
                                                        <div style={{ height: '100%', width: `${pct}%`, background: barColor, borderRadius: '9999px', transition: 'width 0.6s ease' }} />
                                                    </div>
                                                    {fb && <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.4, textAlign: 'left', margin: 0 }}>{fb}</p>}
                                                </div>
                                            );
                                        })}
                                </div>
                            )}

                            {/* General Comment */}
                            {evalResult.feedback?.generalComment && (
                                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textAlign: 'left', lineHeight: 1.5, margin: 0 }}>
                                    💡 {evalResult.feedback.generalComment}
                                </p>
                            )}

                            {/* Problem Words Tips */}
                            {evalResult.problemWords && evalResult.problemWords.length > 0 && (
                                <div style={{ width: '100%', marginTop: '4px' }}>
                                    {evalResult.problemWords.map((pw, i) => (
                                        <div key={i} style={{ background: 'rgba(255,100,100,0.1)', borderRadius: 'var(--radius-sm)', padding: '8px 10px', marginBottom: '4px' }}>
                                            <span style={{ fontWeight: 700, color: 'var(--color-error)' }}>{pw.word}</span>
                                            {pw.errorPart && <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}> ({pw.errorPart})</span>}
                                            {pw.ipa && <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}> {pw.ipa}</span>}
                                            {pw.tip && <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '4px 0 0', lineHeight: 1.4 }}>💬 {pw.tip}</p>}
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Fallback: legacy advice field */}
                            {!evalResult.feedback?.generalComment && evalResult.advice && (
                                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textAlign: 'left', lineHeight: 1.5, margin: 0 }}>
                                    💡 {evalResult.advice}
                                </p>
                            )}

                        </div>
                        <div className="learn-result-actions" style={{ marginTop: 'var(--space-md)' }}>
                            {canRetry && !isReview && (
                                <button className="btn btn-secondary" onClick={() => setStatus('idle')}>
                                    🔄 Đọc lại ({triesLeft})
                                </button>
                            )}
                            {!isReview && (
                                <button className="btn btn-primary" onClick={handleNext}>
                                    {isGood ? 'Tiếp tục →' : 'Bỏ qua →'}
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div >
    );
}
