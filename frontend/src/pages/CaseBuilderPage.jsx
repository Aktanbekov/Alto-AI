import PreviewChip from "../components/shell/PreviewChip";

const FACTS = [
  "Father: real estate, farming, stake in a bank",
  "$300,000 set aside, documented in bank statements",
  "Farm runs on paper — no yield tracking",
  "Returning to Bishkek after the degree",
  "BSc Computer Science, Stanford, first attempt",
  "School score 4.9 out of 5",
];

export default function CaseBuilderPage() {
  return (
    <div className="tf">
    <div className="wrap pt pb">
      <PreviewChip />
      <div className="grid2" style={{ gridTemplateColumns: "1.5fr .9fr" }}>
        <div>
          <p className="eyebrow">Weak point 03 of 03 · post-graduation plan</p>
          <h2 style={{ marginBottom: 22 }}>Let&rsquo;s find your real answer</h2>

          <div className="turn sys">
            <div className="who">Alto Visas</div>
            <p className="said">
              Your answer says you&rsquo;ll help your father&rsquo;s businesses, but it
              never says where you&rsquo;ll be. As written, an officer can read it as
              remote work from the US — and <em>return_intent</em> only gets asked when
              they&rsquo;re already unsure. I&rsquo;m not going to hand you a replacement
              sentence. Where will you physically be, and what is the first thing
              you&rsquo;d actually build?
            </p>
          </div>

          <div className="turn you">
            <div className="who">You</div>
            <p className="said">
              In Bishkek. The farm has no yield tracking at all, everything is in
              notebooks. That&rsquo;s the first thing I&rsquo;d build.
            </p>
          </div>

          <div className="turn sys">
            <div className="who">Alto Visas</div>
            <p className="said">
              That&rsquo;s the answer. It names a country, a business and a concrete
              first project, which is what separates a real tie from a slogan. Here it
              is against what you had.
            </p>
            <div className="ba">
              <div className="before">
                <div className="tag">What you wrote</div>
                After graduation I want to help my father in his businesses by
                digitalizing and optimizing them, integrating the AI in the business aspects.
              </div>
              <div className="after">
                <div className="tag">Assembled from your facts</div>
                I&rsquo;ll return to Kyrgyzstan and work in my father&rsquo;s companies.
                The farm still runs on paper — no yield tracking at all — and
                that&rsquo;s the first system I want to build. That&rsquo;s the job my
                degree is for, and it&rsquo;s waiting for me.
              </div>
            </div>
            <p className="tiny" style={{ marginTop: 10 }}>
              Say this only if it is your actual intention.
            </p>
          </div>

          <div className="turn refuse">
            <div className="who">If you ask us to invent something</div>
            <p className="said">
              &ldquo;I can&rsquo;t help you say something that isn&rsquo;t true. A false
              statement to a consular officer is material misrepresentation, and the bar
              it carries is permanent — much worse than a refusal you can reapply from.
              Tell me what is true and we&rsquo;ll work with that. Files that look weak
              to you are usually stronger than you think.&rdquo;
            </p>
          </div>
        </div>

        <aside className="ledger">
          <h4>Your facts · everything is built from this</h4>
          {FACTS.map((f) => (
            <div className="fact" key={f}><span className="m">✓</span><span>{f}</span></div>
          ))}
          <p className="note">
            Nothing we write for you comes from anywhere but this list. Edit or delete
            anything inaccurate — if it&rsquo;s wrong here, it&rsquo;s wrong at the window.
          </p>
        </aside>
      </div>
    </div>
    </div>
  );
}
