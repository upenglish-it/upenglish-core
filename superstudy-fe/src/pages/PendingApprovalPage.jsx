import { useAuth } from '../contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { Clock, LogOut, ShieldAlert, BookOpen, Sparkles } from 'lucide-react';
import Avatar from '../components/common/Avatar';
import './LoginPage.css';
import BrandLogo from '../components/common/BrandLogo';

export default function PendingApprovalPage() {
    const { user, signOut, isExpired } = useAuth();

    // Not logged in → redirect to login
    if (!user) {
        return <Navigate to="/login" replace />;
    }

    // Already approved and not expired → redirect home
    if (user.status === 'approved' && !isExpired()) {
        if (user.role === 'admin' || user.role === 'staff') return <Navigate to="/admin" replace />;
        return <Navigate to="/" replace />;
    }

    const expired = user.status === 'approved' && isExpired();

    return (
        <div className="login-page">
            <div className="login-bg-orb login-bg-orb--1" />
            <div className="login-bg-orb login-bg-orb--2" />
            <div className="login-bg-orb login-bg-orb--3" />

            <div className="login-container animate-slide-up">
                <div className="login-header text-center">
                    <div className="login-logo">
                        <BookOpen size={28} className="login-logo-icon" />
                        <Sparkles size={16} className="login-logo-sparkle" />
                    </div>
                    <div className="login-title">
                        <BrandLogo size="2.5rem" />
                    </div>
                    <p className="login-subtitle">Vui lòng chờ phê duyệt</p>
                </div>
                <div style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                    gap: '16px', textAlign: 'center', padding: '24px 0'
                }}>
                    <div style={{
                        width: '72px', height: '72px', borderRadius: '50%',
                        background: expired
                            ? 'linear-gradient(135deg, #fbbf24, #f59e0b)'
                            : 'linear-gradient(135deg, #60a5fa, #3b82f6)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        boxShadow: expired
                            ? '0 8px 32px rgba(245, 158, 11, 0.3)'
                            : '0 8px 32px rgba(59, 130, 246, 0.3)'
                    }}>
                        {expired ? <ShieldAlert size={36} color="#fff" /> : <Clock size={36} color="#fff" />}
                    </div>

                    <h2 style={{ fontSize: '1.3rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                        {expired ? 'Tài khoản đã hết hạn' : 'Đang chờ phê duyệt'}
                    </h2>

                    <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                        {expired
                            ? 'Quyền truy cập của bạn đã hết hạn. Vui lòng liên hệ Admin để được gia hạn.'
                            : 'Tài khoản của bạn đã được ghi nhận. Vui lòng chờ Admin phê duyệt để bắt đầu sử dụng ứng dụng.'}
                    </p>

                    <div style={{
                        display: 'flex', alignItems: 'center', gap: '12px',
                        padding: '12px 16px', background: 'rgba(0,0,0,0.03)',
                        borderRadius: '12px', border: '1px solid var(--border-color)',
                        width: '100%'
                    }}>
                        <Avatar src={user.photoURL} alt={user.displayName} size={40} style={{ border: '2px solid var(--border-color)' }} />
                        <div style={{ textAlign: 'left' }}>
                            <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{user.displayName || user.email}</div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{user.email}</div>
                        </div>
                    </div>
                </div>

                <button
                    onClick={signOut}
                    className="login-google-btn"
                    style={{ marginTop: '8px', color: '#ef4444', borderColor: '#fecaca' }}
                >
                    <LogOut size={20} /> Đăng xuất
                </button>
            </div>
        </div>
    );
}
