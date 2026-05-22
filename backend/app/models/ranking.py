from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class RankingRun(Base):
    __tablename__ = "ranking_runs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    job_id: Mapped[int] = mapped_column(ForeignKey("job_criteria.id", ondelete="CASCADE"), index=True)
    candidates_ranked: Mapped[int] = mapped_column(Integer, default=0)
    top_score: Mapped[float] = mapped_column(Float, default=0.0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    job = relationship("JobCriteria", back_populates="ranking_runs")
