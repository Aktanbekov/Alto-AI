import { Link } from "react-router-dom";

/*
 * Shared layout for the Terms and the Privacy Policy.
 *
 * The two documents cross-reference each other constantly and have to stay
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
  return (
    <div className="tf">
      <article className="page-w doc">
        <h1>{title}</h1>
        <p className="meta">Last updated {updated}</p>

        {summary}

        {toc?.length > 0 && (
          <nav aria-labelledby="doc-toc" className="doc-toc">
            <h2 id="doc-toc">Contents</h2>
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
          <Link to="/terms">Terms of Service</Link>
          <span aria-hidden="true"> · </span>
          <Link to="/privacy">Privacy Policy</Link>
        </p>
      </article>
    </div>
  );
}
