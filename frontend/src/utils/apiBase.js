/*
 * The API origin is embedded by Vite at build time.  A value copied into
 * Vercel with quotes, a trailing /api, or an http:// origin on an HTTPS page
 * otherwise turns every request into either an invalid URL or mixed content.
 * Keep that deployment-specific cleanup in one place so auth, analytics and
 * the public corpus endpoints all behave the same way.
 */
function configuredApiBase() {
  const fallback = import.meta.env.PROD ? "" : "http://localhost:8080";
  let raw = String(import.meta.env.VITE_API_BASE || "").trim();

  if (!raw) return fallback;

  // Also tolerate the entire assignment being pasted into Vercel's Value
  // field instead of separating the Name and Value fields.
  raw = raw.replace(/^VITE_API_BASE\s*=\s*/i, "").trim();

  // Vercel values are sometimes pasted as "https://api.example.com". Quotes
  // are not shell syntax there; they become part of the value.
  if (
    raw.length >= 2 &&
    ((raw.startsWith('"') && raw.endsWith('"')) ||
      (raw.startsWith("'") && raw.endsWith("'")))
  ) {
    raw = raw.slice(1, -1).trim();
  }

  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error("only http and https origins are supported");
    }
    if (parsed.username || parsed.password || parsed.search || parsed.hash) {
      throw new Error("credentials, query strings, and fragments are not allowed");
    }

    // The client appends /api/v1/... itself. Tolerate the common dashboard
    // mistake of including /api in VITE_API_BASE instead of producing /api/api.
    let pathname = parsed.pathname.replace(/\/+$/, "");
    if (pathname === "/api") pathname = "";

    if (
      import.meta.env.PROD &&
      typeof window !== "undefined" &&
      window.location.protocol === "https:" &&
      parsed.protocol !== "https:"
    ) {
      throw new Error("an HTTPS site cannot send personal data to an HTTP API");
    }

    return `${parsed.origin}${pathname}`;
  } catch (error) {
    console.error(
      "Invalid VITE_API_BASE; using same-origin requests instead.",
      error instanceof Error ? error.message : error,
    );
    return fallback;
  }
}

export const API_BASE = configuredApiBase();
