import { trackingHeaders } from "./analytics";
// Use environment variable, or empty string for same-origin (production), or localhost for dev
const API = import.meta.env.VITE_API_BASE || (import.meta.env.PROD ? "" : "http://localhost:8080");

import { getAccessToken, setAccessToken, clearAccessToken } from "./utils/tokenStorage";

// Helper function to add Authorization header and handle 401 retries
async function fetchWithAuth(url, options = {}) {
  const token = getAccessToken();
  
  // Add Authorization header if token exists
  const headers = {
    ...options.headers,
  };
  
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  
  const response = await fetch(url, {
    ...options,
    headers,
    credentials: "include",
  });
  
  // Handle 401 Unauthorized - try to refresh token and retry
  if (response.status === 401 && token) {
    try {
      // Attempt to refresh the token
      await refreshToken();
      
      // Retry the original request with new token
      const newToken = getAccessToken();
      if (newToken) {
        headers["Authorization"] = `Bearer ${newToken}`;
        return await fetch(url, {
          ...options,
          headers,
          credentials: "include",
        });
      }
    } catch {
      // Refresh failed, clear token and let error propagate
      clearAccessToken();
      throw new Error("Session expired. Please log in again.");
    }
  }
  
  return response;
}

export async function getMe() {
  const res = await fetchWithAuth(`${API}/me`);
  if (!res.ok) return null;
  return res.json();
}

export async function updateUserProfile(updates) {
  const res = await fetchWithAuth(`${API}/api/v1/users/me/profile`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(updates),
  });
  
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: "Failed to update profile" }));
    throw new Error(error.error || "Failed to update profile");
  }
  
  return res.json();
}

export async function sendChatMessage(messages, sessionId = null, level = null) {
  const body = {
    messages,
    session_id: sessionId
  };
  
  // Add level if provided
  if (level) {
    body.level = level;
  }
  
  const res = await fetchWithAuth(`${API}/api/v1/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    // Handle authentication errors
    if (res.status === 401 || res.status === 403) {
      const error = await res.json().catch(() => ({ error: "Unauthorized" }));
      throw new Error(`401 Unauthorized: ${error.error || "Please log in to continue"}`);
    }
    const error = await res.json().catch(() => ({ error: "Failed to get response" }));
    throw new Error(error.error || "Failed to send message");
  }

  try {
    const data = await res.json();
    return data.data; // Return full response object, not just content
  } catch (jsonError) {
    console.error('JSON parsing error:', jsonError);
    const text = await res.text().catch(() => '');
    console.error('Response text:', text.substring(0, 500));
    throw new Error(`Failed to parse response: ${jsonError instanceof Error ? jsonError.message : 'Invalid JSON'}`);
  }
}

export async function login(email, password) {
  const res = await fetch(`${API}/api/v1/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: "Login failed" }));
    throw new Error(error.error || "Login failed");
  }

  const data = await res.json();
  // Store access token from response
  // Backend wraps response in {"data": {...}}, so we need to access data.data
  const responseData = data.data || data;
  if (responseData.access_token) {
    setAccessToken(responseData.access_token);
  }
  return responseData;
}

export async function logout() {
  const res = await fetch(`${API}/api/v1/auth/logout`, {
    method: "POST",
    credentials: "include",
  });

  // Clear access token from memory regardless of response
  clearAccessToken();

  if (!res.ok) {
    throw new Error("Logout failed");
  }
}

export async function refreshToken() {
  const res = await fetch(`${API}/api/v1/auth/refresh`, {
    method: "POST",
    credentials: "include",
  });

  if (!res.ok) {
    clearAccessToken();
    throw new Error("Token refresh failed");
  }

  const data = await res.json();
  // Store new access token from response
  // Backend wraps response in {"data": {...}}, so we need to access data.data
  const responseData = data.data || data;
  if (responseData.access_token) {
    setAccessToken(responseData.access_token);
  }
  return responseData;
}

export async function register(email, name, password) {
  try {
    const res = await fetch(`${API}/api/v1/auth/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({ email, name, password }),
    });

    // Check if response is HTML (wrong route)
    const contentType = res.headers.get("content-type");
    if (contentType && contentType.includes("text/html")) {
      throw new Error("Server returned HTML instead of JSON. The API endpoint may not be registered. Please restart the server.");
    }

    if (!res.ok) {
      let error;
      try {
        error = await res.json();
      } catch {
        throw new Error(`Registration failed: ${res.status} ${res.statusText}`);
      }

      // Handle validation errors
      if (error.error === "validation_error" && error.details) {
        const details = error.details;
        const messages = [];

        if (details.email) messages.push(`Email: ${getValidationMessage(details.email)}`);
        if (details.name) messages.push(`Name: ${getValidationMessage(details.name)}`);
        if (details.password) messages.push(`Password: ${getValidationMessage(details.password)}`);

        throw new Error(messages.length > 0 ? messages.join(". ") : "Validation failed");
      }

      throw new Error(error.error || "Registration failed");
    }

    return res.json();
  } catch (err) {
    // Handle network errors
    if (err instanceof TypeError && err.message.includes("fetch")) {
      throw new Error("Unable to connect to server. Please check if the server is running.");
    }
    throw err;
  }
}

// ---------- Corpus statistics (public) ----------

// Backs the landing-page dashboard. Public on purpose: logged-out visitors
// see the charts, so this must not go through fetchWithAuth.
export async function getCorpusStats() {
  const res = await fetch(`${API}/api/v1/stats`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Statistics unavailable (${res.status})`);
  }
  return res.json();
}

// The question bank the test draws its rounds from: every question type with
// its real phrasings, ordered by how often officers ask it. Public, like the
// stats above — the first round loads before anyone signs in.
export async function getQuestionBank() {
  const res = await fetch(`${API}/api/v1/questions`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Question bank unavailable (${res.status})`);
  }
  return res.json();
}

// ---------- Grounded evaluation (visa-llm sidecar) ----------

export async function getEvaluateStatus() {
  const res = await fetchWithAuth(`${API}/api/v1/evaluate/status`, {
    headers: trackingHeaders(),
  });
  if (!res.ok) {
    throw new Error(`Evaluator unavailable (${res.status})`);
  }
  const data = await res.json();
  return data.data ?? data;
}

// One evaluation costs real credits, so this is deliberately only called on
// explicit submit — never on mount or on keystroke.
//
// `profile.set_index` tells the server which set of three this is, so scoring
// the same set again after a refresh is not counted as reaching for a new one.
export async function evaluateProfile(profile) {
  const res = await fetchWithAuth(`${API}/api/v1/evaluate`, {
    method: "POST",
    // The visitor headers let the server attribute report_generated, which
    // carries token counts and latency the browser cannot know.
    headers: { "Content-Type": "application/json", ...trackingHeaders() },
    body: JSON.stringify(profile),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const error = new Error(err.error || `Evaluation failed (${res.status})`);
    error.status = res.status;
    error.code = err.code || "";
    throw error;
  }
  const data = await res.json();
  return data.data ?? data;
}

// ---------- Progressive validation and access ----------

/*
 * How many practice sets are left, which short feedback prompt is due, and
 * whether the survey and waitlist are behind them.
 *
 * Always from the server. The page could track most of this locally and often
 * be right, but "have I already been asked this" and "have I already unlocked"
 * have to survive a refresh, a second tab and a sign-in — so the browser asks
 * rather than remembers.
 */
export async function getAccess() {
  const res = await fetchWithAuth(`${API}/api/v1/access`, {
    headers: trackingHeaders(),
  });
  if (!res.ok) throw new Error(`Access state unavailable (${res.status})`);
  const data = await res.json();
  return data.data ?? data;
}

async function postValidation(path, body) {
  const res = await fetchWithAuth(`${API}/api/v1/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...trackingHeaders() },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Request failed (${res.status})`);
  }
  const data = await res.json();
  return data.data ?? data;
}

// Both prompts record a skip as firmly as an answer, so nobody is asked twice.
export const sendQuickFeedback = (body) => postValidation("feedback/quick", body);
export const sendDetailFeedback = (body) => postValidation("feedback/detail", body);

// Safe to call twice: the server grants the three sets once per person and
// returns the same state either way.
export const submitSurvey = (answers) => postValidation("survey", answers);

export const joinWaitlist = (email) => postValidation("waitlist", { email });

// ---------- Admin panel ----------

// The admin API returns 404 rather than 403 to non-admins, so callers should
// treat a failure here as "not an admin" rather than surfacing an error.
async function adminRequest(path, options = {}) {
  const res = await fetchWithAuth(`${API}/api/v1/admin${path}`, options);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Request failed (${res.status})`);
  }
  const data = await res.json();
  return data.data ?? data;
}

export async function getAdminMe() {
  try {
    return await adminRequest("/me");
  } catch {
    return { is_admin: false };
  }
}

export function getAdminStats() {
  return adminRequest("/stats");
}

// Evaluation failures students were shown a neutral message for. The real
// cause — out of credit, rejected key — is admin-only by design.
export function getEvaluatorHealth() {
  return adminRequest("/evaluator-health");
}

// ---------- Product analytics (admin) ----------

// Every screen takes the same filter set, so "friends vs strangers" works
// across all of them.
function analyticsQuery(filters = {}) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) {
    if (v) params.set(k, v);
  }
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export const getFunnel = (f) => adminRequest(`/analytics/funnel${analyticsQuery(f)}`);
export const getReportQuality = (f) => adminRequest(`/analytics/report-quality${analyticsQuery(f)}`);
export const getCoverageGaps = (f) => adminRequest(`/analytics/coverage${analyticsQuery(f)}`);
export const getFeedbackInbox = (f) => adminRequest(`/analytics/feedback${analyticsQuery(f)}`);
export const getCorpusGrowth = () => adminRequest("/analytics/corpus-growth");

export function listAdminUsers({ search = "", limit = 25, offset = 0 } = {}) {
  const q = new URLSearchParams({ search, limit, offset });
  return adminRequest(`/users?${q}`);
}

export function getAdminUser(id) {
  return adminRequest(`/users/${encodeURIComponent(id)}`);
}

export function deleteAdminUser(id) {
  return adminRequest(`/users/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export function verifyAdminUser(id) {
  return adminRequest(`/users/${encodeURIComponent(id)}/verify`, { method: "POST" });
}

export function listAdminInterviews({ search = "", limit = 25, offset = 0 } = {}) {
  const q = new URLSearchParams({ search, limit, offset });
  return adminRequest(`/interviews?${q}`);
}

export function getAdminInterview(id) {
  return adminRequest(`/interviews/${encodeURIComponent(id)}`);
}

export function getAdminQuestions() {
  return adminRequest("/questions");
}

export function saveAdminQuestions(categories) {
  return adminRequest("/questions", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ categories }),
  });
}

function getValidationMessage(tag) {
  const messages = {
    required: "is required",
    email: "must be a valid email address",
    min: "is too short",
    max: "is too long",
    len: "has incorrect length",
  };
  return messages[tag] || `failed validation (${tag})`;
}

export async function verifyEmail(email, code) {
  const res = await fetch(`${API}/api/v1/auth/verify-email`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify({ email, code }),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: "Verification failed" }));
    throw new Error(error.error || "Verification failed");
  }

  const data = await res.json();
  // Store access token from response
  // Backend wraps response in {"data": {...}}, so we need to access data.data
  const responseData = data.data || data;
  if (responseData.access_token) {
    setAccessToken(responseData.access_token);
  }
  return responseData;
}

export async function resendVerificationCode(email) {
  const res = await fetch(`${API}/api/v1/auth/resend-verification`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify({ email }),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: "Request failed" }));
    throw new Error(error.error || "Request failed");
  }

  return res.json();
}

export async function forgotPassword(email) {
  const res = await fetch(`${API}/api/v1/auth/forgot-password`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify({ email }),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: "Request failed" }));
    throw new Error(error.error || "Request failed");
  }

  return res.json();
}

export async function resetPassword(email, code, password) {
  const res = await fetch(`${API}/api/v1/auth/reset-password`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify({ email, code, password }),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: "Password reset failed" }));
    throw new Error(error.error || "Password reset failed");
  }

  return res.json();
}
