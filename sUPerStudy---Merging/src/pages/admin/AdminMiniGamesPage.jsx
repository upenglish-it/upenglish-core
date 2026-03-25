import { useState, useEffect } from 'react';
import { Gamepad2, Eye, Check, X, Clock, ToggleLeft, ToggleRight, Search } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getAllMiniGames, getPendingGames, approveGame, rejectGame, toggleMiniGame } from '../../services/miniGameService';
import GameLauncher from '../../components/games/GameLauncher';

const STATUS_LABELS = {
    draft: 'Nháp',
    pending_review: 'Chờ duyệt',
    approved: 'Đã duyệt',
    rejected: 'Bị từ chối'
};

const DATA_TYPE_LABELS = {
    vocabulary: '📚 Từ vựng',
    grammar: '📝 Ngữ pháp',
    both: '📚📝 Cả hai'
};

export default function AdminMiniGamesPage() {
    const { user } = useAuth();
    const [games, setGames] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('pending_review');
    const [reviewGame, setReviewGame] = useState(null);
    const [rejectNote, setRejectNote] = useState('');
    const [previewGame, setPreviewGame] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [processing, setProcessing] = useState(false);

    useEffect(() => {
        setLoading(true);
        getAllMiniGames().then(setGames).catch(console.error).finally(() => setLoading(false));
    }, []);

    const refreshGames = () => {
        getAllMiniGames().then(setGames).catch(console.error);
    };

    const filteredGames = games.filter(g => {
        if (activeTab !== 'all' && g.status !== activeTab) return false;
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            return (g.name || '').toLowerCase().includes(q) || (g.description || '').toLowerCase().includes(q) || (g.createdByName || '').toLowerCase().includes(q);
        }
        return true;
    });

    const counts = {
        all: games.length,
        pending_review: games.filter(g => g.status === 'pending_review').length,
        approved: games.filter(g => g.status === 'approved').length,
        rejected: games.filter(g => g.status === 'rejected').length,
    };

    const handleApprove = async (game) => {
        if (!window.confirm(`Duyệt game "${game.name}"? Game sẽ hiển thị cho giáo viên sử dụng.`)) return;
        setProcessing(true);
        try {
            await approveGame(game.id, user.uid);
            setReviewGame(null);
            refreshGames();
        } catch (error) {
            console.error('Error approving game:', error);
            alert('Lỗi khi duyệt game.');
        } finally {
            setProcessing(false);
        }
    };

    const handleReject = async (game) => {
        if (!rejectNote.trim()) {
            alert('Vui lòng nhập lý do từ chối để IT biết cần sửa gì.');
            return;
        }
        setProcessing(true);
        try {
            await rejectGame(game.id, user.uid, rejectNote.trim());
            setReviewGame(null);
            setRejectNote('');
            refreshGames();
        } catch (error) {
            console.error('Error rejecting game:', error);
            alert('Lỗi khi từ chối game.');
        } finally {
            setProcessing(false);
        }
    };

    const handleToggle = async (game) => {
        try {
            await toggleMiniGame(game.id, !game.isActive);
            refreshGames();
        } catch (error) {
            console.error('Error toggling game:', error);
        }
    };

    const formatDate = (ts) => {
        if (!ts) return '—';
        const d = ts.toDate ? ts.toDate() : new Date(ts);
        return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    };

    if (loading) {
        return (
            <div style={{ padding: '40px', textAlign: 'center' }}>
                <div className="spinner" style={{ width: 36, height: 36, borderWidth: 3, margin: '0 auto' }}></div>
            </div>
        );
    }

    return (
        <div>
            <h1 className="admin-page-title" style={{ marginBottom: '4px', textAlign: 'center' }}>🎮 Mini Games</h1>
            <p className="admin-page-subtitle" style={{ textAlign: 'center' }}>Xem xét, duyệt và quản lý Mini Games từ bộ phận IT</p>

            {/* Tabs */}
            <div className="admin-tabs-container" style={{ marginTop: '16px', marginBottom: '16px' }}>
                {[
                    { key: 'pending_review', label: '⏳ Chờ duyệt' },
                    { key: 'approved', label: '✅ Đã duyệt' },
                    { key: 'rejected', label: '❌ Đã từ chối' },
                    { key: 'all', label: 'Tất cả' }
                ].map(tab => (
                    <button key={tab.key} className={`admin-tab ${activeTab === tab.key ? 'active' : ''}`} onClick={() => setActiveTab(tab.key)}>
                        {tab.label} {counts[tab.key] > 0 && `(${counts[tab.key]})`}
                    </button>
                ))}
            </div>

            {/* Search */}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
                <div style={{ position: 'relative', maxWidth: '400px', flex: '1 1 300px' }}>
                    <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                    <input type="text" placeholder="Tìm game..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} style={{ width: '100%', padding: '10px 12px 10px 36px', border: '1.5px solid #e2e8f0', borderRadius: '12px', fontSize: '0.88rem', outline: 'none' }} />
                </div>
            </div>

            {/* Games grid */}
            {filteredGames.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '48px 20px', color: '#94a3b8' }}>
                    <div style={{ fontSize: '3rem', marginBottom: '12px' }}>🎮</div>
                    <h3 style={{ fontSize: '1.1rem', color: '#64748b', fontWeight: 600, marginBottom: '6px' }}>
                        {activeTab === 'pending_review' ? 'Không có game chờ duyệt' : 'Không có game nào'}
                    </h3>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
                    {filteredGames.map(game => (
                        <div key={game.id} style={{ background: '#fff', borderRadius: '16px', border: '1.5px solid #e2e8f0', overflow: 'hidden', transition: 'all 0.2s' }}>
                            <div style={{ width: '100%', height: '140px', background: 'linear-gradient(135deg, #e0e7ff, #c7d2fe)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '3rem' }}>
                                {game.thumbnail ? <img src={game.thumbnail} alt={game.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : '🎮'}
                            </div>
                            <div style={{ padding: '14px 16px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px', flexWrap: 'wrap', gap: '6px' }}>
                                    <span style={{ fontWeight: 700, fontSize: '1rem', color: '#1e293b' }}>{game.name}</span>
                                    <span className={`game-status-badge ${game.status}`}>{STATUS_LABELS[game.status]}</span>
                                </div>
                                {game.status === 'approved' && (
                                    <div style={{ fontSize: '0.72rem', fontWeight: 600, color: game.isActive ? '#16a34a' : '#94a3b8', marginBottom: '4px' }}>
                                        {game.isActive ? '🟢 Đang bật' : '⚪ Đã tắt'}
                                    </div>
                                )}
                                <p style={{ fontSize: '0.82rem', color: '#64748b', lineHeight: 1.45, marginBottom: '6px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{game.description}</p>
                                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', fontSize: '0.75rem', color: '#94a3b8', marginBottom: '10px' }}>
                                    <span>{DATA_TYPE_LABELS[game.dataType]}</span>
                                    <span>• IT: {game.createdByName || 'N/A'}</span>
                                </div>

                                {/* Actions */}
                                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                    {game.gameUrl && (
                                        <button className="it-game-btn secondary" onClick={() => setPreviewGame(game)} style={{ padding: '6px 12px', fontSize: '0.78rem', flex: 'none' }}>
                                            <Eye size={14} /> Xem
                                        </button>
                                    )}
                                    {game.status === 'pending_review' && (
                                        <button className="it-game-btn primary" onClick={() => { setReviewGame(game); setRejectNote(''); }} style={{ padding: '6px 12px', fontSize: '0.78rem', flex: 'none' }}>
                                            📋 Duyệt
                                        </button>
                                    )}
                                    {game.status === 'approved' && (
                                        <button className="it-game-btn secondary" onClick={() => handleToggle(game)} style={{ padding: '6px 12px', fontSize: '0.78rem', flex: 'none' }}>
                                            {game.isActive ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                                            {game.isActive ? 'Tắt' : 'Bật'}
                                        </button>
                                    )}
                                </div>

                                {/* Reject note */}
                                {game.status === 'rejected' && game.reviewNote && (
                                    <div style={{ marginTop: '8px', padding: '8px 10px', background: '#fef2f2', borderRadius: '8px', border: '1px solid #fecaca', fontSize: '0.78rem', color: '#991b1b' }}>
                                        <strong style={{ color: '#dc2626' }}>Từ chối:</strong> {game.reviewNote}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Review Modal */}
            {reviewGame && (
                <div className="teacher-modal-overlay" onClick={() => setReviewGame(null)}>
                    <div className="teacher-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px', width: '95%' }}>
                        <div className="teacher-modal-header">
                            <h3 className="teacher-modal-title"><Gamepad2 size={22} color="#4f46e5" /> Review: {reviewGame.name}</h3>
                            <button className="teacher-modal-close" onClick={() => setReviewGame(null)}><X size={20} /></button>
                        </div>

                        <div style={{ display: 'grid', gap: '12px', marginBottom: '16px' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                <div style={{ background: '#f8fafc', padding: '10px 14px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                                    <div style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 600 }}>Loại dữ liệu</div>
                                    <div style={{ fontSize: '0.9rem', color: '#1e293b', fontWeight: 600 }}>{DATA_TYPE_LABELS[reviewGame.dataType]}</div>
                                </div>
                                <div style={{ background: '#f8fafc', padding: '10px 14px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                                    <div style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 600 }}>IT Developer</div>
                                    <div style={{ fontSize: '0.9rem', color: '#1e293b', fontWeight: 600 }}>{reviewGame.createdByName || 'N/A'}</div>
                                </div>
                            </div>
                            {reviewGame.description && (
                                <div style={{ background: '#f8fafc', padding: '10px 14px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                                    <div style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 600, marginBottom: '3px' }}>Mô tả</div>
                                    <div style={{ fontSize: '0.88rem', color: '#334155', lineHeight: 1.5 }}>{reviewGame.description}</div>
                                </div>
                            )}
                        </div>

                        {reviewGame.gameUrl && (
                            <div style={{ marginBottom: '16px' }}>
                                <button className="it-game-btn primary" onClick={() => { setPreviewGame(reviewGame); }} style={{ width: '100%', padding: '10px', borderRadius: '12px' }}>
                                    <Eye size={16} /> Test thử game
                                </button>
                            </div>
                        )}

                        <div style={{ marginBottom: '16px' }}>
                            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>
                                Ghi chú (bắt buộc nếu từ chối)
                            </label>
                            <textarea value={rejectNote} onChange={e => setRejectNote(e.target.value)} placeholder="Ghi chú cho IT nếu cần sửa..." style={{ width: '100%', padding: '10px 14px', border: '1.5px solid #e2e8f0', borderRadius: '12px', fontSize: '0.88rem', minHeight: '80px', resize: 'vertical', outline: 'none', fontFamily: 'inherit' }} />
                        </div>

                        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                            <button className="it-game-btn danger" onClick={() => handleReject(reviewGame)} disabled={processing} style={{ padding: '10px 20px' }}>
                                <X size={16} /> Từ chối
                            </button>
                            <button className="it-game-btn primary" onClick={() => handleApprove(reviewGame)} disabled={processing} style={{ padding: '10px 24px', background: 'linear-gradient(135deg, #16a34a, #22c55e)' }}>
                                <Check size={16} /> Duyệt
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Game Preview */}
            {previewGame && (
                <GameLauncher
                    gameUrl={previewGame.gameUrl}
                    gameName={`[Review] ${previewGame.name}`}
                    gameData={{
                        dataType: 'vocabulary',
                        words: [
                            { word: 'apple', meaning: 'quả táo', phonetic: '/ˈæp.əl/', example: 'I eat an apple every day.' },
                            { word: 'book', meaning: 'quyển sách', phonetic: '/bʊk/', example: 'She reads a book.' },
                            { word: 'cat', meaning: 'con mèo', example: 'The cat is sleeping.' },
                            { word: 'desk', meaning: 'bàn làm việc' },
                            { word: 'elephant', meaning: 'con voi', phonetic: '/ˈel.ɪ.fənt/' }
                        ]
                    }}
                    onClose={() => setPreviewGame(null)}
                />
            )}
        </div>
    );
}
