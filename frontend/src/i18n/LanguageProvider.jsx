import { useCallback, useEffect, useMemo, useState } from "react";
import { LANGS, LangContext, initialLang, saveLang, setCurrentLang } from "./index";

/*
 * Holds the site language for the whole tree. Russian unless this browser
 * chose English before. See ./index.js for why the choice is also mirrored
 * outside React.
 */
export default function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(() => {
    const first = initialLang();
    setCurrentLang(first);
    return first;
  });

  const setLang = useCallback((next) => {
    if (!LANGS.includes(next)) return;
    setCurrentLang(next);
    setLangState(next);
    saveLang(next);
  }, []);

  // Screen readers pick their voice from <html lang>, and the browser picks
  // hyphenation and quotation marks from it.
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const value = useMemo(() => ({ lang, setLang }), [lang, setLang]);
  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}
