import CorpusDashboard from "../components/CorpusDashboard";
import { CORPUS } from "../seo/site";

/*
 * The full statistics, on their own page. They used to sit in the middle of
 * the home page, where five charts and four tiles buried the story; the home
 * page now carries three findings and links here.
 */
export default function DataPage() {
  return (
    <div className="vz">
      <div className="page-w">
        <h1>What {CORPUS.interviews.toLocaleString()} interview write-ups show</h1>
        <p className="lede-vz">
          Every number here comes from interviews students posted about themselves
          between {CORPUS.fromYear} and {CORPUS.toYear}. Open to everyone, no account
          needed, updated monthly.
        </p>
        <CorpusDashboard />
      </div>
    </div>
  );
}
