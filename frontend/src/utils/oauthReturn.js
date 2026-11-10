import { setAccessToken } from "./tokenStorage";
import { safeRedirect } from "./authRedirect";

/*
 * The return leg of Google sign-in.
 *
 * The server sends the browser to /#access_token=…&redirect=…. The token rides
 * in the fragment so it never reaches a server, a Referer header or page
 * analytics, and this runs before React renders so nothing else on the page
 * ever sees it in the address bar: the token goes to storage and the fragment
 * is wiped from history straight away.
 *
 * Older deployments used ?access_token= in the query string; that form is
 * still accepted so a sign-in that started before a deploy still completes.
 *
 * Returns the same-site path to continue to, or null when this page load is
 * not a sign-in return.
 */
let pending = null;

export function takeOAuthReturn() {
  try {
    const hash = new URLSearchParams(location.hash.replace(/^#/, ""));
    const query = new URLSearchParams(location.search);
    const fromHash = hash.get("access_token");
    const token = fromHash || query.get("access_token");
    if (!token) return null;

    const redirect = (fromHash ? hash : query).get("redirect");
    setAccessToken(token);

    query.delete("access_token");
    query.delete("redirect");
    const rest = query.toString();
    history.replaceState(history.state, "", location.pathname + (rest ? `?${rest}` : ""));

    pending = safeRedirect(redirect || "/");
    return pending;
  } catch {
    return null;
  }
}

/** The path a completed Google sign-in should continue to, once. */
export function consumeOAuthRedirect() {
  const p = pending;
  pending = null;
  return p;
}
