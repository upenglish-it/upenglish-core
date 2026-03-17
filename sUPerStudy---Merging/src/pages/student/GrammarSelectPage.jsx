import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Sparkles, Folder, PenLine, Loader, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getSharedAndPublicGrammarExercises } from '../../services/grammarService';
import { getGrammarFolders } from '../../services/adminService';
import logo from '../../assets/logo.png';
import BrandLogo from '../../components/common/BrandLogo';
import '../TopicSelectPage.css'; // Reusing the same grid CSS

export default function GrammarSelectPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const { user } = useAuth();

    const [exercises, setExercises] = useState([]);
    const [folders, setFolders] = useState([]);
    const [loading, setLoading] = useState(true);

    const [selectedFolderPopup, setSelectedFolderPopup] = useState(null);
    const [isFolderClosing, setIsFolderClosing] = useState(false);
    const [folderPopupOrigin, setFolderPopupOrigin] = useState({ x: 50, y: 50 });
    const [selectedExercise, setSelectedExercise] = useState(null);

    useEffect(() => {
        if (!user?.uid) return;

        const grammarAccess = user?.mergedGrammarAccess || user?.grammarAccess || [];

        Promise.all([
            getSharedAndPublicGrammarExercises(grammarAccess),
            getGrammarFolders()
        ])
            .then(([exercisesData, foldersData]) => {
                setExercises(exercisesData);

                // Filter folders by user access
                let visibleFolders = foldersData;
                if (user?.role !== 'admin') {
                    const folderAccess = user?.mergedFolderAccess || user?.folderAccess || [];
                    visibleFolders = foldersData.filter(f => {
                        if (f.isPublic) return true;
                        if (folderAccess.includes(f.id)) return true;

                        // Check if any exercise inside this folder is explicitly granted or public
                        const folderExercises = exercisesData.filter(t => (f.exerciseIds || []).includes(t.id));
                        return folderExercises.some(t => t.isPublic || grammarAccess.includes(t.id));
                    });
                }
                setFolders(visibleFolders);
                setLoading(false);
            })
            .catch(err => {
                console.error("Failed to load grammar data", err);
                setLoading(false);
            });
    }, [user?.uid]);

    useEffect(() => {
        if (!loading && location.state?.folderId && folders.length > 0) {
            const folder = folders.find(f => f.id === location.state.folderId);
            if (folder) {
                setSelectedFolderPopup(folder);
                setFolderPopupOrigin({ x: 50, y: 50 });
                // Clean state to avoid re-opening
                window.history.replaceState({}, document.title);
            }
        }
    }, [loading, location.state, folders]);

    function handleFolderClick(folder, event) {
        if (event) {
            const rect = event.currentTarget.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            const x = (centerX / window.innerWidth) * 100;
            const y = (centerY / window.innerHeight) * 100;
            setFolderPopupOrigin({ x, y });
        } else {
            setFolderPopupOrigin({ x: 50, y: 50 });
        }
        setSelectedFolderPopup(folder);
        setIsFolderClosing(false);
    }

    function handleCloseFolderPopup() {
        if (isFolderClosing) return;
        setIsFolderClosing(true);
        setTimeout(() => {
            setSelectedFolderPopup(null);
            setIsFolderClosing(false);
        }, 200); // Wait for the 0.2s animation to finish
    }

    function handleExerciseClick(exercise) {
        if (exercise.status === 'coming_soon') return;
        setSelectedExercise(exercise);
    }

    function confirmStartExercise() {
        if (!selectedExercise) return;
        const exercise = selectedExercise;
        setSelectedExercise(null);

        navigate('/grammar-learn', {
            state: {
                exerciseId: exercise.id,
                exerciseName: exercise.name,
                icon: exercise.icon || '📝',
                color: exercise.color || '#d97706',
                skipWelcome: true
            }
        });
    }

    // Compute unassigned exercises that the user is allowed to see
    const allAssignedIds = new Set(folders.flatMap(f => f.exerciseIds || []));
    let unassignedExercises = exercises.filter(t => !allAssignedIds.has(t.id));

    return (
        <div className="topic-page">
            <header className="dashboard-header">
                <div className="container flex-between" style={{ position: 'relative' }}>
                    <button className="btn btn-ghost" onClick={() => navigate('/')}>
                        <ArrowLeft size={20} />
                    </button>
                    <div className="dashboard-brand" style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)' }}>
                        <BrandLogo size="1.2rem" />
                    </div>
                    <div style={{ width: 44 }}></div>
                </div>
            </header>

            <main className="topic-main container">
                <div className="topic-title-section animate-slide-up">
                    <Sparkles size={24} className="text-warning" />
                    <h1>Bài học Kỹ năng</h1>
                    <p>Các bài học Kỹ năng được chia sẻ cho bạn</p>
                </div>

                {loading ? (
                    <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
                        <Loader size={32} className="spin" style={{ margin: '0 auto 16px' }} />
                        <p>Đang tải danh sách bài luyện...</p>
                    </div>
                ) : folders.length === 0 && unassignedExercises.length === 0 && user?.role !== 'admin' ? (
                    <div className="admin-empty-state glass-card" style={{ padding: '40px 20px', textAlign: 'center', marginTop: '20px' }}>
                        <Folder size={48} style={{ color: 'var(--text-muted)', margin: '0 auto 16px', opacity: 0.5 }} />
                        <h3 style={{ marginBottom: '8px' }}>Chưa có bài học nào</h3>
                        <p style={{ color: 'var(--text-secondary)' }}>Hiện tại chưa có bài học Kỹ năng nào được chia sẻ với bạn.</p>
                    </div>
                ) : (
                    <div className="folders-container" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                        {folders.length > 0 && (
                            <div className="topic-grid" style={{ marginBottom: unassignedExercises.length > 0 ? '24px' : '0' }}>
                                {folders.map(folder => {
                                    const folderExercises = exercises.filter(t => (folder.exerciseIds || []).includes(t.id));
                                    return (
                                        <button
                                            key={folder.id}
                                            className="folder-card"
                                            onClick={(e) => handleFolderClick(folder, e)}
                                        >
                                            <span className="topic-card-icon" style={{ background: '#fef9c3' }}>
                                                📁
                                            </span>
                                            <div className="topic-card-body">
                                                <h3 className="topic-card-name" style={{ color: 'var(--text-primary)' }}>{folder.name}</h3>
                                                <p className="topic-card-desc">{folder.description || `${folderExercises.length} bài học`}</p>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        )}

                        {unassignedExercises.length > 0 && (
                            <div className="folder-section">
                                <h2 style={{ fontSize: '1.2rem', margin: '0 0 16px 0', fontWeight: 700, color: 'var(--text-primary)' }}>
                                    {user?.role === 'admin' ? 'Chưa phân loại (Admin)' : 'Bài học khác'}
                                </h2>
                                <div className="topic-grid">
                                    {unassignedExercises.map((exercise, index) => {
                                        const isComingSoon = exercise.status === 'coming_soon';
                                        return (
                                            <button
                                                key={exercise.id}
                                                className={`topic-card glass-card ${isComingSoon ? 'is-coming-soon' : ''}`}
                                                onClick={() => handleExerciseClick(exercise)}
                                                style={{ animationDelay: `${index * 0.05}s` }}
                                                disabled={isComingSoon}
                                            >
                                                <span className="topic-card-icon" style={{ background: `${exercise.color || '#f59e0b'}20` }}>
                                                    {exercise.icon || <PenLine color={exercise.color || "#d97706"} />}
                                                </span>
                                                <div className="topic-card-body">
                                                    <h3 className="topic-card-name">{exercise.name}</h3>
                                                    <p className="topic-card-desc">{exercise.description || 'Luyện tập ngữ pháp'}</p>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </main>

            {/* ===== FOLDER POPUP MODAL ===== */}
            {selectedFolderPopup && (
                <div className={`topic-modal-backdrop folder-modal-backdrop ${isFolderClosing ? 'is-closing' : ''}`} onClick={handleCloseFolderPopup}>
                    <div
                        className={`folder-modal-panel ${isFolderClosing ? 'is-closing' : ''}`}
                        onClick={(e) => e.stopPropagation()}
                        style={{ transformOrigin: `${folderPopupOrigin.x}% ${folderPopupOrigin.y}%` }}
                    >
                        <div className="folder-modal-header">
                            <div className="folder-modal-title-group">
                                <span className="folder-modal-icon" style={{ background: '#fef9c3' }}>
                                    📁
                                </span>
                                <div className="folder-modal-title-text">
                                    <h2>{selectedFolderPopup.name}</h2>
                                    <p>{selectedFolderPopup.description}</p>
                                </div>
                            </div>
                            <button className="topic-modal-close" onClick={handleCloseFolderPopup}><X size={24} /></button>
                        </div>
                        <div className="folder-modal-body">
                            <div className="topic-grid">
                                {(() => {
                                    const folderExercises = exercises.filter(t => (selectedFolderPopup.exerciseIds || []).includes(t.id));
                                    let visibleFolderExercises = folderExercises;
                                    if (user?.role !== 'admin') {
                                        const folderAccess = user?.mergedFolderAccess || user?.folderAccess || [];
                                        const grammarAccess = user?.mergedGrammarAccess || user?.grammarAccess || [];
                                        if (!selectedFolderPopup.isPublic && !folderAccess.includes(selectedFolderPopup.id)) {
                                            visibleFolderExercises = folderExercises.filter(t => t.isPublic || grammarAccess.includes(t.id));
                                        }
                                    }
                                    return visibleFolderExercises.length > 0 ? (
                                        visibleFolderExercises.map((exercise, index) => {
                                            const isComingSoon = exercise.status === 'coming_soon';
                                            return (
                                                <button
                                                    key={exercise.id}
                                                    className={`topic-card glass-card ${isComingSoon ? 'is-coming-soon' : ''}`}
                                                    onClick={() => {
                                                        handleCloseFolderPopup();
                                                        setTimeout(() => handleExerciseClick(exercise), 300);
                                                    }}
                                                    style={{ animationDelay: `${index * 0.05}s` }}
                                                    disabled={isComingSoon}
                                                >
                                                    <span className="topic-card-icon" style={{ background: `${exercise.color || '#f59e0b'}20` }}>
                                                        {exercise.icon || <PenLine color={exercise.color || "#d97706"} />}
                                                    </span>
                                                    <div className="topic-card-body">
                                                        <h3 className="topic-card-name">{exercise.name}</h3>
                                                        <p className="topic-card-desc">{exercise.description || 'Luyện tập Kỹ năng'}</p>
                                                    </div>
                                                </button>
                                            );
                                        })
                                    ) : (
                                        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', gridColumn: '1 / -1', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-lg)' }}>
                                            Thư mục này chưa có bài học nào.
                                        </div>
                                    );
                                })()}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Start Confirmation Popup */}
            {selectedExercise && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    zIndex: 1100
                }} onClick={() => setSelectedExercise(null)}>
                    <div className="glass-card animate-slide-up" onClick={e => e.stopPropagation()} style={{
                        width: '90%', maxWidth: '340px', padding: '24px 20px', textAlign: 'center',
                        backgroundColor: 'var(--bg-primary)', borderRadius: '24px'
                    }}>
                        <div style={{ width: '56px', height: '56px', background: `${selectedExercise.color || '#d97706'}20`, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                            <span style={{ fontSize: '1.8rem' }}>{selectedExercise.icon || '✍️'}</span>
                        </div>
                        <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 14px' }}>{selectedExercise.name}</h2>

                        <div style={{ textAlign: 'left', marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', borderRadius: '10px', background: '#fffbeb' }}>
                                <span style={{ fontSize: '0.95rem' }}>✍️</span>
                                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1e293b' }}>Luyện kỹ năng</span>
                                {selectedExercise.cachedQuestionCount > 0 && (
                                    <span style={{ fontSize: '0.78rem', color: '#94a3b8', marginLeft: 'auto' }}>{selectedExercise.cachedQuestionCount} câu hỏi</span>
                                )}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', borderRadius: '10px', background: '#f0fdf4' }}>
                                <span style={{ fontSize: '0.95rem' }}>⏱️</span>
                                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1e293b' }}>Không giới hạn thời gian</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', borderRadius: '10px', background: '#f5f3ff' }}>
                                <span style={{ fontSize: '0.95rem' }}>🔄</span>
                                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1e293b' }}>Có thể làm lại nhiều lần</span>
                            </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <button
                                className="btn btn-primary"
                                style={{ padding: '14px', borderRadius: '14px', fontWeight: 800, fontSize: '0.95rem', background: `linear-gradient(135deg, ${selectedExercise.color || '#d97706'} 0%, ${selectedExercise.color || '#b45309'} 100%)`, boxShadow: '0 8px 16px rgba(217, 119, 6, 0.3)', width: '100%' }}
                                onClick={confirmStartExercise}
                            >
                                Bắt đầu luyện tập
                            </button>
                            <button
                                className="btn"
                                style={{ padding: '12px', borderRadius: '14px', fontWeight: 700, color: '#64748b', background: 'transparent', fontSize: '0.9rem' }}
                                onClick={() => setSelectedExercise(null)}
                            >
                                Quay lại
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
