import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, ArrowLeft, PenLine, Sparkles, CheckCircle2, BookOpen, X, AlertCircle, Info } from 'lucide-react';
import logo from '../assets/logo.png';
import BrandLogo from '../components/common/BrandLogo';
import { chatCompletion } from '../services/aiService';
import { saveCustomList } from '../services/savedService';
import { useAuth } from '../contexts/AuthContext';
import './CustomInputPage.css';

const MIN_WORDS = 3;
const MAX_WORDS = 15;

const SYSTEM_PROMPT = `Bạn là chuyên gia dạy từ vựng tiếng Anh. Bạn sẽ nhận một danh sách từ tiếng Anh và trả về JSON array chứa data học tập chi tiết.

Với MỖI từ trong danh sách, trả về object có ĐÚNG cấu trúc sau:
{
  "word": "từ tiếng Anh",
  "phonetic": "phiên âm IPA, ví dụ /nɪˈɡoʊ.ʃi.eɪt/",
  "partOfSpeech": "noun/verb/adjective/adverb/...",
  "vietnameseMeaning": "nghĩa tiếng Việt ngắn gọn",
  "explanation": "Giải thích ý nghĩa bằng tiếng Việt dễ hiểu (2-3 câu)",
  "distractors": ["từ1_giống_phát_âm", "từ2", "từ3"],
  "pronunciationTip": "Gợi ý cách phát âm bằng tiếng Việt, ví dụ: Nhấn trọng âm ở âm tiết thứ 2: ne-GO-shi-ate",
  "collocations": [
    { "phrase": "cụm từ 1", "vietnamese": "nghĩa tiếng Việt" },
    { "phrase": "cụm từ 2", "vietnamese": "nghĩa tiếng Việt" },
    { "phrase": "cụm từ 3", "vietnamese": "nghĩa tiếng Việt" }
  ],
  "exampleSentences": [
    { "en": "Câu ví dụ tiếng Anh", "vi": "Bản dịch tiếng Việt" }
  ],
  "sentenceSequence": {
    "en": "Một câu tiếng Anh tự nhiên để học viên luyện tập ráp từ. Câu phải phù hợp với trình độ người dùng.",
    "vi": "Dịch nghĩa tiếng Việt của câu trên"
  }
}

QUY TẮC:
- Trả về ĐÚNG JSON array, KHÔNG có markdown, KHÔNG có text ngoài JSON
- distractors: 3 từ có cách phát âm hoặc hình dạng tương tự để gây nhiễu
- collocations: đúng 3 cụm từ thông dụng
- sentenceSequence: 1 câu tiếng Anh thông dụng để ráp chữ.
- explanation phải bằng tiếng Việt, giải thích dễ hiểu cho người Việt`;

export default function CustomInputPage() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [inputText, setInputText] = useState('');
    const [listName, setListName] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const textareaRef = useRef(null);

    // Parse words from input text
    const words = inputText
        .split(/[,，;;\n]+/)
        .map(w => w.trim().toLowerCase().replace(/[^a-z\s'-]/g, ''))
        .filter(w => w.length > 1);

    // Deduplicate
    const uniqueWords = [...new Set(words)];
    const wordCount = uniqueWords.length;
    const isValid = wordCount >= MIN_WORDS && wordCount <= MAX_WORDS;

    function removeWord(wordToRemove) {
        // Rebuild input text without the removed word  
        const parts = inputText.split(/[,\n]+/).map(w => w.trim()).filter(w => w.toLowerCase() !== wordToRemove);
        setInputText(parts.join(', '));
    }

    async function handleGenerate() {
        if (!isValid || loading) return;

        setLoading(true);
        setError('');

        try {
            const result = await chatCompletion({
                systemPrompt: SYSTEM_PROMPT,
                userContent: `Tạo dữ liệu học tập cho các từ sau: ${uniqueWords.join(', ')}`,
                responseFormat: 'json',
            });

            // Parse the response
            let generatedWords;
            try {
                // Handle potential markdown code blocks in response
                let text = result.text.trim();
                if (text.startsWith('```')) {
                    text = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
                }
                generatedWords = JSON.parse(text);
            } catch (parseErr) {
                console.error('Parse error:', parseErr, result.text);
                throw new Error('AI trả về dữ liệu không hợp lệ. Vui lòng thử lại.');
            }

            if (!Array.isArray(generatedWords) || generatedWords.length === 0) {
                throw new Error('AI không tạo được dữ liệu. Vui lòng thử lại.');
            }

            // Validate basic structure
            const validWords = generatedWords.filter(w =>
                w.word && w.vietnameseMeaning && w.phonetic
            );

            if (validWords.length === 0) {
                throw new Error('Dữ liệu từ AI không đúng cấu trúc. Vui lòng thử lại.');
            }

            // Save the list to Firestore if user is logged in
            let finalListName = listName.trim();
            if (!finalListName) {
                finalListName = `Danh sách ngày ${new Date().toLocaleDateString('vi-VN')}`;
            }
            if (user?.uid) {
                try {
                    await saveCustomList(user.uid, finalListName, validWords);
                } catch (saveErr) {
                    console.error('Failed to save custom list:', saveErr);
                }
            }

            // Navigate to learn page
            navigate('/learn', {
                state: {
                    words: validWords,
                    topicId: 'custom',
                    topicName: 'Từ tùy chỉnh',
                },
            });
        } catch (err) {
            console.error('Generate error:', err);
            setError(err.message || 'Có lỗi xảy ra khi tạo bài học. Vui lòng thử lại.');
            setLoading(false);
        }
    }

    // Loading state
    if (loading) {
        return (
            <div className="custom-input-page">
                <header className="dashboard-header">
                    <div className="container flex-between" style={{ position: 'relative' }}>
                        <button className="btn btn-ghost" disabled>
                            <ArrowLeft size={20} />
                        </button>
                        <div className="dashboard-brand" style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)' }}>
                            <BrandLogo size="1.2rem" />
                        </div>
                        <div style={{ width: 44 }}></div>
                    </div>
                </header>
                <main className="custom-input-main container">
                    <div className="custom-input-loading">
                        <div className="custom-input-loading-spinner" />
                        <div>
                            <h3>✨ Đang tạo bài học...</h3>
                            <p>AI đang phân tích và tạo nội dung học tập cho {wordCount} từ của bạn</p>
                        </div>
                        <div className="custom-input-loading-words">
                            {uniqueWords.map(w => (
                                <span key={w} className="custom-input-loading-word">{w}</span>
                            ))}
                        </div>
                    </div>
                </main>
            </div>
        );
    }

    return (
        <div className="custom-input-page">
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

            <main className="custom-input-main container">
                {/* Title */}
                <div className="custom-input-title-section animate-slide-up">
                    <PenLine size={24} className="text-warning" />
                    <h1>Tự tạo bài học</h1>
                    <p>Nhập các từ tiếng Anh bạn muốn học, AI sẽ tạo bài học tự động</p>
                </div>

                {/* Error */}
                {error && (
                    <div className="custom-input-error">
                        <AlertCircle size={18} />
                        <span>{error}</span>
                    </div>
                )}

                {/* Input Card */}
                <div className="custom-input-card glass-card--static animate-slide-up">
                    <div className="custom-input-group">
                        <label className="custom-input-label">
                            <PenLine size={14} />
                            Tên danh sách (Tùy chọn)
                        </label>
                        <input
                            type="text"
                            className="custom-input-field"
                            placeholder={`VD: Từ vựng Unit 1, Tiếng Anh Giao Tiếp...`}
                            value={listName}
                            onChange={e => setListName(e.target.value)}
                        />
                    </div>

                    <div className="custom-input-group">
                        <label className="custom-input-label">
                            <Sparkles size={14} />
                            Nhập từ vựng tiếng Anh
                        </label>
                        <textarea
                            ref={textareaRef}
                            className="custom-input-textarea"
                            placeholder={"Ví dụ:\nnegotiate, deadline, revenue\n\nHoặc mỗi từ một dòng:\nnegotiate\ndeadline\nrevenue"}
                            value={inputText}
                            onChange={e => setInputText(e.target.value)}
                            rows={5}
                        />
                    </div>
                    <div className="custom-input-hint">
                        <Info size={14} className="custom-input-hint-icon" />
                        <span>Cách nhau bằng dấu phẩy hoặc xuống dòng • Tối thiểu {MIN_WORDS}, tối đa {MAX_WORDS} từ</span>
                    </div>

                    {/* Tags */}
                    {uniqueWords.length > 0 && (
                        <div className="custom-input-tags">
                            {uniqueWords.map(w => (
                                <span key={w} className="custom-input-tag">
                                    {w}
                                    <button
                                        className="custom-input-tag-remove"
                                        onClick={() => removeWord(w)}
                                        title="Xóa"
                                    >✕</button>
                                </span>
                            ))}
                        </div>
                    )}

                    {/* Count */}
                    <div className="custom-input-count">
                        <span className={`custom-input-count-num ${wordCount === 0 ? '' :
                            wordCount < MIN_WORDS ? 'custom-input-count--warn' :
                                wordCount > MAX_WORDS ? 'custom-input-count--error' :
                                    'custom-input-count--ok'
                            }`}>
                            {wordCount} / {MAX_WORDS} từ
                        </span>
                        {wordCount > 0 && wordCount < MIN_WORDS && (
                            <span className="custom-input-count--warn">Cần thêm {MIN_WORDS - wordCount} từ nữa</span>
                        )}
                        {wordCount > MAX_WORDS && (
                            <span className="custom-input-count--error">Vượt quá {wordCount - MAX_WORDS} từ</span>
                        )}
                    </div>
                </div>

                {/* Submit */}
                <div className="custom-input-submit">
                    <button
                        className="btn btn-primary btn-lg btn-full"
                        onClick={handleGenerate}
                        disabled={!isValid}
                    >
                        🚀 Tạo bài học {wordCount > 0 ? `(${wordCount} từ)` : ''}
                    </button>
                </div>
            </main>
        </div>
    );
}
