import AuthForm from "./AuthForm";
import { useShell } from "../shell/shellContext";
import { useCopy } from "../../i18n";

const COPY = {
  en: {
    title: "Profile check",
    lede: "You answer three questions officers ask most, in your own words. We compare them with real interviews from applicants like you and show where an officer is likely to push back.",
    whyTitle: "Why it needs an account",
    why: [
      ["Your free rounds are counted on it.", "Everyone gets two rounds of three questions, free."],
      ["Your progress is kept.", "Come back another day and you carry on from the round you reached, not from question one."],
      ["What you type stays private to your account.", "You can have all of it deleted at any time."],
    ],
    meta: "The account is free. No card, no payment.",
    formTitle: "Create your free account",
    formSub: "Then you go straight to your first round.",
  },
  ru: {
    title: "Проверка профиля",
    lede: "Вы своими словами отвечаете на три вопроса, которые офицеры задают чаще всего. Мы сравниваем ответы с реальными собеседованиями похожих заявителей и показываем, где офицер может засомневаться.",
    whyTitle: "Зачем нужен аккаунт",
    why: [
      ["На нём считаются бесплатные раунды.", "Каждый получает два бесплатных раунда по три вопроса."],
      ["Прогресс сохраняется.", "Вернитесь в другой день — и продолжите с того раунда, где остановились, а не с первого вопроса."],
      ["Всё, что вы вводите, видно только в вашем аккаунте.", "Вы можете удалить всё в любой момент."],
    ],
    meta: "Аккаунт бесплатный. Без карты и без оплаты.",
    formTitle: "Создайте бесплатный аккаунт",
    formSub: "После этого вы сразу перейдёте к первому раунду.",
  },
};

/*
 * What a signed-out visitor sees at /check-profile instead of a redirect.
 *
 * The check needs an account - it is where the free rounds, the reports and
 * the typed answers are kept - so the page says that, in place, and offers the
 * account right there. Before this, the free button on the home page dropped
 * people on a separate login screen with no reason given.
 */
export default function AccountGate({ onAuthed }) {
  const { setUser } = useShell();
  const c = useCopy(COPY);

  return (
    <div className="tf">
      <div className="page-w gate">
        <div className="gate-copy">
          <h1>{c.title}</h1>
          <p className="lede">{c.lede}</p>

          <h2 className="gate-h">{c.whyTitle}</h2>
          <ul className="gate-list">
            {c.why.map(([head, text]) => (
              <li key={head}>
                <strong>{head}</strong> {text}
              </li>
            ))}
          </ul>
          <p className="meta">{c.meta}</p>
        </div>

        <div className="auth-panel gate-panel">
          <AuthForm
            mode="signup"
            redirect="/check-profile"
            idPrefix="gate"
            autoFocus={false}
            title={c.formTitle}
            sub={c.formSub}
            onAuthed={(user) => {
              setUser(user);
              onAuthed?.(user);
            }}
          />
        </div>
      </div>
    </div>
  );
}
