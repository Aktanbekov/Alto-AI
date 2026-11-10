import { Link, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { getMe } from "../api";
import { consumeOAuthRedirect } from "../utils/oauthReturn";
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
  ru: {
    h1a: "Собеседование на визу F-1.",
    h1b: "Подготовьтесь как следует.",
    lede: <>Ответьте на <strong>три настоящих вопроса с собеседований.</strong> Узнайте свои шансы пройти настоящее интервью.</>,
    cta: "Начать",
    free: "Бесплатно",
    meta: "Займёт 3 минуты.",
    // What sets the check apart, readable at a glance. Phrased with "из N"
    // so the noun form holds for any corpus size.
    proofLabel: "На чём основана проверка",
    proof: [
      ["Реальные собеседования", (n) => <>База из <strong>{n}</strong> отзывов студентов о визе F-1.</>],
      ["Настоящие вопросы", () => "Те, что визовые офицеры задают чаще всего."],
      ["ИИ сверяет с реальными случаями", () => "И показывает, что в ответе стоит объяснить яснее."],
    ],
    steps: [
      ["Расскажите о себе", "Университет, программа и кто платит за учёбу."],
      ["Ответьте на 3 вопроса", "Своими словами, как на настоящем собеседовании."],
      ["Получите разбор", "Сильные и слабые места ответа и что сказать иначе."],
    ],
    stakesA: "Короткое собеседование.",
    stakesB: "Большая новая глава.",
    stakesP: "Офицер слушает всего пару минут. За это время нужно ясно рассказать, где вы будете учиться, кто платит и какие у вас планы.",
    pullA: "Свои планы вы знаете.",
    pullB: "Мы поможем их",
    pullC: "объяснить.",
    whyTitle: "Почему мы?",
    whyPullA: "Мы не гадаем.",
    whyPullB: "Мы опираемся на факты.",
    // Phrased with "из N" and "о N": those cases take the same noun form for
    // any number, so the copy stays grammatical when the corpus grows.
    whyLede: (n) => <>У нас база из <strong>{n} реальных отзывов о собеседованиях на F-1.</strong> Студенты сами рассказали, что спрашивали офицеры, что они отвечали и чем всё закончилось.</>,
    reasons: [
      ["Одобрения и отказы", <>Мы изучаем обе стороны и видим, где офицеры просят подробностей.</>],
      ["ИИ сверяет ваш ответ с реальными случаями", <>Вы видите <strong>слабые места</strong> и что стоит объяснить яснее.</>],
      ["Открытая статистика", <>Частые вопросы и итоги по консульствам и ступеням обучения открыты для всех.</>],
    ],
    source: "Это отзывы самих студентов, а не официальные данные консульств. Они показывают закономерности, а не ваши шансы на одобрение.",
    howData: "Как мы используем данные",
    dataTitle: (n) => `Что говорят данные о ${n} собеседованиях`,
    dataLede: "Студенты рассказали, о чём их спрашивали и чем всё закончилось. Вот три главных вывода.",
    reviewsTitle: "Что говорят заявители после проверки",
    reviewsLede: "Студенты написали нам после проверки профиля. Выделенные строки отмечают то, что помогло им больше всего.",
    pricingA: "Выберите уровень подготовки.",
    pricingB: "Разовая оплата. Без подписки.",
    limitsTitle: "Чего мы не делаем",
    limits: [
      ["Не пишем за вас сценарий.", "Заученные ответы часто становятся поводом для отказа. Слова остаются вашими."],
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

const icon = (d) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{d}</svg>
);
// Interview write-ups, an officer's question, a checked answer.
const PROOF_ICONS = [
  icon(<path d="M5 3h10l4 4v14H5V3Zm10 0v5h4M8 12h8M8 16h6" />),
  icon(<path d="M20 15a2 2 0 0 1-2 2H8l-4 3V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2z" />),
  icon(<><path d="M9 12l2 2 4-4" /><circle cx="12" cy="12" r="9" /></>),
];

export default function HomePage() {
  const navigate = useNavigate();
  const { lang } = useLang();
  const c = useCopy(COPY);
  const interviews = formatNumber(lang, CORPUS.interviews);

  // Google sign-in return. main.jsx already moved the token out of the URL
  // and into storage; here the session is confirmed and the person continues
  // to where they were going (a same-site path, checked on both ends).
  useEffect(() => {
    const redirect = consumeOAuthRedirect();
    if (!redirect) return;
    getMe()
      .then(() => { if (redirect !== "/") navigate(redirect); })
      .catch(() => {});
  }, [navigate]);

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
              <h1>{c.h1a}<br /><span className="tone">{c.h1b}</span></h1>
              <p className="lede hero-lede">{c.lede}</p>
              <div className="hero-act">
                <button className="btn" onClick={() => start("hero")}>
                  {c.cta} <span className="btn-free">{c.free}</span>{" "}
                  <Arrow />
                </button>
              </div>
              <p className="meta">{c.meta}</p>
              <ul className="hero-proof" aria-label={c.proofLabel}>
                {c.proof.map(([title, text], i) => (
                  <li key={title}>
                    <span className="hero-proof-ic" aria-hidden="true">{PROOF_ICONS[i]}</span>
                    <span>
                      <b>{title}</b>
                      <span className="hero-proof-t">{text(interviews)}</span>
                    </span>
                  </li>
                ))}
              </ul>
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
          <h2>{c.stakesA}<br /><span className="tone">{c.stakesB}</span></h2>
          <p>{c.stakesP}</p>
        </div>
        <p className="pull">{c.pullA}<br /><span className="tone">{c.pullB} {c.pullC}</span></p>
      </section>

      {/* -------------------------------------------------------- why us -- */}
      <div className="band band-ink">
        <section className="wrap section why-us" id="why-us" aria-labelledby="why-us-heading">
          <div className="grid2">
            <div className="why-us-intro">
              <h2 id="why-us-heading">{c.whyTitle}</h2>
              <p className="pull">{c.whyPullA}<br /><span className="tone">{c.whyPullB}</span></p>
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
        <h2 id="pricing-heading">{c.pricingA}<br /><span className="tone">{c.pricingB}</span></h2>
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
          <h2>{c.closeA} <span className="tone">{c.closeB}</span></h2>
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
