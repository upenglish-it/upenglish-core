import React, { useState, useEffect } from 'react';
import { dashboardService } from '../../models';
import { useAppSettings } from '../../contexts/AppSettingsContext';
import { useAuth } from '../../contexts/AuthContext';
import { updateAppSettings } from '../../services/appSettingsService';
import { Users, UsersRound, Award, TrendingUp, CheckCircle, UserPlus, Send, Loader, Bot, ChevronDown, ChevronUp } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell, PieChart, Pie } from 'recharts';
import { chatCompletion } from '../../services/aiService';


export default function AdminDashboardPage() {
    const [stats, setStats] = useState({
        users: 0,
        groups: 0,
        topics: 0,
        teacherTopics: 0,
        grammarExercises: 0,
        teacherGrammarExercises: 0,
        systemExams: 0,
        teacherExams: 0
    });
    const [chartData, setChartData] = useState({
        topTeachers: [],
        topClasses: [],
        weeklyActivity: [],
        userGrowth: [],
        teacherCompletionRank: [],
    });
    const [loading, setLoading] = useState(true);
    const { settings } = useAppSettings();
    const { user } = useAuth();
    const isStaff = user?.role === 'staff';

    // AI Chat state
    const [chatOpen, setChatOpen] = useState(false);
    const [chatMessages, setChatMessages] = useState([]);
    const [chatInput, setChatInput] = useState('');
    const [chatLoading, setChatLoading] = useState(false);
    const rawDataRef = React.useRef(null);

    useEffect(() => {
        async function loadStats() {
            setLoading(true);
            try {
                const result = await dashboardService.getStats();

                setChartData(result.chartData);
                setStats(result.stats);
                rawDataRef.current = { aiSummary: result.aiSummary };
            } catch (error) {
                console.error("Error loading stats", error);
            }
            setLoading(false);
        }
        loadStats();
    }, []);

    const handleToggleDevBypass = async () => {
        try {
            await updateAppSettings({ devBypassEnabled: !settings?.devBypassEnabled });
        } catch (error) {
            console.error("Failed to toggle dev bypass", error);
            alert("Không thể cập nhật cài đặt. Vui lòng thử lại.");
        }
    };

    const handleToggleRetryAiGrading = async () => {
        try {
            await updateAppSettings({ allowRetryAiGrading: !settings?.allowRetryAiGrading });
        } catch (error) {
            console.error("Failed to toggle AI retry", error);
            alert("Không thể cập nhật cài đặt. Vui lòng thử lại.");
        }
    };

    // === AI CHAT FUNCTIONS ===
    function buildDataSummary() {
        if (!rawDataRef.current || !rawDataRef.current.aiSummary) return 'Dữ liệu chưa sẵn sàng.';
        return rawDataRef.current.aiSummary;
    }

    async function handleAskAI() {
        const q = chatInput.trim();
        if (!q || chatLoading) return;
        setChatInput('');
        setChatMessages(prev => [...prev, { role: 'user', text: q }]);
        setChatLoading(true);
        try {
            const summary = buildDataSummary();
            const result = await chatCompletion({
                systemPrompt: `Bạn là AI phân tích dữ liệu cho hệ thống quản lý học tiếng Anh "sUPerStudy". Dưới đây là toàn bộ dữ liệu hệ thống hiện tại. Hãy trả lời câu hỏi của admin dựa trên dữ liệu này. Trả lời ngắn gọn, chính xác, bằng tiếng Việt. Nếu có bảng thì dùng format đơn giản. Nếu không đủ dữ liệu để trả lời thì nói rõ.\n\n${summary}`,
                userContent: q
            });
            setChatMessages(prev => [...prev, { role: 'ai', text: result.text }]);
        } catch (err) {
            setChatMessages(prev => [...prev, { role: 'ai', text: `❌ Lỗi: ${err.message}` }]);
        }
        setChatLoading(false);
    }


    return (
        <div className="admin-page">
            <h1 className="admin-page-title">Tổng quan hệ thống</h1>
            <p className="admin-page-subtitle">Xem tổng quan hoạt động, thống kê và biểu đồ của toàn hệ thống.</p>

            {/* <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px', marginTop: '24px' }}>
                <div className="admin-card" style={{ padding: '24px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#eff6ff', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <UsersRound size={24} />
                    </div>
                    <div>
                        <div style={{ fontSize: '0.9rem', color: '#64748b', fontWeight: 500 }}>NHÓM</div>
                        <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#0f172a' }}>{stats.groups || 0}</div>
                    </div>
                </div>
                <div className="admin-card" style={{ padding: '24px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#fdf4ff', color: '#d946ef', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Users size={24} />
                    </div>
                    <div>
                        <div style={{ fontSize: '0.9rem', color: '#64748b', fontWeight: 500 }}>NGƯỜI DÙNG</div>
                        <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#0f172a' }}>{stats.users || 0}</div>
                    </div>
                </div>
                <div className="admin-card" style={{ padding: '24px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#fffbeb', color: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <CheckCircle size={24} />
                    </div>
                    <div>
                        <div style={{ fontSize: '0.9rem', color: '#64748b', fontWeight: 500 }}>BÀI THI</div>
                        <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#0f172a' }}>{(stats.systemExams || 0) + (stats.teacherExams || 0)}</div>
                    </div>
                </div>
                <div className="admin-card" style={{ padding: '24px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#ecfdf5', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Award size={24} />
                    </div>
                    <div>
                        <div style={{ fontSize: '0.9rem', color: '#64748b', fontWeight: 500 }}>BÀI HỌC</div>
                        <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#0f172a' }}>{(stats.topics || 0) + (stats.teacherTopics || 0) + (stats.grammarExercises || 0) + (stats.teacherGrammarExercises || 0)}</div>
                    </div>
                </div>
            </div>*/}

            {/* Dashboard Charts Area */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px', marginTop: '24px' }} className="admin-charts-area">

                {/* Top Teachers Chart */}
                <div className="admin-card" style={{ padding: '24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                        <div style={{ padding: '8px', borderRadius: '10px', background: '#fdf4ff', color: '#d946ef' }}>
                            <Award size={20} />
                        </div>
                        <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600, color: '#0f172a' }}>Top Giáo Viên Sôi Nổi</h3>
                    </div>

                    {loading ? (
                        <div style={{ padding: '40px 0', textAlign: 'center', color: '#64748b' }}>Đang tải dữ liệu...</div>
                    ) : chartData.topTeachers.length === 0 ? (
                        <div style={{ padding: '40px 0', textAlign: 'center', color: '#64748b' }}>Chưa có đủ dữ liệu giáo viên.</div>
                    ) : (() => {
                        const PIE_COLORS = ['#d946ef', '#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#06b6d4'];
                        const totalContent = chartData.topTeachers.reduce((s, t) => s + t.count, 0);
                        return (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                                <ResponsiveContainer width={160} height={160}>
                                    <PieChart>
                                        <Pie data={chartData.topTeachers} dataKey="count" nameKey="name" cx="50%" cy="50%" innerRadius={38} outerRadius={70} paddingAngle={3}>
                                            {chartData.topTeachers.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                                        </Pie>
                                        <Tooltip formatter={(val, name) => [`${val} bài`, name]} contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0' }} />
                                    </PieChart>
                                </ResponsiveContainer>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
                                    {chartData.topTeachers.map((t, i) => (
                                        <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <div style={{ width: 10, height: 10, borderRadius: '50%', background: PIE_COLORS[i % PIE_COLORS.length], flexShrink: 0 }} />
                                            <span style={{ fontSize: '0.85rem', color: '#334155', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{t.name}</span>
                                            <span style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.85rem', flexShrink: 0 }}>{t.count}</span>
                                            <span style={{ fontSize: '0.72rem', color: '#94a3b8', flexShrink: 0 }}>({totalContent > 0 ? Math.round(t.count / totalContent * 100) : 0}%)</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })()}
                </div>

                {/* Top Classes Chart */}
                <div className="admin-card" style={{ padding: '24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                        <div style={{ padding: '8px', borderRadius: '10px', background: '#ecfdf5', color: '#10b981' }}>
                            <UsersRound size={20} />
                        </div>
                        <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600, color: '#0f172a' }}>Top Lớp Học (7 ngày gần nhất)</h3>
                    </div>

                    {loading ? (
                        <div style={{ padding: '40px 0', textAlign: 'center', color: '#64748b' }}>Đang tải dữ liệu...</div>
                    ) : chartData.topClasses.length === 0 ? (
                        <div style={{ padding: '40px 0', textAlign: 'center', color: '#64748b' }}>Chưa có dữ liệu lớp học</div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            {chartData.topClasses.map((item, index) => (
                                <div key={item.id}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.9rem' }}>
                                        <span style={{ fontWeight: 500, color: '#334155' }}>
                                            {index + 1}. {item.name}
                                            {item.teacherName && <span style={{ color: '#94a3b8', fontWeight: 400, fontSize: '0.82rem' }}> — {item.teacherName}</span>}
                                        </span>
                                        <span style={{ color: '#64748b' }}>
                                            {item.ratio.toFixed(1)}% ({item.count}/{item.total} HS)
                                        </span>
                                    </div>
                                    <div style={{ height: '8px', backgroundColor: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
                                        <div
                                            style={{
                                                height: '100%',
                                                width: `${item.ratio}%`,
                                                backgroundColor: '#10b981',
                                                borderRadius: '4px',
                                                transition: 'width 0.8s ease'
                                            }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* NEW CHARTS ROW */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px', marginTop: '24px' }} className="admin-charts-area">

                {/* Weekly Activity Trend */}
                <div className="admin-card" style={{ padding: '24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                        <div style={{ padding: '8px', borderRadius: '10px', background: '#eff6ff', color: '#3b82f6' }}>
                            <TrendingUp size={20} />
                        </div>
                        <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600, color: '#0f172a' }}>Xu hướng giao bài</h3>
                    </div>
                    {loading ? (
                        <div style={{ padding: '40px 0', textAlign: 'center', color: '#64748b' }}>Đang tải...</div>
                    ) : (
                        <ResponsiveContainer width="100%" height={220}>
                            <LineChart data={chartData.weeklyActivity}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
                                <Tooltip
                                    contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                                    formatter={(val, name) => [val, name === 'grammar' ? 'Kỹ năng' : name === 'exam' ? 'Bài tập' : name === 'vocab' ? 'Từ vựng' : 'Tổng']}
                                />
                                <Line type="monotone" dataKey="grammar" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 3 }} name="grammar" />
                                <Line type="monotone" dataKey="exam" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} name="exam" />
                                <Line type="monotone" dataKey="vocab" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} name="vocab" />
                            </LineChart>
                        </ResponsiveContainer>
                    )}
                </div>

                {/* User Growth */}
                <div className="admin-card" style={{ padding: '24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                        <div style={{ padding: '8px', borderRadius: '10px', background: '#f0fdf4', color: '#22c55e' }}>
                            <Users size={20} />
                        </div>
                        <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600, color: '#0f172a' }}>Người dùng hoạt động</h3>
                    </div>
                    {loading ? (
                        <div style={{ padding: '40px 0', textAlign: 'center', color: '#64748b' }}>Đang tải...</div>
                    ) : (
                        <ResponsiveContainer width="100%" height={220}>
                            <BarChart data={chartData.userGrowth}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} allowDecimals={false} />
                                <Tooltip
                                    contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                                    formatter={(val) => [val, 'Active users']}
                                />
                                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                                    {chartData.userGrowth.map((_, i) => (
                                        <Cell key={i} fill={`hsl(${142 + i * 5}, 70%, ${45 + i * 3}%)`} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    )}
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px', marginTop: '24px' }} className="admin-charts-area">

                {/* Top Giáo Viên — Tỉ lệ HV hoàn thành bài */}
                <div className="admin-card" style={{ padding: '24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                        <div style={{ padding: '8px', borderRadius: '10px', background: '#faf5ff', color: '#8b5cf6' }}>
                            <CheckCircle size={20} />
                        </div>
                        <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600, color: '#0f172a' }}>Top GV — Tỉ lệ HV hoàn thành bài</h3>
                    </div>
                    {loading ? (
                        <div style={{ padding: '40px 0', textAlign: 'center', color: '#64748b' }}>Đang tải...</div>
                    ) : chartData.teacherCompletionRank.length === 0 ? (
                        <div style={{ padding: '40px 0', textAlign: 'center', color: '#64748b' }}>Chưa có dữ liệu</div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {chartData.teacherCompletionRank.map((t, i) => (
                                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: i === 0 ? '#fbbf24' : i === 1 ? '#94a3b8' : i === 2 ? '#cd7f32' : '#e2e8f0', color: i < 3 ? '#fff' : '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700, flexShrink: 0 }}>{i + 1}</div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '4px' }}>
                                            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</span>
                                            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: t.rate >= 70 ? '#22c55e' : t.rate >= 40 ? '#f59e0b' : '#ef4444', flexShrink: 0, marginLeft: '8px' }}>{t.rate}%</span>
                                        </div>
                                        <div style={{ width: '100%', height: 6, borderRadius: 3, background: '#f1f5f9', overflow: 'hidden' }}>
                                            <div style={{ width: `${t.rate}%`, height: '100%', borderRadius: 3, background: t.rate >= 70 ? '#22c55e' : t.rate >= 40 ? '#f59e0b' : '#ef4444', transition: 'width 0.5s ease' }} />
                                        </div>
                                        <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '2px' }}>{t.completed}/{t.expected} lượt hoàn thành</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

            </div>

            {/* AI Data Analyst Chat */}
            {!isStaff && (
                <div className="admin-card" style={{ marginTop: '24px', overflow: 'hidden' }}>
                    <button
                        onClick={() => setChatOpen(!chatOpen)}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '12px', width: '100%',
                            background: 'none', border: 'none', cursor: 'pointer', padding: '0',
                            textAlign: 'left'
                        }}
                    >
                        <div style={{ padding: '8px', borderRadius: '10px', background: 'linear-gradient(135deg, #eff6ff, #eef2ff)', color: '#4f46e5', display: 'flex' }}>
                            <Bot size={20} />
                        </div>
                        <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#0f172a', flex: 1 }}>
                            AI Phân tích dữ liệu
                        </h3>
                        <span style={{ color: '#94a3b8', fontSize: '0.8rem', fontWeight: 500 }}>
                            {chatOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                        </span>
                    </button>

                    {chatOpen && (
                        <div style={{ marginTop: '16px' }}>
                            {/* Chat messages */}
                            <div style={{
                                maxHeight: '360px', overflowY: 'auto', display: 'flex', flexDirection: 'column',
                                gap: '12px', marginBottom: '14px', padding: '12px',
                                background: '#f8fafc', borderRadius: '14px', border: '1px solid #e2e8f0',
                                minHeight: chatMessages.length > 0 ? '120px' : '60px'
                            }}>
                                {chatMessages.length === 0 && (
                                    <div style={{ textAlign: 'center', padding: '16px 0', color: '#94a3b8', fontSize: '0.85rem' }}>
                                        <Bot size={28} style={{ opacity: 0.3, marginBottom: '8px' }} />
                                        <div>Hỏi bất kỳ điều gì về số liệu hệ thống</div>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', justifyContent: 'center', marginTop: '12px' }}>
                                            {['Giáo viên nào tạo nhiều bài nhất?', 'Lớp nào có tỷ lệ active cao nhất?', 'Tháng nào có nhiều HV mới nhất?'].map(q => (
                                                <button key={q} onClick={() => { setChatInput(q); }} style={{
                                                    background: 'white', border: '1px solid #e2e8f0', borderRadius: '100px',
                                                    padding: '6px 14px', fontSize: '0.78rem', color: '#475569', cursor: 'pointer',
                                                    fontWeight: 500, transition: 'all 0.2s'
                                                }}>
                                                    {q}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                {chatMessages.map((msg, i) => (
                                    <div key={i} style={{
                                        alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                                        maxWidth: '85%',
                                        background: msg.role === 'user'
                                            ? 'linear-gradient(135deg, #4f46e5, #6366f1)'
                                            : 'white',
                                        color: msg.role === 'user' ? 'white' : '#334155',
                                        padding: '10px 16px',
                                        borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                                        fontSize: '0.88rem',
                                        lineHeight: 1.6,
                                        whiteSpace: 'pre-wrap',
                                        boxShadow: msg.role === 'user' ? '0 2px 8px rgba(79,70,229,0.2)' : '0 1px 4px rgba(0,0,0,0.06)',
                                        border: msg.role === 'ai' ? '1px solid #e2e8f0' : 'none',
                                        fontWeight: msg.role === 'user' ? 500 : 400
                                    }}>
                                        {msg.text}
                                    </div>
                                ))}
                                {chatLoading && (
                                    <div style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: '8px', color: '#94a3b8', fontSize: '0.85rem', padding: '8px 14px', background: 'white', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
                                        <Loader size={14} className="animate-spin" /> AI đang phân tích...
                                    </div>
                                )}
                            </div>

                            {/* Input */}
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <input
                                    type="text"
                                    value={chatInput}
                                    onChange={e => setChatInput(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter') handleAskAI(); }}
                                    placeholder="Hỏi về số liệu hệ thống..."
                                    disabled={chatLoading}
                                    style={{
                                        flex: 1, padding: '12px 16px', border: '1.5px solid #e2e8f0', borderRadius: '12px',
                                        fontSize: '0.9rem', outline: 'none', background: 'white',
                                        transition: 'border-color 0.2s'
                                    }}
                                    onFocus={e => e.target.style.borderColor = '#818cf8'}
                                    onBlur={e => e.target.style.borderColor = '#e2e8f0'}
                                />
                                <button
                                    onClick={handleAskAI}
                                    disabled={chatLoading || !chatInput.trim()}
                                    style={{
                                        padding: '12px 18px', background: 'linear-gradient(135deg, #4f46e5, #6366f1)',
                                        color: 'white', border: 'none', borderRadius: '12px', cursor: 'pointer',
                                        display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600,
                                        fontSize: '0.88rem', opacity: (!chatInput.trim() || chatLoading) ? 0.5 : 1,
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    <Send size={16} /> Hỏi
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* System Settings Section */}
            {!isStaff && (
                <div className="admin-card admin-settings-card" style={{ position: 'relative', overflow: 'hidden', marginTop: '24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                        <div style={{ padding: '8px', borderRadius: '10px', background: '#eef2ff', color: '#6366f1', display: 'flex' }}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
                        </div>
                        <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>Cài đặt hệ thống</h3>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: '#ffffff', borderRadius: '12px' }}>
                        <div>
                            <div style={{ fontWeight: '600', color: '#0f172a', fontSize: '0.95rem' }}>Hiển thị nút Bypass (Dev Only)</div>
                            <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '2px' }}>Cho phép skip bài luyện nhanh trên màn hình học từ vựng và Kỹ năng.</div>
                        </div>
                        <label className="toggle-switch">
                            <input
                                type="checkbox"
                                checked={!!settings?.devBypassEnabled}
                                onChange={handleToggleDevBypass}
                            />
                            <span className="toggle-slider round"></span>
                        </label>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: '#ffffff', borderRadius: '12px', marginTop: '8px' }}>
                        <div>
                            <div style={{ fontWeight: '600', color: '#0f172a', fontSize: '0.95rem' }}>Bật nút AI chấm lại cho tất cả bài</div>
                            <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '2px' }}>Tạm thời hiện nút "AI chấm lại" ở mọi bài đã chấm (kể cả chưa lỗi). Dùng khi cập nhật prompt AI.</div>
                        </div>
                        <label className="toggle-switch">
                            <input
                                type="checkbox"
                                checked={!!settings?.allowRetryAiGrading}
                                onChange={handleToggleRetryAiGrading}
                            />
                            <span className="toggle-slider round"></span>
                        </label>
                    </div>

                </div>
            )}
        </div>
    );
}
