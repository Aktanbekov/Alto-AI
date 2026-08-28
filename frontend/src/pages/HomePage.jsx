import { useNavigate, useSearchParams } from "react-router-dom";
import { useEffect } from "react";
import { getMe } from "../api";
import { setAccessToken } from "../utils/tokenStorage";
import { safeRedirect } from "../utils/authRedirect";
import CorpusDashboard from "../components/CorpusDashboard";
import { track } from "../analytics";

export default function HomePage() {
  const navigate = useNavigate();
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

  // The first profile check is available to guests. The server asks them to
  // create an account only when they come back for another report.
  const start = (location = "hero") => {
    track("cta_click", { location });
    navigate("/check-profile");
  };

  return (
    <>
      <div className="tf">
      {/* The green band covers the hero and the three-cell strip only;
          everything below it sits on white. */}
      <div className="hero-band">
      {/* ---------------------------------------------------------- hero -- */}
      <div className="wrap">
        <div className="grid2" style={{ padding: "64px 0 56px", alignItems: "center" }}>
          <div>
            <p className="eyebrow">16,204 interviews · 14,589 full transcripts · 2020–2026</p>
            <h1>Find out where your interview breaks.</h1>
            <p className="lede">
              Tell us your profile and answer three questions. We read them against
              16,204 real interview write-ups, name the exact points where officers
              push back on files like yours, and show you what to fix.
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap", marginTop: 28 }}>
              <button className="btn" onClick={() => start("hero")}>
                Check my profile <span className="arrow">→</span>
              </button>
              <span className="tiny">Free · no account · 4 minutes</span>
            </div>
            <p className="tiny" style={{ marginTop: 24, maxWidth: "44ch" }}>
              Or read the{" "}
              <a href="#the-data" style={{ color: "var(--ink)" }}>whole dataset</a>{" "}
              first. It&rsquo;s public, it&rsquo;s free, and the caveats are printed at the top.
            </p>
          </div>

          <div className="foil">
            <svg className="foil-g" viewBox="0 0 400 240" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
              <use href="#guil" />
            </svg>
            <div className="foil-in">
              <div className="foil-head">
                <div className="t">Profile check · sample</div>
                <div className="t">Chennai</div>
              </div>
              <div className="foil-score">
                <div className="big">34.7<span style={{ fontSize: 26 }}>%</span></div>
                <div className="cap">of comparable posts reported a refusal</div>
              </div>
              <div className="foil-meta">
                <div><span>Comparable posts</span>528</div>
                <div><span>Weak points found</span>3</div>
              </div>
            </div>
            <div className="mrz">BSC&lt;CS&lt;&lt;BACH&lt;&lt;FATHER&lt;&lt;CHENNAI&lt;&lt;F1&lt;&lt;A1&lt;&lt;FLAGS3&lt;&lt;&lt;</div>
          </div>
        </div>
      </div>

      <div className="wrap"><div className="grid3">
        <div className="gcell">
          <div className="k">Free</div>
          <div className="v">Your weak points, named</div>
          <p>The full diagnosis: which of your answers an officer will push on, what they&rsquo;ll ask next, and the numbers behind it.</p>
        </div>
        <div className="gcell">
          <div className="k">Paid · one payment</div>
          <div className="v">Your case, rebuilt</div>
          <p>We work through each weak point and rebuild the answer out of facts you give us. Then we drill you by voice with the follow-ups.</p>
        </div>
        <div className="gcell">
          <div className="k">Where the data comes from</div>
          <div className="v">Students, after the window</div>
          <p>Self-reported write-ups posted publicly to Telegram, deduplicated and parsed question by question. Roughly 200 more each month.</p>
        </div>
      </div></div>
      </div>{/* /.hero-band */}

      {/* -------------------------------------------------------- stakes -- */}
      <div className="stakes">
        <div className="wrap">
          <p className="eyebrow">The interview</p>
          <h2>It is over in about three minutes.</h2>
          <p>
            You will have spent a year on applications, paid the SEVIS and MRV fees,
            taken a day off and stood in a queue. Then someone behind glass asks four
            or five questions and decides. There is no appeal, no second look at your
            file, and no moment where you get to explain what you meant.
          </p>
          <p>
            And it turns on small things. Saying a university is{" "}
            <b>ranked second in the world</b> instead of naming a course you want to
            take. Listing three of your father&rsquo;s businesses without a single
            number attached to any of them. Saying you would like to stay. None of
            those mean your case is weak — they mean it was <b>stated badly</b>. From
            the other side of the glass, in three minutes, badly stated and weak look
            exactly the same.
          </p>
        </div>
      </div>

      <div className="wrap section">
        <p className="pull">
          Most students who get refused don&rsquo;t have a bad case. They have a good
          case they can&rsquo;t explain yet.
        </p>
        <p className="lede">
          The officer is not looking for a perfect applicant. They are looking for a
          plan that holds together and money that is accounted for. Plenty of students
          have both and still walk out without a visa, because they were answering a
          question they had never once said out loud.
        </p>
        <p className="lede" style={{ marginTop: 18 }}>
          That part is fixable, and it is the only part of this you control. You
          can&rsquo;t change your GPA in three weeks, or which consulate you were
          assigned, or how many refusals came before you in the queue. You can change
          whether you know what is coming and whether your answers survive the second
          question.
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap", marginTop: 28 }}>
          <button className="btn" onClick={() => start("stakes")}>
            Check my profile <span className="arrow">→</span>
          </button>
          <span className="tiny">Free · takes 4 minutes · nothing to install</span>
        </div>
      </div>

      </div>{/* /.tf */}

      {/* ---------------------------------------------------------- data --
          The dashboard keeps visa_llm's own look — white cards, blue/red
          series, sans-serif — rather than the Alto Visas paper/ink treatment. */}
      <div className="vz" id="the-data">
        <div className="page-w">
          <h1>What 16,204 interview write-ups show</h1>
          <p className="sub" style={{ marginBottom: 18 }}>Public · free · updated monthly</p>
          <CorpusDashboard />
        </div>
      </div>

      <div className="tf">
      {/* ------------------------------------------------------ limits --- */}
      <div className="wrap section" style={{ paddingTop: 0 }}>
        <h2>What this tool will not do</h2>
        <ul className="no-list">
          <li><strong>Write you a script.</strong> Rehearsed answers are one of the clearest refusal signals an officer sees. We build answers from what you tell us, in your words.</li>
          <li><strong>Invent facts for you.</strong> A false statement at the window is a permanent bar, not a refusal you can reapply from. If you ask us to make something up, we say no and explain why.</li>
          <li><strong>Promise you a visa.</strong> Our numbers describe who chose to post about their interview. They are not consular approval rates and they predict nothing about you.</li>
          <li><strong>Give legal advice.</strong> This is interview preparation. We are not lawyers and have no affiliation with any consulate or with the US government.</li>
        </ul>
      </div>

      </div>{/* /.tf */}
    </>
  );
}
