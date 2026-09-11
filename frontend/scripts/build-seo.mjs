/*
 * Post-build SEO pass.
 *
 * Vite emits a single dist/index.html. This script reads it and writes one
 * static HTML file per public route, each with that route's own title,
 * description, canonical, Open Graph tags, JSON-LD and no-JavaScript content.
 * It then emits sitemap.xml from the same route table.
 *
 * WHY A BUILD STEP RATHER THAN react-helmet-async: helmet sets tags by running
 * JavaScript. The clients that matter most here do not run any. Telegram's link
 * preview scraper, Slack's, Twitter's, ChatGPT-User, PerplexityBot and
 * ClaudeBot all fetch HTML and read it as-is. For those, helmet changes
 * precisely nothing - they would keep seeing the homepage's tags on every URL,
 * which is the bug being fixed. This costs no runtime dependency and produces
 * bytes that are correct before any script runs.
 *
 * It is a plain post-build script rather than an SSG framework on purpose: the
 * app stays a client-rendered SPA, and only the shell differs per route.
 * Nothing about the React tree changes.
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { SITE, ROUTES, CORPUS, absolute } from "../src/seo/site.js";
import { FAQ } from "../src/data/faq.js";

const here = dirname(fileURLToPath(import.meta.url));
const dist = resolve(here, "..", "dist");
const repoRoot = resolve(here, "..", "..");

const START = "<!--seo:start-->";
const END = "<!--seo:end-->";
const NOSCRIPT_START = "<!--seo-noscript:start-->";
const NOSCRIPT_END = "<!--seo-noscript:end-->";

const escape = (s) =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/*
 * The corpus figure appears in marketing copy, so it is checked against the
 * dataset it claims to describe. A number that has quietly drifted is worse
 * than no number, because it is the one claim a reader can verify.
 */
async function verifyCorpus() {
  const statsPath = join(repoRoot, "visa-llm", "web", "data", "stats.json");
  if (!existsSync(statsPath)) {
    console.warn(`  ! stats.json not found, skipping corpus check`);
    return;
  }
  const stats = JSON.parse(await readFile(statsPath, "utf8"));
  const actual = stats?.meta?.n_records;
  const [from, to] = stats?.meta?.year_range || [];
  if (actual !== CORPUS.interviews) {
    throw new Error(
      `Corpus claim is ${CORPUS.interviews} but stats.json reports ${actual}. ` +
        `Update CORPUS in src/seo/site.js, or the copy is making a false claim.`,
    );
  }
  if (from !== CORPUS.fromYear || to !== CORPUS.toYear) {
    throw new Error(
      `Corpus year range is ${CORPUS.fromYear}-${CORPUS.toYear} but stats.json reports ${from}-${to}.`,
    );
  }
  console.log(`  corpus verified: ${actual.toLocaleString()} records, ${from}-${to}`);
}

// ------------------------------------------------------------- structured --

function organizationLd() {
  return {
    "@type": "Organization",
    "@id": `${SITE.origin}/#organization`,
    name: SITE.name,
    url: SITE.origin,
    logo: { "@type": "ImageObject", url: absolute(SITE.logo) },
    email: SITE.contact,
    description: `Free practice for the United States F-1 student visa interview, built on ${CORPUS.interviews.toLocaleString()} self-reported interview reports.`,
  };
}

function datasetLd() {
  return {
    "@type": "Dataset",
    "@id": `${SITE.origin}/#dataset`,
    name: `Self-reported F-1 visa interview reports, ${CORPUS.fromYear}-${CORPUS.toYear}`,
    description:
      `${CORPUS.interviews.toLocaleString()} self-reported accounts of United States F-1 student visa interviews, ` +
      "posted publicly online by applicants, then de-duplicated and parsed question by question. " +
      "Self-selected and self-reported: approval shares describe who chose to post, not the true consular " +
      "approval rate, and every association in the data is correlational rather than causal.",
    url: SITE.origin,
    temporalCoverage: `${CORPUS.fromYear}/${CORPUS.toYear}`,
    isAccessibleForFree: true,
    creator: { "@id": `${SITE.origin}/#organization` },
  };
}

// Google requires every Question to carry exactly one acceptedAnswer, and the
// text to match what a visitor sees. Both come from src/data/faq.js.
function faqLd() {
  return {
    "@type": "FAQPage",
    "@id": `${SITE.origin}/faq#faq`,
    mainEntity: FAQ.map(({ q, a }) => ({
      "@type": "Question",
      name: q,
      acceptedAnswer: { "@type": "Answer", text: a },
    })),
  };
}

function jsonLdFor(route) {
  const graph = [
    {
      "@type": "WebSite",
      "@id": `${SITE.origin}/#website`,
      name: SITE.name,
      url: SITE.origin,
      inLanguage: "en",
      publisher: { "@id": `${SITE.origin}/#organization` },
    },
    organizationLd(),
  ];

  if (route.path === "/") {
    graph.push(datasetLd(), {
      "@type": "WebApplication",
      "@id": `${SITE.origin}/#app`,
      name: SITE.name,
      url: SITE.origin,
      applicationCategory: "EducationalApplication",
      operatingSystem: "Any",
      browserRequirements: "Requires JavaScript",
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      description: route.description,
    });
  }
  if (route.path === "/faq") graph.push(faqLd());

  return { "@context": "https://schema.org", "@graph": graph };
}

// ------------------------------------------------------------------ head ---

function headFor(route) {
  const url = absolute(route.path);
  const image = absolute(SITE.ogImage);
  const lines = [
    `  <title>${escape(route.title)}</title>`,
    `  <meta name="description" content="${escape(route.description)}" />`,
    `  <link rel="canonical" href="${url}" />`,
  ];

  if (!route.indexable) {
    lines.push(`  <meta name="robots" content="noindex,follow" />`);
  }

  lines.push(
    ``,
    `  <meta property="og:type" content="website" />`,
    `  <meta property="og:site_name" content="${escape(SITE.name)}" />`,
    `  <meta property="og:locale" content="${SITE.locale}" />`,
    // Per-route, not the hardcoded homepage URL every page used to claim.
    `  <meta property="og:url" content="${url}" />`,
    `  <meta property="og:title" content="${escape(route.title)}" />`,
    `  <meta property="og:description" content="${escape(route.description)}" />`,
    // A PNG: no major platform renders SVG in a link preview.
    `  <meta property="og:image" content="${image}" />`,
    `  <meta property="og:image:width" content="1200" />`,
    `  <meta property="og:image:height" content="630" />`,
    `  <meta property="og:image:alt" content="${escape(SITE.name)} - F-1 visa interview practice" />`,
    ``,
    `  <meta name="twitter:card" content="summary_large_image" />`,
    `  <meta name="twitter:url" content="${url}" />`,
    `  <meta name="twitter:title" content="${escape(route.title)}" />`,
    `  <meta name="twitter:description" content="${escape(route.description)}" />`,
    `  <meta name="twitter:image" content="${image}" />`,
  );

  if (SITE.twitterHandle) {
    lines.push(`  <meta name="twitter:site" content="${escape(SITE.twitterHandle)}" />`);
  }

  lines.push(
    ``,
    `  <script type="application/ld+json">`,
    JSON.stringify(jsonLdFor(route), null, 2),
    `  </script>`,
  );

  return lines.join("\n");
}

// -------------------------------------------------------------- noscript ---

/*
 * Content for clients that never run the app.
 *
 * Without this the shell is <div id="root"></div> and an answer engine has
 * nothing to read but the meta description. The caveats travel with the
 * figures deliberately: an assistant summarising the page should not be able to
 * quote an approval share as though it were the real consular rate.
 */
function noscriptFor(route) {
  const shared = `
      <p>
        Altovisas is a free practice tool for the United States F-1 student visa
        interview, built on ${CORPUS.interviews.toLocaleString()} interview reports written by applicants
        about their own interviews between ${CORPUS.fromYear} and ${CORPUS.toYear} and posted publicly
        online. The dataset is self-selected and self-reported: approval shares
        describe who chose to write something down, not the true approval rate at
        any consulate, and associations in it are correlational rather than
        causal. Nothing here predicts an individual outcome.
      </p>
      <p>
        Altovisas is not legal or immigration advice and is not affiliated with
        the U.S. Department of State, any embassy or consulate, or any other
        government body. Answers given at a real interview must be truthful and
        your own.
      </p>
      <h2>Pages</h2>
      <ul>
${ROUTES.filter((r) => r.path !== route.path)
  .map((r) => `        <li><a href="${r.path}">${escape(r.title.split("|")[0].trim())}</a></li>`)
  .join("\n")}
      </ul>
      <p>The interactive version of this site requires JavaScript.</p>`;

  const faqBlock =
    route.path === "/faq"
      ? FAQ.map(
          ({ q, a }) => `      <h2>${escape(q)}</h2>\n      <p>${escape(a)}</p>`,
        ).join("\n")
      : "";

  return `  <noscript>
    <main>
      <h1>${escape(route.path === "/" ? "Find out where your F-1 visa interview breaks" : route.title.split("|")[0].trim())}</h1>
      <p>${escape(route.description)}</p>
${faqBlock}
${shared}
    </main>
  </noscript>`;
}

// ------------------------------------------------------------------ main ---

function replaceRegion(html, start, end, body, label) {
  const a = html.indexOf(start);
  const b = html.indexOf(end);
  if (a === -1 || b === -1) {
    throw new Error(
      `index.html is missing the ${label} markers (${start} ... ${end}). ` +
        `The SEO build cannot place per-route tags without them.`,
    );
  }
  return html.slice(0, a + start.length) + "\n" + body + "\n" + html.slice(b);
}

function sitemap() {
  const urls = ROUTES.filter((r) => r.indexable)
    .map(
      (r) => `  <url>
    <loc>${absolute(r.path)}</loc>
    <changefreq>${r.changefreq}</changefreq>
    <priority>${r.priority}</priority>
  </url>`,
    )
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<!--
  Generated by scripts/build-seo.mjs from src/seo/site.js. Do not edit by hand.
  To add pages, add them to ROUTES - including the few hundred generated
  content pages planned, which can be pushed into ROUTES programmatically.
-->
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
}

async function main() {
  const shellPath = join(dist, "index.html");
  if (!existsSync(shellPath)) {
    throw new Error(`${shellPath} not found. Run vite build first.`);
  }
  await verifyCorpus();

  const shell = await readFile(shellPath, "utf8");

  for (const route of ROUTES) {
    let html = replaceRegion(shell, START, END, headFor(route), "head");
    html = replaceRegion(html, NOSCRIPT_START, NOSCRIPT_END, noscriptFor(route), "noscript");

    // "/" is dist/index.html; "/faq" is dist/faq/index.html, which is what a
    // static host and the Go router both look for.
    const out =
      route.path === "/" ? shellPath : join(dist, route.path.slice(1), "index.html");
    await mkdir(dirname(out), { recursive: true });
    await writeFile(out, html, "utf8");
    console.log(`  ${route.path.padEnd(16)} -> ${out.replace(dist, "dist")}`);
  }

  await writeFile(join(dist, "sitemap.xml"), sitemap(), "utf8");
  console.log(`  sitemap.xml     -> ${ROUTES.filter((r) => r.indexable).length} urls`);
}

main().catch((err) => {
  console.error(`\nSEO build failed: ${err.message}\n`);
  process.exit(1);
});
