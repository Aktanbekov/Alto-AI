import { useNavigate } from "react-router-dom";
import PreviewChip from "../components/shell/PreviewChip";
import Arrow from "../components/ui/Arrow";
import { useCopy } from "../i18n";

// The officer's question stays in English in both languages: the interview is
// held in English.
const COPY = {
  ru: {
    of: "Вопрос 2 из 3",
    src: "Задавали в 29,5% собеседований из данных · медианный устный ответ длится 14 секунд",
    micAria: "Голосовые ответы пока недоступны",
    mic: "Голосовые ответы скоро появятся. Этот экран ничего не записывает.",
    type: "Удобнее печатать? Переключитесь на текст. Но настоящее собеседование устное, и теряются люди именно тогда, когда нужно говорить.",
    none: "Разбора пока нет. Все три ответа оцениваются вместе и сравниваются с похожими отзывами, поэтому отчёт смотрит на ваш кейс целиком, а не на каждый ответ по отдельности.",
    check: "Проверить ответы",
    hint: "Введите профиль и ответы, и мы сравним их с базой",
  },
};

export default function TakeATestPage() {
  const navigate = useNavigate();
  const c = useCopy(COPY);

  // The spoken flow above is still a prototype, so the page hands the user off
  // to the evaluator - the same grounded scoring the home page CTA opens. No
  // login detour any more: two practice sets are free to everyone, account or
  // not, so sending a guest to /login would gate what is no longer gated.
  const evaluate = () => navigate("/check-profile");

  return (
    <div className="tf">
    <div className="narrow pt pb">
      <PreviewChip />
      <div className="topbar">
        <span className="tiny">{c.of}</span>
        <span className="timer is-static">00:47</span>
      </div>

      <h1 className="q" lang="en">Who is sponsoring your education?</h1>
      <p className="q-src">{c.src}</p>

      {/* A picture of the recorder, not a recorder: nothing here listens, so
          nothing here can be pressed or pulses as if it were live. */}
      <div className="mic is-static" aria-label={c.micAria} role="img">
        <span className="ring"><i /></span>
        <span>{c.mic}</span>
      </div>

      <p className="tiny" style={{ marginTop: 16, textAlign: "center" }}>{c.type}</p>

      <div style={{ marginTop: 40, borderTop: "1px solid var(--rule)", paddingTop: 20 }}>
        <p className="tiny">{c.none}</p>
        <div style={{ display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap", marginTop: 22 }}>
          <button className="btn" type="button" onClick={evaluate}>
            {c.check} <Arrow />
          </button>
          <span className="tiny">{c.hint}</span>
        </div>
      </div>
    </div>
    </div>
  );
}
