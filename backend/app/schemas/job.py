from pydantic import BaseModel, Field


class JobCriteriaCreate(BaseModel):
    title: str = Field(min_length=2)
    min_years_experience: int = 0
    required_skills: str = ""
    preferred_skills: str = ""
    preferred_education: str = ""
    location: str = ""
    industry_experience: str = ""
    keywords: str = ""
    certifications: str = ""


class JobCriteriaResponse(JobCriteriaCreate):
    id: int

    class Config:
        from_attributes = True
