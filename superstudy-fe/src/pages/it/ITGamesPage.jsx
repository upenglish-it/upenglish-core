import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
    AlertTriangle,
    CheckCircle2,
    Clock3,
    Edit3,
    Eye,
    FileText,
    Gamepad2,
    Layers3,
    Plus,
    Search,
    Send,
    Trash2,
    Upload,
    X
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { createMiniGame, deleteMiniGame, getMyGames, submitForReview, updateMiniGame } from '../../services/miniGameService';
import {
    isMiniGameBundleFile,
    isMiniGameHtmlFile,
    isMiniGameThumbnailFile,
    uploadMiniGameBundleFile,
    uploadMiniGameHtmlFile,
    uploadMiniGameThumbnailFile
} from '../../services/miniGameBundleService';
import {
    buildMiniGameMockPayload,
    getMiniGameDefaultSource,
    getMiniGameDeliveryMode,
    getMiniGameLaunchUrl,
    getMiniGameMaxItems,
    getMiniGameMinItems
} from '../../services/miniGameRuntime';
import GameLauncher from '../../components/games/GameLauncher';

const DATA_TYPE_LABELS = {
    vocabulary: 'Từ vựng',
    grammar: 'Ngữ pháp',
    both: 'Cả hai'
};

const STATUS_LABELS = {
    draft: 'Nháp',
    pending_review: 'Chờ duyệt',
    approved: 'Đã duyệt',
    rejected: 'Bị từ chối'
};

const DELIVERY_MODE_LABELS = {
    single_html: 'HTML',
    dist_bundle: 'ZIP dist'
};

const TAB_CONFIG = [
    { key: 'all', label: 'Tất cả', icon: Layers3 },
    { key: 'draft', label: 'Nháp', icon: FileText },
    { key: 'pending_review', label: 'Chờ duyệt', icon: Clock3 },
    { key: 'approved', label: 'Đã duyệt', icon: CheckCircle2 },
    { key: 'rejected', label: 'Cần sửa', icon: AlertTriangle }
];

const EMPTY_STATE_COPY = {
    all: {
        title: 'Chưa có mini game nào',
        description: 'Tạo game đầu tiên, upload bản build và preview ngay trong hệ thống.'
    },
    draft: {
        title: 'Không có bản nháp nào',
        description: 'Mọi game đã được xử lý xong. Bạn có thể tạo một ý tưởng mới.'
    },
    pending_review: {
        title: 'Không có game nào đang chờ duyệt',
        description: 'Sau khi hoàn tất preview và kiểm tra data, hãy nộp game để admin duyệt.'
    },
    approved: {
        title: 'Chưa có game nào được duyệt',
        description: 'Bạn có thể bắt đầu từ bản nháp, gửi duyệt và theo dõi phản hồi tại đây.'
    },
    rejected: {
        title: 'Không có game nào cần sửa',
        description: 'Kho game đang sạch sẽ. Nếu có feedback mới, mục này sẽ hiện tại đây.'
    }
};

const INITIAL_FORM = {
    name: '',
    description: '',
    gameUrl: '',
    launchUrl: '',
    deliveryMode: 'single_html',
    dataType: 'vocabulary',
    thumbnail: '',
    minItems: '',
    maxItems: '',
    tags: '',
    entryPath: 'index.html',
    storagePrefix: '',
    bundleVersion: '',
    fileName: ''
};

function getMiniGameUploadErrorMessage(error) {
    const rawMessage = error?.message || 'Lỗi không xác định khi upload mini game.';

    if (error?.status === 413 || /too large|payload/i.test(rawMessage)) {
        return 'File game quá lớn cho server hiện tại. Hãy giảm kích thước bundle hoặc tăng giới hạn upload ở backend.';
    }

    if (error?.status === 401 || error?.status === 403) {
        return 'Server đang từ chối upload mini game. Hãy kiểm tra phiên đăng nhập và quyền truy cập rồi thử lại.';
    }

    return rawMessage;
}

function getToastIcon(type) {
    switch (type) {
        case 'success':
            return '✅';
        case 'error':
            return '⚠️';
        default:
            return 'ℹ️';
    }
}

function buildPersistedFileState(formState) {
    const deliveryMode = formState.deliveryMode || 'single_html';
    const launchUrl = formState.launchUrl || formState.gameUrl || '';

    return {
        deliveryMode,
        launchUrl,
        gameUrl: deliveryMode === 'dist_bundle' ? '' : launchUrl,
        entryPath: formState.entryPath || 'index.html',
        storagePrefix: formState.storagePrefix || '',
        bundleVersion: formState.bundleVersion || null,
        fileName: formState.fileName || ''
    };
}

function formatTimestamp(timestamp) {
    if (!timestamp) return 'Vừa cập nhật';

    const date = typeof timestamp?.toDate === 'function'
        ? timestamp.toDate()
        : timestamp?.seconds
            ? new Date(timestamp.seconds * 1000)
            : new Date(timestamp);

    if (Number.isNaN(date.getTime())) return 'Vừa cập nhật';

    return date.toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
}

function getItemRangeLabel(game) {
    const minItems = getMiniGameMinItems(game);
    const maxItems = getMiniGameMaxItems(game);

    if (minItems && maxItems) return `${minItems}-${maxItems} mục`;
    if (minItems) return `Từ ${minItems} mục`;
    if (maxItems) return `Tối đa ${maxItems} mục`;
    return null;
}

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
    const [previewPayload, setPreviewPayload] = useState(null);
    const [previewConfigGame, setPreviewConfigGame] = useState(null);
    const [previewSource, setPreviewSource] = useState('vocabulary');
    const [confirmDelete, setConfirmDelete] = useState(null);
    const [confirmSubmit, setConfirmSubmit] = useState(null);
    const [uploadFile, setUploadFile] = useState(null);
    const [thumbnailFile, setThumbnailFile] = useState(null);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [toast, setToast] = useState(null);
    const [thumbnailPreviewUrl, setThumbnailPreviewUrl] = useState('');
    const fileInputRef = useRef(null);
    const thumbnailInputRef = useRef(null);

    useEffect(() => {
        if (!user?.uid) return;
        setLoading(true);
        getMyGames(user.uid)
            .then(setGames)
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [user?.uid]);

    useEffect(() => {
        const timeoutId = toast ? window.setTimeout(() => setToast(null), 4000) : null;
        return () => {
            if (timeoutId) window.clearTimeout(timeoutId);
        };
    }, [toast]);

    useEffect(() => {
        if (!thumbnailFile) {
            setThumbnailPreviewUrl(form.thumbnail || '');
            return undefined;
        }

        const objectUrl = URL.createObjectURL(thumbnailFile);
        setThumbnailPreviewUrl(objectUrl);

        return () => {
            URL.revokeObjectURL(objectUrl);
        };
    }, [thumbnailFile, form.thumbnail]);

    const refreshGames = () => {
        if (!user?.uid) return;
        getMyGames(user.uid).then(setGames).catch(console.error);
    };

    const handleTabChange = (tab) => {
        setActiveTab(tab);
        setSearchParams(tab === 'all' ? {} : { tab });
    };

    const filteredGames = games.filter(game => {
        if (activeTab !== 'all' && game.status !== activeTab) return false;
        if (!searchQuery) return true;

        const query = searchQuery.toLowerCase();
        return (game.name || '').toLowerCase().includes(query) || (game.description || '').toLowerCase().includes(query);
    });

    const counts = {
        all: games.length,
        draft: games.filter(game => game.status === 'draft').length,
        pending_review: games.filter(game => game.status === 'pending_review').length,
        approved: games.filter(game => game.status === 'approved').length,
        rejected: games.filter(game => game.status === 'rejected').length
    };

    const resetFormState = () => {
        setUploadFile(null);
        setThumbnailFile(null);
        setUploadProgress(0);
        setIsDragging(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
        if (thumbnailInputRef.current) thumbnailInputRef.current.value = '';
    };

    const showToast = (message, type = 'info') => {
        setToast({ message, type });
    };

    const openCreateModal = () => {
        setEditingGame(null);
        setForm(INITIAL_FORM);
        resetFormState();
        setShowModal(true);
    };

    const openEditModal = (game) => {
        setEditingGame(game);
        setForm({
            name: game.name || '',
            description: game.description || '',
            gameUrl: game.gameUrl || '',
            launchUrl: getMiniGameLaunchUrl(game),
            deliveryMode: getMiniGameDeliveryMode(game),
            dataType: game.dataType || 'vocabulary',
            thumbnail: game.thumbnail || '',
            minItems: getMiniGameMinItems(game) ?? '',
            maxItems: getMiniGameMaxItems(game) ?? '',
            tags: (game.tags || []).join(', '),
            entryPath: game.entryPath || 'index.html',
            storagePrefix: game.storagePrefix || '',
            bundleVersion: game.bundleVersion || '',
            fileName: game.fileName || ''
        });
        resetFormState();
        setShowModal(true);
    };

    const handleIncomingUploadFile = (file) => {
        if (!file) return;

        if (isMiniGameHtmlFile(file) || isMiniGameBundleFile(file)) {
            setUploadFile(file);
            return;
        }

        showToast('Vui lòng chọn file `.html`, `.htm` hoặc `.zip` của thư mục dist.', 'error');
    };

    const handleIncomingThumbnailFile = (file) => {
        if (!file) return;

        if (isMiniGameThumbnailFile(file)) {
            setThumbnailFile(file);
            return;
        }

        showToast('Vui lòng chọn ảnh thumbnail dạng PNG, JPG, WEBP, GIF hoặc SVG.', 'error');
    };

    const uploadSelectedFile = async (file, gameId) => {
        if (isMiniGameBundleFile(file)) {
            return uploadMiniGameBundleFile(file, gameId, setUploadProgress);
        }

        if (isMiniGameHtmlFile(file)) {
            return uploadMiniGameHtmlFile(file, gameId, setUploadProgress);
        }

        throw new Error('Định dạng file không được hỗ trợ.');
    };

    const handleSave = async () => {
        if (!form.name.trim()) {
            showToast('Vui lòng nhập tên game.', 'error');
            return;
        }

        if (!uploadFile && !form.launchUrl && !form.gameUrl) {
            showToast('Vui lòng upload file `.html` hoặc `.zip` của dist game.', 'error');
            return;
        }

        setSaving(true);
        setUploadProgress(0);

        try {
            let gameId = editingGame?.id;

            const data = {
                name: form.name.trim(),
                description: form.description.trim(),
                dataType: form.dataType,
                thumbnail: form.thumbnail.trim(),
                minItems: form.minItems ? parseInt(form.minItems, 10) : null,
                maxItems: form.maxItems ? parseInt(form.maxItems, 10) : null,
                tags: form.tags ? form.tags.split(',').map(tag => tag.trim()).filter(Boolean) : []
            };

            if (!gameId) {
                const created = await createMiniGame({
                    ...data,
                    createdBy: user.uid,
                    createdByName: user.displayName || 'IT',
                    launchUrl: '',
                    gameUrl: ''
                });
                gameId = created.id;
            }

            const thumbnailUrl = thumbnailFile
                ? await uploadMiniGameThumbnailFile(thumbnailFile, gameId)
                : data.thumbnail;

            const fileData = uploadFile
                ? await uploadSelectedFile(uploadFile, gameId)
                : buildPersistedFileState(form);

            await updateMiniGame(gameId, {
                ...data,
                thumbnail: thumbnailUrl,
                ...fileData
            });

            refreshGames();
            setShowModal(false);
            showToast(editingGame ? 'Đã cập nhật game thành công.' : 'Đã tạo game thành công.', 'success');
        } catch (error) {
            console.error('Error saving game:', error);
            showToast(`Lỗi khi lưu game: ${getMiniGameUploadErrorMessage(error)}`, 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleSubmitReview = async (game) => {
        if (!getMiniGameLaunchUrl(game)) {
            showToast('Vui lòng thêm file game trước khi nộp duyệt.', 'error');
            return;
        }

        setConfirmSubmit(game);
    };

    const confirmSubmitReview = async () => {
        if (!confirmSubmit) return;

        try {
            await submitForReview(confirmSubmit.id, user.uid);
            setConfirmSubmit(null);
            refreshGames();
            showToast('Đã nộp game để Admin duyệt.', 'success');
        } catch (error) {
            console.error('Error submitting for review:', error);
            showToast('Lỗi khi nộp duyệt game.', 'error');
        }
    };

    const handleDelete = async (gameId) => {
        try {
            await deleteMiniGame(gameId);
            setConfirmDelete(null);
            refreshGames();
            showToast('Đã xóa game thành công.', 'success');
        } catch (error) {
            console.error('Error deleting game:', error);
            showToast('Lỗi khi xóa game.', 'error');
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

    const hasExistingUpload = Boolean(form.launchUrl || form.gameUrl);
    const effectiveUploadMode = uploadFile
        ? (isMiniGameBundleFile(uploadFile) ? 'dist_bundle' : 'single_html')
        : (form.deliveryMode || 'single_html');

    const currentEmptyState = EMPTY_STATE_COPY[activeTab] || EMPTY_STATE_COPY.all;
    const filteredSummary = filteredGames.length === games.length
        ? `${games.length} game trong thư viện`
        : `Đang hiển thị ${filteredGames.length}/${games.length} game`;

    if (loading) {
        return (
            <div className="it-page it-page-loading">
                <div className="spinner" style={{ width: 36, height: 36, borderWidth: 3 }}></div>
                <p className="it-loading-copy">Đang tải thư viện mini game...</p>
            </div>
        );
    }

    return (
        <div className="admin-page it-page">
            {toast && (
                <div className={`it-toast it-toast--${toast.type || 'info'}`}>
                    <span className="it-toast-icon">{getToastIcon(toast.type)}</span>
                    <div className="it-toast-message">{toast.message}</div>
                    <button type="button" className="it-toast-close" onClick={() => setToast(null)}>
                        <X size={16} />
                    </button>
                </div>
            )}

            <section className="it-hero-card">
                <div className="it-hero-content">
                    <span className="it-hero-kicker">Mini Game Studio</span>
                    <h1 className="it-hero-title">
                        <Gamepad2 size={26} />
                        Game của tôi
                    </h1>
                    <p className="it-hero-subtitle">
                        Tạo, cập nhật và nộp mini game theo một flow gọn: upload bản build, preview, rồi gửi admin duyệt.
                    </p>
                    <div className="it-hero-pills">
                        <span className="it-hero-pill subtle">{counts.draft} bản nháp</span>
                        <span className="it-hero-pill subtle">{counts.pending_review} chờ duyệt</span>
                        <span className="it-hero-pill subtle">{counts.approved} đã duyệt</span>
                        <span className="it-hero-pill subtle danger">{counts.rejected} cần sửa</span>
                    </div>
                </div>

                <div className="it-hero-actions">
                    <button className="it-game-btn primary" onClick={openCreateModal}>
                        <Plus size={18} />
                        Tạo game mới
                    </button>
                </div>
            </section>

            <section className="it-toolbar-shell">
                <div className="it-filter-tabs">
                    {TAB_CONFIG.map(({ key, label, icon: Icon }) => (
                        <button
                            key={key}
                            type="button"
                            className={`it-filter-tab ${activeTab === key ? 'active' : ''}`}
                            onClick={() => handleTabChange(key)}
                        >
                            <Icon size={15} />
                            <span>{label}</span>
                            <span className="it-filter-tab-count">{counts[key]}</span>
                        </button>
                    ))}
                </div>

                <div className="it-toolbar-row">
                    <div className="it-search-input-wrapper">
                        <Search size={16} />
                        <input
                            id="it-game-search"
                            name="it_game_search"
                            type="text"
                            placeholder="Tìm theo tên hoặc mô tả game..."
                            value={searchQuery}
                            onChange={event => setSearchQuery(event.target.value)}
                            className="it-search-input"
                        />
                    </div>

                    <div className="it-toolbar-meta">
                        <span className="it-results-copy">{filteredSummary}</span>
                    </div>
                </div>

                {activeTab === 'rejected' && counts.rejected > 0 && (
                    <div className="it-inline-note tone-danger">
                        Xem kỹ ghi chú từ admin trong từng card trước khi nộp lại, nhất là file build và data mock.
                    </div>
                )}
            </section>

            {filteredGames.length === 0 ? (
                <section className="it-empty-state it-empty-state-panel">
                    <div className="it-empty-state-icon">🎮</div>
                    <h3>{currentEmptyState.title}</h3>
                    <p>{currentEmptyState.description}</p>
                    <button className="it-game-btn primary" onClick={openCreateModal}>
                        <Plus size={18} />
                        Tạo game mới
                    </button>
                </section>
            ) : (
                <section className="it-games-grid">
                    {filteredGames.map(game => {
                        const itemRangeLabel = getItemRangeLabel(game);
                        const launchUrl = getMiniGameLaunchUrl(game);

                        return (
                            <article key={game.id} className={`it-game-card status-${game.status}`}>
                                <div className="it-game-card-thumb">
                                    {game.thumbnail ? (
                                        <img src={game.thumbnail} alt={game.name} />
                                    ) : (
                                        <div className="it-game-thumb-fallback">
                                            <Gamepad2 size={34} />
                                        </div>
                                    )}
                                </div>

                                <div className="it-game-card-body">
                                    <div className="it-game-card-header">
                                        <div className="it-game-card-heading">
                                            <h3 className="it-game-card-name">{game.name}</h3>
                                            <p className="it-game-card-date">Cập nhật {formatTimestamp(game.updatedAt || game.submittedAt || game.createdAt)}</p>
                                        </div>
                                        <span className={`game-status-badge ${game.status}`}>{STATUS_LABELS[game.status]}</span>
                                    </div>

                                    <p className="it-game-card-desc">{game.description || 'Chưa có mô tả cho game này.'}</p>

                                    <div className="it-game-card-meta">
                                        <span className="it-game-card-tag">{DATA_TYPE_LABELS[game.dataType] || game.dataType}</span>
                                        <span className="it-game-card-tag">{DELIVERY_MODE_LABELS[getMiniGameDeliveryMode(game)] || 'HTML'}</span>
                                        {itemRangeLabel && <span className="it-game-card-tag">{itemRangeLabel}</span>}
                                        {(game.tags || []).slice(0, 2).map(tag => (
                                            <span key={tag} className="it-game-card-tag">{tag}</span>
                                        ))}
                                    </div>

                                    <div className="it-game-card-actions">
                                        {launchUrl && (
                                            <button className="it-game-btn secondary compact" onClick={() => openPreview(game)}>
                                                <Eye size={14} />
                                                Preview
                                            </button>
                                        )}

                                        {(game.status === 'draft' || game.status === 'rejected') && (
                                            <>
                                                <button className="it-game-btn secondary compact" onClick={() => openEditModal(game)}>
                                                    <Edit3 size={14} />
                                                    Sửa
                                                </button>
                                                <button className="it-game-btn submit compact" onClick={() => handleSubmitReview(game)}>
                                                    <Send size={14} />
                                                    {game.status === 'rejected' ? 'Nộp lại' : 'Nộp duyệt'}
                                                </button>
                                            </>
                                        )}

                                        {game.status === 'draft' && (
                                            <button className="it-game-btn danger compact is-icon-only" onClick={() => setConfirmDelete(game)} title="Xóa game">
                                                <Trash2 size={14} />
                                            </button>
                                        )}
                                    </div>

                                    {game.status === 'rejected' && game.reviewNote && (
                                        <div className="it-game-reject-note">
                                            <strong>Ghi chú từ Admin</strong>
                                            {game.reviewNote}
                                        </div>
                                    )}
                                </div>
                            </article>
                        );
                    })}
                </section>
            )}

            {showModal && (
                <div className="it-modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="it-modal it-modal-wide" onClick={event => event.stopPropagation()}>
                        <div className="it-modal-header">
                            <h2 className="it-modal-title">
                                <Gamepad2 size={22} />
                                {editingGame ? 'Chỉnh sửa game' : 'Tạo game mới'}
                            </h2>
                            <button type="button" className="it-modal-close" onClick={() => setShowModal(false)}>
                                <X size={20} />
                            </button>
                        </div>

                        <div className="it-form-group">
                            <label className="it-form-label" htmlFor="it-game-name">Tên game *</label>
                            <input
                                id="it-game-name"
                                name="it_game_name"
                                className="it-form-input"
                                value={form.name}
                                onChange={event => setForm({ ...form, name: event.target.value })}
                                placeholder="VD: Word Match"
                            />
                        </div>

                        <div className="it-form-group">
                            <label className="it-form-label" htmlFor="it-game-description">Mô tả</label>
                            <textarea
                                id="it-game-description"
                                name="it_game_description"
                                className="it-form-textarea"
                                value={form.description}
                                onChange={event => setForm({ ...form, description: event.target.value })}
                                placeholder="Mô tả ngắn về luật chơi và trải nghiệm chính..."
                            />
                        </div>

                        <div className="it-form-group">
                            <label className="it-form-label" htmlFor="it-game-file-upload">File game (`.html` hoặc `.zip dist`) *</label>
                            <div
                                className={`it-upload-zone ${isDragging ? 'dragging' : ''} ${uploadFile || hasExistingUpload ? 'has-file' : ''}`}
                                onDragOver={event => {
                                    event.preventDefault();
                                    setIsDragging(true);
                                }}
                                onDragLeave={() => setIsDragging(false)}
                                onDrop={event => {
                                    event.preventDefault();
                                    setIsDragging(false);
                                    handleIncomingUploadFile(event.dataTransfer.files[0]);
                                }}
                                onClick={() => fileInputRef.current?.click()}
                            >
                                <input
                                    id="it-game-file-upload"
                                    name="it_game_file_upload"
                                    ref={fileInputRef}
                                    type="file"
                                    accept=".html,.htm,.zip"
                                    style={{ display: 'none' }}
                                    onChange={event => {
                                        handleIncomingUploadFile(event.target.files[0]);
                                        event.target.value = '';
                                    }}
                                />

                                {uploadFile ? (
                                    <div className="it-upload-selected">
                                        <FileText size={24} />
                                        <div>
                                            <div className="it-upload-file-name">{uploadFile.name}</div>
                                            <div className="it-upload-file-meta">
                                                {(uploadFile.size / 1024).toFixed(1)} KB - {isMiniGameBundleFile(uploadFile) ? 'ZIP dist bundle' : 'HTML đơn'}
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            className="it-modal-close ghost"
                                            onClick={event => {
                                                event.stopPropagation();
                                                setUploadFile(null);
                                            }}
                                        >
                                            <X size={18} />
                                        </button>
                                    </div>
                                ) : hasExistingUpload ? (
                                    <div className="it-upload-selected success">
                                        <CheckCircle2 size={24} />
                                        <div>
                                            <div className="it-upload-file-name">Đã upload {DELIVERY_MODE_LABELS[form.deliveryMode] || 'HTML'}</div>
                                            <div className="it-upload-file-meta">{form.fileName || 'Bấm để upload file mới thay thế'}</div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="it-upload-placeholder">
                                        <Upload size={28} />
                                        <div className="it-upload-placeholder-title">Kéo thả file HTML hoặc ZIP dist vào đây</div>
                                        <div className="it-upload-placeholder-copy">ZIP nên chứa `index.html` ở thư mục gốc của bản build.</div>
                                    </div>
                                )}
                            </div>

                            <div className="it-upload-hint">
                                Chế độ hiện tại: <strong>{DELIVERY_MODE_LABELS[effectiveUploadMode]}</strong>. Nếu game build bằng React/Vite, nhớ cấu hình `base: './'`.
                            </div>

                            {saving && uploadProgress > 0 && uploadProgress < 100 && (
                                <div className="it-upload-progress">
                                    <div className="it-upload-progress-bar" style={{ width: `${uploadProgress}%` }} />
                                    <span className="it-upload-progress-text">{uploadProgress}%</span>
                                </div>
                            )}
                        </div>

                        <div className="it-form-grid">
                            <div className="it-form-group">
                                <label className="it-form-label" htmlFor="it-game-data-type">Loại dữ liệu</label>
                                <select
                                    id="it-game-data-type"
                                    name="it_game_data_type"
                                    className="it-form-select"
                                    value={form.dataType}
                                    onChange={event => setForm({ ...form, dataType: event.target.value })}
                                >
                                    <option value="vocabulary">Từ vựng</option>
                                    <option value="grammar">Ngữ pháp</option>
                                    <option value="both">Cả hai</option>
                                </select>
                            </div>

                            <div className="it-form-group">
                                <label className="it-form-label" htmlFor="it-game-thumbnail-upload">Ảnh thumbnail</label>
                                <div
                                    className={`it-upload-zone ${thumbnailPreviewUrl ? 'has-file' : ''}`}
                                    onClick={() => thumbnailInputRef.current?.click()}
                                >
                                    <input
                                        id="it-game-thumbnail-upload"
                                        name="it_game_thumbnail_upload"
                                        ref={thumbnailInputRef}
                                        type="file"
                                        accept="image/png,image/jpeg,image/jpg,image/webp,image/gif,image/svg+xml,.png,.jpg,.jpeg,.webp,.gif,.svg"
                                        style={{ display: 'none' }}
                                        onChange={event => {
                                            handleIncomingThumbnailFile(event.target.files[0]);
                                            event.target.value = '';
                                        }}
                                    />

                                    {thumbnailPreviewUrl ? (
                                        <div className="it-upload-selected">
                                            <img
                                                src={thumbnailPreviewUrl}
                                                alt="Thumbnail preview"
                                                className="it-thumbnail-preview-image"
                                            />
                                            <div className="it-thumbnail-preview-copy">
                                                <div className="it-upload-file-name">
                                                    {thumbnailFile ? thumbnailFile.name : 'Thumbnail hiện tại'}
                                                </div>
                                                <div className="it-upload-file-meta">
                                                    {thumbnailFile
                                                        ? `${(thumbnailFile.size / 1024).toFixed(1)} KB - Ảnh mới sẽ được upload khi lưu`
                                                        : 'Bấm để chọn ảnh khác thay thế'}
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                className="it-modal-close ghost"
                                                onClick={event => {
                                                    event.stopPropagation();
                                                    if (thumbnailFile) {
                                                        setThumbnailFile(null);
                                                    } else {
                                                        setForm(prev => ({ ...prev, thumbnail: '' }));
                                                    }
                                                    if (thumbnailInputRef.current) thumbnailInputRef.current.value = '';
                                                }}
                                            >
                                                <X size={18} />
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="it-upload-placeholder">
                                            <Upload size={28} />
                                            <div className="it-upload-placeholder-title">Upload ảnh thumbnail trực tiếp</div>
                                            <div className="it-upload-placeholder-copy">Hỗ trợ PNG, JPG, WEBP, GIF hoặc SVG.</div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="it-form-grid">
                            <div className="it-form-group">
                                <label className="it-form-label" htmlFor="it-game-min-items">Số mục tối thiểu</label>
                                <input
                                    id="it-game-min-items"
                                    name="it_game_min_items"
                                    className="it-form-input"
                                    type="number"
                                    value={form.minItems}
                                    onChange={event => setForm({ ...form, minItems: event.target.value })}
                                    placeholder="VD: 4"
                                />
                            </div>
                            <div className="it-form-group">
                                <label className="it-form-label" htmlFor="it-game-max-items">Số mục tối đa</label>
                                <input
                                    id="it-game-max-items"
                                    name="it_game_max_items"
                                    className="it-form-input"
                                    type="number"
                                    value={form.maxItems}
                                    onChange={event => setForm({ ...form, maxItems: event.target.value })}
                                    placeholder="VD: 20"
                                />
                            </div>
                        </div>

                        <div className="it-form-group">
                            <label className="it-form-label" htmlFor="it-game-tags">Tags (phân cách bằng dấu phẩy)</label>
                            <input
                                id="it-game-tags"
                                name="it_game_tags"
                                className="it-form-input"
                                value={form.tags}
                                onChange={event => setForm({ ...form, tags: event.target.value })}
                                placeholder="matching, vocab, interactive"
                            />
                        </div>

                        <div className="it-modal-actions">
                            <button className="it-game-btn secondary" onClick={() => setShowModal(false)}>
                                Hủy
                            </button>
                            <button className="it-game-btn primary" onClick={handleSave} disabled={saving}>
                                {saving ? 'Đang lưu...' : (editingGame ? 'Cập nhật game' : 'Tạo game')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {previewConfigGame && (
                <div className="it-modal-overlay" onClick={() => setPreviewConfigGame(null)}>
                    <div className="it-modal it-modal-compact" onClick={event => event.stopPropagation()}>
                        <div className="it-modal-header">
                            <h3 className="it-modal-title">
                                <Eye size={20} />
                                Preview: {previewConfigGame.name}
                            </h3>
                            <button type="button" className="it-modal-close" onClick={() => setPreviewConfigGame(null)}>
                                <X size={18} />
                            </button>
                        </div>

                        <p className="it-modal-copy">
                            Game này hỗ trợ cả vocab và grammar. Chọn nguồn mock data trước khi mở preview.
                        </p>

                        <div className="it-choice-grid">
                            <button
                                type="button"
                                className={`it-choice-card ${previewSource === 'vocabulary' ? 'active' : ''}`}
                                onClick={() => setPreviewSource('vocabulary')}
                            >
                                <strong>Từ vựng</strong>
                                <span>Preview với bộ vocab mock</span>
                            </button>
                            <button
                                type="button"
                                className={`it-choice-card ${previewSource === 'grammar' ? 'active' : ''}`}
                                onClick={() => setPreviewSource('grammar')}
                            >
                                <strong>Ngữ pháp</strong>
                                <span>Preview với bộ grammar mock</span>
                            </button>
                        </div>

                        <div className="it-modal-actions">
                            <button className="it-game-btn secondary" onClick={() => setPreviewConfigGame(null)}>
                                Hủy
                            </button>
                            <button className="it-game-btn primary" onClick={launchConfiguredPreview}>
                                <Eye size={15} />
                                Mở preview
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {confirmDelete && (
                <div className="it-modal-overlay" onClick={() => setConfirmDelete(null)}>
                    <div className="it-modal it-modal-compact it-modal-centered" onClick={event => event.stopPropagation()}>
                        <div className="it-confirm-icon tone-danger">
                            <Trash2 size={28} />
                        </div>
                        <h3 className="it-confirm-title">Xóa game?</h3>
                        <p className="it-confirm-copy">
                            Bạn chắc chắn muốn xóa "<strong>{confirmDelete.name}</strong>"? Hành động này không thể hoàn tác.
                        </p>
                        <div className="it-modal-actions centered">
                            <button className="it-game-btn secondary" onClick={() => setConfirmDelete(null)}>
                                Hủy
                            </button>
                            <button className="it-game-btn danger" onClick={() => handleDelete(confirmDelete.id)}>
                                <Trash2 size={15} />
                                Xóa game
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {confirmSubmit && (
                <div className="it-modal-overlay" onClick={() => setConfirmSubmit(null)}>
                    <div className="it-modal it-modal-compact it-modal-centered" onClick={event => event.stopPropagation()}>
                        <div className="it-confirm-icon tone-primary">
                            <Send size={26} />
                        </div>
                        <h3 className="it-confirm-title">Nộp game để duyệt?</h3>
                        <p className="it-confirm-copy">
                            "<strong>{confirmSubmit.name}</strong>" sẽ chuyển sang trạng thái chờ admin duyệt. Nếu bị từ chối, bạn vẫn có thể quay lại sửa và nộp lại.
                        </p>
                        <div className="it-modal-actions centered">
                            <button className="it-game-btn secondary" onClick={() => setConfirmSubmit(null)}>
                                Hủy
                            </button>
                            <button className="it-game-btn primary" onClick={confirmSubmitReview}>
                                <Send size={15} />
                                Xác nhận nộp
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {previewGame && previewPayload && (
                <GameLauncher
                    gameUrl={getMiniGameLaunchUrl(previewGame)}
                    gameName={previewGame.name}
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
