/*
 * Product analytics client.
 *
 * Dependency-free and deliberately unable to break the page: every entry point
 * is wrapped, storage access is guarded (Safari private mode throws on
 * localStorage), and a blocked or failing request is swallowed. If this file
 * stops working, the site behaves exactly as it does now.
 *
 * Events are batched and flushed on an interval, on visibilitychange, and on
 * pagehide — never one request per event.
 */

const API = import.meta.env.VITE_API_BASE || (import.meta.env.PROD ? "" : "http://localhost:8080");

const VISITOR_KEY = "av_visitor_id";
const SESSION_KEY = "av_session";
const SRC_KEY = "av_src";
const SESSION_IDLE_MS = 30 * 60 * 1000; // a visit ends after 30 minutes idle
const FLUSH_MS = 10_000;
const MAX_QUEUE = 100;

let queue = [];
let timer = null;

// ---------------------------------------------------------------- storage --

function readStore(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null; // private mode, or storage disabled
  }
}

function writeStore(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* nothing to do; the id just won't persist across reloads */
  }
}

function uuid() {
  try {
    if (crypto?.randomUUID) return crypto.randomUUID();
  } catch { /* fall through */ }
  // Good enough for an anonymous id when randomUUID is unavailable.
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    return (ch === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

// ------------------------------------------------------------- identity ----

function visitorId() {
  let id = readStore(VISITOR_KEY);
  if (!id) {
    id = uuid();
    writeStore(VISITOR_KEY, id);
  }
  return id;
}

// A session is the same visit until 30 minutes pass with no event.
function sessionId() {
  const now = Date.now();
  let session = null;
  try {
    session = JSON.parse(readStore(SESSION_KEY) || "null");
  } catch { /* corrupt value; start fresh */ }

  if (!session?.id || !session.last || now - session.last > SESSION_IDLE_MS) {
    session = { id: uuid(), last: now };
  } else {
    session.last = now;
  }
  writeStore(SESSION_KEY, JSON.stringify(session));
  return session.id;
}

/*
 * `?src=friends` separates people who know the author from strangers — friends
 * inflate every number in the funnel. It is captured once and kept, so a
 * visitor who arrives via a tagged link stays tagged on later visits.
 */
function src() {
  try {
    const fromUrl = new URLSearchParams(location.search).get("src");
    if (fromUrl) {
      writeStore(SRC_KEY, fromUrl.slice(0, 64));
      return fromUrl.slice(0, 64);
    }
  } catch { /* no URL access */ }
  return readStore(SRC_KEY) || "";
}

const isMobile = () => {
  try {
    return matchMedia("(max-width: 767px)").matches || /Mobi|Android/i.test(navigator.userAgent);
  } catch {
    return false;
  }
};

const lang = () => {
  try {
    return (navigator.language || "").slice(0, 16);
  } catch {
    return "";
  }
};

// --------------------------------------------------------------- sending ---

function payload(events) {
  return JSON.stringify({
    visitor_id: visitorId(),
    session_id: sessionId(),
    src: src(),
    lang: lang(),
    is_mobile: isMobile(),
    events,
  });
}

/*
 * `keepalive` lets the last batch survive the page closing. sendBeacon is used
 * on the unload path because a normal fetch there is cancelled.
 */
function send(events, beacon = false) {
  if (!events.length) return;
  const body = payload(events);
  const url = `${API}/api/v1/events`;
  try {
    if (beacon && navigator.sendBeacon) {
      navigator.sendBeacon(url, new Blob([body], { type: "application/json" }));
      return;
    }
    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* blocked by an extension, offline, whatever — events are dropped */
  }
}

export function flush(beacon = false) {
  if (!queue.length) return;
  const batch = queue;
  queue = [];
  send(batch, beacon);
}

function schedule() {
  if (timer) return;
  try {
    timer = setTimeout(() => {
      timer = null;
      flush();
    }, FLUSH_MS);
  } catch { /* no timers available */ }
}

// ---------------------------------------------------------------- public ---

/** Record one event. Never throws, never blocks, never returns a promise. */
export function track(name, props) {
  try {
    if (!name) return;
    queue.push({
      name,
      ts: Date.now(),
      path: location.pathname,
      props: props || undefined,
    });
    // A burst (scroll depth, rapid clicks) flushes early rather than growing.
    if (queue.length >= MAX_QUEUE) flush();
    else schedule();
  } catch {
    /* tracking must never surface to the user */
  }
}

/**
 * Link this browser to the signed-in user so events from before signup are
 * attributable. The user id is taken from the session cookie server-side; only
 * the visitor id travels.
 */
export function identify(token) {
  try {
    flush();
    fetch(`${API}/api/v1/events/identify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      credentials: "include",
      body: JSON.stringify({ visitor_id: visitorId() }),
    }).catch(() => {});
  } catch { /* ignored */ }
}

/**
 * Headers that let a server-side event (report_generated) be attributed to this
 * visitor. Attached to the evaluate request only.
 */
export function trackingHeaders() {
  try {
    return {
      "X-Visitor-Id": visitorId(),
      "X-Session-Id": sessionId(),
      "X-Src": src(),
    };
  } catch {
    return {};
  }
}

/** Fire once at startup. Safe to call more than once. */
let started = false;
export function initAnalytics() {
  if (started) return;
  started = true;
  try {
    src(); // capture ?src= before any navigation drops it

    addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") flush(true);
    });
    addEventListener("pagehide", () => flush(true));
  } catch { /* ignored */ }
}

/** Scroll-depth milestones for one page. Returns a cleanup function. */
export function trackScrollDepth(label) {
  const hit = new Set();
  const onScroll = () => {
    try {
      const doc = document.documentElement;
      const height = doc.scrollHeight - innerHeight;
      if (height <= 0) return;
      const pct = Math.round(((doc.scrollTop || document.body.scrollTop) / height) * 100);
      for (const mark of [25, 50, 75, 100]) {
        if (pct >= mark && !hit.has(mark)) {
          hit.add(mark);
          track("scroll_depth", { pct: mark, on: label });
        }
      }
    } catch { /* ignored */ }
  };
  try {
    addEventListener("scroll", onScroll, { passive: true });
  } catch { /* ignored */ }
  return () => {
    try {
      removeEventListener("scroll", onScroll);
    } catch { /* ignored */ }
  };
}

/**
 * Buckets a GPA by percent of its scale, so the event stream never carries the
 * raw number. Returns "" when either value is missing — the server drops
 * anything that is not a band anyway, this just avoids sending it.
 */
export function gpaBandOf(raw, scale) {
  const value = parseFloat(raw);
  const max = parseFloat(scale);
  if (!Number.isFinite(value) || !Number.isFinite(max) || max <= 0) return "";
  const pct = value / max;
  if (pct < 0.5) return "<0.5";
  if (pct < 0.6) return "0.5-0.6";
  if (pct < 0.7) return "0.6-0.7";
  if (pct < 0.8) return "0.7-0.8";
  if (pct < 0.9) return "0.8-0.9";
  return "0.9+";
}
