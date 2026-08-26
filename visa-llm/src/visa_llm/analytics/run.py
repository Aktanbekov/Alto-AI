"""Stage 3 entry point: compute stats.json and render the insights report."""

from __future__ import annotations

import json
from pathlib import Path

import pandas as pd
from rich.console import Console

from . import report, stats as stats_mod

console = Console()


def run_analytics(processed: Path) -> dict:
    df = pd.read_parquet(processed / "interviews.parquet")
    stats = stats_mod.compute(df)

    (processed / "stats.json").write_text(json.dumps(stats, indent=2), encoding="utf-8")
    (processed / "report.md").write_text(report.render_markdown(stats), encoding="utf-8")
    (processed / "report.html").write_text(report.render_html(stats), encoding="utf-8")

    overall = stats["overall"]
    console.print(
        f"[green]analyze:[/] {stats['meta']['n_records']:,} records, "
        f"{overall['n_decided']:,} decided, "
        f"approval share {overall['approval_rate']:.1%}\n"
        f"  question types tracked: {len(stats['question_types'])}\n"
        f"  cities with breakdowns: {len(stats['by_city'])}\n"
        f"  wrote stats.json, report.md, report.html -> {processed}"
    )
    return stats
