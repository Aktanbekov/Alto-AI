"""visa-llm pipeline CLI: ingest -> extract -> analyze -> index -> evaluate."""

from __future__ import annotations

import json
from pathlib import Path

import typer
from rich.console import Console

app = typer.Typer(add_completion=False, no_args_is_help=True)
console = Console()

# Load .env once, before any command touches os.environ.
from .config import load_env  # noqa: E402

load_env()

ROOT = Path(__file__).resolve().parents[2]
RAW_DIR = ROOT / "raw_data"
INTERIM = ROOT / "data" / "interim"
PROCESSED = ROOT / "data" / "processed"


@app.command()
def ingest(raw_dir: Path = RAW_DIR) -> None:
    """Read Telegram exports, keep interview reviews, dedup, write JSONL."""
    from .ingest.dedup import Deduplicator, content_key
    from .ingest.review_filter import clean, is_review
    from .ingest.telegram_reader import read_exports

    INTERIM.mkdir(parents=True, exist_ok=True)
    out_path = INTERIM / "reviews.jsonl"
    dedup = Deduplicator()
    total = kept = dropped_dup = 0

    with open(out_path, "w", encoding="utf-8") as out:
        for msg in read_exports(raw_dir):
            total += 1
            if not is_review(msg.text):
                continue
            text = clean(msg.text)
            if len(text) < 200:
                continue
            if not dedup.is_new(text):
                dropped_dup += 1
                continue
            kept += 1
            out.write(
                json.dumps(
                    {
                        "channel": msg.channel,
                        "message_id": msg.message_id,
                        "date": msg.date,
                        "content_hash": content_key(text),
                        "text": text,
                    },
                    ensure_ascii=False,
                )
                + "\n"
            )
    console.print(
        f"[green]ingest:[/] {total} messages -> {kept} unique reviews "
        f"({dropped_dup} duplicates dropped) -> {out_path}"
    )


@app.command()
def extract() -> None:
    """Parse reviews into structured records; report the LLM residue."""
    import pandas as pd

    from .extract import template_parser
    from .extract.schema import InterviewRecord, Outcome, Source

    PROCESSED.mkdir(parents=True, exist_ok=True)
    records: list[dict] = []
    residue = 0

    with open(INTERIM / "reviews.jsonl", encoding="utf-8") as f:
        for line in f:
            row = json.loads(line)
            fields = template_parser.parse(row["text"])
            record = InterviewRecord(
                **fields.model_dump(),
                raw_text=row["text"],
                parse_method="template",
                source=Source(
                    channel=row["channel"],
                    message_id=row["message_id"],
                    date=row["date"],
                    content_hash=row["content_hash"],
                ),
            )
            if record.outcome is Outcome.UNKNOWN:
                residue += 1
            records.append(json.loads(record.model_dump_json()))

    df = pd.json_normalize(records, max_level=0)
    df.to_parquet(PROCESSED / "interviews.parquet", index=False)

    n = len(records)
    with_outcome = n - residue
    with_dialogue = sum(1 for r in records if r["qa_turns"])
    console.print(
        f"[green]extract:[/] {n} records -> interviews.parquet\n"
        f"  outcome known: {with_outcome} ({with_outcome / n:.1%})\n"
        f"  with dialogue: {with_dialogue} ({with_dialogue / n:.1%})\n"
        f"  LLM residue (unknown outcome): {residue} ({residue / n:.1%})"
    )
    outcomes = df["outcome"].value_counts()
    for name, count in outcomes.items():
        console.print(f"    {name}: {count}")


@app.command("extract-llm")
def extract_llm(
    dry_run: bool = typer.Option(False, help="Only print the token/cost estimate."),
    model: str = typer.Option("claude-opus-5"),
) -> None:
    """Run LLM extraction on the residue (records with unknown outcome)."""
    from .extract.llm_extractor import run_llm_extraction

    run_llm_extraction(PROCESSED / "interviews.parquet", model=model, dry_run=dry_run)


@app.command("extract-llm-collect")
def extract_llm_collect(
    batch_id: str = typer.Argument(..., help="Batch id from `extract-llm`."),
) -> None:
    """Collect a finished batch and merge its fields into the parquet."""
    from .extract.llm_extractor import collect, merge

    results_path = INTERIM / f"llm_{batch_id}.jsonl"
    written = collect(batch_id, results_path)
    console.print(f"[green]collected:[/] {written} results -> {results_path}")
    stats = merge(PROCESSED / "interviews.parquet", results_path)
    console.print(
        f"[green]merged:[/] filled {stats['filled_outcome']} outcomes, "
        f"{stats['filled_turns']} transcripts"
    )


@app.command()
def analyze() -> None:
    """Build the question taxonomy and precompute stats.json + report."""
    from .analytics.run import run_analytics

    run_analytics(PROCESSED)


@app.command()
def index() -> None:
    """Embed records and build the retrieval index."""
    from .rag.embed import build_index_default

    manifest = build_index_default(PROCESSED)
    console.print(f"[green]index:[/] {manifest['n_records']:,} records, dim {manifest['dim']}")


@app.command("export-web")
def export_web() -> None:
    """Export static JSON for the web frontend into web/data/."""
    from .web.export import export

    manifest = export(PROCESSED, ROOT / "web")
    console.print(
        f"[green]export-web:[/] {manifest['n_records']:,} records "
        f"({manifest['n_with_transcript']:,} with transcripts) "
        f"across {manifest['n_shards']} shards -> web/data/"
    )


@app.command()
def evaluate(
    profile: Path = typer.Argument(..., help="YAML file: student profile + planned answers"),
    model: str = typer.Option("claude-opus-5"),
    k: int = typer.Option(10, help="How many comparable interviews to retrieve."),
    dry_run: bool = typer.Option(
        False, "--dry-run", help="Print the assembled prompt instead of calling the API."
    ),
    json_out: Path = typer.Option(None, "--json", help="Also write the evaluation as JSON."),
) -> None:
    """Evaluate a student's planned answers against the dataset."""
    from .evaluator.evaluate import dry_run_prompt, run_evaluation

    if dry_run:
        console.print(dry_run_prompt(profile, PROCESSED, k=k))
        return
    run_evaluation(profile, PROCESSED, model=model, k=k, json_out=json_out)


@app.command()
def serve(
    host: str = typer.Option("127.0.0.1"),
    port: int = typer.Option(8000),
) -> None:
    """Serve the web frontend plus the evaluator API."""
    from .web.serve import serve as run_server

    console.print(f"[green]serve:[/] http://{host}:{port}")
    run_server(PROCESSED, ROOT / "web", host=host, port=port)


if __name__ == "__main__":
    app()
