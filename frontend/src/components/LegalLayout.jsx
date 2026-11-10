import { Link } from "react-router-dom";
import { useCopy } from "../i18n";

const COPY = {
  ru: {
    updated: (d) => `Последнее обновление: ${d}`,
    contents: "Содержание",
    terms: "Условия использования",
    privacy: "Политика конфиденциальности",
    refund: "Политика возврата",
  },
};

/*
 * Shared layout for the Terms, the Privacy Policy and the Refund Policy.
 *
 * The documents cross-reference each other constantly and have to stay
 * visually identical, so they share a layout rather than each keeping its own
 * copy of the same heading block and contents list.
 */

export function Section({ id, title, children }) {
  return (
    <section id={id} className="doc-sec">
      <h2>{title}</h2>
      <div className="doc-body">{children}</div>
    </section>
  );
}

export function List({ children }) {
  return <ul className="doc-bullets">{children}</ul>;
}

// A boxed statement for the things that most need to survive skim-reading:
// "this is not legal advice", "we cannot affect your visa decision".
export function Callout({ children }) {
  return <div className="doc-callout">{children}</div>;
}

export default function LegalLayout({ title, updated, summary, toc, children }) {
  const c = useCopy(COPY);
  return (
    <div className="tf">
      <article className="page-w doc">
        <h1>{title}</h1>
        <p className="meta">{c.updated(updated)}</p>

        {summary}

        {toc?.length > 0 && (
          <nav aria-labelledby="doc-toc" className="doc-toc">
            <h2 id="doc-toc">{c.contents}</h2>
            <ol>
              {toc.map((item) => (
                <li key={item.id}>
                  <a href={`#${item.id}`}>{item.title}</a>
                </li>
              ))}
            </ol>
          </nav>
        )}

        {children}

        <p className="doc-cross">
          <Link to="/terms">{c.terms}</Link>
          <span aria-hidden="true"> · </span>
          <Link to="/privacy">{c.privacy}</Link>
          <span aria-hidden="true"> · </span>
          <Link to="/refund-policy">{c.refund}</Link>
        </p>
      </article>
    </div>
  );
}
