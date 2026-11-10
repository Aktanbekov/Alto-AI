import PreviewChip from "../components/shell/PreviewChip";
import { useCopy } from "../i18n";

// What the officer says stays in English in both languages: the interview is
// held in English. Everything around it is the reader's language.
const COPY = {
  ru: {
    readout: [
      { k: "Длительность", v: <>31 секунда <span className="tiny">· медиана в базе: 14</span></> },
      { k: "Ответили на вопрос", v: "Да, чёткое «нет» с объяснением", tone: "ok" },
      { k: "Совпадает с вашим кейсом", v: "Нет, вы упомянули предложение о работе, которого нет в ваших фактах", tone: "bad" },
      { k: "Неуверенность", v: "7 оговорок: «maybe», «I think», «probably»" },
    ],
    drill: "Тренировка 4 · слабое место 03",
    src: "Уточняющий вопрос · создан по вашему слабому месту, а не взят из готового списка",
    micAria: "Голосовые ответы пока недоступны",
    mic: "Голосовые ответы скоро появятся. Этот экран ничего не записывает.",
    next: "Куда офицер пойдёт дальше",
    modeTitle: "Режим неожиданных вопросов",
    mode: "Задаёт вопрос, к которому вы не готовились, прямо из расшифровок. Растеряться больше всего боятся студенты, и именно это надёжно лечится практикой.",
    sessions: "Сессии специально длятся три минуты. Коротко и часто лучше, чем одна долгая репетиция: после долгой репетиции вы и звучите заученно.",
  },
};

export default function VoiceInterviewPage() {
  const c = useCopy(COPY);

  return (
    <div className="tf">
    <div className="narrow pt pb">
      <PreviewChip />
      <div className="topbar">
        <span className="tiny">{c.drill}</span>
        <span className="timer"><i className="dot" />02:12</span>
      </div>

      <h1 className="q" lang="en">So you&rsquo;ll just stay in America after your OPT, won&rsquo;t you?</h1>
      <p className="q-src">{c.src}</p>

      <div className="mic is-static" role="img" aria-label={c.micAria}>
        <span className="ring"><i /></span><span>{c.mic}</span>
      </div>

      <div className="readout">
        {c.readout.map((r) => (
          <div className="rrow" key={r.k}>
            <span className="k">{r.k}</span>
            <span className={`v${r.tone ? ` ${r.tone}` : ""}`}>{r.v}</span>
          </div>
        ))}
        <div className="probe">
          <div className="k">{c.next}</div>
          <div className="v" lang="en">&ldquo;Which company offered you that job?&rdquo;</div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 22 }}>
        <h4 style={{ marginBottom: 8 }}>{c.modeTitle}</h4>
        <p className="why">{c.mode}</p>
      </div>

      <p className="tiny" style={{ marginTop: 18 }}>{c.sessions}</p>
    </div>
    </div>
  );
}
