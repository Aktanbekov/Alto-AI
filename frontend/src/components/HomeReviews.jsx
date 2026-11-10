import { REVIEWS } from "../data/reviews";

const STAR = "M12 3.2l2.6 5.5 6 .8-4.4 4.2 1.1 5.9L12 16.7l-5.3 2.9 1.1-5.9-4.4-4.2 6-.8L12 3.2z";

const month = new Intl.DateTimeFormat("ru", { month: "long", year: "numeric", timeZone: "UTC" });

// Five square tiles with the star knocked out of each, the way review sites
// draw a rating, set in ink instead of a brand red.
function Stars({ value }) {
  return (
    <span className="stars" role="img" aria-label={`${value} из 5 звёзд`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span className={n <= value ? "star is-on" : "star"} key={n} aria-hidden="true">
          <svg viewBox="0 0 24 24"><path d={STAR} /></svg>
        </span>
      ))}
    </span>
  );
}

// ==like this== in the review text marks the line the applicant found most useful.
function ReviewText({ text }) {
  return text.split(/==(.+?)==/g).map((part, i) => (i % 2 ? <mark key={i}>{part}</mark> : part));
}

const initials = (name) =>
  name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();

export default function HomeReviews() {
  return (
    <ul className="reviews-list">
      {REVIEWS.map((r, i) => (
        <li key={r.name} className={i === 0 ? "review review-lead" : "review"}>
          <figure>
            <figcaption className="review-who">
              <span className="review-avatar" aria-hidden="true">{initials(r.name)}</span>
              <span>
                <span className="review-name">{r.name}</span>
                <span className="review-where">
                  {r.location}
                  {r.programme && <> · {r.programme}</>}
                </span>
              </span>
            </figcaption>
            <div className="review-rating">
              <Stars value={r.rating} />
              <time dateTime={r.date}>{month.format(new Date(`${r.date}-01T00:00:00Z`))}</time>
            </div>
            <blockquote className="review-text">
              <p><ReviewText text={r.text} /></p>
            </blockquote>
          </figure>
        </li>
      ))}
    </ul>
  );
}
