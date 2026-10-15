export default function HomeInterviewPreview() {
  return (
    <figure className="interview-preview" aria-label="Example of F-1 interview preparation feedback">
      <div className="interview-folder" aria-hidden="true">
        <div className="interview-folder-title">
          <span>F-1</span>
          <div>Student visa<br />Interview preparation</div>
        </div>
        <svg className="interview-globe" viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="1.2">
          <circle cx="32" cy="32" r="27" />
          <ellipse cx="32" cy="32" rx="13" ry="27" />
          <path d="M5 32h54M10 17h44M10 47h44M32 5v54" />
        </svg>
        <svg className="interview-engraving" viewBox="0 0 400 240" preserveAspectRatio="xMidYMid slice">
          <use href="#guil" />
        </svg>
      </div>
      <div className="interview-sheet">
        <div className="interview-sheet-head">
          <svg width="28" height="28" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
            <path d="m3 12 13-7 13 7-13 7-13-7Zm5 3v8c5 4 11 4 16 0v-8M29 12v12" strokeLinejoin="round" />
          </svg>
          <span>Example feedback</span>
        </div>
        <h2>“Why this university?”</h2>
        <div className="interview-answer">
          <span className="interview-answer-label">An answer that needs more detail</span>
          <p>“It has a good ranking.”</p>
        </div>
        <div className="interview-guidance">
          <div className="interview-guidance-title">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <path d="m5 12 4 4L19 6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <h3>Make it specific.</h3>
          </div>
          <p>Name a course or research opportunity that connects to <strong>your study plans.</strong></p>
        </div>
        <p className="interview-caption">Your own facts. A clearer answer.</p>
      </div>
    </figure>
  );
}
