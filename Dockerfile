# Stage 1: Build the React + Vite frontend
FROM node:20-alpine AS builder

WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build


# Stage 2: Python FastAPI production runtime
FROM python:3.12-slim

WORKDIR /app
ENV PYTHONPATH=.
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ ./backend/
COPY --from=builder /app/frontend/dist ./frontend/dist

EXPOSE 8000

# Single worker so all WebSocket clients share the same in-memory simulation engine
CMD ["sh", "-c", "uvicorn backend.main:app --host 0.0.0.0 --port ${PORT:-8000} --workers 1"]
