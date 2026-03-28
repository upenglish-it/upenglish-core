import { api } from "../httpClient";

// ── Auth Service ────────────────────────────────────────────────────────────
const BASE = "/auth";

export const authService = {
  /** Login with email (dev testing only) — checks ISMS Accounts */
  signIn: (body) =>
    api.post(`${BASE}/signin`, body),

  /**
   * Production SSO flow: after Google/Microsoft resolves the email,
   * verify against ISMS Accounts. Returns 404 if not registered.
   */
  signInViaSSOEmail: (emailAddress) =>
    api.post(`${BASE}/signin-sso`, { emailAddress }),

  /** Generate token by email — LOCAL DEVELOPMENT TESTING only */
  generateToken: (emailAddress) =>
    api.get(`${BASE}/generate-token`, { emailAddress }),
};

