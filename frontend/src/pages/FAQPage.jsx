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
    <div className="min-h-screen bg-stone-50">
      <nav className="bg-white shadow-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 sm:gap-3 cursor-pointer">
            <img src="/logo.svg" alt="Altovisas logo" className="h-8 sm:h-10 w-auto" />
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
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-stone-900 mb-4 text-center">
          F-1 visa interview questions
        </h1>
        <p className="text-center text-stone-600 mb-8 max-w-2xl mx-auto">
          What officers ask, how the dataset behind Altovisas was built, and what it
          can and cannot tell you.
        </p>

        <div className="bg-white rounded-2xl shadow-lg p-6 sm:p-8 md:p-12 divide-y divide-stone-200">
          {FAQ.map(({ q, a }) => (
            <section key={q} className="py-6 first:pt-0 last:pb-0">
              <h2 className="text-xl sm:text-2xl font-bold text-stone-900 mb-3">{q}</h2>
              <p className="text-stone-700 leading-relaxed">{a}</p>
            </section>
          ))}
        </div>

        <div className="mt-8 text-center">
          <p className="text-stone-700 mb-4">Still have questions?</p>
          <a
            href={`mailto:${SITE.contact}`}
            className="inline-block px-6 py-3 bg-indigo-700 text-white rounded-full hover:shadow-lg transition-all"
          >
            Email us
          </a>
          <p className="text-sm text-stone-600 mt-6">
            <Link to="/terms" className="text-indigo-700 hover:underline">Terms of Service</Link>
            <span className="mx-2 text-stone-400">·</span>
            <Link to="/privacy" className="text-indigo-700 hover:underline">Privacy Policy</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
