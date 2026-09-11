/*
 * Single source of truth for everything a crawler reads.
 *
 * Imported by three consumers that must never disagree:
 *   1. scripts/build-seo.mjs, which bakes these values into per-route static
 *      HTML after the Vite build;
 *   2. the same script's sitemap generator;
 *   3. the React pages, for the handful of places the copy is also rendered.
 *
 * The reason this file exists rather than tags living in index.html: a SPA
 * serves one shell for every route, so without a build step every page shares
 * the homepage's title and description. Crawlers that do not run JavaScript -
 * which includes every social scraper and most answer engines - never see the
 * values React swaps in afterwards.
 */

export const SITE = {
  name: "Altovisas",
  // The canonical host. Everything else 301s here; see DEPLOYMENT notes.
  origin: "https://www.altovisas.com",
  locale: "en_US",
  // Absolute, because Open Graph consumers do not resolve relative URLs.
  ogImage: "/og-image.png",
  logo: "/logo.png",
  contact: "altovisas@gmail.com",
  // No verified handle yet. Left null so the build omits twitter:site rather
  // than emitting an empty tag that validators flag.
  twitterHandle: null,
};

/*
 * The corpus, in one place.
 *
 * These are the only figures allowed in marketing copy, and they are checked
 * against visa-llm/web/data/stats.json at build time - see verifyCorpus() in
 * scripts/build-seo.mjs. A claim that drifts from the dataset is worse than no
 * claim, because it is the one number a reader can check.
 */
export const CORPUS = {
  interviews: 16204,
  fromYear: 2020,
  toYear: 2026,
};

export const absolute = (path) => `${SITE.origin}${path === "/" ? "/" : path}`;

/*
 * Public routes, in sitemap order.
 *
 * `indexable: false` still gets a static HTML file built (so a shared link
 * previews correctly) but stays out of the sitemap and carries a robots
 * noindex. Anything behind auth is absent entirely - it would be a dead end for
 * anyone who followed it from a search result.
 */
export const ROUTES = [
  {
    path: "/",
    title: "F1 Visa Mock Interview Practice with AI | Altovisas",
    description:
      "Practice your US student visa interview with an AI interviewer built on ~16,000 real F-1 interview reports from 2020-2026. Free, instant feedback.",
    changefreq: "weekly",
    priority: "1.0",
    indexable: true,
  },
  {
    path: "/check-profile",
    title: "Free F1 Visa Profile Check | Altovisas",
    description:
      "Answer three questions and see where a consular officer is most likely to push back on your F-1 case, checked against 16,204 real interview reports.",
    changefreq: "weekly",
    priority: "0.9",
    indexable: true,
  },
  {
    path: "/faq",
    title: "F1 Visa Interview FAQ - Questions Answered | Altovisas",
    description:
      "Answers to the most common questions about the US F-1 student visa interview: what officers ask, what documents to bring, and how to prepare.",
    changefreq: "monthly",
    priority: "0.8",
    indexable: true,
  },
  {
    path: "/about",
    title: "About Altovisas and the Interview Dataset",
    description:
      "How Altovisas works, where its 16,204 F-1 visa interview reports come from, and the limits of what self-reported data can tell you.",
    changefreq: "monthly",
    priority: "0.6",
    indexable: true,
  },
  {
    path: "/terms",
    title: "Terms of Service | Altovisas",
    description:
      "The terms that govern use of Altovisas, including what the service is not: not legal advice, and not affiliated with any government.",
    changefreq: "yearly",
    priority: "0.3",
    indexable: true,
  },
  {
    path: "/privacy",
    title: "Privacy Policy | Altovisas",
    description:
      "What Altovisas collects, how it is used, who processes it, and how to have it deleted.",
    changefreq: "yearly",
    priority: "0.3",
    indexable: true,
  },
];

export const routeFor = (path) => ROUTES.find((r) => r.path === path) || ROUTES[0];
