import shutil
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import get_db
from app.models.candidate import Candidate
from app.models.job import JobCriteria
from app.models.ranking import RankingRun
from app.schemas.candidate import CandidateResponse, RankingSummary
from app.schemas.job import JobCriteriaCreate, JobCriteriaResponse
from app.services.parser import SUPPORTED_EXTENSIONS, extract_text
from app.services.ranker import rank_candidates


router = APIRouter(prefix="/api/v1", tags=["ranking"])


@router.get("/health")
def healthcheck() -> dict[str, str]:
    return {"status": "ok"}


@router.post("/jobs", response_model=JobCriteriaResponse)
def create_job(payload: JobCriteriaCreate, db: Session = Depends(get_db)):
    job = JobCriteria(**payload.model_dump())
    db.add(job)
    db.commit()
    db.refresh(job)
    return job


@router.get("/jobs/{job_id}", response_model=JobCriteriaResponse)
def get_job(job_id: int, db: Session = Depends(get_db)):
    job = db.get(JobCriteria, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job criteria not found")
    return job


@router.delete("/jobs/{job_id}")
def delete_job(job_id: int, db: Session = Depends(get_db)):
    job = db.get(JobCriteria, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job criteria not found")
    db.delete(job)
    db.commit()
    return {"detail": "Deleted"}


@router.post("/jobs/{job_id}/upload", response_model=RankingSummary)
def upload_candidates(
    job_id: int,
    files: list[UploadFile] = File(...),
    db: Session = Depends(get_db),
):
    job = db.get(JobCriteria, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job criteria not found")

    if len(files) > settings.max_upload_files:
        raise HTTPException(
            status_code=400,
            detail=f"You can upload up to {settings.max_upload_files} files per batch",
        )

    db.query(Candidate).filter(Candidate.job_id == job_id).delete()
    db.commit()

    upload_base = Path(settings.upload_dir) / str(job_id)
    upload_base.mkdir(parents=True, exist_ok=True)

    for upload in files:
        suffix = Path(upload.filename or "").suffix.lower()
        if suffix not in SUPPORTED_EXTENSIONS:
            raise HTTPException(status_code=400, detail=f"Unsupported file: {upload.filename}")

        safe_name = f"{uuid.uuid4().hex}_{upload.filename}"
        target = upload_base / safe_name

        with target.open("wb") as file_handle:
            shutil.copyfileobj(upload.file, file_handle)
        try:
            text = extract_text(target)
        except Exception as exc:  # noqa: BLE001
            raise HTTPException(
                status_code=400,
                detail=f"Could not parse file {upload.filename}: {exc}",
            ) from exc
        finally:
            upload.file.close()

        candidate = Candidate(
            job_id=job_id,
            file_name=upload.filename or safe_name,
            file_path=str(target),
            extracted_text=text,
        )
        db.add(candidate)

    db.commit()

    uploaded_count = db.query(func.count(Candidate.id)).filter(Candidate.job_id == job_id).scalar() or 0
    return RankingSummary(candidates_uploaded=uploaded_count, ranked_candidates=0, top_score=0.0)


@router.post("/jobs/{job_id}/analyze", response_model=RankingSummary)
def analyze_candidates(job_id: int, db: Session = Depends(get_db)):
    job = db.get(JobCriteria, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job criteria not found")

    candidates = db.query(Candidate).filter(Candidate.job_id == job_id).all()
    if not candidates:
        raise HTTPException(status_code=400, detail="No resumes uploaded for this job")

    ranked = rank_candidates(candidates, job)
    top_score = ranked[0].score if ranked else 0.0

    ranking_run = RankingRun(job_id=job_id, candidates_ranked=len(ranked), top_score=top_score)
    db.add(ranking_run)
    db.commit()

    return RankingSummary(candidates_uploaded=len(candidates), ranked_candidates=len(ranked), top_score=top_score)


@router.get("/jobs/{job_id}/summary", response_model=RankingSummary)
def get_summary(job_id: int, db: Session = Depends(get_db)):
    total = db.query(func.count(Candidate.id)).filter(Candidate.job_id == job_id).scalar() or 0
    ranked = db.query(func.count(Candidate.id)).filter(Candidate.job_id == job_id, Candidate.score > 0).scalar() or 0
    top_score = db.query(func.max(Candidate.score)).filter(Candidate.job_id == job_id).scalar() or 0.0
    return RankingSummary(candidates_uploaded=total, ranked_candidates=ranked, top_score=float(top_score))


@router.get("/jobs/{job_id}/candidates", response_model=list[CandidateResponse])
def get_candidates(job_id: int, limit: int = 100, db: Session = Depends(get_db)):
    records = (
        db.query(Candidate)
        .filter(Candidate.job_id == job_id)
        .order_by(Candidate.rank.asc())
        .limit(limit)
        .all()
    )
    return records
