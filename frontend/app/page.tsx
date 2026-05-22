"use client";

import { FormEvent, useCallback, useMemo, useRef, useState, DragEvent } from "react";

import {
  Candidate,
  JobCriteriaPayload,
  RankingSummary,
  analyzeCandidates,
  createJob,
  fetchCandidates,
  fetchSummary,
  uploadCandidates,
} from "../lib/api";

/* ------------------------------------------------------------------ */
/*  Default criteria                                                   */
/* ------------------------------------------------------------------ */
const defaultCriteria: JobCriteriaPayload = {
  title: "",
  min_years_experience: 0,
  required_skills: "",
  preferred_skills: "",
  preferred_education: "",
  location: "",
  industry_experience: "",
  keywords: "",
  certifications: "",
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */
function scoreColor(score: number) {
  if (score >= 75) return "excellent";
  if (score >= 55) return "good";
  if (score >= 35) return "average";
  return "poor";
}

function rankBadgeClass(rank: number) {
  if (rank === 1) return "rank-gold";
  if (rank === 2) return "rank-silver";
  if (rank === 3) return "rank-bronze";
  return "rank-default";
}

function parseSkills(json: string): string[] {
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function exportCSV(candidates: Candidate[]) {
  const header = "Rank,File Name,Score,Years Experience,Matched Skills,Missing Skills,Reason\n";
  const rows = candidates.map((c) => {
    const matched = parseSkills(c.matched_skills).join("; ");
    const missing = parseSkills(c.missing_skills).join("; ");
    return `${c.rank},"${c.file_name}",${c.score.toFixed(1)},${c.years_experience.toFixed(1)},"${matched}","${missing}","${c.score_reason}"`;
  });
  const blob = new Blob([header + rows.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "candidate_rankings.csv";
  a.click();
  URL.revokeObjectURL(url);
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */
export default function Home() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [criteria, setCriteria] = useState<JobCriteriaPayload>(defaultCriteria);
  const [jobId, setJobId] = useState<number | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [summary, setSummary] = useState<RankingSummary>({
    candidates_uploaded: 0,
    ranked_candidates: 0,
    top_score: 0,
  });
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* ---------- drag and drop ---------- */
  const onDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);
  const onDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  }, []);
  const onDrop = useCallback((e: DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const droppedFiles = Array.from(e.dataTransfer.files).filter((f) =>
      /\.(pdf|docx?|txt|rtf)$/i.test(f.name)
    );
    setFiles((prev) => [...prev, ...droppedFiles].slice(0, 100));
  }, []);

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  /* ---------- actions ---------- */
  const onSaveCriteria = async (e: FormEvent) => {
    e.preventDefault();
    if (!criteria.title.trim()) {
      setStatus("Please enter a job title.");
      return;
    }
    setBusy(true);
    try {
      const result = await createJob(criteria);
      setJobId(result.id);
      setStatus(`Criteria saved — Job #${result.id}`);
      setStep(2);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Failed to save criteria.");
    } finally {
      setBusy(false);
    }
  };

  const onAnalyze = async () => {
    if (!jobId) {
      setStatus("Save hiring criteria first.");
      return;
    }
    if (!files.length) {
      setStatus("Upload at least one resume.");
      return;
    }
    setBusy(true);
    setStatus("Uploading resumes...");
    try {
      await uploadCandidates(jobId, files);
      setStatus("Analyzing and ranking candidates...");
      await analyzeCandidates(jobId);

      const [summaryData, candidatesData] = await Promise.all([
        fetchSummary(jobId),
        fetchCandidates(jobId),
      ]);

      setSummary(summaryData);
      setCandidates(candidatesData);
      setStatus("Ranking complete!");
      setStep(3);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Analysis failed.");
    } finally {
      setBusy(false);
    }
  };

  const onReset = () => {
    setCriteria(defaultCriteria);
    setJobId(null);
    setFiles([]);
    setCandidates([]);
    setSummary({ candidates_uploaded: 0, ranked_candidates: 0, top_score: 0 });
    setStatus("");
    setStep(1);
    setExpandedId(null);
  };

  /* ---------- assistant insights ---------- */
  const insights = useMemo(() => {
    if (!candidates.length) return null;
    const avg = candidates.reduce((s, c) => s + c.score, 0) / candidates.length;
    const top = candidates[0];
    const above70 = candidates.filter((c) => c.score >= 70).length;
    const below30 = candidates.filter((c) => c.score < 30).length;
    const avgExp =
      candidates.reduce((s, c) => s + c.years_experience, 0) / candidates.length;
    return { avg, top, above70, below30, avgExp, total: candidates.length };
  }, [candidates]);

  /* ---------- render ---------- */
  return (
    <main className="mx-auto min-h-screen max-w-[1320px] px-4 py-6 md:px-8 md:py-10">
      {/* ============ HEADER ============ */}
      <header className="mb-8 animate-fade-in-up">
        <div className="flex items-center gap-3 mb-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#72ffd2] to-[#45a8ff] text-lg font-bold text-[#061127]">
            HR
          </div>
          <h1 className="font-display text-2xl font-bold tracking-tight md:text-3xl">
            ResumeRank<span className="text-[#72ffd2]">AI</span>
          </h1>
        </div>
        <p className="text-sm text-[#9fb2d9]">
          Upload up to 100 CVs and rank candidates against your hiring criteria in seconds.
        </p>
      </header>

      {/* ============ STEP INDICATOR ============ */}
      <div className="mb-8 flex items-center gap-2 animate-fade-in-up" style={{ animationDelay: "100ms" }}>
        {[
          { n: 1, label: "Set Criteria" },
          { n: 2, label: "Upload CVs" },
          { n: 3, label: "View Rankings" },
        ].map(({ n, label }, i) => (
          <div key={n} className="flex items-center gap-2">
            <button
              onClick={() => {
                if (n === 1) setStep(1);
                else if (n === 2 && jobId) { if (step === 3) setFiles([]); setStep(2); }
                else if (n === 3 && candidates.length) setStep(3);
              }}
              className={`flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-semibold transition-all duration-300 ${
                step === n
                  ? "step-active"
                  : step > n
                    ? "step-completed"
                    : "step-pending"
              }`}
            >
              <span
                className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                  step > n
                    ? "bg-[#72ffd2] text-[#061127]"
                    : step === n
                      ? "bg-[#72ffd2]/20 text-[#72ffd2]"
                      : "bg-white/10 text-white/40"
                }`}
              >
                {step > n ? "✓" : n}
              </span>
              <span className={step >= n ? "text-white" : "text-white/40"}>{label}</span>
            </button>
            {i < 2 && (
              <div
                className={`h-px w-8 transition-colors duration-300 ${
                  step > n ? "bg-[#72ffd2]/40" : "bg-white/10"
                }`}
              />
            )}
          </div>
        ))}
      </div>

      {/* ============ STATUS BAR ============ */}
      {status && (
        <div className="mb-6 animate-fade-in-up glass-panel px-4 py-3 text-sm flex items-center gap-2">
          {busy && (
            <svg className="h-4 w-4 animate-spin-slow text-[#72ffd2]" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="31.4 31.4" strokeLinecap="round" />
            </svg>
          )}
          <span className={busy ? "text-[#72ffd2]" : "text-[#9fb2d9]"}>{status}</span>
        </div>
      )}
      {busy && <div className="progress-bar mb-6" />}

      {/* ============ STEP 1: CRITERIA ============ */}
      {step === 1 && (
        <section className="animate-fade-in-up" style={{ animationDelay: "200ms" }}>
          <div className="glass-panel p-6 md:p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#72ffd2]/10 text-[#72ffd2]">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
              </div>
              <div>
                <h2 className="font-display text-xl font-semibold">Define Hiring Criteria</h2>
                <p className="text-xs text-[#9fb2d9]">Set the requirements for your ideal candidate</p>
              </div>
            </div>

            <form onSubmit={onSaveCriteria} className="grid gap-4 md:grid-cols-2">
              <Field
                label="Job Title *"
                placeholder="e.g. Senior Frontend Engineer"
                value={criteria.title}
                onChange={(v) => setCriteria({ ...criteria, title: v })}
              />
              <Field
                label="Minimum Years of Experience"
                placeholder="e.g. 3"
                value={String(criteria.min_years_experience || "")}
                onChange={(v) => setCriteria({ ...criteria, min_years_experience: Number(v) || 0 })}
                type="number"
              />
              <Field
                label="Required Skills (comma-separated)"
                placeholder="e.g. React, TypeScript, Node.js"
                value={criteria.required_skills}
                onChange={(v) => setCriteria({ ...criteria, required_skills: v })}
              />
              <Field
                label="Preferred Skills (comma-separated)"
                placeholder="e.g. GraphQL, Docker, AWS"
                value={criteria.preferred_skills}
                onChange={(v) => setCriteria({ ...criteria, preferred_skills: v })}
              />
              <Field
                label="Preferred Education"
                placeholder="e.g. Bachelor's, Master's"
                value={criteria.preferred_education}
                onChange={(v) => setCriteria({ ...criteria, preferred_education: v })}
              />
              <Field
                label="Location Preference"
                placeholder="e.g. Remote, London, Dubai"
                value={criteria.location}
                onChange={(v) => setCriteria({ ...criteria, location: v })}
              />
              <Field
                label="Industry Experience"
                placeholder="e.g. SaaS, FinTech, E-commerce"
                value={criteria.industry_experience}
                onChange={(v) => setCriteria({ ...criteria, industry_experience: v })}
              />
              <Field
                label="Keywords"
                placeholder="e.g. leadership, agile, product"
                value={criteria.keywords}
                onChange={(v) => setCriteria({ ...criteria, keywords: v })}
              />
              <div className="md:col-span-2">
                <Field
                  label="Certifications"
                  placeholder="e.g. AWS Solutions Architect, PMP, SHRM"
                  value={criteria.certifications}
                  onChange={(v) => setCriteria({ ...criteria, certifications: v })}
                />
              </div>
              <div className="md:col-span-2 flex items-center gap-3 pt-2">
                <button type="submit" disabled={busy} className="btn-primary">
                  {busy ? "Saving..." : "Save Criteria & Continue →"}
                </button>
              </div>
            </form>
          </div>
        </section>
      )}

      {/* ============ STEP 2: UPLOAD ============ */}
      {step === 2 && (
        <section className="animate-fade-in-up" style={{ animationDelay: "200ms" }}>
          <div className="grid gap-6 lg:grid-cols-[1.5fr,1fr]">
            {/* Upload zone */}
            <div className="glass-panel p-6 md:p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#72ffd2]/10 text-[#72ffd2]">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                </div>
                <div>
                  <h2 className="font-display text-xl font-semibold">Upload Resumes</h2>
                  <p className="text-xs text-[#9fb2d9]">Drag & drop or click to browse (up to 100 files)</p>
                </div>
              </div>

              <div
                className={`drop-zone rounded-2xl p-8 text-center cursor-pointer ${
                  dragOver ? "drag-over" : ""
                } ${files.length ? "has-files" : ""}`}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".pdf,.doc,.docx,.txt,.rtf"
                  onChange={(e) => {
                    const newFiles = Array.from(e.target.files || []);
                    setFiles((prev) => [...prev, ...newFiles].slice(0, 100));
                  }}
                  className="hidden"
                />
                <div className="animate-float inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-[#72ffd2]/10 text-[#72ffd2] mb-4">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-white">
                  {files.length
                    ? `${files.length} file${files.length > 1 ? "s" : ""} selected`
                    : "Drop your CV files here or click to browse"}
                </p>
                <p className="mt-1 text-xs text-[#9fb2d9]">
                  Supports PDF, DOCX, DOC, TXT, RTF
                </p>
              </div>

              {/* File list */}
              {files.length > 0 && (
                <div className="mt-4 max-h-[240px] overflow-y-auto space-y-1.5">
                  {files.map((file, i) => (
                    <div
                      key={`${file.name}-${i}`}
                      className="flex items-center justify-between rounded-xl bg-white/5 border border-white/8 px-3 py-2 text-xs animate-fade-in-up"
                      style={{ animationDelay: `${i * 30}ms` }}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[#72ffd2]/10 text-[10px] font-bold text-[#72ffd2] shrink-0">
                          {file.name.split(".").pop()?.toUpperCase()}
                        </span>
                        <span className="truncate text-white/80">{file.name}</span>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); removeFile(i); }}
                        className="ml-2 text-[#ff6b8a]/60 hover:text-[#ff6b8a] transition-colors shrink-0"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-6 flex items-center gap-3">
                <button onClick={onAnalyze} disabled={busy || !files.length} className="btn-primary">
                  {busy ? "Processing..." : `Analyze ${files.length} Resume${files.length !== 1 ? "s" : ""}`}
                </button>
                <button onClick={() => setStep(1)} className="btn-secondary">
                  ← Back to Criteria
                </button>
              </div>
            </div>

            {/* Criteria summary */}
            <div className="glass-panel p-6">
              <h3 className="font-display text-lg font-semibold mb-4 flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[#45a8ff]/10 text-[#45a8ff] text-xs">✓</span>
                Criteria Summary
              </h3>
              <div className="space-y-3 text-sm">
                <SummaryRow label="Job Title" value={criteria.title} />
                <SummaryRow label="Min Experience" value={`${criteria.min_years_experience} years`} />
                <SummaryRow label="Required Skills" value={criteria.required_skills} />
                <SummaryRow label="Preferred Skills" value={criteria.preferred_skills} />
                <SummaryRow label="Education" value={criteria.preferred_education} />
                <SummaryRow label="Location" value={criteria.location} />
                <SummaryRow label="Industry" value={criteria.industry_experience} />
                <SummaryRow label="Keywords" value={criteria.keywords} />
                <SummaryRow label="Certifications" value={criteria.certifications} />
              </div>
              <button
                onClick={() => setStep(1)}
                className="mt-4 text-xs text-[#72ffd2] hover:underline"
              >
                Edit criteria
              </button>
            </div>
          </div>
        </section>
      )}

      {/* ============ STEP 3: RESULTS ============ */}
      {step === 3 && (
        <section className="animate-fade-in-up" style={{ animationDelay: "150ms" }}>
          {/* Stats overview */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
            <StatCard
              label="Total Candidates"
              value={summary.candidates_uploaded}
              icon={
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              }
            />
            <StatCard
              label="Ranked"
              value={summary.ranked_candidates}
              icon={
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
              }
            />
            <StatCard
              label="Top Score"
              value={`${summary.top_score.toFixed(1)}%`}
              icon={
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
              }
              highlight
            />
            <StatCard
              label="Avg Score"
              value={insights ? `${insights.avg.toFixed(1)}%` : "--"}
              icon={
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
              }
            />
          </div>

          {/* Insights panel */}
          {insights && (
            <div className="glass-panel p-5 mb-6 animate-fade-in-up" style={{ animationDelay: "250ms" }}>
              <h3 className="font-display text-base font-semibold mb-3 flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[#45a8ff]/10 text-[#45a8ff] text-xs">💡</span>
                Batch Insights
              </h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 text-sm text-[#9fb2d9]">
                <p>
                  🏆 Top candidate: <span className="text-white font-medium">{insights.top.file_name}</span> with{" "}
                  <span className="text-[#72ffd2] font-semibold">{insights.top.score.toFixed(1)}%</span>
                </p>
                <p>
                  ✅ <span className="text-white font-medium">{insights.above70}</span> candidate{insights.above70 !== 1 ? "s" : ""} scored above 70%
                </p>
                <p>
                  ⚠️ <span className="text-white font-medium">{insights.below30}</span> candidate{insights.below30 !== 1 ? "s" : ""} scored below 30%
                </p>
                <p>
                  📊 Average score: <span className="text-white font-medium">{insights.avg.toFixed(1)}%</span>
                </p>
                <p>
                  🕐 Average experience: <span className="text-white font-medium">{insights.avgExp.toFixed(1)} years</span>
                </p>
                <p>
                  📋 Total analyzed: <span className="text-white font-medium">{insights.total} resumes</span>
                </p>
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center gap-3 mb-6">
            <button onClick={onReset} className="btn-secondary">
              ↻ New Analysis
            </button>
            {candidates.length > 0 && (
              <button onClick={() => exportCSV(candidates)} className="btn-accent">
                ↓ Export CSV
              </button>
            )}
          </div>

          {/* Candidate cards */}
          <div className="space-y-3">
            {candidates.map((candidate, i) => (
              <CandidateCard
                key={candidate.id}
                candidate={candidate}
                index={i}
                expanded={expandedId === candidate.id}
                onToggle={() =>
                  setExpandedId(expandedId === candidate.id ? null : candidate.id)
                }
              />
            ))}
          </div>

          {!candidates.length && (
            <div className="glass-panel p-12 text-center text-[#9fb2d9]">
              No candidates ranked yet. Upload resumes and run analysis.
            </div>
          )}
        </section>
      )}
    </main>
  );
}

/* ------------------------------------------------------------------ */
/*  Components                                                         */
/* ------------------------------------------------------------------ */

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-[#9fb2d9]">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-white/10 bg-[#0c1a3a] px-3.5 py-2.5 text-sm text-white placeholder:text-white/25 transition-all focus:border-[#72ffd2]/40 focus:bg-[#0e1f44] focus:shadow-[0_0_0_3px_rgba(114,255,210,0.08)]"
      />
    </label>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="text-[#9fb2d9] w-28 shrink-0">{label}</span>
      <span className="text-white/80 break-all">{value || "—"}</span>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  highlight,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <div className="glass-panel glass-panel-hover stat-glow p-4 animate-fade-in-up">
      <div className="flex items-center gap-2 mb-2">
        <span className={`text-${highlight ? "[#72ffd2]" : "[#45a8ff]"}`}>{icon}</span>
        <span className="text-xs text-[#9fb2d9] uppercase tracking-wider">{label}</span>
      </div>
      <p className={`text-2xl font-bold ${highlight ? "text-[#72ffd2]" : "text-white"}`}>
        {value}
      </p>
    </div>
  );
}

function CandidateCard({
  candidate,
  index,
  expanded,
  onToggle,
}: {
  candidate: Candidate;
  index: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  const color = scoreColor(candidate.score);
  const matched = parseSkills(candidate.matched_skills);
  const missing = parseSkills(candidate.missing_skills);

  return (
    <div
      className="glass-panel glass-panel-hover p-4 md:p-5 animate-fade-in-up cursor-pointer"
      style={{ animationDelay: `${index * 60}ms` }}
      onClick={onToggle}
    >
      <div className="flex items-center gap-4 flex-wrap">
        {/* Rank badge */}
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-xl text-sm font-bold shrink-0 ${rankBadgeClass(
            candidate.rank
          )}`}
        >
          #{candidate.rank}
        </div>

        {/* Name and filename */}
        <div className="min-w-0 flex-1">
          <p className="font-medium text-white truncate">{candidate.file_name}</p>
          <p className="text-xs text-[#9fb2d9] mt-0.5">
            {candidate.years_experience.toFixed(1)} years experience
          </p>
        </div>

        {/* Score */}
        <div className="flex items-center gap-3 shrink-0">
          <div className={`rounded-xl border px-4 py-2 text-center score-bg-${color}`}>
            <p className={`text-xl font-bold score-${color}`}>
              {candidate.score.toFixed(1)}
            </p>
            <p className="text-[10px] uppercase tracking-wider text-[#9fb2d9]">Score</p>
          </div>
          <svg
            className={`h-4 w-4 text-[#9fb2d9] transition-transform duration-300 ${
              expanded ? "rotate-180" : ""
            }`}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="mt-4 pt-4 border-t border-white/8 animate-fade-in-up space-y-3">
          {/* Score breakdown */}
          <div>
            <p className="text-xs font-semibold text-[#9fb2d9] uppercase tracking-wider mb-2">
              Score Breakdown
            </p>
            <p className="text-sm text-white/70">{candidate.score_reason}</p>
          </div>

          {/* Skills */}
          {(matched.length > 0 || missing.length > 0) && (
            <div className="grid gap-3 sm:grid-cols-2">
              {matched.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-[#72ffd2] mb-1.5">
                    ✓ Matched Skills ({matched.length})
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {matched.map((skill) => (
                      <span
                        key={skill}
                        className="chip-matched rounded-md px-2 py-0.5 text-[11px] capitalize"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {missing.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-[#ff6b8a] mb-1.5">
                    ✕ Missing Skills ({missing.length})
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {missing.map((skill) => (
                      <span
                        key={skill}
                        className="chip-missing rounded-md px-2 py-0.5 text-[11px] capitalize"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
