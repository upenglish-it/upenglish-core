import { useState, useEffect } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, BookOpen, Users, LogOut, Home, Menu, X, Layers, User as UserIcon, FileText, ClipboardCheck, Settings, Mail, MessageSquare, Gift, MessageSquareText, Gamepad2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../config/firebase';
import { doc, getDoc, setDoc, collection, getCountFromServer, query, where, getDocs } from 'firebase/firestore';
import { getUnreadFeedbackCount } from '../../services/feedbackService';
import { getPendingGamesCount } from '../../services/miniGameService';
import Avatar from '../../components/common/Avatar';
import BrandLogo from '../../components/common/BrandLogo';
import NotificationBell from '../../components/common/NotificationBell';
import './AdminLayout.css';

export default function AdminLayout() {
    const { pathname } = useLocation();
    const { signOut, user } = useAuth();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [teacherTitle, setTeacherTitle] = useState('');
    const [studentTitle, setStudentTitle] = useState('');
    const [customTeacher, setCustomTeacher] = useState('');
    const [customStudent, setCustomStudent] = useState('');
    const isStaff = user?.role === 'staff';
    const [sidebarCounts, setSidebarCounts] = useState(null);
    const [emailPreferences, setEmailPreferences] = useState({});
    const [unreadFeedbackCount, setUnreadFeedbackCount] = useState(0);
    const [pendingGamesCount, setPendingGamesCount] = useState(0);

    useEffect(() => {
        document.body.classList.add('admin-body');

        // Load honorific settings
        if (user?.uid) {
            const userRef = doc(db, `users/${user.uid}`);
            getDoc(userRef).then(snap => {
                if (snap.exists()) {
                    const data = snap.data();
                    if (data.teacherTitle) setTeacherTitle(data.teacherTitle);
                    if (data.studentTitle) setStudentTitle(data.studentTitle);
                    if (data.emailPreferences) setEmailPreferences(data.emailPreferences);
                }
            }).catch(err => console.warn('Could not load user settings:', err));
        }

        // Load unread feedback count
        getUnreadFeedbackCount().then(setUnreadFeedbackCount).catch(() => {});

        // Load pending mini games count
        if (!isStaff) getPendingGamesCount().then(setPendingGamesCount).catch(() => {});

        return () => {
            document.body.classList.remove('admin-body');
        };
    }, [user?.uid]);

    // Fetch sidebar counts (admin only)
    useEffect(() => {
        if (isStaff) return;
        async function fetchCounts() {
            try {
                const [topicsSnap, teacherTopicsSnap, grammarSnap, usersSnap, groupsSnap, systemExamsSnap, teacherExamsSnap] = await Promise.all([
                    getCountFromServer(collection(db, 'topics')),
                    getDocs(collection(db, 'teacher_topics')),
                    getDocs(collection(db, 'grammar_exercises')),
                    getCountFromServer(query(collection(db, 'users'), where('status', '==', 'approved'))),
                    getCountFromServer(collection(db, 'user_groups')),
                    getCountFromServer(query(collection(db, 'exams'), where('createdByRole', '==', 'admin'))),
                    getDocs(query(collection(db, 'exams'), where('createdByRole', '==', 'teacher'))),
                ]);
                let tchTopics = 0;
                teacherTopicsSnap.forEach(d => { if (!d.data().isDeleted) tchTopics++; });
                let sysGrammar = 0, tchGrammar = 0;
                grammarSnap.forEach(d => { const data = d.data(); if (data.isDeleted) return; if (data.teacherId) tchGrammar++; else sysGrammar++; });
                let tchExams = 0;
                teacherExamsSnap.forEach(d => { if (!d.data().isDeleted) tchExams++; });
                setSidebarCounts({
                    topics: topicsSnap.data().count,
                    teacherTopics: tchTopics,
                    grammar: sysGrammar,
                    teacherGrammar: tchGrammar,
                    systemExams: systemExamsSnap.data().count,
                    teacherExams: tchExams,
                    users: usersSnap.data().count,
                    groups: groupsSnap.data().count,
                });
            } catch (e) { console.warn('Sidebar counts error:', e); }
        }
        fetchCounts();
    }, []);

    const saveHonorific = async (field, value) => {
        if (field === 'teacherTitle') setTeacherTitle(value);
        else setStudentTitle(value);
        if (user?.uid) {
            try {
                const userRef = doc(db, `users/${user.uid}`);
                await setDoc(userRef, { [field]: value }, { merge: true });
            } catch (err) {
                console.warn('Could not save honorific to Firestore:', err);
            }
        }
    };

    const ADMIN_EMAIL_TYPES = [
        { key: 'accounts_expiring', label: 'Tài khoản sắp hết hạn', emoji: '⚠️' },
        { key: 'new_user_pending', label: 'User mới cần duyệt', emoji: '👤' },
        { key: 'half_submitted', label: '50% học viên đã nộp bài', emoji: '📊' },
        { key: 'content_proposal', label: 'Đề xuất nội dung từ GV', emoji: '📩' },
    ];

    const toggleEmailPref = async (key) => {
        const current = emailPreferences[key] !== false;
        const updated = { ...emailPreferences, [key]: !current };
        setEmailPreferences(updated);
        if (user?.uid) {
            try {
                await setDoc(doc(db, `users/${user.uid}`), { emailPreferences: updated }, { merge: true });
            } catch (err) {
                console.warn('Could not save email preference:', err);
            }
        }
    };

    return (
        <div className="admin-container">
            {sidebarOpen && <div className="admin-sidebar-overlay" onClick={() => setSidebarOpen(false)} />}
            <aside className={`admin-sidebar ${sidebarOpen ? 'open' : ''}`}>
                <div className="admin-sidebar-header">
                    <BrandLogo size="1.5rem" />
                </div>
                <nav className="admin-nav">
                    <Link to="/admin" className={`admin-nav-item ${pathname === '/admin' ? 'active' : ''}`} onClick={() => setSidebarOpen(false)}>
                        <LayoutDashboard size={20} /> Tổng quan
                    </Link>
                    {!isStaff && (
                        <>
                            <div className="admin-nav-group">
                                <div className="admin-nav-group-label"><BookOpen size={16} /> Bài học từ vựng</div>
                                <Link to="/admin/topics" className={`admin-nav-sub-item ${pathname.includes('/admin/topics') && !pathname.includes('/admin/teacher-topics') ? 'active' : ''}`} onClick={() => setSidebarOpen(false)}>
                                    Chính thức {sidebarCounts && <span className="admin-nav-badge">{sidebarCounts.topics}</span>}
                                </Link>
                                <Link to="/admin/teacher-topics" className={`admin-nav-sub-item ${pathname.includes('/admin/teacher-topics') ? 'active' : ''}`} onClick={() => setSidebarOpen(false)}>
                                    GV tạo {sidebarCounts && <span className="admin-nav-badge">{sidebarCounts.teacherTopics}</span>}
                                </Link>
                            </div>
                            <div className="admin-nav-group">
                                <div className="admin-nav-group-label"><FileText size={16} /> Bài học kỹ năng</div>
                                <Link to="/admin/grammar" className={`admin-nav-sub-item ${pathname.includes('/admin/grammar') && !pathname.includes('/admin/teacher-grammar') ? 'active' : ''}`} onClick={() => setSidebarOpen(false)}>
                                    Chính thức {sidebarCounts && <span className="admin-nav-badge">{sidebarCounts.grammar}</span>}
                                </Link>
                                <Link to="/admin/teacher-grammar" className={`admin-nav-sub-item ${pathname.includes('/admin/teacher-grammar') ? 'active' : ''}`} onClick={() => setSidebarOpen(false)}>
                                    GV tạo {sidebarCounts && <span className="admin-nav-badge">{sidebarCounts.teacherGrammar}</span>}
                                </Link>
                            </div>
                            <div className="admin-nav-group">
                                <div className="admin-nav-group-label"><ClipboardCheck size={16} /> Bài tập & Kiểm tra</div>
                                <Link to="/admin/exams" className={`admin-nav-sub-item ${pathname.includes('/admin/exams') && !pathname.includes('/admin/teacher-exams') ? 'active' : ''}`} onClick={() => setSidebarOpen(false)}>
                                    Chính thức {sidebarCounts && <span className="admin-nav-badge">{sidebarCounts.systemExams}</span>}
                                </Link>
                                <Link to="/admin/teacher-exams" className={`admin-nav-sub-item ${pathname.includes('/admin/teacher-exams') ? 'active' : ''}`} onClick={() => setSidebarOpen(false)}>
                                    GV tạo {sidebarCounts && <span className="admin-nav-badge">{sidebarCounts.teacherExams}</span>}
                                </Link>
                            </div>
                        </>
                    )}
                    <Link to="/admin/users" className={`admin-nav-item ${pathname.includes('/admin/users') ? 'active' : ''}`} onClick={() => setSidebarOpen(false)}>
                        <Users size={20} /> Người dùng {sidebarCounts && <span className="admin-nav-badge">{sidebarCounts.users}</span>}
                    </Link>
                    <Link to="/admin/groups" className={`admin-nav-item ${pathname.includes('/admin/groups') ? 'active' : ''}`} onClick={() => setSidebarOpen(false)}>
                        <Layers size={20} /> Nhóm học viên {sidebarCounts && <span className="admin-nav-badge">{sidebarCounts.groups}</span>}
                    </Link>
                    <Link to="/admin/reward-points" className={`admin-nav-item ${pathname.includes('/admin/reward-points') ? 'active' : ''}`} onClick={() => setSidebarOpen(false)}>
                        <Gift size={20} /> Tích điểm đổi quà
                    </Link>
                    <Link to="/admin/report-periods" className={`admin-nav-item ${pathname.includes('/admin/report-periods') ? 'active' : ''}`} onClick={() => setSidebarOpen(false)}>
                        <ClipboardCheck size={20} /> Báo cáo & Đánh giá
                    </Link>
                    <Link to="/admin/feedback" className={`admin-nav-item ${pathname.includes('/admin/feedback') ? 'active' : ''}`} onClick={() => setSidebarOpen(false)}>
                        <MessageSquareText size={20} /> Góp ý ẩn danh
                        {unreadFeedbackCount > 0 && <span className="admin-nav-badge" style={{ background: '#ef4444', color: '#fff' }}>{unreadFeedbackCount}</span>}
                    </Link>
                    {!isStaff && (
                        <Link to="/admin/prompts" className={`admin-nav-item ${pathname.includes('/admin/prompts') ? 'active' : ''}`} onClick={() => setSidebarOpen(false)}>
                            <MessageSquare size={20} /> Quản lý Prompt
                        </Link>
                    )}
                    {!isStaff && (
                        <Link to="/admin/mini-games" className={`admin-nav-item ${pathname.includes('/admin/mini-games') ? 'active' : ''}`} onClick={() => setSidebarOpen(false)}>
                            <Gamepad2 size={20} /> Mini Games
                            {pendingGamesCount > 0 && <span className="admin-nav-badge" style={{ background: '#f59e0b', color: '#78350f' }}>{pendingGamesCount}</span>}
                        </Link>
                    )}
                    <button className="admin-nav-item" onClick={() => { setIsSettingsOpen(true); setSidebarOpen(false); }}>
                        <Settings size={20} /> Thiết lập
                    </button>
                </nav>
            </aside>
            <main className="admin-main">
                <header className="admin-header">
                    <div className="admin-header-left">
                        <button className="admin-menu-btn" onClick={() => setSidebarOpen(true)}>
                            <Menu size={24} />
                        </button>
                        <div className="admin-header-user-profile">
                            <Avatar src={user?.photoURL} alt={user?.displayName} size={40} />
                            <div className="admin-header-user-details mobile-hide">
                                <div className="admin-user-name">{user?.displayName || 'Admin'}</div>
                                <span className="admin-role-badge-header" style={isStaff ? { background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.15) 0%, rgba(37, 99, 235, 0.2) 100%)', color: '#1d4ed8', border: '1px solid rgba(59, 130, 246, 0.25)', boxShadow: '0 2px 6px rgba(59, 130, 246, 0.1)' } : undefined}>{isStaff ? 'Nhân viên VP' : 'Quản trị viên'}</span>
                            </div>
                        </div>
                    </div>

                    <div style={{ flex: 1 }}></div>

                    <div className="admin-header-actions-group">
                        {!isStaff && (
                            <>
                                <NotificationBell />
                                <div className="admin-header-divider"></div>
                                <Link to="/" className="admin-header-action-btn" onClick={() => sessionStorage.setItem('viewMode', 'app')} title="Trở về App">
                                    <Home size={18} />
                                    <span className="action-text">App</span>
                                </Link>
                                <div className="admin-header-divider"></div>
                            </>
                        )}
                        {isStaff && (
                            <>
                                <NotificationBell />
                                <div className="admin-header-divider"></div>
                            </>
                        )}
                        <button onClick={signOut} className="admin-header-action-btn text-danger" title="Đăng xuất">
                            <LogOut size={18} />
                            <span className="action-text">Đăng xuất</span>
                        </button>
                    </div>
                </header>
                <div className="admin-content">
                    <Outlet />
                </div>
            </main>

            {/* Honorific Settings Modal */}
            {isSettingsOpen && (
                <div className="teacher-modal-overlay" onClick={() => setIsSettingsOpen(false)}>
                    <div className="teacher-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '720px', width: '95%' }}>
                        <div className="teacher-modal-header">
                            <h3 className="teacher-modal-title"><Settings size={24} color="#4f46e5" /> Thiết lập</h3>
                            <button className="teacher-modal-close" onClick={() => setIsSettingsOpen(false)}>
                                <X size={20} />
                            </button>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '28px' }}>
                            {/* Left column: Honorific settings */}
                            <div>
                                <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1rem', fontWeight: 700, color: '#1e293b', marginBottom: '8px' }}>
                                    <Settings size={18} color="#4f46e5" /> Xưng hô
                                </h3>
                                <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '16px', lineHeight: 1.5 }}>
                                    Chọn cách xưng hô để AI chấm bài và nhận xét đúng phong cách của bạn.
                                </p>

                                <div className="teacher-form-group" style={{ marginBottom: '20px' }}>
                                    <label className="teacher-form-label">Tự xưng {teacherTitle && <span style={{ fontSize: '0.8rem', color: '#4f46e5', fontWeight: 600 }}>({teacherTitle})</span>}</label>
                                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                        {['thầy', 'cô', 'anh', 'chị'].map(t => (
                                            <button key={t} className="teacher-btn" style={{ padding: '10px 20px', background: teacherTitle === t ? '#eff6ff' : '#f1f5f9', color: teacherTitle === t ? '#4f46e5' : '#475569', border: `2px solid ${teacherTitle === t ? '#4f46e5' : 'transparent'}`, borderRadius: '16px', fontWeight: 700 }} onClick={() => { saveHonorific('teacherTitle', t); setCustomTeacher(''); }}>
                                                {t}
                                            </button>
                                        ))}
                                    </div>
                                    <div style={{ display: 'flex', gap: '8px', marginTop: '8px', alignItems: 'center' }}>
                                        <input type="text" placeholder="Hoặc nhập khác..." value={customTeacher} onChange={e => setCustomTeacher(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && customTeacher.trim()) saveHonorific('teacherTitle', customTeacher.trim()); }} style={{ flex: 1, padding: '10px 14px', border: '1.5px solid #e2e8f0', borderRadius: '12px', fontSize: '0.9rem', outline: 'none' }} />
                                        {customTeacher.trim() && <button className="teacher-btn" style={{ padding: '10px 16px', background: '#4f46e5', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 600, cursor: 'pointer' }} onClick={() => { saveHonorific('teacherTitle', customTeacher.trim()); }}>Lưu</button>}
                                    </div>
                                </div>

                                <div className="teacher-form-group">
                                    <label className="teacher-form-label">Gọi học sinh {studentTitle && <span style={{ fontSize: '0.8rem', color: '#4f46e5', fontWeight: 600 }}>({studentTitle})</span>}</label>
                                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                        {['em', 'con', 'bạn'].map(t => (
                                            <button key={t} className="teacher-btn" style={{ padding: '10px 20px', background: studentTitle === t ? '#eff6ff' : '#f1f5f9', color: studentTitle === t ? '#4f46e5' : '#475569', border: `2px solid ${studentTitle === t ? '#4f46e5' : 'transparent'}`, borderRadius: '16px', fontWeight: 700 }} onClick={() => { saveHonorific('studentTitle', t); setCustomStudent(''); }}>
                                                {t}
                                            </button>
                                        ))}
                                    </div>
                                    <div style={{ display: 'flex', gap: '8px', marginTop: '8px', alignItems: 'center' }}>
                                        <input type="text" placeholder="Hoặc nhập khác..." value={customStudent} onChange={e => setCustomStudent(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && customStudent.trim()) saveHonorific('studentTitle', customStudent.trim()); }} style={{ flex: 1, padding: '10px 14px', border: '1.5px solid #e2e8f0', borderRadius: '12px', fontSize: '0.9rem', outline: 'none' }} />
                                        {customStudent.trim() && <button className="teacher-btn" style={{ padding: '10px 16px', background: '#4f46e5', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 600, cursor: 'pointer' }} onClick={() => { saveHonorific('studentTitle', customStudent.trim()); }}>Lưu</button>}
                                    </div>
                                </div>
                            </div>

                            {/* Right column: Email preferences */}
                            <div>
                                <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1rem', fontWeight: 700, color: '#1e293b', marginBottom: '8px' }}>
                                    <Mail size={18} color="#4f46e5" /> Thông báo qua email
                                </h3>
                                <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '16px', lineHeight: 1.5 }}>
                                    Tắt/bật email cho từng loại. In-app không bị ảnh hưởng.
                                </p>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {ADMIN_EMAIL_TYPES.map(({ key, label, emoji }) => {
                                        const isOn = emailPreferences[key] !== false;
                                        return (
                                            <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: isOn ? '#f0fdf4' : '#f8fafc', borderRadius: '12px', border: `1.5px solid ${isOn ? '#bbf7d0' : '#e2e8f0'}`, cursor: 'pointer', transition: 'all 0.2s' }} onClick={() => toggleEmailPref(key)}>
                                                <span style={{ fontSize: '0.88rem', color: '#334155', fontWeight: 500 }}>{emoji} {label}</span>
                                                <div style={{ width: '44px', height: '24px', borderRadius: '12px', background: isOn ? '#22c55e' : '#cbd5e1', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
                                                    <div style={{ width: '20px', height: '20px', borderRadius: '10px', background: '#fff', position: 'absolute', top: '2px', left: isOn ? '22px' : '2px', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div >
    );
}
