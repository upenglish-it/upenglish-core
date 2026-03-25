import { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { getAdminTopicWords, saveAdminTopicWords, getAdminTopics, deleteAdminTopicWord, recalcTopicWordCount } from '../../services/adminService';
import { generateFullWordData } from '../../services/aiService';
import { prepareVocabImage, generateVocabImageLocal, uploadVocabImageBlob, deleteVocabImage } from '../../services/vocabImageService';
import { ArrowLeft, Plus, Edit, Trash2, Save, X, GripVertical, Bot, Sparkles, RefreshCw, ChevronDown, Zap, CheckCircle, AlertTriangle, FileJson, Search, Image as ImageIcon, Upload, Wand2 } from 'lucide-react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';

export default function AdminTopicWordsPage() {
    const { topicId } = useParams();
    const navigate = useNavigate();
    const [topicName, setTopicName] = useState('');
    const [words, setWords] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Modal state for Add/Edit Word
    const [wordFormOpen, setWordFormOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [wordFormData, setWordFormData] = useState({ word: '', vietnameseMeaning: '' });
    const [originalWord, setOriginalWord] = useState(''); // Used to replace existing word if the word itself changed (which is tricky in our schema, but let's allow it in memory and then batch save)
    const [alertMessage, setAlertMessage] = useState(null);
    const [wordToDelete, setWordToDelete] = useState(null);

    // Bulk Import State
    const [bulkImportOpen, setBulkImportOpen] = useState(false);
    const [bulkText, setBulkText] = useState('');
    const [bulkAiLevel, setBulkAiLevel] = useState('B1'); // For bulk list
    const [isGeneratingBulk, setIsGeneratingBulk] = useState(false);
    const [isBulkLevelOpen, setIsBulkLevelOpen] = useState(false);

    // Single Word Form AI State
    const [isAI, setIsAI] = useState(false);
    const [formAiLevel, setFormAiLevel] = useState('B1');
    const [isTypeOpen, setIsTypeOpen] = useState(false);
    const [isLevelOpen, setIsLevelOpen] = useState(false);

    // Content Generation State
    const [isGeneratingContent, setIsGeneratingContent] = useState(false);
    const [genProgress, setGenProgress] = useState({ current: 0, total: 0, currentWord: '' });
    const [wordSearchTerm, setWordSearchTerm] = useState('');

    // Image State
    const [isUploadingImage, setIsUploadingImage] = useState(false);
    const [isGeneratingImage, setIsGeneratingImage] = useState(false);
    const [imagePrompt, setImagePrompt] = useState('');
    const [pendingDeleteImages, setPendingDeleteImages] = useState([]);
    const [pendingImageBlob, setPendingImageBlob] = useState(null);
    const imageInputRef = useRef(null);

    useEffect(() => {
        loadData();
    }, [topicId]);

    async function loadData() {
        setLoading(true);
        try {
            // Find topic name just for display
            const allTopics = await getAdminTopics();
            const current = allTopics.find(t => t.id === topicId);
            if (current) setTopicName(current.name);
            else setTopicName(topicId);

            const wordsData = await getAdminTopicWords(topicId);
            // Sort by index if present, else by word
            wordsData.sort((a, b) => {
                if (a.index !== undefined && b.index !== undefined) return a.index - b.index;
                return a.word.localeCompare(b.word);
            });
            setWords(wordsData);
        } catch (error) {
            console.error(error);
        }
        setLoading(false);
    }

    function openAddForm() {
        setWordFormData({
            word: '', vietnameseMeaning: '', phonetic: '', partOfSpeech: '', image: '',
            explanation: '', pronunciationTip: '', distractors: [],
            exampleSentences: [{ en: '', vi: '' }], collocations: [], sentenceSequence: { en: '', vi: '' }
        });
        setFormAiLevel('B1');
        setIsEditing(false);
        setImagePrompt('');
        setPendingDeleteImages([]);
        setPendingImageBlob(null);
        setWordFormOpen(true);
    }

    function openEditForm(wordObj) {
        setWordFormData({ ...wordObj });
        setFormAiLevel(wordObj.level || 'B1');
        setOriginalWord(wordObj.word);
        setIsEditing(true);
        setImagePrompt('');
        setPendingDeleteImages([]);
        setPendingImageBlob(null);
        setWordFormOpen(true);
    }

    async function performAutoSave(newWordsArr, customSuccessMessage = null) {
        setSaving(true);
        try {
            await saveAdminTopicWords(topicId, newWordsArr);
            setWords(newWordsArr);
            if (customSuccessMessage) {
                setAlertMessage({ type: 'success', text: customSuccessMessage });
            }
        } catch (error) {
            console.error(error);
            setAlertMessage({ type: 'error', text: "Lỗi đồng bộ dữ liệu: " + error.message });
        }
        setSaving(false);
        // Fire-and-forget: recalc word count cache
        recalcTopicWordCount(topicId, 'topics').catch(() => {});
    }

    async function handleWordFormSubmit(e) {
        e.preventDefault();
        const trimmedWord = wordFormData.word.trim();
        if (!trimmedWord || !wordFormData.vietnameseMeaning.trim()) {
            setAlertMessage({ type: 'error', text: "Vui lòng nhập đủ Từ vựng và Nghĩa." });
            return;
        }

        // Upload pending image blob to Firebase if exists
        let finalFormData = { ...wordFormData, word: trimmedWord };
        if (pendingImageBlob) {
            try {
                const uploadedUrl = await uploadVocabImageBlob(pendingImageBlob);
                finalFormData.image = uploadedUrl;
            } catch (err) {
                setAlertMessage({ type: 'error', text: 'Lỗi upload ảnh: ' + err.message });
                return;
            }
        }

        const newWords = [...words];
        if (isEditing) {
            const idx = newWords.findIndex(w => w.word === originalWord);
            if (idx !== -1) {
                if (trimmedWord !== originalWord) {
                    try {
                        await deleteAdminTopicWord(topicId, originalWord);
                    } catch (err) {
                        console.error("Error deleting old word record during rename:", err);
                    }
                }
                newWords[idx] = finalFormData;
            }
        } else {
            if (newWords.some(w => w.word.toLowerCase() === trimmedWord.toLowerCase())) {
                setAlertMessage({ type: 'error', text: "Từ này đã tồn tại trong danh sách." });
                return;
            }
            newWords.push(finalFormData);
        }

        await performAutoSave(newWords, isEditing ? "Đã cập nhật từ vựng thành công!" : "Đã thêm từ vựng mới thành công!");

        // Delete pending old images from Firebase Storage
        for (const imgUrl of pendingDeleteImages) {
            await deleteVocabImage(imgUrl);
        }
        setPendingDeleteImages([]);
        setPendingImageBlob(null);
        setWordFormOpen(false);
    }

    async function handleAIFill() {
        if (!wordFormData.word.trim()) {
            setAlertMessage({ type: 'error', text: 'Vui lòng nhập từ muốn tạo bằng AI' });
            return;
        }
        setIsAI(true);
        try {
            const res = await generateFullWordData({
                topic: topicName || 'General',
                wordObj: {
                    word: wordFormData.word,
                    vietnameseMeaning: wordFormData.vietnameseMeaning || wordFormData.meaning || '',
                    partOfSpeech: wordFormData.partOfSpeech || wordFormData.pos || ''
                },
                level: formAiLevel
            });
            const posMap = {
                'noun': 'n.',
                'verb': 'v.',
                'adjective': 'adj.',
                'adverb': 'adv.',
                'preposition': 'prep.',
                'conjunction': 'conj.',
                'pronoun': 'pron.',
                'interjection': 'int.'
            };
            if (res) {
                let aiPos = res.partOfSpeech || res.pos;
                if (aiPos) {
                    const normalized = aiPos.toLowerCase().trim();
                    if (posMap[normalized]) aiPos = posMap[normalized];
                }
                setWordFormData(prev => ({
                    ...prev,
                    ...res,
                    partOfSpeech: aiPos || prev.partOfSpeech,
                    vietnameseMeaning: res.vietnameseMeaning || res.meaning || prev.vietnameseMeaning
                }));
            }
        } catch (error) {
            console.error("AI Gen Error", error);
            setAlertMessage({ type: 'error', text: "Lỗi tạo nội dung bằng AI. " + error.message });
        }
        setIsAI(false);
    }

    // --- BULK IMPORT HANDLERS ---
    async function handleBulkImportSubmit() {
        if (!bulkText.trim()) return;

        const lines = bulkText.split('\n').map(l => l.trim()).filter(Boolean);
        let parsedWords = [];

        setIsGeneratingBulk(true);
        try {
            // Processing in one batch up to 15 items
            const wordsToGen = lines.slice(0, 15);
            // Dynamic import specifically for new basic generator
            const { generateBasicWordsDetails } = await import('../../services/aiService');
            parsedWords = await generateBasicWordsDetails(wordsToGen, bulkAiLevel, topicName || topicId);
            if (parsedWords && parsedWords.length > 0) {
                // Attach the selected level so that single word AI generation inherits it later
                parsedWords = parsedWords.map(w => ({ ...w, level: bulkAiLevel }));
            }
        } catch (error) {
            console.error("Bulk AI Gen error:", error);
            setAlertMessage({ type: 'error', text: "Lỗi khi dùng AI tạo danh sách: " + (error.message || 'Lỗi không xác định') });
            setIsGeneratingBulk(false);
            return;
        }
        setIsGeneratingBulk(false);

        if (!parsedWords || parsedWords.length === 0) {
            setAlertMessage({ type: 'error', text: "Không tìm thấy từ hợp lệ nào để import." });
            return;
        }

        // Ensure unique words before appending
        const uniqueNewWords = parsedWords.filter(nw => !words.some(ew => ew.word.toLowerCase() === nw.word.toLowerCase()));

        if (uniqueNewWords.length === 0) {
            setAlertMessage({ type: 'error', text: "Tất cả các từ đã tồn tại trong chủ đề này." });
            return;
        }

        await performAutoSave([...words, ...uniqueNewWords], `Đã nhập và lưu thành công ${uniqueNewWords.length} từ vựng mới.`);
        setBulkImportOpen(false);
        setBulkText('');
    }

    function handleDeleteLocal(word) {
        setWordToDelete(word);
    }

    async function handleConfirmDelete() {
        if (!wordToDelete) return;
        setSaving(true);
        try {
            // Explicitly delete from Firestore first to prevent reappearing
            await deleteAdminTopicWord(topicId, wordToDelete);

            const newWords = words.filter(w => w.word !== wordToDelete);
            setWords(newWords);
            setWordToDelete(null);
            setAlertMessage({ type: 'success', text: `Đã xóa từ "${wordToDelete}" thành công!` });
        } catch (error) {
            console.error(error);
            setAlertMessage({ type: 'error', text: "Lỗi khi xóa từ vựng: " + error.message });
        }
        setSaving(false);
        // Fire-and-forget: recalc word count cache
        recalcTopicWordCount(topicId, 'topics').catch(() => {});
    }

    async function handleDragEnd(result) {
        if (!result.destination) return;
        if (result.destination.index === result.source.index) return;

        const items = Array.from(words);
        const [reorderedItem] = items.splice(result.source.index, 1);
        items.splice(result.destination.index, 0, reorderedItem);

        // Cập nhật lại thuộc tính index cho đúng với vị trí mới
        const updatedItems = items.map((item, idx) => ({ ...item, index: idx }));
        setWords(updatedItems); // Optimistic UI update
        await performAutoSave(updatedItems);
    }

    // Check if a word has full learning content
    function hasFullContent(w) {
        return !!(w.phonetic && w.distractors?.length && w.collocations?.length && w.exampleSentences?.length && w.sentenceSequence);
    }

    // Generate full content for all words missing data
    async function handleGenerateContent() {
        const wordsNeedingContent = words.filter(w => !hasFullContent(w));
        if (wordsNeedingContent.length === 0) {
            setAlertMessage({ type: 'success', text: 'Tất cả từ đã có đầy đủ nội dung học rồi! ✅' });
            return;
        }
        setIsGeneratingContent(true);
        setGenProgress({ current: 0, total: wordsNeedingContent.length, currentWord: '' });

        const updatedWords = [...words];
        let successCount = 0;
        let errorCount = 0;

        for (let i = 0; i < wordsNeedingContent.length; i++) {
            const w = wordsNeedingContent[i];
            setGenProgress({ current: i + 1, total: wordsNeedingContent.length, currentWord: w.word });

            try {
                const enriched = await generateFullWordData({
                    topic: topicName || topicId,
                    wordObj: w,
                    level: 'B1'
                });
                // Find and replace in updatedWords
                const idx = updatedWords.findIndex(uw => uw.word === w.word);
                if (idx !== -1) {
                    updatedWords[idx] = { ...updatedWords[idx], ...enriched };
                }
                successCount++;
            } catch (err) {
                console.error(`Error generating content for "${w.word}":`, err);
                errorCount++;
            }
        }

        setWords(updatedWords);

        // Auto-save to Firestore
        try {
            await saveAdminTopicWords(topicId, updatedWords);
        } catch (err) {
            console.error('Error saving after content generation:', err);
        }

        setIsGeneratingContent(false);
        if (errorCount === 0) {
            setAlertMessage({ type: 'success', text: `Đã sinh nội dung học cho ${successCount} từ và lưu thành công! ✅` });
        } else {
            setAlertMessage({ type: 'error', text: `Hoàn thành ${successCount}/${successCount + errorCount} từ. ${errorCount} từ bị lỗi.` });
        }
    }

    // Count words with full content
    const filteredWords = words.filter(w =>
        (w.word || '').toLowerCase().includes(wordSearchTerm.toLowerCase()) ||
        (w.vietnameseMeaning || '').toLowerCase().includes(wordSearchTerm.toLowerCase())
    );

    const fullContentCount = words.filter(hasFullContent).length;
    const totalWordsCount = words.length;

    return (
        <div className="admin-page">
            <button onClick={() => navigate(-1)} className="admin-btn admin-btn-secondary" style={{
                display: 'inline-flex',
                marginBottom: '16px',
                border: 'none',
                background: 'transparent',
                padding: '4px 8px',
                color: '#64748b',
                boxShadow: 'none',
                width: 'fit-content',
                cursor: 'pointer'
            }}>
                <ArrowLeft size={18} /> Quay lại
            </button>

            <div className="admin-page-header" style={{ alignItems: 'center', textAlign: 'center' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                    <h1 className="admin-page-title" style={{ margin: 0 }}>{topicName}</h1>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
                        <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '4px 10px',
                            background: '#eff6ff',
                            color: '#3b82f6',
                            borderRadius: '8px',
                            fontSize: '0.8rem',
                            fontWeight: 700,
                            border: '1px solid #bfdbfe'
                        }}>
                            📚 {topicName}
                        </span>
                        <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '4px 10px',
                            background: '#f1f5f9',
                            color: '#64748b',
                            borderRadius: '8px',
                            fontSize: '0.8rem',
                            fontWeight: 700,
                            border: '1px solid #e2e8f0'
                        }}>
                            <Sparkles size={14} /> {words.length} từ vựng
                        </span>
                    </div>
                </div>
                <div className="admin-header-actions" style={{ marginTop: '16px' }}>
                    {saving && <span style={{ fontSize: '0.85rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}><RefreshCw size={14} className="spinner" /> Đang lưu...</span>}
                    <button className="admin-btn admin-btn-secondary" onClick={() => setBulkImportOpen(true)}>
                        <FileJson size={18} /> Import hàng loạt
                    </button>
                    <button className="admin-btn admin-btn-primary" onClick={openAddForm}>
                        <Plus size={18} /> Thêm thủ công
                    </button>
                </div>
            </div>

            <div>
                <div className="admin-search-box">
                    <Search size={16} className="search-icon" />
                    <input
                        type="text"
                        placeholder="Tìm từ vựng hoặc nghĩa..."
                        value={wordSearchTerm}
                        onChange={e => setWordSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            {/* Content generation bar – separate from header buttons */}
            {
                totalWordsCount > 0 && (
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 12px',
                        background: fullContentCount === totalWordsCount ? '#f0fdf4' : '#fffbeb',
                        border: `1px solid ${fullContentCount === totalWordsCount ? '#bbf7d0' : '#fde68a'}`,
                        borderRadius: '8px',
                        fontSize: '0.85rem',
                        gap: '8px',
                        flexWrap: 'wrap'
                    }}>
                        <span style={{ color: fullContentCount === totalWordsCount ? '#16a34a' : '#92400e', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            {fullContentCount === totalWordsCount
                                ? <><CheckCircle size={16} /> Tất cả {totalWordsCount} từ đã có nội dung học đầy đủ</>
                                : <><AlertTriangle size={16} /> {fullContentCount}/{totalWordsCount} từ có nội dung học</>
                            }
                        </span>
                        {fullContentCount < totalWordsCount && (
                            <button
                                className="admin-btn admin-btn-secondary"
                                onClick={handleGenerateContent}
                                disabled={isGeneratingContent}
                                style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                            >
                                <Zap size={14} /> Sinh nội dung cho {totalWordsCount - fullContentCount} từ
                            </button>
                        )}
                    </div>
                )
            }

            {/* BULK IMPORT MODAL */}
            {
                bulkImportOpen && (
                    <div className="teacher-modal-overlay" style={{ zIndex: 2000 }}>
                        <div className="teacher-modal wide" style={{ maxWidth: '600px', width: '95%' }}>
                            <div style={{ position: 'sticky', top: '0px', zIndex: 100, display: 'flex', justifyContent: 'flex-end', height: 0, overflow: 'visible', pointerEvents: 'none' }}>
                                <button className="teacher-modal-close" onClick={() => setBulkImportOpen(false)} style={{ pointerEvents: 'auto', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, background: 'rgba(241, 245, 249, 0.95)', backdropFilter: 'blur(4px)', border: 'none', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
                                    <X size={20} />
                                </button>
                            </div>
                            <h2 className="admin-modal-title" style={{ justifyContent: 'flex-start', marginBottom: '16px', paddingRight: '40px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <FileJson size={24} color="#3b82f6" /> Import từ vựng hàng loạt
                                </div>
                            </h2>

                            <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', marginBottom: '16px', fontSize: '0.9rem', color: '#475569' }}>
                                <p style={{ margin: '0 0 8px 0', fontWeight: 600 }}>Hướng dẫn nhập tự động bằng AI:</p>
                                <ul style={{ margin: 0, paddingLeft: '20px' }}>
                                    <li>Chỉ cần dán các <strong>từ tiếng Anh</strong> (mỗi từ 1 dòng, tối đa 15 từ/lần)</li>
                                    <li>Hoặc có thể kèm theo nghĩa để AI dịch chính xác hơn (VD: <code style={{ color: '#ec4899' }}>apple, quả táo</code>)</li>
                                    <li>AI sẽ tự động điền Từ loại, Nghĩa tiếng Việt và Phiên âm cho từng từ.</li>
                                </ul>
                            </div>

                            <div className="admin-form-group" style={{ marginBottom: '16px' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                    Trình độ mục tiêu
                                    <div style={{ position: 'relative', width: '110px' }}>
                                        <button
                                            type="button"
                                            disabled={isGeneratingBulk}
                                            onClick={() => setIsBulkLevelOpen(o => !o)}
                                            style={{
                                                width: '100%', height: '38px', padding: '0 10px',
                                                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px',
                                                background: '#fff', border: '1.5px solid #cbd5e1', borderRadius: '8px',
                                                cursor: isGeneratingBulk ? 'not-allowed' : 'pointer', fontWeight: 700,
                                                fontSize: '0.9rem', color: '#0f172a', opacity: isGeneratingBulk ? 0.6 : 1
                                            }}
                                        >
                                            {bulkAiLevel}
                                            <ChevronDown size={14} style={{ color: '#64748b', transform: isBulkLevelOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                                        </button>
                                        {isBulkLevelOpen && !isGeneratingBulk && (
                                            <div style={{
                                                position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 9999,
                                                background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: '10px',
                                                boxShadow: '0 8px 24px rgba(0,0,0,0.12)', overflow: 'hidden', minWidth: '110px'
                                            }}>
                                                {['A0', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'].map(lvl => (
                                                    <div
                                                        key={lvl}
                                                        onClick={() => { setBulkAiLevel(lvl); setIsBulkLevelOpen(false); }}
                                                        style={{
                                                            padding: '8px 14px', cursor: 'pointer', fontWeight: lvl === bulkAiLevel ? 700 : 400,
                                                            background: lvl === bulkAiLevel ? '#eff6ff' : 'transparent',
                                                            color: lvl === bulkAiLevel ? '#3b82f6' : '#0f172a',
                                                            fontSize: '0.9rem', transition: 'background 0.15s'
                                                        }}
                                                        onMouseEnter={e => { if (lvl !== bulkAiLevel) e.currentTarget.style.background = '#f8fafc'; }}
                                                        onMouseLeave={e => { if (lvl !== bulkAiLevel) e.currentTarget.style.background = 'transparent'; }}
                                                    >
                                                        {lvl}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </label>
                            </div>

                            <div className="admin-form-group">
                                <textarea
                                    className="admin-form-input admin-form-textarea"
                                    rows="10"
                                    style={{ fontFamily: 'monospace' }}
                                    value={bulkText}
                                    onChange={e => setBulkText(e.target.value)}
                                    placeholder="apple&#10;banana&#10;orange&#10;hoặc&#10;apple, quả táo xanh&#10;banana, quả chuối tây"
                                    disabled={isGeneratingBulk}
                                />
                            </div>

                            <div className="admin-modal-actions" style={{ marginTop: '24px', flexDirection: 'row' }}>
                                <button className="admin-btn admin-btn-secondary" style={{ flex: 1 }} onClick={() => setBulkImportOpen(false)} disabled={isGeneratingBulk}>Hủy</button>
                                <button className="admin-btn admin-btn-primary" style={{ flex: 1 }} onClick={handleBulkImportSubmit} disabled={isGeneratingBulk || !bulkText.trim()}>
                                    {isGeneratingBulk ? 'AI đang xử lý...' : 'Nhập dữ liệu với AI'}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* DELETE MODAL */}
            {
                wordToDelete && (
                    <div className="teacher-modal-overlay" style={{ zIndex: 2000 }}>
                        <div className="teacher-modal">
                            <h2 className="admin-modal-title" style={{ color: '#ef4444', marginBottom: '16px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Trash2 size={24} /> Xác nhận xóa
                                </div>
                            </h2>
                            <p className="admin-modal-desc">
                                Bạn có chắc chắn muốn xóa từ vựng <strong>{wordToDelete}</strong> khỏi danh sách này?
                            </p>
                            <div className="admin-modal-actions" style={{ marginTop: '24px', flexDirection: 'row' }}>
                                <button className="admin-btn admin-btn-secondary" style={{ flex: 1 }} onClick={() => setWordToDelete(null)} disabled={saving}>Hủy</button>
                                <button className="admin-btn admin-btn-primary" style={{ backgroundColor: '#ef4444', flex: 1 }} onClick={handleConfirmDelete} disabled={saving}>
                                    {saving ? "Đang xóa..." : "Xóa từ vựng"}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            <div className="admin-card">
                {loading ? (
                    <div className="admin-empty-state">Đang tải danh sách từ vựng...</div>
                ) : words.length === 0 ? (
                    <div className="admin-empty-state">
                        <p>Chưa có từ vựng nào trong chủ đề này.</p>
                        <button className="admin-btn admin-btn-primary" onClick={openAddForm}>
                            <Plus size={16} /> Thêm từ đầu tiên
                        </button>
                    </div>
                ) : filteredWords.length === 0 ? (
                    <div className="admin-empty-state">
                        <p>Không tìm thấy từ vựng nào phù hợp với "{wordSearchTerm}".</p>
                    </div>
                ) : (
                    <div className="admin-table-container">
                        <DragDropContext onDragEnd={handleDragEnd}>
                            <table className="admin-table">
                                <thead>
                                    <tr>
                                        <th>#</th>
                                        <th>Từ vựng</th>
                                        <th>Nghĩa tiếng Việt</th>
                                        <th>Ảnh</th>
                                        <th className="text-right">Hành động</th>
                                    </tr>
                                </thead>
                                <Droppable droppableId="words-list">
                                    {(provided) => (
                                        <tbody {...provided.droppableProps} ref={provided.innerRef}>
                                            {filteredWords.map((w, index) => (
                                                <Draggable key={w.word || `idx-${index}`} draggableId={w.word || `idx-${index}`} index={index}>
                                                    {(provided, snapshot) => (
                                                        <tr
                                                            ref={provided.innerRef}
                                                            {...provided.draggableProps}
                                                            style={{
                                                                ...provided.draggableProps.style,
                                                                background: snapshot.isDragging ? '#f8fafc' : undefined,
                                                                boxShadow: snapshot.isDragging ? '0 5px 15px rgba(0,0,0,0.1)' : undefined,
                                                                display: snapshot.isDragging ? 'table-row' : undefined // Helps keeping structure in desktop sometimes
                                                                // On mobile it gets overwritten by block, which is fine
                                                            }}
                                                            className={snapshot.isDragging ? 'dragging' : ''}
                                                        >
                                                            <td data-label="#" className="admin-text-muted">
                                                                <div style={{ display: 'flex', alignItems: 'center', height: '100%', minHeight: '32px' }}>
                                                                    {!wordSearchTerm && (
                                                                        <div {...provided.dragHandleProps} style={{ display: 'flex', alignItems: 'center', cursor: 'grab', marginRight: '8px', color: '#94a3b8' }}>
                                                                            <GripVertical size={16} />
                                                                        </div>
                                                                    )}
                                                                    <span className="word-index">{index + 1}</span>
                                                                </div>
                                                            </td>
                                                            <td data-label="Từ vựng" style={{ fontWeight: 600, color: '#0f172a' }}>
                                                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                                                    {hasFullContent(w)
                                                                        ? <CheckCircle size={14} style={{ color: '#16a34a', flexShrink: 0 }} title="Đã có nội dung học đầy đủ" />
                                                                        : <AlertTriangle size={14} style={{ color: '#d97706', flexShrink: 0 }} title="Chưa có nội dung học" />
                                                                    }
                                                                    {w.word}
                                                                </span>
                                                            </td>
                                                            <td data-label="Nghĩa">{w.vietnameseMeaning}</td>
                                                            <td data-label="Ảnh">
                                                                {w.image && (
                                                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: '#10b981', background: '#ecfdf5', padding: '2px 8px', borderRadius: '12px', fontWeight: 600, border: '1px solid #a7f3d0' }}>
                                                                        <ImageIcon size={12} /> Có ảnh
                                                                    </span>
                                                                )}
                                                            </td>
                                                            <td data-label="Thao tác" className="text-right">
                                                                <div className="admin-table-actions">
                                                                    <button className="admin-action-btn" onClick={() => openEditForm(w)} title="Sửa"><Edit size={16} /></button>
                                                                    <button className="admin-action-btn danger" onClick={() => handleDeleteLocal(w.word)} title="Xóa khỏi danh sách"><Trash2 size={16} /></button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    )}
                                                </Draggable>
                                            ))}
                                            {provided.placeholder}
                                        </tbody>
                                    )}
                                </Droppable>
                            </table>
                        </DragDropContext>
                    </div>
                )}
            </div>

            {
                wordFormOpen && (
                    <div className="teacher-modal-overlay" style={{ zIndex: 2000 }}>
                        <div className="teacher-modal wide" style={{ maxWidth: '600px', width: '95%', overflow: 'auto' }}>
                            <div style={{ position: 'sticky', top: '0px', zIndex: 100, display: 'flex', justifyContent: 'flex-end', height: 0, overflow: 'visible', pointerEvents: 'none' }}>
                                <button className="teacher-modal-close" type="button" onClick={() => setWordFormOpen(false)} style={{ pointerEvents: 'auto', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, background: 'rgba(241, 245, 249, 0.95)', backdropFilter: 'blur(4px)', border: 'none', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
                                    <X size={20} />
                                </button>
                            </div>
                            <h2 className="admin-modal-title" style={{ justifyContent: 'flex-start', marginBottom: '16px', paddingRight: '40px' }}>
                                {isEditing ? 'Sửa Từ vựng' : 'Thêm Từ vựng mới'}
                            </h2>
                            <form onSubmit={handleWordFormSubmit}>
                                <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
                                    <div className="admin-form-group" style={{ flex: '1 1 120px', minWidth: '120px', margin: 0 }}>
                                        <label>Từ tiếng Anh</label>
                                        <input type="text" className="admin-form-input" style={{ height: '42px' }} required value={wordFormData.word} onChange={e => setWordFormData({ ...wordFormData, word: e.target.value })} placeholder="Ví dụ: negotiate" />
                                    </div>
                                    <div className="admin-form-group" style={{ flex: '0 0 80px', width: '80px', margin: 0 }}>
                                        <label>Loại từ</label>
                                        <div style={{ position: 'relative' }}>
                                            <button
                                                type="button"
                                                onClick={() => { setIsTypeOpen(o => !o); setIsLevelOpen(false); }}
                                                style={{
                                                    width: '100%', height: '42px', padding: '0 8px',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4px',
                                                    background: '#fff', border: '1.5px solid #cbd5e1', borderRadius: '8px',
                                                    cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem', color: '#0f172a'
                                                }}
                                            >
                                                {wordFormData.partOfSpeech || '--'}
                                                <ChevronDown size={12} style={{ color: '#64748b', transform: isTypeOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }} />
                                            </button>
                                            {isTypeOpen && (
                                                <div style={{
                                                    position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 9999,
                                                    background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: '10px',
                                                    boxShadow: '0 8px 24px rgba(0,0,0,0.12)', overflow: 'hidden', minWidth: '100px'
                                                }}>
                                                    {['--', 'n.', 'v.', 'adj.', 'adv.', 'prep.', 'conj.', 'pron.', 'int.', 'phrase', 'idiom'].map(pos => {
                                                        const val = pos === '--' ? '' : pos;
                                                        const isSelected = (wordFormData.partOfSpeech || '') === val;
                                                        return (
                                                            <div
                                                                key={pos}
                                                                onClick={() => { setWordFormData({ ...wordFormData, partOfSpeech: val }); setIsTypeOpen(false); }}
                                                                style={{
                                                                    padding: '7px 12px', cursor: 'pointer',
                                                                    fontWeight: isSelected ? 700 : 400,
                                                                    background: isSelected ? '#eff6ff' : 'transparent',
                                                                    color: isSelected ? '#3b82f6' : '#0f172a',
                                                                    fontSize: '0.85rem'
                                                                }}
                                                                onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = '#f8fafc'; }}
                                                                onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
                                                            >
                                                                {pos}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="admin-form-group" style={{ flex: '0 0 70px', width: '70px', margin: 0 }}>
                                        <label>Trình độ</label>
                                        <div style={{ position: 'relative' }}>
                                            <button
                                                type="button"
                                                disabled={isAI}
                                                onClick={() => { setIsLevelOpen(o => !o); setIsTypeOpen(false); }}
                                                style={{
                                                    width: '100%', height: '42px', padding: '0 8px',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4px',
                                                    background: '#fff', border: '1.5px solid #cbd5e1', borderRadius: '8px',
                                                    cursor: isAI ? 'not-allowed' : 'pointer', fontWeight: 700,
                                                    fontSize: '0.9rem', color: '#0f172a', opacity: isAI ? 0.6 : 1
                                                }}
                                            >
                                                {formAiLevel}
                                                <ChevronDown size={12} style={{ color: '#64748b', transform: isLevelOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }} />
                                            </button>
                                            {isLevelOpen && !isAI && (
                                                <div style={{
                                                    position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 9999,
                                                    background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: '10px',
                                                    boxShadow: '0 8px 24px rgba(0,0,0,0.12)', overflow: 'hidden', minWidth: '90px'
                                                }}>
                                                    {['A0', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'].map(lvl => (
                                                        <div
                                                            key={lvl}
                                                            onClick={() => { setFormAiLevel(lvl); setWordFormData(prev => ({ ...prev, level: lvl })); setIsLevelOpen(false); }}
                                                            style={{
                                                                padding: '7px 12px', cursor: 'pointer',
                                                                fontWeight: lvl === formAiLevel ? 700 : 400,
                                                                background: lvl === formAiLevel ? '#eff6ff' : 'transparent',
                                                                color: lvl === formAiLevel ? '#3b82f6' : '#0f172a',
                                                                fontSize: '0.9rem'
                                                            }}
                                                            onMouseEnter={e => { if (lvl !== formAiLevel) e.currentTarget.style.background = '#f8fafc'; }}
                                                            onMouseLeave={e => { if (lvl !== formAiLevel) e.currentTarget.style.background = 'transparent'; }}
                                                        >
                                                            {lvl}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'flex-end', flex: '1 1 140px', minWidth: '140px' }}>
                                        <button type="button" className="admin-btn admin-btn-secondary" onClick={handleAIFill} disabled={isAI} style={{ height: '42px', width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '4px', background: '#eff6ff', color: '#3b82f6', borderColor: '#bfdbfe' }}>
                                            <Sparkles size={16} /> {isAI ? 'Đang tạo...' : 'Điền tiếp bằng AI'}
                                        </button>
                                    </div>
                                </div>

                                <div className="admin-form-group">
                                    <label>Nghĩa tiếng Việt</label>
                                    <input type="text" className="admin-form-input" required value={wordFormData.vietnameseMeaning} onChange={e => setWordFormData({ ...wordFormData, vietnameseMeaning: e.target.value })} placeholder="thương lượng" />
                                </div>

                                {/* Image Section */}
                                <hr style={{ border: 'none', borderTop: '1px solid #e2e8f0', margin: '16px 0' }} />
                                <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '12px', fontWeight: 600 }}>
                                    Ảnh minh hoạ
                                </p>
                                <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start', marginBottom: '16px' }}>
                                    {/* Left: Image Preview */}
                                    <div style={{
                                        width: '120px', minWidth: '120px', height: '120px',
                                        borderRadius: '12px', overflow: 'hidden',
                                        borderWidth: '2px', borderStyle: wordFormData.image ? 'solid' : 'dashed',
                                        borderColor: wordFormData.image ? '#e2e8f0' : '#cbd5e1',
                                        background: '#f8fafc',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        position: 'relative'
                                    }}>
                                        {wordFormData.image ? (
                                            <>
                                                <img src={wordFormData.image} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                <button type="button" onClick={() => {
                                                    if (wordFormData.image && wordFormData.image.startsWith('http')) {
                                                        setPendingDeleteImages(prev => [...prev, wordFormData.image]);
                                                    }
                                                    setPendingImageBlob(null);
                                                    setWordFormData(prev => ({ ...prev, image: '' }));
                                                }} style={{
                                                    position: 'absolute', top: '3px', right: '3px',
                                                    width: '22px', height: '22px', borderRadius: '50%',
                                                    background: 'rgba(239, 68, 68, 0.9)', color: '#fff',
                                                    border: 'none', cursor: 'pointer', display: 'flex',
                                                    alignItems: 'center', justifyContent: 'center',
                                                    boxShadow: '0 1px 3px rgba(0,0,0,0.3)'
                                                }} title="Xóa ảnh">
                                                    <X size={11} />
                                                </button>
                                            </>
                                        ) : (
                                            <ImageIcon size={28} style={{ color: '#cbd5e1' }} />
                                        )}
                                    </div>

                                    {/* Right: Controls */}
                                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        <input type="file" accept="image/*" ref={imageInputRef} style={{ display: 'none' }} onChange={async (e) => {
                                            const file = e.target.files?.[0];
                                            if (!file) return;
                                            setIsUploadingImage(true);
                                            try {
                                                // Track old image for pending delete (only if it's a Firebase URL)
                                                if (wordFormData.image && wordFormData.image.startsWith('http')) {
                                                    setPendingDeleteImages(prev => [...prev, wordFormData.image]);
                                                }
                                                const { blob, previewUrl } = await prepareVocabImage(file);
                                                setPendingImageBlob(blob);
                                                setWordFormData(prev => ({ ...prev, image: previewUrl }));
                                            } catch (err) {
                                                setAlertMessage({ type: 'error', text: 'Lỗi xử lý ảnh: ' + err.message });
                                            }
                                            setIsUploadingImage(false);
                                            e.target.value = '';
                                        }} />
                                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                            <button type="button" onClick={() => imageInputRef.current?.click()} disabled={isUploadingImage || isGeneratingImage}
                                                style={{
                                                    display: 'flex', alignItems: 'center', gap: '5px',
                                                    padding: '6px 12px', fontSize: '0.8rem', fontWeight: 600,
                                                    background: '#f1f5f9', color: '#334155', border: '1.5px solid #cbd5e1',
                                                    borderRadius: '8px', cursor: (isUploadingImage || isGeneratingImage) ? 'not-allowed' : 'pointer',
                                                    opacity: (isUploadingImage || isGeneratingImage) ? 0.6 : 1
                                                }}>
                                                <Upload size={13} /> {isUploadingImage ? 'Đang tải...' : (wordFormData.image ? 'Thay ảnh' : 'Upload ảnh')}
                                            </button>
                                            <button type="button" onClick={async () => {
                                                if (!wordFormData.word.trim()) {
                                                    setAlertMessage({ type: 'error', text: 'Vui lòng nhập từ tiếng Anh trước khi tạo ảnh AI' });
                                                    return;
                                                }
                                                setIsGeneratingImage(true);
                                                try {
                                                    // Track old image for pending delete (only if it's a Firebase URL)
                                                    if (wordFormData.image && wordFormData.image.startsWith('http')) {
                                                        setPendingDeleteImages(prev => [...prev, wordFormData.image]);
                                                    }
                                                    const { blob, previewUrl } = await generateVocabImageLocal(
                                                        wordFormData.word,
                                                        wordFormData.vietnameseMeaning || '',
                                                        imagePrompt.trim() || undefined
                                                    );
                                                    setPendingImageBlob(blob);
                                                    setWordFormData(prev => ({ ...prev, image: previewUrl }));
                                                } catch (err) {
                                                    setAlertMessage({ type: 'error', text: 'Lỗi tạo ảnh AI: ' + err.message });
                                                }
                                                setIsGeneratingImage(false);
                                            }} disabled={isUploadingImage || isGeneratingImage}
                                                style={{
                                                    display: 'flex', alignItems: 'center', gap: '5px',
                                                    padding: '6px 12px', fontSize: '0.8rem', fontWeight: 600,
                                                    background: '#eff6ff', color: '#3b82f6', border: '1.5px solid #bfdbfe',
                                                    borderRadius: '8px', cursor: (isUploadingImage || isGeneratingImage) ? 'not-allowed' : 'pointer',
                                                    opacity: (isUploadingImage || isGeneratingImage) ? 0.6 : 1
                                                }}>
                                                <Wand2 size={13} /> {isGeneratingImage ? 'AI đang tạo...' : 'Tạo ảnh AI'}
                                            </button>
                                        </div>
                                        <textarea
                                            value={imagePrompt || `A clear, simple illustration representing the concept "${wordFormData.word || '...'}" (${wordFormData.vietnameseMeaning || '...'}). Flat design style, educational illustration, clean white background, no text, no letters, vibrant colors, centered composition.`}
                                            onChange={e => setImagePrompt(e.target.value)}
                                            placeholder="Prompt tạo ảnh AI..."
                                            rows={2}
                                            className="admin-form-input"
                                            style={{ fontSize: '0.72rem', color: '#94a3b8', resize: 'vertical', lineHeight: '1.4' }}
                                        />
                                    </div>
                                </div>

                                <hr style={{ border: 'none', borderTop: '1px solid #e2e8f0', margin: '16px 0' }} />
                                <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '12px', fontWeight: 600 }}>
                                    Nội dung 6 bước học
                                </p>

                                <div className="admin-form-group">
                                    <label>Phiên âm (IPA)</label>
                                    <input type="text" className="admin-form-input" value={wordFormData.phonetic || ''} onChange={e => setWordFormData({ ...wordFormData, phonetic: e.target.value })} placeholder="/nɪˈɡoʊ.ʃi.eɪt/" />
                                </div>

                                <div className="admin-form-group">
                                    <label>Giải thích (Việt)</label>
                                    <textarea className="admin-form-input" rows={2} value={wordFormData.explanation || ''} onChange={e => setWordFormData({ ...wordFormData, explanation: e.target.value })} placeholder="Giải thích chi tiết bằng tiếng Việt..." />
                                </div>

                                <div className="admin-form-group">
                                    <label>Mẹo phát âm</label>
                                    <input type="text" className="admin-form-input" value={wordFormData.pronunciationTip || ''} onChange={e => setWordFormData({ ...wordFormData, pronunciationTip: e.target.value })} placeholder="Nhấn trọng âm ở âm tiết thứ 2..." />
                                </div>

                                <div className="admin-form-group">
                                    <label>Từ gây nhiễu - Listening (3 từ, cách nhau bởi dấu phẩy)</label>
                                    <input type="text" className="admin-form-input"
                                        value={(wordFormData.distractors || []).join(', ')}
                                        onChange={e => setWordFormData({ ...wordFormData, distractors: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                                        placeholder="navigate, negligent, nominate" />
                                </div>

                                <div className="admin-form-group">
                                    <label>Câu ví dụ (Anh)</label>
                                    <input type="text" className="admin-form-input"
                                        value={wordFormData.exampleSentences?.[0]?.en || ''}
                                        onChange={e => {
                                            const es = [...(wordFormData.exampleSentences || [{ en: '', vi: '' }])];
                                            es[0] = { ...es[0], en: e.target.value };
                                            setWordFormData({ ...wordFormData, exampleSentences: es });
                                        }}
                                        placeholder="They spent weeks negotiating the contract." />
                                </div>
                                <div className="admin-form-group">
                                    <label>Câu ví dụ (Việt)</label>
                                    <input type="text" className="admin-form-input"
                                        value={wordFormData.exampleSentences?.[0]?.vi || ''}
                                        onChange={e => {
                                            const es = [...(wordFormData.exampleSentences || [{ en: '', vi: '' }])];
                                            es[0] = { ...es[0], vi: e.target.value };
                                            setWordFormData({ ...wordFormData, exampleSentences: es });
                                        }}
                                        placeholder="Họ đã dành nhiều tuần để đàm phán hợp đồng." />
                                </div>

                                <hr style={{ border: 'none', borderTop: '1px solid #e2e8f0', margin: '12px 0' }} />
                                <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '8px', fontWeight: 600 }}>Collocations</p>
                                {(wordFormData.collocations || []).map((col, ci) => {
                                    const isObj = typeof col === 'object' && col !== null;
                                    const phraseVal = isObj ? col.phrase : col;
                                    const vietVal = isObj ? col.vietnamese : '';
                                    return (
                                        <div key={ci} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '8px', marginBottom: '6px' }}>
                                            <input type="text" className="admin-form-input" placeholder="negotiate a deal" value={phraseVal || ''}
                                                onChange={e => {
                                                    const cols = [...(wordFormData.collocations || [])];
                                                    cols[ci] = { phrase: e.target.value, vietnamese: vietVal };
                                                    setWordFormData({ ...wordFormData, collocations: cols });
                                                }} />
                                            <input type="text" className="admin-form-input" placeholder="thương lượng thỏa thuận" value={vietVal || ''}
                                                onChange={e => {
                                                    const cols = [...(wordFormData.collocations || [])];
                                                    cols[ci] = { phrase: phraseVal, vietnamese: e.target.value };
                                                    setWordFormData({ ...wordFormData, collocations: cols });
                                                }} />
                                            <button type="button" onClick={() => {
                                                const cols = (wordFormData.collocations || []).filter((_, i) => i !== ci);
                                                setWordFormData({ ...wordFormData, collocations: cols });
                                            }} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px' }}><X size={16} /></button>
                                        </div>
                                    );
                                })}
                                <button type="button" onClick={() => {
                                    const cols = [...(wordFormData.collocations || []), { phrase: '', vietnamese: '' }];
                                    setWordFormData({ ...wordFormData, collocations: cols });
                                }} style={{ fontSize: '0.8rem', color: '#4f46e5', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0' }}>
                                    + Thêm collocation
                                </button>

                                <hr style={{ border: 'none', borderTop: '1px solid #e2e8f0', margin: '12px 0' }} />
                                <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '8px', fontWeight: 600 }}>Bài tập Collocation</p>
                                <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '8px', marginTop: '-4px' }}>
                                    Câu hỏi điền từ — học viên chọn từ phù hợp để ghép với từ đang học. Dùng "___" để đánh dấu chỗ trống.
                                </p>
                                <div className="admin-form-group">
                                    <label>Câu tiếng Anh (chứa ___)</label>
                                    <input type="text" className="admin-form-input"
                                        value={wordFormData.collocationExercise?.sentence || ''}
                                        onChange={e => setWordFormData({ ...wordFormData, collocationExercise: { ...(wordFormData.collocationExercise || {}), sentence: e.target.value } })}
                                        placeholder="We must ___ the deadline for the project." />
                                </div>
                                <div className="admin-form-group">
                                    <label>Dịch Việt câu trên</label>
                                    <input type="text" className="admin-form-input"
                                        value={wordFormData.collocationExercise?.sentenceVi || ''}
                                        onChange={e => setWordFormData({ ...wordFormData, collocationExercise: { ...(wordFormData.collocationExercise || {}), sentenceVi: e.target.value } })}
                                        placeholder="Chúng ta phải hoàn thành đúng hạn chót cho dự án." />
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                    <div className="admin-form-group">
                                        <label>Đáp án đúng</label>
                                        <input type="text" className="admin-form-input"
                                            value={wordFormData.collocationExercise?.answer || ''}
                                            onChange={e => setWordFormData({ ...wordFormData, collocationExercise: { ...(wordFormData.collocationExercise || {}), answer: e.target.value } })}
                                            placeholder="meet" />
                                    </div>
                                    <div className="admin-form-group">
                                        <label>Các lựa chọn (cách nhau bởi dấu phẩy)</label>
                                        <input type="text" className="admin-form-input"
                                            value={(wordFormData.collocationExercise?.options || []).join(', ')}
                                            onChange={e => setWordFormData({ ...wordFormData, collocationExercise: { ...(wordFormData.collocationExercise || {}), options: e.target.value.split(',').map(s => s.trim()).filter(Boolean) } })}
                                            placeholder="meet, do, make, take" />
                                    </div>
                                </div>

                                <hr style={{ border: 'none', borderTop: '1px solid #e2e8f0', margin: '12px 0' }} />
                                <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '8px', fontWeight: 600 }}>Sắp xếp câu (Sentence Sequence)</p>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                    <div className="admin-form-group">
                                        <label>Câu tiếng Anh</label>
                                        <input type="text" className="admin-form-input"
                                            value={wordFormData.sentenceSequence?.en || ''}
                                            onChange={e => setWordFormData({ ...wordFormData, sentenceSequence: { ...(wordFormData.sentenceSequence || {}), en: e.target.value } })}
                                            placeholder="We negotiated with the client." />
                                    </div>
                                    <div className="admin-form-group">
                                        <label>Dịch Việt</label>
                                        <input type="text" className="admin-form-input"
                                            value={wordFormData.sentenceSequence?.vi || ''}
                                            onChange={e => setWordFormData({ ...wordFormData, sentenceSequence: { ...(wordFormData.sentenceSequence || {}), vi: e.target.value } })}
                                            placeholder="Chúng tôi đã đàm phán với khách hàng." />
                                    </div>
                                </div>

                                <div className="admin-modal-actions" style={{ marginTop: '24px', flexDirection: 'row' }}>
                                    <button type="button" className="admin-btn admin-btn-secondary" style={{ flex: 1 }} onClick={() => setWordFormOpen(false)} disabled={isAI || isUploadingImage || isGeneratingImage}>Hủy</button>
                                    <button type="submit" className="admin-btn admin-btn-primary" style={{ flex: 1 }} disabled={isAI || isUploadingImage || isGeneratingImage}>{isEditing ? 'Cập nhật' : 'Thêm'}</button>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }

            {/* Content Generation Progress Modal */}
            {
                isGeneratingContent && (
                    <div className="teacher-modal-overlay">
                        <div className="teacher-modal" style={{ maxWidth: '420px' }}>
                            <h2 className="admin-modal-title" style={{ gap: '8px' }}>
                                <Sparkles size={20} style={{ color: '#4f46e5' }} />
                                Đang sinh nội dung học...
                            </h2>
                            <p className="admin-modal-desc" style={{ margin: '16px 0 8px' }}>
                                Đang xử lý: <strong>{genProgress.currentWord}</strong> ({genProgress.current}/{genProgress.total})
                            </p>
                            <div style={{
                                width: '100%',
                                height: '8px',
                                background: '#e2e8f0',
                                borderRadius: '99px',
                                overflow: 'hidden',
                                marginBottom: '12px'
                            }}>
                                <div style={{
                                    width: `${genProgress.total > 0 ? (genProgress.current / genProgress.total) * 100 : 0}%`,
                                    height: '100%',
                                    background: 'linear-gradient(90deg, #4f46e5, #6366f1)',
                                    borderRadius: '99px',
                                    transition: 'width 0.5s ease'
                                }} />
                            </div>
                            <p style={{ fontSize: '0.8rem', color: '#94a3b8', textAlign: 'center' }}>
                                AI đang tạo nội dung cho 6 bước học. Vui lòng đợi...
                            </p>
                        </div>
                    </div>
                )
            }

            {
                alertMessage && (
                    <div className="teacher-modal-overlay">
                        <div className="teacher-modal">
                            <h2 className="admin-modal-title">
                                {alertMessage.type === 'success' ? <span style={{ color: '#10b981' }}>Thành công</span> : <span style={{ color: '#ef4444' }}>Đã có lỗi</span>}
                            </h2>
                            <p className="admin-modal-desc">
                                {alertMessage.text}
                            </p>
                            <div className="admin-modal-actions" style={{ flexDirection: 'row' }}>
                                <button className="admin-btn admin-btn-primary" style={{ flex: 1 }} onClick={() => setAlertMessage(null)}>Đóng</button>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
}
