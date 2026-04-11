import { api } from "../httpClient";

// ── Auth Service ────────────────────────────────────────────────────────────
const BASE = "/auth";

export const authService = {
  /** Login with email (dev testing only) — checks ISMS Accounts */
  signIn: (body) =>
    api.post(`${BASE}/signin`, body),

  /** Complete the Google/Microsoft callback using Nest-managed OAuth exchange */
  socialAuthorization: (query) =>
    api.get(`${BASE}/social-authorization`, query),

  /**
   * Production SSO flow: after Google/Microsoft resolves the email,
   * verify against ISMS Accounts. Returns 404 if not registered.
   */
  signInViaSSOEmail: (payload) =>
    api.post(
      `${BASE}/signin-sso`,
      typeof payload === "string" ? { emailAddress: payload } : payload,
    ),

  /** Generate token by email — LOCAL DEVELOPMENT TESTING only */
  generateToken: (emailAddress) =>
    api.get(`${BASE}/generate-token`, { emailAddress }),
};

