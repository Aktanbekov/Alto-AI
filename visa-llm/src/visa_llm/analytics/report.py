"""Render the insights report from the precomputed stats."""

from __future__ import annotations

import re
from typing import Any


def _pct(value: float | None) -> str:
    return "—" if value is None else f"{value * 100:.1f}%"


def _delta(value: float | None) -> str:
    if value is None:
        return "—"
    return f"{value * 100:+.1f} pp"


def render_markdown(stats: dict[str, Any]) -> str:
    meta = stats["meta"]
    overall = stats.get("overall") or {}
    lines: list[str] = []

    lines.append("# F1 Visa Interview Reviews — Insights Report\n")
    lines.append(
        f"Built from **{meta['n_records']:,} deduplicated interview reviews** "
        f"({meta['n_decided']:,} with a clear approved/rejected outcome) posted "
        f"between {meta['year_range'][0]} and {meta['year_range'][1]}.\n"
    )
    lines.append(f"> **Read this first.** {meta['caveat']}\n")

    lines.append("## Outcomes in the corpus\n")
    lines.append("| Outcome | Records |")
    lines.append("|---|---|")
    for name, count in meta["outcome_counts"].items():
        lines.append(f"| {name.replace('_', ' ')} | {count:,} |")
    lines.append(
        f"\nApproved share among decided interviews: **{_pct(overall.get('approval_rate'))}** "
        f"(n={overall.get('n_decided', 0):,}).\n"
    )

    def table(title: str, key: str, label: str) -> None:
        rows = stats.get(key) or {}
        if not rows:
            return
        lines.append(f"## {title}\n")
        lines.append(f"| {label} | Decided | Approved | Rejected | Approval share |")
        lines.append("|---|---|---|---|---|")
        for name, row in rows.items():
            lines.append(
                f"| {name} | {row['n_decided']:,} | {row['approved']:,} | "
                f"{row['rejected']:,} | {_pct(row['approval_rate'])} |"
            )
        lines.append("")

    table("By consulate city", "by_city", "City")
    table("By country", "by_country", "Country")
    table("By degree level", "by_degree", "Degree")
    table("By attempt number", "by_attempt", "Attempt")
    table("By year posted", "by_year", "Year")

    q_types = stats.get("question_types") or []
    if q_types:
        lines.append("## What officers actually ask\n")
        lines.append(
            "`Asked in` counts interviews where at least one turn matched the "
            "question type. `Δ vs base` compares the approval share of interviews "
            "containing that question against the overall base — a negative value "
            "means the question shows up more often in interviews that ended in "
            "refusal. **This is association, not cause**: officers probe where they "
            "already have doubts, so a probing question is a symptom of a weak "
            "case at least as much as a risk in itself.\n"
        )
        lines.append("| Question type | Asked in | Share of interviews | Approval when asked | Δ vs base |")
        lines.append("|---|---|---|---|---|")
        for row in q_types:
            lines.append(
                f"| {row['question_type'].replace('_', ' ')} | {row['asked_in']:,} | "
                f"{_pct(row['share_of_interviews'])} | "
                f"{_pct(row['approval_rate_when_asked'])} | {_delta(row.get('delta_vs_base'))} |"
            )
        lines.append("")

    mix = stats.get("question_mix_by_city") or {}
    if mix:
        lines.append("## Question mix by consulate\n")
        lines.append("Share of that city's interviews containing each question type.\n")
        for city, payload in mix.items():
            top = ", ".join(
                f"{item['question_type'].replace('_', ' ')} {_pct(item['share'])}"
                for item in payload["top_question_types"][:8]
            )
            lines.append(f"- **{city}** (n={payload['n']:,}): {top}")
        lines.append("")

    length = stats.get("answer_length")
    if length:
        lines.append("## Transcript length\n")
        lines.append(
            f"- Median total answer text — approved: "
            f"{length['median_total_answer_chars_approved']:,} chars, "
            f"rejected: {length['median_total_answer_chars_rejected']:,} chars\n"
            f"- Median recorded turns — approved: {length['median_turns_approved']:.0f}, "
            f"rejected: {length['median_turns_rejected']:.0f}\n"
        )
        lines.append(f"> {length['note']}\n")

    lines.append("## How to read all of this\n")
    lines.append(
        "- Reviews are posted voluntarily, and approvals are shared more eagerly "
        "than refusals, so the approval share here sits well above any real base rate.\n"
        "- Consulate differences partly reflect *who applies where* (program mix, "
        "funding profiles, applicant pools), not just officer behaviour.\n"
        "- The useful signal is **what gets asked** and **how well-prepared answers "
        "look**, not a predicted probability of approval. Use the question mix to "
        "decide what to rehearse.\n"
    )
    return "\n".join(lines)


def render_html(stats: dict[str, Any]) -> str:
    """Self-contained, theme-aware HTML version of the same report."""
    import html as _html

    md = render_markdown(stats)
    # Minimal markdown -> HTML: tables, headings, bullets, bold, code.
    out: list[str] = []
    in_table = False
    in_list = False

    def close_blocks() -> None:
        nonlocal in_table, in_list
        if in_table:
            out.append("</tbody></table></div>")
            in_table = False
        if in_list:
            out.append("</ul>")
            in_list = False

    def inline(text: str) -> str:
        text = _html.escape(text)
        text = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", text)
        return text.replace("`", "")

    for raw in md.splitlines():
        line = raw.rstrip()
        if not line.strip():
            close_blocks()
            continue
        if line.startswith("|"):
            cells = [c.strip() for c in line.strip("|").split("|")]
            if set("".join(cells)) <= set("-: "):
                continue
            if not in_table:
                out.append('<div class="tw"><table><thead><tr>')
                out.extend(f"<th>{inline(c)}</th>" for c in cells)
                out.append("</tr></thead><tbody>")
                in_table = True
            else:
                out.append("<tr>")
                out.extend(f"<td>{inline(c)}</td>" for c in cells)
                out.append("</tr>")
            continue
        close_blocks()
        if line.startswith("### "):
            out.append(f"<h3>{inline(line[4:])}</h3>")
        elif line.startswith("## "):
            out.append(f"<h2>{inline(line[3:])}</h2>")
        elif line.startswith("# "):
            out.append(f"<h1>{inline(line[2:])}</h1>")
        elif line.startswith("> "):
            out.append(f"<blockquote>{inline(line[2:])}</blockquote>")
        elif line.startswith("- "):
            if not in_list:
                out.append("<ul>")
                in_list = True
            out.append(f"<li>{inline(line[2:])}</li>")
        else:
            out.append(f"<p>{inline(line)}</p>")
    close_blocks()
    body = "\n".join(out)

    return f"""<title>F1 Interview Insights</title>
<style>
  :root {{
    --bg: #fbfaf9; --surface: #ffffff; --text: #1f1d1b; --muted: #6b6660;
    --line: #e6e2dd; --accent: #9a5b2f; --accent-soft: #f4ece5;
  }}
  @media (prefers-color-scheme: dark) {{
    :root:not([data-theme="light"]) {{
      --bg: #171615; --surface: #201e1d; --text: #ece9e5; --muted: #a39d96;
      --line: #322f2d; --accent: #d99b6c; --accent-soft: #2a2320;
    }}
  }}
  :root[data-theme="dark"] {{
    --bg: #171615; --surface: #201e1d; --text: #ece9e5; --muted: #a39d96;
    --line: #322f2d; --accent: #d99b6c; --accent-soft: #2a2320;
  }}
  * {{ box-sizing: border-box; }}
  body {{
    margin: 0; padding: 3rem 1.25rem 5rem; background: var(--bg); color: var(--text);
    font: 16px/1.65 ui-sans-serif, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  }}
  main {{ max-width: 60rem; margin: 0 auto; }}
  h1 {{ font-size: clamp(1.7rem, 4vw, 2.4rem); line-height: 1.15; letter-spacing: -.02em; margin: 0 0 1rem; }}
  h2 {{ font-size: 1.3rem; margin: 2.75rem 0 .85rem; padding-bottom: .4rem;
        border-bottom: 1px solid var(--line); letter-spacing: -.01em; }}
  p {{ margin: .7rem 0; }}
  ul {{ margin: .7rem 0; padding-left: 1.2rem; }}
  li {{ margin: .35rem 0; }}
  blockquote {{ margin: 1.1rem 0; padding: .85rem 1.1rem; background: var(--accent-soft);
               border-left: 3px solid var(--accent); border-radius: 0 6px 6px 0; color: var(--text); }}
  .tw {{ overflow-x: auto; margin: 1rem 0; border: 1px solid var(--line);
         border-radius: 8px; background: var(--surface); }}
  table {{ border-collapse: collapse; width: 100%; font-size: .9rem; }}
  th, td {{ padding: .55rem .8rem; text-align: left; border-bottom: 1px solid var(--line); white-space: nowrap; }}
  th {{ font-weight: 600; font-size: .78rem; text-transform: uppercase; letter-spacing: .04em;
        color: var(--muted); background: var(--accent-soft); }}
  tbody tr:last-child td {{ border-bottom: 0; }}
  td:not(:first-child), th:not(:first-child) {{ text-align: right; }}
  strong {{ font-weight: 650; }}
</style>
<main>
{body}
</main>
"""
