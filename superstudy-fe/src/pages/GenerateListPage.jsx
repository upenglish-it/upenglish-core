import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { generateWordListFromTopic, appendWordListToTopic } from '../services/aiService';
import { saveCustomList, getSavedWords, toggleSavedWord } from '../services/savedService';
import { getAllWordProgressMap, resetWordProgress, resetTopicProgress } from '../services/spacedRepetition';
import { readUserStorageDoc } from '../services/userStorageService';
import { ArrowLeft, Sparkles, BookOpen, Hash, AlignLeft, Bot, RefreshCw, Save, ChevronDown, X, Plus, Check, XCircle, CheckCheck, RotateCcw, Heart } from 'lucide-react';
import './GenerateListPage.css';
import './TopicSelectPage.css'; // Reuse modal styles from TopicSelectPage
import BrandLogo from '../components/common/BrandLogo';
import logo from '../assets/logo.png';

export default function GenerateListPage() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [topic, setTopic] = useState('');
    const [count, setCount] = useState(10);
    const [type, setType] = useState('words'); // 'words' | 'phrases'
    const [level, setLevel] = useState(() => localStorage.getItem('userCefrLevel') || 'A2'); // CEFR level
    const PREFERENCES_DOC_TYPE = 'preferences';

    // Sync level from user settings
    useEffect(() => {
        if (!user?.uid) return;
        readUserStorageDoc(user.uid, PREFERENCES_DOC_TYPE)
            .then((prefs) => {
                if (prefs?.cefrLevel) {
                    setLevel(prefs.cefrLevel);
                }
            })
            .catch(() => { });
    }, [user?.uid]);

    const [appendInput, setAppendInput] = useState('');
    const [isAppending, setIsAppending] = useState(false);

    const [isTypeOpen, setIsTypeOpen] = useState(false);
    const [isLevelOpen, setIsLevelOpen] = useState(false);

    const typeOptions = [
        { value: 'words', label: 'Từ đơn lẻ' },
        { value: 'phrases', label: 'Cụm từ / Thành ngữ' }
    ];

    const levelOptions = [
        { value: 'A1', label: 'A1' },
        { value: 'A2', label: 'A2' },
        { value: 'B1', label: 'B1' },
        { value: 'B2', label: 'B2' },
        { value: 'C1', label: 'C1' },
        { value: 'C2', label: 'C2' },
    ];

    const generateCardRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (generateCardRef.current && !generateCardRef.current.contains(event.target)) {
                setIsTypeOpen(false);
                setIsLevelOpen(false);
            }
        };

        if (isTypeOpen || isLevelOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isTypeOpen, isLevelOpen]);

    const [isGenerating, setIsGenerating] = useState(false);
    const [error, setError] = useState(null);
    const [generatedList, setGeneratedList] = useState(null);
    const [isSaving, setIsSaving] = useState(false);

    // Learning Modal State
    const [isLearnModalOpen, setIsLearnModalOpen] = useState(false);
    const [selectedWordsToLearn, setSelectedWordsToLearn] = useState(new Set());
    const [progressMap, setProgressMap] = useState({});
    const [savedWordsStatus, setSavedWordsStatus] = useState({});

    // Reset Progress State
    const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
    const [isResetting, setIsResetting] = useState(false);

    // Fetch saved words to populate status map
    useEffect(() => {
        if (!user) return;
        getSavedWords(user.uid).then(words => {
            const status = {};
            words.forEach(w => {
                status[w.word] = true;
            });
            setSavedWordsStatus(status);
        });
    }, [user]);

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

    const toggleWordToLearn = (word) => {
        const newSet = new Set(selectedWordsToLearn);
        if (newSet.has(word)) {
            newSet.delete(word);
        } else {
            newSet.add(word);
        }
        setSelectedWordsToLearn(newSet);
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
        if (!user?.uid || !savedListId || isResetting) return;
        setIsResetting(true);

        const success = await resetTopicProgress(user.uid, savedListId);
        if (success) {
            // Update local progress map immediately for the UI to reflect
            setProgressMap(prev => {
                const updated = { ...prev };
                if (generatedList) {
                    generatedList.forEach(w => {
                        delete updated[w.word];
                    });
                }
                return updated;
            });
            setIsResetConfirmOpen(false);
        } else {
            alert('Có lỗi xảy ra khi reset tiến độ. Vui lòng thử lại.');
        }
        setIsResetting(false);
    };

    const [savedListId, setSavedListId] = useState(null);

    const handleGenerate = async (e) => {
        e.preventDefault();
        if (!topic.trim()) return;
        setIsGenerating(true);
        setError(null);
        setGeneratedList(null);
        setSavedListId(null);
        try {
            const list = await generateWordListFromTopic({
                topic: topic.trim(),
                count: Number(count),
                type,
                level
            });
            setGeneratedList(list);
        } catch (err) {
            setError(err.message || 'Có lỗi xảy ra khi tạo danh sách');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleSaveAndLearn = async () => {
        if (!generatedList || generatedList.length === 0) return;
        try {
            setIsSaving(true);
            // Provide a default list name if topic is empty
            const listName = `${type === 'words' ? 'Từ vựng' : 'Cụm từ'} chủ đề: ${topic}`;
            const id = await saveCustomList(user.uid, listName, generatedList, true);
            setSavedListId(id);

            const pMap = await getAllWordProgressMap(user.uid);
            setProgressMap(pMap);

            // Open the modal and check all words by default
            setSelectedWordsToLearn(new Set(generatedList.map(w => w.word)));
            setIsLearnModalOpen(true);
        } catch (err) {
            console.error(err);
            // Handle error (maybe show a toast notification)
        } finally {
            setIsSaving(false);
        }
    };

    const handleStartLearning = () => {
        if (selectedWordsToLearn.size === 0) return;

        const wordsToLearn = generatedList
            .filter(w => selectedWordsToLearn.has(w.word))
            .map(w => {
                const wordProgress = progressMap[w.word];
                return {
                    ...w,
                    stepsCompleted: wordProgress?.stepsCompleted ?? 0,
                    stepMastery: wordProgress?.stepMastery ?? null
                };
            });

        const listName = `${type === 'words' ? 'Từ vựng' : 'Cụm từ'} chủ đề: ${topic}`;

        navigate('/learn', {
            state: {
                words: wordsToLearn,
                topicId: savedListId || 'generated-ai',
                topicName: listName,
                listType: 'ai',
                icon: '✨',
                color: 'var(--color-secondary)',
                skipWelcome: true
            }
        });
    };

    const handleAppendWords = async () => {
        if (!appendInput.trim()) return;
        try {
            setIsAppending(true);
            setError(null);

            // Call the AI Service
            const newWords = await appendWordListToTopic({
                topic,
                type,
                existingWords: generatedList,
                appendInput: appendInput.trim(),
                level
            });

            if (newWords && newWords.length > 0) {
                setGeneratedList(prev => [...prev, ...newWords]);
                setAppendInput(''); // Clear input on success
            } else {
                // Warning/Toast: Could not find/generate appropriate words
                console.warn('AI did not return any new words based on input.');
            }
        } catch (err) {
            console.error('Append Error:', err);
            setError(err.message || 'Lỗi khi yêu cầu AI thêm từ. Hãy thử lại!');
        } finally {
            setIsAppending(false);
        }
    };

    return (
        <div className="generate-page">
            <header className="dashboard-header">
                <div className="container flex-between" style={{ position: 'relative' }}>
                    <button className="btn btn-ghost" onClick={() => {
                        if (generatedList) {
                            setGeneratedList(null);
                        } else {
                            navigate('/');
                        }
                    }}>
                        <ArrowLeft size={20} />
                    </button>
                    <div className="dashboard-brand" style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)' }}>
                        <BrandLogo size="1.2rem" />
                    </div>
                    <div style={{ width: 44 }}></div>
                </div>
            </header>

            <main className="generate-main container">
                {!generatedList && !isGenerating ? (
                    <div className="generate-form-container" ref={generateCardRef}>
                        <div className="generate-title-section animate-slide-up">
                            <Bot size={24} className="text-primary" style={{ color: 'var(--color-primary)' }} />
                            <h1>Tạo danh sách từ</h1>
                            <p>Nhập chủ đề bạn muốn mổ xẻ, AI sẽ lập tức tạo bộ từ vựng chuẩn xác kèm phiên âm và ví dụ.</p>
                        </div>

                        <div className="glass-card generate-card animate-slide-up" style={{ animationDelay: '0.1s' }}>
                            {error && (
                                <div className="generate-error mb-4">
                                    <span>⚠️</span> {error}
                                </div>
                            )}

                            <div className="generate-input-group">
                                <label htmlFor="generate-topic-input">1. Chủ đề tiếng Anh / Việt</label>
                                <div className="generate-input-wrapper">
                                    <BookOpen size={18} className="text-muted" />
                                    <input
                                        id="generate-topic-input"
                                        name="topic"
                                        aria-label="Topic"
                                        type="text"
                                        placeholder="VD: Phỏng vấn xin việc, Môi trường, Nấu ăn..."
                                        value={topic}
                                        onChange={(e) => setTopic(e.target.value)}
                                        className="input-field"
                                        autoFocus
                                    />
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: 'var(--space-md)' }}>
                                <div className="generate-input-group" style={{ flex: 1 }}>
                                    <label htmlFor="generate-count-input">2. Số lượng</label>
                                    <div className="generate-input-wrapper">
                                        <Hash size={18} className="text-muted" />
                                        <input
                                            id="generate-count-input"
                                            name="count"
                                            aria-label="Count"
                                            type="number"
                                            value={count}
                                            onChange={(e) => setCount(e.target.value)}
                                            min="1"
                                            max="50"
                                            className="input-field"
                                            placeholder="Tối đa 50 từ..."
                                        />
                                    </div>
                                </div>

                                <div className="generate-input-group" style={{ flex: 1 }}>
                                    <label>3. Trình độ (CEFR)</label>
                                    <div className="generate-input-wrapper" style={{ zIndex: isLevelOpen ? 10 : 1 }}>
                                        <BookOpen size={18} className="text-muted" />
                                        <div
                                            id="generate-level-input"
                                            role="button"
                                            tabIndex={0}
                                            aria-label="CEFR level"
                                            className={`custom-select ${isLevelOpen ? 'active' : ''}`}
                                            onClick={() => { setIsLevelOpen(!isLevelOpen); setIsTypeOpen(false); }}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' || e.key === ' ') {
                                                    e.preventDefault();
                                                    setIsLevelOpen(!isLevelOpen);
                                                    setIsTypeOpen(false);
                                                }
                                            }}
                                        >
                                            <span className="custom-select-value">{levelOptions.find(o => o.value === level)?.label}</span>
                                            <ChevronDown size={16} className={`custom-select-arrow ${isLevelOpen ? 'open' : ''}`} />
                                        </div>
                                        {isLevelOpen && (
                                            <ul className="custom-select-menu animate-fade-in">
                                                {levelOptions.map(option => (
                                                    <li key={option.value}
                                                        className={option.value === level ? 'selected' : ''}
                                                        onClick={(e) => { e.stopPropagation(); setLevel(option.value); setIsLevelOpen(false); }}>
                                                        {option.label}
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="generate-input-group">
                                <label>4. Loại từ vựng</label>
                                <div className="generate-input-wrapper" style={{ zIndex: isTypeOpen ? 10 : 1 }}>
                                    <AlignLeft size={18} className="text-muted" />
                                    <div
                                        id="generate-type-input"
                                        role="button"
                                        tabIndex={0}
                                        aria-label="Vocabulary type"
                                        className={`custom-select ${isTypeOpen ? 'active' : ''}`}
                                        onClick={() => { setIsTypeOpen(!isTypeOpen); setIsLevelOpen(false); }}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' || e.key === ' ') {
                                                e.preventDefault();
                                                setIsTypeOpen(!isTypeOpen);
                                                setIsLevelOpen(false);
                                            }
                                        }}
                                    >
                                        <span className="custom-select-value">{typeOptions.find(o => o.value === type)?.label}</span>
                                        <ChevronDown size={16} className={`custom-select-arrow ${isTypeOpen ? 'open' : ''}`} />
                                    </div>
                                    {isTypeOpen && (
                                        <ul className="custom-select-menu animate-fade-in">
                                            {typeOptions.map(option => (
                                                <li key={option.value}
                                                    className={option.value === type ? 'selected' : ''}
                                                    onClick={(e) => { e.stopPropagation(); setType(option.value); setIsTypeOpen(false); }}>
                                                    {option.label}
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            </div>


                            <button
                                className="btn btn-primary btn-lg btn-full mt-4"
                                onClick={handleGenerate}
                                disabled={!topic.trim()}
                                style={{
                                    border: 'none',
                                    color: 'white'
                                }}
                            >
                                <Sparkles size={20} /> Viết Nháp Đề Học Bằng AI
                            </button>
                        </div>
                    </div>
                ) : isGenerating ? (
                    <div className="generate-loading animate-fade-in">
                        <div className="loading-orbs">
                            <div className="orb orb-1"></div>
                            <div className="orb orb-2"></div>
                            <div className="orb orb-3"></div>
                        </div>
                        <h3>AI đang soạn bài...</h3>
                        <p>Đang tổng hợp các từ vựng xuất sắc nhất về "{topic}"</p>
                    </div>
                ) : (
                    <div className="generate-result animate-slide-up">
                        <div className="result-header">
                            <h2>Chủ đề: {topic}</h2>
                            <p className="text-muted">{generatedList.length} {type === 'words' ? 'từ vựng' : 'cụm từ'} được tạo bởi AI</p>
                        </div>

                        {error && (
                            <div className="generate-error mb-4">
                                <span>⚠️</span> {error}
                            </div>
                        )}

                        <div className="result-list">
                            {generatedList.map((item, idx) => (
                                <div key={idx} className="result-item glass-card">
                                    <button
                                        className="btn-icon result-item-remove"
                                        onClick={() => setGeneratedList(prev => prev.filter((_, i) => i !== idx))}
                                        title="Loại bỏ"
                                    >
                                        <X size={14} />
                                    </button>
                                    <div className="result-word-header pr-8">
                                        <h3>{item.word}</h3>
                                        <span className="result-phonetic">{item.phonetic}</span>
                                    </div>
                                    <p className="result-meaning">{item.vietnameseMeaning}</p>
                                </div>
                            ))}

                            {/* Khung yêu cầu AI thêm từ */}
                            <div className="result-item glass-card add-word-card">
                                <h4 style={{ margin: '0 0 8px 0', fontSize: '1rem', color: 'var(--color-primary-light)' }}><Bot size={16} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '6px' }} />Thêm từ</h4>
                                <div className="add-word-inputs mt-1">
                                    <input
                                        id="append-word-input"
                                        name="appendWord"
                                        aria-label="Append word"
                                        type="text"
                                        placeholder="Lượng từ / Nghĩa của từ muốn học"
                                        value={appendInput}
                                        onChange={e => setAppendInput(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                handleAppendWords();
                                            }
                                        }}
                                        className="input-field mb-2"
                                        disabled={isAppending}
                                    />
                                    <button
                                        className={`btn btn-sm ${appendInput.trim() ? 'btn-primary text-white' : 'btn-ghost'}`}
                                        style={{ width: '100%', border: appendInput.trim() ? 'none' : '1px dashed var(--border-color)', opacity: isAppending ? 0.7 : 1 }}
                                        onClick={handleAppendWords}
                                        disabled={!appendInput.trim() || isAppending}
                                    >
                                        {isAppending ? (
                                            <RefreshCw size={16} className="spinner" />
                                        ) : (
                                            <Sparkles size={16} />
                                        )}
                                        {isAppending ? ' AI đang soạn...' : ' Yêu cầu AI bổ sung'}
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="result-actions">
                            <button className="btn btn-primary" style={{ padding: '10px 24px', color: 'white' }} onClick={handleSaveAndLearn} disabled={isSaving || isAppending}>
                                {isSaving ? 'Đang lưu...' : <><Save size={18} /> Lưu & Chọn từ học</>}
                            </button>
                        </div>
                    </div >
                )}
            </main >

            {/* ===== WORD LIST PANEL ===== */}
            {isLearnModalOpen && (
                <div className="topic-modal-backdrop" onClick={() => setIsLearnModalOpen(false)}>
                    <div className="topic-wordlist-panel" onClick={(e) => e.stopPropagation()}>
                        {/* Panel Header */}
                        <div className="wordlist-header">
                            <div className="wordlist-header-info">
                                <span className="wordlist-header-icon" style={{ background: `var(--color-primary-light)20` }}>
                                    ✨
                                </span>
                                <div>
                                    <h2 className="wordlist-title">{topic}</h2>
                                    <p className="wordlist-subtitle">
                                        {selectedWordsToLearn.size} từ được chọn
                                    </p>
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                {/* Only show reset button if we have a savedListId. Generated lists aren't "in progress" until saved. */}
                                {savedListId && (
                                    <button
                                        className="topic-modal-close"
                                        onClick={() => setIsResetConfirmOpen(true)}
                                        title="Reset tiến độ học"
                                        style={{ color: 'var(--color-error)' }}
                                    >
                                        <RotateCcw size={20} />
                                    </button>
                                )}
                                <button className="topic-modal-close" onClick={() => setIsLearnModalOpen(false)}>
                                    <X size={20} />
                                </button>
                            </div>
                        </div>

                        {/* Quick Actions */}
                        <div className="wordlist-actions">
                            <button className="wordlist-action-btn" onClick={() => setSelectedWordsToLearn(new Set(generatedList.map(w => w.word)))}>
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
                            {generatedList.map((w, idx) => {
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
                            <button className="btn btn-primary btn-lg btn-full topic-modal-start" onClick={handleStartLearning} disabled={selectedWordsToLearn.size === 0}>
                                {selectedWordsToLearn.size > 0 ? `🚀 Học nha!` : '🚀 Học 0 từ'}
                            </button>
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
                                        Bạn sắp xóa toàn bộ lịch sử học tập của danh sách này. Hành động này không thể hoàn tác.
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
                </div>
            )}
        </div >
    );
}
