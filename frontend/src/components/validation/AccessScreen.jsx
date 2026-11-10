import { useEffect } from "react";
import { track } from "../../analytics";
import WaitlistCard from "./WaitlistCard";
import { useCopy } from "../../i18n";

const COPY = {
  ru: {
    title: "Бесплатные раунды закончились",
    doneSub: "Включая три дополнительных раунда за опрос.",
    sub: "Каждый получает два бесплатных раунда по три вопроса. Продолжить можно двумя способами.",
    receipt: "Опрос пройден, спасибо. Три дополнительных раунда уже использованы.",
    survey: "Пройдите опрос за 2 минуты и получите ещё 3 раунда",
    support: "Семь коротких вопросов о том, как вы готовитесь. Без оплаты и без регистрации.",
  },
};

/*
 * Where someone lands once their free sets are spent.
 *
 * Two ways forward, and the survey is not a purchase: it buys three more sets
 * with two minutes of answers, and the copy says so plainly rather than dressing
 * it as a subscription. Once the survey is behind them the primary slot becomes
 * a receipt and the waitlist is all that is left - the screen never offers a
 * second unlock it cannot grant.
 */
export default function AccessScreen({ access, onStartSurvey, onWaitlistJoined }) {
  const done = access.survey_completed;
  const c = useCopy(COPY);

  useEffect(() => {
    track("access_screen_viewed", {
      sets_used: access.sets_used,
      survey_completed: done,
    });
  }, [access.sets_used, done]);

  return (
    <div className="ev-result">
      <div className="vz-card vac">
        <h2>{c.title}</h2>
        <p className="sub">{done ? c.doneSub : c.sub}</p>

        {done ? (
          <p className="vac-receipt" role="status">{c.receipt}</p>
        ) : (
          <div className="vac-primary">
            <button type="button" className="ev-submit" onClick={onStartSurvey}>
              {c.survey}
            </button>
            <p className="vac-support">{c.support}</p>
          </div>
        )}
      </div>

      <WaitlistCard access={access} onJoined={onWaitlistJoined} />
    </div>
  );
}
