import { useLang } from "./index";

const OPTIONS = [
  { code: "ru", short: "RU", name: "Русский" },
  { code: "en", short: "EN", name: "English" },
];

/*
 * The RU / EN switch. Two pressed-state buttons rather than a <select>: there
 * are only two choices, both stay visible, and one tap changes the language.
 * Each button carries its own `lang`, so a screen reader says "English" in an
 * English voice even while the page around it is Russian.
 */
export default function LanguageSwitch({ className = "" }) {
  const { lang, setLang } = useLang();
  return (
    <div
      className={`lang-switch${className ? ` ${className}` : ""}`}
      role="group"
      aria-label={lang === "ru" ? "Язык сайта" : "Site language"}
    >
      {OPTIONS.map((o) => (
        <button
          key={o.code}
          type="button"
          lang={o.code}
          title={o.name}
          aria-pressed={lang === o.code}
          onClick={() => setLang(o.code)}
        >
          {o.short}
        </button>
      ))}
    </div>
  );
}
