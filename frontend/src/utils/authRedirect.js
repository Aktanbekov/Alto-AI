/*
 * Where to go after signing in.
 *
 * A guest gated mid-flow arrives at /signup?redirect=/check-profile, and every
 * hop between the auth pages has to carry that destination along. It only
 * takes one plain <Link to="/login"> for the parameter to fall on the floor,
 * and then a successful login lands on the home page instead of the page the
 * person was in the middle of.
 */

// Same page, same destination: "/login" plus whatever ?redirect= we were given.
export function keepRedirect(path, search) {
  const query = typeof search === "string" ? search.replace(/^\?/, "") : "";
  return query ? `${path}?${query}` : path;
}

// Only same-site paths are honored. The value rides in a query parameter, so
// without this an "//evil.example" or "https://evil.example" redirect would
// bounce a freshly authenticated visitor straight off the site.
//
// A backslash is refused anywhere: browsers read "/\evil.example" as
// "//evil.example". Control characters are refused because the URL parser
// strips some of them, which can turn a harmless-looking value into "//". The
// final check resolves the value against this origin and insists it stays here.
export function safeRedirect(value, fallback = "/") {
  if (typeof value !== "string" || value.length > 512) return fallback;
  if (!value.startsWith("/") || value.startsWith("//")) return fallback;
  // eslint-disable-next-line no-control-regex
  if (/[\\\u0000-\u001f\u007f]/.test(value)) return fallback;
  try {
    const origin = typeof location !== "undefined" ? location.origin : "https://example.invalid";
    if (new URL(value, origin).origin !== origin) return fallback;
  } catch {
    return fallback;
  }
  return value;
}
