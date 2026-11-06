import PreviewChip from "../components/shell/PreviewChip";
import { useCopy } from "../i18n";

// The conversation with Altovisas is in the reader's language. The two
// versions of the answer stay in English: they are what would be said at the
// window, and the interview is held in English.
const COPY = {
  en: {
    facts: [
      "Father: real estate, farming, stake in a bank",
      "$300,000 set aside, documented in bank statements",
      "Farm runs on paper - no yield tracking",
      "Returning to Bishkek after the degree",
      "BSc Computer Science, Stanford, first attempt",
      "School score 4.9 out of 5",
    ],
    title: "Let’s find your real answer",
    meta: "Weak point 3 of 3 · your plan after the degree",
    you: "You",
    first: "Your answer says you’ll help your father’s businesses, but it never says where you’ll be. As written, an officer can read it as remote work from the US - and officers only ask whether you’ll go home when they’re already unsure. I’m not going to hand you a replacement sentence. Where will you physically be, and what is the first thing you’d actually build?",
    reply: "In Bishkek. The farm has no yield tracking at all, everything is in notebooks. That’s the first thing I’d build.",
    second: "That’s the answer. It names a country, a business and a concrete first project, which is what separates a real tie from a slogan. Here it is against what you had.",
    wrote: "What you wrote",
    assembled: "Assembled from your facts",
    onlyIf: "Say this only if it is your actual intention.",
    refuseWho: "If you ask us to invent something",
    refuse: "“I can’t help you say something that isn’t true. A false statement to a consular officer is material misrepresentation, and the bar it carries is permanent - much worse than a refusal you can reapply from. Tell me what is true and we’ll work with that. Files that look weak to you are usually stronger than you think.”",
    ledger: "Your facts · everything is built from this",
    note: "Nothing we write for you comes from anywhere but this list. Edit or delete anything inaccurate - if it’s wrong here, it’s wrong at the window.",
  },
  ru: {
    facts: [
      "Отец: недвижимость, фермерство, доля в банке",
      "$300 000 отложено, подтверждено выписками из банка",
      "Ферма ведёт учёт на бумаге — урожайность не отслеживается",
      "После учёбы возвращаюсь в Бишкек",
      "Бакалавриат по Computer Science, Stanford, первая попытка",
      "Школьный балл 4,9 из 5",
    ],
    title: "Найдём ваш настоящий ответ",
    meta: "Слабое место 3 из 3 · ваши планы после учёбы",
    you: "Вы",
    first: "В вашем ответе сказано, что вы будете помогать бизнесу отца, но ни слова о том, где вы будете. В таком виде офицер может понять это как удалённую работу из США — а офицеры спрашивают, вернётесь ли вы домой, только когда уже сомневаются. Я не дам вам готовую фразу на замену. Где вы будете физически и что вы на самом деле построите первым?",
    reply: "В Бишкеке. На ферме вообще не отслеживают урожайность, всё записывают в тетради. Это я и сделаю первым.",
    second: "Вот это ответ. В нём есть страна, бизнес и конкретный первый проект — именно этим настоящая связь с домом отличается от лозунга. Вот как он выглядит рядом с тем, что было.",
    wrote: "Что вы написали",
    assembled: "Собрано из ваших фактов",
    onlyIf: "Говорите это, только если это действительно ваше намерение.",
    refuseWho: "Если вы попросите нас что-то выдумать",
    refuse: "«Я не могу помочь вам сказать неправду. Ложное заявление консульскому офицеру — это существенное искажение фактов, и запрет на въезд за него пожизненный — гораздо хуже отказа, после которого можно подать снова. Расскажите, как всё на самом деле, и мы будем работать с этим. Кейсы, которые кажутся вам слабыми, обычно сильнее, чем вы думаете».",
    ledger: "Ваши факты · всё строится из них",
    note: "Всё, что мы пишем для вас, берётся только из этого списка. Исправьте или удалите всё неточное: если здесь ошибка, она будет и у окошка.",
  },
};

export default function CaseBuilderPage() {
  const c = useCopy(COPY);
  return (
    <div className="tf">
    <div className="wrap pt pb">
      <PreviewChip />
      <div className="grid-case">
        <div>
          <h1 className="pv-title">{c.title}</h1>
          <p className="meta" style={{ marginBottom: 26 }}>{c.meta}</p>

          <div className="turn sys">
            <div className="who">Altovisas</div>
            <p className="said">{c.first}</p>
          </div>

          <div className="turn you">
            <div className="who">{c.you}</div>
            <p className="said">{c.reply}</p>
          </div>

          <div className="turn sys">
            <div className="who">Altovisas</div>
            <p className="said">{c.second}</p>
            <div className="ba">
              <div className="before" lang="en">
                <div className="tag">{c.wrote}</div>
                After graduation I want to help my father in his businesses by
                digitalizing and optimizing them, integrating the AI in the business aspects.
              </div>
              <div className="after" lang="en">
                <div className="tag">{c.assembled}</div>
                I&rsquo;ll return to Kyrgyzstan and work in my father&rsquo;s companies.
                The farm still runs on paper - no yield tracking at all - and
                that&rsquo;s the first system I want to build. That&rsquo;s the job my
                degree is for, and it&rsquo;s waiting for me.
              </div>
            </div>
            <p className="tiny" style={{ marginTop: 10 }}>{c.onlyIf}</p>
          </div>

          <div className="turn refuse">
            <div className="who">{c.refuseWho}</div>
            <p className="said">{c.refuse}</p>
          </div>
        </div>

        <aside className="ledger">
          <h2 className="ledger-h">{c.ledger}</h2>
          {c.facts.map((f) => (
            <div className="fact" key={f}><svg className="m" viewBox="0 0 12 12" width="12" height="12" aria-hidden="true"><path d="M2 6.5 4.8 9 10 3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg><span>{f}</span></div>
          ))}
          <p className="note">{c.note}</p>
        </aside>
      </div>
    </div>
    </div>
  );
}
