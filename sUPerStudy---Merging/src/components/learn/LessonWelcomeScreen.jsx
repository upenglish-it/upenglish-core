import React from 'react';
import { Play, BookOpen, ArrowLeft } from 'lucide-react';

export default function LessonWelcomeScreen({
    topicName,
    description,
    itemCount,
    itemType = 'từ vựng',
    icon = '📚',
    color = 'var(--color-primary)',
    onStart,
    onBack
}) {
    return (
        <div className="learn-welcome-container animate-fade-in">
            <div className="learn-welcome-card glass-card">
                <div className="learn-welcome-hero">
                    <div className="learn-welcome-icon-glow" style={{ '--glow-color': color }}>
                        <div className="learn-welcome-icon-large">{icon}</div>
                    </div>
                </div>

                <div className="learn-welcome-content">
                    <h1 className="learn-welcome-title">{topicName}</h1>
                    <div className="learn-welcome-stats" style={{ gridTemplateColumns: '1fr', justifyItems: 'center' }}>
                        <div className="learn-welcome-stat">
                            <div className="stat-icon"><BookOpen size={20} /></div>
                            <div className="stat-info">
                                <span className="stat-value">{itemCount}</span>
                                <span className="stat-label">{itemType}</span>
                            </div>
                        </div>
                    </div>



                    <button
                        className="btn btn-primary learn-welcome-start-btn"
                        onClick={onStart}
                        style={{ background: color, color: '#1a1a1a' }}
                    >
                        <Play size={20} fill="#1a1a1a" /> Bắt đầu bài học
                    </button>

                    {onBack && (
                        <button
                            className="learn-welcome-back-btn"
                            onClick={onBack}
                        >
                            <ArrowLeft size={18} /> Quay lại
                        </button>
                    )}
                </div>
            </div>

            <style dangerouslySetInnerHTML={{
                __html: `
                .learn-welcome-container {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    padding: var(--space-md);
                    flex: 1;
                    width: 100%;
                }
                .learn-welcome-card {
                    width: 100%;
                    max-width: 500px;
                    border-radius: 32px;
                    padding: var(--space-2xl) var(--space-xl);
                    text-align: center;
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    position: relative;
                    overflow: hidden;
                    margin: auto;
                }
                .learn-welcome-hero {
                    margin-bottom: var(--space-xl);
                    display: flex;
                    justify-content: center;
                }
                .learn-welcome-icon-glow {
                    width: 100px;
                    height: 100px;
                    background: var(--bg-glass);
                    border-radius: 30px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    position: relative;
                    box-shadow: 0 10px 40px -10px var(--glow-color);
                    border: 1px solid rgba(255,255,255,0.1);
                    animation: float 3s ease-in-out infinite;
                }
                .learn-welcome-icon-large {
                    font-size: 3.5rem;
                }
                .learn-welcome-title {
                    font-family: var(--font-heading);
                    font-size: 2rem;
                    font-weight: 800;
                    margin-bottom: var(--space-sm);
                    color: var(--text-primary);
                }

                .learn-welcome-stats {
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    gap: var(--space-md);
                    margin-bottom: var(--space-2xl);
                }
                .learn-welcome-stat {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 8px;
                }
                .stat-icon {
                    width: 40px;
                    height: 40px;
                    background: rgba(255, 255, 255, 0.05);
                    border-radius: 12px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: var(--text-secondary);
                }
                .stat-info {
                    display: flex;
                    flex-direction: column;
                }
                .stat-value {
                    font-weight: 700;
                    font-size: 1.1rem;
                    color: var(--text-primary);
                }
                .stat-label {
                    font-size: 0.75rem;
                    color: var(--text-muted);
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                }

                .learn-welcome-start-btn {
                    width: 100%;
                    padding: 16px !important;
                    font-size: 1.2rem !important;
                    font-weight: 700 !important;
                    border-radius: 16px !important;
                    display: flex !important;
                    align-items: center !important;
                    justify-content: center !important;
                    gap: 12px !important;
                    box-shadow: 0 10px 20px -5px rgba(0,0,0,0.3);
                    transition: all 0.3s ease !important;
                    color: #1a1a1a !important;
                }
                .learn-welcome-start-btn:hover {
                    transform: translateY(-2px);
                    filter: brightness(1.1);
                    box-shadow: 0 15px 25px -5px rgba(0,0,0,0.4);
                }
                .learn-welcome-back-btn {
                    margin-top: var(--space-md);
                    width: 100%;
                    padding: 14px !important;
                    font-size: 1.05rem !important;
                    font-weight: 600 !important;
                    border-radius: 16px !important;
                    display: flex !important;
                    align-items: center !important;
                    justify-content: center !important;
                    gap: 10px !important;
                    background: rgba(255, 255, 255, 0.05);
                    border: 1px solid rgba(255, 255, 255, 0.08);
                    color: var(--text-secondary);
                    cursor: pointer;
                    transition: all 0.3s ease !important;
                }
                .learn-welcome-back-btn:hover {
                    background: rgba(255, 255, 255, 0.1);
                    color: var(--text-primary);
                    transform: translateY(-2px);
                }
                @keyframes float {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-10px); }
                }
                @media (max-width: 480px) {
                    .learn-welcome-container {
                        padding: 16px;
                        flex: 1;
                        justify-content: center;
                    }
                    .learn-welcome-card {
                        padding: 20px 16px;
                        max-height: 85vh;
                        overflow-y: auto;
                        border-radius: 20px;
                        width: 100%;
                        margin: auto;
                    }
                    .learn-welcome-hero {
                        margin-bottom: 12px;
                    }
                    .learn-welcome-icon-glow {
                        width: 64px;
                        height: 64px;
                        border-radius: 20px;
                    }
                    .learn-welcome-icon-large {
                        font-size: 2.2rem;
                    }
                    .learn-welcome-title {
                        font-size: 1.4rem;
                        margin-bottom: 6px;
                    }

                    .learn-welcome-stats {
                        margin-bottom: 16px;
                        gap: 8px;
                    }
                    .stat-icon {
                        width: 32px;
                        height: 32px;
                        border-radius: 8px;
                    }
                    .stat-value {
                        font-size: 0.95rem;
                    }
                    .stat-label {
                        font-size: 0.65rem;
                    }

                    .learn-welcome-start-btn {
                        padding: 12px !important;
                        font-size: 1.1rem !important;
                        border-radius: 12px !important;
                    }
                    .learn-welcome-back-btn {
                        padding: 10px !important;
                        font-size: 0.95rem !important;
                        margin-top: 12px;
                    }
                }
                /* Light theme overrides moved to src/themes/theme-light.css */
            ` }} />

        </div>
    );
}
