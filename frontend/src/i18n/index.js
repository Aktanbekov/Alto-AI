import { createContext, useContext } from "react";

/*
 * The site's language: Russian first, English on request.
 *
 * Dependency-free on purpose. The site has two languages and a few hundred
 * strings, and each component keeps its own copy next to the markup that uses
 * it (`const COPY = { ru: {...}, en: {...} }` read through useCopy). A shared
 * dictionary file this size is where strings go stale, because nobody editing
 * a page opens it.
 *
 * The choice is remembered per browser. It is also mirrored in a module-level
 * variable so code outside React - the API client, which tells the server
 * which language the AI should answer in - can read it without a hook.
 */

export const LANGS = ["ru", "en"];
export const DEFAULT_LANG = "ru";
const STORE_KEY = "alto.lang";

let current = DEFAULT_LANG;

function readSaved() {
  try {
    const saved = localStorage.getItem(STORE_KEY);
    return LANGS.includes(saved) ? saved : null;
  } catch {
    return null; // private mode, or storage disabled
  }
}

/** The language in effect right now, for code that cannot use a hook. */
export function getLang() {
  return current;
}

/** Called by LanguageProvider, the only writer of the current language. */
export function setCurrentLang(lang) {
  current = lang;
}

/** The saved choice, the default when there is none. */
export function initialLang() {
  return readSaved() || DEFAULT_LANG;
}

export function saveLang(lang) {
  try {
    localStorage.setItem(STORE_KEY, lang);
  } catch {
    /* the choice just won't survive a reload */
  }
}

export const LangContext = createContext({ lang: DEFAULT_LANG, setLang: () => {} });

export const useLang = () => useContext(LangContext);

/** This component's copy in the current language, English when a key is missing. */
export function useCopy(table) {
  const { lang } = useLang();
  return table[lang] || table.en;
}

/**
 * The right word form for a count.
 *   en: [one, other]
 *   ru: [one, few, many] - 1 раунд, 2 раунда, 5 раундов, 21 раунд
 */
export function plural(lang, n, forms) {
  const abs = Math.abs(n);
  if (lang !== "ru") return abs === 1 ? forms[0] : forms[1];
  const tens = abs % 100;
  const ones = abs % 10;
  if (tens >= 11 && tens <= 14) return forms[2];
  if (ones === 1) return forms[0];
  if (ones >= 2 && ones <= 4) return forms[1];
  return forms[2];
}

/** A number formatted the way the reader's language writes it: 16 204 / 16,204. */
export function formatNumber(lang, n) {
  if (n == null || Number.isNaN(Number(n))) return "";
  return Number(n).toLocaleString(lang === "ru" ? "ru-RU" : "en-US");
}

/*
 * The server writes its messages in English. The ones a student can actually
 * see are listed here so a Russian reader does not get a sudden English line
 * in the middle of a Russian form. Anything unlisted is shown as the server
 * wrote it - an untranslated message beats a wrong one.
 */
const SERVER_RU = [
  [/invalid email or password/i, "Неверный email или пароль."],
  [/email not verified/i, "Email ещё не подтверждён. Введите код из письма."],
  [/user with this email already exists/i, "Аккаунт с этим email уже существует. Войдите или восстановите пароль."],
  [/email is already verified/i, "Этот email уже подтверждён. Можно войти."],
  [/invalid verification code/i, "Неверный код подтверждения. Проверьте его или запросите новый."],
  [/verification code expired/i, "Срок действия кода истёк. Запросите новый."],
  [/invalid reset code/i, "Неверный код сброса. Проверьте его или запросите новый."],
  [/reset code expired/i, "Срок действия кода сброса истёк. Запросите новый."],
  [/failed to send verification email/i, "Не удалось отправить письмо с кодом. Попробуйте ещё раз."],
  [/failed to send reset email/i, "Не удалось отправить письмо для сброса пароля. Попробуйте ещё раз."],
  [/user not found/i, "Пользователь не найден."],
  [/session expired/i, "Сессия истекла. Войдите снова."],
  [/enter a valid email/i, "Введите корректный email."],
  [/could not add you to the waitlist/i, "Не удалось добавить вас в лист ожидания. Попробуйте ещё раз."],
  [/could not save your answers/i, "Не удалось сохранить ответы. Попробуйте ещё раз."],
  [/could not save your feedback/i, "Не удалось сохранить отзыв. Попробуйте ещё раз."],
  [/answer at least one question/i, "Ответьте хотя бы на один вопрос."],
  [/add at least one question and answer/i, "Ответьте хотя бы на один вопрос."],
  [/scoring is temporarily unavailable/i, "Проверка временно недоступна. Ваши ответы сохранены — попробуйте ещё раз через несколько минут."],
  [/used all of your practice sets/i, "Вы использовали все тренировочные раунды. Пройдите короткий опрос, чтобы открыть ещё три."],
  [/unable to connect to server/i, "Не удаётся связаться с сервером. Проверьте подключение к интернету."],
  [/registration failed/i, "Не удалось создать аккаунт. Попробуйте ещё раз."],
  [/login failed/i, "Не удалось войти. Попробуйте ещё раз."],
  [/verification failed/i, "Не удалось подтвердить код. Попробуйте ещё раз."],
  [/password reset failed/i, "Не удалось сменить пароль. Попробуйте ещё раз."],
  [/request failed/i, "Запрос не выполнен. Попробуйте ещё раз."],
];

/** A server message in the reader's language, when we know its translation. */
export function serverMessage(lang, message) {
  if (lang !== "ru" || !message) return message;
  const hit = SERVER_RU.find(([pattern]) => pattern.test(message));
  return hit ? hit[1] : message;
}
