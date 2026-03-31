import { useState, useEffect, useRef, useCallback } from 'react';
import { X, RotateCcw, Maximize2, Minimize2 } from 'lucide-react';
import './GameLauncher.css';

export default function GameLauncher({ gameUrl, gameData, gameName, onClose, onComplete }) {
    const iframeRef = useRef(null);
    const [isFullscreen, setIsFullscreen] = useState(true);
    const [gameCompleted, setGameCompleted] = useState(false);
    const [completeSummary, setCompleteSummary] = useState(null);

    // Send data to the game iframe once it loads
    const sendDataToGame = useCallback(() => {
        if (iframeRef.current && gameData) {
            try {
                iframeRef.current.contentWindow.postMessage({
                    type: 'GAME_DATA',
                    ...gameData
                }, '*');
            } catch (e) {
                console.error('Error sending data to game:', e);
            }
        }
    }, [gameData]);

    useEffect(() => {
        const iframe = iframeRef.current;
        if (!iframe) return;

        const handleLoad = () => {
            // Small delay to let the game SDK initialize
            setTimeout(sendDataToGame, 200);
        };
        iframe.addEventListener('load', handleLoad);

        // Listen for messages from the game
        const handleMessage = (event) => {
            if (!event.data || typeof event.data !== 'object') return;

            if (event.data.type === 'GAME_COMPLETE') {
                setGameCompleted(true);
                setCompleteSummary(event.data.summary || null);
                onComplete?.(event.data.summary);
            }

            if (event.data.type === 'GAME_REQUEST_RELOAD') {
                sendDataToGame();
            }
        };
        window.addEventListener('message', handleMessage);

        return () => {
            iframe.removeEventListener('load', handleLoad);
            window.removeEventListener('message', handleMessage);
        };
    }, [gameUrl, sendDataToGame, onComplete]);

    const handleReplay = () => {
        setGameCompleted(false);
        setCompleteSummary(null);
        // Reload iframe
        if (iframeRef.current) {
            iframeRef.current.src = gameUrl;
        }
    };

    const toggleFullscreen = () => setIsFullscreen(prev => !prev);

    return (
        <div className={`game-launcher-overlay ${isFullscreen ? 'fullscreen' : ''}`}>
            <div className="game-launcher-header">
                <div className="game-launcher-title">
                    🎮 {gameName || 'Mini Game'}
                </div>
                <div className="game-launcher-actions">
                    <button className="game-launcher-btn" onClick={handleReplay} title="Chơi lại">
                        <RotateCcw size={18} />
                    </button>
                    <button className="game-launcher-btn" onClick={toggleFullscreen} title={isFullscreen ? 'Thu nhỏ' : 'Toàn màn hình'}>
                        {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                    </button>
                    <button className="game-launcher-btn close" onClick={onClose} title="Đóng">
                        <X size={18} />
                    </button>
                </div>
            </div>

            <div className="game-launcher-body">
                <iframe
                    ref={iframeRef}
                    src={gameUrl}
                    sandbox="allow-scripts allow-same-origin"
                    className="game-launcher-iframe"
                    title={gameName || 'Mini Game'}
                />

                {gameCompleted && (
                    <div className="game-launcher-complete-overlay">
                        <div className="game-launcher-complete-card">
                            <div className="game-complete-emoji">🎉</div>
                            <h3>Hoàn thành!</h3>
                            {completeSummary && (
                                <div className="game-complete-summary">
                                    {completeSummary.message && <p>{completeSummary.message}</p>}
                                    {completeSummary.correctAnswers !== undefined && completeSummary.totalQuestions && (
                                        <p className="game-complete-score">
                                            {completeSummary.correctAnswers}/{completeSummary.totalQuestions} câu đúng
                                        </p>
                                    )}
                                </div>
                            )}
                            <div className="game-complete-actions">
                                <button className="game-complete-btn replay" onClick={handleReplay}>
                                    <RotateCcw size={16} /> Chơi lại
                                </button>
                                <button className="game-complete-btn close" onClick={onClose}>
                                    Đóng
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
