import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { useParams, Link, useLocation, useNavigate } from 'react-router-dom';
import { getExam, getExamQuestions, saveExamQuestion, deleteExamQuestion, saveExam, updateExamQuestionsOrder, recalcExamQuestionCache } from '../../services/examService';
import { generateGrammarVariations, generateSingleGrammarVariation, generateVariationExplanation } from '../../services/aiGrammarService';
import { getTeacherTopics, getTeacherTopicWords } from '../../services/teacherService';
import { getAdminTopics, getAdminTopicWords } from '../../services/adminService';
import { extractQuestionsFromText, extractQuestionsFromPDF } from '../../services/aiDocumentImportService';
import { useAuth } from '../../contexts/AuthContext';
import { ArrowLeft, Plus, Edit, Trash2, X, Wand2, RefreshCw, Save, GripVertical, ChevronDown, Check, AlertCircle, Info, CheckCircle, Clock, List, Trophy, Layers, BookOpen, Award, Copy, FileText, Upload, ArrowRightLeft, EyeOff, ArrowRight, Eye } from 'lucide-react';
import '../teacher/TeacherGrammarEditorPage.css';

import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import { ImageOptionUploader, AIImageGenerateButton, isImageOption, deleteOptionImage } from '../../components/common/MCQImageOption';
import AudioContextUploader from '../../components/common/AudioContextUploader';
import { deleteContextAudio } from '../../services/contextAudioService';
import { uploadContextImage, deleteContextImages } from '../../services/examService';
import SavedPromptPicker from '../../components/SavedPromptPicker';
import { renderFormattedText, applyFormatToSelection } from '../../utils/textFormatting';
import { normalizeRichTextValue } from '../../utils/richTextFormatUtils';
import FormattedOptionInput from '../../components/common/FormattedOptionInput';
import { cloneQuestionStorageAssets } from '../../services/storageCloneService';

function decodeHtmlEntities(str) {
    if (!str) return str;
    const ta = document.createElement('textarea');
    ta.innerHTML = str;
    return ta.value.replace(/\u00a0/g, ' ');
}

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

const hasContent = (html) => {
    if (!html) return false;
    const stripped = html.replace(/<[^>]*>/g, '').trim();
    if (stripped.length > 0) return true;
    return /<(img|iframe|video|audio|embed|object)/i.test(html);
};

/**
 * Show a size picker popup. Returns the chosen maxWidth, or null if cancelled.
 */
function showImageSizePicker(file) {
    return new Promise(resolve => {
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px)';

        const card = document.createElement('div');
        card.style.cssText = 'background:#fff;border-radius:20px;padding:24px;max-width:360px;width:90%;box-shadow:0 20px 60px rgba(0,0,0,0.2);font-family:Inter,system-ui,sans-serif';

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
function ContextQuillEditor({ value, onChange, readOnly, style }) {
    const quillRef = React.useRef(null);

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
                        if (!maxWidth) return;
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
            placeholder="Nhập nội dung cho section này (bài đọc, audio, hình ảnh...)"
            formats={QUILL_FORMATS}
            modules={modules}
            style={style}
        />
    );
}

/**
 * Minimal WYSIWYG rich-text input using ReactQuill.
 * Only provides Bold, Italic, Underline buttons.
 */
function RichTextInput({ value, onChange, disabled, placeholder, minHeight = '100px', wrapperClassName = '' }) {
    const quillRef = React.useRef(null);
    const containerRef = React.useRef(null);
    const tooltipBaseId = React.useId();

    const modules = {
        toolbar: [
            ['bold', 'italic', 'underline'],
        ]
    };
    const formats = ['bold', 'italic', 'underline'];

    useEffect(() => {
        const root = containerRef.current;
        if (!root) return;
        root.querySelectorAll('.ql-tooltip input').forEach((input, idx) => {
            input.id = `${tooltipBaseId}-tooltip-${idx}`;
            input.name = `${tooltipBaseId}-tooltip-${idx}`;
            if (!input.getAttribute('aria-label')) {
                input.setAttribute('aria-label', 'Quill tooltip input');
            }
        });
    }, [tooltipBaseId, value, disabled]);

    return (
        <div ref={containerRef} style={{ position: 'relative' }}>
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

/**
 * Render a fill-in-blank question text, replacing {{word}} tokens with styled blank spans.
 * Returns an array of React nodes (mix of strings and <span> elements).
 */
function renderFillInBlankText(text) {
    if (!text) return '(Chưa có nội dung)';
    if (/<[a-zA-Z][^>]*>/.test(text)) {
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
            letterSpacing: '0.01em',
            whiteSpace: 'nowrap',
            lineHeight: 1.6,
            margin: '0 2px',
            verticalAlign: 'middle',
        }}>
            ✎ {word}
        </span>
    ));
}

function normalizeFillInBlankTextForEditor(text) {
    if (typeof text !== 'string') return text;

    return decodeHtmlEntities(
        text
            .replace(/<\s*strong\b[^>]*>/gi, '**')
            .replace(/<\s*\/\s*strong\s*>/gi, '**')
            .replace(/<\s*b\b[^>]*>/gi, '**')
            .replace(/<\s*\/\s*b\s*>/gi, '**')
            .replace(/<\s*em\b[^>]*>/gi, '*')
            .replace(/<\s*\/\s*em\s*>/gi, '*')
            .replace(/<\s*i\b[^>]*>/gi, '*')
            .replace(/<\s*\/\s*i\s*>/gi, '*')
            .replace(/<\s*u\b[^>]*>/gi, '__')
            .replace(/<\s*\/\s*u\s*>/gi, '__')
            .replace(/<p><br><\/p>/gi, '\n')
            .replace(/<\/p>/gi, '\n')
            .replace(/<\/div>/gi, '\n')
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/<p[^>]*>/gi, '')
            .replace(/<div[^>]*>/gi, '')
            .replace(/<[^>]*>/g, '')
    ).replace(/\n{3,}/g, '\n\n');
}

function normalizeQuestionForEditor(question) {
    if (!question || typeof question !== 'object') return question;

    const isFillBlankType = ['fill_in_blank', 'fill_in_blanks', 'fill_in_blank_typing'].includes(question.type);

    return {
        ...question,
        variations: Array.isArray(question.variations)
            ? question.variations.map(variation => ({
                ...variation,
                text: typeof variation?.text === 'string'
                    ? (isFillBlankType ? normalizeFillInBlankTextForEditor(variation.text) : normalizeRichTextValue(variation.text))
                    : variation?.text,
                explanation: typeof variation?.explanation === 'string'
                    ? normalizeRichTextValue(variation.explanation)
                    : variation?.explanation,
            }))
            : question.variations
    };
}

const parseContextHtml = (html) => {
    if (!html) return '';
    const regex = /<iframe[^>]*>.*?<\/iframe>|<a[^>]*href="(https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})[^"]*)"[^>]*>.*?<\/a>|(https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})[^\s<"]*)/gi;
    let parsed = html.replace(regex, (match, aUrl, aVideoId, rawUrl, rawVideoId) => {
        if (match.toLowerCase().startsWith('<iframe')) return match;
        const videoId = aVideoId || rawVideoId;
        if (videoId) {
            return `<iframe class="ql-video" style="width: 100%; aspect-ratio: 16 / 9; border-radius: 12px; border: none; min-height: 250px;" src="https://www.youtube.com/embed/${videoId}?showinfo=0" frameborder="0" allowfullscreen></iframe>`;
        }
        return match;
    });
    return parsed.replace(/&nbsp;/g, ' ');
};

function CustomDropdown({ value, options, onChange, placeholder = "Chọn...", className = '' }) {
    const [isOpen, setIsOpen] = useState(false);
    const [hoverIdx, setHoverIdx] = useState(null);
    const triggerRef = React.useRef(null);
    const menuRef = React.useRef(null);
    const selectedOption = options.find(opt => opt.value === value);

    useEffect(() => {
        if (!isOpen) return;
        function handleClickOutside(event) {
            if (
                triggerRef.current && !triggerRef.current.contains(event.target) &&
                menuRef.current && !menuRef.current.contains(event.target)
            ) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [isOpen]);

    const [menuStyle, setMenuStyle] = useState({});

    const updatePosition = React.useCallback(() => {
        if (!triggerRef.current) return;
        const rect = triggerRef.current.getBoundingClientRect();
        const spaceBelow = window.innerHeight - rect.bottom - 10;
        const maxHeight = Math.min(250, Math.max(spaceBelow, 120));
        setMenuStyle({
            position: 'fixed',
            left: rect.left,
            width: rect.width,
            top: rect.bottom + 4,
            maxHeight: `${maxHeight}px`,
            zIndex: 99999,
        });
    }, []);

    useEffect(() => {
        if (!isOpen) return;
        updatePosition();
        const handler = () => updatePosition();
        window.addEventListener('scroll', handler, true);
        window.addEventListener('resize', handler);
        return () => {
            window.removeEventListener('scroll', handler, true);
            window.removeEventListener('resize', handler);
        };
    }, [isOpen, updatePosition]);

    return (
        <div style={{ position: 'relative', width: '100%' }} className={className}>
            <div ref={triggerRef} className={`admin-form-input custom-dropdown-trigger`} onClick={() => setIsOpen(!isOpen)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', padding: '10px 14px', background: '#fff' }}>
                <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {selectedOption ? selectedOption.label : placeholder}
                </span>
                <ChevronDown size={14} style={{ transition: 'transform 0.2s', transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }} />
            </div>
            {isOpen && ReactDOM.createPortal(
                <div ref={menuRef} style={{
                    ...menuStyle,
                    background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                    overflowY: 'auto'
                }}>
                    {options.map((opt, idx) => (
                        <div key={idx}
                            onMouseEnter={() => setHoverIdx(idx)}
                            onMouseLeave={() => setHoverIdx(null)}
                            onClick={(e) => {
                                e.stopPropagation();
                                onChange(opt.value);
                                setIsOpen(false);
                            }}
                            style={{
                                padding: '10px 14px', cursor: 'pointer',
                                background: (value === opt.value || hoverIdx === idx) ? '#eff6ff' : 'transparent',
                                color: (value === opt.value || hoverIdx === idx) ? '#2563eb' : '#0f172a',
                                fontWeight: value === opt.value ? 600 : 400,
                                borderBottom: idx === options.length - 1 ? 'none' : '1px solid #f1f5f9'
                            }}
                        >{opt.label}</div>
                    ))}
                </div>,
                document.body
            )}
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

function CustomToast({ message, type, onClose }) {
    const [visible, setVisible] = useState(true);
    useEffect(() => { const timer = setTimeout(() => { setVisible(false); setTimeout(onClose, 300); }, 4000); return () => clearTimeout(timer); }, []);
    const bg = type === 'success' ? '#ecfdf5' : type === 'error' ? '#fef2f2' : '#eff6ff';
    const color = type === 'success' ? '#065f46' : type === 'error' ? '#991b1b' : '#1e40af';
    const Icon = type === 'success' ? CheckCircle : type === 'error' ? AlertCircle : Info;
    return (
        <div style={{ position: 'fixed', top: '24px', right: '24px', zIndex: 10000, display: 'flex', alignItems: 'center', gap: '10px', padding: '14px 24px', borderRadius: '12px', background: bg, color, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontWeight: 600, fontSize: '0.9rem', opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(-10px)', transition: 'all 0.3s ease' }}>
            <Icon size={18} />{message}
        </div>
    );
}

// Helper to extract blanks from {{word}} markers
function parseFillBlanks(text) {
    const blanks = [];
    const regex = /\{\{(.+?)\}\}/g;
    let match;
    while ((match = regex.exec(text)) !== null) {
        blanks.push(match[1].replace(/&nbsp;/g, ' '));
    }
    return blanks;
}

// Helper to count items in a question for scoring purposes
function getQuestionItemCount(q) {
    const type = q.type;
    const v1 = q.variations?.[0];
    if (!v1) return 1;
    if (type === 'fill_in_blank' || type === 'fill_in_blanks' || type === 'fill_in_blank_typing') {
        const blanks = parseFillBlanks(v1.text || '');
        return blanks.length || 1;
    }
    if (type === 'matching') {
        return (v1.pairs || []).length || 1;
    }
    if (type === 'categorization') {
        return (v1.items || []).length || 1;
    }
    if (type === 'ordering') {
        return (v1.items || []).length || 1;
    }
    return 1;
}

// Helper to get actual total points for a question (points × item count)
function getQuestionTotalPoints(q) {
    const perItem = q.points || 1;
    if (q.type === 'ordering') return perItem; // All-or-nothing
    const count = getQuestionItemCount(q);
    return perItem * count;
}

// Helper to get score label based on question type
function getScoreLabel(type) {
    if (type === 'fill_in_blank' || type === 'fill_in_blanks' || type === 'fill_in_blank_typing') {
        return 'Điểm / chỗ trống đúng';
    }
    if (type === 'matching') {
        return 'Điểm / cặp ghép đúng';
    }
    if (type === 'categorization') {
        return 'Điểm / từ phân loại đúng';
    }
    if (type === 'ordering') {
        return 'Điểm';
    }
    return 'Điểm';
}

// Helper to get item unit name
function getItemUnitName(type) {
    if (type === 'fill_in_blank' || type === 'fill_in_blanks' || type === 'fill_in_blank_typing') return 'chỗ trống';
    if (type === 'matching') return 'cặp ghép';
    if (type === 'categorization') return 'mục';
    return null;
}

function FillInBlankEditor({ variation, vIdx, isReadOnly, updateVariation, hideDistractors = false }) {
    const textareaRef = useRef(null);
    const text = variation?.text || '';
    const blanks = parseFillBlanks(text);
    const distractors = variation?.distractors || [];
    const baseId = `exam-fill-blank-${vIdx}`;

    // Local state to handle comma typing without immediate parent sync interference
    const [distractStr, setDistractStr] = useState(distractors.join(', '));

    // Sync from parent if variations change (e.g. from AI or another variation)
    useEffect(() => {
        const joined = distractors.join(', ');
        // Only update local if it's meaningfully different (avoid jumping cursor)
        const currentClean = distractStr.split(',').map(s => s.trim()).filter(Boolean).join(', ');
        if (joined !== currentClean) {
            setDistractStr(joined);
        }
    }, [variation?.distractors]);

    function handleFormat(formatToken) {
        if (!textareaRef.current) return;
        if (formatToken === '{{}}') {
            const ta = textareaRef.current;
            const start = ta.selectionStart;
            const end = ta.selectionEnd;
            if (start === end) return;
            const selectedText = text.substring(start, end).trim();
            if (!selectedText) return;
            const newText = text.substring(0, start) + `{{${selectedText}}}` + text.substring(end);
            updateVariation(vIdx, 'text', newText);
            return;
        }

        const result = applyFormatToSelection(textareaRef.current, formatToken);
        if (result) {
            updateVariation(vIdx, 'text', result.newText);
            setTimeout(() => {
                textareaRef.current.focus();
                textareaRef.current.setSelectionRange(result.newStart, result.newEnd);
            }, 0);
        }
    }

    // Render preview: replace {{word}} with ___
    const previewParts = text.split(/(\{\{.+?\}\})/g);
    let blankIdx = 0;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {/* Textarea + button */}
            <div className="admin-form-group" style={{ marginBottom: 0 }}>
                <label htmlFor={`${baseId}-text`} style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600, marginBottom: '4px' }}>
                    Nội dung câu (bôi đen từ rồi bấm "Tạo chỗ trống")
                </label>
                <textarea
                    id={`${baseId}-text`}
                    name={`${baseId}-text`}
                    ref={textareaRef}
                    className={`admin-form-input ${vIdx === 0 ? `required-field${text.trim() ? ' filled' : ''}` : ''}`}
                    rows={3}
                    disabled={isReadOnly}
                    placeholder="Ví dụ: I have been to Paris twice."
                    value={text}
                    onChange={e => updateVariation(vIdx, 'text', e.target.value)}
                    style={{ resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.6 }}
                />
                {!isReadOnly && (
                    <div style={{ marginTop: '6px', display: 'flex', gap: '8px' }}>
                        <button type="button" onClick={() => handleFormat('**')} style={{ padding: '6px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff', color: '#1e293b', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', transition: 'all 0.2s' }}>B</button>
                        <button type="button" onClick={() => handleFormat('*')} style={{ padding: '6px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff', color: '#1e293b', fontStyle: 'italic', fontSize: '0.8rem', cursor: 'pointer', transition: 'all 0.2s' }}>I</button>
                        <button type="button" onClick={() => handleFormat('__')} style={{ padding: '6px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff', color: '#1e293b', textDecoration: 'underline', fontSize: '0.8rem', cursor: 'pointer', transition: 'all 0.2s' }}>U</button>
                        <div style={{ width: '1px', background: '#e2e8f0', margin: '0 4px' }} />
                        <button type="button" onClick={() => handleFormat('{{}}')}
                            style={{
                                padding: '6px 14px', fontSize: '0.8rem', fontWeight: 700,
                                background: '#6366f1', color: '#fff', border: 'none', borderRadius: '8px',
                                cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px',
                                transition: 'all 0.2s', width: 'fit-content'
                            }}
                            onMouseEnter={e => { e.currentTarget.style.background = '#4f46e5'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = '#6366f1'; }}
                        >
                            ✏️ Tạo chỗ trống
                        </button>
                    </div>
                )}
            </div>

            {/* Live preview */}
            {blanks.length > 0 && (
                <div style={{
                    padding: '12px 16px', background: '#f8fafc', borderRadius: '10px',
                    border: '1px solid #e2e8f0', fontSize: '0.85rem'
                }}>
                    <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#6366f1', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
                        Xem trước
                    </div>
                    <div style={{ lineHeight: 2, color: '#1e293b', whiteSpace: 'pre-wrap' }}>
                        {renderFormattedText(text, (word, key) => {
                            const idx = blankIdx++;
                            return (
                                <span key={key} style={{
                                    display: 'inline-block', minWidth: '60px', borderBottom: '2px dashed #6366f1',
                                    textAlign: 'center', color: '#6366f1', fontWeight: 700, padding: '0 4px',
                                    margin: '0 2px', background: '#eef2ff', borderRadius: '4px 4px 0 0'
                                }}>
                                    ({idx + 1}) ___
                                </span>
                            );
                        })}
                    </div>
                    <div style={{ marginTop: '8px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b' }}>Đáp án{hideDistractors && <span style={{ color: '#ef4444' }}> gợi ý</span>}:</span>
                        {blanks.map((b, i) => (
                            <span key={i} style={{
                                fontSize: '0.75rem', padding: '2px 8px', background: '#d1fae5',
                                color: '#065f46', borderRadius: '6px', fontWeight: 700
                            }}>
                                ({i + 1}) {b}
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {/* Word bank preview */}
            {!hideDistractors && blanks.length > 0 && (
                <div style={{
                    padding: '10px 14px', background: '#fffbeb', borderRadius: '10px',
                    border: '1px solid #fde68a', fontSize: '0.8rem'
                }}>
                    <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#d97706', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>
                        Word Bank (hiển thị cho học viên)
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {[...blanks, ...distractors].sort((a, b) => {
                            const ha = a.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
                            const hb = b.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
                            return ha - hb;
                        }).map((w, i) => {
                            const cleanW = w.replace(/&nbsp;/g, ' ');
                            return (
                                <span key={i} style={{
                                    padding: '4px 12px', background: '#fff', color: '#1e293b',
                                    border: '1px solid #e2e8f0', borderRadius: '8px', fontWeight: 600,
                                    fontSize: '0.8rem'
                                }}>
                                    {cleanW}
                                </span>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Distractors input */}
            {!hideDistractors && (
                <div className="admin-form-group" style={{ marginBottom: 0 }}>
                    <label htmlFor={`${baseId}-distractors`} style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600, marginBottom: '4px' }}>
                        Từ gây nhiễu (phân cách bằng dấu phẩy, tùy chọn)
                    </label>
                    <input id={`${baseId}-distractors`} name={`${baseId}-distractors`} type="text" className="admin-form-input"
                        disabled={isReadOnly}
                        placeholder="Ví dụ: has, were, being"
                        value={distractStr}
                        onChange={e => {
                            const val = e.target.value;
                            setDistractStr(val);
                            // Update parent state as well (debounced-like or simpler)
                            const arr = val.split(',').map(s => s.trim()).filter(Boolean);
                            updateVariation(vIdx, 'distractors', arr);
                        }}
                    />
                </div>
            )}
        </div>
    );
}

export default function ExamEditorPage() {
    const { examId } = useParams();
    const location = useLocation();
    const navigate = useNavigate();
    const { user } = useAuth();

    const isAdminView = location.pathname.startsWith('/admin');
    const isSystemExam = location.pathname.includes('/system-exams/');

    const [isReadOnly, setIsReadOnly] = useState(isSystemExam);

    const [exam, setExam] = useState(null);
    const [questions, setQuestions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState(null);

    // Active section
    const [activeSectionId, setActiveSectionId] = useState(null);
    const activeSection = (exam?.sections || []).find(s => s.id === activeSectionId);
    const sectionQuestions = (questions || []).filter(q => q.sectionId === activeSectionId).sort((a, b) => (a.order || 0) - (b.order || 0));
    const validSectionIds = new Set((exam?.sections || []).map(s => s.id));
    const validQuestions = (questions || []).filter(q => q.sectionId && validSectionIds.has(q.sectionId));
    const totalPoints = validQuestions.reduce((sum, q) => sum + getQuestionTotalPoints(q), 0);

    // Question form
    const [formOpen, setFormOpen] = useState(false);
    const [formData, setFormData] = useState({
        type: 'multiple_choice', purpose: '', points: '',
        hasContext: true, sectionId: '', examId: '',
        variations: [{ text: '', options: ['', '', '', ''], correctAnswer: 0, explanation: '' }]
    });
    const [isEditingQuestion, setIsEditingQuestion] = useState(false);
    const [questionToDelete, setQuestionToDelete] = useState(null);
    const [questionToMove, setQuestionToMove] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const pendingImageDeletionsRef = useRef([]);
    const newlyUploadedImagesRef = useRef([]);
    const originalOptionTextsRef = useRef({});
    const [isGeneratingAI, setIsGeneratingAI] = useState(false);
    const [generatingVariationIdx, setGeneratingVariationIdx] = useState(null);
    const [generatingExplanationIdx, setGeneratingExplanationIdx] = useState(null);
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

    // Document import state
    const [showImportModal, setShowImportModal] = useState(false);
    const [importTab, setImportTab] = useState('text'); // 'text' | 'pdf'
    const [importText, setImportText] = useState('');
    const [importFile, setImportFile] = useState(null);
    const [isImporting, setIsImporting] = useState(false);
    const [importedQuestions, setImportedQuestions] = useState([]);
    const [importSelections, setImportSelections] = useState({});
    const [showImportPreview, setShowImportPreview] = useState(false);
    const [isSavingImport, setIsSavingImport] = useState(false);
    const [showImportTimeWarning, setShowImportTimeWarning] = useState(false);

    // Section context editing
    const [editingSectionContext, setEditingSectionContext] = useState(null);

    // Section management
    const [renamingSectionId, setRenamingSectionId] = useState(null);
    const [renamingSectionTitle, setRenamingSectionTitle] = useState('');
    const [renamingSectionTime, setRenamingSectionTime] = useState('');
    const [sectionToDelete, setSectionToDelete] = useState(null);
    // Section context auto-save state
    const [saveStatus, setSaveStatus] = useState('idle'); // 'idle', 'saving', 'saved', 'error'
    const lastSavedContext = useRef({ context: '', audioUrl: '' });
    const autoSaveTimer = useRef(null);

    useEffect(() => { loadData(); }, [examId]);

    async function loadData() {
        setLoading(true);
        try {
            const [examData, questionsData] = await Promise.all([
                getExam(examId),
                getExamQuestions(examId)
            ]);
            setExam(examData);

            // Auto-cleanup orphan questions not belonging to any active section
            const sectionIds = new Set((examData?.sections || []).map(s => s.id));
            const validQs = questionsData.filter(q => q.sectionId && sectionIds.has(q.sectionId));
            const orphanQs = questionsData.filter(q => !q.sectionId || !sectionIds.has(q.sectionId));
            if (orphanQs.length > 0) {
                console.log(`Auto-cleaning ${orphanQs.length} orphan question(s) for exam ${examId}`);
                await Promise.all(orphanQs.map(q => deleteExamQuestion(q.id)));
                await recalcExamQuestionCache(examId);
            }
            setQuestions(validQs);
            if (examData?.sections?.length > 0 && !activeSectionId) {
                const firstSectionId = examData.sections[0].id;
                setActiveSectionId(firstSectionId);
                lastSavedContext.current = {
                    context: examData.sections[0].context || '',
                    audioUrl: examData.sections[0].contextAudioUrl || '',
                    script: examData.sections[0].contextScript || ''
                };
            } else if (activeSectionId) {
                const currentSection = examData.sections.find(s => s.id === activeSectionId);
                lastSavedContext.current = {
                    context: currentSection?.context || '',
                    audioUrl: currentSection?.contextAudioUrl || '',
                    script: currentSection?.contextScript || ''
                };
            }

            if (!isAdminView) {
                const isOwner = (examData?.createdBy && examData.createdBy === user?.uid)
                    || (examData?.teacherId && examData.teacherId === user?.uid);
                const isCollaborator = examData?.collaboratorIds?.includes(user?.uid) || false;
                const collabRole = (examData?.collaboratorRoles || {})[user?.uid] || 'editor';
                setIsReadOnly(!(isOwner || (isCollaborator && collabRole === 'editor')));
            } else {
                setIsReadOnly(false);
            }
        } catch (error) {
            console.error(error);
            setToast({ message: 'Lỗi tải dữ liệu: ' + error.message, type: 'error' });
        }
        setLoading(false);
    }

    function getInitialVariation(type) {
        if (type === 'multiple_choice') return { text: '', options: ['', '', '', ''], correctAnswer: 0, explanation: '' };
        if (type === 'fill_in_blank') return { text: '', distractors: [], explanation: '' };
        if (type === 'fill_in_blank_typing') return { text: '', explanation: '' };
        if (type === 'essay') return { text: '', explanation: '' };
        if (type === 'matching') return { text: '', pairs: [{ left: '', right: '' }], explanation: '' };
        if (type === 'categorization') return { text: '', groups: ['Nhóm 1', 'Nhóm 2'], items: [{ text: '', group: 'Nhóm 1' }], explanation: '' };
        if (type === 'ordering') return { text: '', items: [''], explanation: '' };
        if (type === 'audio_recording') return { text: '', explanation: '' };
        return { text: '', explanation: '' };
    }

    function openAddForm() {
        pendingImageDeletionsRef.current = [];
        newlyUploadedImagesRef.current = [];
        setFormData({
            type: 'multiple_choice', purpose: '', targetSkill: '', points: '',
            hasContext: true, sectionId: activeSectionId, examId: examId,
            variations: [getInitialVariation('multiple_choice')],
            ...(exam.timingMode === 'question' ? { timeLimitSeconds: '' } : {})
        });
        setIsEditingQuestion(false);
        setFormOpen(true);
    }

    function openEditForm(q) {
        pendingImageDeletionsRef.current = [];
        newlyUploadedImagesRef.current = [];
        const deepCopy = normalizeQuestionForEditor(JSON.parse(JSON.stringify(q)));
        // Ensure there are always 5 variations (old questions may have fewer)
        const variations = deepCopy.variations || [];
        while (variations.length < 5) {
            variations.push(getInitialVariation(deepCopy.type || 'multiple_choice'));
        }
        deepCopy.variations = variations;
        setFormData(deepCopy);
        setIsEditingQuestion(true);
        setFormOpen(true);
    }

    function handleCloseForm() {
        // Clean up images that were uploaded during this session but never saved
        for (const url of newlyUploadedImagesRef.current) {
            // Only delete if this URL is NOT currently used in the form data
            const isStillUsed = formData.variations?.some(v =>
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
        if (!formData.targetSkill) {
            setToast({ message: 'Vui lòng chọn Kỹ năng mục tiêu cho câu hỏi.', type: 'error' });
            return;
        }
        if (!formData.points || formData.points < 0.25) {
            setToast({ message: 'Vui lòng nhập Điểm cho câu hỏi (tối thiểu 0.25đ).', type: 'error' });
            return;
        }
        if (exam.timingMode === 'question' && (!formData.timeLimitSeconds || formData.timeLimitSeconds < 5)) {
            setToast({ message: 'Vui lòng nhập thời gian cho câu hỏi (tối thiểu 5 giây).', type: 'error' });
            return;
        }
        setIsSaving(true);
        try {
            await saveExamQuestion(formData);
            // Delete images that were scheduled for deletion during editing
            for (const url of pendingImageDeletionsRef.current) {
                deleteOptionImage(url).catch(console.error);
            }
            pendingImageDeletionsRef.current = [];
            newlyUploadedImagesRef.current = [];
            setFormOpen(false);
            setToast({ message: isEditingQuestion ? 'Cập nhật câu hỏi thành công!' : 'Thêm câu hỏi mới thành công!', type: 'success' });
            loadData();
        } catch (error) {
            setToast({ message: 'Lỗi lưu câu hỏi: ' + error.message, type: 'error' });
        }
        setIsSaving(false);
    }

    async function handleConfirmDelete() {
        if (!questionToDelete) return;
        try {
            await deleteExamQuestion(questionToDelete.id);
            setQuestions(prev => prev.filter(q => q.id !== questionToDelete.id));
            setToast({ message: 'Đã xóa câu hỏi thành công!', type: 'success' });
        } catch (error) {
            setToast({ message: 'Lỗi xóa câu hỏi: ' + error.message, type: 'error' });
        }
        setQuestionToDelete(null);
    }

    async function handleDuplicate(q) {
        try {
            const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, order: _order, ...rest } = JSON.parse(JSON.stringify(q));
            const duplicatedQuestion = await cloneQuestionStorageAssets(rest, {
                contextAudioFolder: `context_audio/exam/${examId}`
            });
            await saveExamQuestion({
                ...duplicatedQuestion,
                examId: examId,
                sectionId: q.sectionId
            });
            setToast({ message: 'Nhân bản câu hỏi thành công!', type: 'success' });
            loadData(true);
        } catch (error) {
            setToast({ message: 'Lỗi nhân bản câu hỏi: ' + error.message, type: 'error' });
        }
    }

    async function handleMoveToSection(question, targetSectionId) {
        if (!question || !targetSectionId || question.sectionId === targetSectionId) return;
        try {
            await saveExamQuestion({ ...question, sectionId: targetSectionId });
            const targetSection = (exam?.sections || []).find(s => s.id === targetSectionId);
            setToast({ message: `Đã chuyển câu hỏi sang "${targetSection?.title || 'Section'}"!`, type: 'success' });
            setQuestionToMove(null);
            loadData();
        } catch (error) {
            setToast({ message: 'Lỗi chuyển câu hỏi: ' + error.message, type: 'error' });
        }
    }

    async function handleGenerateAI() {
        if (!formData.purpose || !formData.variations?.[0]?.text) {
            setToast({ message: "Vui lòng điền 'Mục tiêu kiểm tra' và 'Nội dung câu hỏi gốc (Variation 1)' trước khi dùng AI.", type: 'error' });
            return;
        }
        setIsGeneratingAI(true);
        try {
            const activeSection = (exam.sections || []).find(s => s.id === activeSectionId);
            const selectedTopic = vocabTopics.find(t => t.id === selectedVocabTopicId);
            const settings = {
                hasContext: hasContent(activeSection?.context),
                contextHtml: activeSection?.context || '',
                targetLevel: exam?.cefrLevel || 'A1',
                isVietnameseQuestion: isVietnameseQuestion,
                vocabularyWords: vocabWords,
                vocabularyTopicName: selectedTopic?.name || ''
            };
            const result = await generateGrammarVariations(formData.variations[0], formData.purpose, formData.type, settings);
            if (result.improved_original) {
                const newVariations = [result.improved_original, ...(result.variations || [])];
                setFormData(prev => ({ ...prev, variations: newVariations.slice(0, 5) }));
            }
            // Check if V1 had image options — remind teacher to generate images for variations
            const v1HasImages = formData.type === 'multiple_choice' &&
                (formData.variations?.[0]?.options || []).some(opt => isImageOption(opt));
            if (v1HasImages) {
                setToast({ message: 'AI đã tạo đáp án dạng text. Hãy bấm ✨ bên cạnh mỗi đáp án để tạo ảnh tương ứng.', type: 'success' });
            } else {
                setToast({ message: 'AI đã tạo các biến thể thành công!', type: 'success' });
            }
        } catch (error) {
            setToast({ message: 'Lỗi tạo AI: ' + error.message, type: 'error' });
        }
        setIsGeneratingAI(false);
    }

    async function handleGenerateSingleAI(idx) {
        if (!formData.variations?.[0]?.text) return;
        setGeneratingVariationIdx(idx);
        try {
            const activeSection = (exam.sections || []).find(s => s.id === activeSectionId);
            const selectedTopic = vocabTopics.find(t => t.id === selectedVocabTopicId);
            const settings = {
                hasContext: hasContent(activeSection?.context),
                contextHtml: activeSection?.context || '',
                targetLevel: exam?.cefrLevel || 'A1',
                isVietnameseQuestion: isVietnameseQuestion,
                vocabularyWords: vocabWords,
                vocabularyTopicName: selectedTopic?.name || ''
            };
            const result = await generateSingleGrammarVariation(formData.variations[0], formData.purpose, formData.type, settings);
            setFormData(prev => {
                const newVars = [...prev.variations];
                while (newVars.length <= idx) newVars.push(getInitialVariation(prev.type));
                newVars[idx] = result;
                return { ...prev, variations: newVars };
            });
            setToast({ message: `Đã tạo variation ${idx + 1}!`, type: 'success' });
        } catch (error) {
            setToast({ message: 'Lỗi tạo AI: ' + error.message, type: 'error' });
        }
        setGeneratingVariationIdx(null);
    }

    async function handleGenerateExplanation(vIdx) {
        const targetVariation = formData.variations?.[vIdx];
        if (!targetVariation?.text) {
            setToast({ message: 'Vui lòng nhập nội dung câu hỏi trước khi tạo giải thích.', type: 'error' });
            return;
        }
        setGeneratingExplanationIdx(vIdx);
        try {
            const v1Data = formData.variations[0];
            const explanation = await generateVariationExplanation(v1Data, targetVariation, formData.purpose, formData.type);
            if (explanation) {
                setFormData(prev => {
                    const newVars = [...prev.variations];
                    newVars[vIdx] = { ...newVars[vIdx], explanation };
                    return { ...prev, variations: newVars };
                });
                setToast({ message: `Đã tạo giải thích cho Variation ${vIdx + 1}!`, type: 'success' });
            } else {
                setToast({ message: 'AI không trả về giải thích hợp lệ.', type: 'error' });
            }
        } catch (error) {
            setToast({ message: 'Lỗi tạo giải thích: ' + error.message, type: 'error' });
        }
        setGeneratingExplanationIdx(null);
    }

    function updateVariation(index, field, value) {
        setFormData(prev => {
            const newVars = [...prev.variations];
            newVars[index] = { ...newVars[index], [field]: value };
            return { ...prev, variations: newVars };
        });
    }

    function updateOption(varIndex, optIndex, value) {
        setFormData(prev => {
            const newVars = [...prev.variations];
            const newOpts = [...(newVars[varIndex].options || [])];
            newOpts[optIndex] = value;
            newVars[varIndex] = { ...newVars[varIndex], options: newOpts };
            return { ...prev, variations: newVars };
        });
    }

    function addOption(varIndex) {
        setFormData(prev => {
            const newVars = [...prev.variations];
            const newOpts = [...(newVars[varIndex].options || [])];
            newOpts.push('');
            newVars[varIndex] = { ...newVars[varIndex], options: newOpts };
            return { ...prev, variations: newVars };
        });
    }

    function removeOption(varIndex, optIndex) {
        setFormData(prev => {
            const newVars = [...prev.variations];
            const newOpts = [...(newVars[varIndex].options || [])];
            if (newOpts.length <= 2) return prev;
            newOpts.splice(optIndex, 1);
            let correctAnswer = newVars[varIndex].correctAnswer || 0;
            if (optIndex === correctAnswer) correctAnswer = 0;
            else if (optIndex < correctAnswer) correctAnswer--;
            newVars[varIndex] = { ...newVars[varIndex], options: newOpts, correctAnswer };
            return { ...prev, variations: newVars };
        });
    }

    function updatePair(varIndex, pairIndex, field, value) {
        setFormData(prev => {
            const newVars = [...prev.variations];
            const newPairs = [...(newVars[varIndex].pairs || [])];
            newPairs[pairIndex] = { ...newPairs[pairIndex], [field]: value };
            newVars[varIndex] = { ...newVars[varIndex], pairs: newPairs };
            return { ...prev, variations: newVars };
        });
    }

    function addPair(varIndex) {
        setFormData(prev => {
            const newVars = [...prev.variations];
            newVars[varIndex] = { ...newVars[varIndex], pairs: [...(newVars[varIndex].pairs || []), { left: '', right: '' }] };
            return { ...prev, variations: newVars };
        });
    }

    function removePair(varIndex, pairIndex) {
        setFormData(prev => {
            const newVars = [...prev.variations];
            newVars[varIndex] = { ...newVars[varIndex], pairs: newVars[varIndex].pairs.filter((_, i) => i !== pairIndex) };
            return { ...prev, variations: newVars };
        });
    }

    function updateItem(varIndex, itemIndex, field, value) {
        setFormData(prev => {
            const newVars = [...prev.variations];
            const newItems = [...(newVars[varIndex].items || [])];
            newItems[itemIndex] = { ...newItems[itemIndex], [field]: value };
            newVars[varIndex] = { ...newVars[varIndex], items: newItems };
            return { ...prev, variations: newVars };
        });
    }

    function addItem(varIndex) {
        setFormData(prev => {
            const newVars = [...prev.variations];
            newVars[varIndex] = { ...newVars[varIndex], items: [...(newVars[varIndex].items || []), { text: '', group: newVars[varIndex].groups?.[0] || '' }] };
            return { ...prev, variations: newVars };
        });
    }

    function removeItem(varIndex, itemIndex) {
        setFormData(prev => {
            const newVars = [...prev.variations];
            newVars[varIndex] = { ...newVars[varIndex], items: newVars[varIndex].items.filter((_, i) => i !== itemIndex) };
            return { ...prev, variations: newVars };
        });
    }

    async function handleSaveSectionContext(sectionId, context) {
        if (!exam) return;
        setSaveStatus('saving');
        const currentSection = (exam.sections || []).find(s => s.id === sectionId);
        const audioUrl = currentSection?.contextAudioUrl || '';
        const script = currentSection?.contextScript || '';

        const updatedSections = (exam.sections || []).map(s =>
            s.id === sectionId ? { ...s, context, contextAudioUrl: audioUrl, contextScript: script } : s
        );
        try {
            await saveExam({ id: exam.id, sections: updatedSections });
            setExam(prev => ({ ...prev, sections: updatedSections }));
            setEditingSectionContext(null);
            setSaveStatus('saved');
            lastSavedContext.current = { context, audioUrl, script };
            setToast({ message: 'Đã lưu context!', type: 'success' });
        } catch (error) {
            setSaveStatus('error');
            setToast({ message: 'Lỗi lưu context: ' + error.message, type: 'error' });
        }
    }

    // Auto-save useEffect
    useEffect(() => {
        if (editingSectionContext && activeSection) {
            const currentContext = activeSection.context || '';
            const currentAudioUrl = activeSection.contextAudioUrl || '';
            const currentScript = activeSection.contextScript || '';

            // Don't auto-save if content hasn't changed from last saved state
            if (currentContext === lastSavedContext.current.context &&
                currentAudioUrl === lastSavedContext.current.audioUrl &&
                currentScript === (lastSavedContext.current.script || '')) {
                return;
            }

            setSaveStatus('idle'); // Clear 'saved' status when change detected

            if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);

            autoSaveTimer.current = setTimeout(async () => {
                setSaveStatus('saving');
                const updatedSections = (exam.sections || []).map(s =>
                    s.id === activeSectionId ? { ...s, context: currentContext, contextAudioUrl: currentAudioUrl, contextScript: currentScript } : s
                );
                try {
                    await saveExam({ id: exam.id, sections: updatedSections });
                    lastSavedContext.current = { context: currentContext, audioUrl: currentAudioUrl, script: currentScript };
                    setSaveStatus('saved');
                } catch (error) {
                    console.error("Auto-save error:", error);
                    setSaveStatus('error');
                }
            }, 2000);
        }

        return () => {
            if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
        };
    }, [activeSection?.context, activeSection?.contextAudioUrl, activeSection?.contextScript, editingSectionContext]);

    // Update lastSavedContext when switching sections
    useEffect(() => {
        if (activeSection) {
            lastSavedContext.current = {
                context: activeSection.context || '',
                audioUrl: activeSection.contextAudioUrl || '',
                script: activeSection.contextScript || ''
            };
            setSaveStatus('idle');
        }
    }, [activeSectionId]);

    async function handleAddSection() {
        if (!exam) return;
        const newSection = {
            id: crypto.randomUUID(),
            title: `Section ${(exam.sections?.length || 0) + 1}`,
            context: '',
            contextAudioUrl: '',
            order: exam.sections?.length || 0,
            timeLimitMinutes: 0
        };
        const updatedSections = [...(exam.sections || []), newSection];
        try {
            await saveExam({ id: exam.id, sections: updatedSections });
            setExam(prev => ({ ...prev, sections: updatedSections }));
            setActiveSectionId(newSection.id);
            setToast({ message: 'Đã thêm section mới!', type: 'success' });
        } catch (error) {
            setToast({ message: 'Lỗi thêm section: ' + error.message, type: 'error' });
        }
    }

    function startRenameSection(section) {
        setRenamingSectionId(section.id);
        setRenamingSectionTitle(section.title || '');
        setRenamingSectionTime(section.timeLimitMinutes || '');
    }

    async function handleRenameSection() {
        if (!exam || !renamingSectionId) return;
        const updatedSections = (exam.sections || []).map(s =>
            s.id === renamingSectionId ? { ...s, title: renamingSectionTitle, timeLimitMinutes: parseFloat(renamingSectionTime) || 0 } : s
        );
        try {
            await saveExam({ id: exam.id, sections: updatedSections });
            setExam(prev => ({ ...prev, sections: updatedSections }));
            setRenamingSectionId(null);
            setToast({ message: 'Đã đổi tên section!', type: 'success' });
        } catch (error) {
            setToast({ message: 'Lỗi đổi tên section: ' + error.message, type: 'error' });
        }
    }

    async function handleDeleteSection() {
        if (!exam || !sectionToDelete) return;
        const sectionId = sectionToDelete.id;
        // Clean up context audio for this section
        const sectionToClean = (exam.sections || []).find(s => s.id === sectionId);
        if (sectionToClean?.contextAudioUrl) {
            await deleteContextAudio(sectionToClean.contextAudioUrl);
        }
        const updatedSections = (exam.sections || []).filter(s => s.id !== sectionId).map((s, i) => ({ ...s, order: i }));
        try {
            await saveExam({ id: exam.id, sections: updatedSections });
            setExam(prev => ({ ...prev, sections: updatedSections }));
            // Clean up orphan questions belonging to deleted section
            const orphanQuestions = questions.filter(q => q.sectionId === sectionId);
            if (orphanQuestions.length > 0) {
                await Promise.all(orphanQuestions.map(q => deleteExamQuestion(q.id)));
                setQuestions(prev => prev.filter(q => q.sectionId !== sectionId));
            }
            if (activeSectionId === sectionId) {
                setActiveSectionId(updatedSections[0]?.id || null);
            }
            setSectionToDelete(null);
            setToast({ message: `Đã xóa section${orphanQuestions.length > 0 ? ` và ${orphanQuestions.length} câu hỏi bên trong` : ''}!`, type: 'success' });
        } catch (error) {
            setToast({ message: 'Lỗi xóa section: ' + error.message, type: 'error' });
        }
    }

    async function handleDragEnd(result) {
        if (!result.destination) return;

        if (result.type === 'sections' || result.source.droppableId === 'sections') {
            if (result.source.index === result.destination.index) return;
            const updatedSections = Array.from(exam.sections || []);
            const [moved] = updatedSections.splice(result.source.index, 1);
            updatedSections.splice(result.destination.index, 0, moved);

            setExam(prev => ({ ...prev, sections: updatedSections }));
            try {
                await saveExam({ ...exam, sections: updatedSections });
                setToast({ message: 'Đã cập nhật thứ tự section.', type: 'success' });
            } catch (error) {
                setToast({ message: 'Lỗi cập nhật thứ tự: ' + error.message, type: 'error' });
                loadData(); // revert
            }
            return;
        }

        if (result.source.droppableId === 'questions') {
            if (result.source.index === result.destination.index) return;
            const sectionQuestions = questions
                .filter(q => q.sectionId === activeSectionId)
                .sort((a, b) => (a.order || 0) - (b.order || 0));
            const reordered = Array.from(sectionQuestions);
            const [moved] = reordered.splice(result.source.index, 1);
            reordered.splice(result.destination.index, 0, moved);

            // Optimistic update for questions
            const updatedQuestions = [...questions];
            reordered.forEach((q, idx) => {
                const qIndex = updatedQuestions.findIndex(uq => uq.id === q.id);
                if (qIndex !== -1) updatedQuestions[qIndex].order = idx;
            });
            setQuestions(updatedQuestions);

            try {
                await updateExamQuestionsOrder(examId, activeSectionId, reordered);
            } catch (error) {
                setToast({ message: 'Lỗi sắp xếp: ' + error.message, type: 'error' });
                loadData();
            }
        }
    }

    // ============ DOCUMENT IMPORT HANDLERS ============
    async function handleDocumentImport() {
        if (importTab === 'text' && !importText.trim()) {
            setToast({ message: 'Vui lòng dán nội dung câu hỏi vào ô văn bản.', type: 'error' });
            return;
        }
        if (importTab === 'pdf' && !importFile) {
            setToast({ message: 'Vui lòng chọn file PDF.', type: 'error' });
            return;
        }

        setIsImporting(true);
        try {
            const examSettings = {
                cefrLevel: exam?.cefrLevel || 'A1',
                sectionId: activeSectionId,
                examId: examId
            };

            let questions;
            if (importTab === 'text') {
                questions = await extractQuestionsFromText(importText.trim(), examSettings);
            } else {
                questions = await extractQuestionsFromPDF(importFile, examSettings);
            }

            if (!questions || questions.length === 0) {
                setToast({ message: 'Không tìm thấy câu hỏi nào trong tài liệu. Kiểm tra lại nội dung.', type: 'error' });
                setIsImporting(false);
                return;
            }

            // If timing mode is per-question, add default timeLimitSeconds
            if (exam.timingMode === 'question') {
                questions = questions.map(q => ({ ...q, timeLimitSeconds: q.timeLimitSeconds || 0 }));
            }
            setImportedQuestions(questions);
            // Select all by default
            const selections = {};
            questions.forEach((_, idx) => { selections[idx] = true; });
            setImportSelections(selections);
            setShowImportPreview(true);
            setToast({ message: `AI đã trích xuất ${questions.length} câu hỏi!`, type: 'success' });
        } catch (error) {
            setToast({ message: 'Lỗi: ' + error.message, type: 'error' });
        }
        setIsImporting(false);
    }

    async function handleConfirmImport(forceImport = false) {
        const selectedQuestions = importedQuestions.filter((_, idx) => importSelections[idx]);
        if (selectedQuestions.length === 0) {
            setToast({ message: 'Vui lòng chọn ít nhất 1 câu hỏi để nhập.', type: 'error' });
            return;
        }

        // Check for questions without time when timing mode is per-question
        if (exam.timingMode === 'question' && !forceImport) {
            const noTimeQuestions = selectedQuestions.filter(q => !q.timeLimitSeconds || q.timeLimitSeconds < 5);
            if (noTimeQuestions.length > 0) {
                setShowImportTimeWarning(true);
                return;
            }
        }

        setIsSavingImport(true);
        try {
            let savedCount = 0;
            for (const q of selectedQuestions) {
                await saveExamQuestion(q);
                savedCount++;
            }
            setToast({ message: `Đã nhập thành công ${savedCount} câu hỏi!`, type: 'success' });
            // Reset all import state
            setShowImportPreview(false);
            setShowImportModal(false);
            setImportedQuestions([]);
            setImportSelections({});
            setImportText('');
            setImportFile(null);
            loadData(); // Reload questions
        } catch (error) {
            setToast({ message: 'Lỗi lưu câu hỏi: ' + error.message, type: 'error' });
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

    function getSkillLabel(skill) {
        const labels = {
            'listening': '🎧 Listening',
            'speaking': '🗣️ Speaking',
            'reading': '📖 Reading',
            'writing': '✍️ Writing',
            'grammar': '📝 Grammar',
            'vocabulary': '📚 Vocabulary',
        };
        return labels[skill] || skill;
    }

    if (loading) return <div className="admin-page"><div className="admin-empty-state">Đang tải...</div></div>;
    if (!exam) return <div className="admin-page"><div className="admin-empty-state">Không tìm thấy bài tập và kiểm tra.</div></div>;

    return (
        <DragDropContext onDragEnd={handleDragEnd}>
            <div className="admin-page" style={{ paddingBottom: '120px', gap: '12px' }}>
                {toast && <CustomToast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

                {/* Back Button */}
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

                {/* Header */}
                <div className="admin-page-header" style={{ textAlign: 'center' }}>
                    <h1 className="admin-page-title" style={{ flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                        <span style={{ fontSize: '2rem', lineHeight: 1 }}>{exam.icon || '📋'}</span>
                        {exam.name}
                        <span style={{
                            fontSize: '0.75rem', fontWeight: 700,
                            padding: '3px 12px', borderRadius: '12px',
                            background: exam.examType === 'test' ? '#fef2f2' : '#eff6ff',
                            color: exam.examType === 'test' ? '#dc2626' : '#2563eb',
                            border: `1px solid ${exam.examType === 'test' ? '#fecaca' : '#bfdbfe'}`
                        }}>
                            {exam.examType === 'test' ? '📋 Kiểm tra' : '📝 Bài tập'}
                        </span>
                    </h1>
                    <div className="admin-header-actions" style={{ padding: '0 12px', justifyContent: 'center', flexWrap: 'wrap' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Clock size={16} /> {(exam.timingMode || 'exam') === 'exam' ? `${exam.timeLimitMinutes} phút` : (exam.timingMode === 'section' ? 'Theo section' : 'Theo câu hỏi')}</span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><List size={16} /> {questions.length} câu hỏi</span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Trophy size={16} /> {totalPoints} điểm</span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Layers size={16} /> {exam.sections?.length || 0} sections</span>
                        {exam.cefrLevel && (
                            <span style={{ background: '#e0e7ff', color: '#4f46e5', padding: '2px 10px', borderRadius: '12px', fontWeight: 700, fontSize: '0.85rem' }}>
                                {exam.cefrLevel}
                            </span>
                        )}
                        {isReadOnly && !isAdminView && <span style={{ color: '#f59e0b', fontWeight: 600, background: '#fef3c7', padding: '2px 8px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>👁 {exam?.teacherId ? 'Chỉ xem' : 'Chính thức'}</span>}
                    </div>
                </div>

                {/* Section Tabs */}
                <div className="exam-sections-bar" style={{ marginBottom: '4px', marginTop: '4px' }}>
                    <Droppable droppableId="sections" direction="horizontal" type="sections" isDropDisabled={isReadOnly}>
                        {(provided) => (
                            <div ref={provided.innerRef} {...provided.droppableProps} className="exam-sections-droppable">
                                {(exam.sections || []).map((section, idx) => (
                                    <Draggable key={section.id} draggableId={section.id} index={idx} isDragDisabled={isReadOnly || renamingSectionId === section.id}>
                                        {(provided, snapshot) => (
                                            <div
                                                ref={provided.innerRef}
                                                {...provided.draggableProps}
                                                style={{
                                                    position: 'relative', display: 'inline-flex', alignItems: 'center',
                                                    ...provided.draggableProps.style,
                                                    opacity: snapshot.isDragging ? 0.8 : 1,
                                                }}
                                            >
                                                {renamingSectionId === section.id ? (
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                        <input
                                                            type="text"
                                                            value={renamingSectionTitle}
                                                            onChange={e => setRenamingSectionTitle(e.target.value)}
                                                            onKeyDown={e => { if (e.key === 'Enter') handleRenameSection(); if (e.key === 'Escape') setRenamingSectionId(null); }}
                                                            autoFocus
                                                            style={{
                                                                padding: '6px 12px', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 600,
                                                                border: '2px solid #6366f1', outline: 'none', width: '140px',
                                                                background: '#eff6ff', color: '#1e293b'
                                                            }}
                                                        />
                                                        {(exam.timingMode === 'section') && (
                                                            <input
                                                                type="text"
                                                                inputMode="decimal"
                                                                value={renamingSectionTime}
                                                                onChange={e => { const v = e.target.value; if (v === '' || /^\d*\.?\d*$/.test(v)) setRenamingSectionTime(v); }}
                                                                onKeyDown={e => { if (e.key === 'Enter') handleRenameSection(); if (e.key === 'Escape') setRenamingSectionId(null); }}
                                                                placeholder="phút"
                                                                style={{
                                                                    padding: '6px 8px', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 600,
                                                                    border: '2px solid #f59e0b', outline: 'none', width: '60px',
                                                                    background: '#fffbeb', color: '#92400e', textAlign: 'center'
                                                                }}
                                                            />
                                                        )}
                                                        <button onClick={handleRenameSection}
                                                            style={{ background: '#6366f1', color: '#fff', border: 'none', borderRadius: '6px', padding: '4px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                                                            <Check size={14} />
                                                        </button>
                                                        <button onClick={() => setRenamingSectionId(null)}
                                                            style={{ background: '#f1f5f9', color: '#64748b', border: 'none', borderRadius: '6px', padding: '4px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                                                            <X size={14} />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div className="section-tab-wrapper" style={{ display: 'flex', alignItems: 'stretch' }}>
                                                        <button
                                                            onClick={(e) => {
                                                                // Prevent clicking tab when manipulating drag handle 
                                                                setActiveSectionId(section.id);
                                                            }}
                                                            onDoubleClick={() => !isReadOnly && startRenameSection(section)}
                                                            className="section-tab-btn"
                                                            style={{
                                                                padding: '8px 16px', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 600,
                                                                background: activeSectionId === section.id ? '#6366f1' : '#f1f5f9',
                                                                color: activeSectionId === section.id ? '#fff' : '#64748b',
                                                                border: 'none', cursor: 'pointer', transition: 'all 0.2s',
                                                                display: 'flex', alignItems: 'center', gap: '6px', position: 'relative',
                                                                boxShadow: snapshot.isDragging ? '0 10px 15px -3px rgba(0, 0, 0, 0.1)' : 'none',
                                                            }}
                                                        >
                                                            {!isReadOnly && (
                                                                <span {...provided.dragHandleProps} onClick={e => e.stopPropagation()} style={{ cursor: 'grab', marginRight: '4px', display: 'flex', alignItems: 'center', opacity: 0.6 }}>
                                                                    <GripVertical size={14} />
                                                                </span>
                                                            )}
                                                            {section.title || `Section ${idx + 1}`}
                                                            {exam.timingMode === 'section' && (
                                                                section.timeLimitMinutes > 0 ? (
                                                                    <span style={{ fontSize: '0.65rem', opacity: 0.85, marginLeft: '2px', color: activeSectionId === section.id ? '#fef3c7' : '#d97706' }}>⏱{section.timeLimitMinutes}p</span>
                                                                ) : (
                                                                    <span style={{ fontSize: '0.65rem', marginLeft: '2px', color: activeSectionId === section.id ? '#fca5a5' : '#ef4444', fontWeight: 700 }}>⚠ chưa đặt giờ</span>
                                                                )
                                                            )}
                                                            <span style={{ fontSize: '0.7rem', opacity: 0.8, marginLeft: '4px' }}>
                                                                ({questions.filter(q => q.sectionId === section.id).reduce((sum, q) => sum + getQuestionTotalPoints(q), 0)}đ)
                                                            </span>
                                                            {!isReadOnly && activeSectionId === section.id && (
                                                                <span style={{ display: 'inline-flex', gap: '2px', marginLeft: '4px' }}>
                                                                    <span onClick={(e) => { e.stopPropagation(); startRenameSection(section); }}
                                                                        style={{ cursor: 'pointer', opacity: 0.7, display: 'inline-flex', alignItems: 'center' }}
                                                                        title="Đổi tên section">
                                                                        <Edit size={12} />
                                                                    </span>
                                                                    {(exam.sections || []).length > 1 && (
                                                                        <span onClick={(e) => { e.stopPropagation(); setSectionToDelete(section); }}
                                                                            style={{ cursor: 'pointer', opacity: 0.7, display: 'inline-flex', alignItems: 'center' }}
                                                                            title="Xóa section">
                                                                            <Trash2 size={12} />
                                                                        </span>
                                                                    )}
                                                                </span>
                                                            )}
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </Draggable>
                                ))}
                                {provided.placeholder}
                            </div>
                        )}
                    </Droppable>

                    {!isReadOnly && (
                        <button
                            onClick={handleAddSection}
                            title="Thêm section mới"
                            style={{
                                width: '36px', height: '36px', borderRadius: '8px', fontSize: '1rem',
                                background: '#f1f5f9', color: '#6366f1', border: '2px dashed #cbd5e1',
                                cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center',
                                justifyContent: 'center', fontWeight: 700
                            }}
                            onMouseEnter={e => { e.currentTarget.style.background = '#eff6ff'; e.currentTarget.style.borderColor = '#6366f1'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = '#f1f5f9'; e.currentTarget.style.borderColor = '#cbd5e1'; }}
                        >
                            <Plus size={18} />
                        </button>
                    )}
                </div>

                {/* Active Section Content */}
                {activeSection && (
                    <div className="admin-card section-preview-card" style={{
                        padding: '20px',
                        background: '#fff',
                        borderRadius: '20px',
                        border: '1px solid #e2e8f0',
                        boxShadow: '0 4px 20px rgba(0,0,0,0.03)',
                        marginBottom: '40px',
                        marginTop: '8px'
                    }}>
                        <div className="section-preview-header" style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'flex-start',
                            marginBottom: '16px',
                            paddingBottom: '12px',
                            borderBottom: '2px solid #f8fafc',
                            flexWrap: 'wrap',
                            gap: '8px'
                        }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0 }}>
                                <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#6366f1', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Đang xem:</span>
                                <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#0f172a' }}>
                                    {activeSection.title || `Section ${exam.sections.findIndex(s => s.id === activeSection.id) + 1}`}
                                </h2>
                                {exam.timingMode === 'section' && (
                                    <span style={{
                                        display: 'inline-flex', alignItems: 'center', gap: '4px', width: 'fit-content',
                                        padding: '3px 10px', borderRadius: '10px', fontSize: '0.75rem', fontWeight: 700,
                                        background: activeSection.timeLimitMinutes ? '#fff7ed' : '#fef2f2',
                                        color: activeSection.timeLimitMinutes ? '#ea580c' : '#ef4444',
                                        border: `1px solid ${activeSection.timeLimitMinutes ? '#fed7aa' : '#fecaca'}`,
                                        marginTop: '2px'
                                    }}>
                                        ⏱ {activeSection.timeLimitMinutes ? `${activeSection.timeLimitMinutes} phút` : 'Chưa đặt thời gian!'}
                                    </span>
                                )}
                            </div>
                            {!isReadOnly && (
                                editingSectionContext === activeSectionId ? (
                                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: saveStatus === 'error' ? '#ef4444' : '#64748b', fontWeight: 600 }}>
                                            {saveStatus === 'saving' && <><RefreshCw size={14} className="spin" /> Đang lưu...</>}
                                            {saveStatus === 'saved' && <><Check size={14} style={{ color: '#10b981' }} /> Đã lưu</>}
                                            {saveStatus === 'error' && <><AlertCircle size={14} /> Lỗi tự động lưu</>}
                                        </div>
                                        <button className="admin-btn admin-btn-primary" style={{ padding: '6px 16px', fontSize: '0.8rem', height: 'fit-content', borderRadius: '10px' }}
                                            onClick={() => handleSaveSectionContext(activeSectionId, activeSection.context)}>
                                            <Save size={14} /> Xong
                                        </button>
                                        <button className="admin-btn admin-btn-outline" style={{ padding: '6px 16px', fontSize: '0.8rem', height: 'fit-content', borderRadius: '10px' }}
                                            onClick={() => setEditingSectionContext(null)}>
                                            Hủy
                                        </button>
                                    </div>
                                ) : (
                                    <button className="admin-btn admin-btn-outline" style={{ padding: '6px 12px', fontSize: '0.8rem', height: 'fit-content', borderRadius: '10px', flexShrink: 0 }}
                                        onClick={() => setEditingSectionContext(activeSectionId)}>
                                        <Edit size={14} /> Sửa context
                                    </button>
                                )
                            )}
                        </div>
                        {editingSectionContext === activeSectionId ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                <div style={{ background: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', overflow: 'visible' }}>
                                    <ContextQuillEditor
                                        value={activeSection.context || ''}
                                        onChange={(val) => {
                                            const updatedSections = (exam.sections || []).map(s =>
                                                s.id === activeSectionId ? { ...s, context: val } : s
                                            );
                                            setExam(prev => ({ ...prev, sections: updatedSections }));
                                        }}
                                        readOnly={isReadOnly}
                                        style={{ height: '300px', marginBottom: '45px' }}
                                    />
                                </div>
                                <AudioContextUploader
                                    audioUrl={activeSection.contextAudioUrl || ''}
                                    onAudioChange={(url) => {
                                        const updatedSections = (exam.sections || []).map(s =>
                                            s.id === activeSectionId ? { ...s, contextAudioUrl: url || '' } : s
                                        );
                                        setExam(prev => ({ ...prev, sections: updatedSections }));
                                    }}
                                    disabled={isReadOnly}
                                    resourceType="exam"
                                    resourceId={examId}
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
                                        value={activeSection.contextScript || ''}
                                        onChange={e => {
                                            const updatedSections = (exam.sections || []).map(s =>
                                                s.id === activeSectionId ? { ...s, contextScript: e.target.value } : s
                                            );
                                            setExam(prev => ({ ...prev, sections: updatedSections }));
                                        }}
                                        disabled={isReadOnly}
                                        style={{ resize: 'vertical', fontSize: '0.9rem', lineHeight: 1.6 }}
                                    />
                                </div>
                            </div>
                        ) : (
                            hasContent(activeSection.context) || activeSection.contextAudioUrl ? (
                                <div style={{ padding: '0' }}>
                                    {hasContent(activeSection.context) && (
                                        <div className="ql-editor" style={{ padding: 0 }}
                                            dangerouslySetInnerHTML={{ __html: parseContextHtml(activeSection.context) }} />
                                    )}
                                    {activeSection.contextAudioUrl && (
                                        <div style={{ marginTop: hasContent(activeSection.context) ? '12px' : '0', padding: '12px 16px', background: '#f0fdf4', borderRadius: '12px', border: '1px solid #bbf7d0' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#15803d' }}>🎵 Audio ngữ cảnh</span>
                                            </div>
                                            <audio controls src={activeSection.contextAudioUrl} style={{ width: '100%', height: '40px' }} controlsList="nodownload" preload="metadata" />
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div style={{ color: '#94a3b8', fontSize: '0.85rem', fontStyle: 'italic', padding: '12px 16px', background: '#f8fafc', borderRadius: '12px', border: '1px dashed #e2e8f0', textAlign: 'center' }}>Chưa có nội dung context (bài đọc/nghe). Bấm "Sửa context" để thêm.</div>
                            )
                        )}

                        {/* Question List Header */}
                        <div style={{ marginTop: hasContent(activeSection.context) ? '28px' : '12px', paddingTop: '12px', borderTop: '1px solid #f8fafc' }}>
                            <div className="exam-questions-header" style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#475569', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <List size={16} /> Danh sách câu hỏi
                                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#6366f1', background: '#eef2ff', padding: '2px 8px', borderRadius: '10px' }}>{sectionQuestions.length}</span>
                                </h3>
                                {!isReadOnly && (
                                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                        <button className="admin-btn admin-btn-primary exam-add-question-btn" style={{ padding: '8px 16px', fontSize: '0.85rem' }} onClick={openAddForm}>
                                            <Plus size={16} /> Thêm câu hỏi
                                        </button>
                                        <button
                                            className="admin-btn admin-btn-secondary"
                                            style={{ padding: '8px 16px', fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: '#fff', border: 'none', fontWeight: 700 }}
                                            onClick={() => { setShowImportModal(true); setImportTab('text'); setImportText(''); setImportFile(null); setShowImportPreview(false); setImportedQuestions([]); }}
                                        >
                                            <FileText size={16} /> Nhập từ tài liệu
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Desktop Table View */}
                            <div className="admin-card admin-table-container exam-table-wrapper" style={{ padding: sectionQuestions.length === 0 ? '40px' : '0', boxShadow: 'none', border: sectionQuestions.length === 0 ? '1px dashed #e2e8f0' : 'none', background: sectionQuestions.length === 0 ? '#f8fafc' : 'transparent' }}>
                                {sectionQuestions.length === 0 ? (
                                    <div className="admin-empty-state" style={{ padding: 0 }}>
                                        <div className="admin-empty-icon"><Edit size={28} /></div>
                                        <h3>Chưa có câu hỏi nào trong section này.</h3>
                                        {!isReadOnly && <p>Bấm "Thêm câu hỏi" để bắt đầu.</p>}
                                    </div>
                                ) : (
                                    <table className="admin-table" style={{ margin: 0 }}>
                                        <thead>
                                            <tr>
                                                <th style={{ width: '40px' }}></th>
                                                <th>#</th>
                                                <th>Loại câu hỏi</th>
                                                <th>Nội dung (Variation 1)</th>
                                                <th className="text-right" style={{ paddingRight: '16px' }}>Hành động</th>
                                            </tr>
                                        </thead>
                                        <Droppable droppableId="questions" isDropDisabled={isReadOnly}>
                                            {(provided) => (
                                                <tbody ref={provided.innerRef} {...provided.droppableProps}>
                                                    {sectionQuestions.map((q, idx) => (
                                                        <Draggable key={q.id} draggableId={q.id} index={idx} isDragDisabled={isReadOnly}>
                                                            {(provided, snapshot) => (
                                                                <tr
                                                                    ref={provided.innerRef} {...provided.draggableProps}
                                                                    style={{
                                                                        ...provided.draggableProps.style,
                                                                        backgroundColor: snapshot.isDragging ? '#f8fafc' : 'white',
                                                                        boxShadow: snapshot.isDragging ? '0 4px 6px -1px rgba(0, 0, 0, 0.1)' : 'none',
                                                                        display: provided.draggableProps.style?.display === 'none' ? 'none' : 'table-row'
                                                                    }}
                                                                >
                                                                    <td className="admin-drag-handle" style={{ width: '40px', padding: '12px 8px', textAlign: 'center' }}>
                                                                        {!isReadOnly && (
                                                                            <div {...provided.dragHandleProps} style={{ cursor: 'grab', color: '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                                                <GripVertical size={16} />
                                                                            </div>
                                                                        )}
                                                                    </td>
                                                                    <td data-label="#" style={{ width: '40px', textAlign: 'center' }}>{idx + 1}</td>
                                                                    <td data-label="Loại câu hỏi">
                                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-start' }}>
                                                                            <span style={{ fontSize: '0.75rem', padding: '2px 8px', background: '#e0e7ff', color: '#4f46e5', borderRadius: '4px', fontWeight: 600 }}>
                                                                                {q.type === 'multiple_choice' ? 'Trắc nghiệm' : q.type === 'essay' ? 'Viết luận / Tự luận' : (q.type === 'fill_in_blank' || q.type === 'fill_in_blanks') ? 'Chọn đáp án cho chỗ trống' : q.type === 'fill_in_blank_typing' ? 'Điền vào chỗ trống' : q.type === 'matching' ? 'Kết nối' : q.type === 'categorization' ? 'Phân loại' : q.type === 'ordering' ? 'Sắp xếp' : q.type === 'audio_recording' ? 'Thu âm / Ghi âm' : q.type}
                                                                            </span>
                                                                            {q.targetSkill && (() => {
                                                                                const sk = SKILL_OPTIONS.find(s => s.value === q.targetSkill);
                                                                                return sk ? (
                                                                                    <span style={{ fontSize: '0.7rem', padding: '2px 6px', background: '#f0fdfa', color: sk.color, borderRadius: '4px', fontWeight: 600 }}>
                                                                                        {sk.label}
                                                                                    </span>
                                                                                ) : null;
                                                                            })()}
                                                                            <span style={{ fontSize: '0.7rem', color: '#d97706', background: '#fef3c7', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>
                                                                                {getQuestionTotalPoints(q)} đ{getQuestionItemCount(q) > 1 ? ` (${q.points || 1}đ×${getQuestionItemCount(q)})` : ''}
                                                                            </span>
                                                                            {exam.timingMode === 'question' && q.timeLimitSeconds >= 5 && (
                                                                                <span style={{ fontSize: '0.65rem', color: '#0284c7', background: '#f0f9ff', padding: '2px 6px', borderRadius: '4px', fontWeight: 600, border: '1px solid #bae6fd' }}>⏱ {q.timeLimitSeconds}s</span>
                                                                            )}
                                                                            {exam.timingMode === 'question' && (!q.timeLimitSeconds || q.timeLimitSeconds < 5) && (
                                                                                <span style={{ fontSize: '0.65rem', color: '#dc2626', background: '#fef2f2', padding: '2px 6px', borderRadius: '4px', fontWeight: 700, border: '1px solid #fecaca' }}>⚠ Chưa hẹn giờ</span>
                                                                            )}
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
                                                                    <td data-label="Nội dung">
                                                                        <div style={{ fontSize: '0.9rem', color: '#334155', maxWidth: '300px', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                                                                            {(q.type === 'fill_in_blank' || q.type === 'fill_in_blanks' || q.type === 'fill_in_blank_typing')
                                                                                ? renderFillInBlankText(q.variations?.[0]?.text)
                                                                                : (q.variations?.[0]?.text
                                                                                    ? <span dangerouslySetInnerHTML={{ __html: normalizeRichTextValue(q.variations[0].text).replace(/&nbsp;/g, ' ') }} />
                                                                                    : (q.purpose || '(Chưa có nội dung)'))}
                                                                        </div>
                                                                        {q.purpose && (
                                                                            <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '4px', maxWidth: '300px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                                                Mục tiêu: {q.purpose}
                                                                            </div>
                                                                        )}
                                                                    </td>
                                                                    <td data-label="Hành động" className="text-right" style={{ paddingRight: '16px' }}>
                                                                        <div className="admin-table-actions">
                                                                            {!isReadOnly ? (
                                                                                <>
                                                                                    <button className="admin-action-btn" onClick={() => openEditForm(q)} title="Sửa"><Edit size={16} /></button>
                                                                                    <button className="admin-action-btn" onClick={() => handleDuplicate(q)} title="Nhân bản"><Copy size={16} /></button>
                                                                                    {(exam?.sections || []).length > 1 && (
                                                                                        <button className="admin-action-btn" onClick={() => setQuestionToMove(q)} title="Chuyển section" style={{ color: '#7c3aed' }}><ArrowRightLeft size={16} /></button>
                                                                                    )}
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
                                )}
                            </div>

                            {/* Mobile Card View */}
                            <div className="exam-mobile-list">
                                {sectionQuestions.length === 0 ? (
                                    <div className="admin-card" style={{ padding: '32px', textAlign: 'center' }}>
                                        <div style={{ fontSize: '2rem', marginBottom: '8px' }}>✏️</div>
                                        <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>Chưa có câu hỏi nào trong section này.</p>
                                        {!isReadOnly && <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginTop: '4px' }}>Bấm "Thêm câu hỏi" để bắt đầu.</p>}
                                    </div>
                                ) : (
                                    sectionQuestions.map((q, idx) => (
                                        <div key={q.id} className="exam-mobile-card">
                                            <div className="exam-mobile-card-header">
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', minWidth: 0 }}>
                                                    <span className="exam-mobile-card-index">{idx + 1}</span>
                                                    <span className="grammar-mobile-card-type">
                                                        {q.type === 'multiple_choice' ? 'Trắc nghiệm' : q.type === 'essay' ? 'Viết luận / Tự luận' : (q.type === 'fill_in_blank' || q.type === 'fill_in_blanks') ? 'Chọn đáp án cho chỗ trống' : q.type === 'fill_in_blank_typing' ? 'Điền vào chỗ trống' : q.type === 'matching' ? 'Kết nối' : q.type === 'categorization' ? 'Phân loại' : q.type === 'ordering' ? 'Sắp xếp' : q.type === 'audio_recording' ? 'Thu âm / Ghi âm' : q.type}
                                                    </span>
                                                    <span style={{ fontSize: '0.7rem', color: '#d97706', background: '#fef3c7', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>{getQuestionTotalPoints(q)} đ{getQuestionItemCount(q) > 1 ? ` (${q.points || 1}đ×${getQuestionItemCount(q)})` : ''}</span>
                                                    {exam.timingMode === 'question' && q.timeLimitSeconds >= 5 && (
                                                        <span style={{ fontSize: '0.65rem', color: '#0284c7', background: '#f0f9ff', padding: '2px 6px', borderRadius: '4px', fontWeight: 600, border: '1px solid #bae6fd' }}>⏱ {q.timeLimitSeconds}s</span>
                                                    )}
                                                    {exam.timingMode === 'question' && (!q.timeLimitSeconds || q.timeLimitSeconds < 5) && (
                                                        <span style={{ fontSize: '0.65rem', color: '#dc2626', background: '#fef2f2', padding: '2px 6px', borderRadius: '4px', fontWeight: 700, border: '1px solid #fecaca' }}>⚠ Chưa hẹn giờ</span>
                                                    )}
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
                                            </div>
                                            <div style={{ marginBottom: '12px' }}>
                                                <div style={{ fontSize: '0.9rem', color: '#1e293b', fontWeight: 500, lineHeight: 1.7, overflowWrap: 'anywhere', wordBreak: 'break-word', minWidth: 0 }}>
                                                    {(q.type === 'fill_in_blank' || q.type === 'fill_in_blanks' || q.type === 'fill_in_blank_typing')
                                                        ? renderFillInBlankText(q.variations?.[0]?.text)
                                                        : (q.variations?.[0]?.text
                                                            ? <span dangerouslySetInnerHTML={{ __html: normalizeRichTextValue(q.variations[0].text).replace(/&nbsp;/g, ' ') }} />
                                                            : '(Chưa có nội dung)')}
                                                </div>
                                                {q.purpose && (
                                                    <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '6px' }}>
                                                        🎯 {q.purpose}
                                                    </div>
                                                )}
                                            </div>
                                            <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                                                {!isReadOnly ? (
                                                    <>
                                                        <button className="admin-action-btn" onClick={() => openEditForm(q)} title="Sửa">
                                                            <Edit size={16} />
                                                        </button>
                                                        <button className="admin-action-btn" onClick={() => handleDuplicate(q)} title="Nhân bản" style={{ color: '#15803d' }}>
                                                            <Copy size={16} />
                                                        </button>
                                                        {(exam?.sections || []).length > 1 && (
                                                            <button className="admin-action-btn" onClick={() => setQuestionToMove(q)} title="Chuyển section" style={{ color: '#7c3aed' }}>
                                                                <ArrowRightLeft size={16} />
                                                            </button>
                                                        )}
                                                        <button className="admin-action-btn" onClick={() => setQuestionToDelete(q)} title="Xóa" style={{ color: '#ef4444' }}>
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </>
                                                ) : (
                                                    <button className="admin-action-btn" onClick={() => openEditForm(q)} title="Xem chi tiết">
                                                        <Info size={16} />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* --- QUESTION FORM MODAL --- */}
                {formOpen && (
                    <div className="admin-modal-overlay">
                        <div className="admin-modal" style={{ maxWidth: '800px', width: '95%', display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}>
                            <div className="admin-modal-header" style={{ position: 'sticky', top: 0, background: '#fff', zIndex: 3, borderBottom: '1px solid #e2e8f0', padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <h2 className="admin-modal-title" style={{ margin: 0 }}>
                                    {isEditingQuestion ? (isReadOnly ? 'Chi tiết câu hỏi' : 'Sửa câu hỏi') : 'Thêm câu hỏi mới'}
                                </h2>
                                <button className="admin-modal-close" onClick={() => handleCloseForm()} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                                    <X size={24} />
                                </button>
                            </div>
                            <div style={{ padding: '20px', overflowY: 'auto', flex: 1, scrollbarGutter: 'stable' }}>
                                <form onSubmit={handleSubmit}>
                                    <div className="admin-form-row" style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                                        <div className="admin-form-group" style={{ flex: 1.8 }}>
                                            <label>Loại câu hỏi</label>
                                            <CustomDropdown
                                                value={formData.type}
                                                disabled={isReadOnly}
                                                options={[
                                                    { value: 'multiple_choice', label: '🎯 Trắc nghiệm' },
                                                    { value: 'fill_in_blank', label: '🔽 Chọn đáp án cho chỗ trống' },
                                                    { value: 'fill_in_blank_typing', label: '✏️ Điền vào chỗ trống' },
                                                    { value: 'essay', label: '📝 Viết luận / Tự luận' },
                                                    { value: 'matching', label: '🔗 Kết nối' },
                                                    { value: 'categorization', label: '🗂️ Phân loại' },
                                                    { value: 'ordering', label: '🔢 Sắp xếp thứ tự' },
                                                    { value: 'audio_recording', label: '🎤 Thu âm / Ghi âm' }
                                                ]}
                                                onChange={(val) => setFormData(prev => ({
                                                    ...prev, type: val,
                                                    variations: [getInitialVariation(val)]
                                                }))}
                                            />
                                        </div>
                                        <div className="admin-form-group" style={{ flex: 1 }}>
                                            <label>Kỹ năng mục tiêu <span style={{ color: '#ef4444', fontWeight: 700 }}>*</span></label>
                                            <CustomDropdown
                                                value={formData.targetSkill || ''}
                                                disabled={isReadOnly}
                                                className={`required-dropdown${formData.targetSkill ? ' filled' : ''}`}
                                                options={[
                                                    { value: '', label: '— Chọn —' },
                                                    { value: 'listening', label: '🎧 Listening' },
                                                    { value: 'speaking', label: '🗣️ Speaking' },
                                                    { value: 'reading', label: '📖 Reading' },
                                                    { value: 'writing', label: '✍️ Writing' },
                                                    { value: 'grammar', label: '📝 Grammar' },
                                                    { value: 'vocabulary', label: '📚 Vocabulary' },
                                                ]}
                                                onChange={(val) => setFormData({ ...formData, targetSkill: val })}
                                            />
                                        </div>
                                        <div className="admin-form-group" style={{ flex: 1.2 }}>
                                            <label htmlFor="exam-question-points">{getScoreLabel(formData.type)} <span style={{ color: '#ef4444', fontWeight: 700 }}>*</span></label>
                                            <input id="exam-question-points" name="points" type="number" className={`admin-form-input required-field${formData.points ? ' filled' : ''}`} min={0.25} max={100} step={0.25} value={formData.points} disabled={isReadOnly} onChange={e => setFormData({ ...formData, points: parseFloat(e.target.value) || '' })} placeholder="Nhập điểm" />
                                            {(() => {
                                                const unitName = getItemUnitName(formData.type);
                                                if (!unitName) return null;
                                                const v1 = formData.variations?.[0];
                                                let count = 0;
                                                if (formData.type === 'fill_in_blank' || formData.type === 'fill_in_blanks' || formData.type === 'fill_in_blank_typing') {
                                                    count = parseFillBlanks(v1?.text || '').length;
                                                } else if (formData.type === 'matching') {
                                                    count = (v1?.pairs || []).length;
                                                } else if (formData.type === 'categorization') {
                                                    count = (v1?.items || []).length;
                                                } else if (formData.type === 'ordering') {
                                                    count = (v1?.items || []).length;
                                                }
                                                if (count === 0) return <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '4px' }}>Tổng điểm: sẽ tính khi thêm {unitName}</div>;
                                                const total = (formData.points || 1) * count;
                                                return <div style={{ fontSize: '0.78rem', color: '#d97706', fontWeight: 600, marginTop: '4px', background: '#fffbeb', padding: '4px 8px', borderRadius: '6px', border: '1px solid #fde68a' }}>⭐ Tổng điểm: {count} {unitName} × {formData.points || 1}đ = <strong>{total}đ</strong></div>;
                                            })()}
                                        </div>
                                        {(exam.timingMode === 'question') && (
                                            <div className="admin-form-group" style={{ flex: 1 }}>
                                                <label htmlFor="exam-question-time-limit">⏱ Thời gian (giây) <span style={{ color: '#ef4444', fontWeight: 700 }}>*</span></label>
                                                <input id="exam-question-time-limit" name="timeLimitSeconds" type="number" className={`admin-form-input required-field${formData.timeLimitSeconds ? ' filled' : ''}`} required min={5} max={3600} value={formData.timeLimitSeconds || ''} disabled={isReadOnly} onChange={e => setFormData({ ...formData, timeLimitSeconds: parseInt(e.target.value) || '' })} placeholder="Nhập" />
                                            </div>
                                        )}
                                    </div>
                                    {formData.type === 'fill_in_blank_typing' && (
                                        <div style={{
                                            display: 'flex', alignItems: 'flex-start', gap: '10px',
                                            padding: '10px 14px', marginTop: '-4px', marginBottom: '8px',
                                            background: '#fffbeb', border: '1px solid #fde68a',
                                            borderRadius: '10px', fontSize: '0.82rem', color: '#92400e',
                                            lineHeight: 1.5
                                        }}>
                                            <label htmlFor="exam-question-use-ai-grading" style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', flexShrink: 0, fontWeight: 600, marginTop: '1px' }}>
                                                <input
                                                    id="exam-question-use-ai-grading"
                                                    name="useAIGrading"
                                                    type="checkbox"
                                                    checked={!!formData.useAIGrading}
                                                    onChange={e => setFormData(prev => ({ ...prev, useAIGrading: e.target.checked }))}
                                                    disabled={isReadOnly}
                                                    style={{ accentColor: '#d97706', width: '15px', height: '15px', cursor: 'pointer' }}
                                                />
                                                <span>🤖 Nhờ AI kiểm tra</span>
                                            </label>
                                            <span style={{ color: '#78350f', opacity: 0.8 }}>— Đáp án bạn cung cấp là <strong>đáp án gợi ý</strong>. Nếu câu trả lời của học viên gần nghĩa và vẫn đúng ngữ cảnh, AI sẽ chấp nhận là đúng. Tuy nhiên, học viên sẽ phải chờ AI chấm điểm.</span>
                                        </div>
                                    )}
                                    <div className="admin-form-group">
                                        <label htmlFor="exam-question-purpose" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>Mục tiêu kiểm tra chính của câu hỏi <span style={{ color: '#ef4444', fontWeight: 700 }}>*</span> <span title="AI sử dụng mục tiêu này để tạo variations chính xác và phù hợp" style={{ cursor: 'help', color: '#94a3b8', fontSize: '0.8rem', fontWeight: 700, width: '16px', height: '16px', borderRadius: '50%', border: '1.5px solid #cbd5e1', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>i</span></label>
                                        <textarea id="exam-question-purpose" name="purpose" className={`admin-form-input required-field${formData.purpose ? ' filled' : ''}`} required value={formData.purpose} disabled={isReadOnly} onChange={e => setFormData({ ...formData, purpose: e.target.value })} placeholder="Ví dụ: Kiểm tra khả năng sử dụng thì hiện tại hoàn thành"
                                            rows={1}
                                            style={{ resize: 'none', overflow: 'hidden', minHeight: '40px', lineHeight: '1.5' }}
                                            onInput={e => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px'; }}
                                        />
                                    </div>

                                    <hr className="form-section-divider" />
                                    {/* Vocabulary topic selector */}
                                    <div className="admin-form-group optional-field">
                                        <label htmlFor="exam-question-vocab-topic-search" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>📚 Chủ đề từ vựng (tùy chọn) <span title="AI sẽ ưu tiên sử dụng từ vựng trong chủ đề này để tạo câu hỏi" style={{ cursor: 'help', color: '#94a3b8', fontSize: '0.8rem', fontWeight: 700, width: '16px', height: '16px', borderRadius: '50%', border: '1.5px solid #cbd5e1', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>i</span></label>
                                        <div style={{ position: 'relative' }}>
                                            <input
                                                id="exam-question-vocab-topic-search"
                                                name="vocabTopicSearch"
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

                                    {['essay', 'audio_recording'].includes(formData.type) && (
                                        <div style={{
                                            border: '1.5px solid #c7d2fe', borderRadius: '14px',
                                            padding: '16px', background: '#fafbff',
                                            marginTop: '4px'
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
                                                    id="exam-question-default-grading-criteria"
                                                    name="useDefaultGradingCriteria"
                                                    type="checkbox"
                                                    checked={formData.useDefaultGradingCriteria !== false}
                                                    disabled={isReadOnly}
                                                    onChange={e => setFormData(prev => ({ ...prev, useDefaultGradingCriteria: e.target.checked, ...(e.target.checked ? { promptId: '', promptTitle: '' } : {}) }))}
                                                    style={{ accentColor: '#6366f1', width: '16px', height: '16px', cursor: isReadOnly ? 'default' : 'pointer' }}
                                                />
                                                <span style={{ fontWeight: 600, fontSize: '0.88rem', color: '#334155' }}>
                                                    📏 Sử dụng tiêu chí chấm mặc định của hệ thống
                                                </span>
                                                <span title={formData.useDefaultGradingCriteria !== false ? 'AI sẽ áp dụng tiêu chí chấm mặc định bên dưới, kết hợp với prompt/yêu cầu đặc biệt (nếu có).' : 'AI sẽ chỉ chấm theo prompt/yêu cầu đặc biệt của bạn. Không áp dụng tiêu chí mặc định.'}
                                                    style={{ cursor: 'help', color: '#94a3b8', fontSize: '0.8rem', fontWeight: 700, width: '16px', height: '16px', borderRadius: '50%', border: '1.5px solid #cbd5e1', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>i</span>
                                            </label>
                                            {formData.useDefaultGradingCriteria !== false && (
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
                                                    {formData.type === 'audio_recording' && (
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

                                        {formData.useDefaultGradingCriteria === false && (
                                        <>
                                        <hr style={{ border: 'none', borderTop: '1px solid #e0e7ff', margin: '12px 0' }} />

                                        {/* Prompt picker — only when default criteria is OFF */}
                                        <div className="admin-form-group optional-field" style={{ marginBottom: '8px' }}>
                                            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>📝 Chọn/nhập tiêu chí chấm điểm cá nhân từ prompt bank của bạn (nếu có) <span title="Hướng dẫn AI chấm theo tiêu chí riêng của bạn." style={{ cursor: 'help', color: '#94a3b8', fontSize: '0.8rem', fontWeight: 700, width: '16px', height: '16px', borderRadius: '50%', border: '1.5px solid #cbd5e1', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>i</span></label>
                                            {isReadOnly ? (
                                                (formData.promptId || formData.specialRequirement) && (
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
                                                    {!formData.promptId && (
                                                        <div style={{ marginBottom: '8px' }}>
                                                            <SavedPromptPicker
                                                                uid={user?.uid}
                                                                onSelect={({ id, title }) => setFormData(prev => ({
                                                                    ...prev,
                                                                    promptId: id,
                                                                    promptTitle: title
                                                                }))}
                                                            />
                                                        </div>
                                                    )}
                                                    {formData.promptId && (
                                                        <div style={{
                                                            display: 'flex', alignItems: 'center', gap: '10px',
                                                            padding: '10px 14px', background: '#f0fdf4', border: '1px solid #bbf7d0',
                                                            borderRadius: '10px', fontSize: '0.85rem', color: '#15803d', fontWeight: 600,
                                                        }}>
                                                            <span style={{ fontSize: '1rem' }}>📎</span>
                                                            <span style={{ flex: 1 }}>Đang sử dụng prompt: "<strong>{formData.promptTitle || 'Prompt đã lưu'}</strong>"</span>
                                                            <button type="button" onClick={() => setFormData(prev => ({ ...prev, promptId: '', promptTitle: '' }))}
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
                                                id="exam-question-special-requirement"
                                                name="specialRequirement"
                                                className="admin-form-input"
                                                placeholder="Nhập yêu cầu bổ sung cho AI khi chấm (nếu có)..."
                                                rows={3}
                                                value={formData.specialRequirement || ''}
                                                onChange={e => setFormData({ ...formData, specialRequirement: e.target.value })}
                                                style={{ resize: 'vertical' }}
                                            />
                                        </div>
                                        )}
                                        </div>
                                    )}

                                    {/* AI Generate */}
                                    {!isReadOnly && (() => {
                                        const hasImageOptions = formData.type === 'multiple_choice' &&
                                            (formData.variations?.[0]?.options || []).some(opt => isImageOption(opt));
                                        return (
                                            <>
                                                {hasImageOptions && (
                                                    <div style={{
                                                        display: 'flex', alignItems: 'center', gap: '8px',
                                                        padding: '10px 14px', margin: '12px 0 4px',
                                                        background: '#dbeafe', border: '1px solid #93c5fd',
                                                        borderRadius: '10px', fontSize: '0.82rem', color: '#1e40af',
                                                        lineHeight: 1.5
                                                    }}>
                                                        <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>💡</span>
                                                        <span>Đáp án có chứa <b>hình ảnh</b> — AI sẽ tạo đáp án dạng <b>text</b> cho các variations. Sau khi AI tạo xong, hãy bấm <b>✨</b> bên cạnh mỗi đáp án để tạo ảnh.</span>
                                                    </div>
                                                )}
                                                <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', margin: '16px 0', flexWrap: 'wrap', gap: '16px' }}>
                                                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', fontWeight: 600, color: '#475569', cursor: 'pointer' }}>
                                                        <input
                                                            id="exam-question-vietnamese-toggle"
                                                            name="isVietnameseQuestion"
                                                            type="checkbox"
                                                            checked={isVietnameseQuestion}
                                                            onChange={e => setIsVietnameseQuestion(e.target.checked)}
                                                            style={{ accentColor: 'var(--color-primary)', width: '16px', height: '16px' }}
                                                        />
                                                        Hỏi bằng TV
                                                    </label>
                                                    <button type="button" className="admin-btn admin-btn-outline" onClick={handleGenerateAI} disabled={isGeneratingAI}
                                                        style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px' }}
                                                        title=''>
                                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                                            {isGeneratingAI ? <RefreshCw size={14} className="spin" /> : <Wand2 size={14} />}
                                                            <span>{isGeneratingAI ? 'Đang tạo...' : 'Quét lỗi và tạo variations'}</span>
                                                        </span>
                                                    </button>
                                                </div>
                                            </>
                                        );
                                    })()}

                                    {/* Variations Editor */}
                                    <div style={{ marginTop: '16px' }}>
                                        <label style={{ fontWeight: 600, fontSize: '0.9rem', color: '#475569', display: 'block', marginBottom: '12px' }}>
                                            Variations ({formData.variations?.length || 0}/5)
                                        </label>
                                        {[0, 1, 2, 3, 4].map(vIdx => {
                                            const variation = formData.variations?.[vIdx];
                                            const hasContent = variation && (variation.text || variation.content);
                                            return (
                                                <div key={vIdx} style={{ marginBottom: '16px', padding: '16px', background: hasContent ? '#f8fafc' : '#fafafa', borderRadius: '10px', border: `1px solid ${hasContent ? '#e2e8f0' : '#f1f5f9'}` }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: vIdx === 0 ? '4px' : '8px' }}>
                                                        <span style={{ fontWeight: 700, fontSize: '0.8rem', color: vIdx === 0 ? '#6366f1' : '#64748b' }}>
                                                            Variation {vIdx + 1} {vIdx === 0 ? '(Gốc)' : ''} {vIdx === 0 && <span style={{ color: '#ef4444' }}>*</span>}
                                                        </span>
                                                        {vIdx > 0 && !isReadOnly && (() => {
                                                            const hasImgOpts = formData.type === 'multiple_choice' &&
                                                                (formData.variations?.[0]?.options || []).some(opt => isImageOption(opt));
                                                            return (
                                                                <button type="button" className="admin-btn admin-btn-outline"
                                                                    style={{ padding: '2px 8px', fontSize: '0.75rem', opacity: hasImgOpts ? 0.5 : 1 }}
                                                                    onClick={() => handleGenerateSingleAI(vIdx)}
                                                                    disabled={generatingVariationIdx === vIdx || hasImgOpts}
                                                                    title={hasImgOpts ? 'Không hỗ trợ AI cho đáp án hình ảnh' : ''}>
                                                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                                                        {generatingVariationIdx === vIdx ? <RefreshCw size={12} className="spin" /> : <Wand2 size={12} />}
                                                                        <span>AI tạo</span>
                                                                    </span>
                                                                </button>
                                                            );
                                                        })()}
                                                    </div>
                                                    {vIdx === 0 && (
                                                        <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '8px', lineHeight: 1.4 }}>⚡ Đây là câu mẫu để AI bắt chước và tạo ra các variations tương tự.</div>
                                                    )}
                                                    {/* Question text - different UI for fill_in_blank vs others */}
                                                    {(formData.type === 'fill_in_blank' || formData.type === 'fill_in_blanks') ? (
                                                        <FillInBlankEditor
                                                            variation={variation}
                                                            vIdx={vIdx}
                                                            isReadOnly={isReadOnly}
                                                            updateVariation={updateVariation}
                                                        />
                                                    ) : formData.type === 'fill_in_blank_typing' ? (
                                                        <FillInBlankEditor
                                                            variation={variation}
                                                            vIdx={vIdx}
                                                            isReadOnly={isReadOnly}
                                                            updateVariation={updateVariation}
                                                            hideDistractors={true}
                                                        />
                                                    ) : (
                                                        <>
                                                            <div className="admin-form-group" style={{ marginBottom: '8px' }}>
                                                                <RichTextInput
                                                                    key={`text-${formData.id || 'new'}-${formData.type}-${vIdx}`}
                                                                    value={variation?.text || ''}
                                                                    onChange={val => updateVariation(vIdx, 'text', val)}
                                                                    disabled={isReadOnly}
                                                                    placeholder="Nội dung câu hỏi..."
                                                                    minHeight="60px"
                                                                    wrapperClassName={vIdx === 0 ? `required-field${variation?.text?.replace(/<[^>]*>?/gm, '').trim() ? ' filled' : ''}` : ''}
                                                                />
                                                            </div>

                                                            {/* Type-specific inputs */}
                                                            {formData.type === 'multiple_choice' && (
                                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                                                    {(variation?.options || ['', '', '', '']).map((opt, oIdx) => (
                                                                        <div key={oIdx} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                                                            <input id={`exam-question-correct-${vIdx}-${oIdx}`} aria-label={`Chọn đáp án đúng ${oIdx + 1} cho variation ${vIdx + 1}`} type="radio" name={`correct-${vIdx}`} checked={variation?.correctAnswer === oIdx}
                                                                                disabled={isReadOnly}
                                                                                onChange={() => updateVariation(vIdx, 'correctAnswer', oIdx)} />
                                                                            {isImageOption(opt) ? (
                                                                                <ImageOptionUploader
                                                                                    value={opt}
                                                                                    onChange={url => updateOption(vIdx, oIdx, url)}
                                                                                    onScheduleDelete={url => pendingImageDeletionsRef.current.push(url)}
                                                                                    onTrackUpload={url => newlyUploadedImagesRef.current.push(url)}
                                                                                    onSaveOriginalText={text => { originalOptionTextsRef.current[`${vIdx}-${oIdx}`] = text; }}
                                                                                    restoreValue={originalOptionTextsRef.current[`${vIdx}-${oIdx}`] || ''}
                                                                                    disabled={isReadOnly}
                                                                                />
                                                                            ) : (
                                                                                <>
                                                                                    <FormattedOptionInput
                                                                                        style={{ margin: 0, flex: 1 }}
                                                                                        placeholder={`Đáp án ${oIdx + 1}`}
                                                                                        value={opt}
                                                                                        onChange={val => updateOption(vIdx, oIdx, val)}
                                                                                        disabled={isReadOnly}
                                                                                    />
                                                                                    <ImageOptionUploader
                                                                                        value={opt}
                                                                                        onChange={url => updateOption(vIdx, oIdx, url)}
                                                                                        onScheduleDelete={url => pendingImageDeletionsRef.current.push(url)}
                                                                                        onTrackUpload={url => newlyUploadedImagesRef.current.push(url)}
                                                                                        onSaveOriginalText={text => { originalOptionTextsRef.current[`${vIdx}-${oIdx}`] = text; }}
                                                                                        disabled={isReadOnly}
                                                                                    />
                                                                                    <AIImageGenerateButton
                                                                                        optionText={opt}
                                                                                        onChange={url => updateOption(vIdx, oIdx, url)}
                                                                                        currentValue={opt}
                                                                                        onScheduleDelete={url => pendingImageDeletionsRef.current.push(url)}
                                                                                        onTrackUpload={url => newlyUploadedImagesRef.current.push(url)}
                                                                                        onSaveOriginalText={text => { originalOptionTextsRef.current[`${vIdx}-${oIdx}`] = text; }}
                                                                                        disabled={isReadOnly}
                                                                                    />
                                                                                </>
                                                                            )}
                                                                            {!isReadOnly && (variation?.options || []).length > 2 && (
                                                                                <button type="button" onClick={() => removeOption(vIdx, oIdx)} title="Xóa đáp án" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '4px', borderRadius: '4px', display: 'flex', alignItems: 'center', flexShrink: 0, opacity: 0.6 }} onMouseOver={e => e.currentTarget.style.opacity = 1} onMouseOut={e => e.currentTarget.style.opacity = 0.6}>
                                                                                    <X size={14} />
                                                                                </button>
                                                                            )}
                                                                        </div>
                                                                    ))}
                                                                    {!isReadOnly && (variation?.options || []).length < 6 && (
                                                                        <button type="button" onClick={() => addOption(vIdx)} style={{ marginTop: '8px', background: 'none', border: '1px dashed #cbd5e1', borderRadius: '8px', padding: '6px 12px', color: '#64748b', fontSize: '0.8rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                                                            <Plus size={14} /> Thêm đáp án
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </>
                                                    )}

                                                    {formData.type === 'matching' && (
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                                            {(variation?.pairs || []).map((pair, pIdx) => (
                                                                <div key={pIdx} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                                                    <input id={`exam-question-pair-left-${vIdx}-${pIdx}`} name={`variation-${vIdx}-pair-left-${pIdx}`} aria-label={`Vế trái cặp ${pIdx + 1} của variation ${vIdx + 1}`} type="text" className="admin-form-input" style={{ margin: 0, flex: 1 }} placeholder="Bên trái"
                                                                        disabled={isReadOnly}
                                                                        value={pair.left} onChange={e => updatePair(vIdx, pIdx, 'left', e.target.value)} />
                                                                    <span style={{ color: '#94a3b8' }}>→</span>
                                                                    <input id={`exam-question-pair-right-${vIdx}-${pIdx}`} name={`variation-${vIdx}-pair-right-${pIdx}`} aria-label={`Vế phải cặp ${pIdx + 1} của variation ${vIdx + 1}`} type="text" className="admin-form-input" style={{ margin: 0, flex: 1 }} placeholder="Bên phải"
                                                                        disabled={isReadOnly}
                                                                        value={pair.right} onChange={e => updatePair(vIdx, pIdx, 'right', e.target.value)} />
                                                                    {!isReadOnly && (
                                                                        <button type="button" onClick={() => removePair(vIdx, pIdx)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444' }}>
                                                                            <X size={14} />
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            ))}
                                                            {!isReadOnly && (
                                                                <button type="button" className="admin-btn admin-btn-outline" style={{ padding: '4px 12px', fontSize: '0.8rem', width: 'fit-content' }}
                                                                    onClick={() => addPair(vIdx)}>
                                                                    <Plus size={12} /> Thêm cặp
                                                                </button>
                                                            )}
                                                        </div>
                                                    )}

                                                    {formData.type === 'categorization' && (() => {
                                                        // Use groups from Variation 1 as fallback for other variations
                                                        const v1Groups = formData.variations?.[0]?.groups || ['Nhóm 1', 'Nhóm 2'];
                                                        const effectiveGroups = (variation?.groups && variation.groups.length > 0) ? variation.groups : v1Groups;
                                                        return (
                                                            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                                                                {effectiveGroups.map((g, gIdx) => {
                                                                    const groupItems = (variation?.items || [])
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
                                                                            {/* Column header - editable group name */}
                                                                            <div style={{
                                                                                padding: '10px 12px', background: color.headerBg,
                                                                                borderBottom: `1.5px solid ${color.border}`,
                                                                                display: 'flex', alignItems: 'center', gap: '6px'
                                                                            }}>
                                                                                <div style={{
                                                                                    width: '8px', height: '8px', borderRadius: '50%',
                                                                                    background: color.tag, flexShrink: 0
                                                                                }} />
                                                                                <input id={`exam-question-group-${vIdx}-${gIdx}`} name={`variation-${vIdx}-group-${gIdx}`} aria-label={`Tên nhóm ${gIdx + 1} của variation ${vIdx + 1}`} type="text" className="admin-form-input"
                                                                                    style={{
                                                                                        margin: 0, padding: '4px 8px', fontSize: '0.85rem',
                                                                                        fontWeight: 700, color: color.header,
                                                                                        background: 'transparent', border: `1.5px dashed transparent`,
                                                                                        borderRadius: '6px', textAlign: 'center',
                                                                                        transition: 'all 0.2s'
                                                                                    }}
                                                                                    onFocus={e => { e.target.style.background = '#fff'; e.target.style.borderColor = color.border; }}
                                                                                    onBlur={e => { e.target.style.background = 'transparent'; e.target.style.borderColor = 'transparent'; }}
                                                                                    placeholder={`Nhóm ${gIdx + 1}`}
                                                                                    disabled={isReadOnly}
                                                                                    value={g}
                                                                                    onChange={e => {
                                                                                        const newGroups = [...(variation.groups || [])];
                                                                                        const oldGroupName = newGroups[gIdx];
                                                                                        newGroups[gIdx] = e.target.value;
                                                                                        const newItems = (variation.items || []).map(item => item.group === oldGroupName ? { ...item, group: e.target.value } : item);
                                                                                        const newVars = [...formData.variations];
                                                                                        newVars[vIdx] = { ...newVars[vIdx], groups: newGroups, items: newItems };
                                                                                        setFormData(prev => ({ ...prev, variations: newVars }));
                                                                                    }}
                                                                                />
                                                                                <span style={{ fontSize: '0.7rem', color: color.header, fontWeight: 600, opacity: 0.7, flexShrink: 0 }}>
                                                                                    {groupItems.length}
                                                                                </span>
                                                                            </div>
                                                                            {/* Items in this column */}
                                                                            <div style={{ padding: '8px', display: 'flex', flexDirection: 'column', gap: '6px', minHeight: '50px' }}>
                                                                                {groupItems.map((item) => (
                                                                                    <div key={item._origIdx} style={{
                                                                                        display: 'flex', alignItems: 'center', gap: '6px',
                                                                                        background: '#fff', borderRadius: '8px',
                                                                                        padding: '6px 10px', border: '1px solid #e2e8f0',
                                                                                        boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
                                                                                    }}>
                                                                                        <input id={`exam-question-group-item-${vIdx}-${item._origIdx}`} name={`variation-${vIdx}-group-item-${item._origIdx}`} aria-label={`Nội dung mục ${item._origIdx + 1} của variation ${vIdx + 1}`} type="text" className="admin-form-input"
                                                                                            style={{ margin: 0, flex: 1, border: 'none', padding: '2px 4px', fontSize: '0.85rem', background: 'transparent' }}
                                                                                            placeholder="Nhập nội dung..."
                                                                                            disabled={isReadOnly}
                                                                                            value={item.text}
                                                                                            onChange={e => updateItem(vIdx, item._origIdx, 'text', e.target.value)}
                                                                                        />
                                                                                        {!isReadOnly && (
                                                                                            <button type="button" onClick={() => removeItem(vIdx, item._origIdx)}
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
                                                                                            setFormData(prev => {
                                                                                                const newVars = [...prev.variations];
                                                                                                // Initialize variation if it doesn't exist yet
                                                                                                if (!newVars[vIdx]) {
                                                                                                    newVars[vIdx] = { text: '', groups: [...effectiveGroups], items: [], explanation: '' };
                                                                                                } else if (!newVars[vIdx].groups || newVars[vIdx].groups.length === 0) {
                                                                                                    newVars[vIdx] = { ...newVars[vIdx], groups: [...effectiveGroups] };
                                                                                                }
                                                                                                newVars[vIdx] = {
                                                                                                    ...newVars[vIdx],
                                                                                                    items: [...(newVars[vIdx].items || []), { text: '', group: g }]
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
                                                                        onClick={() => {
                                                                            setFormData(prev => {
                                                                                const newVars = [...prev.variations];
                                                                                if (!newVars[vIdx]) {
                                                                                    newVars[vIdx] = { text: '', groups: [...effectiveGroups], items: [], explanation: '' };
                                                                                }
                                                                                const currentGroups = newVars[vIdx].groups || [...effectiveGroups];
                                                                                newVars[vIdx] = {
                                                                                    ...newVars[vIdx],
                                                                                    groups: [...currentGroups, `Nhóm ${currentGroups.length + 1}`]
                                                                                };
                                                                                return { ...prev, variations: newVars };
                                                                            });
                                                                        }}
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

                                                    {formData.type === 'ordering' && (() => {
                                                        const orderItems = variation?.items || [];
                                                        return (
                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                                <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600, marginBottom: '2px' }}>
                                                                    Nhập các mục theo <strong style={{ color: '#4f46e5' }}>đúng thứ tự</strong> (hệ thống sẽ xáo trộn khi hiển thị cho học viên)
                                                                </div>
                                                                {orderItems.map((item, iIdx) => (
                                                                    <div key={iIdx} style={{
                                                                        display: 'flex', alignItems: 'center', gap: '8px',
                                                                        background: '#f8fafc', borderRadius: '10px',
                                                                        padding: '8px 12px', border: '1px solid #e2e8f0'
                                                                    }}>
                                                                        <div style={{
                                                                            width: '28px', height: '28px', borderRadius: '50%',
                                                                            background: '#e0e7ff', color: '#4f46e5',
                                                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                            fontSize: '0.8rem', fontWeight: 800, flexShrink: 0
                                                                        }}>
                                                                            {iIdx + 1}
                                                                        </div>
                                                                        <input id={`exam-question-order-item-${vIdx}-${iIdx}`} name={`variation-${vIdx}-order-item-${iIdx}`} aria-label={`Mục thứ ${iIdx + 1} của variation ${vIdx + 1}`} type="text" className="admin-form-input"
                                                                            style={{ margin: 0, flex: 1, border: 'none', padding: '6px 8px', fontSize: '0.9rem', background: 'transparent' }}
                                                                            placeholder={`Mục thứ ${iIdx + 1}...`}
                                                                            disabled={isReadOnly}
                                                                            value={item}
                                                                            onChange={e => {
                                                                                const newVars = [...formData.variations];
                                                                                const newItems = [...(newVars[vIdx]?.items || [])];
                                                                                newItems[iIdx] = e.target.value;
                                                                                newVars[vIdx] = { ...newVars[vIdx], items: newItems };
                                                                                setFormData(prev => ({ ...prev, variations: newVars }));
                                                                            }}
                                                                        />
                                                                        {!isReadOnly && orderItems.length > 1 && (
                                                                            <div style={{ display: 'flex', gap: '2px', flexShrink: 0 }}>
                                                                                {iIdx > 0 && (
                                                                                    <button type="button" onClick={() => {
                                                                                        const newVars = [...formData.variations];
                                                                                        const newItems = [...(newVars[vIdx]?.items || [])];
                                                                                        [newItems[iIdx - 1], newItems[iIdx]] = [newItems[iIdx], newItems[iIdx - 1]];
                                                                                        newVars[vIdx] = { ...newVars[vIdx], items: newItems };
                                                                                        setFormData(prev => ({ ...prev, variations: newVars }));
                                                                                    }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '2px', display: 'flex' }}
                                                                                        title="Di chuyển lên">
                                                                                        ▲
                                                                                    </button>
                                                                                )}
                                                                                {iIdx < orderItems.length - 1 && (
                                                                                    <button type="button" onClick={() => {
                                                                                        const newVars = [...formData.variations];
                                                                                        const newItems = [...(newVars[vIdx]?.items || [])];
                                                                                        [newItems[iIdx], newItems[iIdx + 1]] = [newItems[iIdx + 1], newItems[iIdx]];
                                                                                        newVars[vIdx] = { ...newVars[vIdx], items: newItems };
                                                                                        setFormData(prev => ({ ...prev, variations: newVars }));
                                                                                    }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '2px', display: 'flex' }}
                                                                                        title="Di chuyển xuống">
                                                                                        ▼
                                                                                    </button>
                                                                                )}
                                                                                <button type="button" onClick={() => {
                                                                                    const newVars = [...formData.variations];
                                                                                    const newItems = (newVars[vIdx]?.items || []).filter((_, i) => i !== iIdx);
                                                                                    newVars[vIdx] = { ...newVars[vIdx], items: newItems };
                                                                                    setFormData(prev => ({ ...prev, variations: newVars }));
                                                                                }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#cbd5e1', padding: '2px', display: 'flex', transition: 'color 0.2s' }}
                                                                                    onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                                                                                    onMouseLeave={e => e.currentTarget.style.color = '#cbd5e1'}>
                                                                                    <X size={14} />
                                                                                </button>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                ))}
                                                                {!isReadOnly && (
                                                                    <button type="button" className="admin-btn admin-btn-outline"
                                                                        style={{ padding: '6px 14px', fontSize: '0.8rem', width: 'fit-content', borderRadius: '8px' }}
                                                                        onClick={() => {
                                                                            const newVars = [...formData.variations];
                                                                            if (!newVars[vIdx]) newVars[vIdx] = { text: '', items: [], explanation: '' };
                                                                            newVars[vIdx] = { ...newVars[vIdx], items: [...(newVars[vIdx].items || []), ''] };
                                                                            setFormData(prev => ({ ...prev, variations: newVars }));
                                                                        }}>
                                                                        <Plus size={12} /> Thêm mục
                                                                    </button>
                                                                )}
                                                            </div>
                                                        );
                                                    })()}

                                                    {/* Explanation */}
                                                    <div className="admin-form-group" style={{ marginTop: '8px', marginBottom: 0 }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                                                            <label style={{ margin: 0, fontSize: '0.85rem' }}>Giải thích đáp án (tùy chọn)</label>
                                                            {!isReadOnly && (
                                                                <button type="button" className="admin-btn admin-btn-outline"
                                                                    style={{ padding: '4px 8px', fontSize: '0.7rem', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                                                                    onClick={() => handleGenerateExplanation(vIdx)}
                                                                    disabled={generatingExplanationIdx === vIdx}
                                                                    title="AI tạo giải thích bắt chước style V1">
                                                                    {generatingExplanationIdx === vIdx ? <RefreshCw size={11} className="spin" /> : <Wand2 size={11} />}
                                                                    <span>AI</span>
                                                                </button>
                                                            )}
                                                        </div>
                                                        <RichTextInput
                                                            key={`expl-${formData.id || 'new'}-${formData.type}-${vIdx}`}
                                                            value={variation?.explanation || ''}
                                                            onChange={val => updateVariation(vIdx, 'explanation', val)}
                                                            disabled={isReadOnly}
                                                            placeholder="Giải thích đáp án..."
                                                            minHeight="50px"
                                                        />
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    <div className="admin-modal-actions" style={{ marginTop: '24px', position: 'sticky', bottom: '-20px', background: '#fff', padding: '16px 20px 20px 20px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                                        <button type="button" className="admin-btn admin-btn-secondary" onClick={() => handleCloseForm()} disabled={isSaving}>Đóng</button>
                                        {!isReadOnly && (
                                            <button type="submit" className="admin-btn admin-btn-primary" disabled={isSaving}>
                                                {isSaving ? 'Đang lưu...' : (isEditingQuestion ? 'Cập nhật' : 'Thêm')}
                                            </button>
                                        )}
                                    </div>
                                </form>
                            </div>
                        </div>
                    </div>
                )}

                {/* --- DELETE QUESTION CONFIRM --- */}
                {questionToDelete && (
                    <div className="admin-modal-overlay">
                        <div className="admin-modal">
                            <h2 className="admin-modal-title" style={{ color: '#ef4444' }}><Trash2 size={24} /> Xác nhận xóa</h2>
                            <p className="admin-modal-desc">Bạn có chắc chắn muốn xóa câu hỏi này?</p>
                            <div className="admin-modal-actions">
                                <button className="admin-btn admin-btn-secondary" onClick={() => setQuestionToDelete(null)}>Hủy</button>
                                <button className="admin-btn admin-btn-primary" style={{ backgroundColor: '#ef4444' }} onClick={handleConfirmDelete}>Xóa</button>
                            </div>
                        </div>
                    </div>
                )}

                {/* --- MOVE TO SECTION MODAL --- */}
                {questionToMove && (
                    <div className="admin-modal-overlay">
                        <div className="admin-modal" style={{ maxWidth: '420px' }}>
                            <h2 className="admin-modal-title" style={{ color: '#7c3aed' }}><ArrowRightLeft size={24} /> Chuyển sang Section khác</h2>
                            <p className="admin-modal-desc" style={{ marginBottom: '16px' }}>
                                Chọn section đích cho câu hỏi này:
                            </p>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                                {(exam?.sections || []).filter(s => s.id !== questionToMove.sectionId).map(section => (
                                    <button
                                        key={section.id}
                                        onClick={() => handleMoveToSection(questionToMove, section.id)}
                                        style={{
                                            padding: '12px 16px', borderRadius: '12px', border: '2px solid #e2e8f0',
                                            background: '#f8fafc', cursor: 'pointer', textAlign: 'left',
                                            fontWeight: 600, fontSize: '0.88rem', color: '#334155',
                                            transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: '8px'
                                        }}
                                        onMouseEnter={e => { e.currentTarget.style.borderColor = '#7c3aed'; e.currentTarget.style.background = '#f5f3ff'; }}
                                        onMouseLeave={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.background = '#f8fafc'; }}
                                    >
                                        📑 {section.title}
                                        <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: '#94a3b8', fontWeight: 400 }}>
                                            {(questions || []).filter(q => q.sectionId === section.id).length} câu
                                        </span>
                                    </button>
                                ))}
                            </div>
                            <div className="admin-modal-actions">
                                <button className="admin-btn admin-btn-secondary" onClick={() => setQuestionToMove(null)}>Hủy</button>
                            </div>
                        </div>
                    </div>
                )}

                {/* --- IMPORT TIME WARNING MODAL --- */}
                {showImportTimeWarning && (
                    <div className="admin-modal-overlay" style={{ zIndex: 1200 }}>
                        <div className="admin-modal">
                            <h2 className="admin-modal-title" style={{ color: '#ea580c' }}>⚠ Chưa đặt thời gian</h2>
                            <p className="admin-modal-desc" style={{ lineHeight: 1.6 }}>
                                Có <strong>{importedQuestions.filter((q, idx) => importSelections[idx] && (!q.timeLimitSeconds || q.timeLimitSeconds < 5)).length}</strong> câu hỏi chưa được đặt thời gian.<br /><br />
                                Bạn có thể đặt thời gian cho từng câu hỏi sau trong danh sách câu hỏi. Nhập câu hỏi vào danh sách ngay bây giờ?
                            </p>
                            <div className="admin-modal-actions">
                                <button className="admin-btn admin-btn-secondary" onClick={() => setShowImportTimeWarning(false)}>← Quay lại đặt giờ</button>
                                <button className="admin-btn admin-btn-primary" style={{ background: '#ea580c' }} onClick={() => { setShowImportTimeWarning(false); handleConfirmImport(true); }}>Nhập ngay</button>
                            </div>
                        </div>
                    </div>
                )}

                {/* --- DELETE SECTION CONFIRM --- */}
                {sectionToDelete && (
                    <div className="admin-modal-overlay">
                        <div className="admin-modal">
                            <h2 className="admin-modal-title" style={{ color: '#ef4444' }}><Trash2 size={24} /> Xóa section</h2>
                            <p className="admin-modal-desc">
                                Bạn có chắc chắn muốn xóa section <strong>"{sectionToDelete.title}"</strong>?
                                {questions.filter(q => q.sectionId === sectionToDelete.id).length > 0 && (
                                    <><br /><span style={{ color: '#ef4444', fontWeight: 600 }}>⚠️ Section này có {questions.filter(q => q.sectionId === sectionToDelete.id).length} câu hỏi sẽ mất liên kết!</span></>
                                )}
                            </p>
                            <div className="admin-modal-actions">
                                <button className="admin-btn admin-btn-secondary" onClick={() => setSectionToDelete(null)}>Hủy</button>
                                <button className="admin-btn admin-btn-primary" style={{ backgroundColor: '#ef4444' }} onClick={handleDeleteSection}>Xóa section</button>
                            </div>
                        </div>
                    </div>
                )}

                {/* --- DOCUMENT IMPORT MODAL --- */}
                {showImportModal && (
                    <div className="admin-modal-overlay" style={{ zIndex: 1100 }}>
                        <div className="admin-modal" style={{ maxWidth: showImportPreview ? '800px' : '600px', maxHeight: '90vh', overflow: 'auto' }}>
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
                                            placeholder="Dán nội dung đề thi / bài tập vào đây...&#10;&#10;Ví dụ:&#10;1. She ___ (go) to school every day.&#10;a) go  b) goes  c) going  d) went&#10;Answer: b&#10;&#10;2. Match the words with their meanings:&#10;abundant - dồi dào&#10;scarce - khan hiếm"
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
                                    <div style={{ maxHeight: '50vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', paddingRight: '4px' }}>
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
                                                                {/* Editable Points Input */}
                                                                <div onClick={e => e.stopPropagation()} style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', fontSize: '0.72rem', fontWeight: 600, color: '#d97706', background: '#fffbeb', padding: '2px 8px', borderRadius: '6px', border: '1px solid #fde68a' }}>
                                                                    <input
                                                                        id={`import-question-points-${idx}`}
                                                                        name={`importQuestionPoints${idx}`}
                                                                        aria-label={`Điểm của câu ${idx + 1}`}
                                                                        type="number"
                                                                        min={1}
                                                                        max={100}
                                                                        value={q.points || 1}
                                                                        onChange={e => {
                                                                            const val = parseInt(e.target.value) || 1;
                                                                            setImportedQuestions(prev => prev.map((pq, pi) => pi === idx ? { ...pq, points: val } : pq));
                                                                        }}
                                                                        style={{
                                                                            width: '32px', border: 'none', background: 'transparent', color: '#d97706',
                                                                            fontWeight: 700, fontSize: '0.72rem', textAlign: 'center', outline: 'none',
                                                                            padding: 0, margin: 0
                                                                        }}
                                                                    />
                                                                    <span>đ</span>
                                                                </div>
                                                                {exam.timingMode === 'question' && (
                                                                    <div onClick={e => e.stopPropagation()} style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', fontSize: '0.72rem', fontWeight: 600, color: '#0284c7', background: '#f0f9ff', padding: '2px 8px', borderRadius: '6px', border: '1px solid #bae6fd' }}>
                                                                        ⏱
                                                                        <input
                                                                            id={`import-question-time-${idx}`}
                                                                            name={`importQuestionTime${idx}`}
                                                                            aria-label={`Thời gian câu ${idx + 1}`}
                                                                            type="number"
                                                                            min={5}
                                                                            max={600}
                                                                            value={q.timeLimitSeconds || ''}
                                                                            onChange={e => {
                                                                                const val = parseInt(e.target.value) || 0;
                                                                                setImportedQuestions(prev => prev.map((pq, pi) => pi === idx ? { ...pq, timeLimitSeconds: val } : pq));
                                                                            }}
                                                                            style={{
                                                                                width: '36px', border: 'none', background: 'transparent', color: '#0284c7',
                                                                                fontWeight: 700, fontSize: '0.72rem', textAlign: 'center', outline: 'none',
                                                                                padding: 0, margin: 0
                                                                            }}
                                                                        />
                                                                        <span>giây</span>
                                                                    </div>
                                                                )}
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
                                                            {/* Editable Purpose Input */}
                                                            <div style={{ marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }} onClick={e => e.stopPropagation()}>
                                                                <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontStyle: 'italic', flexShrink: 0 }}>Mục tiêu:</span>
                                                                <input
                                                                    id={`import-question-purpose-${idx}`}
                                                                    name={`importQuestionPurpose${idx}`}
                                                                    aria-label={`Mục tiêu của câu ${idx + 1}`}
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
                                    <div className="admin-modal-actions" style={{ marginTop: '16px' }}>
                                        <button className="admin-btn admin-btn-secondary" onClick={() => setShowImportPreview(false)} disabled={isSavingImport}>
                                            ← Quay lại
                                        </button>
                                        <button
                                            className="admin-btn admin-btn-primary"
                                            onClick={() => handleConfirmImport()}
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
            </div>
        </DragDropContext >
    );
}
