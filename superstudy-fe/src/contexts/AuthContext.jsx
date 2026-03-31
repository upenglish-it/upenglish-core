import { createContext, useContext, useState, useEffect, useRef } from 'react';
import {
    onAuthStateChanged,
    signInWithPopup,
    signInWithCustomToken,
    linkWithCredential,
    OAuthProvider,
    signOut as firebaseSignOut,
} from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import { auth, googleProvider, microsoftProvider, functions } from '../config/firebase';
import { authService, usersService } from '../models';

const AuthContext = createContext(null);

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}

export function AuthProvider({ children }) {

    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const isSigningIn = useRef(false);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            if (firebaseUser) {
                // Skip if handlePostSignIn is actively running — it will set the correct state
                if (isSigningIn.current) {
                    setLoading(false);
                    return;
                }
                // On session restore: read the ISMS-sourced user from localStorage.
                // It was stored by handlePostSignIn / signInWithEmail after ISMS verification.
                const tempUser = localStorage.getItem('tempUser');
                if (tempUser) {
                    try {
                        const parsed = JSON.parse(tempUser);
                        setUser(parsed);
                    } catch (e) {
                        // Corrupted — force re-auth
                        await firebaseSignOut(auth);
                        localStorage.removeItem('tempUser');
                        localStorage.removeItem('authorizationToken');
                        setUser(null);
                    }
                } else {
                    // No persisted ISMS user — check if they are pending in SSTUsers
                    try {
                        const userData = await usersService.findOne(firebaseUser.uid).catch(() => null);
                        if (userData && userData.status === 'pending') {
                            setUser({ ...firebaseUser, status: 'pending' });
                        } else {
                            await firebaseSignOut(auth);
                            setUser(null);
                        }
                    } catch (e) {
                        await firebaseSignOut(auth);
                        setUser(null);
                    }
                }
            } else {
                // Firebase signed out — also read tempUser (for email-only dev login path)
                const tempUser = localStorage.getItem('tempUser');
                if (tempUser) {
                    try { setUser(JSON.parse(tempUser)); } catch (e) { setUser(null); }
                } else {
                    setUser(null);
                }
            }
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    async function handlePostSignIn(firebaseUser) {
        // After Firebase SSO resolves email, check ISMS Accounts.
        // If email is not in ISMS → deny access (no auto-create).
        try {
            const result = await authService.signInViaSSOEmail(firebaseUser.email);

            if (result?.success || result?.statusCode === 'HAS_DATA') {
                const data = result.data || result;
                localStorage.setItem('authorizationToken', data.authorizationToken);
                const newUser = {
                    uid: data.userId,
                    email: data.email,
                    displayName: data.displayName,
                    role: data.role,
                    active: data.active,
                    profilePhoto: data.profilePhoto ?? firebaseUser.photoURL ?? null,
                    status: 'approved',
                };
                setUser(newUser);
                localStorage.setItem('tempUser', JSON.stringify(newUser));
                return true;
            } else {
                // Email not in ISMS — create a pending user in SSTUsers & notify admins
                const newUserData = {
                    email: firebaseUser.email,
                    displayName: firebaseUser.displayName || '',
                    photoURL: firebaseUser.photoURL || '',
                    role: 'user',
                    status: 'pending',
                    approvedAt: null,
                    expiresAt: null,
                    disabled: false,
                    folderAccess: [],
                    topicAccess: [],
                    grammarAccess: [],
                    examAccess: [],
                    groupIds: [],
                };

                await usersService.sync({ id: firebaseUser.uid, ...newUserData });

                try {
                    const { createNotificationForAdmins, queueEmailForAdmins, buildEmailHtml } = await import('../services/notificationService');
                    await createNotificationForAdmins({
                        type: 'new_user_pending',
                        title: '👤 User mới xin tham gia',
                        message: `${firebaseUser.displayName || firebaseUser.email} đang chờ duyệt tài khoản.`,
                        link: '/admin/users'
                    });

                    await queueEmailForAdmins({
                        subject: `User mới: ${firebaseUser.displayName || firebaseUser.email}`,
                        html: buildEmailHtml({
                            emoji: '👤', heading: 'User mới cần duyệt', headingColor: '#f59e0b',
                            body: `<p>Có người mới đăng ký bằng SSO, chưa có trong hệ thống ISMS:</p>`,
                            highlight: `<strong>${firebaseUser.displayName || ''}</strong> (${firebaseUser.email})`,
                            highlightBg: '#fffbeb', highlightBorder: '#f59e0b',
                            ctaText: 'Vui lòng tạo Account trong ISMS cho Email này', ctaColor: '#f59e0b', ctaColor2: '#fbbf24'
                        })
                    }, 'new_user_pending');
                } catch (e) {
                    console.error('Error sending new user notification:', e);
                }

                setUser({ ...firebaseUser, ...newUserData });
                return true;
            }
        } catch (err) {
            console.error('[AuthContext] SSO ISMS check failed:', err);
            await firebaseSignOut(auth);
            setUser(null);
            setError(err?.message || 'Không thể xác minh tài khoản. Vui lòng thử lại.');
            return false;
        }
    }

    async function signInWithGoogle() {
        setError(null);
        isSigningIn.current = true;
        try {
            const result = await signInWithPopup(auth, googleProvider);
            return await handlePostSignIn(result.user);
        } catch (err) {
            console.error("Google Sign-In error:", err);
            if (err.code === 'auth/popup-closed-by-user') return false;
            setError('Đăng nhập Google thất bại. Vui lòng thử lại.');
            return false;
        } finally {
            isSigningIn.current = false;
        }
    }

    async function signInWithMicrosoft() {
        setError(null);
        isSigningIn.current = true;
        try {
            const result = await signInWithPopup(auth, microsoftProvider);
            return await handlePostSignIn(result.user);
        } catch (err) {
            console.error("Microsoft Sign-In error:", err);
            if (err.code === 'auth/popup-closed-by-user') return false;
            if (err.code === 'auth/account-exists-with-different-credential') {
                // Account exists (e.g. admin changed email) — resolve via custom token + link
                try {
                    const credential = OAuthProvider.credentialFromError(err);
                    const email = err.customData?.email;
                    if (!email || !credential) {
                        setError('Không thể xác định email. Vui lòng thử lại.');
                        return false;
                    }
                    // Get custom token for the existing account
                    const resolveConflict = httpsCallable(functions, 'resolveEmailConflict');
                    const { data } = await resolveConflict({ email });
                    // Sign in with custom token (preserves original UID)
                    const tokenResult = await signInWithCustomToken(auth, data.customToken);
                    // Link Microsoft provider to the account
                    await linkWithCredential(tokenResult.user, credential);
                    return await handlePostSignIn(tokenResult.user);
                } catch (resolveErr) {
                    console.error('Error resolving email conflict:', resolveErr);
                    setError('Đăng nhập thất bại. Vui lòng liên hệ quản trị viên.');
                    return false;
                }
            }
            setError('Đăng nhập Microsoft thất bại. Vui lòng thử lại.');
            return false;
        } finally {
            isSigningIn.current = false;
        }
    }

    async function signOut() {
        try {
            sessionStorage.removeItem('viewMode');
            localStorage.removeItem('authorizationToken');
            localStorage.removeItem('tempUser');
            await firebaseSignOut(auth);
            setUser(null);
        } catch (err) {
            console.error('Sign out error:', err);
        }
    }

    function clearError() { setError(null); }

    // Helper to check if user's access has expired
    function isExpired() {
        if (!user?.expiresAt) return false;
        const expiry = user.expiresAt.toDate ? user.expiresAt.toDate() : new Date(user.expiresAt);
        return expiry <= new Date();
    }

    async function signInWithEmail(email) {
        setError(null);
        isSigningIn.current = true;
        try {
            // Dev testing only — calls ISMS via POST /auth/signin
            const result = await authService.signIn({ provider: 'email-password', emailAddress: email });
            if (result?.success || result?.statusCode === 'HAS_DATA') {
                const data = result.data || result;
                localStorage.setItem('authorizationToken', data.authorizationToken);
                const newUser = {
                    uid: data.userId,
                    email: data.email,
                    displayName: data.displayName,
                    role: data.role,
                    active: data.active,
                    profilePhoto: data.profilePhoto ?? null,
                    status: 'approved',
                };
                setUser(newUser);
                localStorage.setItem('tempUser', JSON.stringify(newUser));
                return true;
            } else {
                setError(result?.message || 'Đăng nhập thất bại.');
                return false;
            }
        } catch (err) {
            console.error("Email Sign-In error:", err);
            setError(err?.message || 'Hệ thống đang bảo trì hoặc email không hợp lệ.');
            return false;
        } finally {
            isSigningIn.current = false;
        }
    }

    const value = { user, loading, error, signInWithGoogle, signInWithMicrosoft, signInWithEmail, signOut, clearError, isExpired };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}

