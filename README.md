# HR Resume Ranking Platform

A full-stack hiring assistant that lets HR teams upload up to 100 resumes in one batch, score candidates against job criteria, and review ranked results with explainable reasoning.

## Stack

- Frontend: Next.js 15 + TypeScript + Tailwind CSS
- Backend: FastAPI + SQLAlchemy
- Database: Microsoft SQL Server (MSSQL)
- File support: PDF, DOCX, DOC, TXT, RTF

## Project structure

- `frontend/` Next.js dashboard UI
- `backend/` FastAPI API and ranking engine
- `docker-compose.yml` Full stack with MSSQL

## Features

- Create hiring criteria for a role
- Upload up to 100 resumes in one batch
- Extract resume text from supported files
- Score and rank candidates against required/preferred criteria
- Show score explanations and estimated experience
- Recruiter assistant panel with quick ranking insights

## Run with Docker (recommended)

1. From project root:

```bash
docker compose up --build
```

2. Open apps:
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000/docs

## Run locally (without Docker)

### 1) Start MSSQL

Use local SQL Server or Docker container:

```bash
docker run -e ACCEPT_EULA=Y -e MSSQL_SA_PASSWORD=YourStrong!Passw0rd -p 1433:1433 --name hr-mssql -d mcr.microsoft.com/mssql/server:2022-latest
```

### 2) Backend setup

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 3) Frontend setup

```bash
cd frontend
copy .env.local.example .env.local
npm install
npm run dev
```

Open http://localhost:3000.

## API endpoints

- `GET /api/v1/health`
- `POST /api/v1/jobs`
- `POST /api/v1/jobs/{job_id}/upload`
- `POST /api/v1/jobs/{job_id}/analyze`
- `GET /api/v1/jobs/{job_id}/summary`
- `GET /api/v1/jobs/{job_id}/candidates?limit=100`

## Notes

- Backend auto-creates the `hr_ranker` database if it does not exist.
- `.doc` parsing depends on plain-text readability. For best quality, use PDF, DOCX, TXT, or RTF.
- Upload files are stored under `backend/uploads/`.
