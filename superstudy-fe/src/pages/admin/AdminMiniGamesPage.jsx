import { useState, useEffect } from 'react';
import { Gamepad2, Eye, Check, X, ToggleLeft, ToggleRight, Search, AlertTriangle, Trash2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { approveGame, deleteMiniGame, getAllMiniGames, rejectGame, toggleMiniGame } from '../../services/miniGameService';
import { buildMiniGameMockPayload, getMiniGameDefaultSource, getMiniGameLaunchUrl } from '../../services/miniGameRuntime';
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
    const [previewPayload, setPreviewPayload] = useState(null);
    const [previewConfigGame, setPreviewConfigGame] = useState(null);
    const [previewSource, setPreviewSource] = useState('vocabulary');
    const [searchQuery, setSearchQuery] = useState('');
    const [processing, setProcessing] = useState(false);
    const [confirmApprove, setConfirmApprove] = useState(null);
    const [confirmDelete, setConfirmDelete] = useState(null);
    const [toast, setToast] = useState(null);

    useEffect(() => {
        setLoading(true);
        getAllMiniGames().then(setGames).catch(console.error).finally(() => setLoading(false));
    }, []);

    useEffect(() => {
        if (!toast) return;
        const timeoutId = window.setTimeout(() => setToast(null), 4000);
        return () => window.clearTimeout(timeoutId);
    }, [toast]);

    const showToast = (message, type = 'error') => {
        setToast({ message, type });
    };

    const refreshGames = () => {
        getAllMiniGames().then(setGames).catch(console.error);
    };

    const filteredGames = games.filter(game => {
        if (activeTab !== 'all' && game.status !== activeTab) return false;
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return (game.name || '').toLowerCase().includes(q) || (game.description || '').toLowerCase().includes(q) || (game.createdByName || '').toLowerCase().includes(q);
    });

    const counts = {
        all: games.length,
        pending_review: games.filter(game => game.status === 'pending_review').length,
        approved: games.filter(game => game.status === 'approved').length,
        rejected: games.filter(game => game.status === 'rejected').length,
    };

    const handleApprove = async () => {
        if (!confirmApprove) return;
        setProcessing(true);
        try {
            await approveGame(confirmApprove.id, user.uid);
            showToast(`Đã duyệt game "${confirmApprove.name}".`, 'success');
            setConfirmApprove(null);
            setReviewGame(null);
            refreshGames();
        } catch (error) {
            console.error('Error approving game:', error);
            showToast('Lỗi khi duyệt game.', 'error');
        } finally {
            setProcessing(false);
        }
    };

    const handleReject = async (game) => {
        if (!rejectNote.trim()) {
            showToast('Vui lòng nhập lý do từ chối để IT biết cần sửa gì.', 'error');
            return;
        }
        setProcessing(true);
        try {
            await rejectGame(game.id, user.uid, rejectNote.trim());
            setReviewGame(null);
            setRejectNote('');
            showToast(`Đã từ chối game "${game.name}".`, 'success');
            refreshGames();
        } catch (error) {
            console.error('Error rejecting game:', error);
            showToast('Lỗi khi từ chối game.', 'error');
        } finally {
            setProcessing(false);
        }
    };

    const handleToggle = async (game) => {
        try {
            await toggleMiniGame(game.id, !game.isActive);
            showToast(game.isActive ? `Đã tắt game "${game.name}".` : `Đã bật game "${game.name}".`, 'success');
            refreshGames();
        } catch (error) {
            console.error('Error toggling game:', error);
            showToast('Lỗi khi thay đổi trạng thái game.', 'error');
        }
    };

    const handleDelete = async () => {
        if (!confirmDelete) return;
        setProcessing(true);
        try {
            await deleteMiniGame(confirmDelete.id);
            if (reviewGame?.id === confirmDelete.id) {
                setReviewGame(null);
                setRejectNote('');
            }
            if (previewGame?.id === confirmDelete.id) {
                setPreviewGame(null);
                setPreviewPayload(null);
            }
            if (previewConfigGame?.id === confirmDelete.id) {
                setPreviewConfigGame(null);
            }
            if (confirmApprove?.id === confirmDelete.id) {
                setConfirmApprove(null);
            }
            showToast(`Đã xóa game "${confirmDelete.name}".`, 'success');
            setConfirmDelete(null);
            refreshGames();
        } catch (error) {
            console.error('Error deleting game:', error);
            showToast('Lỗi khi xóa game.', 'error');
        } finally {
            setProcessing(false);
        }
    };

    const openPreview = (game) => {
        if (game.dataType === 'both') {
            setPreviewConfigGame(game);
            setPreviewSource(getMiniGameDefaultSource(game));
            return;
        }

        setPreviewGame(game);
        setPreviewPayload(buildMiniGameMockPayload(game, getMiniGameDefaultSource(game)));
    };

    const launchConfiguredPreview = () => {
        if (!previewConfigGame) return;
        setPreviewGame(previewConfigGame);
        setPreviewPayload(buildMiniGameMockPayload(previewConfigGame, previewSource));
        setPreviewConfigGame(null);
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
            {toast && (
                <div
                    style={{
                        position: 'fixed',
                        top: '20px',
                        right: '20px',
                        zIndex: 10001,
                        minWidth: '280px',
                        maxWidth: '420px',
                        padding: '14px 16px',
                        borderRadius: '16px',
                        border: `1px solid ${toast.type === 'error' ? '#fecaca' : '#bbf7d0'}`,
                        background: toast.type === 'error' ? '#fef2f2' : '#ecfdf5',
                        color: toast.type === 'error' ? '#991b1b' : '#166534',
                        boxShadow: '0 18px 40px rgba(15, 23, 42, 0.16)',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '10px'
                    }}
                >
                    <span style={{ fontSize: '1.1rem', lineHeight: 1.4 }}>
                        {toast.type === 'error' ? '⚠️' : '✅'}
                    </span>
                    <div style={{ flex: 1, fontSize: '0.9rem', fontWeight: 600, lineHeight: 1.45 }}>
                        {toast.message}
                    </div>
                    <button
                        type="button"
                        onClick={() => setToast(null)}
                        style={{ background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer', padding: '2px' }}
                    >
                        <X size={16} />
                    </button>
                </div>
            )}

            <h1 className="admin-page-title" style={{ marginBottom: '4px', textAlign: 'center' }}>🎮 Mini Games</h1>
            <p className="admin-page-subtitle" style={{ textAlign: 'center' }}>Xem xét, duyệt và quản lý Mini Games từ bộ phận IT</p>

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

            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
                <div style={{ position: 'relative', maxWidth: '400px', flex: '1 1 300px' }}>
                    <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                    <input id="admin-mini-games-search" name="adminMiniGamesSearch" type="text" placeholder="Tìm game..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} style={{ width: '100%', padding: '10px 12px 10px 36px', border: '1.5px solid #e2e8f0', borderRadius: '12px', fontSize: '0.88rem', outline: 'none' }} />
                </div>
            </div>

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

                                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                    {getMiniGameLaunchUrl(game) && (
                                        <button className="it-game-btn secondary" onClick={() => openPreview(game)} style={{ padding: '6px 12px', fontSize: '0.78rem', flex: 'none' }}>
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
                                    <button className="it-game-btn danger" onClick={() => setConfirmDelete(game)} style={{ padding: '6px 12px', fontSize: '0.78rem', flex: 'none' }}>
                                        <Trash2 size={14} /> Xóa
                                    </button>
                                </div>

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

                        {getMiniGameLaunchUrl(reviewGame) && (
                            <div style={{ marginBottom: '16px' }}>
                                <button className="it-game-btn primary" onClick={() => openPreview(reviewGame)} style={{ width: '100%', padding: '10px', borderRadius: '12px' }}>
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
                            <button className="it-game-btn primary" onClick={() => setConfirmApprove(reviewGame)} disabled={processing} style={{ padding: '10px 24px', background: 'linear-gradient(135deg, #16a34a, #22c55e)' }}>
                                <Check size={16} /> Duyệt
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {confirmApprove && (
                <div className="teacher-modal-overlay" onClick={() => !processing && setConfirmApprove(null)}>
                    <div className="teacher-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '420px', width: '95%', textAlign: 'center' }}>
                        <div style={{
                            width: '64px',
                            height: '64px',
                            margin: '0 auto 14px',
                            borderRadius: '18px',
                            background: '#ecfdf5',
                            color: '#16a34a',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            <AlertTriangle size={28} />
                        </div>
                        <h3 style={{ fontSize: '1.12rem', fontWeight: 700, color: '#1e293b', marginBottom: '8px' }}>Duyệt game này?</h3>
                        <p style={{ fontSize: '0.88rem', color: '#64748b', marginBottom: '20px', lineHeight: 1.55 }}>
                            Duyệt game "<strong>{confirmApprove.name}</strong>" để giáo viên có thể nhìn thấy và sử dụng trong mục Mini Games.
                        </p>
                        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                            <button className="it-game-btn secondary" onClick={() => setConfirmApprove(null)} disabled={processing} style={{ padding: '10px 20px' }}>Hủy</button>
                            <button className="it-game-btn primary" onClick={handleApprove} disabled={processing} style={{ padding: '10px 20px', background: 'linear-gradient(135deg, #16a34a, #22c55e)' }}>
                                <Check size={15} /> {processing ? 'Đang duyệt...' : 'Xác nhận duyệt'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {confirmDelete && (
                <div className="teacher-modal-overlay" onClick={() => !processing && setConfirmDelete(null)}>
                    <div className="teacher-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '420px', width: '95%', textAlign: 'center' }}>
                        <div style={{
                            width: '64px',
                            height: '64px',
                            margin: '0 auto 14px',
                            borderRadius: '18px',
                            background: '#fef2f2',
                            color: '#dc2626',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            <Trash2 size={28} />
                        </div>
                        <h3 style={{ fontSize: '1.12rem', fontWeight: 700, color: '#1e293b', marginBottom: '8px' }}>Xóa game này?</h3>
                        <p style={{ fontSize: '0.88rem', color: '#64748b', marginBottom: '20px', lineHeight: 1.55 }}>
                            Game "<strong>{confirmDelete.name}</strong>" sẽ bị xóa khỏi hệ thống mini game. Hành động này không thể hoàn tác.
                        </p>
                        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                            <button className="it-game-btn secondary" onClick={() => setConfirmDelete(null)} disabled={processing} style={{ padding: '10px 20px' }}>Hủy</button>
                            <button className="it-game-btn danger" onClick={handleDelete} disabled={processing} style={{ padding: '10px 20px' }}>
                                <Trash2 size={15} /> {processing ? 'Đang xóa...' : 'Xác nhận xóa'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {previewConfigGame && (
                <div className="teacher-modal-overlay" onClick={() => setPreviewConfigGame(null)}>
                    <div className="teacher-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '420px', width: '95%' }}>
                        <div className="teacher-modal-header">
                            <h3 className="teacher-modal-title"><Eye size={20} color="#4f46e5" /> Preview: {previewConfigGame.name}</h3>
                            <button className="teacher-modal-close" onClick={() => setPreviewConfigGame(null)}><X size={18} /></button>
                        </div>
                        <p style={{ fontSize: '0.88rem', color: '#64748b', marginBottom: '12px' }}>
                            Game này hỗ trợ cả vocab và grammar. Chọn nguồn mock data để preview:
                        </p>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '18px' }}>
                            <button type="button" onClick={() => setPreviewSource('vocabulary')} style={{ padding: '10px 12px', borderRadius: '12px', border: `1.5px solid ${previewSource === 'vocabulary' ? '#4f46e5' : '#e2e8f0'}`, background: previewSource === 'vocabulary' ? '#eef2ff' : '#fff', color: previewSource === 'vocabulary' ? '#4338ca' : '#475569', fontWeight: 700, cursor: 'pointer' }}>
                                📚 Vocab
                            </button>
                            <button type="button" onClick={() => setPreviewSource('grammar')} style={{ padding: '10px 12px', borderRadius: '12px', border: `1.5px solid ${previewSource === 'grammar' ? '#4f46e5' : '#e2e8f0'}`, background: previewSource === 'grammar' ? '#eef2ff' : '#fff', color: previewSource === 'grammar' ? '#4338ca' : '#475569', fontWeight: 700, cursor: 'pointer' }}>
                                📝 Grammar
                            </button>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                            <button className="it-game-btn secondary" onClick={() => setPreviewConfigGame(null)} style={{ padding: '10px 18px' }}>Hủy</button>
                            <button className="it-game-btn primary" onClick={launchConfiguredPreview} style={{ padding: '10px 18px' }}>
                                <Eye size={15} /> Mở preview
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {previewGame && previewPayload && (
                <GameLauncher
                    gameUrl={getMiniGameLaunchUrl(previewGame)}
                    gameName={`[Review] ${previewGame.name}`}
                    gameData={previewPayload}
                    onClose={() => {
                        setPreviewGame(null);
                        setPreviewPayload(null);
                    }}
                />
            )}
        </div>
    );
}
