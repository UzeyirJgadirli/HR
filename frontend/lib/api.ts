export type JobCriteriaPayload = {
  title: string;
  min_years_experience: number;
  required_skills: string;
  preferred_skills: string;
  preferred_education: string;
  location: string;
  industry_experience: string;
  keywords: string;
  certifications: string;
};

export type JobCriteriaResponse = JobCriteriaPayload & {
  id: number;
};

export type RankingSummary = {
  candidates_uploaded: number;
  ranked_candidates: number;
  top_score: number;
};

export type Candidate = {
  id: number;
  file_name: string;
  years_experience: number;
  score: number;
  rank: number;
  score_reason: string;
  matched_skills: string;
  missing_skills: string;
  uploaded_at: string;
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000/api/v1";

async function parseJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const payload = await response.json().catch(() => ({ detail: "Request failed" }));
    throw new Error(payload.detail ?? "Request failed");
  }
  return (await response.json()) as T;
}

export async function createJob(payload: JobCriteriaPayload): Promise<JobCriteriaResponse> {
  const response = await fetch(`${API_BASE}/jobs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return parseJson(response);
}

export async function fetchJob(jobId: number): Promise<JobCriteriaResponse> {
  const response = await fetch(`${API_BASE}/jobs/${jobId}`);
  return parseJson(response);
}

export async function deleteJob(jobId: number): Promise<void> {
  const response = await fetch(`${API_BASE}/jobs/${jobId}`, { method: "DELETE" });
  if (!response.ok) {
    throw new Error("Failed to delete job");
  }
}

export async function uploadCandidates(jobId: number, files: File[]): Promise<RankingSummary> {
  const form = new FormData();
  files.forEach((file) => form.append("files", file));
  const response = await fetch(`${API_BASE}/jobs/${jobId}/upload`, {
    method: "POST",
    body: form,
  });
  return parseJson(response);
}

export async function analyzeCandidates(jobId: number): Promise<RankingSummary> {
  const response = await fetch(`${API_BASE}/jobs/${jobId}/analyze`, {
    method: "POST",
  });
  return parseJson(response);
}

export async function fetchSummary(jobId: number): Promise<RankingSummary> {
  const response = await fetch(`${API_BASE}/jobs/${jobId}/summary`);
  return parseJson(response);
}

export async function fetchCandidates(jobId: number): Promise<Candidate[]> {
  const response = await fetch(`${API_BASE}/jobs/${jobId}/candidates?limit=100`);
  return parseJson(response);
}
