import PreviewChip from "../components/shell/PreviewChip";
import { useCopy } from "../i18n";

// The conversation with Altovisas is in the reader's language. The two
// versions of the answer stay in English: they are what would be said at the
// window, and the interview is held in English.
const COPY = {
  ru: {
    facts: [
      "Отец: недвижимость, фермерство, доля в банке",
      "$300 000 отложено, подтверждено выписками из банка",
      "Ферма ведёт учёт на бумаге, урожайность не отслеживается",
      "После учёбы возвращаюсь в Бишкек",
      "Бакалавриат по Computer Science, Stanford, первая попытка",
      "Школьный балл 4,9 из 5",
    ],
    title: "Найдём ваш настоящий ответ",
    meta: "Слабое место 3 из 3 · ваши планы после учёбы",
    you: "Вы",
    first: "В вашем ответе сказано, что вы будете помогать бизнесу отца, но ни слова о том, где вы будете. В таком виде офицер может понять это как удалённую работу из США, а офицеры спрашивают, вернётесь ли вы домой, только когда уже сомневаются. Я не дам вам готовую фразу на замену. Где вы будете физически и что вы на самом деле построите первым?",
    reply: "В Бишкеке. На ферме вообще не отслеживают урожайность, всё записывают в тетради. Это я и сделаю первым.",
    second: "Вот это ответ. В нём есть страна, бизнес и конкретный первый проект, и именно этим настоящая связь с домом отличается от лозунга. Вот как он выглядит рядом с тем, что было.",
    wrote: "Что вы написали",
    assembled: "Собрано из ваших фактов",
    onlyIf: "Говорите это, только если это действительно ваше намерение.",
    refuseWho: "Если вы попросите нас что-то выдумать",
    refuse: "«Я не могу помочь вам сказать неправду. Ложное заявление консульскому офицеру считается существенным искажением фактов, а запрет на въезд за него пожизненный, и это гораздо хуже отказа, после которого можно подать снова. Расскажите, как всё на самом деле, и мы будем работать с этим. Кейсы, которые кажутся вам слабыми, обычно сильнее, чем вы думаете».",
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
