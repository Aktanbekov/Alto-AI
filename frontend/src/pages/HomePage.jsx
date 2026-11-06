import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useEffect } from "react";
import { getMe } from "../api";
import { setAccessToken } from "../utils/tokenStorage";
import { safeRedirect } from "../utils/authRedirect";
import HomeFindings from "../components/HomeFindings";
import HomeInterviewPreview from "../components/HomeInterviewPreview";
import HomeReviews from "../components/HomeReviews";
import PricingPlans from "../components/PricingPlans";
import { track } from "../analytics";
import { CORPUS } from "../seo/site";
import Arrow from "../components/ui/Arrow";
import { useLang, useCopy, formatNumber } from "../i18n";
import "./HomePage.css";

const COPY = {
  en: {
    h1a: "Your F-1 interview.",
    h1b: "Better prepared.",
    lede: <>Answer <strong>three real interview questions.</strong> Get clear feedback on what to improve and how to explain your plans with confidence.</>,
    cta: "Start your profile check",
    free: "Free",
    meta: "About four minutes. Needs a free account.",
    builtOn: (n) => <>Built on <strong>{n} real interview reports</strong></>,
    steps: [
      ["Share your plans", "Your university, your course and who pays. A minute or two."],
      ["Answer three real questions", "The ones officers ask most, one at a time, in your own words."],
      ["Know what to improve", "Clear feedback, real interview examples and practical next steps."],
    ],
    stakesA: "A short interview.",
    stakesB: "A big next chapter.",
    stakesP: "Your university, your funding, your plans for the future. You need to explain them clearly, even when the next question catches you off guard.",
    pullA: "You know your plans.",
    pullB: "We help you",
    pullC: "explain them.",
    whyTitle: "Why us?",
    whyPullA: "We’re not guessing.",
    whyPullB: "We start with evidence.",
    whyLede: (n) => <>Your preparation should start with real experience. Altovisas draws on <strong>{n} real F-1 interview reports</strong> shared by students, covering what officers asked, how applicants answered and what happened next.</>,
    reasons: [
      ["Real interviews behind the advice", <>We look at both approvals and refusals to understand the questions applicants face and where officers ask for more detail.</>],
      ["AI guided by that experience", <>Our AI checks your answers against <strong>real interview experiences and statistics.</strong> You get feedback on weak points and what to explain more clearly.</>],
      ["Statistics you can explore", <>See which questions come up most and how reported experiences differ by consulate and degree. The numbers behind our approach are open for you to explore.</>],
    ],
    source: "These are students’ own reports, not official consular records. They show patterns, not your chances of approval.",
    howData: "How we use the data",
    dataTitle: (n) => `What ${n} interviews show`,
    dataLede: "Students wrote down what they were asked and what happened. Three things stand out.",
    reviewsTitle: "What applicants say after the check",
    reviewsLede: "Students wrote to us once they had run their profile check. The marked lines are the parts they said helped most.",
    pricingA: "Choose your prep level.",
    pricingB: "One-time. No subscription.",
    limitsTitle: "What we won’t do",
    limits: [
      ["Write you a script.", "Memorised answers are a common refusal signal. The words stay yours."],
      ["Invent facts.", "A false statement at the window can bar you permanently."],
      ["Promise a visa.", "Only the officer decides. Our numbers predict nothing about you."],
      ["Give legal advice.", "We are not lawyers, and not linked to any consulate or government."],
    ],
    closeA: "Your next chapter starts with",
    closeB: "a clearer answer.",
    closeMeta: "Want help fixing them? A paid version that rebuilds each answer with you and drills you by voice is on the way.",
    howItWorks: "How it works",
    questions: "Questions",
  },
  ru: {
    h1a: "Собеседование на визу F-1.",
    h1b: "Подготовьтесь как следует.",
    lede: <>Ответьте на <strong>три настоящих вопроса с собеседований.</strong> Получите понятный разбор: что улучшить и как уверенно объяснить свои планы.</>,
    cta: "Начать проверку профиля",
    free: "Бесплатно",
    meta: "Около четырёх минут. Нужен бесплатный аккаунт.",
    builtOn: (n) => <>Основано на <strong>{n} реальных отчётах о собеседованиях</strong></>,
    steps: [
      ["Расскажите о планах", "Университет, программа и кто платит. Минута-две."],
      ["Ответьте на три настоящих вопроса", "Те, что офицеры задают чаще всего, по одному, своими словами."],
      ["Узнайте, что улучшить", "Понятный разбор, примеры реальных собеседований и конкретные следующие шаги."],
    ],
    stakesA: "Короткое собеседование.",
    stakesB: "Большая новая глава.",
    stakesP: "Университет, финансирование, планы на будущее. Всё это нужно объяснить ясно — даже когда следующий вопрос застаёт врасплох.",
    pullA: "Свои планы вы знаете.",
    pullB: "Мы поможем их",
    pullC: "объяснить.",
    whyTitle: "Почему мы?",
    whyPullA: "Мы не гадаем.",
    whyPullB: "Мы опираемся на факты.",
    // Phrased with "из N" and "о N": those cases take the same noun form for
    // any number, so the copy stays grammatical when the corpus grows.
    whyLede: (n) => <>Подготовка должна опираться на реальный опыт. Altovisas работает с базой из <strong>{n} реальных отчётов о собеседованиях на F-1</strong>, которыми поделились студенты: что спрашивали офицеры, как отвечали заявители и чем всё закончилось.</>,
    reasons: [
      ["За советами — реальные собеседования", <>Мы смотрим и на одобрения, и на отказы, чтобы понять, с какими вопросами сталкиваются заявители и где офицеры просят подробностей.</>],
      ["ИИ, который опирается на этот опыт", <>Наш ИИ сверяет ваши ответы с <strong>реальными собеседованиями и статистикой.</strong> Вы узнаёте свои слабые места и что стоит объяснить яснее.</>],
      ["Статистика в открытом доступе", <>Посмотрите, какие вопросы звучат чаще всего и как опыт заявителей различается по консульствам и ступеням обучения. Цифры, на которых строится наш подход, открыты для всех.</>],
    ],
    source: "Это рассказы самих студентов, а не официальные данные консульств. Они показывают закономерности, а не ваши шансы на одобрение.",
    howData: "Как мы используем данные",
    dataTitle: (n) => `Что говорят данные о ${n} собеседованиях`,
    dataLede: "Студенты записали, о чём их спрашивали и чем всё закончилось. Выделяются три вещи.",
    reviewsTitle: "Что говорят заявители после проверки",
    reviewsLede: "Студенты написали нам после проверки профиля. Выделенные строки — то, что помогло им больше всего.",
    pricingA: "Выберите уровень подготовки.",
    pricingB: "Разовая оплата. Без подписки.",
    limitsTitle: "Чего мы не делаем",
    limits: [
      ["Не пишем за вас сценарий.", "Заученные ответы — частый повод для отказа. Слова остаются вашими."],
      ["Не выдумываем факты.", "Ложное заявление у окошка может навсегда закрыть въезд."],
      ["Не обещаем визу.", "Решает только офицер. Наши цифры ничего не предсказывают о вас."],
      ["Не даём юридических консультаций.", "Мы не юристы и не связаны ни с одним консульством или правительством."],
    ],
    closeA: "Новая глава начинается с",
    closeB: "ясного ответа.",
    closeMeta: "Нужна помощь с исправлением? Скоро появится платная версия: она вместе с вами переработает каждый ответ и потренирует вас голосом.",
    howItWorks: "Как это работает",
    questions: "Частые вопросы",
  },
};

export default function HomePage() {
  const navigate = useNavigate();
  const { lang } = useLang();
  const c = useCopy(COPY);
  const interviews = formatNumber(lang, CORPUS.interviews);
  const [searchParams, setSearchParams] = useSearchParams();

  // Google OAuth callback: the backend redirects here with an access token.
  useEffect(() => {
    const accessToken = searchParams.get("access_token");
    const redirect = searchParams.get("redirect");
    if (!accessToken) return;

    setAccessToken(accessToken);
    searchParams.delete("access_token");
    if (redirect) searchParams.delete("redirect");
    setSearchParams(searchParams, { replace: true });

    getMe()
      .then(() => {
        // The path made a round trip through Google and back as a query
        // parameter, so it is only trusted as far as being same-site.
        if (redirect) navigate(safeRedirect(redirect));
      })
      .catch(() => {});
  }, [searchParams, setSearchParams, navigate]);

  // The check itself asks a signed-out visitor for a free account, in place
  // and with the reason, so the button only has to say that it needs one.
  const start = (location = "hero") => {
    track("cta_click", { location });
    navigate("/check-profile");
  };

  return (
    <div className="tf home-page">
      {/* ---------------------------------------------------------- hero --
          The tinted band: the promise, the one action, and a sample of what
          comes back. */}
      <div className="hero-band">
        <div className="wrap">
          <div className="grid2 hero">
            <div>
              <h1>{c.h1a}<br /><span className="home-headline-emphasis">{c.h1b}</span></h1>
              <p className="lede hero-lede">{c.lede}</p>
              <div className="hero-act">
                <button className="btn" onClick={() => start("hero")}>
                  {c.cta} <span className="btn-free">{c.free}</span>{" "}
                  <Arrow />
                </button>
              </div>
              <p className="meta">{c.meta}</p>
              <Link className="home-evidence-link" to="/#why-us">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
                  <path d="M5 3h10l4 4v14H5V3Zm10 0v5h4M8 12h8M8 16h6" strokeLinejoin="round" />
                </svg>
                <span>{c.builtOn(interviews)}</span>
                <Arrow />
              </Link>
            </div>

            <HomeInterviewPreview />
          </div>
        </div>

        {/* ------------------------------------------------------ steps --
            How it works, in the order it happens. The numbers are the
            sequence, not decoration. */}
        <div className="wrap">
          <ol className="steps">
            {c.steps.map(([title, text], i) => (
              <li key={i}>
                <span className="step-n">{i + 1}</span>
                <h2>{title}</h2>
                <p>{text}</p>
              </li>
            ))}
          </ol>
        </div>
      </div>

      {/* -------------------------------------------------------- stakes -- */}
      <section className="wrap section stakes-short">
        <div>
          <h2>{c.stakesA}<br /><mark>{c.stakesB}</mark></h2>
          <p>{c.stakesP}</p>
        </div>
        <p className="pull">{c.pullA}<br />{c.pullB} <span className="home-underline">{c.pullC}</span></p>
      </section>

      {/* -------------------------------------------------------- why us -- */}
      <div className="band band-ink">
        <section className="wrap section why-us" id="why-us" aria-labelledby="why-us-heading">
          <div className="grid2">
            <div className="why-us-intro">
              <h2 id="why-us-heading">{c.whyTitle}</h2>
              <p className="pull">{c.whyPullA}<br /><mark>{c.whyPullB}</mark></p>
              <p className="lede">{c.whyLede(interviews)}</p>
            </div>
            <ul className="why-us-reasons">
              {c.reasons.map(([title, text]) => (
                <li key={title}>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </li>
              ))}
            </ul>
          </div>
          <div className="why-us-source">
            <p>{c.source}</p>
            <Link to="/about" className="why-us-link">
              {c.howData} <Arrow />
            </Link>
          </div>
        </section>
      </div>

      {/* ---------------------------------------------------------- data -- */}
      <section className="wrap section data-short" id="the-data">
        <h2>{c.dataTitle(interviews)}</h2>
        <p className="lede">{c.dataLede}</p>
        <HomeFindings />
      </section>

      {/* ------------------------------------------------------ reviews --
          Placeholder reviews, not from real applicants yet, so they render in
          local development only. Swap in real, permissioned reviews in
          data/reviews.js and drop the DEV check to publish them. */}
      {import.meta.env.DEV && (
      <div className="band band-paper">
        <section className="wrap section reviews" id="reviews" aria-labelledby="reviews-heading">
          <h2 id="reviews-heading">{c.reviewsTitle}</h2>
          <p className="lede">{c.reviewsLede}</p>
          <HomeReviews />
        </section>
      </div>
      )}

      {/* ------------------------------------------------------ pricing -- */}
      <section className="wrap section pricing" id="pricing" aria-labelledby="pricing-heading">
        <h2 id="pricing-heading">{c.pricingA}<br /><mark>{c.pricingB}</mark></h2>
        <PricingPlans onStart={() => start("pricing")} detailsLink />
      </section>

      {/* ------------------------------------------------------ limits --- */}
      <div className="band band-paper">
        <section className="wrap section limits">
          <h2>{c.limitsTitle}</h2>
          <ul className="no-grid">
            {c.limits.map(([head, text]) => (
              <li key={head}><strong>{head}</strong> {text}</li>
            ))}
          </ul>
        </section>
      </div>

      {/* ------------------------------------------------------- close --- */}
      <div className="close-band band-ink">
        <div className="wrap">
          <h2>{c.closeA} <span className="home-underline">{c.closeB}</span></h2>
          <div className="hero-act">
            <button className="btn" onClick={() => start("close")}>
              {c.cta} <span className="btn-free">{c.free}</span>{" "}
              <Arrow />
            </button>
          </div>
          <p className="meta">
            {c.closeMeta} <Link to="/about">{c.howItWorks}</Link> ·{" "}
            <Link to="/faq">{c.questions}</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
