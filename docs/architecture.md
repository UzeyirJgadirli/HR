# Architecture

## Request flow

1. HR defines role criteria in the frontend.
2. Frontend creates a job criteria record via `POST /jobs`.
3. HR uploads up to 100 resumes to `POST /jobs/{id}/upload`.
4. Backend stores files, extracts text, and creates candidate records.
5. HR starts analysis with `POST /jobs/{id}/analyze`.
6. Ranking service scores each candidate and stores score + reason.
7. Frontend reads summary and ranked candidates list for display.

## Ranking model

The score is a weighted aggregate capped at 100:

- Required skills: 40%
- Preferred skills: 20%
- Keywords: 10%
- Certifications: 5%
- Minimum years experience fit: 25%

## Database entities

- `job_criteria`: Hiring requirements
- `candidates`: Uploaded resumes, extracted text, score, reason
- `ranking_runs`: Historical analysis runs
