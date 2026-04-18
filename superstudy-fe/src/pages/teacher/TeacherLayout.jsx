import { useState, useEffect } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, LogOut, Home, Menu, Layers, BookOpen, ClipboardCheck, Settings, X, Mail, MessageSquare, Star, Gift, MessageSquareText, Gamepad2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { usersService } from '../../models';
import { getMyUnreadFeedbackCount } from '../../services/feedbackService';
import Avatar from '../../components/common/Avatar';
import BrandLogo from '../../components/common/BrandLogo';
import NotificationBell from '../../components/common/NotificationBell';
import logo from '../../assets/logo.png';
import '../admin/AdminLayout.css'; // Reusing admin styling for teacher portal
import './TeacherLayout.css';

export default function TeacherLayout() {
    const { pathname } = useLocation();
    const { signOut, user } = useAuth();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [teacherTitle, setTeacherTitle] = useState('');
    const [studentTitle, setStudentTitle] = useState('');
    const [customTeacher, setCustomTeacher] = useState('');
    const [customStudent, setCustomStudent] = useState('');
    const [emailPreferences, setEmailPreferences] = useState({});
    const [hasRewardGroups, setHasRewardGroups] = useState(false);
    const [receivedUnread, setReceivedUnread] = useState(0);

    useEffect(() => {
        if (!user?.uid) return;
        getMyUnreadFeedbackCount(user.uid).then(setReceivedUnread).catch(() => {});
        usersService.findOne(user.uid).then(async result => {
            const data = result?.data || result;
            if (data) {
                if (data.teacherTitle) setTeacherTitle(data.teacherTitle);
                if (data.studentTitle) setStudentTitle(data.studentTitle);
                if (data.emailPreferences) setEmailPreferences(data.emailPreferences);
                // Check if teacher has any groups with reward points enabled
                const groupIds = data.groupIds || user.groupIds || [];
                if (groupIds.length > 0) {
                    try {
                        const { getTeacherGroups } = await import('../../services/teacherService');
                        const groups = await getTeacherGroups(groupIds);
                        setHasRewardGroups(groups.some(g => g.enableRewardPoints));
                    } catch (e) {
                        console.warn('Could not check reward groups:', e);
                    }
                } else {
                    setHasRewardGroups(false);
                }
            }
        }).catch(err => console.warn('Could not load user settings via API:', err));
    }, [user?.uid, user?.groupIds]);

    const saveHonorific = async (field, value) => {
        if (field === 'teacherTitle') setTeacherTitle(value);
        else setStudentTitle(value);
        if (user?.uid) {
            try {
                await usersService.update(user.uid, { [field]: value });
            } catch (err) {
                console.warn('Could not save honorific to API:', err);
            }
        }
    };

    const TEACHER_EMAIL_TYPES = [
        { key: 'deadline_expired', label: 'Bài hết hạn — cần chấm', emoji: '⏰' },
        { key: 'skill_report_reminder', label: 'Nhắc viết báo cáo kỹ năng', emoji: '📊' },
        { key: 'student_joined', label: 'Học viên mới vào lớp', emoji: '👤' },
        { key: 'exam_graded_by_other', label: 'Bài được GV khác chấm', emoji: '📝' },
        { key: 'student_periodic_rating', label: 'Kết quả đánh giá theo kỳ', emoji: '⭐' },
        { key: 'collab', label: 'Cộng tác', emoji: '🤝' },
        { key: 'content_proposal', label: 'Đề xuất nội dung', emoji: '📩' },
    ];

    const toggleEmailPref = async (key) => {
        const current = emailPreferences[key] !== false; // default true
        const updated = { ...emailPreferences, [key]: !current };
        setEmailPreferences(updated);
        if (user?.uid) {
            try {
                await usersService.update(user.uid, { emailPreferences: updated });
            } catch (err) {
                console.warn('Could not save email preference to API:', err);
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
                    <Link to="/teacher" className={`admin-nav-item ${pathname === '/teacher' ? 'active' : ''}`} onClick={() => setSidebarOpen(false)}>
                        <LayoutDashboard size={20} /> Tổng quan
                    </Link>
                    <Link to="/teacher/groups" className={`admin-nav-item ${pathname.includes('/teacher/groups') ? 'active' : ''}`} onClick={() => setSidebarOpen(false)}>
                        <Users size={20} /> Lớp học của tôi
                    </Link>
                    <Link to="/teacher/topics" className={`admin-nav-item ${pathname.includes('/teacher/topics') ? 'active' : ''}`} onClick={() => setSidebarOpen(false)}>
                        <Layers size={20} /> Bài học từ vựng
                    </Link>
                    <Link to="/teacher/grammar" className={`admin-nav-item ${pathname.includes('/teacher/grammar') && !pathname.includes('/teacher/grammar-') ? 'active' : ''}`} onClick={() => setSidebarOpen(false)}>
                        <BookOpen size={20} /> Bài học Kỹ năng
                    </Link>
                    <Link to="/teacher/exams" className={`admin-nav-item ${pathname.includes('/teacher/exams') || pathname.includes('/teacher/system-exams') || pathname.includes('/teacher/exam-submissions') ? 'active' : ''}`} onClick={() => setSidebarOpen(false)}>
                        <ClipboardCheck size={20} /> Bài tập và Kiểm tra
                    </Link>
                    <Link to="/teacher/prompts" className={`admin-nav-item ${pathname.includes('/teacher/prompts') ? 'active' : ''}`} onClick={() => setSidebarOpen(false)}>
                        <MessageSquare size={20} /> Quản lý prompt
                    </Link>
                    <Link to="/teacher/ratings" className={`admin-nav-item ${pathname.includes('/teacher/ratings') ? 'active' : ''}`} onClick={() => setSidebarOpen(false)}>
                        <Star size={20} /> Đánh giá của tôi
                    </Link>
                    {hasRewardGroups && (
                        <Link to="/teacher/reward-points" className={`admin-nav-item ${pathname.includes('/teacher/reward-points') ? 'active' : ''}`} onClick={() => setSidebarOpen(false)}>
                            <Gift size={20} /> Tích điểm đổi quà
                        </Link>
                    )}
                    <Link to="/teacher/feedback" className={`admin-nav-item ${pathname.includes('/teacher/feedback') ? 'active' : ''}`} onClick={() => setSidebarOpen(false)}>
                        <MessageSquareText size={20} /> Góp ý ẩn danh
                        {receivedUnread > 0 && <span style={{ fontSize: '0.68rem', fontWeight: 700, background: '#ef4444', color: '#fff', borderRadius: '100px', padding: '1px 7px', marginLeft: 'auto' }}>{receivedUnread}</span>}
                    </Link>
                    <Link to="/teacher/mini-games" className={`admin-nav-item ${pathname.includes('/teacher/mini-games') ? 'active' : ''}`} onClick={() => setSidebarOpen(false)}>
                        <Gamepad2 size={20} /> Mini Games
                    </Link>
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
                                <div className="admin-user-name">{user?.displayName || 'Giáo viên'}</div>
                                <span className="admin-role-badge-header" style={{ background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.15) 0%, rgba(217, 119, 6, 0.2) 100%)', color: '#b45309', border: '1px solid rgba(245, 158, 11, 0.25)', boxShadow: '0 2px 6px rgba(245, 158, 11, 0.1)' }}>Giáo viên</span>
                            </div>
                        </div>
                    </div>

                    <div style={{ flex: 1 }}></div>

                    <div className="admin-header-right">
                        <div className="admin-header-actions-group">
                            <NotificationBell />
                            <div className="admin-header-divider"></div>

                            <Link to="/" className="admin-header-action-btn" onClick={() => sessionStorage.setItem('viewMode', 'app')} title="Trở về App">
                                <Home size={18} />
                                <span className="action-text">App</span>
                            </Link>
                            <div className="admin-header-divider"></div>
                            <button onClick={signOut} className="admin-header-action-btn text-danger" title="Đăng xuất">
                                <LogOut size={18} />
                                <span className="action-text">Đăng xuất</span>
                            </button>
                        </div>
                    </div>
                </header>
                <div className="admin-content">
                    <Outlet />
                </div>
            </main>

            {isSettingsOpen && (
                <div className="teacher-modal-overlay" onClick={() => setIsSettingsOpen(false)}>
                    <div className="teacher-modal wide" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '720px', width: '95%' }}>
                        <div style={{ position: 'sticky', top: '0px', zIndex: 100, display: 'flex', justifyContent: 'flex-end', height: 0, overflow: 'visible', pointerEvents: 'none' }}>
                            <button className="teacher-modal-close" onClick={() => setIsSettingsOpen(false)} style={{ pointerEvents: 'auto', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, background: 'rgba(241, 245, 249, 0.95)', backdropFilter: 'blur(4px)', border: 'none', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
                                <X size={20} />
                            </button>
                        </div>
                        <h2 className="admin-modal-title" style={{ justifyContent: 'flex-start', marginBottom: '24px', paddingRight: '40px' }}>
                            <Settings size={24} color="#4f46e5" /> Thiết lập
                        </h2>

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
                                    {TEACHER_EMAIL_TYPES.map(({ key, label, emoji }) => {
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

        </div>
    );
}
