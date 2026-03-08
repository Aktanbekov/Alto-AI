/**
 * Single source of truth for pricing tiers.
 * Used by HomePage pricing section and can be reused for ProfileDropdown or upgrade flows.
 */
export const PRICING_PLANS = [
  {
    id: "basic",
    name: "Basic",
    price: 29,
    description: "Get started with essential practice.",
    features: [
      "AI interview practice",
      "Personalized feedback",
      "F1 & B2 visa questions",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    price: 59,
    description: "More practice and deeper insights.",
    features: [
      "Everything in Basic",
      "Extended practice sessions",
      "Detailed score breakdowns",
    ],
  },
  {
    id: "professional",
    name: "Professional",
    price: 119,
    description: "Full preparation for serious candidates.",
    features: [
      "Everything in Pro",
      "Unlimited practice",
      "Priority support",
    ],
  },
];
