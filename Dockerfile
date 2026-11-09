# Production image: one service. FastAPI serves the API and the built frontend.
# (backend/Dockerfile and frontend/Dockerfile are the development images.)

# 1. Build the frontend.
FROM node:22-alpine AS frontend
WORKDIR /frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# 2. The API with the built files next to it.
FROM python:3.12-slim
COPY --from=ghcr.io/astral-sh/uv:0.9.5 /uv /usr/local/bin/

ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PROJECT_ENVIRONMENT=/opt/venv \
    PATH="/opt/venv/bin:$PATH" \
    PYTHONUNBUFFERED=1 \
    STATIC_DIR=/app/static \
    PORT=8000

WORKDIR /app
COPY backend/pyproject.toml backend/uv.lock backend/.python-version ./
RUN uv sync --frozen --no-dev
COPY backend/app ./app
COPY backend/migrations ./migrations
COPY backend/alembic.ini ./
COPY --from=frontend /frontend/dist ./static

RUN useradd --create-home app
USER app

EXPOSE 8000
# Migrations first (idempotent), then the server. Render sets PORT.
CMD ["sh", "-c", "alembic upgrade head && exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT} --proxy-headers --forwarded-allow-ips='*'"]
