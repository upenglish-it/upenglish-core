import { useState, useEffect, useRef } from 'react';
import { useParams, Link, useLocation, useNavigate } from 'react-router-dom';
import { generateWordsDetails, generateFullWordData } from '../../services/aiService';
import { getAdminTopics, getAdminTopicWords, recalcTopicWordCount } from '../../services/adminService';
import { getTeacherTopic, getTeacherTopicWords, saveTeacherTopicWord, deleteTeacherTopicWord, updateTeacherTopicWordOrder, saveMultipleTeacherTopicWords } from '../../services/teacherService';
import { prepareVocabImage, generateVocabImageLocal, uploadVocabImageBlob, deleteVocabImageIfUnused } from '../../services/vocabImageService';
import { ArrowLeft, Plus, Edit, Trash2, X, FileJson, Sparkles, Image as ImageIcon, CheckCircle, AlertTriangle, GripVertical, Zap, Upload, Wand2, Eye, Lock } from 'lucide-react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { useAuth } from '../../contexts/AuthContext';

export default function TeacherTopicWordsPage() {
    const { topicId } = useParams();
    const location = useLocation();
    const navigate = useNavigate();
    const isAdminView = location.pathname.startsWith('/admin/');
    const isSystemTopic = location.pathname.includes('/system-topics/');
    const { user } = useAuth();
    const [topic, setTopic] = useState(null);
    const [words, setWords] = useState([]);
    const [loading, setLoading] = useState(true);
    const [alertMessage, setAlertMessage] = useState(null);
    const [isSaving, setIsSaving] = useState(false);

    // Single Word Form States
    const [wordFormOpen, setWordFormOpen] = useState(false);
    const [isEditingWord, setIsEditingWord] = useState(false);
    const [wordFormData, setWordFormData] = useState({ id: '', word: '', pos: 'n.', ipa: '', meaning: '', image: '', usage1: '', usage2: '', collocations: [] });
    const [wordToDelete, setWordToDelete] = useState(null);

    // Single Word Form AI State
    const [isAI, setIsAI] = useState(false);
    const [aiLevel, setAiLevel] = useState('B1'); // For single word

    // Bulk Import State
    const [bulkImportOpen, setBulkImportOpen] = useState(false);
    const [bulkText, setBulkText] = useState('');
    const [bulkAiLevel, setBulkAiLevel] = useState('B1'); // For bulk list
    const [isGeneratingBulk, setIsGeneratingBulk] = useState(false);

    // Content Generation State
    const [isGeneratingContent, setIsGeneratingContent] = useState(false);
    const [genProgress, setGenProgress] = useState({ current: 0, total: 0, currentWord: '' });

    // Image State
    const [isUploadingImage, setIsUploadingImage] = useState(false);
    const [isGeneratingImage, setIsGeneratingImage] = useState(false);
    const [imagePrompt, setImagePrompt] = useState('');
    const [pendingDeleteImages, setPendingDeleteImages] = useState([]);
    const [pendingImageBlob, setPendingImageBlob] = useState(null);
    const imageInputRef = useRef(null);

    // Read-only State for Shared Topics
    const [isReadOnly, setIsReadOnly] = useState(isSystemTopic);

    useEffect(() => {
        loadData();
    }, [topicId, user?.uid, isSystemTopic]);

    async function loadData(silent = false) {
        if (!silent) setLoading(true);
        try {
            if (isSystemTopic) {
                // Fetch Admin (System) Topic Info
                const adminTopics = await getAdminTopics();
                const foundTopic = adminTopics.find(t => t.id === topicId);
                if (foundTopic) {
                    setTopic({ ...foundTopic, isAdmin: true });
                } else {
                    setAlertMessage({ type: 'error', text: 'Chủ đề hệ thống không tồn tại.' });
                    if (!silent) setLoading(false);
                    return;
                }

                // Fetch Admin Words
                const wordsData = await getAdminTopicWords(topicId);
                wordsData.sort((a, b) => {
                    if (a.index !== undefined && b.index !== undefined) return a.index - b.index;
                    return a.word.localeCompare(b.word);
                });
                setWords(wordsData);
            } else {
                // Check topic existence/ownership for Teacher Topic
                const topicData = await getTeacherTopic(topicId);
                if (topicData) {
                    setTopic({ id: topicData.id || topicData._id, ...topicData });

                    // Determine if the user is the owner, a collaborator, or an admin
                    const isOwner = topicData.teacherId === user?.uid;
                    const isCollaborator = topicData.collaboratorIds?.includes(user?.uid) || false;
                    const collabRole = (topicData.collaboratorRoles || {})[user?.uid] || 'editor';
                    if (!isOwner && !(isCollaborator && collabRole === 'editor') && !isAdminView) {
                        setIsReadOnly(true);
                    } else {
                        setIsReadOnly(false);
                    }
                } else {
                    setAlertMessage({ type: 'error', text: 'Chủ đề không tồn tại hoặc bạn không có quyền truy cập.' });
                    return;
                }

                const wordsData = await getTeacherTopicWords(topicId);
                wordsData.sort((a, b) => {
                    if (a.index !== undefined && b.index !== undefined) return a.index - b.index;
                    return a.word.localeCompare(b.word);
                });
                setWords(wordsData);
            }
        } catch (error) {
            console.error(error);
            setAlertMessage({ type: 'error', text: 'Lỗi tải dữ liệu: ' + error.message });
        }
        setLoading(false);
    }

    // --- FORM HANDLERS ---
    function openAddWordForm() {
        setWordFormData({
            id: '', word: '', vietnameseMeaning: '', phonetic: '', partOfSpeech: '', image: '',
            explanation: '', pronunciationTip: '', distractors: [],
            exampleSentences: [{ en: '', vi: '' }], collocations: [], sentenceSequence: { en: '', vi: '' }
        });
        setAiLevel('B1');
        setIsEditingWord(false);
        setImagePrompt('');
        setPendingDeleteImages([]);
        setPendingImageBlob(null);
        setWordFormOpen(true);
    }

    function openEditWordForm(wordData) {
        setWordFormData({ ...wordData, id: wordData.id || wordData.word });
        setAiLevel(wordData.level || 'B1');
        setIsEditingWord(true);
        setImagePrompt('');
        setPendingDeleteImages([]);
        setPendingImageBlob(null);
        setWordFormOpen(true);
    }

    async function handleWordSubmit(e) {
        e.preventDefault();
        setIsSaving(true);
        try {
            // Upload pending image blob to Firebase if exists
            let finalData = { ...wordFormData };
            if (pendingImageBlob) {
                const uploadedUrl = await uploadVocabImageBlob(pendingImageBlob);
                finalData.image = uploadedUrl;
            }

            await saveTeacherTopicWord(topicId, finalData);

            // Delete pending old images from Firebase Storage
            for (const imgUrl of pendingDeleteImages) {
                await deleteVocabImageIfUnused(imgUrl);
            }
            setPendingDeleteImages([]);
            setPendingImageBlob(null);

            setWordFormOpen(false);
            setAlertMessage({ type: 'success', text: isEditingWord ? "Cập nhật từ vựng thành công!" : "Thêm từ vựng mới thành công!" });
            loadData(true);
        } catch (error) {
            setAlertMessage({ type: 'error', text: "Lỗi lưu từ vựng: " + error.message });
        }
        setIsSaving(false);
        // Fire-and-forget: recalc word count cache
        if (!isSystemTopic) recalcTopicWordCount(topicId, 'teacher_topics').catch(() => {});
    }

    async function handleConfirmDeleteWord() {
        if (!wordToDelete) return;
        try {
            const deleteId = wordToDelete.id || wordToDelete.word;
            await deleteTeacherTopicWord(topicId, deleteId);
            setWords(prev => prev.filter(w => (w.id || w.word) !== deleteId));
            setAlertMessage({ type: 'success', text: "Đã xóa từ vựng thành công!" });
        } catch (error) {
            setAlertMessage({ type: 'error', text: "Lỗi xóa từ vựng: " + error.message });
        }
        setWordToDelete(null);
        // Fire-and-forget: recalc word count cache
        if (!isSystemTopic) recalcTopicWordCount(topicId, 'teacher_topics').catch(() => {});
    }

    async function handleAIFill() {
        if (!wordFormData.word.trim()) {
            setAlertMessage({ type: 'error', text: 'Vui lòng nhập từ muốn tạo bằng AI' });
            return;
        }
        setIsAI(true);
        try {
            const res = await generateFullWordData({
                topic: topic?.name || 'General',
                wordObj: {
                    word: wordFormData.word,
                    vietnameseMeaning: wordFormData.vietnameseMeaning || wordFormData.meaning || '',
                    partOfSpeech: wordFormData.partOfSpeech || wordFormData.pos || ''
                },
                level: aiLevel
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
                    pos: aiPos || prev.pos
                }));
            }
        } catch (error) {
            console.error("AI Gen Error", error);
            setAlertMessage({ type: 'error', text: "Lỗi tạo nội dung bằng AI. " + error.message });
        }
        setIsAI(false);
    }

    async function handleDragEnd(result) {
        if (!result.destination) return;
        const items = Array.from(words);
        const [reorderedItem] = items.splice(result.source.index, 1);
        items.splice(result.destination.index, 0, reorderedItem);

        // Update local sequence
        const updatedItems = items.map((item, idx) => ({ ...item, index: idx }));
        setWords(updatedItems);

        // Auto-save the new sequence using updateTeacherTopicWordOrder
        try {
            await updateTeacherTopicWordOrder(topicId, updatedItems);
        } catch (error) {
            setAlertMessage({ type: 'error', text: 'Lỗi lưu thứ tự mới: ' + error.message });
            loadData(true); // revert
        }
    }

    // --- BULK IMPORT HANDLERS ---
    async function handleBulkImportSubmit() {
        if (!bulkText.trim()) return;

        const lines = bulkText.split('\n').map(l => l.trim()).filter(Boolean);
        let parsedWords = [];

        setIsGeneratingBulk(true);
        try {
            // Processing in one batch up to 50 items
            const wordsToGen = lines.slice(0, 50);
            // Dynamic import specifically for new basic generator
            const { generateBasicWordsDetails } = await import('../../services/aiService');
            parsedWords = await generateBasicWordsDetails(wordsToGen, bulkAiLevel, topic?.name || 'General');
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

        setIsSaving(true);
        try {
            await saveMultipleTeacherTopicWords(topicId, parsedWords);
            setBulkImportOpen(false);
            setBulkText('');
            setAlertMessage({ type: 'success', text: `Đã nhập thành công ${parsedWords.length} từ vựng mới.` });
            loadData(true);
        } catch (error) {
            setAlertMessage({ type: 'error', text: "Lỗi khi import: " + error.message });
        }
        setIsSaving(false);
        // Fire-and-forget: recalc word count cache
        if (!isSystemTopic) recalcTopicWordCount(topicId, 'teacher_topics').catch(() => {});
    }

    if (loading && !topic) return <div className="admin-page"><div className="admin-empty-state">Đang tải dữ liệu bộ từ vựng...</div></div>;
    if (!topic) return <div className="admin-page"><div className="admin-empty-state">Không tìm thấy Bộ từ vựng này.</div></div>;

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
        const wordsToSave = [];

        for (let i = 0; i < wordsNeedingContent.length; i++) {
            const w = wordsNeedingContent[i];
            setGenProgress({ current: i + 1, total: wordsNeedingContent.length, currentWord: w.word });

            try {
                const enriched = await generateFullWordData({
                    topic: topic?.name || 'General',
                    wordObj: w,
                    level: 'B1'
                });

                // Process POS
                const posMap = {
                    'noun': 'n.', 'verb': 'v.', 'adjective': 'adj.', 'adverb': 'adv.',
                    'preposition': 'prep.', 'conjunction': 'conj.', 'pronoun': 'pron.', 'interjection': 'int.'
                };
                let aiPos = enriched.partOfSpeech || enriched.pos || w.partOfSpeech || w.pos;
                if (aiPos) {
                    const normalized = aiPos.toLowerCase().trim();
                    if (posMap[normalized]) aiPos = posMap[normalized];
                }

                const updatedWord = {
                    ...w,
                    ...enriched,
                    partOfSpeech: aiPos,
                    pos: aiPos,
                    vietnameseMeaning: enriched.vietnameseMeaning || enriched.meaning || w.vietnameseMeaning || w.meaning,
                    meaning: enriched.vietnameseMeaning || enriched.meaning || w.vietnameseMeaning || w.meaning
                };

                const idx = updatedWords.findIndex(uw => (uw.id || uw.word) === (w.id || w.word));
                if (idx !== -1) {
                    updatedWords[idx] = updatedWord;
                }
                wordsToSave.push(updatedWord);
                successCount++;
            } catch (err) {
                console.error(`Error generating content for "${w.word}":`, err);
                errorCount++;
            }
        }

        setWords(updatedWords);

        // Save updated words one by one to Firestore
        for (const w of wordsToSave) {
            try {
                await saveTeacherTopicWord(topicId, w);
            } catch (err) {
                console.error('Error saving updated word:', err);
                errorCount++;
                successCount--; // Adjust success count since we incremented it optimistically
            }
        }

        setIsGeneratingContent(false);
        if (errorCount === 0) {
            setAlertMessage({ type: 'success', text: `Đã sinh nội dung học cho ${successCount} từ và lưu thành công! ✅` });
        } else {
            setAlertMessage({ type: 'error', text: `Hoàn thành ${Math.max(0, successCount)}/${wordsToSave.length} từ. ${errorCount} từ bị lỗi lưu/sinh nội dung.` });
        }
    }

    const fullContentCount = words.filter(hasFullContent).length;
    const totalWordsCount = words.length;

    const WORD_POS_OPTIONS = ['n.', 'v.', 'adj.', 'adv.', 'prep.', 'conj.', 'pron.', 'int.'];

    return (
        <div className="admin-page">
            <div className="admin-page-header" style={{ alignItems: 'center' }}>
                <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={{ width: '100%', display: 'flex', justifyContent: 'flex-start' }}>
                        <Link to={isAdminView ? "/admin/teacher-topics" : "/teacher/topics"} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#64748b', textDecoration: 'none', fontSize: '0.9rem', marginBottom: '8px' }}>
                            <ArrowLeft size={16} /> Danh sách bài học
                        </Link>
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
                        <h1 className="admin-page-title" style={{ margin: 0 }}>Từ vựng: {topic.name}</h1>
                        {isSystemTopic && <span style={{ fontSize: '0.8rem', background: '#eff6ff', color: '#3b82f6', padding: '4px 8px', borderRadius: '4px', fontWeight: 600, border: '1px solid #bfdbfe', display: 'flex', alignItems: 'center', gap: '4px' }}><Sparkles size={14} /> Chính thức</span>}
                        {isReadOnly && !isSystemTopic && <span style={{ fontSize: '0.8rem', background: '#f1f5f9', color: '#64748b', padding: '4px 8px', borderRadius: '4px', fontWeight: 600, border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '4px' }}><Lock size={14} /> Đã chia sẻ</span>}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
                        <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '4px 10px',
                            background: `${topic.color}15`,
                            color: topic.color,
                            borderRadius: '8px',
                            fontSize: '0.8rem',
                            fontWeight: 700,
                            border: `1px solid ${topic.color}30`
                        }}>
                            {topic.icon} {topic.name}
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
                {!isReadOnly && (
                    <div className="admin-header-actions" style={{ display: 'flex', gap: '8px', marginTop: '16px', flexWrap: 'wrap', justifyContent: 'center' }}>
                        <button 
                            className="admin-btn admin-btn-outline" 
                            onClick={() => {
                                if (words.length === 0) {
                                    setAlertMessage({ type: 'warning', text: 'Chủ đề này chưa có từ vựng nào để học.' });
                                    return;
                                }
                                window.open(`${window.__APP_BASE__ || './'}?_preview=${encodeURIComponent(`/learn?topicId=${topicId}&preview=true&isTeacherTopic=true`)}`, '_blank');
                            }} 
                            style={{ display: 'flex', gap: '6px', color: '#6366f1', borderColor: '#c7d2fe', background: '#e0e7ff' }}>
                            <Eye size={16} /> Xem trước
                        </button>
                        <button className="admin-btn admin-btn-secondary" onClick={() => setBulkImportOpen(true)} style={{ display: 'flex', gap: '6px' }}>
                            <FileJson size={16} /> Import hàng loạt
                        </button>
                        <button className="admin-btn admin-btn-primary" onClick={openAddWordForm} style={{ display: 'flex', gap: '6px' }}>
                            <Plus size={16} /> Thêm từ mới
                        </button>
                    </div>
                )}
            </div>

            {totalWordsCount > 0 && (
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    margin: '0 0 16px 0',
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
                            : <><AlertTriangle size={16} /> {fullContentCount}/{totalWordsCount} từ có nội dung học đầy đủ (Cần hoàn thiện trước khi chia sẻ)</>
                        }
                    </span>
                    {!isReadOnly && fullContentCount < totalWordsCount && (
                        <button
                            className="admin-btn admin-btn-secondary"
                            onClick={handleGenerateContent}
                            disabled={isGeneratingContent}
                            style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                        >
                            <Zap size={14} /> {isGeneratingContent ? 'Đang sinh nội dung...' : `Sinh nội dung cho ${totalWordsCount - fullContentCount} từ`}
                        </button>
                    )}
                </div>
            )}

            <div className="admin-card">
                {words.length === 0 ? (
                    <div className="admin-empty-state">
                        <p>Chưa có từ vựng nào trong chủ đề này.</p>
                    </div>
                ) : (
                    <div className="admin-table-container">
                        <DragDropContext onDragEnd={handleDragEnd}>
                            <table className="admin-table">
                                <thead>
                                    <tr>
                                        <th style={{ width: '40px' }}>#</th>
                                        <th>Từ vựng</th>
                                        <th>Nghĩa</th>
                                        <th>Từ loại</th>
                                        <th>Ảnh</th>
                                        <th className="text-right">Hành động</th>
                                    </tr>
                                </thead>
                                <Droppable droppableId="words-list">
                                    {(provided) => (
                                        <tbody {...provided.droppableProps} ref={provided.innerRef}>
                                            {words.map((w, index) => (
                                                <Draggable key={w.id || w.word || `idx-${index}`} draggableId={w.id || w.word || `idx-${index}`} index={index} isDragDisabled={isReadOnly}>
                                                    {(provided, snapshot) => (
                                                        <tr
                                                            ref={provided.innerRef}
                                                            {...provided.draggableProps}
                                                            style={{
                                                                ...provided.draggableProps.style,
                                                                background: snapshot.isDragging ? '#f8fafc' : undefined,
                                                                boxShadow: snapshot.isDragging ? '0 5px 15px rgba(0,0,0,0.1)' : undefined,
                                                                display: snapshot.isDragging ? 'table-row' : undefined
                                                            }}
                                                            className={snapshot.isDragging ? 'dragging' : ''}
                                                        >
                                                            <td data-label="#" className="admin-text-muted">
                                                                <div style={{ display: 'flex', alignItems: 'center', height: '100%', minHeight: '32px' }}>
                                                                    {!isReadOnly && (
                                                                        <div {...provided.dragHandleProps} style={{ display: 'flex', alignItems: 'center', cursor: 'grab', marginRight: '8px', color: '#94a3b8' }}>
                                                                            <GripVertical size={16} style={{ transform: 'translateY(-1px)' }} />
                                                                        </div>
                                                                    )}
                                                                    <span className="word-index">{index + 1}</span>
                                                                </div>
                                                            </td>
                                                            <td data-label="Từ vựng">
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                                    {w.image && (
                                                                        <div style={{ width: '32px', height: '32px', borderRadius: '4px', overflow: 'hidden', background: '#f1f5f9', flexShrink: 0 }}>
                                                                            <img src={w.image} alt={w.word} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                                        </div>
                                                                    )}
                                                                    <div>
                                                                        <div style={{ fontWeight: 700, color: '#3b82f6', fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                                            {hasFullContent(w)
                                                                                ? <CheckCircle size={14} style={{ color: '#16a34a', flexShrink: 0 }} title="Đã có nội dung học đầy đủ" />
                                                                                : <AlertTriangle size={14} style={{ color: '#d97706', flexShrink: 0 }} title="Chưa có nội dung học" />
                                                                            }
                                                                            {w.word}
                                                                        </div>
                                                                        <div className="word-phonetic" style={{ fontSize: '0.8rem', color: '#94a3b8', fontStyle: 'italic' }}>{w.phonetic || w.ipa}</div>
                                                                    </div>
                                                                </div>
                                                            </td>
                                                            <td data-label="Nghĩa">
                                                                <div style={{ fontWeight: 600, color: '#1e293b' }}>{w.vietnameseMeaning || w.meaning}</div>
                                                            </td>
                                                            <td data-label="Từ loại">
                                                                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#f59e0b', background: '#fef3c7', padding: '2px 8px', borderRadius: '12px' }}>{w.partOfSpeech || w.pos}</span>
                                                            </td>
                                                            <td data-label="Ảnh">
                                                                {w.image && (
                                                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: '#10b981', background: '#ecfdf5', padding: '2px 8px', borderRadius: '12px', fontWeight: 600, border: '1px solid #a7f3d0' }}>
                                                                        <ImageIcon size={12} /> Có ảnh
                                                                    </span>
                                                                )}
                                                            </td>
                                                            <td data-label="Thao tác" className="text-right">
                                                                <div className="admin-table-actions">
                                                                    {!isReadOnly && (
                                                                        <>
                                                                            <button className="admin-action-btn" onClick={() => openEditWordForm(w)} title="Sửa từ vựng"><Edit size={16} /></button>
                                                                            <button className="admin-action-btn danger" onClick={() => setWordToDelete(w)} title="Xóa từ vựng"><Trash2 size={16} /></button>
                                                                        </>
                                                                    )}
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

            {/* SINGLE WORD FORM MODAL */}
            {wordFormOpen && (
                <div className="teacher-modal-overlay" style={{ zIndex: 2000 }}>
                    <div className="teacher-modal wide" style={{ maxWidth: '600px', overflow: 'auto' }}>
                        <div style={{ position: 'sticky', top: '0px', zIndex: 100, display: 'flex', justifyContent: 'flex-end', height: 0, overflow: 'visible', pointerEvents: 'none' }}>
                            <button className="teacher-modal-close" onClick={() => setWordFormOpen(false)} style={{ pointerEvents: 'auto', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, background: 'rgba(241, 245, 249, 0.95)', backdropFilter: 'blur(4px)', border: 'none', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
                                <X size={20} />
                            </button>
                        </div>
                        <h2 className="admin-modal-title" style={{ justifyContent: 'flex-start', marginBottom: '24px', paddingRight: '40px' }}>
                            {isEditingWord ? 'Sửa Từ vựng' : 'Thêm Từ mới'}
                        </h2>
                        <form onSubmit={handleWordSubmit}>
                            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
                                <div className="admin-form-group" style={{ flex: '1 1 120px', minWidth: '120px', margin: 0 }}>
                                    <label>Từ tiếng Anh</label>
                                    <input type="text" className="admin-form-input" style={{ height: '42px' }} required value={wordFormData.word} onChange={e => setWordFormData({ ...wordFormData, word: e.target.value })} placeholder="Ví dụ: negotiate" />
                                </div>
                                <div className="admin-form-group" style={{ flex: '0 0 80px', width: '80px', margin: 0 }}>
                                    <label>Loại từ</label>
                                    <select className="admin-form-input" style={{ height: '42px' }} value={wordFormData.partOfSpeech || wordFormData.pos || ''} onChange={e => setWordFormData({ ...wordFormData, partOfSpeech: e.target.value, pos: e.target.value })}>
                                        <option value="">--</option>
                                        <option value="n.">n.</option>
                                        <option value="v.">v.</option>
                                        <option value="adj.">adj.</option>
                                        <option value="adv.">adv.</option>
                                        <option value="prep.">prep.</option>
                                        <option value="conj.">conj.</option>
                                        <option value="pron.">pron.</option>
                                        <option value="int.">int.</option>
                                        <option value="phrase">phrase</option>
                                        <option value="idiom">idiom</option>
                                    </select>
                                </div>
                                <div className="admin-form-group" style={{ flex: '0 0 70px', width: '70px', margin: 0 }}>
                                    <label>Trình độ</label>
                                    <select className="admin-form-input" style={{ height: '42px' }} value={aiLevel} onChange={e => { setAiLevel(e.target.value); setWordFormData({ ...wordFormData, level: e.target.value }); }} disabled={isAI}>
                                        {['A0', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'].map(lvl => <option key={lvl} value={lvl}>{lvl}</option>)}
                                    </select>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'flex-end', flex: '1 1 140px', minWidth: '140px' }}>
                                    <button type="button" className="admin-btn admin-btn-secondary" onClick={handleAIFill} disabled={isAI} style={{ height: '42px', width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '4px', background: '#eff6ff', color: '#3b82f6', borderColor: '#bfdbfe' }}>
                                        <Sparkles size={16} /> {isAI ? 'Đang tạo...' : 'Điền tiếp bằng AI'}
                                    </button>
                                </div>
                            </div>

                            <div className="admin-form-group">
                                <label>Nghĩa tiếng Việt</label>
                                <input type="text" className="admin-form-input" required value={wordFormData.vietnameseMeaning || wordFormData.meaning || ''} onChange={e => setWordFormData({ ...wordFormData, vietnameseMeaning: e.target.value, meaning: e.target.value })} placeholder="thương lượng" />
                            </div>

                            {/* Image Section */}
                            <hr style={{ border: 'none', borderTop: '1px solid #e2e8f0', margin: '16px 0' }} />
                            <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '12px', fontWeight: 600 }}>
                                Ảnh minh họa
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
                                                if (wordFormData.image && wordFormData.image.startsWith('http')) {
                                                    setPendingDeleteImages(prev => [...prev, wordFormData.image]);
                                                }
                                                const { blob, previewUrl } = await generateVocabImageLocal(
                                                    wordFormData.word,
                                                    wordFormData.vietnameseMeaning || wordFormData.meaning || '',
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
                                        value={imagePrompt || `A clear, simple illustration representing the concept "${wordFormData.word || '...'}" (${wordFormData.vietnameseMeaning || wordFormData.meaning || '...'}). Flat design style, educational illustration, clean white background, no text, no letters, vibrant colors, centered composition.`}
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
                                <input type="text" className="admin-form-input" value={wordFormData.phonetic || wordFormData.ipa || ''} onChange={e => setWordFormData({ ...wordFormData, phonetic: e.target.value, ipa: e.target.value })} placeholder="/nÉªËˆÉ¡oÊŠ.Êƒi.eÉªt/" />
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
                                    value={wordFormData.exampleSentences?.[0]?.en || wordFormData.usage1 || ''}
                                    onChange={e => {
                                        const es = [...(wordFormData.exampleSentences || [{ en: '', vi: '' }])];
                                        es[0] = { ...es[0], en: e.target.value };
                                        setWordFormData({ ...wordFormData, exampleSentences: es, usage1: e.target.value });
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
                            {/* Handle both new object-based collocations and legacy string-based collocations */}
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
                                        value={wordFormData.sentenceSequence?.en || wordFormData.usage2 || ''}
                                        onChange={e => setWordFormData({ ...wordFormData, sentenceSequence: { ...(wordFormData.sentenceSequence || {}), en: e.target.value }, usage2: e.target.value })}
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

                            <div className="admin-modal-actions" style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid #e2e8f0', flexDirection: 'row' }}>
                                <button type="button" className="admin-btn admin-btn-secondary" style={{ flex: 1 }} onClick={() => setWordFormOpen(false)} disabled={isSaving || isUploadingImage || isGeneratingImage}>Hủy</button>
                                <button type="submit" className="admin-btn admin-btn-primary" style={{ flex: 1 }} disabled={isSaving || isUploadingImage || isGeneratingImage}>{isSaving ? 'Đang lưu...' : (isEditingWord ? 'Cập nhật' : 'Thêm')}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* BULK IMPORT MODAL */}
            {bulkImportOpen && (
                <div className="teacher-modal-overlay">
                    <div className="teacher-modal wide" style={{ maxWidth: '600px', overflow: 'auto' }}>
                        <div style={{ position: 'sticky', top: '0px', zIndex: 100, display: 'flex', justifyContent: 'flex-end', height: 0, overflow: 'visible', pointerEvents: 'none' }}>
                            <button className="teacher-modal-close" onClick={() => setBulkImportOpen(false)} style={{ pointerEvents: 'auto', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, background: 'rgba(241, 245, 249, 0.95)', backdropFilter: 'blur(4px)', border: 'none', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
                                <X size={20} />
                            </button>
                        </div>
                        <h2 className="admin-modal-title" style={{ justifyContent: 'flex-start', marginBottom: '24px', paddingRight: '40px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <FileJson size={24} color="#3b82f6" /> Import từ vựng hàng loạt
                            </div>
                        </h2>

                        <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', marginBottom: '16px', fontSize: '0.9rem', color: '#475569' }}>
                            <p style={{ margin: '0 0 8px 0', fontWeight: 600 }}>Hướng dẫn nhập tự động bằng AI:</p>
                            <ul style={{ margin: 0, paddingLeft: '20px' }}>
                                <li>Chỉ cần dán các <strong>từ tiếng Anh</strong> (mỗi từ 1 dòng, tối đa 50 từ/lần)</li>
                                <li>Hoặc có thể kèm theo nghĩa để AI dịch chính xác hơn (VD: <code style={{ color: '#ec4899' }}>apple, quả táo</code>)</li>
                                <li>AI sẽ tự động điền Từ loại, Nghĩa tiếng Việt và Phiên âm cho từng từ.</li>
                            </ul>
                        </div>

                        <div className="admin-form-group" style={{ marginBottom: '16px' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                Trình độ mục tiêu
                                <select className="admin-form-input" style={{ width: '120px' }} value={bulkAiLevel} onChange={e => setBulkAiLevel(e.target.value)} disabled={isGeneratingBulk || isSaving}>
                                    {['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].map(lvl => <option key={lvl} value={lvl}>{lvl}</option>)}
                                </select>
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
                                disabled={isGeneratingBulk || isSaving}
                            />
                        </div>

                        <div className="admin-modal-actions" style={{ marginTop: '24px', flexDirection: 'row' }}>
                            <button className="admin-btn admin-btn-secondary" style={{ flex: 1 }} onClick={() => setBulkImportOpen(false)} disabled={isGeneratingBulk || isSaving}>Hủy</button>
                            <button className="admin-btn admin-btn-primary" style={{ flex: 1 }} onClick={handleBulkImportSubmit} disabled={isGeneratingBulk || isSaving || !bulkText.trim()}>
                                {isGeneratingBulk ? 'AI đang xử lý...' : isSaving ? 'Đang lưu...' : 'Nhập dữ liệu với AI'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* DELETE MODAL */}
            {wordToDelete && (
                <div className="admin-modal-overlay">
                    <div className="admin-modal">
                        <h2 className="admin-modal-title" style={{ color: '#ef4444' }}><Trash2 size={24} /> Xác nhận xóa</h2>
                        <p className="admin-modal-desc">
                            Bạn có chắc chắn muốn xóa từ vựng <strong>{wordToDelete.word}</strong> khỏi chủ đề này?
                        </p>
                        <div className="admin-modal-actions">
                            <button className="admin-btn admin-btn-secondary" onClick={() => setWordToDelete(null)}>Hủy</button>
                            <button className="admin-btn admin-btn-primary" style={{ backgroundColor: '#ef4444' }} onClick={handleConfirmDeleteWord}>Xóa từ vựng</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ALERTS */}
            {alertMessage && (
                <div className="admin-modal-overlay">
                    <div className="admin-modal">
                        <h2 className="admin-modal-title">
                            {alertMessage.type === 'success' ? <span style={{ color: '#10b981' }}>Thành công</span> : <span style={{ color: '#ef4444' }}>Đã có lỗi</span>}
                        </h2>
                        <p className="admin-modal-desc">
                            {alertMessage.text}
                        </p>
                        <div className="admin-modal-actions">
                            <button className="admin-btn admin-btn-primary" onClick={() => setAlertMessage(null)}>Đóng</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
