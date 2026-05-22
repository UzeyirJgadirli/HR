from datetime import datetime

from sqlalchemy import DateTime, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class JobCriteria(Base):
    __tablename__ = "job_criteria"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    min_years_experience: Mapped[int] = mapped_column(Integer, default=0)
    required_skills: Mapped[str] = mapped_column(Text, default="")
    preferred_skills: Mapped[str] = mapped_column(Text, default="")
    preferred_education: Mapped[str] = mapped_column(Text, default="")
    location: Mapped[str] = mapped_column(String(255), default="")
    industry_experience: Mapped[str] = mapped_column(Text, default="")
    keywords: Mapped[str] = mapped_column(Text, default="")
    certifications: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    candidates = relationship("Candidate", back_populates="job", cascade="all, delete")
    ranking_runs = relationship("RankingRun", back_populates="job", cascade="all, delete")
