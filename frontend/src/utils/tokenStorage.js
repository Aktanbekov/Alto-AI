// Token storage utility for access tokens
// Uses sessionStorage to persist across page refreshes but clear on browser close

const ACCESS_TOKEN_KEY = "access_token";

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
}

export function hasAccessToken() {
  return !!getAccessToken();
}




