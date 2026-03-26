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
import { usersService, userGroupsService, emailWhitelistService } from '../models';

const AuthContext = createContext(null);

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}

// Helper: merge group access into user access arrays
async function mergeGroupAccess(userData) {
    let mergedFolderAccess = [...(userData.folderAccess || [])];
    let mergedTopicAccess = [...(userData.topicAccess || [])];
    let mergedGrammarAccess = [...(userData.grammarAccess || [])];
    let mergedExamAccess = [...(userData.examAccess || [])];
    let groupNames = [];
    let groupIdToNameMap = {}; // { groupId: groupName }
    let visibleGroupIds = []; // groupIds excluding hidden groups
    if (userData.groupIds && userData.groupIds.length > 0) {
        try {
            const groupsArray = await userGroupsService.findByIds(userData.groupIds);
            const groupsSnap = Array.isArray(groupsArray) ? groupsArray : (groupsArray?.data || []);
            groupsSnap.forEach(gData => {
                if (gData.isHidden) return; // Skip hidden groups

                if (gData.name) {
                    groupNames.push(gData.name);
                    groupIdToNameMap[gData.id] = gData.name;
                }
                visibleGroupIds.push(gData.id);
                if (gData.folderAccess) mergedFolderAccess = [...mergedFolderAccess, ...gData.folderAccess];
                if (gData.topicAccess) mergedTopicAccess = [...mergedTopicAccess, ...gData.topicAccess];
                if (gData.grammarAccess) mergedGrammarAccess = [...mergedGrammarAccess, ...gData.grammarAccess];
                if (gData.examAccess) mergedExamAccess = [...mergedExamAccess, ...gData.examAccess];
            });
            mergedFolderAccess = [...new Set(mergedFolderAccess)];
            mergedTopicAccess = [...new Set(mergedTopicAccess)];
            mergedGrammarAccess = [...new Set(mergedGrammarAccess)];
            mergedExamAccess = [...new Set(mergedExamAccess)];
        } catch (e) {
            console.error('Failed to fetch groups for user', e);
        }
    }
    return { mergedFolderAccess, mergedTopicAccess, mergedGrammarAccess, mergedExamAccess, groupNames, groupIdToNameMap, visibleGroupIds };
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
                try {
                    const userData = await usersService.findOne(firebaseUser.uid).catch(() => null);

                    if (userData) {

                        // Check if account is disabled
                        if (userData.disabled) {
                            await firebaseSignOut(auth);
                            setUser(null);
                            setLoading(false);
                            return;
                        }

                        const merged = await mergeGroupAccess(userData);
                        setUser({
                            ...firebaseUser,
                            ...userData,
                            ...merged,
                        });
                    } else {
                        // New user — will be handled by signInWithProvider
                        // Just set basic info so PendingApprovalPage can render
                        setUser({ ...firebaseUser, status: 'pending' });
                    }
                } catch (err) {
                    console.error("Error fetching user data:", err);
                    setUser(firebaseUser);
                }
            } else {
                setUser(null);
            }
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    async function handlePostSignIn(firebaseUser) {
        let userData = await usersService.findOne(firebaseUser.uid).catch(() => null);

        if (userData) {
            // Check if disabled
            if (userData.disabled) {
                await firebaseSignOut(auth);
                setUser(null);
                setError('Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên.');
                return false;
            }

            // If user is pending, re-check whitelist — admin may have pre-approved since last login
            if (userData.status === 'pending') {
                const emailKey = firebaseUser.email.toLowerCase().trim();
                const wl = await emailWhitelistService.checkEmail(emailKey).catch(() => null);
                if (wl) {
                    const now = new Date();
                    let expiresAt = null;
                    if (wl.customExpiresAt) {
                        expiresAt = new Date(`${wl.customExpiresAt}T23:59:59`).toISOString();
                    } else if (wl.durationDays) {
                        expiresAt = new Date(now.getTime() + wl.durationDays * 86400000).toISOString();
                    }
                    const approvedData = {
                        status: 'approved',
                        role: wl.role || 'user',
                        displayName: wl.displayName || userData.displayName || firebaseUser.displayName || '',
                        approvedAt: new Date().toISOString(),
                        expiresAt,
                        folderAccess: wl.folderAccess || userData.folderAccess || [],
                        topicAccess: wl.topicAccess || userData.topicAccess || [],
                        grammarAccess: wl.grammarAccess || userData.grammarAccess || [],
                        examAccess: wl.examAccess || userData.examAccess || [],
                        groupIds: wl.groupIds || userData.groupIds || [],
                    };
                    await usersService.update(firebaseUser.uid, approvedData);
                    await emailWhitelistService.remove(wl.id).catch(() => {});
                    userData = { ...userData, ...approvedData };
                }
            }

            // Update photo from provider (don't overwrite displayName — it may have been customized by admin)
            await usersService.update(firebaseUser.uid, {
                photoURL: firebaseUser.photoURL || '',
            });

            const merged = await mergeGroupAccess(userData);
            setUser({ ...firebaseUser, ...userData, ...merged });
            return true;
        } else {
            // New user — check built-in admin, then whitelist
            const emailKey = firebaseUser.email.toLowerCase().trim();

            // Built-in admin emails — always auto-approved as admin
            const BUILTIN_ADMIN_EMAILS = ['huynhquan.nguyen@gmail.com'];

            let newUserData;

            if (BUILTIN_ADMIN_EMAILS.includes(emailKey)) {
                newUserData = {
                    email: firebaseUser.email,
                    displayName: firebaseUser.displayName || '',
                    photoURL: firebaseUser.photoURL || '',
                    role: 'admin',
                    status: 'approved',
                    approvedAt: new Date().toISOString(),
                    expiresAt: null,
                    disabled: false,
                    folderAccess: [],
                    topicAccess: [],
                    grammarAccess: [],
                    examAccess: [],
                    groupIds: [],
                };
            } else {
                const wl = await emailWhitelistService.checkEmail(emailKey).catch(() => null);

                if (wl) {
                    // Pre-approved email — propagate stored permissions
                    const now = new Date();
                    let expiresAt = null;
                    if (wl.customExpiresAt) {
                        expiresAt = new Date(`${wl.customExpiresAt}T23:59:59`).toISOString();
                    } else if (wl.durationDays) {
                        expiresAt = new Date(now.getTime() + wl.durationDays * 86400000).toISOString();
                    }

                    newUserData = {
                        email: firebaseUser.email,
                        displayName: wl.displayName || firebaseUser.displayName || '',
                        photoURL: firebaseUser.photoURL || '',
                        role: wl.role || 'user',
                        status: 'approved',
                        approvedAt: new Date().toISOString(),
                        expiresAt,
                        disabled: false,
                        folderAccess: wl.folderAccess || [],
                        topicAccess: wl.topicAccess || [],
                        grammarAccess: wl.grammarAccess || [],
                        examAccess: wl.examAccess || [],
                        groupIds: wl.groupIds || [],
                    };
                } else {
                    // Not whitelisted — pending approval
                    newUserData = {
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
                }
            }

            await usersService.sync({ id: firebaseUser.uid, ...newUserData });

            // Notify admins when a new user registers with pending status
            if (newUserData.status === 'pending') {
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
                            body: `<p>Có người mới đăng ký tài khoản trên sUPerStudy:</p>`,
                            highlight: `<strong>${firebaseUser.displayName || ''}</strong> (${firebaseUser.email})`,
                            highlightBg: '#fffbeb', highlightBorder: '#f59e0b',
                            ctaText: 'Duyệt tài khoản', ctaColor: '#f59e0b', ctaColor2: '#fbbf24'
                        })
                    }, 'new_user_pending');
                } catch (e) {
                    console.error('Error sending new user notification:', e);
                }
            }

            // Clean up whitelist after successful auto-approval (best-effort)
            try {
                const wl = await emailWhitelistService.checkEmail(emailKey).catch(() => null);
                if (wl) {
                    await emailWhitelistService.remove(wl.id);
                }
            } catch (cleanupErr) {
                console.warn('Could not clean up whitelist entry (non-critical):', cleanupErr);
            }

            setUser({ ...firebaseUser, ...newUserData });
            return true;
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

    const value = { user, loading, error, signInWithGoogle, signInWithMicrosoft, signOut, clearError, isExpired };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}

