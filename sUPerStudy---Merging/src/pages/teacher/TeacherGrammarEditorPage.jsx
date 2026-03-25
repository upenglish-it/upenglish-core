import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link, useLocation, useNavigate } from 'react-router-dom';
import { getGrammarExercise, getGrammarQuestions, saveGrammarQuestion, deleteGrammarQuestion } from '../../services/grammarService';
import { getTeacherTopics, getTeacherTopicWords } from '../../services/teacherService';
import { getAdminTopics, getAdminTopicWords } from '../../services/adminService';
import { generateGrammarVariations, generateSingleGrammarVariation, generateVariationExplanation } from '../../services/aiGrammarService';
import { extractQuestionsFromText, extractQuestionsFromPDF } from '../../services/aiDocumentImportService';
import { useAuth } from '../../contexts/AuthContext';

// Decode ALL HTML entities (&#39; → ', &amp; → &, &nbsp; → space, etc.)
function decodeHtmlEntities(str) {
    if (!str) return str;
    const ta = document.createElement('textarea');
    ta.innerHTML = str;
    return ta.value.replace(/\u00a0/g, ' ');
}
import { ArrowLeft, Plus, Edit, Trash2, X, Wand2, RefreshCw, Save, GripVertical, ChevronDown, Check, AlertCircle, Info, CheckCircle, Sparkles, Award, Copy, FileText, Upload } from 'lucide-react';
import './TeacherGrammarEditorPage.css';

import { renderFormattedText } from '../../utils/textFormatting';
import { ImageOptionUploader, AIImageGenerateButton, isImageOption, deleteOptionImage } from '../../components/common/MCQImageOption';
import AudioContextUploader from '../../components/common/AudioContextUploader';
import { deleteContextAudio } from '../../services/contextAudioService';
import { uploadContextImage } from '../../services/examService';
import SavedPromptPicker from '../../components/SavedPromptPicker';

/**
 * Minimal WYSIWYG rich-text input using ReactQuill.
 * Only provides Bold, Italic, Underline buttons.
 * For fill_in_blank type, also provides a "Tạo chỗ trống" button.
 */
function RichTextInput({ value, onChange, disabled, placeholder, minHeight = '100px', isFillInBlank = false, wrapperClassName = '' }) {
    const quillRef = useRef(null);

    const handleMakeBlank = useCallback(() => {
        const quill = quillRef.current?.getEditor();
        if (!quill) return;
        const selection = quill.getSelection();
        if (!selection || selection.length === 0) return;
        const selectedText = quill.getText(selection.index, selection.length).trim();
        if (!selectedText) return;
        // Replace the selected text with {{selected}} marker
        quill.deleteText(selection.index, selection.length);
        quill.insertText(selection.index, `{{${selectedText}}}`);
        // Re-get value after change
        const newHtml = quillRef.current.getEditor().root.innerHTML;
        // Clean &nbsp; and HTML entities inside {{...}} markers so word bank/answers use plain characters
        const cleanedHtml = newHtml.replace(/\{\{(.+?)\}\}/g, (match, word) => `{{${decodeHtmlEntities(word)}}}`);
        onChange(cleanedHtml);
    }, [onChange]);

    const modules = {
        toolbar: [
            ['bold', 'italic', 'underline'],
        ]
    };
    const formats = ['bold', 'italic', 'underline'];

    return (
        <div style={{ position: 'relative' }}>
            {isFillInBlank && !disabled && (
                <div style={{ display: 'flex', gap: '8px', marginBottom: '6px' }}>
                    <button
                        type="button"
                        onClick={handleMakeBlank}
                        style={{ padding: '6px 14px', borderRadius: '8px', border: '1.5px solid #6366f1', background: '#6366f1', color: '#fff', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                        ✏️ Tạo chỗ trống
                    </button>
                    <span style={{ fontSize: '0.78rem', color: '#94a3b8', alignSelf: 'center' }}>Bôi đen từ rồi bấm để tạo chỗ trống</span>
                </div>
            )}
            <div
                style={{ background: disabled ? '#f8fafc' : '#fff', borderRadius: '8px', opacity: disabled ? 0.7 : 1 }}
                className={`grammar-rich-text-input ${wrapperClassName}`}
            >
                <ReactQuill
                    ref={quillRef}
                    theme="snow"
                    value={value || ''}
                    onChange={onChange}
                    readOnly={disabled}
                    placeholder={placeholder || 'Nhập nội dung câu hỏi...'}
                    modules={modules}
                    formats={formats}
                    style={{ minHeight }}
                />
            </div>
        </div>
    );
}

const SKILL_OPTIONS = [
    { value: 'listening', label: '🎧 Listening', color: '#7c3aed' },
    { value: 'speaking', label: '🗣️ Speaking', color: '#2563eb' },
    { value: 'reading', label: '📖 Reading', color: '#0f766e' },
    { value: 'writing', label: '✍️ Writing', color: '#b45309' },
    { value: 'grammar', label: '📝 Grammar', color: '#059669' },
    { value: 'vocabulary', label: '📚 Vocabulary', color: '#dc2626' },
];

function MiniSkillDropdown({ value, onChange }) {
    const [isOpen, setIsOpen] = useState(false);
    const ref = React.useRef(null);
    const selected = SKILL_OPTIONS.find(o => o.value === value) || SKILL_OPTIONS[4];

    useEffect(() => {
        function handleClickOutside(e) {
            if (ref.current && !ref.current.contains(e.target)) setIsOpen(false);
        }
        if (isOpen) document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    return (
        <div ref={ref} style={{ position: 'relative', display: 'inline-block' }} onClick={e => e.stopPropagation()}>
            <div
                onClick={() => setIsOpen(!isOpen)}
                style={{
                    fontSize: '0.72rem', fontWeight: 600, color: selected.color, background: '#f0fdfa',
                    padding: '2px 8px', borderRadius: '6px', border: '1px solid #99f6e4',
                    cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px',
                    userSelect: 'none', transition: 'all 0.15s'
                }}
            >
                {selected.label}
                <ChevronDown size={10} style={{ transition: 'transform 0.2s', transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }} />
            </div>
            {isOpen && (
                <div style={{
                    position: 'absolute', top: '100%', left: 0, marginTop: '4px',
                    background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.12)', zIndex: 2000, minWidth: '150px',
                    overflow: 'hidden'
                }}>
                    {SKILL_OPTIONS.map(opt => (
                        <div
                            key={opt.value}
                            onClick={() => { onChange(opt.value); setIsOpen(false); }}
                            style={{
                                padding: '7px 12px', cursor: 'pointer', fontSize: '0.78rem',
                                fontWeight: value === opt.value ? 700 : 500,
                                color: value === opt.value ? opt.color : '#334155',
                                background: value === opt.value ? '#f0fdfa' : 'transparent',
                                transition: 'background 0.1s'
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'}
                            onMouseLeave={e => e.currentTarget.style.background = value === opt.value ? '#f0fdfa' : 'transparent'}
                        >
                            {opt.label}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

/**
 * Render a fill-in-blank question text, replacing {{word}} tokens with styled blank spans.
 * Handles both HTML strings and plain markdown strings.
 */
function renderFillInBlankText(text) {
    if (!text) return '(Chưa có nội dung)';
    // If the text contains HTML tags, parse it with a DOM approach
    if (/<[a-zA-Z][^>]*>/.test(text)) {
        // Replace {{word}} in the HTML with a placeholder, then dangerouslySetInnerHTML
        const processed = text.replace(/\{\{(.+?)\}\}/g, (_, word) => {
            const cleanWord = decodeHtmlEntities(word);
            return `<span style="display:inline-flex;align-items:center;gap:3px;background:#eef2ff;border:1.5px dashed #818cf8;border-radius:5px;padding:0px 7px;color:#4f46e5;font-weight:700;font-size:0.85em;white-space:nowrap;line-height:1.6;margin:0 2px;vertical-align:middle;">✎ ${cleanWord}</span>`;
        });
        return <span dangerouslySetInnerHTML={{ __html: processed.replace(/&nbsp;/g, ' ') }} />;
    }
    return renderFormattedText(text, (word, key) => (
        <span key={key} style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '3px',
            background: '#eef2ff',
            border: '1.5px dashed #818cf8',
            borderRadius: '5px',
            padding: '0px 7px',
            color: '#4f46e5',
            fontWeight: 700,
            fontSize: '0.85em',
            whiteSpace: 'nowrap',
            lineHeight: 1.6,
            margin: '0 2px',
            verticalAlign: 'middle',
        }}>
            ✎ {word}
        </span>
    ));
}

function CustomDropdown({ value, options, onChange, placeholder = "Chọn...", disabled = false, className = "" }) {
    const [isOpen, setIsOpen] = useState(false);
    const selectedOption = options.find(o => o.value === value);

    return (
        <div className={`custom-dropdown-container ${className}`}>
            <div
                className={`custom-dropdown-header ${isOpen ? 'open' : ''} ${disabled ? 'disabled' : ''}`}
                onClick={() => !disabled && setIsOpen(!isOpen)}
                style={{ opacity: disabled ? 0.7 : 1, cursor: disabled ? 'not-allowed' : 'pointer', background: disabled ? '#f8fafc' : '#fff' }}
            >
                <span>{selectedOption ? selectedOption.label : placeholder}</span>
                <ChevronDown size={16} style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', opacity: disabled ? 0.5 : 1 }} />
            </div>
            {isOpen && (
                <>
                    <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setIsOpen(false)} />
                    <div className="custom-dropdown-list">
                        {options.map((opt, idx) => (
                            <div
                                key={idx}
                                className={`custom-dropdown-item ${value === opt.value ? 'selected' : ''}`}
                                onClick={() => { onChange(opt.value); setIsOpen(false); }}
                            >
                                <span style={{ width: '16px', display: 'flex', alignItems: 'center' }}>
                                    {value === opt.value && <Check size={16} />}
                                </span>
                                <span>{opt.label}</span>
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}

function CustomToast({ message, type, onClose }) {
    const [isExiting, setIsExiting] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => {
            handleClose();
        }, 5000);
        return () => clearTimeout(timer);
    }, []);

    const handleClose = () => {
        setIsExiting(true);
        setTimeout(onClose, 300);
    };

    return (
        <div className="custom-toast-container">
            <div className={`custom-toast ${type} ${isExiting ? 'animate-toast-out' : ''}`}>
                <div className="custom-toast-icon">
                    {type === 'success' ? <CheckCircle size={20} /> : type === 'error' ? <AlertCircle size={20} /> : <Info size={20} />}
                </div>
                <div className="custom-toast-content">
                    <h4 className="custom-toast-title">
                        {type === 'success' ? 'Thành công' : type === 'error' ? 'Lỗi' : 'Thông báo'}
                    </h4>
                    <p className="custom-toast-desc">{message}</p>
                </div>
                <button onClick={handleClose} className="custom-toast-close">
                    <X size={16} />
                </button>
            </div>
        </div>
    );
}

const stripHtml = (html) => {
    if (!html) return '';
    const tmp = document.createElement("DIV");
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || "";
};

import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';

// Fix video disappearing on load/edit
const Quill = ReactQuill.Quill;
if (Quill) {
    const Video = Quill.import('formats/video');
    class CustomVideo extends Video {
        static create(value) {
            let node = super.create(value);
            node.setAttribute('src', value);
            node.setAttribute('frameborder', '0');
            node.setAttribute('allowfullscreen', true);
            node.setAttribute('class', 'ql-video');
            return node;
        }
        static sanitize(url) {
            return url;
        }
    }
    Quill.register(CustomVideo, true);
}

const QUILL_FORMATS = [
    'header', 'bold', 'italic', 'underline', 'strike',
    'color', 'background', 'list', 'align',
    'link', 'image', 'video'
];

/**
 * Show a size picker popup. Returns the chosen maxWidth, or null if cancelled.
 */
function showImageSizePicker(file) {
    return new Promise(resolve => {
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px)';

        const card = document.createElement('div');
        card.style.cssText = 'background:#fff;border-radius:20px;padding:24px;max-width:360px;width:90%;box-shadow:0 20px 60px rgba(0,0,0,0.2);font-family:Inter,system-ui,sans-serif';

        // Preview
        const preview = document.createElement('img');
        preview.src = URL.createObjectURL(file);
        preview.style.cssText = 'width:100%;max-height:160px;object-fit:contain;border-radius:12px;margin-bottom:16px;background:#f1f5f9';

        const title = document.createElement('div');
        title.style.cssText = 'font-weight:800;font-size:1rem;color:#1e293b;margin-bottom:4px;text-align:center';
        title.textContent = '📐 Chọn kích thước hình';

        const desc = document.createElement('div');
        desc.style.cssText = 'font-size:0.82rem;color:#94a3b8;margin-bottom:16px;text-align:center';
        desc.textContent = 'Hình nhỏ hơn = tải nhanh hơn cho học viên';

        const btnContainer = document.createElement('div');
        btnContainer.style.cssText = 'display:flex;flex-direction:column;gap:8px';

        const sizes = [
            { label: '🔹 Nhỏ (400px)', value: 400, desc: 'Phù hợp icon, biểu đồ nhỏ' },
            { label: '🔸 Vừa (600px)', value: 600, desc: 'Phù hợp hầu hết trường hợp' },
            { label: '🔶 Lớn (800px)', value: 800, desc: 'Hình chi tiết, slide' },
        ];

        sizes.forEach(s => {
            const btn = document.createElement('button');
            btn.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border:2px solid #e2e8f0;border-radius:14px;background:#f8fafc;cursor:pointer;font-size:0.9rem;font-weight:600;color:#334155;transition:all 0.15s;font-family:inherit';
            btn.innerHTML = `<span>${s.label}</span><span style="font-size:0.75rem;color:#94a3b8;font-weight:400">${s.desc}</span>`;
            btn.onmouseenter = () => { btn.style.borderColor = '#6366f1'; btn.style.background = '#eef2ff'; };
            btn.onmouseleave = () => { btn.style.borderColor = '#e2e8f0'; btn.style.background = '#f8fafc'; };
            btn.onclick = () => { cleanup(); resolve(s.value); };
            btnContainer.appendChild(btn);
        });

        const cancelBtn = document.createElement('button');
        cancelBtn.style.cssText = 'margin-top:8px;padding:10px;border:none;background:transparent;cursor:pointer;font-size:0.85rem;color:#94a3b8;font-weight:600;font-family:inherit;width:100%;text-align:center';
        cancelBtn.textContent = 'Huỷ';
        cancelBtn.onclick = () => { cleanup(); resolve(null); };

        function cleanup() {
            URL.revokeObjectURL(preview.src);
            overlay.remove();
        }
        overlay.onclick = (e) => { if (e.target === overlay) { cleanup(); resolve(null); } };

        card.append(preview, title, desc, btnContainer, cancelBtn);
        overlay.appendChild(card);
        document.body.appendChild(overlay);
    });
}

/**
 * Context Quill editor with custom image handler that uploads to Firebase Storage.
 */
function ContextQuillEditor({ value, onChange, readOnly }) {
    const quillRef = useRef(null);

    const modules = React.useMemo(() => ({
        toolbar: {
            container: [
                [{ 'header': [1, 2, 3, false] }],
                ['bold', 'italic', 'underline', 'strike'],
                [{ 'color': [] }, { 'background': [] }],
                [{ 'list': 'ordered' }, { 'list': 'bullet' }],
                [{ 'align': [] }],
                ['link', 'image', 'video'],
                ['clean']
            ],
            handlers: {
                image: function () {
                    const input = document.createElement('input');
                    input.setAttribute('type', 'file');
                    input.setAttribute('accept', 'image/*');
                    input.click();
                    input.onchange = async () => {
                        const file = input.files?.[0];
                        if (!file) return;
                        const maxWidth = await showImageSizePicker(file);
                        if (!maxWidth) return; // cancelled
                        try {
                            const editor = quillRef.current?.getEditor?.();
                            if (!editor) return;
                            editor.root.style.cursor = 'wait';
                            const url = await uploadContextImage(file, maxWidth);
                            const range = editor.getSelection(true);
                            editor.insertEmbed(range?.index ?? editor.getLength(), 'image', url);
                            editor.root.style.cursor = '';
                        } catch (err) {
                            console.error('Error uploading context image:', err);
                            alert('Lỗi tải hình lên: ' + err.message);
                        }
                    };
                }
            }
        }
    }), []);

    return (
        <ReactQuill
            ref={quillRef}
            theme="snow"
            value={value}
            onChange={onChange}
            readOnly={readOnly}
            placeholder="Nhập nội dung ngữ cảnh, có thể chèn hình ảnh, link video YouTube..."
            formats={QUILL_FORMATS}
            modules={modules}
        />
    );
}

// Helper: parse {{word}} markers from text
function parseFillBlanks(text) {
    const regex = /\{\{(.+?)\}\}/g;
    const blanks = [];
    let m;
    while ((m = regex.exec(text)) !== null) { blanks.push(decodeHtmlEntities(m[1])); }
    return blanks;
}

// Fill-in-Blank Editor component with {{word}} markers
function GrammarFillInBlankEditor({ variation, vIdx, isReadOnly, updateVariation, aiRefreshKey, hideDistractors = false }) {
    const text = variation?.text || '';
    const blanks = parseFillBlanks(text);
    const distractors = variation?.distractors || [];

    const [distractStr, setDistractStr] = useState(distractors.join(', '));

    useEffect(() => {
        const joined = distractors.join(', ');
        const currentClean = distractStr.split(',').map(s => s.trim()).filter(Boolean).join(', ');
        if (joined !== currentClean) {
            setDistractStr(joined);
        }
    }, [variation?.distractors]);

    const allWords = [...blanks, ...distractors];

    return (
        <div style={{ marginTop: '0' }}>
            {/* Rich Text Editor */}
            <div className="admin-form-group">
                <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#475569' }}>
                    Nội dung câu (Bôi đen từ → "Tạo chỗ trống")
                </label>
                <RichTextInput
                    key={`fib-input-${vIdx}-${aiRefreshKey}`}
                    value={text}
                    onChange={val => updateVariation(vIdx, 'text', val)}
                    disabled={isReadOnly}
                    placeholder='Ví dụ: She is a talented doctor at the local hospital.'
                    isFillInBlank={true}
                    minHeight='80px'
                    wrapperClassName={vIdx === 0 ? `required-field${text?.replace(/<[^>]*>?/gm, '').trim() ? ' filled' : ''}` : ''}
                />
            </div>

            {/* Distractors input */}
            {!hideDistractors && (
                <div className="admin-form-group" style={{ marginBottom: '12px' }}>
                    <label style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600, marginBottom: '4px' }}>
                        Từ gây nhiễu (phân cách bằng dấu phẩy, tùy chọn)
                    </label>
                    <input type="text" className="admin-form-input"
                        disabled={isReadOnly}
                        placeholder="Ví dụ: has, were, being"
                        value={distractStr}
                        onChange={e => {
                            const val = e.target.value;
                            setDistractStr(val);
                            const arr = val.split(',').map(s => s.trim()).filter(Boolean);
                            updateVariation(vIdx, 'distractors', arr);
                        }}
                    />
                </div>
            )}

            {/* Preview */}
            {blanks.length > 0 && (() => {
                // Normalize Quill HTML to inline with preserved line breaks:
                const normalizedText = text
                    .replace(/<p><br><\/p>/gi, '\n')
                    .replace(/<\/p>/gi, '\n')
                    .replace(/<\/div>/gi, '\n')
                    .replace(/<br\s*\/?>/gi, '\n')
                    .replace(/<p[^>]*>/gi, '')
                    .replace(/<div[^>]*>/gi, '');
                // Build preview HTML: replace {{word}} with blank slot spans
                let slotIndex = 0;
                const previewHtml = normalizedText.replace(/\{\{(.+?)\}\}/g, (_, word) => {
                    const idx = slotIndex++;
                    return `<span style="color:#6366f1;font-weight:700;white-space:nowrap;">(${idx + 1}) <span style="border-bottom:2px dashed #6366f1;padding:0 8px;">___</span></span>`;
                });
                return (
                    <div style={{ background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '14px 16px' }}>
                        <div style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', color: '#6366f1', marginBottom: '8px' }}>Xem trước</div>
                        <div style={{ fontSize: '0.95rem', lineHeight: 2, color: '#1e293b', wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}
                            dangerouslySetInnerHTML={{ __html: previewHtml.replace(/&nbsp;/g, ' ') }} />
                    </div>
                );
            })()}
            {blanks.length > 0 && (
                <div style={{ background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '14px 16px', marginTop: '8px' }}>
                    <div style={{ fontSize: '0.8rem', color: '#475569' }}>
                        <div style={{ marginBottom: '8px' }}>
                            <div style={{ marginBottom: '4px', fontWeight: 600 }}>Đáp án{hideDistractors && <span style={{ color: '#ef4444' }}> gợi ý</span>}:</div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
                                {blanks.map((b, i) => <span key={i} style={{ background: '#d1fae5', color: '#065f46', padding: '2px 8px', borderRadius: '6px', fontWeight: 700, whiteSpace: 'nowrap', display: 'inline-block' }}>({i + 1}) {b}</span>)}
                            </div>
                        </div>
                        {!hideDistractors && allWords.length > 0 && (
                            <div>
                                <div style={{ marginBottom: '4px', fontWeight: 600 }}>Word bank:</div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
                                    {allWords.map((w, i) => <span key={i} style={{ background: '#e0e7ff', color: '#4338ca', padding: '2px 8px', borderRadius: '6px', fontWeight: 600, whiteSpace: 'nowrap', display: 'inline-block' }}>{w}</span>)}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

export default function TeacherGrammarEditorPage() {
    const { id } = useParams();
    const { user } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();
    const isAdminContext = location.pathname.startsWith('/admin/');
    const isSystemGrammar = location.pathname.includes('/system-grammar/');
    const backLink = isAdminContext
        ? (location.pathname.includes('/admin/teacher-grammar/') ? '/admin/teacher-grammar' : '/admin/grammar')
        : '/teacher/grammar';

    const [exercise, setExercise] = useState(null);
    const [questions, setQuestions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [alertMessage, setAlertMessage] = useState(null);
    // isReadOnly: true nếu bài do admin tạo hoặc giáo viên khác tạo (không phải owner)
    const [isReadOnly, setIsReadOnly] = useState(!isAdminContext);


    // Form states
    const [formOpen, setFormOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isGeneratingAI, setIsGeneratingAI] = useState(false);
    const [isGeneratingSingleAI, setIsGeneratingSingleAI] = useState(false);
    const [isGeneratingExplanation, setIsGeneratingExplanation] = useState(false);
    const [questionToDelete, setQuestionToDelete] = useState(null);
    const [aiRefreshKey, setAiRefreshKey] = useState(0);
    const pendingImageDeletionsRef = useRef([]);
    const newlyUploadedImagesRef = useRef([]);
    const originalOptionTextsRef = useRef({});

    // Document import state
    const [showImportModal, setShowImportModal] = useState(false);
    const [importTab, setImportTab] = useState('text');
    const [importText, setImportText] = useState('');
    const [importFile, setImportFile] = useState(null);
    const [isImporting, setIsImporting] = useState(false);
    const [importedQuestions, setImportedQuestions] = useState([]);
    const [importSelections, setImportSelections] = useState({});
    const [showImportPreview, setShowImportPreview] = useState(false);
    const [isSavingImport, setIsSavingImport] = useState(false);

    const [currentQuestion, setCurrentQuestion] = useState({
        type: 'multiple_choice',
        purpose: '',
        targetSkill: '',
        hasContext: false,
        context: '',
        contextAudioUrl: '',
        variations: [
            { text: '', options: ['', '', '', ''], correctAnswer: 0, explanation: '' },
            { text: '', options: ['', '', '', ''], correctAnswer: 0, explanation: '' },
            { text: '', options: ['', '', '', ''], correctAnswer: 0, explanation: '' },
            { text: '', options: ['', '', '', ''], correctAnswer: 0, explanation: '' },
            { text: '', options: ['', '', '', ''], correctAnswer: 0, explanation: '' }
        ]
    });
    const [originalAudioUrl, setOriginalAudioUrl] = useState('');

    const [activeVariationTab, setActiveVariationTab] = useState(0);
    const [isVietnameseQuestion, setIsVietnameseQuestion] = useState(false);

    // Vocabulary topic selector state
    const [vocabTopics, setVocabTopics] = useState([]);
    const [selectedVocabTopicId, setSelectedVocabTopicId] = useState('');
    const [vocabWords, setVocabWords] = useState([]);
    const [loadingVocabWords, setLoadingVocabWords] = useState(false);
    const [vocabTopicSearch, setVocabTopicSearch] = useState('');
    const [showVocabDropdown, setShowVocabDropdown] = useState(false);
    const [vocabSourceFilter, setVocabSourceFilter] = useState('all'); // 'all' | 'official' | 'teacher'

    // Load vocab topics when form opens
    useEffect(() => {
        if (!formOpen) return;
        let cancelled = false;
        (async () => {
            try {
                const [teacherTopics, officialTopics] = await Promise.all([
                    user?.uid ? getTeacherTopics(user.uid) : [],
                    getAdminTopics()
                ]);
                if (cancelled) return;
                const combined = [
                    ...teacherTopics.map(t => ({ ...t, source: 'teacher' })),
                    ...officialTopics.map(t => ({ ...t, source: 'official' }))
                ];
                setVocabTopics(combined);
            } catch (err) {
                console.error('Error loading vocab topics:', err);
            }
        })();
        return () => { cancelled = true; };
    }, [formOpen, user?.uid]);

    // Load words when a vocab topic is selected
    useEffect(() => {
        if (!selectedVocabTopicId) { setVocabWords([]); return; }
        let cancelled = false;
        setLoadingVocabWords(true);
        (async () => {
            try {
                const topic = vocabTopics.find(t => t.id === selectedVocabTopicId);
                let words;
                if (topic?.source === 'teacher') {
                    words = await getTeacherTopicWords(selectedVocabTopicId);
                } else {
                    words = await getAdminTopicWords(selectedVocabTopicId);
                }
                if (!cancelled) setVocabWords(words || []);
            } catch (err) {
                console.error('Error loading vocab words:', err);
                if (!cancelled) setVocabWords([]);
            }
            if (!cancelled) setLoadingVocabWords(false);
        })();
        return () => { cancelled = true; };
    }, [selectedVocabTopicId]);

    useEffect(() => {
        if (id) loadData();
    }, [id, user?.uid]);

    async function loadData() {
        setLoading(true);
        try {
            const exData = await getGrammarExercise(id);
            setExercise(exData);
            const qData = await getGrammarQuestions(id);
            qData.sort((a, b) => (a.order || 0) - (b.order || 0));
            setQuestions(qData);

            // Kiểm tra quyền chỉnh sửa dựa trên dữ liệu thực tế:
            // - Admin context: luôn cho phép sửa
            // - isSystemGrammar route: luôn read-only
            // - Còn lại: chỉ được sửa nếu là owner (teacherId trùng với user hiện tại)
            if (!isAdminContext) {
                const isOwner = exData?.teacherId && exData.teacherId === user?.uid;
                const isCollaborator = exData?.collaboratorIds?.includes(user?.uid) || false;
                const collabRole = (exData?.collaboratorRoles || {})[user?.uid] || 'editor';
                setIsReadOnly(!(isOwner || (isCollaborator && collabRole === 'editor')));
            } else {
                setIsReadOnly(false);
            }
        } catch (error) {
            console.error(error);
            setAlertMessage({ type: 'error', text: 'Lỗi tải dữ liệu: ' + error.message });
        }
        setLoading(false);
    }

    function getInitialVariation(type) {
        if (type === 'multiple_choice') return { text: '', options: ['', '', '', ''], correctAnswer: 0, explanation: '' };
        if (type === 'essay') return { text: '', sampleAnswer: '', explanation: '' };
        if (type === 'fill_in_blank') return { text: '', distractors: [], explanation: '' };
        if (type === 'fill_in_blank_typing') return { text: '', explanation: '' };
        if (type === 'matching') return { text: 'Nối các từ/câu ở cột trái với cột phải tương ứng.', pairs: [{ left: '', right: '' }, { left: '', right: '' }], explanation: '' };
        if (type === 'categorization') return { text: 'Phân loại các mục sau vào đúng nhóm.', groups: ['Nhóm 1', 'Nhóm 2'], items: [{ text: '', group: 'Nhóm 1' }, { text: '', group: 'Nhóm 2' }], explanation: '' };
        if (type === 'ordering') return { text: 'Sắp xếp các mục sau theo đúng thứ tự.', items: [''], explanation: '' };
        if (type === 'audio_recording') return { text: '', explanation: '' };
        return { text: '', explanation: '' };
    }

    function openAddForm() {
        setCurrentQuestion({
            type: 'multiple_choice',
            purpose: '',
            hasContext: false,
            context: '',
            contextAudioUrl: '',
            variations: [
                getInitialVariation('multiple_choice'),
                getInitialVariation('multiple_choice'),
                getInitialVariation('multiple_choice'),
                getInitialVariation('multiple_choice'),
                getInitialVariation('multiple_choice')
            ]
        });
        setOriginalAudioUrl('');
        setIsEditing(false);
        setActiveVariationTab(0);
        pendingImageDeletionsRef.current = [];
        newlyUploadedImagesRef.current = [];
        setFormOpen(true);
    }

    function openEditForm(q) {
        const deepCopy = JSON.parse(JSON.stringify(q)); // Deep copy
        // Ensure there are always 5 variations (old questions may have fewer)
        const variations = deepCopy.variations || [];
        while (variations.length < 5) {
            variations.push(getInitialVariation(deepCopy.type || 'multiple_choice'));
        }
        deepCopy.variations = variations;
        setCurrentQuestion(deepCopy);
        setOriginalAudioUrl(q.contextAudioUrl || '');
        setIsEditing(true);
        setActiveVariationTab(0);
        pendingImageDeletionsRef.current = [];
        newlyUploadedImagesRef.current = [];
        setFormOpen(true);
    }

    function handleCloseForm() {
        // Clean up images that were uploaded during this session but never saved
        for (const url of newlyUploadedImagesRef.current) {
            const isStillUsed = currentQuestion.variations?.some(v =>
                v.options?.some(opt => opt === url)
            );
            if (!isStillUsed) {
                deleteOptionImage(url).catch(console.error);
            }
        }
        newlyUploadedImagesRef.current = [];
        pendingImageDeletionsRef.current = [];
        setFormOpen(false);
    }

    async function handleSubmit(e) {
        e.preventDefault();
        if (!currentQuestion.targetSkill) {
            setAlertMessage({ type: 'error', text: 'Vui lòng chọn Kỹ năng mục tiêu cho câu hỏi.' });
            return;
        }
        setIsSaving(true);
        try {
            // Clean up old audio if it was replaced during editing
            if (isEditing && originalAudioUrl && originalAudioUrl !== currentQuestion.contextAudioUrl) {
                await deleteContextAudio(originalAudioUrl);
            }
            await saveGrammarQuestion({
                ...currentQuestion,
                exerciseId: id,
                ...(!isEditing && { teacherId: user.uid })
            });
            // Delete images that were scheduled for deletion during editing
            for (const url of pendingImageDeletionsRef.current) {
                deleteOptionImage(url).catch(console.error);
            }
            pendingImageDeletionsRef.current = [];
            newlyUploadedImagesRef.current = [];
            setFormOpen(false);
            setAlertMessage({ type: 'success', text: isEditing ? "Cập nhật câu hỏi thành công!" : "Tạo câu hỏi mới thành công!" });
            loadData();
        } catch (error) {
            setAlertMessage({ type: 'error', text: "Lỗi lưu câu hỏi: " + error.message });
        }
        setIsSaving(false);
    }

    async function handleConfirmDelete() {
        if (!questionToDelete) return;
        try {
            await deleteGrammarQuestion(questionToDelete.id);
            setQuestions(prev => prev.filter(q => q.id !== questionToDelete.id));
            setAlertMessage({ type: 'success', text: "Đã xóa câu hỏi thành công!" });
        } catch (error) {
            setAlertMessage({ type: 'error', text: "Lỗi xóa câu hỏi: " + error.message });
        }
        setQuestionToDelete(null);
    }

    async function handleDuplicate(q) {
        try {
            const { id: _id, createdAt, updatedAt, order, ...rest } = JSON.parse(JSON.stringify(q));
            await saveGrammarQuestion({
                ...rest,
                exerciseId: id,
                teacherId: user.uid
            });
            setAlertMessage({ type: 'success', text: 'Nhân bản câu hỏi thành công!' });
            loadData();
        } catch (error) {
            setAlertMessage({ type: 'error', text: 'Lỗi nhân bản câu hỏi: ' + error.message });
        }
    }

    // --- DOCUMENT IMPORT HANDLERS ---
    async function handleDocumentImport() {
        if (importTab === 'text' && !importText.trim()) {
            setAlertMessage({ type: 'error', text: 'Vui lòng dán nội dung câu hỏi vào ô văn bản.' });
            return;
        }
        if (importTab === 'pdf' && !importFile) {
            setAlertMessage({ type: 'error', text: 'Vui lòng chọn file PDF.' });
            return;
        }

        setIsImporting(true);
        try {
            const settings = {
                cefrLevel: exercise?.targetLevel || 'A1',
                sectionId: '',
                examId: ''
            };

            let questions;
            if (importTab === 'text') {
                questions = await extractQuestionsFromText(importText.trim(), settings);
            } else {
                questions = await extractQuestionsFromPDF(importFile, settings);
            }

            if (!questions || questions.length === 0) {
                setAlertMessage({ type: 'error', text: 'Không tìm thấy câu hỏi nào trong tài liệu. Kiểm tra lại nội dung.' });
                setIsImporting(false);
                return;
            }

            setImportedQuestions(questions);
            const selections = {};
            questions.forEach((_, idx) => { selections[idx] = true; });
            setImportSelections(selections);
            setShowImportPreview(true);
            setAlertMessage({ type: 'success', text: `AI đã trích xuất ${questions.length} câu hỏi!` });
        } catch (error) {
            setAlertMessage({ type: 'error', text: 'Lỗi: ' + error.message });
        }
        setIsImporting(false);
    }

    async function handleConfirmImport() {
        const selectedQuestions = importedQuestions.filter((_, idx) => importSelections[idx]);
        if (selectedQuestions.length === 0) {
            setAlertMessage({ type: 'error', text: 'Vui lòng chọn ít nhất 1 câu hỏi để nhập.' });
            return;
        }

        setIsSavingImport(true);
        try {
            let savedCount = 0;
            for (const q of selectedQuestions) {
                const { sectionId: _s, examId: _e, ...rest } = q;
                await saveGrammarQuestion({
                    ...rest,
                    exerciseId: id,
                    teacherId: user.uid
                });
                savedCount++;
            }
            setAlertMessage({ type: 'success', text: `Đã nhập thành công ${savedCount} câu hỏi!` });
            setShowImportPreview(false);
            setShowImportModal(false);
            setImportedQuestions([]);
            setImportSelections({});
            setImportText('');
            setImportFile(null);
            loadData();
        } catch (error) {
            setAlertMessage({ type: 'error', text: 'Lỗi lưu câu hỏi: ' + error.message });
        }
        setIsSavingImport(false);
    }

    function getTypeLabel(type) {
        const labels = {
            'multiple_choice': '🔘 Trắc nghiệm',
            'fill_in_blank': '✏️ Điền từ (word bank)',
            'fill_in_blank_typing': '⌨️ Điền từ (tự nhập)',
            'matching': '🔗 Nối cặp',
            'ordering': '🔢 Sắp xếp',
            'categorization': '📂 Phân loại',
            'essay': '📝 Tự luận',
            'audio_recording': '🎤 Thu âm',
        };
        return labels[type] || type;
    }

    async function handleGenerateAI() {
        if (!currentQuestion.purpose || !currentQuestion.variations[0].text) {
            setAlertMessage({ type: 'error', text: "Vui lòng điền 'Mục đích kiểm tra' và 'Nội dung Variation 1' trước khi dùng AI." });
            return;
        }

        setIsGeneratingAI(true);
        try {
            const originalV1 = currentQuestion.variations[0];
            const selectedTopic = vocabTopics.find(t => t.id === selectedVocabTopicId);
            const settings = {
                targetLevel: exercise?.targetLevel || 'A1',
                targetAge: exercise?.targetAge || '10-15',
                hasContext: currentQuestion.hasContext || false,
                contextHtml: currentQuestion.context || '',
                isVietnameseQuestion: isVietnameseQuestion,
                vocabularyWords: vocabWords,
                vocabularyTopicName: selectedTopic?.name || ''
            };
            const resultVars = await generateGrammarVariations(originalV1, currentQuestion.purpose, currentQuestion.type, settings);

            if (resultVars && resultVars.improved_original && resultVars.variations && resultVars.variations.length >= 4) {
                setCurrentQuestion(prev => {
                    const updatedVariations = [...prev.variations];
                    // Variation 0 is the improved version
                    updatedVariations[0] = { ...prev.variations[0], ...resultVars.improved_original };
                    // Variation 1 to 4 are the newly generated ones
                    updatedVariations[1] = { ...prev.variations[0], ...resultVars.variations[0] };
                    updatedVariations[2] = { ...prev.variations[0], ...resultVars.variations[1] };
                    updatedVariations[3] = { ...prev.variations[0], ...resultVars.variations[2] };
                    updatedVariations[4] = { ...prev.variations[0], ...resultVars.variations[3] };
                    return { ...prev, variations: updatedVariations };
                });
                setAiRefreshKey(prev => prev + 1);
                // Check if V1 had image options — remind teacher to generate images
                const v1HasImages = currentQuestion.type === 'multiple_choice' &&
                    (currentQuestion.variations?.[0]?.options || []).some(opt => isImageOption(opt));
                if (v1HasImages) {
                    setAlertMessage({ type: 'success', text: "AI đã tạo đáp án dạng text. Hãy bấm ✨ bên cạnh mỗi đáp án để tạo ảnh tương ứng." });
                } else {
                    setAlertMessage({ type: 'success', text: "AI đã sửa lỗi câu gốc và tạo thành công thêm 4 variations!" });
                }
            } else {
                setAlertMessage({ type: 'error', text: "AI không trả về đủ variations hợp lệ." });
            }
        } catch (error) {
            setAlertMessage({ type: 'error', text: "Lỗi khi gọi AI: " + error.message });
        }
        setIsGeneratingAI(false);
    }

    async function handleGenerateSingleAI(idx) {
        if (!currentQuestion.purpose || !currentQuestion.variations[0].text) {
            setAlertMessage({ type: 'error', text: "Vui lòng đảm bảo 'Mục đích kiểm tra' và 'Nội dung Variation 1' đã được điền." });
            return;
        }

        setIsGeneratingSingleAI(true);
        try {
            const originalV1 = currentQuestion.variations[0];
            const selectedTopic = vocabTopics.find(t => t.id === selectedVocabTopicId);
            const settings = {
                targetLevel: exercise?.targetLevel || 'A1',
                targetAge: exercise?.targetAge || '10-15',
                hasContext: currentQuestion.hasContext || false,
                contextHtml: currentQuestion.context || '',
                isVietnameseQuestion: isVietnameseQuestion,
                vocabularyWords: vocabWords,
                vocabularyTopicName: selectedTopic?.name || ''
            };
            const resultVar = await generateSingleGrammarVariation(originalV1, currentQuestion.purpose, currentQuestion.type, settings);

            if (resultVar && resultVar.text) {
                setCurrentQuestion(prev => {
                    const updatedVariations = [...prev.variations];
                    updatedVariations[idx] = { ...prev.variations[0], ...resultVar };
                    return { ...prev, variations: updatedVariations };
                });
                setAiRefreshKey(prev => prev + 1);
                setAlertMessage({ type: 'success', text: `Tạo lại Variation ${idx + 1} thành công!` });
            } else {
                setAlertMessage({ type: 'error', text: `AI không trả về variation hợp lệ cho Variation ${idx + 1}.` });
            }
        } catch (error) {
            setAlertMessage({ type: 'error', text: "Lỗi khi gọi AI: " + error.message });
        }
        setIsGeneratingSingleAI(false);
    }

    async function handleGenerateExplanation(vIdx) {
        const targetVariation = currentQuestion.variations[vIdx];
        if (!targetVariation?.text) {
            setAlertMessage({ type: 'error', text: 'Vui lòng nhập nội dung câu hỏi trước khi tạo giải thích.' });
            return;
        }
        setIsGeneratingExplanation(true);
        try {
            const v1Data = currentQuestion.variations[0];
            const explanation = await generateVariationExplanation(v1Data, targetVariation, currentQuestion.purpose, currentQuestion.type);
            if (explanation) {
                setCurrentQuestion(prev => {
                    const newVars = [...prev.variations];
                    newVars[vIdx] = { ...newVars[vIdx], explanation };
                    return { ...prev, variations: newVars };
                });
                setAlertMessage({ type: 'success', text: `Đã tạo giải thích cho Variation ${vIdx + 1}!` });
            } else {
                setAlertMessage({ type: 'error', text: 'AI không trả về giải thích hợp lệ.' });
            }
        } catch (error) {
            setAlertMessage({ type: 'error', text: 'Lỗi tạo giải thích: ' + error.message });
        }
        setIsGeneratingExplanation(false);
    }

    function updateVariation(index, field, value) {
        setCurrentQuestion(prev => {
            const newVars = [...prev.variations];
            newVars[index] = { ...newVars[index], [field]: value };
            return { ...prev, variations: newVars };
        });
    }

    function updateOption(varIndex, optIndex, value) {
        setCurrentQuestion(prev => {
            const newVars = [...prev.variations];
            const newOptions = [...(newVars[varIndex].options || [])];
            newOptions[optIndex] = value;
            newVars[varIndex] = { ...newVars[varIndex], options: newOptions };
            return { ...prev, variations: newVars };
        });
    }

    function addOption(varIndex) {
        setCurrentQuestion(prev => {
            const newVars = [...prev.variations];
            const newOptions = [...(newVars[varIndex].options || [])];
            newOptions.push('');
            newVars[varIndex] = { ...newVars[varIndex], options: newOptions };
            return { ...prev, variations: newVars };
        });
    }

    function removeOption(varIndex, optIndex) {
        setCurrentQuestion(prev => {
            const newVars = [...prev.variations];
            const newOptions = [...(newVars[varIndex].options || [])];
            if (newOptions.length <= 2) return prev; // Minimum 2 options
            newOptions.splice(optIndex, 1);
            // Adjust correctAnswer if needed
            let correctAnswer = newVars[varIndex].correctAnswer || 0;
            if (optIndex === correctAnswer) correctAnswer = 0;
            else if (optIndex < correctAnswer) correctAnswer--;
            newVars[varIndex] = { ...newVars[varIndex], options: newOptions, correctAnswer };
            return { ...prev, variations: newVars };
        });
    }

    function updatePair(varIndex, pairIndex, field, value) {
        setCurrentQuestion(prev => {
            const newVars = [...prev.variations];
            const pairs = [...(newVars[varIndex].pairs || [])];
            pairs[pairIndex] = { ...pairs[pairIndex], [field]: value };
            newVars[varIndex] = { ...newVars[varIndex], pairs };
            return { ...prev, variations: newVars };
        });
    }

    function addPair(varIndex) {
        setCurrentQuestion(prev => {
            const newVars = [...prev.variations];
            const pairs = [...(newVars[varIndex].pairs || []), { left: '', right: '' }];
            newVars[varIndex] = { ...newVars[varIndex], pairs };
            return { ...prev, variations: newVars };
        });
    }

    function removePair(varIndex, pairIndex) {
        setCurrentQuestion(prev => {
            const newVars = [...prev.variations];
            const pairs = newVars[varIndex].pairs.filter((_, i) => i !== pairIndex);
            newVars[varIndex] = { ...newVars[varIndex], pairs };
            return { ...prev, variations: newVars };
        });
    }

    function updateGroup(varIndex, groupIndex, value) {
        setCurrentQuestion(prev => {
            const newVars = [...prev.variations];
            const groups = [...(newVars[varIndex].groups || [])];
            const oldGroupName = groups[groupIndex];
            groups[groupIndex] = value;

            // Also update items that were in this group
            const items = [...(newVars[varIndex].items || [])].map(item =>
                item.group === oldGroupName ? { ...item, group: value } : item
            );
            newVars[varIndex] = { ...newVars[varIndex], groups, items };

            return { ...prev, variations: newVars };
        });
    }

    function addGroup(varIndex) {
        setCurrentQuestion(prev => {
            const newVars = [...prev.variations];
            const groups = [...(newVars[varIndex].groups || []), `Nhóm mới ${newVars[varIndex].groups?.length + 1 || 1}`];
            newVars[varIndex] = { ...newVars[varIndex], groups };
            return { ...prev, variations: newVars };
        });
    }

    function removeGroup(varIndex, groupIndex) {
        setCurrentQuestion(prev => {
            const newVars = [...prev.variations];
            const groups = [...(newVars[varIndex].groups || [])];
            const groupToRemove = groups[groupIndex];
            groups.splice(groupIndex, 1);

            // Also remove items in this group
            const items = (newVars[varIndex].items || []).filter(item => item.group !== groupToRemove);

            newVars[varIndex] = { ...newVars[varIndex], groups, items };
            return { ...prev, variations: newVars };
        });
    }

    function updateItem(varIndex, itemIndex, field, value) {
        setCurrentQuestion(prev => {
            const newVars = [...prev.variations];
            const items = [...(newVars[varIndex].items || [])];
            items[itemIndex] = { ...items[itemIndex], [field]: value };
            newVars[varIndex] = { ...newVars[varIndex], items };
            return { ...prev, variations: newVars };
        });
    }

    function addItem(varIndex) {
        setCurrentQuestion(prev => {
            const newVars = [...prev.variations];
            const defaultGroup = newVars[varIndex].groups && newVars[varIndex].groups.length > 0 ? newVars[varIndex].groups[0] : '';
            const items = [...(newVars[varIndex].items || []), { text: '', group: defaultGroup }];
            newVars[varIndex] = { ...newVars[varIndex], items };
            return { ...prev, variations: newVars };
        });
    }

    function removeItem(varIndex, itemIndex) {
        setCurrentQuestion(prev => {
            const newVars = [...prev.variations];
            const items = newVars[varIndex].items.filter((_, i) => i !== itemIndex);
            newVars[varIndex] = { ...newVars[varIndex], items };
            return { ...prev, variations: newVars };
        });
    }

    async function handleDragEnd(result) {
        if (!result.destination) return;

        const items = Array.from(questions);
        const [reorderedItem] = items.splice(result.source.index, 1);
        items.splice(result.destination.index, 0, reorderedItem);

        // Update local state immediately for smooth UI
        const updatedItems = items.map((item, index) => ({
            ...item,
            order: index
        }));
        setQuestions(updatedItems);

        // Call backend to update order
        try {
            // Since teacherService.js doesn't have an export for updateGrammarQuestionsOrder, let's use a batch update here or import it if created.
            // Let's import it at the top and call it here if we already added it.
            // Actually, we added it to teacherService but didn't import it. We should import it.
            // For now, let's import it here. Wait, I can't import dynamically easily in React like this unless I add to the imports above.
            // Let's modify the first chunk to include the import. I will do that in the next step or assume it's imported.
            // Wait, grammar questions belong to `teacher_grammar_exercises`. I should add the api to `grammarService.js` instead.
            // Oh, I added it to `teacherService.js`. But here `getGrammarQuestions` is from `grammarService.js`.
            // I should just add the logic directly or import it. Let me update `grammarService.js` instead or use a dynamic import.
            const { updateGrammarQuestionsOrder } = await import('../../services/teacherService');
            await updateGrammarQuestionsOrder(id, updatedItems);
        } catch (error) {
            console.error("Failed to update question order:", error);
            setAlertMessage({ type: 'error', text: 'Lỗi cập nhật vị trí câu hỏi: ' + error.message });
            loadData(); // Reload to revert to original state
        }
    }

    if (loading) {
        return <div className="admin-page"><div className="admin-empty-state">Đang tải...</div></div>;
    }

    return (
        <div className="admin-page teacher-grammar-editor-page relative pb-20">
            <button onClick={() => navigate(-1)} className="admin-back-link" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#64748b', textDecoration: 'none', marginBottom: '16px', fontSize: '0.9rem', width: 'fit-content', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                <ArrowLeft size={16} /> Quay lại danh sách
            </button>

            <div className="admin-page-header">
                <div>
                    <h1 className="admin-page-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {exercise?.name}
                        {isReadOnly && !isAdminContext && <span style={{ fontSize: '0.8rem', background: '#eff6ff', color: '#3b82f6', padding: '4px 8px', borderRadius: '4px', fontWeight: 600, border: '1px solid #bfdbfe', display: 'flex', alignItems: 'center', gap: '4px' }}><Sparkles size={14} /> {exercise?.teacherId ? 'Chỉ xem' : 'Chính thức'}</span>}
                    </h1>
                    <p className="admin-page-subtitle">{exercise?.description}</p>
                </div>
                {!isReadOnly && (
                    <div className="admin-header-actions">
                        <button className="admin-btn admin-btn-primary" onClick={openAddForm}>
                            <Plus size={16} /> Thêm Câu hỏi
                        </button>
                        <button
                            className="admin-btn admin-btn-secondary"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: '#fff', border: 'none', fontWeight: 700 }}
                            onClick={() => { setShowImportModal(true); setImportTab('text'); setImportText(''); setImportFile(null); setShowImportPreview(false); setImportedQuestions([]); }}
                        >
                            <FileText size={16} /> Nhập từ tài liệu
                        </button>
                    </div>
                )}
            </div>

            <div className="admin-card" style={{ padding: '0', background: 'transparent', border: 'none', boxShadow: 'none' }}>
                {questions.length === 0 ? (
                    <div className="admin-card" style={{ padding: '24px' }}>
                        <div className="admin-empty-state">
                            <div className="admin-empty-icon"><Edit size={28} /></div>
                            <h3>Bài luyện chưa có câu hỏi nào</h3>
                            <p>Thêm câu hỏi và sử dụng AI để tự động sinh biến thể.</p>
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="admin-card admin-table-container" style={{ padding: '24px' }}>
                            <DragDropContext onDragEnd={handleDragEnd}>
                                <table className="admin-table">
                                    <thead>
                                        <tr>
                                            <th style={{ width: '40px' }}></th>
                                            <th>#</th>
                                            <th>Loại câu hỏi</th>
                                            <th>Mục đích</th>
                                            <th>Nội dung (Variation 1)</th>
                                            {!isReadOnly ? (
                                                <th className="text-right">Hành động</th>
                                            ) : (
                                                <th className="text-right">Chi tiết</th>
                                            )}
                                        </tr>
                                    </thead>
                                    <Droppable droppableId="grammar-questions" isDropDisabled={isReadOnly}>
                                        {(provided) => (
                                            <tbody {...provided.droppableProps} ref={provided.innerRef}>
                                                {questions.map((q, index) => (
                                                    <Draggable key={q.id} draggableId={q.id} index={index}>
                                                        {(provided, snapshot) => (
                                                            <tr
                                                                ref={provided.innerRef}
                                                                {...provided.draggableProps}
                                                                style={{
                                                                    ...provided.draggableProps.style,
                                                                    backgroundColor: snapshot.isDragging ? '#f8fafc' : 'white',
                                                                    boxShadow: snapshot.isDragging ? '0 4px 6px -1px rgba(0, 0, 0, 0.1)' : 'none',
                                                                    display: provided.draggableProps.style?.display === 'none' ? 'none' : 'table-row'
                                                                }}
                                                            >
                                                                <td style={{ width: '40px', padding: '12px 8px', textAlign: 'center' }}>
                                                                    {!isReadOnly && (
                                                                        <div {...provided.dragHandleProps} style={{ cursor: 'grab', color: '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                                            <GripVertical size={16} />
                                                                        </div>
                                                                    )}
                                                                </td>
                                                                <td style={{ width: '40px', textAlign: 'center' }}>{index + 1}</td>
                                                                <td>
                                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-start' }}>
                                                                        <span style={{ fontSize: '0.8rem', padding: '4px 8px', background: '#e0e7ff', color: '#4f46e5', borderRadius: '4px' }}>
                                                                            {q.type === 'multiple_choice' ? 'Trắc nghiệm' : q.type === 'essay' ? 'Viết luận / Tự luận' : q.type === 'fill_in_blank' ? 'Chọn đáp án cho chỗ trống' : q.type === 'fill_in_blank_typing' ? 'Điền vào chỗ trống' : q.type === 'matching' ? 'Kết nối' : q.type === 'audio_recording' ? 'Thu âm / Ghi âm' : q.type === 'ordering' ? 'Sắp xếp' : 'Phân loại'}
                                                                        </span>
                                                                        {q.targetSkill && (() => {
                                                                            const skillMap = { listening: { l: '🎧 Listening', c: '#7c3aed' }, speaking: { l: '🗣️ Speaking', c: '#2563eb' }, reading: { l: '📖 Reading', c: '#0f766e' }, writing: { l: '✍️ Writing', c: '#b45309' }, grammar: { l: '📝 Grammar', c: '#059669' }, vocabulary: { l: '📚 Vocabulary', c: '#dc2626' } };
                                                                            const sk = skillMap[q.targetSkill];
                                                                            return sk ? <span style={{ fontSize: '0.7rem', padding: '2px 6px', background: '#f0fdfa', color: sk.c, borderRadius: '4px', fontWeight: 600 }}>{sk.l}</span> : null;
                                                                        })()}
                                                                        {(() => {
                                                                            const filledCount = (q.variations || []).filter(v => v && ((v.text && v.text.replace(/<[^>]*>/g, '').trim().length > 0) || v.options?.some(o => o && o.toString().trim()) || v.pairs?.some(p => p.left?.trim() || p.right?.trim()) || v.items?.some(i => typeof i === 'string' ? i.trim() : i?.text?.trim()))).length;
                                                                            const totalCount = (q.variations || []).length;
                                                                            return totalCount > 0 ? (
                                                                                <span style={{ fontSize: '0.65rem', padding: '2px 6px', background: filledCount >= 2 ? '#ecfdf5' : '#fff7ed', color: filledCount >= 2 ? '#059669' : '#d97706', borderRadius: '4px', fontWeight: 600, border: `1px solid ${filledCount >= 2 ? '#a7f3d0' : '#fed7aa'}` }}>
                                                                                    {filledCount}/{totalCount} V
                                                                                </span>
                                                                            ) : null;
                                                                        })()}
                                                                    </div>
                                                                </td>
                                                                <td>
                                                                    <div style={{ fontSize: '0.9rem', color: '#334155', maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                                        {q.purpose || '-'}
                                                                    </div>
                                                                </td>
                                                                <td>
                                                                    <div style={{ fontSize: '0.9rem', color: '#64748b', maxWidth: '300px', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                                                                        {(q.type === 'fill_in_blank' || q.type === 'fill_in_blank_typing')
                                                                            ? renderFillInBlankText(q.variations[0]?.text)
                                                                            : stripHtml(q.variations[0]?.text || '(Chưa có nội dung)')}
                                                                    </div>
                                                                </td>
                                                                <td className="text-right">
                                                                    <div className="admin-table-actions">
                                                                        {!isReadOnly ? (
                                                                            <>
                                                                                <button className="admin-action-btn" onClick={() => openEditForm(q)} title="Sửa"><Edit size={16} /></button>
                                                                                <button className="admin-action-btn" onClick={() => handleDuplicate(q)} title="Nhân bản"><Copy size={16} /></button>
                                                                                <button className="admin-action-btn danger" onClick={() => setQuestionToDelete(q)} title="Xóa"><Trash2 size={16} /></button>
                                                                            </>
                                                                        ) : (
                                                                            <button className="admin-action-btn" onClick={() => openEditForm(q)} title="Xem chi tiết"><Info size={16} /></button>
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
                        {/* Mobile card list */}
                        <div className="grammar-card-list-mobile">
                            {questions.map((q, index) => (
                                <div key={q.id} className="grammar-mobile-card">
                                    <div className="grammar-mobile-card-header">
                                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                            <span className="grammar-mobile-card-index">{index + 1}</span>
                                            <span className="grammar-mobile-card-type">
                                                {q.type === 'multiple_choice' ? 'Trắc nghiệm' : q.type === 'essay' ? 'Viết luận / Tự luận' : q.type === 'fill_in_blank' ? 'Chọn đáp án cho chỗ trống' : q.type === 'fill_in_blank_typing' ? 'Điền vào chỗ trống' : q.type === 'matching' ? 'Kết nối' : q.type === 'audio_recording' ? 'Thu âm / Ghi âm' : 'Phân loại'}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="grammar-mobile-card-content">
                                        <div className="grammar-mobile-card-purpose">{q.purpose || 'Không có tiêu đề'}</div>
                                        <div className="grammar-mobile-card-text" style={{ whiteSpace: 'pre-wrap' }}>
                                            {(q.type === 'fill_in_blank' || q.type === 'fill_in_blank_typing')
                                                ? renderFillInBlankText(q.variations[0]?.text)
                                                : stripHtml(q.variations[0]?.text || '(Chưa có nội dung)')}
                                        </div>
                                    </div>
                                    <div className="grammar-mobile-card-actions">
                                        {!isReadOnly ? (
                                            <>
                                                <button className="admin-action-btn" onClick={() => openEditForm(q)} style={{ background: '#f8fafc' }}>
                                                    <Edit size={16} /> Sửa
                                                </button>
                                                <button className="admin-action-btn" onClick={() => handleDuplicate(q)} style={{ background: '#f0fdf4' }}>
                                                    <Copy size={16} /> Nhân bản
                                                </button>
                                                <button className="admin-action-btn danger" onClick={() => setQuestionToDelete(q)} style={{ background: '#fef2f2' }}>
                                                    <Trash2 size={16} /> Xóa
                                                </button>
                                            </>
                                        ) : (
                                            <button className="admin-action-btn" onClick={() => openEditForm(q)} style={{ background: '#f8fafc', width: '100%', justifyContent: 'center' }}>
                                                <Info size={16} /> Xem chi tiết
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </div>


            {/* FULL-SCREEN QUESTION EDITOR MODAL */}
            {formOpen && (
                <div className="teacher-modal-overlay" style={{ padding: '20px' }}>
                    <div className="teacher-modal wide" style={{ width: '100%', maxWidth: '900px', height: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                        <div style={{ position: 'sticky', top: '0px', zIndex: 100, display: 'flex', justifyContent: 'flex-end', height: 0, overflow: 'visible', pointerEvents: 'none' }}>
                            <button type="button" className="teacher-modal-close" onClick={() => handleCloseForm()} style={{ pointerEvents: 'auto', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, background: 'rgba(241, 245, 249, 0.95)', backdropFilter: 'blur(4px)', border: 'none', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
                                <X size={20} />
                            </button>
                        </div>
                        <h2 className="admin-modal-title" style={{ justifyContent: 'flex-start', marginBottom: '24px', paddingRight: '40px' }}>
                            {isEditing ? (isReadOnly ? 'Chi tiết Câu hỏi' : 'Sửa Câu hỏi') : 'Tạo Câu hỏi mới'}
                        </h2>

                        <div className="teacher-modal-body" style={{ flex: 1, overflowY: 'auto', padding: '0 20px', scrollbarGutter: 'stable' }}>
                            {/* General Settings */}
                            <div className="modal-grid-config" style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr 1.7fr', gap: '16px', marginBottom: '24px' }}>
                                <div className="admin-form-group">
                                    <label>Loại câu hỏi</label>
                                    <CustomDropdown
                                        value={currentQuestion.type}
                                        disabled={isReadOnly}
                                        onChange={val => {
                                            setCurrentQuestion(prev => {
                                                const newVariations = prev.variations.map(() => getInitialVariation(val));
                                                return { ...prev, type: val, variations: newVariations };
                                            });
                                        }}
                                        options={[
                                            { value: 'multiple_choice', label: '🎯 Trắc nghiệm' },
                                            { value: 'fill_in_blank', label: '🔽 Chọn đáp án cho chỗ trống' },
                                            { value: 'fill_in_blank_typing', label: '✏️ Điền vào chỗ trống' },
                                            { value: 'matching', label: '🔗 Kết nối' },
                                            { value: 'categorization', label: '🗂️ Phân loại' },
                                            { value: 'ordering', label: '🔢 Sắp xếp thứ tự' },
                                            { value: 'essay', label: '📝 Viết luận / Tự luận' },
                                            { value: 'audio_recording', label: '🎤 Thu âm / Ghi âm' }
                                        ]}
                                    />
                                </div>
                                <div className="admin-form-group">
                                    <label>Kỹ năng mục tiêu <span style={{ color: '#ef4444', fontWeight: 700 }}>*</span></label>
                                    <CustomDropdown
                                        value={currentQuestion.targetSkill || ''}
                                        disabled={isReadOnly}
                                        className={`required-dropdown${currentQuestion.targetSkill ? ' filled' : ''}`}
                                        options={[
                                            { value: '', label: '— Chọn —' },
                                            { value: 'listening', label: '🎧 Listening' },
                                            { value: 'speaking', label: '🗣️ Speaking' },
                                            { value: 'reading', label: '📖 Reading' },
                                            { value: 'writing', label: '✍️ Writing' },
                                            { value: 'grammar', label: '📝 Grammar' },
                                            { value: 'vocabulary', label: '📚 Vocabulary' },
                                        ]}
                                        onChange={(val) => setCurrentQuestion({ ...currentQuestion, targetSkill: val })}
                                    />
                                </div>
                                <div className="admin-form-group">
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>Mục đích kiểm tra chính của câu hỏi <span style={{ color: '#ef4444', fontWeight: 700 }}>*</span> <span title="AI sử dụng mục đích này để tạo variations chính xác và phù hợp" style={{ cursor: 'help', color: '#94a3b8', fontSize: '0.8rem', fontWeight: 700, width: '16px', height: '16px', borderRadius: '50%', border: '1.5px solid #cbd5e1', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>i</span></label>
                                    <textarea
                                        className={`admin-form-input required-field${currentQuestion.purpose ? ' filled' : ''}`}
                                        required
                                        placeholder="VD: Kiểm tra khả năng phân biệt quá khứ đơn và quá khứ hoàn thành"
                                        value={currentQuestion.purpose}
                                        onChange={e => setCurrentQuestion({ ...currentQuestion, purpose: e.target.value })}
                                        disabled={isReadOnly}
                                        rows={1}
                                        style={{ resize: 'none', overflow: 'hidden', minHeight: '40px', lineHeight: '1.5' }}
                                        onInput={e => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px'; }}
                                    />
                                </div>
                            </div>
                            {currentQuestion.type === 'fill_in_blank_typing' && (
                                <div style={{
                                    display: 'flex', alignItems: 'flex-start', gap: '10px',
                                    padding: '10px 14px', marginTop: '-16px', marginBottom: '16px',
                                    background: '#fffbeb', border: '1px solid #fde68a',
                                    borderRadius: '10px', fontSize: '0.82rem', color: '#92400e',
                                    lineHeight: 1.5
                                }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', flexShrink: 0, fontWeight: 600, marginTop: '1px' }}>
                                        <input
                                            type="checkbox"
                                            checked={!!currentQuestion.useAIGrading}
                                            onChange={e => setCurrentQuestion(prev => ({ ...prev, useAIGrading: e.target.checked }))}
                                            disabled={isReadOnly}
                                            style={{ accentColor: '#d97706', width: '15px', height: '15px', cursor: 'pointer' }}
                                        />
                                        <span>🤖 Nhờ AI kiểm tra</span>
                                    </label>
                                    <span style={{ color: '#78350f', opacity: 0.8 }}>— Đáp án bạn cung cấp là <strong>đáp án gợi ý</strong>. Nếu câu trả lời của học viên gần nghĩa và vẫn đúng ngữ cảnh, AI sẽ chấp nhận là đúng. Tuy nhiên, học viên sẽ phải chờ AI chấm điểm.</span>
                                </div>
                            )}

                            <hr className="form-section-divider" />
                            {/* Vocabulary topic selector */}
                            {!isReadOnly && (
                                <div className="admin-form-group optional-field" style={{ marginBottom: '24px' }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>📚 Chủ đề từ vựng (tùy chọn) <span title="AI sẽ ưu tiên sử dụng từ vựng trong chủ đề này để tạo câu hỏi" style={{ cursor: 'help', color: '#94a3b8', fontSize: '0.8rem', fontWeight: 700, width: '16px', height: '16px', borderRadius: '50%', border: '1.5px solid #cbd5e1', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>i</span></label>
                                    <div style={{ position: 'relative' }}>
                                        <input
                                            type="text"
                                            className="admin-form-input"
                                            placeholder="🔍 Nhấp để tìm chủ đề từ vựng..."
                                            value={selectedVocabTopicId ? (vocabTopics.find(t => t.id === selectedVocabTopicId)?.name || '') : vocabTopicSearch}
                                            onChange={e => {
                                                setVocabTopicSearch(e.target.value);
                                                if (selectedVocabTopicId) setSelectedVocabTopicId('');
                                                setShowVocabDropdown(true);
                                            }}
                                            onFocus={() => {
                                                if (selectedVocabTopicId) {
                                                    setVocabTopicSearch(vocabTopics.find(t => t.id === selectedVocabTopicId)?.name || '');
                                                    setSelectedVocabTopicId('');
                                                }
                                                setShowVocabDropdown(true);
                                            }}
                                            onBlur={() => {
                                                setTimeout(() => setShowVocabDropdown(false), 200);
                                            }}
                                            style={{ fontSize: '0.85rem', padding: '8px 12px', paddingRight: selectedVocabTopicId ? '32px' : '12px', cursor: 'pointer' }}
                                        />
                                        {selectedVocabTopicId && (
                                            <button type="button" onClick={() => { setSelectedVocabTopicId(''); setVocabTopicSearch(''); setVocabWords([]); }}
                                                style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '2px' }}>
                                                <X size={14} />
                                            </button>
                                        )}
                                        {showVocabDropdown && !selectedVocabTopicId && (() => {
                                            const filtered = vocabTopics.filter(t => {
                                                if (vocabSourceFilter === 'official' && t.source !== 'official') return false;
                                                if (vocabSourceFilter === 'teacher' && t.source !== 'teacher') return false;
                                                return !vocabTopicSearch || t.name?.toLowerCase().includes(vocabTopicSearch.toLowerCase());
                                            });
                                            return (
                                                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', marginTop: '4px', boxShadow: '0 8px 24px rgba(0,0,0,0.12)', zIndex: 2000, overflow: 'hidden' }}>
                                                    <div style={{ display: 'flex', gap: '4px', padding: '8px 8px 0', borderBottom: '1px solid #f1f5f9', paddingBottom: '8px' }}>
                                                        {[{ key: 'all', label: 'Tất cả' }, { key: 'official', label: 'Chính thức' }, { key: 'teacher', label: 'Tự soạn' }].map(f => (
                                                            <button key={f.key} type="button"
                                                                onMouseDown={e => { e.preventDefault(); setVocabSourceFilter(f.key); }}
                                                                style={{ padding: '4px 10px', fontSize: '0.75rem', fontWeight: 700, borderRadius: '6px', border: 'none', cursor: 'pointer', background: vocabSourceFilter === f.key ? '#6366f1' : '#f1f5f9', color: vocabSourceFilter === f.key ? '#fff' : '#64748b', transition: 'all 0.15s' }}>
                                                                {f.label}
                                                            </button>
                                                        ))}
                                                    </div>
                                                    <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                                                        {filtered.length === 0 ? (
                                                            <div style={{ padding: '12px', fontSize: '0.85rem', color: '#94a3b8', textAlign: 'center' }}>Không tìm thấy chủ đề</div>
                                                        ) : filtered.slice(0, 30).map(t => (
                                                            <div key={t.id}
                                                                onMouseDown={(e) => { e.preventDefault(); setSelectedVocabTopicId(t.id); setVocabTopicSearch(''); setShowVocabDropdown(false); }}
                                                                style={{ padding: '8px 12px', cursor: 'pointer', fontSize: '0.85rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9' }}
                                                                onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'}
                                                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                                            >
                                                                <span style={{ fontWeight: 600, color: '#1e293b' }}>{t.name}</span>
                                                                <span style={{ fontSize: '0.7rem', padding: '2px 6px', borderRadius: '4px', background: t.source === 'teacher' ? '#dbeafe' : '#fef3c7', color: t.source === 'teacher' ? '#1d4ed8' : '#92400e', fontWeight: 600 }}>
                                                                    {t.source === 'teacher' ? 'Tự soạn' : 'Chính thức'}
                                                                </span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            );
                                        })()}
                                    </div>
                                    {selectedVocabTopicId && (
                                        <div style={{ fontSize: '0.78rem', color: '#059669', marginTop: '4px', fontWeight: 600 }}>
                                            {loadingVocabWords ? '⏳ Đang tải từ vựng...' : `✅ ${vocabWords.length} từ vựng sẽ được AI ưu tiên sử dụng`}
                                        </div>
                                    )}

                                </div>
                            )}

                            {['essay', 'audio_recording'].includes(currentQuestion.type) && (
                                <div style={{
                                    border: '1.5px solid #c7d2fe', borderRadius: '14px',
                                    padding: '16px', background: '#fafbff',
                                    marginTop: '4px', marginBottom: '24px'
                                }}>
                                    <div style={{
                                        display: 'flex', alignItems: 'center', gap: '8px',
                                        marginBottom: '14px', paddingBottom: '10px',
                                        borderBottom: '1px solid #e0e7ff'
                                    }}>
                                        <span style={{ fontSize: '1.15rem' }}>🧑‍🏫</span>
                                        <span style={{ fontWeight: 700, fontSize: '0.92rem', color: '#3730a3' }}>
                                            Thiết lập chấm điểm AI
                                        </span>
                                        <span style={{
                                            fontSize: '0.7rem', padding: '2px 8px',
                                            background: '#e0e7ff', color: '#4f46e5',
                                            borderRadius: '6px', fontWeight: 600
                                        }}>
                                            Tùy chọn
                                        </span>
                                    </div>
                                    {/* Section 1: Default criteria toggle */}
                                    <div className="admin-form-group optional-field" style={{ marginBottom: '0' }}>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: isReadOnly ? 'default' : 'pointer', userSelect: 'none' }}>
                                            <input
                                                type="checkbox"
                                                checked={currentQuestion.useDefaultGradingCriteria !== false}
                                                disabled={isReadOnly}
                                                onChange={e => setCurrentQuestion(prev => ({ ...prev, useDefaultGradingCriteria: e.target.checked, ...(e.target.checked ? { promptId: '', promptTitle: '' } : {}) }))}
                                                style={{ accentColor: '#6366f1', width: '16px', height: '16px', cursor: isReadOnly ? 'default' : 'pointer' }}
                                            />
                                            <span style={{ fontWeight: 600, fontSize: '0.88rem', color: '#334155' }}>
                                                📏 Sử dụng tiêu chí chấm mặc định của hệ thống
                                            </span>
                                            <span title={currentQuestion.useDefaultGradingCriteria !== false ? 'AI sẽ áp dụng tiêu chí chấm mặc định bên dưới, kết hợp với prompt/yêu cầu đặc biệt (nếu có).' : 'AI sẽ chỉ chấm theo prompt/yêu cầu đặc biệt của bạn. Không áp dụng tiêu chí mặc định.'}
                                                style={{ cursor: 'help', color: '#94a3b8', fontSize: '0.8rem', fontWeight: 700, width: '16px', height: '16px', borderRadius: '50%', border: '1.5px solid #cbd5e1', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>i</span>
                                        </label>
                                        {currentQuestion.useDefaultGradingCriteria !== false && (
                                            <div style={{
                                                marginTop: '8px', padding: '12px 16px',
                                                background: '#fff', border: '1px solid #e2e8f0',
                                                borderRadius: '10px', fontSize: '0.8rem', color: '#475569',
                                                lineHeight: 1.6
                                            }}>
                                                <div style={{ fontWeight: 700, color: '#334155', marginBottom: '6px', fontSize: '0.82rem' }}>
                                                    📋 Tiêu chí chấm mặc định:
                                                </div>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                    <div>• Thiếu thông tin quan trọng → tối đa <strong>55-60%</strong> điểm tối đa</div>
                                                    <div>• Chỉ đề cập một phần nhỏ → tối đa <strong>30-40%</strong> điểm tối đa</div>
                                                    <div>• Bổ sung thêm chi tiết liên quan → <strong>thưởng thêm điểm</strong></div>
                                                </div>
                                                {currentQuestion.type === 'audio_recording' && (
                                                    <>
                                                        <div style={{ fontWeight: 700, color: '#334155', marginTop: '8px', marginBottom: '4px', fontSize: '0.82rem' }}>
                                                            📊 Thang điểm tham khảo:
                                                        </div>
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                            <div>• <strong>90-100%</strong>: Xuất sắc — đúng, đầy đủ, phát âm rõ</div>
                                                            <div>• <strong>70-80%</strong>: Tốt — đúng, khá đầy đủ, lỗi nhỏ</div>
                                                            <div>• <strong>50-60%</strong>: Trung bình — hiểu được, thiếu hoặc nhiều lỗi</div>
                                                            <div>• <strong>30-40%</strong>: Yếu — thiếu nhiều, khó hiểu</div>
                                                            <div>• <strong>0-20%</strong>: Rất yếu — không liên quan</div>
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {currentQuestion.useDefaultGradingCriteria === false && (
                                    <>
                                    <hr style={{ border: 'none', borderTop: '1px solid #e0e7ff', margin: '12px 0' }} />

                                    {/* Prompt picker — only when default criteria is OFF */}
                                    <div className="admin-form-group optional-field" style={{ marginBottom: '8px' }}>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>📝 Chọn/nhập tiêu chí chấm điểm cá nhân từ prompt bank của bạn (nếu có) <span title="Hướng dẫn AI chấm theo tiêu chí riêng của bạn." style={{ cursor: 'help', color: '#94a3b8', fontSize: '0.8rem', fontWeight: 700, width: '16px', height: '16px', borderRadius: '50%', border: '1.5px solid #cbd5e1', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>i</span></label>
                                        {isReadOnly ? (
                                            (currentQuestion.promptId || currentQuestion.specialRequirement) && (
                                                <div style={{
                                                    display: 'flex', alignItems: 'center', gap: '8px',
                                                    padding: '10px 14px', background: '#f8fafc', border: '1px solid #e2e8f0',
                                                    borderRadius: '10px', fontSize: '0.85rem', color: '#64748b', fontWeight: 500
                                                }}>
                                                    <span style={{ fontSize: '1rem' }}>🔒</span>
                                                    <span>Đã thiết lập yêu cầu chấm bài bởi giáo viên chủ sở hữu</span>
                                                </div>
                                            )
                                        ) : (
                                            <>
                                                {!currentQuestion.promptId && (
                                                    <div style={{ marginBottom: '8px' }}>
                                                        <SavedPromptPicker
                                                            uid={user?.uid}
                                                            onSelect={({ id, title }) => setCurrentQuestion(prev => ({
                                                                ...prev,
                                                                promptId: id,
                                                                promptTitle: title
                                                            }))}
                                                        />
                                                    </div>
                                                )}
                                                {currentQuestion.promptId && (
                                                    <div style={{
                                                        display: 'flex', alignItems: 'center', gap: '10px',
                                                        padding: '10px 14px', background: '#f0fdf4', border: '1px solid #bbf7d0',
                                                        borderRadius: '10px', fontSize: '0.85rem', color: '#15803d', fontWeight: 600,
                                                    }}>
                                                        <span style={{ fontSize: '1rem' }}>📎</span>
                                                        <span style={{ flex: 1 }}>Đang sử dụng prompt: "<strong>{currentQuestion.promptTitle || 'Prompt đã lưu'}</strong>"</span>
                                                        <button type="button" onClick={() => setCurrentQuestion(prev => ({ ...prev, promptId: '', promptTitle: '' }))}
                                                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', padding: '2px', display: 'flex', fontSize: '0.8rem', fontWeight: 700 }}
                                                            title="Gỡ prompt đã liên kết">
                                                            ✕ Gỡ
                                                        </button>
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </div>
                                    </>
                                    )}

                                    {/* Special requirement textarea — always visible */}
                                    {!isReadOnly && (
                                    <div className="admin-form-group optional-field" style={{ marginBottom: 0, marginTop: '8px' }}>
                                        <textarea
                                            className="admin-form-input"
                                            placeholder="Nhập yêu cầu bổ sung cho AI khi chấm (nếu có)..."
                                            rows={3}
                                            value={currentQuestion.specialRequirement || ''}
                                            onChange={e => setCurrentQuestion({ ...currentQuestion, specialRequirement: e.target.value })}
                                            style={{ resize: 'vertical' }}
                                        />
                                    </div>
                                    )}
                                </div>
                            )}


                            {/* Context (Ngữ cảnh) Section */}
                            <div style={{ marginBottom: '24px', background: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: currentQuestion.hasContext ? '12px' : '0' }}>
                                    <label style={{ margin: 0, fontWeight: 600, color: '#334155' }}>Ngữ cảnh bổ sung (Bài đọc, Audio, Video YouTube...)</label>
                                    <label className="admin-toggle-switch" style={{ margin: 0 }}>
                                        <input
                                            type="checkbox"
                                            checked={currentQuestion.hasContext || false}
                                            onChange={e => setCurrentQuestion({ ...currentQuestion, hasContext: e.target.checked })}
                                            disabled={isReadOnly}
                                        />
                                        <span className="admin-toggle-slider"></span>
                                    </label>
                                </div>
                                {currentQuestion.hasContext && (
                                    <>
                                        <div style={{ position: 'relative' }}>
                                            <ContextQuillEditor
                                                value={currentQuestion.context || ''}
                                                onChange={(val) => setCurrentQuestion({ ...currentQuestion, context: val })}
                                                readOnly={isReadOnly}
                                            />
                                        </div>
                                        <AudioContextUploader
                                            audioUrl={currentQuestion.contextAudioUrl || ''}
                                            onAudioChange={(url) => setCurrentQuestion({ ...currentQuestion, contextAudioUrl: url || '' })}
                                            disabled={isReadOnly}
                                            resourceType="grammar"
                                            resourceId={id}
                                        />
                                        <div style={{ marginTop: '12px' }}>
                                            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>
                                                📝 Script / Transcript (Chỉ dùng cho AI chấm bài)
                                            </label>
                                            <p style={{ fontSize: '0.8rem', color: '#94a3b8', margin: '0 0 8px 0', lineHeight: 1.5 }}>
                                                Nhập nội dung bài nghe/video ở đây để AI có thể chấm bài chính xác hơn. Học viên sẽ không nhìn thấy phần này.
                                            </p>
                                            <textarea
                                                className="admin-form-input admin-form-textarea"
                                                placeholder="Nhập transcript / script của audio hoặc video ở đây..."
                                                rows={4}
                                                value={currentQuestion.contextScript || ''}
                                                onChange={e => setCurrentQuestion({ ...currentQuestion, contextScript: e.target.value })}
                                                disabled={isReadOnly}
                                                style={{ resize: 'vertical', fontSize: '0.9rem', lineHeight: 1.6 }}
                                            />
                                        </div>
                                    </>
                                )}
                            </div>

                            {/* Variations Tabs */}
                            <div style={{ border: '1px solid #e2e8f0', borderRadius: '16px', overflow: 'hidden', marginBottom: '80px' }}>
                                <div className="variation-tabs-wrapper">
                                    {[0, 1, 2, 3, 4].map(idx => (
                                        <div
                                            key={idx}
                                            onClick={() => setActiveVariationTab(idx)}
                                            className={`variation-tab-item ${activeVariationTab === idx ? 'active' : ''}`}
                                        >
                                            {idx === 0 ? 'Gốc (V1)' : `Variation ${idx + 1}`}
                                        </div>
                                    ))}
                                </div>


                                <div style={{ padding: '20px' }}>
                                    <div className="variation-header-actions" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: activeVariationTab === 0 ? '4px' : '16px', gap: '12px' }}>
                                        <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#334155', margin: 0 }}>
                                            Nội dung Variation {activeVariationTab + 1} {activeVariationTab === 0 && <span style={{ color: '#ef4444', fontWeight: 700 }}>*</span>}
                                        </h3>
                                        <div className="ai-btn-wrapper" style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                                            {!isReadOnly && (
                                                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', fontWeight: 600, color: '#475569', cursor: 'pointer' }}>
                                                    <input
                                                        type="checkbox"
                                                        checked={isVietnameseQuestion}
                                                        onChange={e => setIsVietnameseQuestion(e.target.checked)}
                                                        style={{ accentColor: 'var(--color-primary)', width: '16px', height: '16px' }}
                                                    />
                                                    Hỏi bằng TV
                                                </label>
                                            )}
                                            {!isReadOnly && currentQuestion.type === 'multiple_choice' &&
                                                (currentQuestion.variations?.[0]?.options || []).some(opt => isImageOption(opt)) && (
                                                <div style={{
                                                    display: 'flex', alignItems: 'center', gap: '8px',
                                                    padding: '10px 14px',
                                                    background: '#dbeafe', border: '1px solid #93c5fd',
                                                    borderRadius: '10px', fontSize: '0.82rem', color: '#1e40af',
                                                    lineHeight: 1.5, width: '100%'
                                                }}>
                                                    <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>💡</span>
                                                    <span>Đáp án có chứa <b>hình ảnh</b> — AI sẽ tạo đáp án dạng <b>text</b> cho các variations. Sau khi AI tạo xong, hãy bấm <b>✨</b> bên cạnh mỗi đáp án để tạo ảnh.</span>
                                                </div>
                                            )}
                                            {!isReadOnly && (activeVariationTab === 0 ? (
                                                <button
                                                    type="button"
                                                    onClick={handleGenerateAI}
                                                    disabled={isGeneratingAI || isGeneratingSingleAI}
                                                    className="admin-btn-ai"
                                                    style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '10px', cursor: (isGeneratingAI || isGeneratingSingleAI) ? 'not-allowed' : 'pointer', fontWeight: 800, fontSize: '0.85rem' }}
                                                >
                                                    {isGeneratingAI ? <RefreshCw size={16} className="animate-spin" /> : <Wand2 size={16} />}
                                                    {isGeneratingAI ? 'Đang gọi AI...' : 'Quét lỗi và tạo variations'}
                                                </button>
                                            ) : (
                                                <button
                                                    type="button"
                                                    onClick={() => handleGenerateSingleAI(activeVariationTab)}
                                                    disabled={isGeneratingAI || isGeneratingSingleAI}
                                                    className="admin-btn-ai"
                                                    style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '10px', cursor: (isGeneratingAI || isGeneratingSingleAI) ? 'not-allowed' : 'pointer', fontWeight: 800, fontSize: '0.85rem' }}
                                                >
                                                    {isGeneratingSingleAI ? <RefreshCw size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                                                    {isGeneratingSingleAI ? 'Đang gọi AI...' : `Tạo lại version ${activeVariationTab + 1}`}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    {activeVariationTab === 0 && (
                                        <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '12px', lineHeight: 1.4 }}>⚡ Đây là câu mẫu để AI bắt chước và tạo ra các variations tương tự.</div>
                                    )}


                                    {/* Variation Content Editor */}
                                    {currentQuestion.type !== 'fill_in_blank' && currentQuestion.type !== 'fill_in_blank_typing' && (
                                        <div className="admin-form-group">
                                            <label>Đề bài / Câu hỏi</label>
                                            <RichTextInput
                                                key={`text-${currentQuestion.type}-${activeVariationTab}-${aiRefreshKey}`}
                                                value={currentQuestion.variations[activeVariationTab].text}
                                                onChange={val => updateVariation(activeVariationTab, 'text', val)}
                                                disabled={isReadOnly}
                                                placeholder="Nhập nội dung câu hỏi..."
                                                minHeight='80px'
                                                wrapperClassName={activeVariationTab === 0 ? `required-field${currentQuestion.variations[activeVariationTab].text?.replace(/<[^>]*>?/gm, '').trim() ? ' filled' : ''}` : ''}
                                            />
                                        </div>
                                    )}

                                    {currentQuestion.type === 'multiple_choice' && (
                                        <div style={{ marginTop: '16px' }}>
                                            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#475569', marginBottom: '8px' }}>Các đáp án (Chọn đáp án đúng)</label>
                                            <div className="options-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                                {(currentQuestion.variations[activeVariationTab].options || []).map((optVal, optIdx) => {
                                                    return (
                                                        <div key={optIdx} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                            <input
                                                                type="radio"
                                                                name={`correct-${activeVariationTab}`}
                                                                checked={currentQuestion.variations[activeVariationTab].correctAnswer === optIdx}
                                                                onChange={() => updateVariation(activeVariationTab, 'correctAnswer', optIdx)}
                                                                disabled={isReadOnly}
                                                                style={{ accentColor: 'var(--color-primary)', width: '18px', height: '18px', flexShrink: 0 }}
                                                            />
                                                            {isImageOption(optVal) ? (
                                                                <ImageOptionUploader
                                                                    value={optVal}
                                                                    onChange={url => updateOption(activeVariationTab, optIdx, url)}
                                                                    onScheduleDelete={url => pendingImageDeletionsRef.current.push(url)}
                                                                    onTrackUpload={url => newlyUploadedImagesRef.current.push(url)}
                                                                    onSaveOriginalText={text => { originalOptionTextsRef.current[`${activeVariationTab}-${optIdx}`] = text; }}
                                                                    restoreValue={originalOptionTextsRef.current[`${activeVariationTab}-${optIdx}`] || ''}
                                                                    disabled={isReadOnly}
                                                                />
                                                            ) : (
                                                                <>
                                                                    <input
                                                                        type="text"
                                                                        className="admin-form-input"
                                                                        placeholder={`Đáp án ${optIdx + 1}`}
                                                                        value={optVal}
                                                                        onChange={e => updateOption(activeVariationTab, optIdx, e.target.value)}
                                                                        disabled={isReadOnly}
                                                                    />
                                                                    <ImageOptionUploader
                                                                        value={optVal}
                                                                        onChange={url => updateOption(activeVariationTab, optIdx, url)}
                                                                        onScheduleDelete={url => pendingImageDeletionsRef.current.push(url)}
                                                                        onTrackUpload={url => newlyUploadedImagesRef.current.push(url)}
                                                                        onSaveOriginalText={text => { originalOptionTextsRef.current[`${activeVariationTab}-${optIdx}`] = text; }}
                                                                        disabled={isReadOnly}
                                                                    />
                                                                    <AIImageGenerateButton
                                                                        optionText={optVal}
                                                                        onChange={url => updateOption(activeVariationTab, optIdx, url)}
                                                                        currentValue={optVal}
                                                                        onScheduleDelete={url => pendingImageDeletionsRef.current.push(url)}
                                                                        onTrackUpload={url => newlyUploadedImagesRef.current.push(url)}
                                                                        onSaveOriginalText={text => { originalOptionTextsRef.current[`${activeVariationTab}-${optIdx}`] = text; }}
                                                                        disabled={isReadOnly}
                                                                    />
                                                                </>
                                                            )}
                                                            {!isReadOnly && (currentQuestion.variations[activeVariationTab].options || []).length > 2 && (
                                                                <button type="button" onClick={() => removeOption(activeVariationTab, optIdx)} title="Xóa đáp án" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '4px', borderRadius: '4px', display: 'flex', alignItems: 'center', flexShrink: 0, opacity: 0.6 }} onMouseOver={e => e.currentTarget.style.opacity = 1} onMouseOut={e => e.currentTarget.style.opacity = 0.6}>
                                                                    <X size={14} />
                                                                </button>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                            {!isReadOnly && (currentQuestion.variations[activeVariationTab].options || []).length < 6 && (
                                                <button type="button" onClick={() => addOption(activeVariationTab)} style={{ marginTop: '8px', background: 'none', border: '1px dashed #cbd5e1', borderRadius: '8px', padding: '6px 12px', color: '#64748b', fontSize: '0.8rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                                    <Plus size={14} /> Thêm đáp án
                                                </button>
                                            )}
                                        </div>
                                    )}


                                    {currentQuestion.type === 'fill_in_blank' && (
                                        <GrammarFillInBlankEditor
                                            key={`fib-${activeVariationTab}-${aiRefreshKey}`}
                                            aiRefreshKey={aiRefreshKey}
                                            variation={currentQuestion.variations[activeVariationTab]}
                                            vIdx={activeVariationTab}
                                            isReadOnly={isReadOnly}
                                            updateVariation={updateVariation}
                                        />
                                    )}

                                    {currentQuestion.type === 'fill_in_blank_typing' && (
                                        <GrammarFillInBlankEditor
                                            key={`fibt-${activeVariationTab}-${aiRefreshKey}`}
                                            aiRefreshKey={aiRefreshKey}
                                            variation={currentQuestion.variations[activeVariationTab]}
                                            vIdx={activeVariationTab}
                                            isReadOnly={isReadOnly}
                                            updateVariation={updateVariation}
                                            hideDistractors={true}
                                        />

                                    )}

                                    {currentQuestion.type === 'matching' && (
                                        <div style={{ marginTop: '16px' }}>
                                            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#475569', marginBottom: '8px' }}>Các cặp tương ứng (Nối cột trái vào cột phải)</label>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                                {(currentQuestion.variations[activeVariationTab].pairs || []).map((pair, pIdx) => (
                                                    <div key={pIdx} className="matching-pair-row" style={{ display: 'flex', gap: '12px', alignItems: 'center', background: '#f8fafc', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                                                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                            <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#94a3b8', width: '20px' }}>L{pIdx + 1}</span>
                                                            <input
                                                                type="text"
                                                                className="admin-form-input"
                                                                placeholder="Vế trái..."
                                                                value={pair.left}
                                                                onChange={e => updatePair(activeVariationTab, pIdx, 'left', e.target.value)}
                                                                disabled={isReadOnly}
                                                            />
                                                        </div>
                                                        <div style={{ fontSize: '1rem', color: '#94a3b8', fontWeight: 800 }}>=</div>
                                                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                            <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#94a3b8', width: '20px' }}>R{pIdx + 1}</span>
                                                            <input
                                                                type="text"
                                                                className="admin-form-input"
                                                                placeholder="Vế phải (đáp án khớp)..."
                                                                value={pair.right}
                                                                onChange={e => updatePair(activeVariationTab, pIdx, 'right', e.target.value)}
                                                                disabled={isReadOnly}
                                                            />
                                                        </div>
                                                        {!isReadOnly && (
                                                            <button
                                                                type="button"
                                                                className="admin-action-btn danger"
                                                                onClick={() => removePair(activeVariationTab, pIdx)}
                                                                title="Xóa cặp này"
                                                            >
                                                                <Trash2 size={16} />
                                                            </button>
                                                        )}
                                                    </div>
                                                ))}

                                                {!isReadOnly && (
                                                    <button
                                                        type="button"
                                                        onClick={() => addPair(activeVariationTab)}
                                                        style={{ alignSelf: 'flex-start', background: 'none', border: '1px dashed #cbd5e1', color: '#4f46e5', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}
                                                    >
                                                        <Plus size={14} /> Thêm Cặp Nối
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {currentQuestion.type === 'categorization' && (() => {
                                        const v1Groups = currentQuestion.variations?.[0]?.groups || ['Nhóm 1', 'Nhóm 2'];
                                        const effectiveGroups = (currentQuestion.variations[activeVariationTab]?.groups && currentQuestion.variations[activeVariationTab].groups.length > 0)
                                            ? currentQuestion.variations[activeVariationTab].groups : v1Groups;
                                        return (
                                            <div style={{ marginTop: '16px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                                                {effectiveGroups.map((g, gIdx) => {
                                                    const allItems = currentQuestion.variations[activeVariationTab]?.items || [];
                                                    const groupItems = allItems
                                                        .map((item, origIdx) => ({ ...item, _origIdx: origIdx }))
                                                        .filter(item => item.group === g);
                                                    const groupColors = [
                                                        { bg: '#eff6ff', border: '#bfdbfe', header: '#2563eb', headerBg: '#dbeafe', tag: '#3b82f6' },
                                                        { bg: '#fef3c7', border: '#fde68a', header: '#d97706', headerBg: '#fef9c3', tag: '#f59e0b' },
                                                        { bg: '#ecfdf5', border: '#a7f3d0', header: '#059669', headerBg: '#d1fae5', tag: '#10b981' },
                                                        { bg: '#fdf2f8', border: '#fbcfe8', header: '#db2777', headerBg: '#fce7f3', tag: '#ec4899' },
                                                    ];
                                                    const color = groupColors[gIdx % groupColors.length];
                                                    return (
                                                        <div key={gIdx} style={{
                                                            flex: '1 1 200px', minWidth: '180px',
                                                            background: color.bg, borderRadius: '12px',
                                                            border: `1.5px solid ${color.border}`,
                                                            display: 'flex', flexDirection: 'column', overflow: 'hidden'
                                                        }}>
                                                            {/* Column header */}
                                                            <div style={{
                                                                padding: '10px 12px', background: color.headerBg,
                                                                borderBottom: `1.5px solid ${color.border}`,
                                                                display: 'flex', alignItems: 'center', gap: '6px'
                                                            }}>
                                                                <div style={{
                                                                    width: '8px', height: '8px', borderRadius: '50%',
                                                                    background: color.tag, flexShrink: 0
                                                                }} />
                                                                <input type="text" className="admin-form-input"
                                                                    style={{
                                                                        margin: 0, padding: '4px 8px', fontSize: '0.85rem',
                                                                        fontWeight: 700, color: color.header,
                                                                        background: 'transparent', border: '1.5px dashed transparent',
                                                                        borderRadius: '6px', textAlign: 'center',
                                                                        transition: 'all 0.2s'
                                                                    }}
                                                                    onFocus={e => { e.target.style.background = '#fff'; e.target.style.borderColor = color.border; }}
                                                                    onBlur={e => { e.target.style.background = 'transparent'; e.target.style.borderColor = 'transparent'; }}
                                                                    placeholder={`Nhóm ${gIdx + 1}`}
                                                                    disabled={isReadOnly}
                                                                    value={g}
                                                                    onChange={e => updateGroup(activeVariationTab, gIdx, e.target.value)}
                                                                />
                                                                <span style={{ fontSize: '0.7rem', color: color.header, fontWeight: 600, opacity: 0.7, flexShrink: 0 }}>
                                                                    {groupItems.length}
                                                                </span>
                                                                {!isReadOnly && (
                                                                    <button type="button" onClick={() => removeGroup(activeVariationTab, gIdx)}
                                                                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#cbd5e1', padding: '2px', display: 'flex', transition: 'color 0.2s', flexShrink: 0 }}
                                                                        onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                                                                        onMouseLeave={e => e.currentTarget.style.color = '#cbd5e1'}>
                                                                        <X size={14} />
                                                                    </button>
                                                                )}
                                                            </div>
                                                            {/* Items */}
                                                            <div style={{ padding: '8px', display: 'flex', flexDirection: 'column', gap: '6px', minHeight: '50px' }}>
                                                                {groupItems.map((item) => (
                                                                    <div key={item._origIdx} style={{
                                                                        display: 'flex', alignItems: 'center', gap: '6px',
                                                                        background: '#fff', borderRadius: '8px',
                                                                        padding: '6px 10px', border: '1px solid #e2e8f0',
                                                                        boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
                                                                    }}>
                                                                        <input type="text" className="admin-form-input"
                                                                            style={{ margin: 0, flex: 1, border: 'none', padding: '2px 4px', fontSize: '0.85rem', background: 'transparent' }}
                                                                            placeholder="Nhập nội dung..."
                                                                            disabled={isReadOnly}
                                                                            value={item.text}
                                                                            onChange={e => updateItem(activeVariationTab, item._origIdx, 'text', e.target.value)}
                                                                        />
                                                                        {!isReadOnly && (
                                                                            <button type="button" onClick={() => removeItem(activeVariationTab, item._origIdx)}
                                                                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#cbd5e1', padding: '2px', display: 'flex', transition: 'color 0.2s' }}
                                                                                onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                                                                                onMouseLeave={e => e.currentTarget.style.color = '#cbd5e1'}>
                                                                                <X size={14} />
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                ))}
                                                                {!isReadOnly && (
                                                                    <button type="button"
                                                                        onClick={() => {
                                                                            setCurrentQuestion(prev => {
                                                                                const newVars = [...prev.variations];
                                                                                if (!newVars[activeVariationTab]) {
                                                                                    newVars[activeVariationTab] = { text: '', groups: [...effectiveGroups], items: [], explanation: '' };
                                                                                } else if (!newVars[activeVariationTab].groups || newVars[activeVariationTab].groups.length === 0) {
                                                                                    newVars[activeVariationTab] = { ...newVars[activeVariationTab], groups: [...effectiveGroups] };
                                                                                }
                                                                                newVars[activeVariationTab] = {
                                                                                    ...newVars[activeVariationTab],
                                                                                    items: [...(newVars[activeVariationTab].items || []), { text: '', group: g }]
                                                                                };
                                                                                return { ...prev, variations: newVars };
                                                                            });
                                                                        }}
                                                                        style={{
                                                                            padding: '6px', fontSize: '0.78rem', fontWeight: 600,
                                                                            background: 'transparent', color: color.header,
                                                                            border: `1.5px dashed ${color.border}`, borderRadius: '8px',
                                                                            cursor: 'pointer', display: 'flex', alignItems: 'center',
                                                                            justifyContent: 'center', gap: '4px', transition: 'all 0.2s',
                                                                            opacity: 0.7
                                                                        }}
                                                                        onMouseEnter={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.background = '#fff'; }}
                                                                        onMouseLeave={e => { e.currentTarget.style.opacity = '0.7'; e.currentTarget.style.background = 'transparent'; }}
                                                                    >
                                                                        <Plus size={14} /> Thêm
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                                {!isReadOnly && (
                                                    <button type="button"
                                                        onClick={() => addGroup(activeVariationTab)}
                                                        style={{
                                                            alignSelf: 'stretch', minWidth: '60px', background: '#f8fafc',
                                                            border: '2px dashed #cbd5e1', borderRadius: '12px',
                                                            cursor: 'pointer', display: 'flex', flexDirection: 'column',
                                                            alignItems: 'center', justifyContent: 'center', gap: '4px',
                                                            color: '#94a3b8', fontSize: '0.78rem', fontWeight: 600,
                                                            transition: 'all 0.2s', padding: '16px 12px'
                                                        }}
                                                        onMouseEnter={e => { e.currentTarget.style.borderColor = '#4f46e5'; e.currentTarget.style.color = '#4f46e5'; e.currentTarget.style.background = '#eef2ff'; }}
                                                        onMouseLeave={e => { e.currentTarget.style.borderColor = '#cbd5e1'; e.currentTarget.style.color = '#94a3b8'; e.currentTarget.style.background = '#f8fafc'; }}
                                                    >
                                                        <Plus size={18} />
                                                        Thêm nhóm
                                                    </button>
                                                )}
                                            </div>
                                        );
                                    })()}

                                    {currentQuestion.type === 'ordering' && (() => {
                                        const items = currentQuestion.variations[activeVariationTab]?.items || [''];
                                        return (
                                            <div style={{ marginTop: '16px' }}>
                                                <div className="admin-form-group">
                                                    <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#475569' }}>
                                                        Các mục (theo đúng thứ tự)
                                                    </label>
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                        {items.map((item, iIdx) => (
                                                            <div key={iIdx} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                <span style={{
                                                                    width: '24px', height: '24px', borderRadius: '50%',
                                                                    background: '#6366f1', color: '#fff', display: 'flex',
                                                                    alignItems: 'center', justifyContent: 'center',
                                                                    fontSize: '0.7rem', fontWeight: 800, flexShrink: 0
                                                                }}>{iIdx + 1}</span>
                                                                <input
                                                                    type="text"
                                                                    className="admin-form-input"
                                                                    disabled={isReadOnly}
                                                                    style={{ margin: 0, flex: 1 }}
                                                                    placeholder={`Mục ${iIdx + 1}`}
                                                                    value={item}
                                                                    onChange={e => {
                                                                        setCurrentQuestion(prev => {
                                                                            const newVars = [...prev.variations];
                                                                            const curItems = [...(newVars[activeVariationTab]?.items || [])];
                                                                            curItems[iIdx] = e.target.value;
                                                                            newVars[activeVariationTab] = { ...newVars[activeVariationTab], items: curItems };
                                                                            return { ...prev, variations: newVars };
                                                                        });
                                                                    }}
                                                                />
                                                                {!isReadOnly && items.length > 1 && (
                                                                    <button type="button" onClick={() => {
                                                                        setCurrentQuestion(prev => {
                                                                            const newVars = [...prev.variations];
                                                                            const curItems = [...(newVars[activeVariationTab]?.items || [])];
                                                                            curItems.splice(iIdx, 1);
                                                                            newVars[activeVariationTab] = { ...newVars[activeVariationTab], items: curItems };
                                                                            return { ...prev, variations: newVars };
                                                                        });
                                                                    }} style={{ background: 'none', border: '1px solid #fecaca', color: '#ef4444', borderRadius: '6px', cursor: 'pointer', padding: '4px 8px', fontSize: '0.8rem' }}>
                                                                        <Trash2 size={14} />
                                                                    </button>
                                                                )}
                                                            </div>
                                                        ))}
                                                        {!isReadOnly && (
                                                            <button type="button"
                                                                onClick={() => {
                                                                    setCurrentQuestion(prev => {
                                                                        const newVars = [...prev.variations];
                                                                        const curItems = [...(newVars[activeVariationTab]?.items || []), ''];
                                                                        newVars[activeVariationTab] = { ...newVars[activeVariationTab], items: curItems };
                                                                        return { ...prev, variations: newVars };
                                                                    });
                                                                }}
                                                                style={{ alignSelf: 'flex-start', background: 'none', border: '1px dashed #cbd5e1', color: '#4f46e5', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}
                                                            >
                                                                <Plus size={14} /> Thêm mục
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })()}

                                    {currentQuestion.type === 'essay' && (
                                        <div style={{ marginTop: '16px' }}>
                                            <div className="admin-form-group">
                                                <label>Đáp án tham khảo (Tùy chọn)</label>
                                                <textarea
                                                    className="admin-form-input admin-form-textarea"
                                                    placeholder="Đáp án mẫu để AI tham khảo khi chấm bài..."
                                                    value={currentQuestion.variations[activeVariationTab].sampleAnswer || ''}
                                                    onChange={e => updateVariation(activeVariationTab, 'sampleAnswer', e.target.value)}
                                                    disabled={isReadOnly}
                                                />
                                            </div>
                                        </div>
                                    )}

                                    <div className="admin-form-group" style={{ marginTop: '16px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                                            <label style={{ margin: 0 }}>Giải thích / Lời khuyên (Hiển thị khi học sinh làm xong)</label>
                                            {!isReadOnly && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleGenerateExplanation(activeVariationTab)}
                                                    disabled={isGeneratingExplanation}
                                                    className="admin-btn admin-btn-outline"
                                                    style={{ padding: '2px 10px', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                                    title="AI tạo giải thích bắt chước style Variation 1"
                                                >
                                                    {isGeneratingExplanation ? <RefreshCw size={12} className="animate-spin" /> : <Wand2 size={12} />}
                                                    <span>AI giải thích</span>
                                                </button>
                                            )}
                                        </div>
                                        <RichTextInput
                                            key={`expl-${currentQuestion.type}-${activeVariationTab}-${aiRefreshKey}`}
                                            value={currentQuestion.variations[activeVariationTab].explanation}
                                            onChange={val => updateVariation(activeVariationTab, 'explanation', val)}
                                            disabled={isReadOnly}
                                            placeholder="Giải thích vì sao lại chọn đáp án này..."
                                            minHeight="60px"
                                        />
                                    </div>

                                </div>
                            </div>

                        </div>

                        <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '16px', marginTop: '16px', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                            <button type="button" className="admin-btn admin-btn-secondary" onClick={() => handleCloseForm()} disabled={isSaving}>Đóng</button>
                            {!isReadOnly && (
                                <button type="button" className="admin-btn admin-btn-primary" onClick={handleSubmit} disabled={isSaving}>
                                    <Save size={16} /> {isSaving ? 'Đang lưu...' : (isEditing ? 'Cập nhật Câu hỏi' : 'Lưu Câu hỏi')}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* DELETE MODAL */}
            {questionToDelete && (
                <div className="teacher-modal-overlay">
                    <div className="teacher-modal">
                        <h2 className="admin-modal-title" style={{ color: '#ef4444', marginBottom: '16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <AlertCircle size={24} /> Xác nhận xóa
                            </div>
                        </h2>
                        <p className="admin-modal-desc">
                            Bạn có chắc chắn muốn xóa câu hỏi này?<br /><br />
                            <strong>Lưu ý:</strong> Hành động này không thể hoàn tác.
                        </p>
                        <div className="admin-modal-actions" style={{ flexDirection: 'row' }}>
                            <button className="admin-btn admin-btn-secondary" style={{ flex: 1 }} onClick={() => setQuestionToDelete(null)}>Hủy</button>
                            <button className="admin-btn admin-btn-primary" style={{ backgroundColor: '#ef4444', flex: 1 }} onClick={handleConfirmDelete}>Xóa vĩnh viễn</button>
                        </div>
                    </div>
                </div>
            )}

            {/* --- DOCUMENT IMPORT MODAL --- */}
            {showImportModal && (
                <div className="teacher-modal-overlay" style={{ zIndex: 1100 }}>
                <div className="teacher-modal" style={{ maxWidth: showImportPreview ? '800px' : '600px', maxHeight: '90vh', overflow: showImportPreview ? 'hidden' : 'auto', display: showImportPreview ? 'flex' : 'block', flexDirection: 'column' }}>
                        {!showImportPreview ? (
                            /* === STEP 1: Input === */
                            <>
                                <h2 className="admin-modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <FileText size={22} style={{ color: '#6366f1' }} /> Nhập câu hỏi từ tài liệu
                                </h2>
                                <p style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: '16px' }}>
                                    Dán nội dung hoặc upload PDF (tối đa 5 trang). AI sẽ tự động trích xuất câu hỏi dưới dạng Variation 1.
                                </p>

                                {/* Tab selector */}
                                <div style={{ display: 'flex', gap: '4px', marginBottom: '16px', background: '#f1f5f9', borderRadius: '10px', padding: '4px' }}>
                                    <button
                                        onClick={() => setImportTab('text')}
                                        style={{
                                            flex: 1, padding: '8px 12px', borderRadius: '8px', border: 'none',
                                            background: importTab === 'text' ? '#fff' : 'transparent',
                                            color: importTab === 'text' ? '#1e293b' : '#64748b',
                                            fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer',
                                            boxShadow: importTab === 'text' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                                            transition: 'all 0.2s'
                                        }}
                                    >
                                        📋 Dán văn bản
                                    </button>
                                    <button
                                        onClick={() => setImportTab('pdf')}
                                        style={{
                                            flex: 1, padding: '8px 12px', borderRadius: '8px', border: 'none',
                                            background: importTab === 'pdf' ? '#fff' : 'transparent',
                                            color: importTab === 'pdf' ? '#1e293b' : '#64748b',
                                            fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer',
                                            boxShadow: importTab === 'pdf' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                                            transition: 'all 0.2s'
                                        }}
                                    >
                                        📄 Upload PDF
                                    </button>
                                </div>

                                {/* Content area */}
                                {importTab === 'text' ? (
                                    <textarea
                                        className="admin-form-input"
                                        rows={12}
                                        placeholder={"Dán nội dung đề thi / bài tập vào đây...\n\nVí dụ:\n1. She ___ (go) to school every day.\na) go  b) goes  c) going  d) went\nAnswer: b\n\n2. Match the words with their meanings:\nabundant - dồi dào\nscarce - khan hiếm"}
                                        value={importText}
                                        onChange={e => setImportText(e.target.value)}
                                        style={{ resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.6, minHeight: '200px' }}
                                    />
                                ) : (
                                    <div style={{
                                        padding: '40px 20px', background: '#f8fafc', borderRadius: '12px',
                                        border: '2px dashed #cbd5e1', textAlign: 'center',
                                        transition: 'all 0.2s'
                                    }}>
                                        {importFile ? (
                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                                                <FileText size={32} style={{ color: '#6366f1' }} />
                                                <span style={{ fontWeight: 700, color: '#1e293b', fontSize: '0.9rem' }}>{importFile.name}</span>
                                                <span style={{ fontSize: '0.8rem', color: '#64748b' }}>{(importFile.size / 1024).toFixed(1)} KB</span>
                                                <button
                                                    onClick={() => setImportFile(null)}
                                                    style={{ padding: '4px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#fff', color: '#ef4444', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 600 }}
                                                >
                                                    Xóa file
                                                </button>
                                            </div>
                                        ) : (
                                            <label style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                                                <Upload size={32} style={{ color: '#94a3b8' }} />
                                                <span style={{ fontWeight: 700, color: '#475569' }}>Chọn file PDF</span>
                                                <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Tối đa 5 trang, 10MB</span>
                                                <input
                                                    type="file"
                                                    accept=".pdf,application/pdf"
                                                    style={{ display: 'none' }}
                                                    onChange={e => {
                                                        const file = e.target.files?.[0];
                                                        if (file) setImportFile(file);
                                                        e.target.value = '';
                                                    }}
                                                />
                                            </label>
                                        )}
                                    </div>
                                )}

                                {/* Actions */}
                                <div className="admin-modal-actions" style={{ marginTop: '16px' }}>
                                    <button className="admin-btn admin-btn-secondary" onClick={() => setShowImportModal(false)} disabled={isImporting}>
                                        Hủy
                                    </button>
                                    <button
                                        className="admin-btn admin-btn-primary"
                                        onClick={handleDocumentImport}
                                        disabled={isImporting || (importTab === 'text' && !importText.trim()) || (importTab === 'pdf' && !importFile)}
                                        style={{
                                            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                            display: 'inline-flex', alignItems: 'center', gap: '6px'
                                        }}
                                    >
                                        {isImporting ? (
                                            <><RefreshCw size={16} className="spinning" /> Đang phân tích...</>
                                        ) : (
                                            <><Wand2 size={16} /> AI Trích xuất</>
                                        )}
                                    </button>
                                </div>
                            </>
                        ) : (
                            /* === STEP 2: Preview & Confirm === */
                            <>
                                <h2 className="admin-modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <CheckCircle size={22} style={{ color: '#22c55e' }} /> Xem trước câu hỏi ({importedQuestions.length} câu)
                                </h2>
                                <p style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: '12px' }}>
                                    Kiểm tra và chọn câu hỏi muốn nhập. Câu hỏi sẽ được lưu dưới dạng Variation 1.
                                </p>

                                {/* Select all / deselect all */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                    <span style={{ fontSize: '0.85rem', color: '#475569', fontWeight: 600 }}>
                                        Đã chọn: {Object.values(importSelections).filter(Boolean).length}/{importedQuestions.length}
                                    </span>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <button
                                            onClick={() => {
                                                const all = {};
                                                importedQuestions.forEach((_, idx) => { all[idx] = true; });
                                                setImportSelections(all);
                                            }}
                                            style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff', fontSize: '0.78rem', cursor: 'pointer', fontWeight: 600, color: '#475569' }}
                                        >
                                            Chọn tất cả
                                        </button>
                                        <button
                                            onClick={() => setImportSelections({})}
                                            style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff', fontSize: '0.78rem', cursor: 'pointer', fontWeight: 600, color: '#475569' }}
                                        >
                                            Bỏ chọn tất cả
                                        </button>
                                    </div>
                                </div>

                                {/* Question list */}
                                <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', paddingRight: '4px' }}>
                                    {importedQuestions.map((q, idx) => {
                                        const v = q.variations?.[0];
                                        return (
                                            <div
                                                key={idx}
                                                onClick={() => setImportSelections(prev => ({ ...prev, [idx]: !prev[idx] }))}
                                                style={{
                                                    padding: '12px 14px', borderRadius: '10px', cursor: 'pointer',
                                                    border: importSelections[idx] ? '2px solid #6366f1' : '2px solid #e2e8f0',
                                                    background: importSelections[idx] ? '#f5f3ff' : '#fff',
                                                    transition: 'all 0.15s'
                                                }}
                                            >
                                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                                                    <input
                                                        type="checkbox"
                                                        checked={!!importSelections[idx]}
                                                        onChange={() => { }}
                                                        style={{ marginTop: '3px', accentColor: '#6366f1', width: '16px', height: '16px', flexShrink: 0 }}
                                                    />
                                                    <div style={{ flex: 1, minWidth: 0 }}>
                                                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '6px', alignItems: 'center' }}>
                                                            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#6366f1', background: '#eef2ff', padding: '2px 8px', borderRadius: '6px' }}>
                                                                Câu {idx + 1}
                                                            </span>
                                                            <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#475569', background: '#f1f5f9', padding: '2px 8px', borderRadius: '6px' }}>
                                                                {getTypeLabel(q.type)}
                                                            </span>
                                                            {/* Editable Skill Dropdown */}
                                                            <MiniSkillDropdown
                                                                value={q.targetSkill || 'grammar'}
                                                                onChange={val => setImportedQuestions(prev => prev.map((pq, pi) => pi === idx ? { ...pq, targetSkill: val } : pq))}
                                                            />

                                                        </div>
                                                        <div style={{ fontSize: '0.85rem', color: '#1e293b', lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                                                            {v?.text || '(Không có nội dung)'}
                                                        </div>
                                                        {q.type === 'multiple_choice' && v?.options && (
                                                            <div style={{ marginTop: '6px', display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                                                {v.options.map((opt, oi) => (
                                                                    <span key={oi} style={{
                                                                        fontSize: '0.78rem', padding: '2px 8px', borderRadius: '6px',
                                                                        background: oi === v.correctAnswer ? '#d1fae5' : '#f1f5f9',
                                                                        color: oi === v.correctAnswer ? '#065f46' : '#475569',
                                                                        fontWeight: oi === v.correctAnswer ? 700 : 400,
                                                                        border: oi === v.correctAnswer ? '1px solid #6ee7b7' : '1px solid #e2e8f0'
                                                                    }}>
                                                                        {String.fromCharCode(65 + oi)}. {opt}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        )}
                                                        {q.type === 'matching' && v?.pairs && (
                                                            <div style={{ marginTop: '6px', fontSize: '0.78rem', color: '#475569' }}>
                                                                {v.pairs.map((p, pi) => (
                                                                    <div key={pi}>{p.left} → {p.right}</div>
                                                                ))}
                                                            </div>
                                                        )}
                                                        {q.type === 'ordering' && v?.items && (
                                                            <div style={{ marginTop: '6px', fontSize: '0.78rem', color: '#475569' }}>
                                                                Thứ tự: {v.items.join(' → ')}
                                                            </div>
                                                        )}
                                                        {/* Purpose */}
                                                        <div style={{ marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }} onClick={e => e.stopPropagation()}>
                                                            <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontStyle: 'italic', flexShrink: 0 }}>Mục tiêu:</span>
                                                            <input
                                                                type="text"
                                                                value={q.purpose || ''}
                                                                onChange={e => {
                                                                    setImportedQuestions(prev => prev.map((pq, pi) => pi === idx ? { ...pq, purpose: e.target.value } : pq));
                                                                }}
                                                                placeholder="Mục tiêu kiểm tra..."
                                                                style={{
                                                                    flex: 1, fontSize: '0.75rem', color: '#475569', fontStyle: 'italic',
                                                                    border: '1px solid #e2e8f0', borderRadius: '4px', padding: '2px 6px',
                                                                    background: '#fafafa', outline: 'none', minWidth: 0
                                                                }}
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Actions */}
                                <div className="admin-modal-actions" style={{ marginTop: '16px', flexShrink: 0 }}>
                                    <button className="admin-btn admin-btn-secondary" onClick={() => setShowImportPreview(false)} disabled={isSavingImport}>
                                        ← Quay lại
                                    </button>
                                    <button
                                        className="admin-btn admin-btn-primary"
                                        onClick={handleConfirmImport}
                                        disabled={isSavingImport || Object.values(importSelections).filter(Boolean).length === 0}
                                        style={{ background: '#22c55e', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                                    >
                                        {isSavingImport ? (
                                            <><RefreshCw size={16} className="spinning" /> Đang lưu...</>
                                        ) : (
                                            <><Save size={16} /> Lưu {Object.values(importSelections).filter(Boolean).length} câu đã chọn</>
                                        )}
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}

            {alertMessage && (
                <CustomToast
                    type={alertMessage.type}
                    message={alertMessage.text}
                    onClose={() => setAlertMessage(null)}
                />
            )}
        </div>
    );
}
