import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import BrandLogo from "../components/common/BrandLogo";
import { useAuth } from "../contexts/AuthContext";
import "./LoginPage.css";

function decodeStateProvider(rawState) {
  if (!rawState) return null;

  try {
    const parsed = JSON.parse(window.atob(rawState));
    const provider = String(parsed?.provider ?? "").trim().toLowerCase();
    return provider === "google" || provider === "microsoft" ? provider : null;
  } catch {
    return null;
  }
}

function resolveDestination(nextUser) {
  if (!nextUser) return "/login";
  if (nextUser.status === "pending") return "/pending";
  if (nextUser.role === "admin" || nextUser.role === "staff") return "/admin";
  if (nextUser.role === "teacher") return "/teacher";
  if (nextUser.role === "it") return "/it";
  return "/";
}

export default function SocialLoginLandingPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, finishSocialSignIn, error, clearError } = useAuth();
  const [status, setStatus] = useState("processing");

  const authQuery = useMemo(() => {
    const query = Object.fromEntries(searchParams.entries());
    const provider =
      String(query.provider ?? "").trim().toLowerCase() ||
      decodeStateProvider(query.state) ||
      (query.session_state ? "microsoft" : "");

    if (provider) {
      query.provider = provider;
    }

    return query;
  }, [searchParams]);

  useEffect(() => {
    let cancelled = false;

    async function completeSignIn() {
      clearError();

      if (authQuery.error) {
        setStatus("error");
        return;
      }

      const nextUser = await finishSocialSignIn(authQuery);
      if (cancelled) return;

      if (!nextUser) {
        setStatus("error");
        return;
      }

      setStatus("done");
      navigate(resolveDestination(nextUser), { replace: true });
    }

    completeSignIn();
    return () => {
      cancelled = true;
    };
  }, [authQuery, clearError, finishSocialSignIn, navigate]);

  if (user && status !== "error") {
    return <Navigate to={resolveDestination(user)} replace />;
  }

  const authError =
    error ||
    authQuery.error_description ||
    authQuery.error ||
    "Dang nhap that bai. Vui long thu lai.";

  return (
    <div className="login-page">
      <div className="login-bg-orb login-bg-orb--1" />
      <div className="login-bg-orb login-bg-orb--2" />
      <div className="login-bg-orb login-bg-orb--3" />

      <div className="login-container animate-slide-up">
        <div className="login-header text-center">
          <div className="login-title">
            <BrandLogo size="2.5rem" />
          </div>
          <p className="login-subtitle">Hoan tat dang nhap</p>
        </div>

        {status === "processing" ? (
          <div className="login-form" style={{ alignItems: "center", gap: "16px" }}>
            <div className="spinner" />
            <p style={{ margin: 0, textAlign: "center", color: "var(--text-muted)" }}>
              Dang xac minh tai khoan cua ban...
            </p>
          </div>
        ) : (
          <div className="login-form" style={{ gap: "16px" }}>
            <div className="login-error animate-shake">
              <span>{authError}</span>
            </div>
            <Link
              to="/login"
              className="login-google-btn"
              style={{ justifyContent: "center", textDecoration: "none" }}
            >
              Quay lai dang nhap
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
