import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, BookOpen, Sparkles, ChevronRight, ChevronDown, Folder, X, Check, CheckCheck, XCircle, Loader, RotateCcw } from 'lucide-react';
import wordData from '../data/wordData';
import { useAuth } from '../contexts/AuthContext';
import { getAdminTopics, getAdminTopicWords, getFolders } from '../services/adminService';
import { getSharedAndPublicTeacherTopics, getTeacherTopicWords } from '../services/teacherService';
import { getLearnedWordsForTopic, getWordProgressMapForTopic, resetWordProgress, getAllWordProgressMap, resetTopicProgress } from '../services/spacedRepetition';
import { getSavedWords, toggleSavedWord } from '../services/savedService';
import { Heart } from 'lucide-react';
import './TopicSelectPage.css';
import BrandLogo from '../components/common/BrandLogo';
import logo from '../assets/logo.png';

function TopicProgressRing({ pct, color }) {
    const r = 16;
    const circ = 2 * Math.PI * r;
    const dash = (pct / 100) * circ;
    const displayColor = pct === 100 ? '#4ade80' : (color || 'var(--color-primary)');
    return (
        <div className="topic-progress-ring" title={`${pct}% hoàn thành`}>
            <svg width="42" height="42" viewBox="0 0 42 42">
                {/* Track */}
                <circle cx="21" cy="21" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3" />
                {/* Progress arc */}
                <circle
                    cx="21" cy="21" r={r}
                    fill="none"
                    stroke={displayColor}
                    strokeWidth="3"
                    strokeDasharray={`${dash} ${circ - dash} `}
                    strokeDashoffset={circ / 4}
                    strokeLinecap="round"
                    style={{ transition: 'stroke-dasharray 0.5s ease' }}
                />
            </svg>
            <span className="topic-progress-pct">{pct}%</span>
        </div>
    );
}

export default function TopicSelectPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const { user } = useAuth();

    // Selected topic for word-list panel
    const [selectedTopic, setSelectedTopic] = useState(null);
    const [selectedWords, setSelectedWords] = useState(new Set());
    const [learnedWords, setLearnedWords] = useState(new Set());
    const [progressMap, setProgressMap] = useState({});
    const [savedWordsStatus, setSavedWordsStatus] = useState({});
    const [loadingLearned, setLoadingLearned] = useState(false);
    const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
    const [showStartConfirm, setShowStartConfirm] = useState(false);
    const [isResetting, setIsResetting] = useState(false);
    const [topics, setTopics] = useState([]);
    const [folders, setFolders] = useState([]);
    const [selectedFolderPopup, setSelectedFolderPopup] = useState(null);
    const [isFolderClosing, setIsFolderClosing] = useState(false);
    const [folderPopupOrigin, setFolderPopupOrigin] = useState({ x: 50, y: 50 });
    const [loadingTopics, setLoadingTopics] = useState(true);
    // Global progress map for all words (to compute per-topic completion %)
    const [globalProgressMap, setGlobalProgressMap] = useState({});
    // Firestore word data (enriched by admin)
    const [firestoreWordData, setFirestoreWordData] = useState({});

    // Helper: get words for a topic, preferring Firestore data over local
    function getTopicWords(topicId) {
        const fsWords = firestoreWordData[topicId];
        // Use Firestore data if it exists and has full content (check first word has phonetic)
        if (fsWords && fsWords.length > 0 && fsWords[0].phonetic) {
            return fsWords;
        }
        // Fallback to local data
        return wordData[topicId] || fsWords || [];
    }

    useEffect(() => {
        if (!user?.uid) return;
        getAllWordProgressMap(user.uid)
            .then(setGlobalProgressMap)
            .catch(err => console.warn('Failed to load global progress', err));

        // Fetch topics and folders from Firestore
        const topicAccess = user?.mergedTopicAccess || user?.topicAccess || [];
        Promise.all([
            getAdminTopics(),
            getFolders(),
            getSharedAndPublicTeacherTopics(topicAccess)
        ]).then(async ([adminTopicsData, foldersData, teacherTopicsData]) => {
            const topicsData = [...adminTopicsData, ...teacherTopicsData];
            setTopics(topicsData);

            // Filter folders by user access
            let visibleFolders = foldersData;
            if (user?.role !== 'admin') {
                const folderAccess = user?.mergedFolderAccess || user?.folderAccess || [];
                // topicAccess corresponds to the one already calculated above

                visibleFolders = foldersData.filter(f => {
                    if (f.isPublic) return true;
                    if (folderAccess.includes(f.id)) return true;

                    // Check if any topic inside this folder is explicitly granted or public
                    const folderTopics = topicsData.filter(t => (f.topicIds || []).includes(t.id));
                    return folderTopics.some(t => t.isPublic || topicAccess.includes(t.id));
                });
            }
            setFolders(visibleFolders);

            // Initialize expanded state for first folder
            // (Removed popup logic for init)

            setLoadingTopics(false);
            // Fetch word data from Firestore for each topic
            const fsData = {};
            await Promise.all(topicsData.map(async (t) => {
                try {
                    let words = [];
                    if (t.id.startsWith('t-')) {
                        words = await getTeacherTopicWords(t.id);
                    } else {
                        words = await getAdminTopicWords(t.id);
                    }
                    if (words.length > 0) {
                        words.sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
                        fsData[t.id] = words;
                    }
                } catch (e) {
                    console.warn(`Failed to load words for topic ${t.id}`, e);
                }
            }));
            setFirestoreWordData(fsData);
        }).catch(err => {
            console.error("Failed to load topics", err);
            setLoadingTopics(false);
        });
    }, [user?.uid]);

    useEffect(() => {
        if (!loadingTopics && location.state?.folderId && folders.length > 0) {
            const folder = folders.find(f => f.id === location.state.folderId);
            if (folder) {
                setSelectedFolderPopup(folder);
                setFolderPopupOrigin({ x: 50, y: 50 });
                // Clean state to avoid re-opening
                window.history.replaceState({}, document.title);
            }
        }
    }, [loadingTopics, location.state, folders]);

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

    // When a topic is clicked, load learned words and open the word list
    async function handleTopicClick(topic) {
        if (topic.status === 'coming_soon') return;

        setSelectedTopic(topic);
        setLoadingLearned(true);

        // Fetch learned words and progress map from Firestore
        let learned = new Set();
        let pMap = {};
        let saved = [];
        if (user?.uid) {
            try {
                [learned, pMap, saved] = await Promise.all([
                    getLearnedWordsForTopic(user.uid, topic.id),
                    getWordProgressMapForTopic(user.uid, topic.id),
                    getSavedWords(user.uid)
                ]);
            } catch (e) {
                console.warn('Failed to load topic data:', e);
            }
        }
        setLearnedWords(learned);
        setProgressMap(pMap);

        const savedMap = {};
        saved.forEach(w => { savedMap[w.word] = true; });
        setSavedWordsStatus(savedMap);

        // Start with no words selected
        setSelectedWords(new Set());
        setLoadingLearned(false);
    }

    function handleClose() {
        setSelectedTopic(null);
        setSelectedWords(new Set());
        setLearnedWords(new Set());
        setProgressMap({});
    }

    function toggleWord(word) {
        setSelectedWords(prev => {
            const next = new Set(prev);
            if (next.has(word)) {
                next.delete(word);
            } else {
                next.add(word);
            }
            return next;
        });
    }

    async function handleToggleSave(e, wordObj) {
        e.stopPropagation();
        if (!user?.uid) return;

        const currentStatus = savedWordsStatus[wordObj.word];
        // Optimistic update
        setSavedWordsStatus(prev => ({
            ...prev,
            [wordObj.word]: !currentStatus
        }));

        try {
            const newStatus = await toggleSavedWord(user.uid, wordObj);
            setSavedWordsStatus(prev => ({
                ...prev,
                [wordObj.word]: newStatus
            }));
        } catch (err) {
            console.error('Failed to toggle saved word', err);
            // Revert on error
            setSavedWordsStatus(prev => ({
                ...prev,
                [wordObj.word]: currentStatus
            }));
        }
    }

    async function handleResetProgress(e, wordObj) {
        e.stopPropagation();
        if (!user?.uid) return;

        const success = await resetWordProgress(user.uid, wordObj.word);
        if (success) {
            // Optimistically clean up UI state
            setLearnedWords(prev => {
                const next = new Set(prev);
                next.delete(wordObj.word);
                return next;
            });
            setProgressMap(prev => {
                const updated = { ...prev };
                delete updated[wordObj.word];
                return updated;
            });
        } else {
            console.error('Failed to reset word progress');
        }
    }

    async function handleResetTopic() {
        if (!user?.uid || !selectedTopic || isResetting) return;
        setIsResetting(true);

        const success = await resetTopicProgress(user.uid, selectedTopic.id);
        if (success) {
            // Clear local states for the topic
            setLearnedWords(new Set());
            setProgressMap({});

            // Refresh global progress map asynchronously
            getAllWordProgressMap(user.uid)
                .then(setGlobalProgressMap)
                .catch(err => console.warn('Failed to reload global progress', err));

            setIsResetConfirmOpen(false);
        } else {
            alert('Có lỗi xảy ra khi reset tiến độ. Vui lòng thử lại.');
        }
        setIsResetting(false);
    }

    const TOTAL_STEPS = 6;

    function selectAllUnlearned() {
        const topicWords = getTopicWords(selectedTopic.id);
        const incomplete = new Set();
        topicWords.forEach(w => {
            const stepsCompleted = progressMap[w.word]?.stepsCompleted ?? 0;
            if (stepsCompleted < TOTAL_STEPS) {
                incomplete.add(w.word);
            }
        });
        setSelectedWords(incomplete);
    }

    function selectAll() {
        const topicWords = getTopicWords(selectedTopic.id);
        setSelectedWords(new Set(topicWords.map(w => w.word)));
    }

    function deselectAll() {
        setSelectedWords(new Set());
    }

    function handleStartLearning() {
        if (!selectedTopic || selectedWords.size === 0) return;
        setShowStartConfirm(true);
    }

    function confirmStartLearning() {
        if (!selectedTopic || selectedWords.size === 0) return;
        const topicWords = getTopicWords(selectedTopic.id);

        const wordsToLearn = topicWords
            .filter(w => selectedWords.has(w.word))
            .map(w => {
                const wordProgress = progressMap[w.word];
                return {
                    ...w,
                    stepsCompleted: wordProgress?.stepsCompleted ?? 0,
                    stepMastery: wordProgress?.stepMastery ?? null
                };
            });

        if (wordsToLearn.length === 0) return;
        setShowStartConfirm(false);

        navigate('/learn', {
            state: {
                words: wordsToLearn,
                topicId: selectedTopic.id,
                topicName: selectedTopic.name,
                listType: 'topic',
                icon: selectedTopic.icon || '📚',
                color: selectedTopic.color || 'var(--color-primary)',
                isTeacherTopic: !!selectedTopic.isTeacherTopic || selectedTopic.id?.startsWith('t-'),
                skipWelcome: true
            },
        });
    }

    function getAvailableWords(topicId) {
        return getTopicWords(topicId).length;
    }

    // Compute completion % for a topic (steps completed / total possible steps)
    function getTopicCompletion(topicId) {
        const words = getTopicWords(topicId);
        if (words.length === 0) return 0;
        const totalSteps = words.length * TOTAL_STEPS;
        const completedSteps = words.reduce((sum, w) => {
            return sum + Math.min(globalProgressMap[w.word]?.stepsCompleted ?? 0, TOTAL_STEPS);
        }, 0);
        return Math.round((completedSteps / totalSteps) * 100);
    }

    function toggleFolder(folderId) {
        setExpandedFolders(prev => ({
            ...prev,
            [folderId]: !prev[folderId]
        }));
    }

    function renderTopicCard(topic, index = 0) {
        const isComingSoon = topic.status === 'coming_soon';
        return (
            <button
                key={topic.id}
                className={`topic-card glass-card ${isComingSoon ? 'is-coming-soon' : ''}`}
                onClick={() => handleTopicClick(topic)}
                style={{ animationDelay: `${index * 0.05}s` }}
                disabled={isComingSoon}
            >
                <span className="topic-card-icon" style={{ background: `${topic.color}20` }}>
                    {topic.icon}
                </span>
                <div className="topic-card-body">
                    <h3 className="topic-card-name">{topic.name}</h3>
                    <p className="topic-card-desc">{topic.description}</p>
                </div>
                {!isComingSoon ? (
                    <TopicProgressRing pct={getTopicCompletion(topic.id)} color={topic.color} />
                ) : (
                    <span className="topic-card-count">Sắp ra mắt</span>
                )}
            </button>
        );
    }

    // Compute unassigned topics that the user is allowed to see
    const allAssignedIds = new Set(folders.flatMap(f => f.topicIds || []));
    let unassignedTopics = topics.filter(t => !allAssignedIds.has(t.id));
    if (user?.role !== 'admin') {
        const topicAccess = user?.mergedTopicAccess || user?.topicAccess || [];
        unassignedTopics = unassignedTopics.filter(t => t.isPublic || topicAccess.includes(t.id));
    }

    return (
        <div className="topic-page">
            {/* Header */}
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
                {/* Title */}
                <div className="topic-title-section animate-slide-up">
                    <Sparkles size={24} className="text-warning" />
                    <h1>Bài học từ vựng</h1>
                    <p>Chọn bài học bạn muốn và bắt đầu ngay</p>
                </div>

                {/* Topic Grid */}
                {loadingTopics ? (
                    <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
                        <Loader size={32} className="spin" style={{ margin: '0 auto 16px' }} />
                        <p>Đang tải danh sách chủ đề...</p>
                    </div>
                ) : folders.length === 0 && unassignedTopics.length === 0 && user?.role !== 'admin' ? (
                    <div className="admin-empty-state glass-card" style={{ padding: '40px 20px', textAlign: 'center', marginTop: '20px' }}>
                        <Folder size={48} style={{ color: 'var(--text-muted)', margin: '0 auto 16px', opacity: 0.5 }} />
                        <h3 style={{ marginBottom: '8px' }}>Chưa có bài học nào</h3>
                        <p style={{ color: 'var(--text-secondary)' }}>Bạn chưa được cấp quyền truy cập vào bất kỳ thư mục bài học nào. Vui lòng liên hệ Admin.</p>
                    </div>
                ) : (
                    <div className="folders-container" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                        {folders.length > 0 && (
                            <div className="topic-grid" style={{ marginBottom: unassignedTopics.length > 0 ? '24px' : '0' }}>
                                {folders.map(folder => {
                                    const folderTopics = topics.filter(t => (folder.topicIds || []).includes(t.id));
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
                                                <p className="topic-card-desc">{folder.description || `${folderTopics.length} chủ đề`}</p>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        )}

                        {/* Generic unassigned topics standalone */}
                        {unassignedTopics.length > 0 && (
                            <div className="folder-section">
                                <h2 style={{ fontSize: '1.2rem', margin: '0 0 16px 0', fontWeight: 700, color: 'var(--text-primary)' }}>
                                    {user?.role === 'admin' ? 'Chưa phân loại (Admin)' : 'Bài học khác'}
                                </h2>
                                <div className="topic-grid">
                                    {unassignedTopics.map((topic, index) => renderTopicCard(topic, index))}
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
                                    const folderTopics = topics.filter(t => (selectedFolderPopup.topicIds || []).includes(t.id));
                                    let visibleFolderTopics = folderTopics;
                                    if (user?.role !== 'admin') {
                                        const folderAccess = user?.mergedFolderAccess || user?.folderAccess || [];
                                        const topicAccess = user?.mergedTopicAccess || user?.topicAccess || [];
                                        if (!selectedFolderPopup.isPublic && !folderAccess.includes(selectedFolderPopup.id)) {
                                            visibleFolderTopics = folderTopics.filter(t => t.isPublic || topicAccess.includes(t.id));
                                        }
                                    }
                                    return visibleFolderTopics.length > 0 ? (
                                        visibleFolderTopics.map((topic, index) => renderTopicCard(topic, index))
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

            {/* ===== WORD LIST PANEL ===== */}
            {selectedTopic && (
                <div className="topic-modal-backdrop" onClick={handleClose}>
                    <div className="topic-wordlist-panel" onClick={(e) => e.stopPropagation()}>
                        {/* Panel Header */}
                        <div className="wordlist-header">
                            <div className="wordlist-header-info">
                                <span className="wordlist-header-icon" style={{ background: `${selectedTopic.color}20` }}>
                                    {selectedTopic.icon}
                                </span>
                                <div>
                                    <h2 className="wordlist-title">{selectedTopic.name}</h2>
                                    <p className="wordlist-subtitle">
                                        {selectedWords.size} từ được chọn
                                    </p>
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button
                                    className="topic-modal-close"
                                    onClick={() => setIsResetConfirmOpen(true)}
                                    title="Reset tiến độ học"
                                    style={{ color: 'var(--color-error)' }}
                                >
                                    <RotateCcw size={20} />
                                </button>
                                <button className="topic-modal-close" onClick={handleClose}>
                                    <X size={20} />
                                </button>
                            </div>
                        </div>

                        {/* Quick Actions */}
                        <div className="wordlist-actions">
                            <button className="wordlist-action-btn" onClick={selectAllUnlearned}>
                                <CheckCheck size={14} />
                                Chưa hoàn thành
                            </button>
                            <button className="wordlist-action-btn" onClick={selectAll}>
                                <Check size={14} />
                                Tất cả
                            </button>
                            <button className="wordlist-action-btn wordlist-action-btn--danger" onClick={deselectAll}>
                                <XCircle size={14} />
                                Bỏ chọn
                            </button>
                        </div>

                        {/* Word List */}
                        <div className="wordlist-scroll">
                            {loadingLearned ? (
                                <div className="wordlist-loading">
                                    <Loader size={24} className="spin" />
                                    <p>Đang tải dữ liệu...</p>
                                </div>
                            ) : (
                                getTopicWords(selectedTopic.id).map((w, idx) => {
                                    const isLearned = learnedWords.has(w.word);
                                    const isChecked = selectedWords.has(w.word);
                                    const wordProgress = progressMap[w.word];
                                    const stepsCompleted = wordProgress?.stepsCompleted ?? 0;
                                    const hasProgress = stepsCompleted > 0;
                                    return (
                                        <div
                                            key={w.word}
                                            role="button"
                                            tabIndex={0}
                                            className={`wordlist-item ${isChecked ? 'wordlist-item--selected' : ''} ${isLearned ? 'wordlist-item--learned' : ''}`}
                                            onClick={() => toggleWord(w.word)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' || e.key === ' ') {
                                                    e.preventDefault();
                                                    toggleWord(w.word);
                                                }
                                            }}
                                            style={{ animationDelay: `${idx * 0.03}s` }}
                                        >
                                            <div className={`wordlist-checkbox ${isChecked ? 'wordlist-checkbox--checked' : ''}`}>
                                                {isChecked && <Check size={14} />}
                                            </div>
                                            <div className="wordlist-item-content">
                                                <div className="wordlist-item-top">
                                                    <span className="wordlist-item-word">{w.word}</span>
                                                    {isLearned && (
                                                        <span className="wordlist-learned-badge">✓ Đã học</span>
                                                    )}
                                                </div>
                                                <span className="wordlist-item-meaning">{w.vietnameseMeaning}</span>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: 'auto', flexShrink: 0 }}>
                                                <button
                                                    className={`wordlist-bookmark-btn ${savedWordsStatus[w.word] ? 'is-saved' : ''}`}
                                                    onClick={(e) => handleToggleSave(e, w)}
                                                    title={savedWordsStatus[w.word] ? "Bỏ lưu từ" : "Lưu từ vựng"}
                                                >
                                                    <Heart size={16} fill={savedWordsStatus[w.word] ? "currentColor" : "none"} className={savedWordsStatus[w.word] ? "text-error" : ""} />
                                                </button>
                                                {/* 6 progress dots */}
                                                <div className="wordlist-progress-dots">
                                                    {Array.from({ length: 6 }, (_, i) => (
                                                        <div
                                                            key={i}
                                                            className={`wordlist-progress-dot ${i < stepsCompleted ? 'wordlist-progress-dot--filled' : ''}`}
                                                        />
                                                    ))}
                                                </div>
                                                <button
                                                    className="wordlist-bookmark-btn"
                                                    onClick={(e) => hasProgress && handleResetProgress(e, w)}
                                                    title="Làm mới tiến độ học"
                                                    style={{ opacity: hasProgress ? 1 : 0, pointerEvents: hasProgress ? 'auto' : 'none' }}
                                                >
                                                    <RotateCcw size={16} className="text-muted" />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>

                        {/* Sticky Start Button */}
                        <div className="wordlist-footer">
                            <button
                                className="btn btn-primary btn-lg btn-full topic-modal-start"
                                onClick={handleStartLearning}
                                disabled={selectedWords.size === 0}
                            >
                                {selectedWords.size > 0 ? `🚀 Bắt đầu học ${selectedWords.size} từ` : '🚀 Bắt đầu học 0 từ'}
                            </button>
                        </div>
                    </div>

                    {/* Start Confirmation Popup */}
                    {showStartConfirm && (
                        <div className="reset-confirm-backdrop" onClick={() => setShowStartConfirm(false)} style={{
                            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                            backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            zIndex: 1002, borderRadius: 'var(--radius-xl)'
                        }}>
                            <div className="reset-confirm-modal glass-card animate-slide-up" onClick={e => e.stopPropagation()} style={{
                                width: '90%', maxWidth: '340px', padding: '24px 20px', textAlign: 'center',
                                backgroundColor: 'var(--bg-primary)', borderRadius: '24px'
                            }}>
                                <div style={{ width: '56px', height: '56px', background: `${selectedTopic.color || 'var(--color-primary)'}20`, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                                    <span style={{ fontSize: '1.8rem' }}>{selectedTopic.icon || '📚'}</span>
                                </div>
                                <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 14px' }}>{selectedTopic.name}</h2>

                                <div style={{ textAlign: 'left', marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', borderRadius: '10px', background: '#f5f3ff' }}>
                                        <span style={{ fontSize: '0.95rem' }}>📚</span>
                                        <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1e293b' }}>Học từ vựng</span>
                                        <span style={{ fontSize: '0.78rem', color: '#94a3b8', marginLeft: 'auto' }}>{selectedWords.size} từ được chọn</span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', borderRadius: '10px', background: '#f0f9ff' }}>
                                        <span style={{ fontSize: '0.95rem' }}>📖</span>
                                        <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1e293b' }}>6 bước học cho mỗi từ</span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', borderRadius: '10px', background: '#f0fdf4' }}>
                                        <span style={{ fontSize: '0.95rem' }}>⏱️</span>
                                        <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1e293b' }}>Không giới hạn thời gian</span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', borderRadius: '10px', background: '#fffbeb' }}>
                                        <span style={{ fontSize: '0.95rem' }}>🔄</span>
                                        <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1e293b' }}>Có thể học lại nhiều lần</span>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <button
                                        className="btn btn-primary"
                                        style={{ padding: '14px', borderRadius: '14px', fontWeight: 800, fontSize: '0.95rem', background: `linear-gradient(135deg, ${selectedTopic.color || '#6366f1'} 0%, ${selectedTopic.color || '#4f46e5'} 100%)`, boxShadow: '0 8px 16px rgba(99, 102, 241, 0.3)', width: '100%' }}
                                        onClick={confirmStartLearning}
                                    >
                                        🚀 Bắt đầu học {selectedWords.size} từ
                                    </button>
                                    <button
                                        className="btn"
                                        style={{ padding: '12px', borderRadius: '14px', fontWeight: 700, color: '#64748b', background: 'transparent', fontSize: '0.9rem' }}
                                        onClick={() => setShowStartConfirm(false)}
                                    >
                                        Quay lại
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Reset Confirmation Modal */}
                    {isResetConfirmOpen && (
                        <div className="reset-confirm-backdrop" onClick={() => setIsResetConfirmOpen(false)} style={{
                            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                            backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            zIndex: 1002, borderRadius: 'var(--radius-xl)'
                        }}>
                            <div className="reset-confirm-modal glass-card" onClick={e => e.stopPropagation()} style={{
                                width: '90%', maxWidth: '320px', padding: 'var(--space-xl)', textAlign: 'center',
                                backgroundColor: 'var(--bg-primary)'
                            }}>
                                <div style={{ display: 'inline-flex', padding: '16px', borderRadius: '50%', backgroundColor: 'var(--color-error-light)20', color: 'var(--color-error)', marginBottom: '16px' }}>
                                    <RotateCcw size={32} />
                                </div>
                                <h3 style={{ fontSize: '1.25rem', marginBottom: '8px', color: 'var(--text-primary)' }}>Reset tiến độ?</h3>
                                <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', fontSize: '0.95rem', lineHeight: '1.5' }}>
                                    Bạn sắp xóa toàn bộ lịch sử học tập của chủ đề <strong>"{selectedTopic.name}"</strong>. Hành động này không thể hoàn tác.
                                </p>
                                <div style={{ display: 'flex', gap: '12px' }}>
                                    <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setIsResetConfirmOpen(false)} disabled={isResetting}>Hủy</button>
                                    <button className="btn btn-primary" style={{ flex: 1, backgroundColor: 'var(--color-error)', borderColor: 'var(--color-error)' }} onClick={handleResetTopic} disabled={isResetting}>
                                        {isResetting ? 'Đang xóa...' : 'Chắc chắn'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
