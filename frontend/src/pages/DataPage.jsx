import CorpusDashboard from "../components/CorpusDashboard";
import { CORPUS } from "../seo/site";
import { useLang, useCopy, formatNumber, plural } from "../i18n";

const COPY = {
  ru: {
    title: (n, count) =>
      `Что показывают ${n} ${plural("ru", count, ["отзыв", "отзыва", "отзывов"])} о собеседованиях`,
    lede: (from, to) =>
      `Все цифры здесь взяты из отзывов студентов о своих собеседованиях с ${from} по ${to} год. ` +
      "Доступно всем без аккаунта, обновляется ежемесячно.",
  },
};

/*
 * The full statistics, on their own page. They used to sit in the middle of
 * the home page, where five charts and four tiles buried the story; the home
 * page now carries three findings and links here.
 */
export default function DataPage() {
  const { lang } = useLang();
  const c = useCopy(COPY);
  return (
    <div className="vz">
      <div className="page-w">
        <h1>{c.title(formatNumber(lang, CORPUS.interviews), CORPUS.interviews)}</h1>
        <p className="lede-vz">{c.lede(CORPUS.fromYear, CORPUS.toYear)}</p>
        <CorpusDashboard />
      </div>
    </div>
  );
}
