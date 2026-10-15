import { Link } from "react-router-dom";
import { CORPUS } from "../seo/site";
import Arrow from "../components/ui/Arrow";

const { interviews, fromYear, toYear } = CORPUS;

/*
 * What the product does, where its numbers come from, and their limits.
 * Every figure here comes from CORPUS, which the build checks against the
 * dataset - the same rule as every other page.
 */
export default function AboutPage() {
  return (
    <div className="tf">
      <article className="page-w doc">
        <h1>How Altovisas works</h1>
        <p className="lede">
          Altovisas checks your F-1 interview answers against what actually happened at
          the window: {interviews.toLocaleString()} interview write-ups that students
          posted about their own interviews between {fromYear} and {toYear}.
        </p>

        <section>
          <h2>Where the data comes from</h2>
          <p>
            After their interview, many students write down what they were asked, what
            they said and what the officer decided, and post it publicly online. We collect
            those write-ups, remove duplicates, and split each one into the questions the
            officer asked. That gives 37 kinds of question and how often each comes up at
            each consulate. Roughly 200 new write-ups are added each month.
          </p>
        </section>

        <section>
          <h2>What happens when you run a profile check</h2>
          <p>
            You give a short profile - university, course, funding, consulate - and answer
            three of the questions officers ask most, in your own words. We pull the
            interviews most like yours, matching on consulate, country and degree, and we
            always include refused ones, because a comparison that only sees approvals
            learns nothing about what sinks a case.
          </p>
          <p>
            An AI model reads your answers alongside those interviews and the statistics
            for your consulate, and writes your report: where an officer is likely to push
            back, what they may ask next, and how to fix each answer. It is instructed to
            quote numbers only from the data and never to estimate one.
          </p>
        </section>

        <section>
          <h2>What the numbers can and cannot tell you</h2>
          <p>
            The write-ups are self-selected. People choose whether to post, and approved
            applicants post more readily, so an approval share describes who wrote
            something down - not the real approval rate at any consulate. Patterns in the
            data are associations, not causes. Nothing here predicts your outcome; only a
            consular officer decides.
          </p>
        </section>

        <section>
          <h2>What we will not do</h2>
          <ul className="doc-list">
            <li><strong>Write you a script.</strong> Rehearsed answers are one of the clearest refusal signals. The advice is about structure; the words are yours.</li>
            <li><strong>Invent facts for you.</strong> A false statement at the window can mean a permanent bar.</li>
            <li><strong>Promise you a visa.</strong> No tool can.</li>
            <li><strong>Give legal advice.</strong> This is interview preparation. We are not lawyers and have no connection to any consulate or government.</li>
          </ul>
        </section>

        <section>
          <h2>Your data</h2>
          <p>
            What you type stays private to your account. To write your report, your profile
            and answers are sent to an AI provider for processing. The{" "}
            <Link to="/privacy">Privacy Policy</Link> covers who processes what, how long it
            is kept, and how to have all of it deleted.
          </p>
        </section>

        <section className="doc-end">
          <h2>Try it on your own answers</h2>
          <p>Three questions, about four minutes. It needs a free account.</p>
          <Link to="/check-profile" className="btn">
            Start your profile check <Arrow />
          </Link>
        </section>
      </article>
    </div>
  );
}
