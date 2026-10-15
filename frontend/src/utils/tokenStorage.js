// Token storage utility for access tokens
// Uses sessionStorage to persist across page refreshes but clear on browser close

const ACCESS_TOKEN_KEY = "access_token";

// Per-person progress kept for one sitting - the profile check's resume point,
// the survey draft - lives under this prefix. It belongs to whoever was signed
// in, so it goes when they do; otherwise the next account in this tab opens the
// page on someone else's profile and round.
const PERSONAL_PREFIX = "alto.";

// Fired when the session ends, by logout or by a refresh that failed. Pages
// that require an account listen for it so they do not stay rendered.
export const SIGNED_OUT_EVENT = "alto:signed-out";

export function setAccessToken(token) {
  if (token) {
    sessionStorage.setItem(ACCESS_TOKEN_KEY, token);
  } else {
    clearAccessToken();
  }
}

export function getAccessToken() {
  return sessionStorage.getItem(ACCESS_TOKEN_KEY);
}

export function clearAccessToken() {
  sessionStorage.removeItem(ACCESS_TOKEN_KEY);
  try {
    Object.keys(sessionStorage)
      .filter((key) => key.startsWith(PERSONAL_PREFIX))
      .forEach((key) => sessionStorage.removeItem(key));
  } catch {
    // A blocked store has nothing in it to leak.
  }
  dispatchEvent(new Event(SIGNED_OUT_EVENT));
}

export function hasAccessToken() {
  return !!getAccessToken();
}




