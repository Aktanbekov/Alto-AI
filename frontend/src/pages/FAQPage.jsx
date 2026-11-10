import { Link } from "react-router-dom";
import { FAQ } from "../data/faq";
import { SITE } from "../seo/site";
import { useCopy } from "../i18n";

const COPY = {
  ru: {
    title: "Вопросы о собеседовании на визу F-1",
    lede: "О чём спрашивают офицеры, как собраны данные Altovisas и что они могут и не могут сказать.",
    moreTitle: "Остался вопрос?",
    more: (mail, about) => <>Напишите на {mail} или прочитайте, {about("как работает Altovisas")}.</>,
  },
};

/*
 * The FAQ renders from src/data/faq.js, which is also the source the build step
 * turns into FAQPage JSON-LD. Google requires the structured data to match the
 * visible content; sharing the array is what makes that true by construction
 * rather than by remembering to update two places.
 */
export default function FAQPage() {
  const c = useCopy(COPY);
  const mail = <a href={`mailto:${SITE.contact}`}>{SITE.contact}</a>;
  const about = (label) => <Link to="/about">{label}</Link>;

  return (
    <div className="tf">
      <article className="page-w doc">
        <h1>{c.title}</h1>
        <p className="lede">{c.lede}</p>

        <div className="doc-qa">
          {FAQ.map(({ q, a }) => (
            <section key={q}>
              <h2>{q}</h2>
              <p>{a}</p>
            </section>
          ))}
        </div>

        <section className="doc-end">
          <h2>{c.moreTitle}</h2>
          <p>{c.more(mail, about)}</p>
        </section>
      </article>
    </div>
  );
}
