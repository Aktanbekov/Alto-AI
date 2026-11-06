/**
 * Single source of truth for the pricing tiers on the home page.
 *
 * Prices are US dollars, paid once. `interviews` drives the per-interview
 * figure shown under each price. Paid plans link to a checkout that is not
 * built yet; `checkoutPath` is the one place to point them somewhere real.
 */

// Shown in the trust line above the tiers. Placeholder figure.
export const APPLICANTS_PREPPED = "2,000+";

export const checkoutPath = (planId) => `/checkout?plan=${encodeURIComponent(planId)}`;

export const PRICING_PLANS = [
  {
    id: "free",
    cta: "Start free",
    name: "Free",
    icon: "play",
    description: "Try the format.",
    price: 0,
    interviews: 1,
    features: [{ count: "1", text: "short mock interview" }],
  },
  {
    id: "quick",
    cta: "Get Quick prep",
    name: "Quick prep",
    icon: "clock",
    description: "Interview soon? Get warmed up.",
    price: 15,
    interviews: 3,
    features: [{ count: "3", text: "mock interviews" }],
  },
  {
    id: "full",
    cta: "Get Full prep",
    name: "Full prep",
    icon: "target",
    description: "Practise for every common question.",
    price: 25,
    interviews: 10,
    recommended: true,
    badge: "Recommended",
    features: [
      { count: "10", text: "mock interviews" },
      { strong: "Your case, rebuilt", note: "Each weak point reworked from your own facts." },
    ],
  },
  {
    id: "complete",
    cta: "Get Complete",
    name: "Complete",
    icon: "shield",
    description: "Everything, and the most practice.",
    price: 99,
    interviews: 100,
    badge: "+100 if refused",
    features: [
      { count: "100", text: "mock interviews" },
      { strong: "Your case, rebuilt" },
      { strong: "The full interview playbook" },
    ],
    cover: "Visa refused? Get 100 more mock interviews, free.",
  },
];

// What the Complete plan adds after a refusal. Pricing page, Terms and the
// Refund Policy all read it from here so the three never disagree.
export const REFUSAL_COVER_INTERVIEWS = 100;

/*
 * The comparison table on /pricing, one row per thing a plan can include.
 * `true` / `false` render as included / not included; strings render as-is.
 * Columns follow PRICING_PLANS order.
 */
export const PLAN_COMPARISON = [
  { label: "Mock interviews", values: ["1 short", "3", "10", "100"] },
  { label: "Your case, rebuilt", values: [false, false, true, true] },
  { label: "The full interview playbook", values: [false, false, false, true] },
  { label: `${REFUSAL_COVER_INTERVIEWS} more mock interviews if your visa is refused`, values: [false, false, false, true] },
  {
    label: "Price per interview",
    values: PRICING_PLANS.map((p) => (p.price ? `$${(p.price / p.interviews).toFixed(2)}` : "Free")),
  },
  { label: "Payment", values: PRICING_PLANS.map((p) => (p.price ? "Once" : "None")) },
];

/*
 * The same plans in Russian. Only the words change: id, price, interview
 * count and icon come from PRICING_PLANS, so the two languages cannot quote
 * different prices.
 */
const PLAN_TEXT_RU = {
  free: {
    cta: "Начать бесплатно",
    name: "Бесплатно",
    description: "Попробуйте формат.",
    features: [{ count: "1", text: "короткое пробное собеседование" }],
  },
  quick: {
    cta: "Купить «Быструю»",
    name: "Быстрая подготовка",
    description: "Собеседование скоро? Разогрейтесь.",
    features: [{ count: "3", text: "пробных собеседования" }],
  },
  full: {
    cta: "Купить «Полную»",
    name: "Полная подготовка",
    description: "Отработайте все частые вопросы.",
    badge: "Рекомендуем",
    features: [
      { count: "10", text: "пробных собеседований" },
      { strong: "Доработка вашего кейса", note: "Каждое слабое место переработано из ваших собственных фактов." },
    ],
  },
  complete: {
    cta: "Купить «Максимум»",
    name: "Максимум",
    description: "Всё сразу и больше всего практики.",
    badge: "+100 при отказе",
    features: [
      { count: "100", text: "пробных собеседований" },
      { strong: "Доработка вашего кейса" },
      { strong: "Полное руководство по собеседованию" },
    ],
    cover: "Отказ в визе? Получите ещё 100 пробных собеседований бесплатно.",
  },
};

/** The plans with their words in `lang`. */
export function pricingPlans(lang) {
  if (lang !== "ru") return PRICING_PLANS;
  return PRICING_PLANS.map((p) => ({ ...p, ...PLAN_TEXT_RU[p.id] }));
}

/** The /pricing comparison table with its words in `lang`. */
export function planComparison(lang) {
  if (lang !== "ru") return PLAN_COMPARISON;
  return [
    { label: "Пробные собеседования", values: ["1 короткое", "3", "10", "100"] },
    { label: "Доработка вашего кейса", values: [false, false, true, true] },
    { label: "Полное руководство по собеседованию", values: [false, false, false, true] },
    { label: `Ещё ${REFUSAL_COVER_INTERVIEWS} пробных собеседований при отказе в визе`, values: [false, false, false, true] },
    {
      label: "Цена за собеседование",
      values: PRICING_PLANS.map((p) => (p.price ? `$${(p.price / p.interviews).toFixed(2)}` : "Бесплатно")),
    },
    { label: "Оплата", values: PRICING_PLANS.map((p) => (p.price ? "Один раз" : "Нет")) },
  ];
}
