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
export function safeRedirect(value, fallback = "/") {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) {
    return fallback;
  }
  return value;
}
