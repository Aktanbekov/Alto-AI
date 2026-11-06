import { CORPUS } from "../seo/site.js";

/*
 * The FAQ, once.
 *
 * FAQPage.jsx renders this, and scripts/build-seo.mjs turns the same array into
 * FAQPage JSON-LD at build time. Google requires the structured data to match
 * the visible content, and a hand-maintained second copy is how that
 * requirement quietly stops being met.
 *
 * Answers are plain text on purpose: JSON-LD `acceptedAnswer.text` allows only
 * a small set of inline HTML, and anything richer is a validation error. Keep
 * them prose.
 */

const { interviews, fromYear, toYear } = CORPUS;

export const FAQ = [
  {
    q: "What is Altovisas?",
    a: `Altovisas is a free practice tool for the United States F-1 student visa interview. You describe your profile and answer interview questions, and it returns an automated read of where a consular officer is most likely to push back on a case like yours. It is built on ${interviews.toLocaleString()} interview reports written by applicants about their own interviews between ${fromYear} and ${toYear}.`,
  },
  {
    q: "How does it work?",
    a: "You give a short profile - university, programme, funding, consulate - and answer three interview questions in your own words. Your answers are compared against the interview reports in the dataset, and you get back the specific points an officer is most likely to probe, along with the numbers behind each one. It takes about four minutes and needs a free account.",
  },
  {
    q: "Is it free?",
    a: "Yes. The profile check is free. It needs a free account, which keeps your rounds and progress, but never a credit card. The statistics on the home page are open to everyone without one.",
  },
  {
    q: "Where does the interview data come from?",
    a: `The dataset is ${interviews.toLocaleString()} accounts of F-1 visa interviews from ${fromYear} to ${toYear}, written by applicants about their own interviews and posted publicly online, then de-duplicated and parsed question by question. Roughly 200 more are added each month.`,
  },
  {
    q: "Can Altovisas predict whether my visa will be approved?",
    a: "No, and no tool can. The dataset is self-selected and self-reported: approval shares in it describe who chose to write something down, not the true approval rate at any consulate. Associations in the data are correlational, not causal. Nothing on the site predicts an individual outcome, and a visa decision is made solely by a consular officer.",
  },
  {
    q: "What questions do officers ask at an F-1 interview?",
    a: "The most common areas in the dataset are how the degree is funded and who is sponsoring it, the sponsor's occupation and income, which other universities you applied to, your undergraduate background and grades, why this university and this course, and what you plan to do after the degree. The mix varies noticeably by consulate.",
  },
  {
    q: "How long does the interview last?",
    a: "Most reports in the dataset describe an exchange of four or five questions lasting two to three minutes at the window. The brevity is why preparation tends to focus on the first answer to each topic rather than on long explanations.",
  },
  {
    q: "What documents should I bring?",
    a: "Requirements are set by the consulate, not by us, and they change. Check the instructions for your own consulate on travel.state.gov and any guidance from your designated school official. Applicants commonly report carrying their I-20, DS-160 confirmation, SEVIS fee receipt, passport, admission letter, and financial documents.",
  },
  {
    q: "Should I memorise the answers Altovisas suggests?",
    a: "No. Suggestions are about structure - what to lead with, what to leave out, how much detail to give. The facts inside an answer must be your own and must be true. Misrepresenting a material fact to a consular officer carries consequences that can last a lifetime.",
  },
  {
    q: "Is this legal or immigration advice?",
    a: "No. Altovisas is a practice tool, not a law firm, and it is not affiliated with the U.S. Department of State, any embassy or consulate, or any other government body. For advice about your own case, consult a licensed immigration attorney.",
  },
  {
    q: "Is my data secure?",
    a: "Your profile and answers are private to your account, are never shown to other users, and are not sold or published. You can have everything deleted by emailing us. The Privacy Policy sets out what is collected, who processes it, and how long it is kept.",
  },
  {
    q: "Can I practise more than once?",
    a: "Yes. You can run the profile check on more than one set of answers, and a short survey unlocks additional sets.",
  },
];

/*
 * The same questions in Russian, for the page itself. The structured data the
 * SEO build emits still comes from FAQ above, matching the English static
 * HTML that crawlers without JavaScript read.
 */
const interviewsRu = interviews.toLocaleString("ru-RU");

export const FAQ_RU = [
  {
    q: "Что такое Altovisas?",
    a: `Altovisas — бесплатный тренажёр для собеседования на студенческую визу США F-1. Вы рассказываете о себе и отвечаете на вопросы собеседования, а сервис автоматически показывает, где консульский офицер, скорее всего, засомневается в кейсе, похожем на ваш. В основе — база из ${interviewsRu} рассказов заявителей о собственных собеседованиях с ${fromYear} по ${toYear} год.`,
  },
  {
    q: "Как это работает?",
    a: "Вы кратко рассказываете о себе — университет, программа, финансирование, консульство — и своими словами отвечаете на три вопроса собеседования. Ваши ответы сравниваются с рассказами из базы, и вы получаете конкретные моменты, которые офицер, скорее всего, будет проверять, вместе с цифрами за каждым из них. Это занимает около четырёх минут и требует бесплатного аккаунта.",
  },
  {
    q: "Это бесплатно?",
    a: "Да. Проверка профиля бесплатна. Нужен бесплатный аккаунт, который хранит ваши раунды и прогресс, но банковская карта не нужна никогда. Статистика на сайте открыта всем и без аккаунта.",
  },
  {
    q: "Откуда берутся данные о собеседованиях?",
    a: `База состоит из ${interviewsRu} рассказов о собеседованиях на визу F-1 с ${fromYear} по ${toYear} год. Их написали сами заявители о своих собеседованиях и опубликовали в открытом доступе, а мы убрали дубликаты и разобрали каждый рассказ по вопросам. Каждый месяц добавляется примерно 200 новых.`,
  },
  {
    q: "Может ли Altovisas предсказать, одобрят ли мне визу?",
    a: "Нет, и этого не может ни один сервис. Рассказы публикуют сами заявители, и не все: доля одобрений в базе описывает тех, кто решил что-то написать, а не реальную долю одобрений в каком-либо консульстве. Связи в данных показывают, что вещи встречаются вместе, а не что одно вызывает другое. Ничто на сайте не предсказывает исход конкретного собеседования: решение о визе принимает только консульский офицер.",
  },
  {
    q: "Какие вопросы задают на собеседовании на F-1?",
    a: "Чаще всего в базе спрашивают о том, как оплачивается учёба и кто спонсор, о работе и доходе спонсора, о других университетах, куда вы подавали документы, о предыдущем образовании и оценках, о том, почему именно этот университет и эта программа, и о планах после учёбы. Набор вопросов заметно различается от консульства к консульству.",
  },
  {
    q: "Сколько длится собеседование?",
    a: "В большинстве рассказов из базы у окошка звучат четыре-пять вопросов за две-три минуты. Из-за этой краткости при подготовке важнее первый ответ на каждую тему, чем длинные объяснения.",
  },
  {
    q: "Какие документы взять с собой?",
    a: "Требования устанавливает консульство, а не мы, и они меняются. Проверьте инструкции своего консульства на travel.state.gov и указания ответственного сотрудника вашего университета (DSO). Заявители обычно берут с собой форму I-20, подтверждение DS-160, квитанцию об оплате сбора SEVIS, паспорт, письмо о зачислении и финансовые документы.",
  },
  {
    q: "Нужно ли заучивать ответы, которые предлагает Altovisas?",
    a: "Нет. Советы касаются структуры: с чего начать, что убрать, сколько деталей дать. Факты в ответе должны быть вашими и правдивыми. Искажение существенных фактов перед консульским офицером может иметь последствия на всю жизнь.",
  },
  {
    q: "Это юридическая или иммиграционная консультация?",
    a: "Нет. Altovisas — тренажёр, а не юридическая фирма, и он не связан ни с Государственным департаментом США, ни с каким-либо посольством или консульством, ни с другими государственными органами. За советом по своему делу обратитесь к лицензированному иммиграционному адвокату.",
  },
  {
    q: "Мои данные в безопасности?",
    a: "Ваш профиль и ответы видны только в вашем аккаунте, никогда не показываются другим пользователям, не продаются и не публикуются. Вы можете удалить всё, написав нам. В Политике конфиденциальности описано, что мы собираем, кто это обрабатывает и сколько хранится.",
  },
  {
    q: "Можно ли тренироваться несколько раз?",
    a: "Да. Проверку профиля можно пройти на нескольких наборах ответов, а короткий опрос открывает дополнительные наборы.",
  },
];
