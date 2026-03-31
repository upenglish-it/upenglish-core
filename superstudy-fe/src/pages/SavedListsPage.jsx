import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, FolderOpen, Heart, Trash2, Calendar, Play, Sparkles, Plus, AlertTriangle, Check, X, XCircle, CheckCheck, RotateCcw, PenLine, Loader2 } from 'lucide-react';
import logo from '../assets/logo.png';
import BrandLogo from '../components/common/BrandLogo';
import { useAuth } from '../contexts/AuthContext';
import { getSavedWords, toggleSavedWord, getCustomLists, deleteCustomList, updateCustomListWords } from '../services/savedService';
import { chatCompletion } from '../services/aiService';
import { getAllWordProgressMap, resetWordProgress, resetTopicProgress } from '../services/spacedRepetition';
import './SavedListsPage.css';
import './TopicSelectPage.css';
import './DashboardPage.css';

export default function SavedListsPage() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState('saved_words'); // 'saved_words' or 'custom_lists'
    const [isCreateMenuOpen, setIsCreateMenuOpen] = useState(false);

    const createActions = [
        { id: 'ai-gen', icon: Sparkles, title: 'Tạo danh sách từ', description: 'Dùng AI tạo bộ từ theo chủ đề', color: 'var(--color-primary-light)', path: '/generate-list', isAI: true },
        { id: 'custom', icon: PenLine, title: 'Tự tạo bài học', description: 'Tự nhập từ muốn học', color: 'var(--color-secondary)', path: '/custom-input' },
    ];

    const [savedWords, setSavedWords] = useState([]);
    const [customLists, setCustomLists] = useState([]);
    const [loading, setLoading] = useState(true);
    const [listToDelete, setListToDelete] = useState(null);
    const [progressMap, setProgressMap] = useState({});

    // Edit Modal State
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingList, setEditingList] = useState(null);
    const [editWords, setEditWords] = useState([]);
    const [newWordInput, setNewWordInput] = useState('');
    const [isAddingWord, setIsAddingWord] = useState(false);
    const [isSavingEdit, setIsSavingEdit] = useState(false);
    const [editError, setEditError] = useState('');

    // Learning Modal State
    const [isLearnModalOpen, setIsLearnModalOpen] = useState(false);
    const [selectedWordsToLearn, setSelectedWordsToLearn] = useState(new Set());
    const [currentLearningList, setCurrentLearningList] = useState(null); // { id, name, words, icon }

    // Reset Progress State
    const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
    const [isResetting, setIsResetting] = useState(false);

    const toggleWordToLearn = (word) => {
        const newSet = new Set(selectedWordsToLearn);
        if (newSet.has(word)) {
            newSet.delete(word);
        } else {
            newSet.add(word);
        }
        setSelectedWordsToLearn(newSet);
    };

    useEffect(() => {
        if (!user) return;

        async function fetchData() {
            setLoading(true);
            try {
                const [pMap] = await Promise.all([
                    getAllWordProgressMap(user.uid)
                ]);
                setProgressMap(pMap);

                if (activeTab === 'saved_words') {
                    const words = await getSavedWords(user.uid);
                    setSavedWords(words);
                } else {
                    const lists = await getCustomLists(user.uid);
                    setCustomLists(lists);
                }
            } catch (err) {
                console.error("Error fetching saved data", err);
            } finally {
                setLoading(false);
            }
        }
        fetchData();
    }, [user, activeTab]);

    const savedWordsStatus = {};
    savedWords.forEach(w => {
        savedWordsStatus[w.word] = true;
    });

    const handleToggleSaveInModal = async (e, wordObj) => {
        e.stopPropagation();
        if (!user) return;
        try {
            const isNowSaved = await toggleSavedWord(user.uid, wordObj);
            if (isNowSaved) {
                setSavedWords(prev => [...prev, wordObj]);
            } else {
                setSavedWords(prev => prev.filter(w => w.word !== wordObj.word));
            }
        } catch (err) {
            console.error("Lỗi khi lưu/bỏ lưu từ", err);
        }
    };

    const handleRemoveSavedWord = async (wordObj) => {
        if (!user) return;
        try {
            await toggleSavedWord(user.uid, wordObj);
            setSavedWords(prev => prev.filter(w => w.word !== wordObj.word));
        } catch (err) {
            console.error("Lỗi khi bỏ lưu từ", err);
        }
    };

    const handleResetProgress = async (e, wordStr) => {
        e.stopPropagation();
        if (!user?.uid) return;

        const success = await resetWordProgress(user.uid, wordStr);
        if (success) {
            setProgressMap(prev => {
                const updated = { ...prev };
                delete updated[wordStr];
                return updated;
            });
        }
    };

    const handleResetTopic = async () => {
        if (!user?.uid || !currentLearningList || isResetting) return;
        setIsResetting(true);

        const success = await resetTopicProgress(user.uid, currentLearningList.id);
        if (success) {
            // Update local progress map immediately for the UI to reflect
            setProgressMap(prev => {
                const updated = { ...prev };
                currentLearningList.words.forEach(w => {
                    delete updated[w.word];
                });
                return updated;
            });
            setIsResetConfirmOpen(false);
        } else {
            alert('Có lỗi xảy ra khi reset tiến độ. Vui lòng thử lại.');
        }
        setIsResetting(false);
    };

    const handleDeleteList = (list) => {
        if (!user) return;
        setListToDelete(list);
    };

    const confirmDelete = async () => {
        if (!user || !listToDelete) return;
        try {
            await deleteCustomList(user.uid, listToDelete.id);
            setCustomLists(prev => prev.filter(list => list.id !== listToDelete.id));
            setListToDelete(null);
        } catch (err) {
            console.error("Lỗi khi xóa danh sách", err);
        }
    };

    // ===== EDIT LIST HANDLERS =====
    const handleEditList = (list) => {
        setEditingList(list);
        setEditWords([...list.words]);
        setNewWordInput('');
        setEditError('');
        setIsEditModalOpen(true);
    };

    const handleRemoveEditWord = (wordToRemove) => {
        if (editWords.length <= 1) {
            setEditError('Danh sách phải có ít nhất 1 từ.');
            return;
        }
        setEditWords(prev => prev.filter(w => w.word !== wordToRemove));
        setEditError('');
    };

    const EDIT_SYSTEM_PROMPT = `Bạn là chuyên gia dạy từ vựng tiếng Anh. Bạn sẽ nhận một danh sách từ tiếng Anh và trả về JSON array chứa data học tập chi tiết.

Với MỖI từ trong danh sách, trả về object có ĐÚNG cấu trúc sau:
{
  "word": "từ tiếng Anh",
  "phonetic": "phiên âm IPA, ví dụ /nɪˈɡoʊ.ʃi.eɪt/",
  "partOfSpeech": "noun/verb/adjective/adverb/...",
  "vietnameseMeaning": "nghĩa tiếng Việt ngắn gọn",
  "explanation": "Giải thích ý nghĩa bằng tiếng Việt dễ hiểu (2-3 câu), KHÔNG được nhắc lại từ tiếng Anh gốc trong phần giải thích",
  "distractors": ["từ1_giống_phát_âm", "từ2", "từ3"],
  "pronunciationTip": "Gợi ý cách phát âm bằng tiếng Việt",
  "collocations": [
    { "phrase": "cụm từ 1", "vietnamese": "nghĩa tiếng Việt" },
    { "phrase": "cụm từ 2", "vietnamese": "nghĩa tiếng Việt" },
    { "phrase": "cụm từ 3", "vietnamese": "nghĩa tiếng Việt" }
  ],
  "exampleSentences": [
    { "en": "Câu ví dụ tiếng Anh", "vi": "Bản dịch tiếng Việt" }
  ],
  "sentenceSequence": {
    "en": "Một câu tiếng Anh tự nhiên để học viên luyện tập ráp từ.",
    "vi": "Dịch nghĩa tiếng Việt của câu trên"
  }
}

QUY TẮC:
- Trả về ĐÚNG JSON array, KHÔNG có markdown, KHÔNG có text ngoài JSON
- distractors: 3 từ có cách phát âm hoặc hình dạng tương tự để gây nhiễu
- collocations: đúng 3 cụm từ thông dụng
- sentenceSequence: 1 câu tiếng Anh thông dụng để ráp chữ.
- explanation phải bằng tiếng Việt, giải thích dễ hiểu cho người Việt. TUYỆT ĐỐI KHÔNG được nhắc lại hoặc bao gồm từ tiếng Anh gốc trong phần explanation — học viên cần tự nhớ lại từ đó`;

    const handleAddNewWords = async () => {
        if (!newWordInput.trim() || isAddingWord) return;

        const MAX_WORDS = 15;
        const newWords = newWordInput
            .split(/[,，;;\n]+/)
            .map(w => w.trim().toLowerCase().replace(/[^a-z\s'-]/g, ''))
            .filter(w => w.length > 1);
        const uniqueNew = [...new Set(newWords)];

        // Filter out words that already exist
        const existingWordSet = new Set(editWords.map(w => w.word.toLowerCase()));
        const toAdd = uniqueNew.filter(w => !existingWordSet.has(w));

        if (toAdd.length === 0) {
            setEditError('Tất cả từ đã có trong danh sách.');
            return;
        }

        if (editWords.length + toAdd.length > MAX_WORDS) {
            setEditError(`Tối đa ${MAX_WORDS} từ. Chỉ có thể thêm ${MAX_WORDS - editWords.length} từ nữa.`);
            return;
        }

        setIsAddingWord(true);
        setEditError('');

        try {
            const result = await chatCompletion({
                systemPrompt: EDIT_SYSTEM_PROMPT,
                userContent: `Tạo dữ liệu học tập cho các từ sau: ${toAdd.join(', ')}`,
                responseFormat: 'json',
            });

            let generatedWords;
            let text = result.text.trim();
            if (text.startsWith('```')) {
                text = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
            }
            generatedWords = JSON.parse(text);

            if (!Array.isArray(generatedWords) || generatedWords.length === 0) {
                throw new Error('AI không tạo được dữ liệu.');
            }

            const validWords = generatedWords.filter(w => w.word && w.vietnameseMeaning && w.phonetic);
            if (validWords.length === 0) {
                throw new Error('Dữ liệu từ AI không đúng cấu trúc.');
            }

            setEditWords(prev => [...prev, ...validWords]);
            setNewWordInput('');
        } catch (err) {
            console.error('Error adding new words:', err);
            setEditError(err.message || 'Có lỗi khi thêm từ. Vui lòng thử lại.');
        } finally {
            setIsAddingWord(false);
        }
    };

    const handleSaveEdit = async () => {
        if (!user || !editingList || isSavingEdit) return;
        if (editWords.length === 0) {
            setEditError('Danh sách không thể trống.');
            return;
        }

        setIsSavingEdit(true);
        setEditError('');

        try {
            await updateCustomListWords(user.uid, editingList.id, editWords);
            // Update local state
            setCustomLists(prev => prev.map(list =>
                list.id === editingList.id
                    ? { ...list, words: editWords, wordCount: editWords.length }
                    : list
            ));
            setIsEditModalOpen(false);
            setEditingList(null);
        } catch (err) {
            console.error('Error saving edit:', err);
            setEditError('Lỗi khi lưu. Vui lòng thử lại.');
        } finally {
            setIsSavingEdit(false);
        }
    };

    const closeEditModal = () => {
        setIsEditModalOpen(false);
        setEditingList(null);
        setEditWords([]);
        setNewWordInput('');
        setEditError('');
    };

    const startLearningWords = () => {
        if (savedWords.length === 0) return;
        setCurrentLearningList({
            id: 'saved_words',
            name: 'Từ vựng đã lưu',
            words: savedWords,
            icon: '❤️'
        });
        setSelectedWordsToLearn(new Set(savedWords.map(w => w.word)));
        setIsLearnModalOpen(true);
    };

    const startLearningList = (list) => {
        if (!list || !list.words || list.words.length === 0) return;
        setCurrentLearningList({
            id: list.id,
            name: list.name,
            words: list.words,
            icon: list.isGeneratedByAI ? '✨' : '📁'
        });
        setSelectedWordsToLearn(new Set(list.words.map(w => w.word)));
        setIsLearnModalOpen(true);
    };

    const handleStartLearning = () => {
        if (selectedWordsToLearn.size === 0 || !currentLearningList) return;

        const wordsToLearn = currentLearningList.words
            .filter(w => selectedWordsToLearn.has(w.word))
            .map(w => {
                const wordProgress = progressMap[w.word];
                return {
                    ...w,
                    stepsCompleted: wordProgress?.stepsCompleted ?? 0,
                    stepMastery: wordProgress?.stepMastery ?? null
                };
            });

        // Determine listType: saved_words → 'saved', AI-generated → 'ai', else 'custom'
        let listType = 'custom';
        let listIcon = currentLearningList.icon || '📁';
        let listColor = 'var(--color-warning)';
        if (currentLearningList.id === 'saved_words') {
            listType = 'saved';
            listIcon = '❤️';
            listColor = 'var(--color-error)';
        } else if (currentLearningList.icon === '✨') {
            listType = 'ai';
            listColor = 'var(--color-secondary)';
        }

        navigate('/learn', {
            state: {
                words: wordsToLearn,
                topicId: currentLearningList.id,
                topicName: currentLearningList.name,
                listType,
                icon: listIcon,
                color: listColor,
                skipWelcome: true
            }
        });
    };

    const renderEmptyState = (message, icon) => (
        <div className="saved-lists-message animate-fade-in">
            <div className="saved-lists-message-icon">{icon}</div>
            <p>{message}</p>
        </div>
    );

    return (
        <div className="saved-lists-page">
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

            <main className="saved-lists-main container">
                <div className="saved-lists-title-section animate-slide-up">
                    <FolderOpen size={32} className="text-warning mx-auto mb-2" />
                    <h1>Danh sách cá nhân</h1>
                    <p>Quản lý các từ vựng yêu thích và danh sách tự tạo</p>
                </div>

                <div className="saved-lists-tabs animate-slide-up" style={{ animationDelay: '0.1s' }}>
                    <button
                        className={`saved-lists-tab ${activeTab === 'saved_words' ? 'active' : ''}`}
                        onClick={() => setActiveTab('saved_words')}
                    >
                        <Heart size={18} /> Từ vựng yêu thích
                    </button>
                    <button
                        className={`saved-lists-tab ${activeTab === 'custom_lists' ? 'active' : ''}`}
                        onClick={() => setActiveTab('custom_lists')}
                    >
                        <FolderOpen size={18} /> Danh sách tự tạo
                    </button>
                </div>

                {loading ? (
                    <div className="saved-lists-message">
                        <div className="spinner"></div>
                        <p>Đang tải dữ liệu...</p>
                    </div>
                ) : (
                    <div className="saved-lists-content animate-fade-in" style={{ animationDelay: '0.2s' }}>
                        {activeTab === 'saved_words' && (
                            <>
                                {savedWords.length === 0 ? (
                                    renderEmptyState('Bạn chưa lưu từ vựng nào. Hãy nhấn biểu tượng trái tim khi học bài nhé.', <Heart size={48} />)
                                ) : (
                                    <div className="saved-words-container">
                                        <div className="saved-words-grid">
                                            {savedWords.map(w => (
                                                <div key={w.word} className="saved-word-item">
                                                    <div className="saved-word-info">
                                                        <span className="saved-word-en">{w.word}</span>
                                                        <span className="saved-word-vi">{w.vietnameseMeaning}</span>
                                                    </div>
                                                    <div className="saved-word-actions">
                                                        <button
                                                            className="btn-icon"
                                                            onClick={() => handleRemoveSavedWord(w)}
                                                            title="Bỏ lưu"
                                                        >
                                                            <Trash2 size={18} />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="learn-all-section">
                                            <button className="btn btn-primary" onClick={startLearningWords}>
                                                <Play size={18} className="mr-2" /> Học danh sách này ({savedWords.length} từ)
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}

                        {activeTab === 'custom_lists' && (
                            <>
                                {customLists.length === 0 ? (
                                    renderEmptyState('Bạn chưa có danh sách tự tạo nào. Hãy tạo danh sách mới bằng AI nhé.', <FolderOpen size={48} />)
                                ) : (
                                    <div className="custom-lists-grid">
                                        {customLists.map(list => (
                                            <div key={list.id} className="custom-list-card">
                                                <div className="custom-list-card-content">
                                                    <div className="custom-list-header">
                                                        <h3 className="custom-list-title">
                                                            {list.isGeneratedByAI && (
                                                                <span className="badge-ai-inline">
                                                                    <Sparkles size={10} /> AI
                                                                </span>
                                                            )}
                                                            {list.name.replace(/^Cụm từ chủ đề:\s*/, '')}
                                                        </h3>
                                                        <span className="custom-list-count">{list.wordCount} từ</span>
                                                    </div>
                                                </div>
                                                <div className="custom-list-actions">
                                                    <button className="btn btn-primary btn-learn" onClick={() => startLearningList(list)}>
                                                        Học ngay
                                                    </button>
                                                    <button className="btn-icon btn-edit" onClick={() => handleEditList(list)} title="Chỉnh sửa danh sách">
                                                        <PenLine size={18} />
                                                    </button>
                                                    <button className="btn-icon btn-delete" onClick={() => handleDeleteList(list)} title="Xóa danh sách">
                                                        <Trash2 size={18} />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                )}
            </main>

            {/* Custom Delete Modal */}
            {listToDelete && (
                <div className="modal-overlay animate-fade-in" onClick={() => setListToDelete(null)}>
                    <div className="modal-content animate-slide-up" onClick={e => e.stopPropagation()}>
                        <div className="modal-icon text-error mb-3" style={{ background: 'rgba(255, 59, 48, 0.1)', padding: '12px', borderRadius: '50%', display: 'inline-flex' }}>
                            <AlertTriangle size={32} />
                        </div>
                        <h2 className="modal-title mb-2">Xóa danh sách này?</h2>
                        <p className="modal-desc mb-4">
                            Bạn sắp xóa vĩnh viễn danh sách <strong>"{listToDelete.name}"</strong>. Hành động này không thể hoàn tác.
                        </p>
                        <div className="modal-actions" style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                            <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setListToDelete(null)}>Hủy</button>
                            <button className="btn btn-primary" style={{ flex: 1, background: 'var(--color-error)', borderColor: 'var(--color-error)' }} onClick={confirmDelete}>Xóa</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ===== WORD LIST PANEL ===== */}
            {isLearnModalOpen && currentLearningList && (
                <div className="topic-modal-backdrop" onClick={() => setIsLearnModalOpen(false)}>
                    <div className="topic-wordlist-panel" onClick={(e) => e.stopPropagation()}>
                        {/* Panel Header */}
                        <div className="wordlist-header">
                            <div className="wordlist-header-info">
                                <span className="wordlist-header-icon" style={{ background: `var(--color-primary-light)20` }}>
                                    {currentLearningList.icon}
                                </span>
                                <div>
                                    <h2 className="wordlist-title">{currentLearningList.name}</h2>
                                    <p className="wordlist-subtitle">
                                        {selectedWordsToLearn.size} từ được chọn
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
                                <button className="topic-modal-close" onClick={() => setIsLearnModalOpen(false)}>
                                    <X size={20} />
                                </button>
                            </div>
                        </div>

                        {/* Quick Actions */}
                        <div className="wordlist-actions">
                            <button className="wordlist-action-btn" onClick={() => setSelectedWordsToLearn(new Set(currentLearningList.words.map(w => w.word)))}>
                                <CheckCheck size={14} />
                                Tất cả
                            </button>
                            <button className="wordlist-action-btn wordlist-action-btn--danger" onClick={() => setSelectedWordsToLearn(new Set())}>
                                <XCircle size={14} />
                                Bỏ chọn
                            </button>
                        </div>

                        {/* Word List */}
                        <div className="wordlist-scroll">
                            {currentLearningList.words.map((w, idx) => {
                                const isChecked = selectedWordsToLearn.has(w.word);
                                const wordProgress = progressMap[w.word];
                                const stepsCompleted = wordProgress?.stepsCompleted ?? 0;
                                const isLearned = wordProgress?.level >= 1;
                                return (
                                    <div
                                        key={w.word}
                                        role="button"
                                        tabIndex={0}
                                        className={`wordlist-item ${isChecked ? 'wordlist-item--selected' : ''} ${isLearned ? 'wordlist-item--learned' : ''}`}
                                        onClick={() => toggleWordToLearn(w.word)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' || e.key === ' ') {
                                                e.preventDefault();
                                                toggleWordToLearn(w.word);
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
                                                onClick={(e) => handleToggleSaveInModal(e, w)}
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
                                                onClick={(e) => stepsCompleted > 0 && handleResetProgress(e, w.word)}
                                                title="Làm mới tiến độ học"
                                                style={{ opacity: stepsCompleted > 0 ? 1 : 0, pointerEvents: stepsCompleted > 0 ? 'auto' : 'none' }}
                                            >
                                                <RotateCcw size={16} className="text-muted" />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Sticky Start Button */}
                        <div className="wordlist-footer">
                            <button
                                className="btn btn-primary btn-lg btn-full topic-modal-start"
                                onClick={handleStartLearning}
                                disabled={selectedWordsToLearn.size === 0}
                            >
                                🚀 Bắt đầu học {selectedWordsToLearn.size} từ
                            </button>
                        </div>
                    </div>

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
                                    Bạn sắp xóa toàn bộ lịch sử học tập của danh sách <strong>"{currentLearningList.name}"</strong>. Hành động này không thể hoàn tác.
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

            {/* ===== EDIT LIST MODAL ===== */}
            {isEditModalOpen && editingList && (
                <div className="modal-overlay animate-fade-in" onClick={closeEditModal}>
                    <div className="edit-modal-panel animate-slide-up" onClick={e => e.stopPropagation()}>
                        {/* Header */}
                        <div className="edit-modal-header">
                            <div className="edit-modal-header-info">
                                <PenLine size={20} className="text-warning" />
                                <div>
                                    <h2 className="edit-modal-title">Chỉnh sửa danh sách</h2>
                                    <p className="edit-modal-subtitle">{editingList.name} • {editWords.length} từ</p>
                                </div>
                            </div>
                            <button className="topic-modal-close" onClick={closeEditModal}>
                                <X size={20} />
                            </button>
                        </div>

                        {/* Error */}
                        {editError && (
                            <div className="edit-modal-error">
                                <AlertTriangle size={14} />
                                <span>{editError}</span>
                            </div>
                        )}

                        {/* Add New Words Section */}
                        <div className="edit-modal-add-section">
                            <label className="edit-modal-add-label">
                                <Plus size={14} /> Thêm từ mới
                            </label>
                            <div className="edit-modal-add-row">
                                <input
                                    type="text"
                                    className="edit-modal-add-input"
                                    placeholder="VD: negotiate, deadline, revenue"
                                    value={newWordInput}
                                    onChange={e => setNewWordInput(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter') handleAddNewWords(); }}
                                    disabled={isAddingWord}
                                />
                                <button
                                    className="btn btn-primary edit-modal-add-btn"
                                    onClick={handleAddNewWords}
                                    disabled={isAddingWord || !newWordInput.trim()}
                                >
                                    {isAddingWord ? (
                                        <Loader2 size={16} className="spinning" />
                                    ) : (
                                        <><Sparkles size={14} /> Thêm</>
                                    )}
                                </button>
                            </div>
                            <p className="edit-modal-add-hint">Cách nhau bằng dấu phẩy. AI sẽ tự tạo dữ liệu bài học.</p>
                        </div>

                        {/* Word List */}
                        <div className="edit-modal-word-list">
                            {editWords.map((w, idx) => (
                                <div key={w.word + idx} className="edit-modal-word-item" style={{ animationDelay: `${idx * 0.03}s` }}>
                                    <div className="edit-modal-word-info">
                                        <span className="edit-modal-word-en">{w.word}</span>
                                        <span className="edit-modal-word-vi">{w.vietnameseMeaning}</span>
                                    </div>
                                    <button
                                        className="edit-modal-word-remove"
                                        onClick={() => handleRemoveEditWord(w.word)}
                                        title="Xoá từ này"
                                    >
                                        <X size={16} />
                                    </button>
                                </div>
                            ))}
                        </div>

                        {/* Footer */}
                        <div className="edit-modal-footer">
                            <button className="btn btn-ghost" onClick={closeEditModal} disabled={isSavingEdit}>
                                Hủy
                            </button>
                            <button
                                className="btn btn-primary"
                                onClick={handleSaveEdit}
                                disabled={isSavingEdit || editWords.length === 0}
                            >
                                {isSavingEdit ? (
                                    <><Loader2 size={16} className="spinning" /> Đang lưu...</>
                                ) : (
                                    <>✅ Lưu ({editWords.length} từ)</>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* FAB + Create Menu - only on custom_lists tab */}
            {activeTab === 'custom_lists' && (
                <div className="dashboard-fab-wrapper">
                    <button
                        className={`dashboard-fab ${isCreateMenuOpen ? 'is-open' : ''}`}
                        onClick={() => setIsCreateMenuOpen(!isCreateMenuOpen)}
                    >
                        <Plus size={28} />
                    </button>

                    {isCreateMenuOpen && (
                        <>
                            <div className="dashboard-fab-overlay" onClick={() => setIsCreateMenuOpen(false)} />
                            <div className="dashboard-fab-menu">
                                {createActions.map(action => (
                                    <button
                                        key={action.id}
                                        className="dashboard-fab-menu-item"
                                        onClick={() => { setIsCreateMenuOpen(false); navigate(action.path); }}
                                    >
                                        <div className="dashboard-fab-menu-icon" style={{ background: `${action.color}20`, color: action.color }}>
                                            <action.icon size={22} />
                                        </div>
                                        <div className="dashboard-fab-menu-info">
                                            <span className="dashboard-fab-menu-title">
                                                {action.title}
                                                {action.isAI && (
                                                    <span className="ai-badge-inline">
                                                        <Sparkles size={10} /> AI
                                                    </span>
                                                )}
                                            </span>
                                            <span className="dashboard-fab-menu-desc">{action.description}</span>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}
