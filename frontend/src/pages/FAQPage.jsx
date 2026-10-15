import { Link } from "react-router-dom";
import { FAQ } from "../data/faq";
import { SITE } from "../seo/site";

/*
 * The FAQ renders from src/data/faq.js, which is also the source the build step
 * turns into FAQPage JSON-LD. Google requires the structured data to match the
 * visible content; sharing the array is what makes that true by construction
 * rather than by remembering to update two places.
 */
export default function FAQPage() {
  return (
    <div className="tf">
      <article className="page-w doc">
        <h1>F-1 visa interview questions</h1>
        <p className="lede">
          What officers ask, how the data behind Altovisas was built, and what it can
          and cannot tell you.
        </p>

        <div className="doc-qa">
          {FAQ.map(({ q, a }) => (
            <section key={q}>
              <h2>{q}</h2>
              <p>{a}</p>
            </section>
          ))}
        </div>

        <section className="doc-end">
          <h2>Still have a question?</h2>
          <p>
            Email <a href={`mailto:${SITE.contact}`}>{SITE.contact}</a>, or read{" "}
            <Link to="/about">how Altovisas works</Link>.
          </p>
        </section>
      </article>
    </div>
  );
}
