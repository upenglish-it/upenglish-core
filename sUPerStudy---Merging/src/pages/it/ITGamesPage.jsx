import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Edit3, Trash2, Send, Eye, Gamepad2, X, Upload, FileText, CheckCircle2, Search } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getMyGames, createMiniGame, updateMiniGame, deleteMiniGame, submitForReview } from '../../services/miniGameService';
import { storage } from '../../config/firebase';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import GameLauncher from '../../components/games/GameLauncher';

const DATA_TYPE_LABELS = {
    vocabulary: '📚 Từ vựng',
    grammar: '📝 Ngữ pháp',
    both: '📚📝 Cả hai'
};

const STATUS_LABELS = {
    draft: 'Nháp',
    pending_review: 'Chờ duyệt',
    approved: 'Đã duyệt',
    rejected: 'Bị từ chối'
};

const INITIAL_FORM = {
    name: '',
    description: '',
    gameUrl: '',
    dataType: 'vocabulary',
    thumbnail: '',
    minWords: '',
    maxWords: '',
    tags: ''
};

export default function ITGamesPage() {
    const { user } = useAuth();
    const [searchParams, setSearchParams] = useSearchParams();
    const [games, setGames] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'all');
    const [showModal, setShowModal] = useState(false);
    const [editingGame, setEditingGame] = useState(null);
    const [form, setForm] = useState(INITIAL_FORM);
    const [saving, setSaving] = useState(false);
    const [previewGame, setPreviewGame] = useState(null);
    const [confirmDelete, setConfirmDelete] = useState(null);
    const [uploadFile, setUploadFile] = useState(null);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef(null);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        if (!user?.uid) return;
        setLoading(true);
        getMyGames(user.uid).then(setGames).catch(console.error).finally(() => setLoading(false));
    }, [user?.uid]);

    const refreshGames = () => {
        if (!user?.uid) return;
        getMyGames(user.uid).then(setGames).catch(console.error);
    };

    const handleTabChange = (tab) => {
        setActiveTab(tab);
        setSearchParams(tab === 'all' ? {} : { tab });
    };

    const filteredGames = games.filter(g => {
        if (activeTab !== 'all' && g.status !== activeTab) return false;
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            return (g.name || '').toLowerCase().includes(q) || (g.description || '').toLowerCase().includes(q);
        }
        return true;
    });

    const counts = {
        all: games.length,
        draft: games.filter(g => g.status === 'draft').length,
        pending_review: games.filter(g => g.status === 'pending_review').length,
        approved: games.filter(g => g.status === 'approved').length,
        rejected: games.filter(g => g.status === 'rejected').length,
    };

    // Modal handlers
    const openCreateModal = () => {
        setEditingGame(null);
        setForm(INITIAL_FORM);
        setUploadFile(null);
        setUploadProgress(0);
        setShowModal(true);
    };

    const openEditModal = (game) => {
        setEditingGame(game);
        setForm({
            name: game.name || '',
            description: game.description || '',
            gameUrl: game.gameUrl || '',
            dataType: game.dataType || 'vocabulary',
            thumbnail: game.thumbnail || '',
            minWords: game.minWords || '',
            maxWords: game.maxWords || '',
            tags: (game.tags || []).join(', ')
        });
        setUploadFile(null);
        setUploadProgress(0);
        setShowModal(true);
    };

    // Upload file to Firebase Storage
    const uploadGameFile = (file, gameId) => {
        return new Promise((resolve, reject) => {
            const storageRef = ref(storage, `mini-games/${gameId}/index.html`);
            const uploadTask = uploadBytesResumable(storageRef, file, {
                contentType: 'text/html'
            });

            uploadTask.on('state_changed',
                (snapshot) => {
                    const progress = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
                    setUploadProgress(progress);
                },
                (error) => {
                    console.error('Upload error:', error);
                    reject(error);
                },
                async () => {
                    try {
                        const url = await getDownloadURL(uploadTask.snapshot.ref);
                        resolve(url);
                    } catch (err) {
                        reject(err);
                    }
                }
            );
        });
    };

    const handleSave = async () => {
        if (!form.name.trim()) {
            alert('Vui lòng nhập tên game.');
            return;
        }
        if (!uploadFile && !form.gameUrl) {
            alert('Vui lòng upload file HTML game.');
            return;
        }
        setSaving(true);
        try {
            const data = {
                name: form.name.trim(),
                description: form.description.trim(),
                dataType: form.dataType,
                thumbnail: form.thumbnail.trim(),
                minWords: form.minWords ? parseInt(form.minWords) : null,
                maxWords: form.maxWords ? parseInt(form.maxWords) : null,
                tags: form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : []
            };

            let gameId;
            if (editingGame) {
                gameId = editingGame.id;
                // Upload new file if selected
                if (uploadFile) {
                    data.gameUrl = await uploadGameFile(uploadFile, gameId);
                    data.fileName = uploadFile.name;
                } else {
                    data.gameUrl = form.gameUrl;
                }
                await updateMiniGame(gameId, data);
            } else {
                data.createdBy = user.uid;
                data.createdByName = user.displayName || 'IT';
                // Create game first to get ID, then upload file
                const created = await createMiniGame({ ...data, gameUrl: '' });
                gameId = created.id;
                if (uploadFile) {
                    const downloadUrl = await uploadGameFile(uploadFile, gameId);
                    await updateMiniGame(gameId, { gameUrl: downloadUrl, fileName: uploadFile.name });
                }
            }
            refreshGames();
            setShowModal(false);
        } catch (error) {
            console.error('Error saving game:', error);
            alert('Lỗi khi lưu game: ' + error.message);
        } finally {
            setSaving(false);
        }
    };

    const handleSubmitReview = async (game) => {
        if (!game.gameUrl) {
            alert('Vui lòng thêm URL game trước khi nộp duyệt.');
            return;
        }
        if (!window.confirm(`Nộp "${game.name}" để Admin duyệt?`)) return;
        try {
            await submitForReview(game.id, user.uid);
            refreshGames();
        } catch (error) {
            console.error('Error submitting for review:', error);
            alert('Lỗi khi nộp duyệt.');
        }
    };

    const handleDelete = async (gameId) => {
        try {
            await deleteMiniGame(gameId);
            setConfirmDelete(null);
            refreshGames();
        } catch (error) {
            console.error('Error deleting game:', error);
            alert('Lỗi khi xóa game.');
        }
    };

    const handlePreview = (game) => {
        setPreviewGame(game);
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
            <h1 className="admin-page-title" style={{ marginBottom: '4px', textAlign: 'center' }}>🎮 Game của tôi</h1>
            <p className="admin-page-subtitle" style={{ textAlign: 'center' }}>Tạo, chỉnh sửa và nộp mini games để Admin duyệt</p>

            {/* Tabs */}
            <div className="admin-tabs-container" style={{ marginTop: '16px', marginBottom: '16px' }}>
                {[
                    { key: 'all', label: 'Tất cả' },
                    { key: 'draft', label: '📝 Nháp' },
                    { key: 'pending_review', label: '⏳ Chờ duyệt' },
                    { key: 'approved', label: '✅ Đã duyệt' },
                    { key: 'rejected', label: '❌ Bị từ chối' }
                ].map(tab => (
                    <button key={tab.key} className={`admin-tab ${activeTab === tab.key ? 'active' : ''}`} onClick={() => handleTabChange(tab.key)}>
                        {tab.label} {counts[tab.key] > 0 && `(${counts[tab.key]})`}
                    </button>
                ))}
            </div>

            {/* Search + Action bar */}
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
                <div style={{ position: 'relative', maxWidth: '400px', flex: '1 1 300px' }}>
                    <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                    <input type="text" placeholder="Tìm game..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} style={{ width: '100%', padding: '10px 12px 10px 36px', border: '1.5px solid #e2e8f0', borderRadius: '12px', fontSize: '0.88rem', outline: 'none' }} />
                </div>
                <button className="it-game-btn primary" style={{ padding: '10px 20px', borderRadius: '12px', flex: 'none' }} onClick={openCreateModal}>
                    <Plus size={18} /> Tạo game mới
                </button>
            </div>

            {/* Games grid */}
            {filteredGames.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '48px 20px', color: '#94a3b8' }}>
                    <div style={{ fontSize: '3rem', marginBottom: '12px' }}>🎮</div>
                    <h3 style={{ fontSize: '1.1rem', color: '#64748b', fontWeight: 600, marginBottom: '6px' }}>
                        {activeTab === 'all' ? 'Chưa có game nào' : `Không có game ${STATUS_LABELS[activeTab]?.toLowerCase() || ''}`}
                    </h3>
                    <p style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
                        {activeTab === 'all' ? 'Bấm "Tạo game mới" để bắt đầu!' : 'Chuyển tab khác để xem game.'}
                    </p>
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
                                <p style={{ fontSize: '0.82rem', color: '#64748b', lineHeight: 1.45, marginBottom: '6px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{game.description || 'Chưa có mô tả'}</p>
                                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', fontSize: '0.75rem', color: '#94a3b8', marginBottom: '10px' }}>
                                    <span>{DATA_TYPE_LABELS[game.dataType] || game.dataType}</span>
                                    {(game.tags || []).slice(0, 2).map(tag => (
                                        <span key={tag}>• {tag}</span>
                                    ))}
                                </div>

                                {/* Actions */}
                                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                    {game.gameUrl && (
                                        <button className="it-game-btn secondary" onClick={() => handlePreview(game)} style={{ padding: '6px 12px', fontSize: '0.78rem', flex: 'none' }}>
                                            <Eye size={14} /> Xem
                                        </button>
                                    )}
                                    {(game.status === 'draft' || game.status === 'rejected') && (
                                        <>
                                            <button className="it-game-btn secondary" onClick={() => openEditModal(game)} style={{ padding: '6px 12px', fontSize: '0.78rem', flex: 'none' }}>
                                                <Edit3 size={14} /> Sửa
                                            </button>
                                            <button className="it-game-btn submit" onClick={() => handleSubmitReview(game)} style={{ padding: '6px 12px', fontSize: '0.78rem', flex: 'none' }}>
                                                <Send size={14} /> {game.status === 'rejected' ? 'Nộp lại' : 'Nộp duyệt'}
                                            </button>
                                        </>
                                    )}
                                    {game.status === 'draft' && (
                                        <button className="it-game-btn danger" onClick={() => setConfirmDelete(game)} title="Xóa" style={{ padding: '6px 10px', flex: 'none' }}>
                                            <Trash2 size={14} />
                                        </button>
                                    )}
                                </div>

                                {/* Reject note */}
                                {game.status === 'rejected' && game.reviewNote && (
                                    <div style={{ marginTop: '8px', padding: '8px 10px', background: '#fef2f2', borderRadius: '8px', border: '1px solid #fecaca', fontSize: '0.78rem', color: '#991b1b' }}>
                                        <strong style={{ color: '#dc2626' }}>Ghi chú từ Admin:</strong> {game.reviewNote}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Create/Edit Modal */}
            {showModal && (
                <div className="it-modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="it-modal" onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                            <h2 className="it-modal-title" style={{ marginBottom: 0 }}>
                                <Gamepad2 size={22} color="#4f46e5" />
                                {editingGame ? 'Chỉnh sửa game' : 'Tạo game mới'}
                            </h2>
                            <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '4px' }}>
                                <X size={20} />
                            </button>
                        </div>

                        <div className="it-form-group">
                            <label className="it-form-label">Tên game *</label>
                            <input className="it-form-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="VD: Word Match" />
                        </div>

                        <div className="it-form-group">
                            <label className="it-form-label">Mô tả</label>
                            <textarea className="it-form-textarea" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Mô tả cách chơi..." />
                        </div>

                        <div className="it-form-group">
                            <label className="it-form-label">File game (HTML) *</label>
                            <div
                                className={`it-upload-zone ${isDragging ? 'dragging' : ''} ${uploadFile || form.gameUrl ? 'has-file' : ''}`}
                                onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                                onDragLeave={() => setIsDragging(false)}
                                onDrop={e => {
                                    e.preventDefault();
                                    setIsDragging(false);
                                    const file = e.dataTransfer.files[0];
                                    if (file && (file.name.endsWith('.html') || file.name.endsWith('.htm'))) {
                                        setUploadFile(file);
                                    } else {
                                        alert('Vui lòng chọn file .html');
                                    }
                                }}
                                onClick={() => fileInputRef.current?.click()}
                            >
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept=".html,.htm"
                                    style={{ display: 'none' }}
                                    onChange={e => {
                                        const file = e.target.files[0];
                                        if (file) setUploadFile(file);
                                    }}
                                />
                                {uploadFile ? (
                                    <div className="it-upload-selected">
                                        <FileText size={24} color="#4f46e5" />
                                        <div>
                                            <div style={{ fontWeight: 700, color: '#1e293b', fontSize: '0.9rem' }}>{uploadFile.name}</div>
                                            <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                                                {(uploadFile.size / 1024).toFixed(1)} KB — Sẵn sàng upload
                                            </div>
                                        </div>
                                        <button
                                            onClick={e => { e.stopPropagation(); setUploadFile(null); }}
                                            style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: '#94a3b8' }}
                                        >
                                            <X size={18} />
                                        </button>
                                    </div>
                                ) : form.gameUrl ? (
                                    <div className="it-upload-selected">
                                        <CheckCircle2 size={24} color="#22c55e" />
                                        <div>
                                            <div style={{ fontWeight: 700, color: '#16a34a', fontSize: '0.9rem' }}>Đã upload</div>
                                            <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                                                Bấm để upload file mới thay thế
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="it-upload-placeholder">
                                        <Upload size={28} color="#94a3b8" />
                                        <div style={{ fontSize: '0.9rem', color: '#475569', fontWeight: 600 }}>
                                            Kéo thả file HTML vào đây
                                        </div>
                                        <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                                            hoặc bấm để chọn file (.html)
                                        </div>
                                    </div>
                                )}
                            </div>
                            {saving && uploadProgress > 0 && uploadProgress < 100 && (
                                <div className="it-upload-progress">
                                    <div className="it-upload-progress-bar" style={{ width: `${uploadProgress}%` }} />
                                    <span className="it-upload-progress-text">{uploadProgress}%</span>
                                </div>
                            )}
                        </div>

                        <div className="it-form-group">
                            <label className="it-form-label">Loại dữ liệu</label>
                            <select className="it-form-select" value={form.dataType} onChange={e => setForm({ ...form, dataType: e.target.value })}>
                                <option value="vocabulary">Từ vựng</option>
                                <option value="grammar">Ngữ pháp</option>
                                <option value="both">Cả hai</option>
                            </select>
                        </div>

                        <div className="it-form-group">
                            <label className="it-form-label">URL ảnh thumbnail</label>
                            <input className="it-form-input" value={form.thumbnail} onChange={e => setForm({ ...form, thumbnail: e.target.value })} placeholder="https://..." />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                            <div className="it-form-group">
                                <label className="it-form-label">Số từ tối thiểu</label>
                                <input className="it-form-input" type="number" value={form.minWords} onChange={e => setForm({ ...form, minWords: e.target.value })} placeholder="VD: 4" />
                            </div>
                            <div className="it-form-group">
                                <label className="it-form-label">Số từ tối đa</label>
                                <input className="it-form-input" type="number" value={form.maxWords} onChange={e => setForm({ ...form, maxWords: e.target.value })} placeholder="VD: 20" />
                            </div>
                        </div>

                        <div className="it-form-group">
                            <label className="it-form-label">Tags (phân cách bằng dấu phẩy)</label>
                            <input className="it-form-input" value={form.tags} onChange={e => setForm({ ...form, tags: e.target.value })} placeholder="matching, vocabulary, interactive" />
                        </div>

                        <div className="it-modal-actions">
                            <button className="it-game-btn secondary" onClick={() => setShowModal(false)} style={{ padding: '10px 20px' }}>Hủy</button>
                            <button className="it-game-btn primary" onClick={handleSave} disabled={saving} style={{ padding: '10px 24px' }}>
                                {saving ? 'Đang lưu...' : (editingGame ? 'Cập nhật' : 'Tạo game')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation */}
            {confirmDelete && (
                <div className="it-modal-overlay" onClick={() => setConfirmDelete(null)}>
                    <div className="it-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px', textAlign: 'center' }}>
                        <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>🗑️</div>
                        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1e293b', marginBottom: '8px' }}>Xóa game?</h3>
                        <p style={{ fontSize: '0.88rem', color: '#64748b', marginBottom: '20px' }}>
                            Bạn có chắc muốn xóa "<strong>{confirmDelete.name}</strong>"? Hành động này không thể hoàn tác.
                        </p>
                        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                            <button className="it-game-btn secondary" onClick={() => setConfirmDelete(null)} style={{ padding: '10px 20px' }}>Hủy</button>
                            <button className="it-game-btn danger" onClick={() => handleDelete(confirmDelete.id)} style={{ padding: '10px 20px' }}>
                                <Trash2 size={15} /> Xóa
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Game Preview */}
            {previewGame && (
                <GameLauncher
                    gameUrl={previewGame.gameUrl}
                    gameName={previewGame.name}
                    gameData={{
                        dataType: 'vocabulary',
                        words: [
                            { word: 'apple', meaning: 'quả táo', phonetic: '/ˈæp.əl/' },
                            { word: 'banana', meaning: 'quả chuối', phonetic: '/bəˈnæn.ə/' },
                            { word: 'cat', meaning: 'con mèo', example: 'The cat is sleeping.' },
                            { word: 'dog', meaning: 'con chó', example: 'I have a dog.' },
                            { word: 'elephant', meaning: 'con voi' }
                        ]
                    }}
                    onClose={() => setPreviewGame(null)}
                />
            )}
        </div>
    );
}
