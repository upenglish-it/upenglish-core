import { createContext, useContext, useEffect, useState } from "react";
import { authService } from "../models";

const AuthContext = createContext(null);

function buildFrontendUser(data = {}, fallback = {}) {
  const photoURL =
    data.photoURL ??
    data.profilePhoto ??
    fallback.photoURL ??
    fallback.profilePhoto ??
    null;

  return {
    uid: data.userId ?? data.uid ?? fallback.uid ?? null,
    accountRecordId: data.accountRecordId ?? null,
    email: data.email ?? fallback.email ?? "",
    displayName: data.displayName ?? fallback.displayName ?? "",
    role: data.role ?? fallback.role ?? "user",
    active: data.active ?? true,
    profilePhoto: data.profilePhoto ?? photoURL,
    photoURL,
    gender: data.gender ?? null,
    status: data.status ?? "approved",
    approvedAt: data.approvedAt ?? null,
    expiresAt: data.expiresAt ?? null,
    expiryNotifiedAt: data.expiryNotifiedAt ?? null,
    disabled: data.disabled ?? false,
    folderAccess: data.folderAccess ?? [],
    topicAccess: data.topicAccess ?? [],
    grammarAccess: data.grammarAccess ?? [],
    examAccess: data.examAccess ?? [],
    groupIds: data.groupIds ?? [],
    groupNames: data.groupNames ?? [],
    groupIdToNameMap: data.groupIdToNameMap ?? {},
    visibleGroupIds: data.visibleGroupIds ?? data.groupIds ?? [],
    emailPreferences: data.emailPreferences ?? {},
    teacherTitle: data.teacherTitle ?? null,
    studentTitle: data.studentTitle ?? null,
    authorizationToken: data.authorizationToken ?? null,
  };
}

function persistUserSession(user) {
  if (!user) return;

  if (user.authorizationToken) {
    localStorage.setItem("authorizationToken", user.authorizationToken);
  } else {
    localStorage.removeItem("authorizationToken");
  }

  localStorage.setItem("tempUser", JSON.stringify(user));
}

function clearStoredSession() {
  localStorage.removeItem("authorizationToken");
  localStorage.removeItem("tempUser");
}

function getResponseData(result) {
  return result?.data || result;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const storedUser = localStorage.getItem("tempUser");
    const token = localStorage.getItem("authorizationToken");

    if (!storedUser) {
      setLoading(false);
      return;
    }

    try {
      const parsedUser = JSON.parse(storedUser);
      const canRestorePendingSession = parsedUser?.status === "pending";

      if (token || canRestorePendingSession) {
        setUser(parsedUser);
      } else {
        clearStoredSession();
      }
    } catch {
      clearStoredSession();
    }

    setLoading(false);
  }, []);

  function commitSignedInUser(data, fallback = {}) {
    const nextUser = buildFrontendUser(data, fallback);

    if (!nextUser.uid || !nextUser.email) {
      throw new Error("Khong the xac minh tai khoan.");
    }

    persistUserSession(nextUser);
    setUser(nextUser);
    return nextUser;
  }

  async function signInWithGoogle() {
    setError(null);
    try {
      const result = await authService.signIn({ provider: "google" });
      const redirectURI = getResponseData(result)?.redirectURI;

      if (!redirectURI) {
        throw new Error("Khong the khoi tao dang nhap Google.");
      }

      window.location.assign(redirectURI);
      return true;
    } catch (err) {
      console.error("Google Sign-In error:", err);
      setError(err?.message || "Dang nhap Google that bai. Vui long thu lai.");
      return false;
    }
  }

  async function signInWithMicrosoft() {
    setError(null);
    try {
      const result = await authService.signIn({ provider: "microsoft" });
      const redirectURI = getResponseData(result)?.redirectURI;

      if (!redirectURI) {
        throw new Error("Khong the khoi tao dang nhap Microsoft.");
      }

      window.location.assign(redirectURI);
      return true;
    } catch (err) {
      console.error("Microsoft Sign-In error:", err);
      setError(err?.message || "Dang nhap Microsoft that bai. Vui long thu lai.");
      return false;
    }
  }

  async function finishSocialSignIn(query) {
    setError(null);
    try {
      const result = await authService.socialAuthorization(query);
      const data = getResponseData(result);
      return commitSignedInUser(data);
    } catch (err) {
      console.error("[AuthContext] Social sign-in failed:", err);
      clearStoredSession();
      setUser(null);
      setError(err?.message || "Khong the xac minh tai khoan. Vui long thu lai.");
      return null;
    }
  }

  async function signInWithEmail(email) {
    setError(null);
    try {
      const result = await authService.signIn({
        provider: "email-password",
        emailAddress: email,
      });
      return commitSignedInUser(getResponseData(result));
    } catch (err) {
      console.error("Email Sign-In error:", err);
      setError(err?.message || "He thong dang bao tri hoac email khong hop le.");
      return null;
    }
  }

  async function signOut() {
    try {
      sessionStorage.removeItem("viewMode");
      clearStoredSession();
      setUser(null);
    } catch (err) {
      console.error("Sign out error:", err);
    }
  }

  function clearError() {
    setError(null);
  }

  function isExpired() {
    if (!user?.expiresAt) return false;
    const expiry = user.expiresAt?.toDate
      ? user.expiresAt.toDate()
      : new Date(user.expiresAt);
    return expiry <= new Date();
  }

  const value = {
    user,
    loading,
    error,
    signInWithGoogle,
    signInWithMicrosoft,
    finishSocialSignIn,
    signInWithEmail,
    signOut,
    clearError,
    isExpired,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
