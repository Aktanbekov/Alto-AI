import { LANG } from "./lang";

/*
 * Russian copy for the whole site.
 *
 * Dependency-free on purpose. Each component keeps its text next to the markup
 * that uses it (`const COPY = { ru: {...} }`, read through useCopy), because a
 * shared dictionary is where strings go stale: nobody editing a page opens it.
 * The tables are still keyed by language, so adding another one back later is a
 * matter of adding a key, not restructuring a page.
 */

/** The site language. Constant: there is no switch. */
export function getLang() {
  return LANG;
}

export const useLang = () => ({ lang: LANG });

/** This component's copy. */
export function useCopy(table) {
  return table[LANG];
}

/**
 * The right Russian word form for a count: [one, few, many].
 * 1 раунд, 2 раунда, 5 раундов, 21 раунд.
 */
export function plural(lang, n, forms) {
  const abs = Math.abs(n);
  const tens = abs % 100;
  const ones = abs % 10;
  if (tens >= 11 && tens <= 14) return forms[2];
  if (ones === 1) return forms[0];
  if (ones >= 2 && ones <= 4) return forms[1];
  return forms[2];
}

/** A number the way Russian writes it: 16 204. */
export function formatNumber(lang, n) {
  if (n == null || Number.isNaN(Number(n))) return "";
  return Number(n).toLocaleString("ru-RU");
}

/*
 * The server writes its messages in English. The ones a student can actually
 * see are listed here so nobody gets a sudden English line in the middle of a
 * Russian form. Anything unlisted is shown as the server wrote it: an
 * untranslated message beats a wrong one.
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
  [/scoring is temporarily unavailable/i, "Проверка временно недоступна. Ваши ответы сохранены, попробуйте ещё раз через несколько минут."],
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
  if (!message) return message;
  const hit = SERVER_RU.find(([pattern]) => pattern.test(message));
  return hit ? hit[1] : message;
}
