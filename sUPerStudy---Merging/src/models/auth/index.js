import { api } from "../httpClient";

// ── Auth Service ────────────────────────────────────────────────────────────
const BASE = "/auth";

export const authService = {
  /** Login account (email-password) */
  signIn: (body) =>
    api.post(`${BASE}/signin`, body),

  /** Generate token by email — LOCAL DEVELOPMENT TESTING only */
  generateToken: (emailAddress) =>
    api.get(`${BASE}/generate-token`, { emailAddress }),
};
