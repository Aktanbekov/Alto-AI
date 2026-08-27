import PreviewChip from "../components/shell/PreviewChip";

const ENTRIES = [
  {
    outcome: "Refused", tone: "r",
    meta: "Chennai · Bachelor's · 2024 · id 4eb21ba584ce",
    body: "It is ranked number two in the world and has the best professors in my field.",
    note: 'The officer’s next question was "So why not other uni?" — a ranking answer has no defence against that, because every top school shares the same claim.',
  },
  {
    outcome: "Approved", tone: "a",
    meta: "New Delhi · Masters · 2025 · id b2448163604f",
    body: "Their data-systems track has a distributed databases sequence I want, and two of the faculty publish in the area I worked in at my last job.",
    note: "Names a course sequence and a link to the applicant's own history. Nothing here is transferable to another school, which is exactly why it reads as true.",
  },
  {
    outcome: "Refused", tone: "r",
    meta: "Mumbai · Bachelor's · 2023 · id 49519e252487",
    body: "My consultant recommended it and the fees were affordable compared to others.",
    note: "Two problems in one sentence: the decision belongs to somebody else, and cost as the reason invites the funding probe immediately.",
  },
];

export default function AnswersPage() {
  return (
    <div className="tf">
    <div className="wrap pt pb">
      <PreviewChip />
      <p className="eyebrow">Free · public · one page per question</p>
      <h2 style={{ marginBottom: 10 }}>&ldquo;Why this university?&rdquo; — real answers</h2>
      <p className="lede" style={{ marginBottom: 26 }}>
        2,339 posts recorded this question. Approval when it was asked: 79.7%, which is
        7.5 points below the corpus-wide share. Here are answers as they were reported,
        with the outcome the poster stated.
      </p>

      {ENTRIES.map((e) => (
        <div className="lib" key={e.meta}>
          <div className="lib-h">
            <span className={`pill ${e.tone}`}>{e.outcome}</span>
            <span className="tiny">{e.meta}</span>
          </div>
          <div className="lib-b">{e.body}</div>
          <div className="lib-f">{e.note}</div>
        </div>
      ))}

      <div className="card" style={{ marginTop: 26 }}>
        <h4 style={{ marginBottom: 8 }}>What separates the two groups</h4>
        <p className="why">
          Approved answers in this set almost always name something that exists only at
          that university — a named course, a lab, a professor&rsquo;s work. Refused
          answers name something true of any good university — rank, reputation,
          facilities. That&rsquo;s the whole difference, and it costs you an hour with
          the course catalogue.
        </p>
      </div>

      <p className="tiny" style={{ marginTop: 22 }}>
        More: Who is funding you · What will you do after graduation · How many
        universities did you apply to · Why the USA · Have you taken a loan
      </p>
    </div>
    </div>
  );
}
