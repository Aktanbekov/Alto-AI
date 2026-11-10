/**
 * Single source of truth for the pricing plans: the home page, /pricing, the
 * Terms and the Refund Policy all read from here, so they cannot disagree.
 *
 * Prices are in Kyrgyz som (сом), paid once. `interviews` drives the
 * per-interview figure shown under each price. Paid plans link to a checkout
 * that is not built yet; `checkoutPath` is the one place to point them
 * somewhere real.
 */

export const CURRENCY = "KGS";

// Shown in the trust line above the tiers. Placeholder figure.
export const APPLICANTS_PREPPED = "2000+";

export const checkoutPath = (planId) => `/checkout?plan=${encodeURIComponent(planId)}`;

// 999 сом. Whole numbers only; the plans are priced in round som.
export const formatPrice = (price) => `${price} сом`;

// What one mock interview costs on a plan, rounded to a whole som.
export const perInterview = (plan) => Math.round(plan.price / plan.interviews);

export const PRICING_PLANS = [
  {
    id: "free",
    cta: "Начать бесплатно",
    name: "Бесплатно",
    icon: "play",
    description: "Попробуйте, как это работает.",
    price: 0,
    interviews: 1,
    features: [{ count: "1", text: "короткое пробное собеседование" }],
  },
  {
    id: "quick",
    cta: "Выбрать «Быструю»",
    name: "Быстрая подготовка",
    icon: "clock",
    description: "Собеседование скоро? Успейте размяться.",
    price: 999,
    interviews: 3,
    features: [{ count: "3", text: "пробных собеседования" }],
  },
  {
    id: "full",
    cta: "Выбрать «Полную»",
    name: "Полная подготовка",
    icon: "target",
    description: "Отработайте все частые вопросы.",
    price: 1999,
    interviews: 10,
    recommended: true,
    badge: "Рекомендуем",
    features: [
      { count: "10", text: "пробных собеседований" },
      {
        strong: "Переработка вашего кейса",
        note: "Каждое слабое место переписывается на основе ваших собственных фактов.",
      },
    ],
  },
  {
    id: "complete",
    cta: "Выбрать «Максимум»",
    name: "Максимум",
    icon: "shield",
    description: "Всё сразу и больше всего практики.",
    price: 8500,
    interviews: 100,
    badge: "+100 при отказе",
    features: [
      { count: "100", text: "пробных собеседований" },
      { strong: "Переработка вашего кейса" },
      { strong: "Полное руководство по собеседованию" },
    ],
    cover: "Отказали в визе? Получите ещё 100 пробных собеседований бесплатно.",
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
  { label: "Пробные собеседования", values: ["1 короткое", "3", "10", "100"] },
  { label: "Переработка вашего кейса", values: [false, false, true, true] },
  { label: "Полное руководство по собеседованию", values: [false, false, false, true] },
  {
    label: `Ещё ${REFUSAL_COVER_INTERVIEWS} пробных собеседований, если вам откажут в визе`,
    values: [false, false, false, true],
  },
  {
    label: "Цена одного собеседования",
    values: PRICING_PLANS.map((p) => (p.price ? formatPrice(perInterview(p)) : "Бесплатно")),
  },
  { label: "Оплата", values: PRICING_PLANS.map((p) => (p.price ? "Один раз" : "Не нужна")) },
];
