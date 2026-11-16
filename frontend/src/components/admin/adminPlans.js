// Plan names and the rounds each one grants, for the admin screens. The server
// (PaidPlanSets in payment_request_handler.go) is what actually grants rounds;
// these only label and confirm.
export const PLAN_NAMES = { quick: "Быстрая", full: "Полная", complete: "Максимум" };
export const PLAN_SETS = { quick: 3, full: 10, complete: 100 };
export const PLAN_PRICES = { quick: 999, full: 1999, complete: 8500 };
export const PAID_PLAN_IDS = ["quick", "full", "complete"];

export const planName = (id) => PLAN_NAMES[id] || id || "-";

const pad = (n) => String(n).padStart(2, "0");

// 13.11.2026 14:05 - the format the founder reads in Telegram too.
export function dateTime(value) {
  const d = new Date(value);
  if (!value || Number.isNaN(d.getTime())) return "-";
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function shortDay(value) {
  const d = new Date(value);
  return !value || Number.isNaN(d.getTime()) ? "" : `${pad(d.getDate())}.${pad(d.getMonth() + 1)}`;
}

// Days from today to a YYYY-MM-DD interview date; negative once it has passed.
export function daysUntil(iso) {
  if (!iso) return null;
  const d = new Date(`${iso}T00:00:00`);
  return Math.round((d - new Date().setHours(0, 0, 0, 0)) / 86400000);
}

export function interviewLabel(iso) {
  if (!iso) return { text: "No date yet", urgent: false };
  const [y, m, d] = iso.split("-");
  const days = daysUntil(iso);
  const when = days < 0 ? "passed" : days === 0 ? "today" : `in ${days} d`;
  return { text: `${d}.${m}.${y}`, when, urgent: days >= 0 && days <= 7 };
}

export const digits = (s) => (s || "").replace(/\D/g, "");

// Where to reach someone: their chosen app, opened in a new tab.
export function contactLink(r) {
  if (r.contact === "telegram" && r.telegram) return { href: `https://t.me/${r.telegram}`, label: `Telegram @${r.telegram}` };
  if (r.contact === "whatsapp" && r.phone) return { href: `https://wa.me/${digits(r.phone)}`, label: "WhatsApp" };
  return null;
}

// Bought turns the plan on for a real person; leaving Bought takes it away.
// Both ask first. Returns an error message when it cannot be done at all.
export function confirmOutcome(r, outcome) {
  const plan = planName(r.plan);
  const sets = PLAN_SETS[r.plan];
  const who = r.email || "their account";
  if (outcome === "bought" && r.outcome !== "bought") {
    if (!r.user_id) return { ok: false, error: `${r.name}'s request isn't linked to an account, so there's nothing to turn the plan on for.` };
    return { ok: window.confirm(`Confirm payment from ${r.name}?\n\nThis turns on «${plan}» for ${who}: +${sets} practice rounds, right away.`) };
  }
  if (outcome !== "bought" && r.outcome === "bought") {
    return { ok: window.confirm(`Take the plan back from ${r.name}?\n\nThis removes the ${r.granted_sets || sets} rounds added to ${who}.`) };
  }
  return { ok: true };
}
