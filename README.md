# 🚀 InsightAI — Enterprise AI-Powered Data Intelligence & Analytics Platform

[![FastAPI](https://img.shields.io/badge/FastAPI-0.111.0-009688?style=flat&logo=fastapi)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-18.3-61DAFB?style=flat&logo=react)](https://reactjs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16%2Bpgvector-336791?style=flat&logo=postgresql)](https://www.postgresql.org/)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=flat&logo=docker)](https://www.docker.com/)
[![Google Gemini](https://img.shields.io/badge/Google%20Gemini-3.6%20Flash-4285F4?style=flat&logo=google)](https://deepmind.google/technologies/gemini/)

**InsightAI** is an enterprise-grade automated data intelligence and analysis platform designed to turn raw datasets into deep statistical insights, automated data hygiene pipelines, executive reports, and interactive AI conversations.

---

## 🌟 Key Features

- 🧹 **Automated Data Cleaning & Versioning**: Handle missing values (mean/median/KNN/drop), remove outliers via IQR/Z-score, normalize distributions, encode categorical features, and manage immutable dataset versions (`v1 raw`, `v2 cleaned`, `v3 transformed`).
- 📊 **Exploratory Data Analysis (EDA) & Profiling**: Automated type inference, null detection, distribution skewness, variance, quantile statistics, and correlation heatmaps.
- 💬 **Live AI Data Intelligence Chat**: Ask ad-hoc analytical questions directly about your data powered by Google Gemini (`gemini-3.6-flash`), Anthropic Claude, or OpenAI.
- 📈 **Interactive Dashboards & Custom Visualizations**: Dynamic histograms, scatter plots, box plots, correlation matrices, and time-series aggregations.
- 📑 **Automated Executive Reports**: Export comprehensive audit reports and executive data quality diagnoses to PDF and HTML.
- 🗄️ **S3-Compatible Object Storage (MinIO)**: High-speed storage for parquet, CSV, and generated artifacts with persistent metadata in PostgreSQL.
- ⚡ **Asynchronous Task Queue (Celery & Redis)**: Non-blocking dataset processing, background data profiling, and distributed cleaning jobs.

---

## 🏗️ Architecture & Directory Structure

```text
InsightAI/
├── backend/                  # FastAPI Application & Background Workers
│   ├── alembic/              # Database migration versions
│   ├── app/
│   │   ├── api/v1/           # REST API routes (auth, datasets, cleaning, ai, reports)
│   │   ├── core/             # App configuration, security, database engines
│   │   ├── models/           # SQLAlchemy ORM models
│   │   ├── schemas/          # Pydantic validation schemas
│   │   ├── services/         # Business logic (cleaning, profiling, LLM gateway, storage)
│   │   └── celery_app.py     # Celery distributed task definitions
│   ├── Dockerfile            # Python 3.12 production container
│   └── requirements.txt      # Backend dependencies
├── frontend/                 # React 18 + TypeScript + Vite SPA
│   ├── src/
│   │   ├── components/       # UI components (charts, data tables, AI renderer)
│   │   ├── pages/            # View pages (Datasets, Dashboards, Analysis, AI Chat, Reports)
│   │   ├── lib/              # API clients, auth stores, IST date utilities
│   │   └── index.css         # Modern dark-mode styling system
│   ├── Dockerfile            # Vite dev container
│   ├── Dockerfile.prod       # Multi-stage production container with Nginx
│   └── nginx.conf            # Nginx SPA routing & caching configuration
├── docker-compose.yml        # Development orchestration
├── docker-compose.prod.yml   # Production orchestration
├── .env.example              # Environment variables template
└── .gitignore                # Production git exclusion rules
```

---

## ⚡ Quickstart with Docker Compose

### 1. Clone & Setup Environment

```bash
git clone https://github.com/your-username/InsightAI.git
cd InsightAI

# Copy the environment file
cp .env.example .env
```

### 2. Configure Your API Keys

Open `.env` and set your preferred AI provider key:
```ini
AI_PROVIDER=gemini
GEMINI_API_KEY=your_google_gemini_api_key_here
GEMINI_MODEL=gemini-3.6-flash
```

### 3. Launch the Stack (Development)

```bash
docker compose up --build
```

The services will be available at:
- **Frontend SPA**: `http://localhost:5173`
- **FastAPI Documentation**: `http://localhost:8000/docs`
- **MinIO Storage Console**: `http://localhost:9001` (User: `minioadmin` / Pass: `minioadmin`)

---

## 🌐 Production Deployment & Hosting

### Option A: Self-Hosted Server / VPS (Docker Compose)

Deploy seamlessly on AWS EC2, DigitalOcean Droplet, Hetzner, or Linode:

```bash
# 1. Clone repository on your server
git clone https://github.com/your-username/InsightAI.git
cd InsightAI

# 2. Setup production .env
cp .env.example .env
# Edit .env with production passwords, domain names, and API keys

# 3. Launch production containers
docker compose -f docker-compose.prod.yml up --build -d
```
Frontend will be served directly on port `80` with Nginx, proxying API traffic to the backend.

---

### Option B: Cloud Hosting (Render, Railway, Fly.io, Vercel)

1. **Database**: Provision managed PostgreSQL and Redis instances on Railway, Supabase, or Render.
2. **Backend**:
   - Set Build Command: `pip install -r requirements.txt`
   - Set Start Command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
   - Set Root Directory: `backend`
   - Add environment variables from `.env.example`.
3. **Frontend**:
   - Deploy on **Vercel** or **Netlify**.
   - Set Root Directory: `frontend`
   - Set Build Command: `npm run build`
   - Set Output Directory: `dist`
   - Add Environment Variable: `VITE_API_BASE_URL=https://your-backend-api.com/api/v1`

---

## 🛠️ Manual Local Development Setup

If you wish to run without Docker:

### Backend Setup
```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
pip install -r requirements.txt

# Run migrations
alembic upgrade head

# Start API Server
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### Celery Worker Setup (in a separate terminal)
```bash
cd backend
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
celery -A app.celery_app:celery worker --loglevel=info -Q ingestion,profiling,cleaning,analysis,ml,reports,ai
```

### Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

---

## 🔒 Security & Environment Variables

| Variable | Description | Default / Example |
| :--- | :--- | :--- |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql+asyncpg://user:pass@localhost:5432/insightai` |
| `REDIS_URL` | Redis cache & task queue URL | `redis://localhost:6379/0` |
| `S3_ENDPOINT_URL` | Object storage endpoint | `http://minio:9000` |
| `JWT_SECRET_KEY` | Secret key for JWT signing | `openssl rand -hex 32` |
| `GEMINI_API_KEY` | Google Gemini API Key | `AIzaSy...` |
| `CORS_ORIGINS` | Allowed CORS origins (comma-separated) | `http://localhost:5173,https://yourdomain.com` |

---

## 📜 License

Distributed under the MIT License. See `LICENSE` for more information.
