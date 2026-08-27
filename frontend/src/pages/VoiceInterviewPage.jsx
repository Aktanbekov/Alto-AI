import PreviewChip from "../components/shell/PreviewChip";

export default function VoiceInterviewPage() {
  const readout = [
    { k: "Length", v: <>31 seconds <span className="tiny">· median in the corpus is 14</span></> },
    { k: "Answered it", v: "Yes — clear no, with a reason", tone: "ok" },
    { k: "Matched your file", v: "No — you mentioned a job offer that isn't in your facts", tone: "bad" },
    { k: "Hedging", v: '7 hedges: "maybe", "I think", "probably"' },
  ];

  return (
    <div className="tf">
    <div className="narrow pt pb">
      <PreviewChip />
      <div className="topbar">
        <span className="tiny">Drill 4 · targeting weak point 03</span>
        <span className="timer"><i className="dot" />02:12</span>
      </div>

      <p className="q">So you&rsquo;ll just stay in America after your OPT, won&rsquo;t you?</p>
      <p className="q-src">Follow-up · generated from your weak point, not from a fixed list</p>

      <button className="mic" type="button">
        <span className="ring"><i /></span><span>Answer now</span>
      </button>

      <div className="readout">
        {readout.map((r) => (
          <div className="rrow" key={r.k}>
            <span className="k">{r.k}</span>
            <span className={`v${r.tone ? ` ${r.tone}` : ""}`}>{r.v}</span>
          </div>
        ))}
        <div className="probe">
          <div className="k">An officer would go here next</div>
          <div className="v">&ldquo;Which company offered you that job?&rdquo;</div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 22 }}>
        <h4 style={{ marginBottom: 8 }}>Unexpected-question mode</h4>
        <p className="why">
          Pulls a question you haven&rsquo;t prepared, straight from the transcripts.
          Freezing is what students fear most and it&rsquo;s the one thing practice
          reliably fixes.
        </p>
      </div>

      <p className="tiny" style={{ marginTop: 18 }}>
        Sessions are three minutes on purpose. Short and often beats one long
        rehearsal — and a long rehearsal is what makes you sound rehearsed.
      </p>
    </div>
    </div>
  );
}
