<div align="center">

# ⚡ InsightAI

### Enterprise AI-Powered Data Intelligence, Automated Hygiene & Analytics Platform

[![FastAPI](https://img.shields.io/badge/FastAPI-0.115.0+-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-19.0-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16%2Bpgvector-336791?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Celery](https://img.shields.io/badge/Celery-5.4+-37814A?style=for-the-badge&logo=celery&logoColor=white)](https://docs.celeryq.dev/)
[![Redis](https://img.shields.io/badge/Redis-7.0+-DC382D?style=for-the-badge&logo=redis&logoColor=white)](https://redis.io/)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://www.docker.com/)
[![Google Gemini](https://img.shields.io/badge/Google%20Gemini-Powered-4285F4?style=for-the-badge&logo=google&logoColor=white)](https://deepmind.google/technologies/gemini/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)

<p align="center">
  <b>Turn raw, messy tabular data into pristine datasets, automated statistical EDA, AutoML models, executive PDF reports, and interactive AI conversations in seconds.</b>
</p>

[Key Features](#-key-features) • [System Architecture](#-system-architecture) • [Tech Stack](#-technology-stack) • [Quickstart](#-quickstart-with-docker-compose) • [Manual Setup](#-manual-local-development) • [API Reference](#-api-endpoints) • [Configuration](#-environment-variables) • [Deployment](#-production-deployment)

</div>

---

## 📖 Overview

**InsightAI** is an all-in-one data intelligence platform engineered for data teams, analysts, and enterprises. It bridges the gap between raw data storage and actionable executive decision-making. 

From automated missing-value imputation and outlier sanitization to asynchronous data profiling, no-code machine learning model training, and conversational AI analytics powered by modern LLMs (**Google Gemini**, **Anthropic Claude**, and **OpenAI**), InsightAI provides a high-throughput, cloud-ready foundation for your organization's data workflows.

---

## 🌟 Key Features

<table>
  <tr>
    <td width="50%">
      <h3>🧹 Automated Data Cleaning & Versioning</h3>
      <ul>
        <li><b>Smart Imputation</b>: Fill missing values with Mean, Median, Mode, KNN, or custom constants.</li>
        <li><b>Outlier Elimination</b>: Detect and filter anomalies using IQR and Z-Score algorithms.</li>
        <li><b>Feature Scaling & Encoding</b>: Standard, MinMax, Robust scalers, and One-Hot/Label encoders.</li>
        <li><b>Immutable Version History</b>: Track dataset mutations (<code>v1_raw</code> &rarr; <code>v2_cleaned</code> &rarr; <code>v3_transformed</code>) with rollback support.</li>
      </ul>
    </td>
    <td width="50%">
      <h3>📊 Instant Exploratory Data Analysis (EDA)</h3>
      <ul>
        <li><b>Automated Profiling</b>: In-depth data health scores, null cardinality, variance, and skewness metrics.</li>
        <li><b>Correlation Heatmaps</b>: Pearson & Spearman correlation matrices computed asynchronously.</li>
        <li><b>Distribution Insights</b>: Quantile diagnostics, frequency distributions, and type inference.</li>
        <li><b>Instant Visual Previews</b>: High-performance tabular rendering with client-side filters.</li>
      </ul>
    </td>
  </tr>
  <tr>
    <td width="50%">
      <h3>🤖 Conversational AI Data Analyst</h3>
      <ul>
        <li><b>Multi-LLM Gateway</b>: Native support for Google Gemini (<code>gemini-3.6-flash</code>), Anthropic Claude, and OpenAI GPT-4.</li>
        <li><b>Schema-Aware Context</b>: Queries are automatically contextualized with schema metadata and statistical summaries.</li>
        <li><b>Structured Output</b>: Produces insights, markdown breakdowns, dynamic chart configurations, and actionable recommendations.</li>
        <li><b>Offline Mock Mode</b>: Seamless local testing without consuming external LLM tokens.</li>
      </ul>
    </td>
    <td width="50%">
      <h3>🧠 No-Code AutoML & Machine Learning</h3>
      <ul>
        <li><b>Automated Model Training</b>: Train Classification and Regression models powered by Scikit-Learn and XGBoost.</li>
        <li><b>Metric Evaluations</b>: ROC-AUC, Precision, Recall, F1-score, RMSE, MAE, and $R^2$ score generation.</li>
        <li><b>Feature Importance</b>: Visualized ranking of influential predictors.</li>
        <li><b>Model Persistence</b>: Export and download serialized model artifacts (<code>joblib</code>) for deployment.</li>
      </ul>
    </td>
  </tr>
  <tr>
    <td width="50%">
      <h3>📈 Dynamic Analytics Dashboards</h3>
      <ul>
        <li><b>Custom Widget Canvas</b>: Interactive Bar, Line, Area, Scatter, and Box plots with Recharts.</li>
        <li><b>Multi-Project Organization</b>: Isolate datasets, charts, and experiments per project workspace.</li>
        <li><b>Real-Time Metric Cards</b>: High-level KPI trackers with aggregation parameters.</li>
      </ul>
    </td>
    <td width="50%">
      <h3>📑 Executive Automated Reports</h3>
      <ul>
        <li><b>One-Click Publication</b>: Export exhaustive data audits and analytical diagnoses.</li>
        <li><b>Multi-Format Exports</b>: Generate publication-ready <b>PDF (ReportLab)</b>, <b>HTML</b>, <b>DOCX</b>, and <b>PPTX</b> files.</li>
        <li><b>Audit Trail</b>: Trace dataset transformations, anomalies, and model evaluations in a unified document.</li>
      </ul>
    </td>
  </tr>
</table>

---

## 🏗️ System Architecture

```mermaid
flowchart TD
    subgraph Client ["Frontend Client"]
        SPA["React 19 + TypeScript + Vite\n(Tailwind CSS, Recharts, Lucide)"]
    end

    subgraph Gateway ["Reverse Proxy & Ingress"]
        Nginx["Nginx Gateway\n(Port 80 / 443)"]
    end

    subgraph Backend ["FastAPI Core Application"]
        API["FastAPI 0.115+\n(Async REST API, Auth, Schemas)"]
        LLM["LLM Gateway\n(Gemini / Claude / OpenAI)"]
        ML["AutoML Engine\n(Scikit-Learn, XGBoost)"]
    end

    subgraph Workers ["Distributed Worker Pool"]
        Celery["Celery Distributed Workers\n(Ingestion, Profiling, Cleaning, ML, Reports)"]
        Beat["Celery Beat Scheduler\n(Periodic Maintenance & Heartbeats)"]
    end

    subgraph Storage ["Data & Cache Tier"]
        PG[("PostgreSQL 16\n+ pgvector\n(Metadata, Users, Projects)")]
        Redis[("Redis 7\n(Task Broker & Result Store)")]
        MinIO[("MinIO S3 Object Storage\n(Parquet Datasets & Model Artifacts)")]
    end

    SPA -->|HTTP / REST API| Nginx
    Nginx -->|Proxy Requests| API
    API -->|Async Queries (SQLAlchemy 2.0)| PG
    API -->|Enqueue Jobs| Redis
    API -->|Query Cache / Direct S3| MinIO
    API -->|Inference Prompts| LLM
    Redis -->|Dispatch Tasks| Celery
    Beat -->|Schedule Tasks| Redis
    Celery -->|Read / Write Datasets| MinIO
    Celery -->|Store Metrics & Status| PG
    Celery -->|Model Training| ML
```

---

## 📂 Repository Structure

```text
InsightAI/
├── backend/
│   ├── alembic/                  # Database migration versions and environments
│   ├── app/
│   │   ├── api/v1/               # Modular REST endpoints (auth, datasets, cleaning, ai, ml, reports)
│   │   ├── core/                 # App configurations, JWT security, database async engines
│   │   ├── models/               # SQLAlchemy ORM declarative models
│   │   ├── schemas/              # Pydantic validation request/response schemas
│   │   ├── services/             # Core engines: LLM gateway, cleaning, profiling, storage, export
│   │   ├── tasks/                # Celery distributed task definitions
│   │   ├── celery_app.py         # Celery instance configuration & queue routing
│   │   └── main.py               # FastAPI entrypoint, middleware, and router registration
│   ├── Dockerfile                # Production Python 3.12 container
│   └── requirements.txt          # Python dependencies
├── frontend/
│   ├── src/
│   │   ├── components/           # Reusable UI widgets, charts, modals, layout elements
│   │   ├── pages/                # Application views (Datasets, Analysis, AI Chat, AutoML, Reports)
│   │   ├── lib/                  # Axios HTTP client, Zustand auth store, date utilities
│   │   ├── App.tsx               # App routing and React Query provider setup
│   │   └── index.css             # Tailwind styling and custom dark glassmorphism system
│   ├── Dockerfile                # Development container
│   ├── Dockerfile.prod           # Multi-stage production Nginx build
│   ├── nginx.conf                # Production reverse proxy and SPA routing
│   └── package.json              # Frontend dependencies and build scripts
├── docker-compose.yml            # Local development multi-container orchestration
├── docker-compose.prod.yml       # Production-ready orchestration with Nginx
├── .env.example                  # Environment configuration template
└── README.md                     # Documentation & setup guide
```

---

## 💻 Technology Stack

| Layer | Technologies | Purpose |
| :--- | :--- | :--- |
| **Frontend** | React 19, TypeScript, Vite, Tailwind CSS, Recharts, Lucide Icons | Modern, ultra-responsive dark-mode user interface |
| **Backend** | FastAPI (Python 3.12), Pydantic v2, Uvicorn | High-performance asynchronous REST API |
| **Database** | PostgreSQL 16 with `pgvector`, SQLAlchemy 2.0 (Asyncpg), Alembic | Relational storage for metadata, projects, users, and vector embeddings |
| **Task Queue** | Celery 5.4, Redis 7 | Distributed background job processing and task orchestration |
| **Object Storage**| MinIO (S3-compatible API), Boto3 | Storage for raw CSVs, high-speed Parquet files, and ML model binaries |
| **Data & ML** | Pandas, NumPy, PyArrow, Scikit-Learn, XGBoost, Joblib | High-throughput data processing, cleaning pipelines, and AutoML |
| **AI / LLMs** | Google Gemini SDK, Anthropic API, OpenAI API | Contextual dataset intelligence and conversational data querying |
| **Reporting** | ReportLab, python-docx, python-pptx | Generation of executive PDF, Word, and PowerPoint reports |
| **DevOps** | Docker, Docker Compose, Nginx, Sentry, Structlog | Multi-stage container builds, reverse proxy, and observability |

---

## ⚡ Quickstart with Docker Compose

Get a full local environment running in under 2 minutes.

### 1. Prerequisites
- [Docker](https://docs.docker.com/get-docker/) (v24.0+)
- [Docker Compose](https://docs.docker.com/compose/) (v2.20+)
- [Git](https://git-scm.com/)

### 2. Clone the Repository & Configure Environment

```bash
# Clone the project
git clone https://github.com/your-username/InsightAI.git
cd InsightAI

# Create your local environment file
cp .env.example .env
```

### 3. Configure Your AI Provider

Edit `.env` to supply your API key (Google Gemini is recommended by default):

```ini
AI_PROVIDER=gemini
GEMINI_API_KEY=AIzaSy...your_gemini_api_key
GEMINI_MODEL=gemini-3.6-flash
```

*(Optional: Set `AI_MOCK_MODE=true` to test the platform without an active LLM key.)*

### 4. Start the Application Stack

```bash
docker compose up --build
```

### 5. Access the Services

| Service | URL | Default Credentials |
| :--- | :--- | :--- |
| **Frontend Web App** | [http://localhost:5173](http://localhost:5173) | Register a new account via UI |
| **Interactive API Docs (Swagger)** | [http://localhost:8000/api/docs](http://localhost:8000/api/docs) | N/A |
| **ReDoc API Documentation** | [http://localhost:8000/api/redoc](http://localhost:8000/api/redoc) | N/A |
| **MinIO Storage Console** | [http://localhost:9001](http://localhost:9001) | `minioadmin` / `minioadmin` |
| **FastAPI Backend Health** | [http://localhost:8000/api/health](http://localhost:8000/api/health) | N/A |

---

## 🛠️ Manual Local Development

For development without Docker containers:

### 1. Backend Setup

```bash
cd backend

# Create and activate virtual environment
python -m venv .venv
# On macOS/Linux:
source .venv/bin/activate
# On Windows:
.venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Run database migrations
alembic upgrade head

# Start FastAPI development server
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### 2. Celery Worker & Scheduler Setup

Ensure Redis is running locally on port `6379`, then start the Celery worker in a separate terminal:

```bash
cd backend
# Activate virtual environment first
celery -A app.celery_app:celery worker --loglevel=info -Q ingestion,profiling,cleaning,analysis,ml,reports,ai
```

*(Optional) Start the Celery Beat scheduler for periodic tasks:*
```bash
celery -A app.celery_app:celery beat --loglevel=info
```

### 3. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start Vite dev server
npm run dev
```

---

## 📡 API Endpoints

InsightAI exposes a RESTful API with automated validation and OpenAPI specifications:

| Module | Method | Endpoint | Description |
| :--- | :--- | :--- | :--- |
| **Auth** | `POST` | `/api/v1/auth/register` | Register a new user |
| | `POST` | `/api/v1/auth/login` | Authenticate and obtain JWT access & refresh tokens |
| | `GET` | `/api/v1/auth/me` | Retrieve current authenticated user profile |
| **Projects** | `GET` / `POST` | `/api/v1/projects` | List or create isolated workspace projects |
| **Datasets** | `POST` | `/api/v1/datasets/upload` | Upload raw dataset (CSV, XLSX, Parquet, JSON) |
| | `GET` | `/api/v1/datasets/{id}/preview` | Paginated and filtered dataset row preview |
| | `GET` | `/api/v1/datasets/{id}/versions` | List historical versions for a dataset |
| **Profiling** | `POST` | `/api/v1/profiling/{dataset_id}` | Trigger asynchronous full EDA profiling |
| | `GET` | `/api/v1/profiling/{dataset_id}` | Retrieve data health score, skewness, and stats |
| **Cleaning** | `POST` | `/api/v1/cleaning/{dataset_id}/apply` | Execute cleaning pipeline (imputation, outlier, scale) |
| **AutoML** | `POST` | `/api/v1/ml/train` | Launch asynchronous classification/regression training |
| | `GET` | `/api/v1/ml/models/{id}` | Fetch model evaluation metrics and feature importance |
| **AI Chat** | `POST` | `/api/v1/ai-chat/query` | Ask natural language questions with dataset context |
| **Dashboards**| `GET` / `POST` | `/api/v1/dashboards` | Create, list, or update dashboard widget layouts |
| **Reports** | `POST` | `/api/v1/reports/generate` | Generate executive reports (PDF, HTML, DOCX, PPTX) |
| **Jobs** | `GET` | `/api/v1/jobs/{id}/status` | Check real-time progress of asynchronous Celery tasks |

---

## ⚙️ Environment Variables

Copy `.env.example` to `.env` and adjust the variables to your setup:

| Variable | Required | Default | Description |
| :--- | :---: | :--- | :--- |
| `POSTGRES_USER` | Yes | `insightai` | PostgreSQL database user |
| `POSTGRES_PASSWORD` | Yes | `insightai_dev_password` | PostgreSQL database password |
| `POSTGRES_DB` | Yes | `insightai` | Database name |
| `DATABASE_URL` | Yes | `postgresql+asyncpg://...` | Async SQLAlchemy database connection string |
| `REDIS_URL` | Yes | `redis://redis:6379/0` | Redis caching URL |
| `CELERY_BROKER_URL`| Yes | `redis://redis:6379/1` | Celery task queue broker URL |
| `S3_ENDPOINT_URL` | Yes | `http://minio:9000` | S3-compatible storage endpoint |
| `S3_ACCESS_KEY` | Yes | `minioadmin` | S3 / MinIO access key |
| `S3_SECRET_KEY` | Yes | `minioadmin` | S3 / MinIO secret key |
| `S3_BUCKET_NAME` | Yes | `insightai-data` | Target storage bucket name |
| `JWT_SECRET_KEY` | Yes | `change-me-in-prod` | Secret key for signing JWT tokens |
| `AI_PROVIDER` | No | `gemini` | Primary AI provider (`gemini`, `anthropic`, `openai`) |
| `GEMINI_API_KEY` | No | — | Google Gemini API Key |
| `GEMINI_MODEL` | No | `gemini-3.6-flash` | Gemini model variant |
| `AI_MOCK_MODE` | No | `false` | Enable to test AI features without calling external APIs |
| `MAX_UPLOAD_SIZE_MB`| No | `200` | Maximum file upload size limit (in MB) |
| `CORS_ORIGINS` | No | `http://localhost:5173...` | Comma-separated list of allowed CORS domains |

---

## 🚀 Production Deployment

### 🐳 Self-Hosted VPS Deployment (Docker Compose)

For deployment on **AWS EC2**, **DigitalOcean**, **Hetzner**, or **Linode**:

```bash
# 1. Clone repository onto your server
git clone https://github.com/your-username/InsightAI.git
cd InsightAI

# 2. Configure production secrets
cp .env.example .env
# Edit .env with strong production passwords, domain origins, and API keys

# 3. Launch with production compose file
docker compose -f docker-compose.prod.yml up --build -d
```

The production stack builds the React frontend into optimized static assets served via high-performance **Nginx** on port `80` (or `443`), with built-in API reverse proxying, Gzip compression, and caching headers.

---

### ☁️ Managed Cloud Deployment (Render / Railway / Vercel)

1. **Database & Cache**: Provision managed PostgreSQL and Redis instances on [Supabase](https://supabase.com), [Railway](https://railway.app), or [Neon](https://neon.tech).
2. **Backend & Workers**:
   - Deploy backend to [Render](https://render.com) or [Railway](https://railway.app) pointing to the `backend/` directory.
   - Start Command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
   - Deploy a background worker service running: `celery -A app.celery_app:celery worker --loglevel=info -Q ingestion,profiling,cleaning,analysis,ml,reports,ai`
3. **Frontend SPA**:
   - Connect the `frontend/` directory to [Vercel](https://vercel.com) or [Netlify](https://netlify.com).
   - Build Command: `npm run build`
   - Output Directory: `dist`
   - Set Environment Variable: `VITE_API_BASE_URL=https://your-api-domain.com/api/v1`

---

## 🛡️ Security & Reliability

- **JWT Authentication with Refresh Rotation**: Secure token management with password hashing via `bcrypt`.
- **RBAC (Role-Based Access Control)**: Granular permissions for standard users vs administrators.
- **SQL & Data Query Sanitization**: Parameterized database queries and restricted DataFrame compute execution.
- **Health Checks & Observability**: Active Docker healthchecks, structured logging with `structlog`, and optional `Sentry` crash analytics.

---

## 🤝 Contributing

Contributions make the open-source community an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'feat: Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📄 License

Distributed under the **MIT License**. See [`LICENSE`](LICENSE) for more information.

<div align="center">
  <sub>Built with ❤️ by the InsightAI Team</sub>
</div>
