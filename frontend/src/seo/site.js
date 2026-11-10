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
  locale: "ru_RU",
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
    title: "Подготовка к собеседованию на визу F-1 с ИИ | Altovisas",
    description:
      "Потренируйтесь перед собеседованием на студенческую визу США с ИИ, который опирается на 16 204 реальных отзыва о собеседованиях на F-1 за 2020-2026 годы. Бесплатно, с мгновенным разбором.",
    changefreq: "weekly",
    priority: "1.0",
    indexable: true,
  },
  {
    path: "/check-profile",
    title: "Бесплатная проверка профиля для визы F-1 | Altovisas",
    description:
      "Ответьте на три вопроса и узнайте, где консульский офицер может засомневаться в вашем деле. Мы сверяем ответы с 16 204 реальными отзывами о собеседованиях.",
    changefreq: "weekly",
    priority: "0.9",
    indexable: true,
  },
  {
    path: "/data",
    title: "Статистика собеседований на визу F-1: 16 204 отзыва | Altovisas",
    description:
      "Доля одобрений по консульствам, ступеням обучения и попыткам, а также самые частые вопросы офицеров, по 16 204 отзывам о собеседованиях на F-1.",
    changefreq: "monthly",
    priority: "0.7",
    indexable: true,
  },
  {
    path: "/pricing",
    title: "Тарифы: бесплатно и разовая оплата | Altovisas",
    description:
      "Начните с бесплатного пробного собеседования на F-1, а затем заплатите один раз: 999, 1999 или 8500 сом, без подписки. Посмотрите, что входит в каждый тариф.",
    changefreq: "monthly",
    priority: "0.8",
    indexable: true,
  },
  {
    path: "/faq",
    title: "Вопросы о собеседовании на визу F-1 | Altovisas",
    description:
      "Ответы на частые вопросы о собеседовании на студенческую визу США: о чём спрашивают офицеры, какие документы взять и как подготовиться.",
    changefreq: "monthly",
    priority: "0.8",
    indexable: true,
  },
  {
    path: "/about",
    title: "Как работает Altovisas и откуда данные | Altovisas",
    description:
      "Как устроен Altovisas, откуда взялись 16 204 отзыва о собеседованиях на F-1 и что такие данные могут и не могут показать.",
    changefreq: "monthly",
    priority: "0.6",
    indexable: true,
  },
  {
    path: "/terms",
    title: "Условия использования | Altovisas",
    description:
      "Условия использования Altovisas, в том числе то, чем сервис не является: это не юридическая консультация, и он не связан ни с одним государственным органом.",
    changefreq: "yearly",
    priority: "0.3",
    indexable: true,
  },
  {
    path: "/privacy",
    title: "Политика конфиденциальности | Altovisas",
    description:
      "Что собирает Altovisas, как это используется, кто это обрабатывает и как удалить свои данные.",
    changefreq: "yearly",
    priority: "0.3",
    indexable: true,
  },
  {
    path: "/refund-policy",
    title: "Политика возврата | Altovisas",
    description:
      "Тарифы Altovisas это разовые цифровые покупки, и деньги за них не возвращаются. Что это значит, какие ошибки при оплате мы исправляем и какие у вас права по закону.",
    changefreq: "yearly",
    priority: "0.3",
    indexable: true,
  },
];

export const routeFor = (path) => ROUTES.find((r) => r.path === path) || ROUTES[0];
