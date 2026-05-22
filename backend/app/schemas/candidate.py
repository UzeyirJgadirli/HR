from datetime import datetime

from pydantic import BaseModel


class CandidateResponse(BaseModel):
    id: int
    file_name: str
    years_experience: float
    score: float
    rank: int
    score_reason: str
    matched_skills: str
    missing_skills: str
    uploaded_at: datetime

    class Config:
        from_attributes = True


class RankingSummary(BaseModel):
    candidates_uploaded: int
    ranked_candidates: int
    top_score: float
