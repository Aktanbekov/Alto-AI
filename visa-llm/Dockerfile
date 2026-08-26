# visa-llm sidecar: FastAPI service exposing /api/health and /api/evaluate,
# grounded in the interview corpus under data/processed.
FROM python:3.12-slim

WORKDIR /app

# Build deps for scientific wheels; removed in the same layer to keep it small.
RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential curl \
    && rm -rf /var/lib/apt/lists/*

# Install dependencies first so code edits don't invalidate the wheel cache.
COPY pyproject.toml README.md ./
COPY src ./src
RUN pip install --no-cache-dir ".[rag,web]"

# Corpus: data/processed holds the parquet, stats.json and the embedding index.
COPY data ./data
COPY web ./web
COPY examples ./examples

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=90s --retries=3 \
    CMD curl -fsS http://localhost:8000/api/health || exit 1

# serve() binds 127.0.0.1 by default, which is unreachable from other
# containers, so bind 0.0.0.0 explicitly here.
CMD ["visa-llm", "serve", "--host", "0.0.0.0", "--port", "8000"]
