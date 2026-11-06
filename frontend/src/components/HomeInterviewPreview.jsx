import { useCopy } from "../i18n";

// The question and the answer stay in English in both languages: the
// interview is held in English, and the card shows the product as it works.
const COPY = {
  en: {
    aria: "Example of F-1 interview preparation feedback",
    folderA: "Student visa",
    folderB: "Interview preparation",
    head: "Example feedback",
    needs: "An answer that needs more detail",
    tipTitle: "Make it specific.",
    tip: <>Name a course or research opportunity that connects to <strong>your study plans.</strong></>,
    caption: "Your own facts. A clearer answer.",
  },
  ru: {
    aria: "Пример разбора при подготовке к собеседованию на F-1",
    folderA: "Студенческая виза",
    folderB: "Подготовка к собеседованию",
    head: "Пример разбора",
    needs: "Ответ, которому не хватает конкретики",
    tipTitle: "Добавьте конкретики.",
    tip: <>Назовите курс или исследовательскую возможность, связанную с <strong>вашими учебными планами.</strong></>,
    caption: "Ваши факты. Более ясный ответ.",
  },
};

export default function HomeInterviewPreview() {
  const c = useCopy(COPY);
  return (
    <figure className="interview-preview" aria-label={c.aria}>
      <div className="interview-folder" aria-hidden="true">
        <div className="interview-folder-title">
          <span>F-1</span>
          <div>{c.folderA}<br />{c.folderB}</div>
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
          <span>{c.head}</span>
        </div>
        <h2 lang="en">“Why this university?”</h2>
        <div className="interview-answer">
          <span className="interview-answer-label">{c.needs}</span>
          <p lang="en">“It has a good ranking.”</p>
        </div>
        <div className="interview-guidance">
          <div className="interview-guidance-title">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <path d="m5 12 4 4L19 6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <h3>{c.tipTitle}</h3>
          </div>
          <p>{c.tip}</p>
        </div>
        <p className="interview-caption">{c.caption}</p>
      </div>
    </figure>
  );
}
