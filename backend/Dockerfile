FROM python:3.12-slim-trixie

COPY --from=ghcr.io/astral-sh/uv:0.12.1 /uv /uvx /bin/

WORKDIR /app

COPY pyproject.toml uv.lock ./

RUN uv sync --locked --no-install-project

COPY app ./app

CMD ["uv", "run", "--no-sync", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]