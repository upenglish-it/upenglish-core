import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '../config/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { Eye, EyeOff, UserPlus, ArrowLeft, Mail, Lock } from 'lucide-react';
import './LoginPage.css';

export default function RegisterPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    async function handleSubmit(e) {
        e.preventDefault();
        if (password !== confirmPassword) {
            return setError('Mật khẩu xác nhận không khớp');
        }

        try {
            setError('');
            setLoading(true);
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            // Create user document immediately
            await setDoc(doc(db, 'users', user.uid), {
                email: user.email,
                role: 'user',
                createdAt: serverTimestamp()
            });

            navigate('/');
        } catch (err) {
            setError('Không thể tạo tài khoản. ' + err.message);
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="login-page">
            <div className="login-bg-orb login-bg-orb--1" />
            <div className="login-bg-orb login-bg-orb--2" />
            <div className="login-bg-orb login-bg-orb--3" />

            <div className="login-container animate-slide-up">
                <div className="login-header">
                    <div className="login-logo">
                        <UserPlus size={32} />
                    </div>
                    <h1 className="login-title">Tạo tài khoản</h1>
                    <p className="login-subtitle">Đăng ký để bắt đầu hành trình học tập</p>
                </div>

                <form className="login-form" onSubmit={handleSubmit}>
                    {error && (
                        <div className="login-error animate-shake">
                            <span>⚠️</span>
                            <span>{error}</span>
                            <button type="button" onClick={() => setError('')} className="login-error-close">✕</button>
                        </div>
                    )}

                    <div className="input-group">
                        <label htmlFor="email">Email</label>
                        <div className="login-input-wrapper">
                            <Mail size={18} className="login-input-icon" />
                            <input id="email" type="email" className="input-field login-input"
                                placeholder="your@email.com" value={email}
                                onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
                        </div>
                    </div>

                    <div className="input-group">
                        <label htmlFor="password">Mật khẩu</label>
                        <div className="login-input-wrapper">
                            <Lock size={18} className="login-input-icon" />
                            <input id="password" type={showPassword ? 'text' : 'password'}
                                className="input-field login-input" placeholder="••••••••"
                                value={password} onChange={(e) => setPassword(e.target.value)}
                                required autoComplete="new-password" />
                            <button type="button" className="login-toggle-password"
                                onClick={() => setShowPassword(!showPassword)} tabIndex={-1}>
                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                    </div>

                    <div className="input-group">
                        <label htmlFor="confirmPassword">Xác nhận mật khẩu</label>
                        <div className="login-input-wrapper">
                            <Lock size={18} className="login-input-icon" />
                            <input id="confirmPassword" type={showPassword ? 'text' : 'password'}
                                className="input-field login-input" placeholder="••••••••"
                                value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                                required autoComplete="new-password" />
                        </div>
                    </div>

                    <button type="submit" className="btn btn-primary btn-lg btn-full login-submit"
                        disabled={loading || !email || !password || !confirmPassword}>
                        {loading ? (
                            <><div className="spinner" style={{ width: 20, height: 20, borderWidth: 2 }} /> Đang tạo...</>
                        ) : 'Đăng ký ngay'}
                    </button>
                </form>

                <div className="login-footer" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center' }}>
                    <p>
                        Đã có tài khoản? <Link to="/login" style={{ color: 'var(--color-primary-light)', fontWeight: 600 }}>Đăng nhập</Link>
                    </p>
                    <button onClick={() => navigate(-1)} style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', fontSize: '0.9rem', textDecoration: 'none', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                        <ArrowLeft size={16} /> Quay lại trang đăng nhập
                    </button>
                </div>
            </div>
        </div>
    );
}
