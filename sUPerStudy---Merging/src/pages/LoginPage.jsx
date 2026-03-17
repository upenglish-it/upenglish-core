import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { BookOpen, Sparkles, LogIn, UserPlus, ArrowRight } from 'lucide-react';
import './LoginPage.css';
import BrandLogo from '../components/common/BrandLogo';

export default function LoginPage() {
    const { user, signInWithGoogle, signInWithMicrosoft, error, clearError } = useAuth();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submittingProvider, setSubmittingProvider] = useState(null);
    const [mode, setMode] = useState('login'); // 'login' or 'register'

    if (user) {
        if (user.status === 'pending') {
            return <Navigate to="/pending" replace />;
        }
        if (user.role === 'admin' || user.role === 'staff') {
            return <Navigate to="/admin" replace />;
        }
        if (user.role === 'teacher') {
            return <Navigate to="/teacher" replace />;
        }
        return <Navigate to="/" replace />;
    }

    async function handleGoogleSignIn() {
        setIsSubmitting(true);
        setSubmittingProvider('google');
        await signInWithGoogle();
        setIsSubmitting(false);
        setSubmittingProvider(null);
    }

    async function handleMicrosoftSignIn() {
        setIsSubmitting(true);
        setSubmittingProvider('microsoft');
        await signInWithMicrosoft();
        setIsSubmitting(false);
        setSubmittingProvider(null);
    }

    return (
        <div className="login-page">
            <div className="login-bg-orb login-bg-orb--1" />
            <div className="login-bg-orb login-bg-orb--2" />
            <div className="login-bg-orb login-bg-orb--3" />

            <div className="login-container animate-slide-up">
                <div className="login-header text-center">
                    <div className="login-logo">
                        <BookOpen size={32} />
                        <Sparkles size={16} className="login-logo-sparkle" />
                    </div>
                    <div className="login-title">
                        <BrandLogo size="2.5rem" />
                    </div>
                    <p className="login-subtitle">Siêu app học từ vựng</p>
                </div>

                {/* Tab Toggle */}
                <div style={{
                    display: 'flex', borderRadius: '10px', background: '#f1f5f9',
                    padding: '4px', marginBottom: '20px', gap: '4px'
                }}>
                    <button
                        type="button"
                        onClick={() => setMode('login')}
                        style={{
                            flex: 1, padding: '8px 12px', borderRadius: '8px', border: 'none',
                            background: mode === 'login' ? '#fff' : 'transparent',
                            color: mode === 'login' ? 'var(--color-primary)' : '#64748b',
                            fontWeight: mode === 'login' ? 700 : 500,
                            fontSize: '0.85rem', cursor: 'pointer',
                            boxShadow: mode === 'login' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                            transition: 'all 0.2s', display: 'flex', alignItems: 'center',
                            justifyContent: 'center', gap: '6px'
                        }}
                    >
                        <LogIn size={15} /> Đăng nhập
                    </button>
                    <button
                        type="button"
                        onClick={() => setMode('register')}
                        style={{
                            flex: 1, padding: '8px 12px', borderRadius: '8px', border: 'none',
                            background: mode === 'register' ? '#fff' : 'transparent',
                            color: mode === 'register' ? 'var(--color-primary)' : '#64748b',
                            fontWeight: mode === 'register' ? 700 : 500,
                            fontSize: '0.85rem', cursor: 'pointer',
                            boxShadow: mode === 'register' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                            transition: 'all 0.2s', display: 'flex', alignItems: 'center',
                            justifyContent: 'center', gap: '6px'
                        }}
                    >
                        <UserPlus size={15} /> Đăng ký
                    </button>
                </div>

                {error && (
                    <div className="login-error animate-shake">
                        <span>⚠️</span>
                        <span>{error}</span>
                        <button type="button" onClick={clearError} className="login-error-close">✕</button>
                    </div>
                )}

                <div className="login-form" style={{ gap: 'var(--space-lg)' }}>
                    {mode === 'register' && (
                        <div style={{
                            display: 'flex', flexDirection: 'column', gap: '10px',
                            padding: '14px', background: '#f0f9ff', borderRadius: '10px',
                            border: '1px solid #bae6fd', marginBottom: '4px'
                        }}>
                            <p style={{ fontSize: '0.85rem', fontWeight: 600, color: '#0369a1', margin: 0 }}>
                                Quy trình đăng ký:
                            </p>
                            {[
                                'Bấm nút bên dưới để đăng ký bằng Google hoặc Microsoft',
                                'Chờ Admin phê duyệt tài khoản',
                                'Bắt đầu học ngay sau khi được duyệt!'
                            ].map((step, i) => (
                                <div key={i} style={{
                                    display: 'flex', alignItems: 'center', gap: '8px',
                                    fontSize: '0.8rem', color: '#334155'
                                }}>
                                    <div style={{
                                        width: '20px', height: '20px', borderRadius: '50%',
                                        background: 'var(--color-primary)', color: '#fff',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: '0.7rem', fontWeight: 700, flexShrink: 0
                                    }}>{i + 1}</div>
                                    {step}
                                </div>
                            ))}
                        </div>
                    )}

                    <button
                        type="button"
                        className="login-google-btn"
                        onClick={handleGoogleSignIn}
                        disabled={isSubmitting}
                    >
                        {submittingProvider === 'google' ? (
                            <><div className="spinner" style={{ width: 20, height: 20, borderWidth: 2 }} /> {mode === 'register' ? 'Đang đăng ký...' : 'Đang đăng nhập...'}</>
                        ) : (
                            <>
                                <svg className="login-google-icon" viewBox="0 0 24 24" width="22" height="22">
                                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                                </svg>
                                {mode === 'register' ? 'Đăng ký bằng Google' : 'Đăng nhập bằng Google'}
                            </>
                        )}
                    </button>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '4px 0' }}>
                        <div style={{ flex: 1, height: '1px', background: '#e2e8f0' }} />
                        <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 500 }}>hoặc</span>
                        <div style={{ flex: 1, height: '1px', background: '#e2e8f0' }} />
                    </div>

                    <button
                        type="button"
                        className="login-google-btn"
                        onClick={handleMicrosoftSignIn}
                        disabled={isSubmitting}
                        style={{ background: '#fff', border: '1px solid #e2e8f0' }}
                    >
                        {submittingProvider === 'microsoft' ? (
                            <><div className="spinner" style={{ width: 20, height: 20, borderWidth: 2 }} /> {mode === 'register' ? 'Đang đăng ký...' : 'Đang đăng nhập...'}</>
                        ) : (
                            <>
                                <svg width="21" height="21" viewBox="0 0 21 21">
                                    <rect x="1" y="1" width="9" height="9" fill="#F25022" />
                                    <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
                                    <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
                                    <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
                                </svg>
                                {mode === 'register' ? 'Đăng ký bằng Microsoft' : 'Đăng nhập bằng Microsoft'}
                            </>
                        )}
                    </button>

                    {mode === 'login' && (
                        <p style={{ textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
                            Chưa có tài khoản?{' '}
                            <button
                                type="button"
                                onClick={() => setMode('register')}
                                style={{
                                    background: 'none', border: 'none', color: 'var(--color-primary)',
                                    fontWeight: 600, cursor: 'pointer', fontSize: '0.8rem', padding: 0,
                                    textDecoration: 'underline'
                                }}
                            >
                                Đăng ký ngay
                            </button>
                        </p>
                    )}
                    {mode === 'register' && (
                        <p style={{ textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
                            Đã có tài khoản?{' '}
                            <button
                                type="button"
                                onClick={() => setMode('login')}
                                style={{
                                    background: 'none', border: 'none', color: 'var(--color-primary)',
                                    fontWeight: 600, cursor: 'pointer', fontSize: '0.8rem', padding: 0,
                                    textDecoration: 'underline'
                                }}
                            >
                                Đăng nhập
                            </button>
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}
