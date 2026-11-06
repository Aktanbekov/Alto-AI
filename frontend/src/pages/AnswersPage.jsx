import PreviewChip from "../components/shell/PreviewChip";
import { useCopy } from "../i18n";

// The quoted answers stay in English in both languages - they are what was
// said at the window. The commentary around them is the reader's language.
const ENTRIES = [
  {
    tone: "r",
    body: "It is ranked number two in the world and has the best professors in my field.",
  },
  {
    tone: "a",
    body: "Their data-systems track has a distributed databases sequence I want, and two of the faculty publish in the area I worked in at my last job.",
  },
  {
    tone: "r",
    body: "My consultant recommended it and the fees were affordable compared to others.",
  },
];

const COPY = {
  en: {
    outcome: { r: "Refused", a: "Approved" },
    meta: ["Chennai · Bachelor's · 2024", "New Delhi · Masters · 2025", "Mumbai · Bachelor's · 2023"],
    notes: [
      "The officer’s next question was \"So why not other uni?\" - a ranking answer has no defence against that, because every top school shares the same claim.",
      "Names a course sequence and a link to the applicant's own history. Nothing here is transferable to another school, which is exactly why it reads as true.",
      "Two problems in one sentence: the decision belongs to somebody else, and cost as the reason invites the funding probe immediately.",
    ],
    title: <>&ldquo;Why this university?&rdquo; - real answers</>,
    meta2: "Free and public · one page per question",
    lede: "2,339 posts recorded this question. Approval when it was asked: 79.7%, which is 7.5 points below the corpus-wide share. Here are answers as they were reported, with the outcome the poster stated.",
    diffTitle: "What separates the two groups",
    diff: "Approved answers in this set almost always name something that exists only at that university - a named course, a lab, a professor’s work. Refused answers name something true of any good university - rank, reputation, facilities. That’s the whole difference, and it costs you an hour with the course catalogue.",
    more: "More: Who is funding you · What will you do after graduation · How many universities did you apply to · Why the USA · Have you taken a loan",
  },
  ru: {
    outcome: { r: "Отказ", a: "Одобрено" },
    meta: ["Ченнаи · Бакалавриат · 2024", "Нью-Дели · Магистратура · 2025", "Мумбаи · Бакалавриат · 2023"],
    notes: [
      "Следующий вопрос офицера был «So why not other uni?» — ответу про рейтинг на это нечего возразить: то же самое можно сказать о любом топовом университете.",
      "Называет конкретную последовательность курсов и связь с собственным опытом заявителя. Ничего из этого нельзя перенести на другой университет — поэтому ответ и звучит правдиво.",
      "Две проблемы в одном предложении: решение принял кто-то другой, а стоимость как причина сразу вызывает расспросы о финансировании.",
    ],
    title: <><span lang="en">&ldquo;Why this university?&rdquo;</span> — реальные ответы</>,
    meta2: "Бесплатно и открыто · одна страница на каждый вопрос",
    lede: "Этот вопрос встречается в 2 339 рассказах. Доля одобрений, когда его задавали: 79,7% — на 7,5 пункта ниже, чем по всей базе. Вот ответы в том виде, в каком о них рассказали, с итогом, который указал автор.",
    diffTitle: "Чем отличаются две группы",
    diff: "Одобренные ответы почти всегда называют то, что есть только в этом университете: конкретный курс, лабораторию, работу профессора. Ответы с отказом называют то, что верно для любого хорошего университета: рейтинг, репутацию, оснащение. В этом вся разница, и на неё уйдёт час с каталогом курсов.",
    more: "Ещё: Кто вас финансирует · Что вы будете делать после учёбы · В сколько университетов вы подавали · Почему США · Брали ли вы кредит",
  },
};

export default function AnswersPage() {
  const c = useCopy(COPY);
  return (
    <div className="tf">
    <div className="wrap pt pb">
      <PreviewChip />
      <h1 className="pv-title">{c.title}</h1>
      <p className="meta" style={{ marginBottom: 14 }}>{c.meta2}</p>
      <p className="lede" style={{ marginBottom: 26 }}>{c.lede}</p>

      {ENTRIES.map((e, i) => (
        <div className="lib" key={e.body}>
          <div className="lib-h">
            <span className={`pill ${e.tone}`}>{c.outcome[e.tone]}</span>
            <span className="tiny">{c.meta[i]}</span>
          </div>
          <div className="lib-b" lang="en">{e.body}</div>
          <div className="lib-f">{c.notes[i]}</div>
        </div>
      ))}

      <div className="card" style={{ marginTop: 26 }}>
        <h2 className="card-h">{c.diffTitle}</h2>
        <p className="why">{c.diff}</p>
      </div>

      <p className="tiny" style={{ marginTop: 22 }}>{c.more}</p>
    </div>
    </div>
  );
}
