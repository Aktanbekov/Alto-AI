import { Link } from "react-router-dom";

/*
 * Shared shell for the Terms and the Privacy Policy.
 *
 * The two documents cross-reference each other constantly and have to stay
 * visually identical, so they share a layout rather than each keeping its own
 * copy of the same nav and card.
 */

export function Section({ id, title, children }) {
  return (
    <section id={id} className="scroll-mt-24">
      <h2 className="text-xl sm:text-2xl font-bold text-stone-900 mb-3">{title}</h2>
      <div className="space-y-3 text-stone-700 leading-relaxed">{children}</div>
    </section>
  );
}

export function List({ children }) {
  return <ul className="list-disc list-outside ml-5 space-y-2">{children}</ul>;
}

// A boxed statement for the things that most need to survive skim-reading:
// "this is not legal advice", "we cannot affect your visa decision".
export function Callout({ children }) {
  return (
    <div className="border-l-4 border-indigo-600 bg-indigo-50 rounded-r-lg px-4 py-3 text-stone-800">
      {children}
    </div>
  );
}

export default function LegalLayout({ title, updated, summary, toc, children }) {
  return (
    <div className="min-h-screen bg-stone-50">
      <nav className="bg-white shadow-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 sm:gap-3 cursor-pointer">
            <img src="/logo.svg" alt="Altovisas Logo" className="h-8 sm:h-10 w-auto" />
            <span className="text-xl sm:text-2xl font-bold text-indigo-700">
              Altovisas
            </span>
          </Link>
          <Link
            to="/"
            className="px-4 lg:px-6 py-2 bg-indigo-700 text-white rounded-full hover:shadow-lg transition-all text-sm lg:text-base min-h-[44px] flex items-center"
          >
            Back to Home
          </Link>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-stone-900 mb-3 text-center">
          {title}
        </h1>
        <p className="text-center text-stone-600 mb-8">Last updated: {updated}</p>

        <div className="bg-white rounded-2xl shadow-lg p-6 sm:p-8 md:p-12 space-y-8">
          {summary}

          {toc?.length > 0 && (
            <nav aria-label="Contents" className="border-y border-stone-200 py-4">
              <p className="text-xs font-semibold text-stone-600 uppercase tracking-wide mb-2">
                Contents
              </p>
              <ol className="grid sm:grid-cols-2 gap-x-6 gap-y-1 text-sm">
                {toc.map((item, i) => (
                  <li key={item.id} className="text-stone-700">
                    <a href={`#${item.id}`} className="hover:text-indigo-700 hover:underline">
                      {i + 1}. {item.title}
                    </a>
                  </li>
                ))}
              </ol>
            </nav>
          )}

          {children}
        </div>

        <p className="text-center text-sm text-stone-600 mt-8">
          <Link to="/terms" className="text-indigo-700 hover:underline">Terms of Service</Link>
          <span className="mx-2 text-stone-400">·</span>
          <Link to="/privacy" className="text-indigo-700 hover:underline">Privacy Policy</Link>
        </p>
      </div>
    </div>
  );
}
