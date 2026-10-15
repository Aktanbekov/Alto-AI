import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useEffect } from "react";
import { getMe } from "../api";
import { setAccessToken } from "../utils/tokenStorage";
import { safeRedirect } from "../utils/authRedirect";
import HomeFindings from "../components/HomeFindings";
import HomeInterviewPreview from "../components/HomeInterviewPreview";
import { track } from "../analytics";
import { CORPUS } from "../seo/site";
import Arrow from "../components/ui/Arrow";
import "./HomePage.css";

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
              <h1>Your F-1 interview.<br /><span className="home-headline-emphasis">Better prepared.</span></h1>
              <p className="lede hero-lede">
                Answer <strong>three real interview questions.</strong> Get clear feedback
                on what to improve and how to explain your plans with confidence.
              </p>
              <div className="hero-act">
                <button className="btn" onClick={() => start("hero")}>
                  Start your profile check <span className="btn-free">Free</span>{" "}
                  <Arrow />
                </button>
              </div>
              <p className="meta">About four minutes. Needs a free account.</p>
              <Link className="home-evidence-link" to="/#why-us">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
                  <path d="M5 3h10l4 4v14H5V3Zm10 0v5h4M8 12h8M8 16h6" strokeLinejoin="round" />
                </svg>
                <span>Built on <strong>{CORPUS.interviews.toLocaleString()} real interview reports</strong></span>
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
            <li>
              <span className="step-n">1</span>
              <h2>Share your plans</h2>
              <p>Your university, your course and who pays. A minute or two.</p>
            </li>
            <li>
              <span className="step-n">2</span>
              <h2>Answer three real questions</h2>
              <p>The ones officers ask most, one at a time, in your own words.</p>
            </li>
            <li>
              <span className="step-n">3</span>
              <h2>Know what to improve</h2>
              <p>Clear feedback, real interview examples and practical next steps.</p>
            </li>
          </ol>
        </div>
      </div>

      {/* -------------------------------------------------------- stakes -- */}
      <section className="wrap section stakes-short">
        <div>
          <h2>A short interview.<br /><mark>A big next chapter.</mark></h2>
          <p>
            Your university, your funding, your plans for the future. You need to
            explain them clearly, even when the next question catches you off guard.
          </p>
        </div>
        <p className="pull">You know your plans.<br />We help you <span className="home-underline">explain them.</span></p>
      </section>

      {/* -------------------------------------------------------- why us -- */}
      <section className="wrap section why-us" id="why-us" aria-labelledby="why-us-heading">
        <div className="grid2">
          <div className="why-us-intro">
            <h2 id="why-us-heading">Why us?</h2>
            <p className="pull">We&rsquo;re not guessing.<br /><mark>We start with evidence.</mark></p>
            <p className="lede">
              Your preparation should start with real experience. Altovisas draws on{" "}
              <strong>{CORPUS.interviews.toLocaleString()} real F-1 interview reports</strong> shared by
              students, covering what officers asked, how applicants answered and what
              happened next.
            </p>
          </div>
          <ul className="why-us-reasons">
            <li>
              <h3>Real interviews behind the advice</h3>
              <p>
                We look at both approvals and refusals to understand the questions
                applicants face and where officers ask for more detail.
              </p>
            </li>
            <li>
              <h3>AI guided by that experience</h3>
              <p>
                Our AI checks your answers against <strong>real interview experiences
                and statistics.</strong> You get feedback on weak points and what to
                explain more clearly.
              </p>
            </li>
            <li>
              <h3>Statistics you can explore</h3>
              <p>
                See which questions come up most and how reported experiences differ
                by consulate and degree. The numbers behind our approach are open for
                you to explore.
              </p>
            </li>
          </ul>
        </div>
        <div className="why-us-source">
          <p>
            These are students&rsquo; own reports, not official consular records.
            They show patterns, not your chances of approval.
          </p>
          <Link to="/about" className="why-us-link">
            How we use the data <Arrow />
          </Link>
        </div>
      </section>

      {/* ---------------------------------------------------------- data -- */}
      <section className="wrap section data-short" id="the-data">
        <h2>What {CORPUS.interviews.toLocaleString()} interviews show</h2>
        <p className="lede">
          Students wrote down what they were asked and what happened. Three things stand out.
        </p>
        <HomeFindings />
      </section>

      {/* ------------------------------------------------------ limits --- */}
      <section className="wrap section limits">
        <h2>What we won&rsquo;t do</h2>
        <ul className="no-grid">
          <li><strong>Write you a script.</strong> Memorised answers are a common refusal signal. The words stay yours.</li>
          <li><strong>Invent facts.</strong> A false statement at the window can bar you permanently.</li>
          <li><strong>Promise a visa.</strong> Only the officer decides. Our numbers predict nothing about you.</li>
          <li><strong>Give legal advice.</strong> We are not lawyers, and not linked to any consulate or government.</li>
        </ul>
      </section>

      {/* ------------------------------------------------------- close --- */}
      <div className="close-band">
        <div className="wrap">
          <h2>Your next chapter starts with <span className="home-underline">a clearer answer.</span></h2>
          <div className="hero-act">
            <button className="btn" onClick={() => start("close")}>
              Start your profile check <span className="btn-free">Free</span>{" "}
              <Arrow />
            </button>
          </div>
          <p className="meta">
            Want help fixing them? A paid version that rebuilds each answer with you and
            drills you by voice is on the way. <Link to="/about">How it works</Link> ·{" "}
            <Link to="/faq">Questions</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
