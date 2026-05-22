from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Candidate(Base):
    __tablename__ = "candidates"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    job_id: Mapped[int] = mapped_column(ForeignKey("job_criteria.id", ondelete="CASCADE"), index=True)
    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    file_path: Mapped[str] = mapped_column(String(500), nullable=False)
    extracted_text: Mapped[str] = mapped_column(Text, default="")
    years_experience: Mapped[float] = mapped_column(Float, default=0.0)
    score: Mapped[float] = mapped_column(Float, default=0.0)
    rank: Mapped[int] = mapped_column(Integer, default=0)
    score_reason: Mapped[str] = mapped_column(Text, default="")
    matched_skills: Mapped[str] = mapped_column(Text, default="")
    missing_skills: Mapped[str] = mapped_column(Text, default="")
    uploaded_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    job = relationship("JobCriteria", back_populates="candidates")
