import { Link } from "react-router-dom";
import { CORPUS } from "../seo/site";
import Arrow from "../components/ui/Arrow";
import { useLang, useCopy, formatNumber } from "../i18n";

const { fromYear, toYear } = CORPUS;

const COPY = {
  en: {
    title: "How Altovisas works",
    lede: (n) => <>Altovisas checks your F-1 interview answers against what actually happened at the window: {n} interview write-ups that students posted about their own interviews between {fromYear} and {toYear}.</>,
    sections: [
      ["Where the data comes from", [
        "After their interview, many students write down what they were asked, what they said and what the officer decided, and post it publicly online. We collect those write-ups, remove duplicates, and split each one into the questions the officer asked. That gives 37 kinds of question and how often each comes up at each consulate. Roughly 200 new write-ups are added each month.",
      ]],
      ["What happens when you run a profile check", [
        "You give a short profile - university, course, funding, consulate - and answer three of the questions officers ask most, in your own words. We pull the interviews most like yours, matching on consulate, country and degree, and we always include refused ones, because a comparison that only sees approvals learns nothing about what sinks a case.",
        "An AI model reads your answers alongside those interviews and the statistics for your consulate, and writes your report: where an officer is likely to push back, what they may ask next, and how to fix each answer. It is instructed to quote numbers only from the data and never to estimate one.",
      ]],
      ["What the numbers can and cannot tell you", [
        "The write-ups are self-selected. People choose whether to post, and approved applicants post more readily, so an approval share describes who wrote something down - not the real approval rate at any consulate. Patterns in the data are associations, not causes. Nothing here predicts your outcome; only a consular officer decides.",
      ]],
    ],
    limitsTitle: "What we will not do",
    limits: [
      ["Write you a script.", "Rehearsed answers are one of the clearest refusal signals. The advice is about structure; the words are yours."],
      ["Invent facts for you.", "A false statement at the window can mean a permanent bar."],
      ["Promise you a visa.", "No tool can."],
      ["Give legal advice.", "This is interview preparation. We are not lawyers and have no connection to any consulate or government."],
    ],
    dataTitle: "Your data",
    data: (privacy) => <>What you type stays private to your account. To write your report, your profile and answers are sent to an AI provider for processing. The {privacy("Privacy Policy")} covers who processes what, how long it is kept, and how to have all of it deleted.</>,
    tryTitle: "Try it on your own answers",
    tryBody: "Three questions, about four minutes. It needs a free account.",
    cta: "Start your profile check",
  },
  ru: {
    title: "Как работает Altovisas",
    lede: (n) => <>Altovisas сверяет ваши ответы для собеседования на F-1 с тем, что на самом деле происходило у окошка: с {n} рассказами студентов о собственных собеседованиях с {fromYear} по {toYear} год.</>,
    sections: [
      ["Откуда берутся данные", [
        "После собеседования многие студенты записывают, о чём их спрашивали, что они ответили и какое решение принял офицер, и публикуют это в открытом доступе. Мы собираем такие рассказы, убираем дубликаты и разбиваем каждый на вопросы, которые задал офицер. Так получается 37 типов вопросов и то, как часто каждый звучит в каждом консульстве. Каждый месяц добавляется примерно 200 новых рассказов.",
      ]],
      ["Что происходит при проверке профиля", [
        "Вы кратко рассказываете о себе — университет, программа, финансирование, консульство — и своими словами отвечаете на три вопроса, которые офицеры задают чаще всего. Мы находим самые похожие собеседования по консульству, стране и ступени обучения и всегда включаем случаи с отказом: если смотреть только на одобрения, не поймёшь, что губит кейс.",
        "Модель ИИ читает ваши ответы вместе с этими собеседованиями и статистикой по вашему консульству и пишет отчёт: где офицер может засомневаться, о чём он может спросить дальше и как исправить каждый ответ. Ей запрещено придумывать цифры — только приводить их из данных.",
      ]],
      ["Что цифры могут сказать, а что — нет", [
        "Рассказы публикуют сами заявители. Люди сами решают, писать ли, а одобренные пишут охотнее, поэтому доля одобрений описывает тех, кто что-то написал, а не реальную долю одобрений в каком-либо консульстве. Закономерности в данных — это связи, а не причины. Ничто здесь не предсказывает ваш результат: решает только консульский офицер.",
      ]],
    ],
    limitsTitle: "Чего мы не делаем",
    limits: [
      ["Не пишем за вас сценарий.", "Заученные ответы — один из самых явных поводов для отказа. Советы касаются структуры, а слова остаются вашими."],
      ["Не выдумываем за вас факты.", "Ложное заявление у окошка может обернуться пожизненным запретом на въезд."],
      ["Не обещаем визу.", "Этого не может ни один сервис."],
      ["Не даём юридических консультаций.", "Это подготовка к собеседованию. Мы не юристы и не связаны ни с одним консульством или правительством."],
    ],
    dataTitle: "Ваши данные",
    data: (privacy) => <>То, что вы вводите, видно только в вашем аккаунте. Чтобы написать отчёт, ваш профиль и ответы передаются на обработку провайдеру ИИ. В {privacy("Политике конфиденциальности")} описано, кто что обрабатывает, сколько это хранится и как удалить всё целиком.</>,
    tryTitle: "Попробуйте на своих ответах",
    tryBody: "Три вопроса, около четырёх минут. Нужен бесплатный аккаунт.",
    cta: "Начать проверку профиля",
  },
};

/*
 * What the product does, where its numbers come from, and their limits.
 * Every figure here comes from CORPUS, which the build checks against the
 * dataset - the same rule as every other page.
 */
export default function AboutPage() {
  const { lang } = useLang();
  const c = useCopy(COPY);
  const privacy = (label) => <Link to="/privacy">{label}</Link>;

  return (
    <div className="tf">
      <article className="page-w doc">
        <h1>{c.title}</h1>
        <p className="lede">{c.lede(formatNumber(lang, CORPUS.interviews))}</p>

        {c.sections.map(([title, paragraphs]) => (
          <section key={title}>
            <h2>{title}</h2>
            {paragraphs.map((text) => <p key={text}>{text}</p>)}
          </section>
        ))}

        <section>
          <h2>{c.limitsTitle}</h2>
          <ul className="doc-list">
            {c.limits.map(([head, text]) => (
              <li key={head}><strong>{head}</strong> {text}</li>
            ))}
          </ul>
        </section>

        <section>
          <h2>{c.dataTitle}</h2>
          <p>{c.data(privacy)}</p>
        </section>

        <section className="doc-end">
          <h2>{c.tryTitle}</h2>
          <p>{c.tryBody}</p>
          <Link to="/check-profile" className="btn">
            {c.cta} <Arrow />
          </Link>
        </section>
      </article>
    </div>
  );
}
