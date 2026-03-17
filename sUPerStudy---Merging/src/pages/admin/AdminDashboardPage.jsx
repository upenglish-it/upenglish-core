import React, { useState, useEffect } from 'react';
import { db } from '../../config/firebase';
import { collection, getDocs, getCountFromServer, query, where, collectionGroup } from 'firebase/firestore';
import { useAppSettings } from '../../contexts/AppSettingsContext';
import { useAuth } from '../../contexts/AuthContext';
import { updateAppSettings } from '../../services/appSettingsService';
import { Users, UsersRound, Award, TrendingUp, CheckCircle, UserPlus, AlertTriangle, Send, Loader, Bot, ChevronDown, ChevronUp } from 'lucide-react';
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
        assignmentCompletion: { submitted: 0, overdue: 0, pending: 0, notStarted: 0 },
        weakestSkills: []
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
                // Get counts for each collection
                const usersSnap = await getDocs(collection(db, 'users'));
                const usersList = usersSnap.docs.map(doc => ({ uid: doc.id, ...doc.data() }));
                const approvedUsersCount = usersList.filter(u => u.status === 'approved').length;

                const [
                    topicsCountSnap,
                    grammarDocsSnap,
                    grammarSubSnap,
                    examSubSnap,
                    wordProgressSnap,
                    systemExamsCountSnap,
                    teacherTopicsSnap,
                    teacherExamsSnap,
                    groupsSnap,
                    examAssignmentsSnap,
                    grammarAssignmentsSnap
                ] = await Promise.all([
                    getCountFromServer(collection(db, 'topics')),
                    getDocs(collection(db, 'grammar_exercises')),
                    getDocs(collection(db, 'grammar_submissions')),
                    getDocs(collection(db, 'exam_submissions')),
                    getDocs(collectionGroup(db, 'word_progress')),
                    getCountFromServer(query(collection(db, 'exams'), where('createdByRole', '==', 'admin'))),
                    getDocs(collection(db, 'teacher_topics')),
                    getDocs(query(collection(db, 'exams'), where('createdByRole', '==', 'teacher'))),
                    getDocs(collection(db, 'user_groups')),
                    getDocs(collection(db, 'exam_assignments')),
                    getDocs(collection(db, 'grammar_assignments')),
                ]);

                // Aggregate Teacher Data
                const teacherContentCount = {};
                const processTeacherDocs = (snap, isArray = false) => {
                    snap.forEach(docSnap => {
                        const data = isArray ? docSnap : docSnap.data();
                        const tid = data.teacherId || data.createdBy;
                        if (tid) {
                            teacherContentCount[tid] = (teacherContentCount[tid] || 0) + 1;
                        }
                    });
                };

                let systemGrammarCount = 0;
                let teacherGrammarCount = 0;
                const teacherGrammarData = [];

                grammarDocsSnap.forEach(docSnap => {
                    const data = docSnap.data();
                    if (data.teacherId) {
                        teacherGrammarCount++;
                        teacherGrammarData.push(data);
                    } else {
                        systemGrammarCount++;
                    }
                });

                processTeacherDocs(teacherTopicsSnap);
                processTeacherDocs(teacherGrammarData, true);
                processTeacherDocs(teacherExamsSnap);

                const topTeachers = Object.entries(teacherContentCount)
                    .map(([uid, count]) => {
                        const user = usersList.find(u => u.uid === uid);
                        return {
                            id: uid,
                            name: user?.displayName || user?.email || 'Giáo viên ẩn danh',
                            count
                        };
                    })
                    .sort((a, b) => b.count - a.count)
                    .slice(0, 5);

                const groupDocs = [];
                groupsSnap.forEach(docSnap => {
                    const data = { id: docSnap.id, ...docSnap.data() };
                    if (!data.isHidden) groupDocs.push(data);
                });

                // Build sets for filtering by visible groups
                const visibleGroupIds = new Set(groupDocs.map(g => g.id));
                const visibleStudentIds = new Set(
                    usersList.filter(u => u.role === 'user' && (u.groupIds || []).some(gid => visibleGroupIds.has(gid))).map(u => u.uid)
                );

                // Aggregate Student Activity for Groups
                const activeStudentIds = new Set();
                grammarSubSnap.forEach(docSnap => activeStudentIds.add(docSnap.data().studentId));
                examSubSnap.forEach(docSnap => activeStudentIds.add(docSnap.data().studentId));
                wordProgressSnap.forEach(docSnap => {
                    // Extract studentId from the path: users/{studentId}/word_progress/{wordId}
                    const pathParts = docSnap.ref.path.split('/');
                    if (pathParts.length >= 2) activeStudentIds.add(pathParts[1]);
                });

                const topClasses = groupDocs
                    .map(group => {
                        const totalStudents = usersList.filter(u =>
                            u.role === 'user' && (u.groupIds || []).includes(group.id)
                        ).length;

                        const teacherUser = usersList.find(u => u.uid === (group.teacherId || group.createdBy))
                            || usersList.find(u => u.role === 'teacher' && (u.groupIds || []).includes(group.id));
                        const teacherName = teacherUser?.displayName || teacherUser?.email || '';

                        if (totalStudents === 0) return { id: group.id, name: group.name, teacherName, count: 0, total: 0, ratio: 0 };

                        const activeStudents = usersList.filter(u =>
                            u.role === 'user' &&
                            (u.groupIds || []).includes(group.id) &&
                            activeStudentIds.has(u.uid)
                        ).length;

                        return {
                            id: group.id,
                            name: group.name,
                            teacherName,
                            count: activeStudents,
                            total: totalStudents,
                            ratio: (activeStudents / totalStudents) * 100
                        };
                    })
                    .filter(c => c.total > 0)
                    .sort((a, b) => b.ratio - a.ratio || b.total - a.total)
                    .slice(0, 5);

                // === NEW CHARTS DATA ===

                // 1. Weekly Activity Trend (last 8 weeks)
                const now = Date.now();
                const weekMs = 7 * 24 * 60 * 60 * 1000;
                const weeklyBuckets = Array.from({ length: 8 }, (_, i) => {
                    const weekStart = now - (7 - i) * weekMs;
                    const d = new Date(weekStart);
                    return { label: `${d.getDate()}/${d.getMonth() + 1}`, grammar: 0, exam: 0, total: 0 };
                });
                const getTs = (doc) => {
                    const d = doc.data();
                    return d.createdAt?.toMillis ? d.createdAt.toMillis() : (d.createdAt?.seconds ? d.createdAt.seconds * 1000 : 0);
                };
                grammarSubSnap.forEach(d => {
                    const data = d.data();
                    if (!visibleStudentIds.has(data.studentId)) return;
                    const ts = getTs(d);
                    const weekIdx = Math.floor((ts - (now - 8 * weekMs)) / weekMs);
                    if (weekIdx >= 0 && weekIdx < 8) { weeklyBuckets[weekIdx].grammar++; weeklyBuckets[weekIdx].total++; }
                });
                examSubSnap.forEach(d => {
                    const data = d.data();
                    if (!visibleStudentIds.has(data.studentId)) return;
                    const ts = getTs(d);
                    const weekIdx = Math.floor((ts - (now - 8 * weekMs)) / weekMs);
                    if (weekIdx >= 0 && weekIdx < 8) { weeklyBuckets[weekIdx].exam++; weeklyBuckets[weekIdx].total++; }
                });

                // 2. User Growth (last 6 months)
                const monthBuckets = Array.from({ length: 6 }, (_, i) => {
                    const d = new Date();
                    d.setMonth(d.getMonth() - (5 - i));
                    return { label: `T${d.getMonth() + 1}/${d.getFullYear().toString().slice(2)}`, count: 0 };
                });
                usersList.forEach(u => {
                    const ts = u.createdAt?.toMillis ? u.createdAt.toMillis() : (u.createdAt?.seconds ? u.createdAt.seconds * 1000 : 0);
                    if (!ts) return;
                    const d = new Date(ts);
                    const key = `T${d.getMonth() + 1}/${d.getFullYear().toString().slice(2)}`;
                    const bucket = monthBuckets.find(b => b.label === key);
                    if (bucket) bucket.count++;
                });

                // 3. Assignment Completion Rate (exam + grammar)
                let submitted = 0, overdue = 0, pending = 0;
                examSubSnap.forEach(d => {
                    const data = d.data();
                    if (!visibleStudentIds.has(data.studentId)) return;
                    if (data.status === 'graded' || data.status === 'released' || data.status === 'submitted') submitted++;
                    else if (data.status === 'overdue') overdue++;
                    else pending++;
                });
                // Count grammar submissions as completed (visible students only)
                grammarSubSnap.forEach(d => {
                    const data = d.data();
                    if (visibleStudentIds.has(data.studentId)) submitted++;
                });

                // Calculate expected submissions to find "not started"
                let totalExpected = 0;
                examAssignmentsSnap.forEach(d => {
                    const data = d.data();
                    if (data.isDeleted) return;
                    if (data.targetType === 'group') {
                        if (!visibleGroupIds.has(data.targetId)) return;
                        const groupStudents = usersList.filter(u =>
                            u.role === 'user' && (u.groupIds || []).includes(data.targetId)
                        ).length;
                        totalExpected += groupStudents;
                    } else {
                        totalExpected += 1;
                    }
                });
                grammarAssignmentsSnap.forEach(d => {
                    const data = d.data();
                    if (data.groupId && !visibleGroupIds.has(data.groupId)) return;
                    if (data.groupId) {
                        const groupStudents = usersList.filter(u =>
                            u.role === 'user' && (u.groupIds || []).includes(data.groupId)
                        ).length;
                        totalExpected += groupStudents;
                    }
                });
                const totalActual = submitted + overdue + pending;
                const notStarted = Math.max(0, totalExpected - totalActual);

                // 4. Weakest Skills (from error categories in exam submissions)
                const errorCatCounts = {};
                const errorCatCorrect = {};
                examSubSnap.forEach(d => {
                    const data = d.data();
                    if (!visibleStudentIds.has(data.studentId)) return;
                    if (data.answers && Array.isArray(data.answers)) {
                        data.answers.forEach(a => {
                            const cat = a.errorCategory || 'other';
                            errorCatCounts[cat] = (errorCatCounts[cat] || 0) + 1;
                            if (a.isCorrect) errorCatCorrect[cat] = (errorCatCorrect[cat] || 0) + 1;
                        });
                    }
                });
                const ERROR_LABELS = {
                    verb_tense: 'Thì động từ', article: 'Mạo từ', preposition: 'Giới từ', word_form: 'Dạng từ',
                    subject_verb_agreement: 'Chủ-vị', pronoun: 'Đại từ', conjunction: 'Liên từ', comparison: 'So sánh',
                    passive_voice: 'Bị động', conditional: 'Điều kiện', modal_verb: 'Động từ KK', relative_clause: 'MĐ quan hệ',
                    gerund_infinitive: 'V-ing/To V', quantifier: 'Lượng từ', writing_structure: 'Cấu trúc viết',
                    fluency: 'Lưu loát', vocabulary_usage: 'Dùng từ', vocabulary_meaning: 'Nghĩa từ', other: 'Khác'
                };
                const weakestSkills = Object.entries(errorCatCounts)
                    .filter(([, count]) => count >= 3)
                    .map(([cat, count]) => ({
                        name: ERROR_LABELS[cat] || cat,
                        accuracy: Math.round(((errorCatCorrect[cat] || 0) / count) * 100),
                        total: count
                    }))
                    .sort((a, b) => a.accuracy - b.accuracy)
                    .slice(0, 6);

                setChartData({
                    topTeachers,
                    topClasses,
                    weeklyActivity: weeklyBuckets,
                    userGrowth: monthBuckets,
                    assignmentCompletion: { submitted, overdue, pending, notStarted },
                    weakestSkills
                });

                setStats({
                    users: approvedUsersCount,
                    groups: groupsSnap.size,
                    topics: topicsCountSnap.data().count,
                    teacherTopics: teacherTopicsSnap.size,
                    grammarExercises: systemGrammarCount,
                    teacherGrammarExercises: teacherGrammarCount,
                    systemExams: systemExamsCountSnap.data().count,
                    teacherExams: teacherExamsSnap.size
                });

                // Cache raw data for AI chat
                rawDataRef.current = { usersList, grammarSubSnap, examSubSnap, groupDocs, topTeachers, topClasses, teacherContentCount, visibleStudentIds, visibleGroupIds };
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
        if (!rawDataRef.current) return 'Dữ liệu chưa sẵn sàng.';
        const { usersList, grammarSubSnap, examSubSnap, groupDocs, topTeachers, topClasses, teacherContentCount, visibleStudentIds, visibleGroupIds } = rawDataRef.current;

        const teachers = usersList.filter(u => u.role === 'teacher');
        const students = usersList.filter(u => u.role === 'user' && u.status === 'approved' && visibleStudentIds.has(u.uid));
        let s = `=== DỮ LIỆU HỆ THỐNG - CHỈ CÁC LỚP ĐANG HOẠT ĐỘNG (${new Date().toLocaleDateString('vi-VN')}) ===\n`;
        s += `Giáo viên: ${teachers.length}, Học viên (lớp đang hoạt động): ${students.length}, Nhóm đang hoạt động: ${groupDocs.length}\n\n`;

        s += `--- GIÁO VIÊN ---\n`;
        teachers.forEach(t => {
            const groups = groupDocs.filter(g => g.teacherId === t.uid || g.createdBy === t.uid);
            const content = teacherContentCount[t.uid] || 0;
            s += `• ${t.displayName || t.email} | Nhóm: ${groups.map(g => g.name).join(', ') || 'không'} | Bài tạo: ${content}\n`;
        });

        s += `\n--- THỐNG KÊ BÀI NỘP THEO GIÁO VIÊN (lớp đang hoạt động) ---\n`;
        const teacherExamStats = {};
        examSubSnap.forEach(d => {
            const data = d.data();
            if (!visibleStudentIds.has(data.studentId)) return;
            const tid = data.teacherId || data.assignedBy;
            if (!tid) return;
            if (!teacherExamStats[tid]) teacherExamStats[tid] = { total: 0, onTime: 0, overdue: 0, totalScore: 0, scored: 0 };
            teacherExamStats[tid].total++;
            if (data.status === 'overdue') teacherExamStats[tid].overdue++;
            else teacherExamStats[tid].onTime++;
            if (data.score != null) { teacherExamStats[tid].totalScore += data.score; teacherExamStats[tid].scored++; }
        });
        Object.entries(teacherExamStats).forEach(([tid, st]) => {
            const t = usersList.find(u => u.uid === tid);
            const avg = st.scored > 0 ? (st.totalScore / st.scored).toFixed(1) : 'N/A';
            s += `• ${t?.displayName || tid} | Tổng bài nộp: ${st.total} | Đúng hạn: ${st.onTime} (${st.total > 0 ? Math.round(st.onTime / st.total * 100) : 0}%) | Quá hạn: ${st.overdue} | Điểm TB: ${avg}\n`;
        });

        s += `\n--- NHÓM HỌC ---\n`;
        groupDocs.forEach(g => {
            const members = students.filter(u => (u.groupIds || []).includes(g.id));
            s += `• ${g.name} | Sĩ số: ${members.length} | GV: ${usersList.find(u => u.uid === (g.teacherId || g.createdBy))?.displayName || 'N/A'}\n`;
        });

        const errorCats = {};
        const errorCorrect = {};
        examSubSnap.forEach(d => {
            const data = d.data();
            if (!visibleStudentIds.has(data.studentId)) return;
            if (data.answers && Array.isArray(data.answers)) {
                data.answers.forEach(a => {
                    const cat = a.errorCategory || 'other';
                    errorCats[cat] = (errorCats[cat] || 0) + 1;
                    if (a.isCorrect) errorCorrect[cat] = (errorCorrect[cat] || 0) + 1;
                });
            }
        });
        if (Object.keys(errorCats).length > 0) {
            s += `\n--- PHÂN LOẠI LỖI ---\n`;
            Object.entries(errorCats).sort((a, b) => b[1] - a[1]).forEach(([cat, count]) => {
                const acc = Math.round(((errorCorrect[cat] || 0) / count) * 100);
                s += `• ${cat}: ${count} câu, ${acc}% đúng\n`;
            });
        }

        s += `\n--- TOP GIÁO VIÊN (nội dung) ---\n`;
        topTeachers.forEach((t, i) => { s += `${i + 1}. ${t.name}: ${t.count} bài\n`; });
        s += `\n--- TOP LỚP (năng động) ---\n`;
        topClasses.forEach((c, i) => { s += `${i + 1}. ${c.name}: ${c.ratio.toFixed(1)}% active (${c.count}/${c.total})\n`; });

        return s;
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
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            {chartData.topTeachers.map((teacher, index) => {
                                const maxCount = Math.max(...chartData.topTeachers.map(t => t.count), 1);
                                const percentage = Math.round((teacher.count / maxCount) * 100);

                                return (
                                    <div key={teacher.id}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '0.9rem', fontWeight: 500, color: '#334155' }}>
                                            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <span style={{ color: '#94a3b8', fontSize: '0.8rem', fontWeight: 600 }}>#{index + 1}</span>
                                                {teacher.name}
                                            </span>
                                            <span style={{ fontWeight: 600, color: '#0f172a' }}>{teacher.count} bài</span>
                                        </div>
                                        <div style={{ width: '100%', height: '10px', background: '#f1f5f9', borderRadius: '5px', overflow: 'hidden' }}>
                                            <div
                                                style={{
                                                    height: '100%',
                                                    width: `${percentage}%`,
                                                    background: 'linear-gradient(90deg, #d946ef 0%, #c026d3 100%)',
                                                    borderRadius: '5px',
                                                    transition: 'width 1s ease-out'
                                                }}
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Top Classes Chart */}
                <div className="admin-card" style={{ padding: '24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                        <div style={{ padding: '8px', borderRadius: '10px', background: '#ecfdf5', color: '#10b981' }}>
                            <UsersRound size={20} />
                        </div>
                        <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600, color: '#0f172a' }}>Top Lớp Học (Năng động)</h3>
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
                        <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600, color: '#0f172a' }}>Xu hướng hoạt động (8 tuần)</h3>
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
                                    formatter={(val, name) => [val, name === 'grammar' ? 'Kỹ năng' : name === 'exam' ? 'Bài tập' : 'Tổng']}
                                />
                                <Line type="monotone" dataKey="grammar" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 3 }} name="grammar" />
                                <Line type="monotone" dataKey="exam" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} name="exam" />
                            </LineChart>
                        </ResponsiveContainer>
                    )}
                </div>

                {/* User Growth */}
                <div className="admin-card" style={{ padding: '24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                        <div style={{ padding: '8px', borderRadius: '10px', background: '#f0fdf4', color: '#22c55e' }}>
                            <UserPlus size={20} />
                        </div>
                        <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600, color: '#0f172a' }}>Tăng trưởng người dùng (6 tháng)</h3>
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
                                    formatter={(val) => [val, 'Đăng ký mới']}
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

                {/* Assignment Completion Rate */}
                <div className="admin-card" style={{ padding: '24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                        <div style={{ padding: '8px', borderRadius: '10px', background: '#faf5ff', color: '#8b5cf6' }}>
                            <CheckCircle size={20} />
                        </div>
                        <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600, color: '#0f172a' }}>Tỷ lệ hoàn thành bài được giao</h3>
                    </div>
                    {loading ? (
                        <div style={{ padding: '40px 0', textAlign: 'center', color: '#64748b' }}>Đang tải...</div>
                    ) : (() => {
                        const { submitted, overdue, pending, notStarted } = chartData.assignmentCompletion;
                        const total = submitted + overdue + pending + notStarted;
                        if (total === 0) return <div style={{ padding: '40px 0', textAlign: 'center', color: '#64748b' }}>Chưa có dữ liệu</div>;
                        const pieData = [
                            { name: 'Hoàn thành', value: submitted, color: '#22c55e' },
                            { name: 'Quá hạn', value: overdue, color: '#f97316' },
                            { name: 'Đang làm', value: pending, color: '#94a3b8' },
                            { name: 'Chưa làm', value: notStarted, color: '#cbd5e1' }
                        ].filter(d => d.value > 0);
                        return (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                                <ResponsiveContainer width={160} height={160}>
                                    <PieChart>
                                        <Pie data={pieData} dataKey="value" cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={3}>
                                            {pieData.map((d, i) => <Cell key={i} fill={d.color} />)}
                                        </Pie>
                                        <Tooltip formatter={(val, name) => [val, name]} contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0' }} />
                                    </PieChart>
                                </ResponsiveContainer>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1 }}>
                                    {pieData.map(d => (
                                        <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <div style={{ width: 12, height: 12, borderRadius: '50%', background: d.color, flexShrink: 0 }} />
                                            <span style={{ fontSize: '0.85rem', color: '#475569', fontWeight: 500 }}>{d.name}</span>
                                            <span style={{ marginLeft: 'auto', fontWeight: 700, color: '#0f172a', fontSize: '0.9rem' }}>{d.value}</span>
                                            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>({Math.round(d.value / total * 100)}%)</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })()}
                </div>

                {/* Weakest Skills */}
                <div className="admin-card" style={{ padding: '24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                        <div style={{ padding: '8px', borderRadius: '10px', background: '#fff7ed', color: '#f97316' }}>
                            <AlertTriangle size={20} />
                        </div>
                        <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600, color: '#0f172a' }}>Kỹ năng yếu nhất hệ thống</h3>
                    </div>
                    {loading ? (
                        <div style={{ padding: '40px 0', textAlign: 'center', color: '#64748b' }}>Đang tải...</div>
                    ) : chartData.weakestSkills.length === 0 ? (
                        <div style={{ padding: '40px 0', textAlign: 'center', color: '#64748b' }}>Chưa đủ dữ liệu phân loại lỗi</div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                            {chartData.weakestSkills.map(skill => (
                                <div key={skill.name}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px', fontSize: '0.85rem' }}>
                                        <span style={{ fontWeight: 600, color: '#334155' }}>{skill.name}</span>
                                        <span style={{ color: skill.accuracy < 40 ? '#ef4444' : skill.accuracy < 60 ? '#f97316' : '#22c55e', fontWeight: 700 }}>
                                            {skill.accuracy}% đúng
                                        </span>
                                    </div>
                                    <div style={{ width: '100%', height: '8px', background: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
                                        <div style={{
                                            height: '100%',
                                            width: `${skill.accuracy}%`,
                                            background: skill.accuracy < 40 ? '#ef4444' : skill.accuracy < 60 ? '#f97316' : '#22c55e',
                                            borderRadius: '4px',
                                            transition: 'width 0.8s ease'
                                        }} />
                                    </div>
                                    <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '2px' }}>{skill.total} lần làm</div>
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
