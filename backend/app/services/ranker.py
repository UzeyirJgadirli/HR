"""CV ranking: Claude claude-opus-4-7 when API key is set, rule-based fallback otherwise."""
from __future__ import annotations

import datetime
import json
import re
import unicodedata
from typing import Any

from app.core.config import settings
from app.models.candidate import Candidate
from app.models.job import JobCriteria


# ---------------------------------------------------------------------------
# Text normalisation
# ---------------------------------------------------------------------------

# Maps fancy Unicode punctuation to plain ASCII equivalents
_UNICODE_MAP = str.maketrans({
    "‘": "'",  # left single quotation mark
    "’": "'",  # right single quotation mark  ← the one PDFs use in "Master's"
    "‚": "'",  # single low-9 quotation mark
    "‛": "'",  # single high-reversed-9 quotation mark
    "“": '"',  # left double quotation mark
    "”": '"',  # right double quotation mark
    "–": "-",  # en dash
    "—": "-",  # em dash
    "―": "-",  # horizontal bar
    "·": " ",  # middle dot
    "•": " ",  # bullet
    " ": " ",  # non-breaking space
})


def _normalise(text: str) -> str:
    """Normalise Unicode to ASCII-safe, lowercase, collapsed-whitespace string."""
    text = text.translate(_UNICODE_MAP)
    # Decompose remaining accented chars (é → e + ́), then strip combining marks
    text = unicodedata.normalize("NFD", text)
    text = "".join(c for c in text if unicodedata.category(c) != "Mn")
    return re.sub(r"\s+", " ", text).lower().strip()


# ---------------------------------------------------------------------------
# Education synonym expansion
# Education terms typed as "Master's degree" must match "MSc", "M.S.", etc.
# ---------------------------------------------------------------------------

_EDU_SYNONYMS: dict[str, list[str]] = {
    "bachelor": ["bachelor", "bsc", "b.sc", "b.s.", "ba ", "b.a.", "undergraduate", "honours"],
    "master": ["master", "msc", "m.sc", "m.s.", "ma ", "m.a.", "mba", "m.b.a", "postgraduate", "pg diploma"],
    "phd": ["phd", "ph.d", "doctorate", "doctoral", "dphil"],
    "associate": ["associate", "hnd", "foundation degree"],
    "diploma": ["diploma", "hnd", "btec"],
}


def _expand_edu_term(term: str) -> list[str]:
    """Return term plus all known synonyms that apply."""
    variants = [term]
    for key, syns in _EDU_SYNONYMS.items():
        if key in term:
            variants.extend(syns)
    return list(dict.fromkeys(variants))  # deduplicate, preserve order


# ---------------------------------------------------------------------------
# Skill synonym expansion — common abbreviations / alternate names
# ---------------------------------------------------------------------------

_SKILL_ALIASES: dict[str, list[str]] = {
    "javascript": ["javascript", "js"],
    "typescript": ["typescript", "ts"],
    "python": ["python", "py"],
    "react native": ["react native", "rn"],
    "node.js": ["node.js", "nodejs", "node"],
    "postgresql": ["postgresql", "postgres"],
    "mongodb": ["mongodb", "mongo"],
    "kubernetes": ["kubernetes", "k8s"],
    "power bi": ["power bi", "powerbi"],
    "microsoft sql": ["microsoft sql", "mssql", "ms sql"],
    "machine learning": ["machine learning", "ml"],
    "artificial intelligence": ["artificial intelligence", "ai"],
    "amazon web services": ["amazon web services", "aws"],
    "google cloud": ["google cloud", "gcp"],
    "microsoft azure": ["microsoft azure", "azure"],
    "continuous integration": ["continuous integration", "ci/cd", "cicd"],
    "nosql": ["nosql", "no-sql", "no sql"],
}


def _expand_skill(skill: str) -> list[str]:
    skill = skill.strip().lower()
    for canonical, aliases in _SKILL_ALIASES.items():
        if skill in aliases or skill == canonical:
            return aliases
    return [skill]


# ---------------------------------------------------------------------------
# Core matching helpers
# ---------------------------------------------------------------------------

def _tokenize(value: str) -> list[str]:
    return [_normalise(t) for t in value.split(",") if t.strip()]


def _term_in_text(term: str, text_norm: str) -> bool:
    """Check whether a term (or any of its aliases) appears in the normalised text."""
    for variant in _expand_skill(term):
        # Escape and allow optional trailing 's' (e.g. "python" matches "python3")
        pattern = r"(?<![a-z0-9])" + re.escape(variant) + r"(?![a-z0-9])"
        if re.search(pattern, text_norm):
            return True
    return False


def _edu_term_in_text(term: str, text_norm: str) -> bool:
    """Check education term with synonym expansion."""
    for variant in _expand_edu_term(term):
        pattern = r"(?<![a-z0-9])" + re.escape(_normalise(variant)) + r"(?![a-z0-9])"
        if re.search(pattern, text_norm):
            return True
    return False


def _skill_matches(text_norm: str, skills: list[str]) -> tuple[list[str], list[str]]:
    matched, missing = [], []
    for skill in skills:
        if _term_in_text(skill, text_norm):
            matched.append(skill)
        else:
            missing.append(skill)
    return matched, missing


def _count_hits(text_norm: str, terms: list[str], edu: bool = False) -> int:
    check = _edu_term_in_text if edu else _term_in_text
    return sum(1 for t in terms if check(t, text_norm))


# ---------------------------------------------------------------------------
# Experience extraction
# ---------------------------------------------------------------------------

def _estimate_years(text_norm: str, raw_text: str) -> float:
    # "X years of experience"
    explicit = re.findall(r"(\d+(?:\.\d+)?)\s*\+?\s*years?\s+(?:of\s+)?(?:professional\s+)?(?:experience|exp)", text_norm)
    if explicit:
        return max(float(v) for v in explicit)

    # "X years" anywhere
    general = re.findall(r"(\d+(?:\.\d+)?)\s*\+?\s*years", text_norm)
    if general:
        return max(float(v) for v in general)

    # Date ranges: 2018 – 2024 / 2018 - Present
    now = datetime.datetime.now().year
    ranges = re.findall(r"(20\d{2})\s*[-–—]+\s*(20\d{2}|present|current|now|today)", text_norm)
    total = 0.0
    for start, end in ranges:
        end_y = now if end in ("present", "current", "now", "today") else int(end)
        total += max(end_y - int(start), 0)
    if total:
        return total

    # Span of all 4-digit years found
    years_found = sorted({int(y) for y in re.findall(r"\b(20\d{2})\b", raw_text)})
    if len(years_found) >= 2:
        return float(years_found[-1] - years_found[0])

    return 0.0


# ---------------------------------------------------------------------------
# Rule-based scorer
# ---------------------------------------------------------------------------

def _score_with_rules(candidate: Candidate, criteria: JobCriteria) -> None:
    raw = candidate.extracted_text or ""
    text_norm = _normalise(raw)

    required = _tokenize(criteria.required_skills)
    preferred = _tokenize(criteria.preferred_skills)
    keywords = _tokenize(criteria.keywords)
    certs = _tokenize(criteria.certifications)
    edu_terms = _tokenize(criteria.preferred_education)
    industry = _tokenize(criteria.industry_experience)

    # --- Required skills (40 pts) ---
    req_matched, req_missing = _skill_matches(text_norm, required)
    req_score = (len(req_matched) / len(required) * 40) if required else 40.0

    # --- Preferred skills (20 pts) ---
    pref_matched, pref_missing = _skill_matches(text_norm, preferred)
    pref_score = (len(pref_matched) / len(preferred) * 20) if preferred else 20.0

    # --- Experience (20 pts) ---
    years = _estimate_years(text_norm, raw)
    min_y = criteria.min_years_experience or 0
    if min_y == 0:
        exp_score = 20.0
    elif years >= min_y:
        exp_score = 20.0
    else:
        exp_score = (years / min_y) * 20.0

    # --- Education (8 pts) — with synonym expansion ---
    edu_hits = _count_hits(text_norm, edu_terms, edu=True)
    edu_score = (edu_hits / len(edu_terms) * 8) if edu_terms else 8.0

    # --- Keywords + Industry (8 pts) ---
    kw_hits = _count_hits(text_norm, keywords + industry)
    kw_total = len(keywords) + len(industry)
    kw_score = (kw_hits / kw_total * 8) if kw_total else 8.0

    # --- Certifications (4 pts) ---
    cert_hits = _count_hits(text_norm, certs)
    cert_score = (cert_hits / len(certs) * 4) if certs else 4.0

    total = min(req_score + pref_score + exp_score + edu_score + kw_score + cert_score, 100.0)

    parts = []
    if required:
        parts.append(f"Required skills {len(req_matched)}/{len(required)}")
    if preferred:
        parts.append(f"preferred {len(pref_matched)}/{len(preferred)}")
    parts.append(f"exp {years:.1f}yr")
    if edu_terms:
        parts.append(f"edu {edu_hits}/{len(edu_terms)}")
    if kw_total:
        parts.append(f"keywords {kw_hits}/{kw_total}")
    if certs:
        parts.append(f"certs {cert_hits}/{len(certs)}")

    candidate.score = round(total, 1)
    candidate.years_experience = years
    candidate.score_reason = " · ".join(parts)
    candidate.matched_skills = json.dumps(req_matched + pref_matched)
    candidate.missing_skills = json.dumps(req_missing + pref_missing)


# ---------------------------------------------------------------------------
# Claude AI scorer
# ---------------------------------------------------------------------------

_SYSTEM_PROMPT = """You are an expert HR specialist evaluating candidates against job criteria.

Analyse the CV text and return ONLY valid JSON — no markdown fences, no extra text:
{
  "score": <number 0-100>,
  "years_experience": <number>,
  "matched_skills": ["skill1", "skill2"],
  "missing_skills": ["skill3"],
  "score_reason": "<one sentence summary>"
}"""


def _build_user_message(text: str, criteria: JobCriteria) -> str:
    return f"""Job: {criteria.title}
Min experience: {criteria.min_years_experience} years
Required skills: {criteria.required_skills}
Preferred skills: {criteria.preferred_skills}
Education: {criteria.preferred_education}
Location: {criteria.location}
Industry: {criteria.industry_experience}
Keywords: {criteria.keywords}
Certifications: {criteria.certifications}

CV TEXT:
{text[:15000]}

Score the candidate 0-100 against the criteria above. Be thorough — check for skill aliases (e.g. JS=JavaScript, MSc=Master's degree). Return JSON only."""


def _score_with_claude(candidate: Candidate, criteria: JobCriteria) -> bool:
    """Try Claude scoring. Returns True on success, False on any failure."""
    key = (settings.anthropic_api_key or "").strip()
    if not key or key.startswith("your-"):
        return False

    try:
        import anthropic  # noqa: PLC0415

        client = anthropic.Anthropic(api_key=key)
        response = client.messages.create(
            model="claude-opus-4-7",
            max_tokens=512,
            thinking={"type": "adaptive"},
            system=[
                {
                    "type": "text",
                    "text": _SYSTEM_PROMPT,
                    "cache_control": {"type": "ephemeral"},
                }
            ],
            messages=[
                {"role": "user", "content": _build_user_message(candidate.extracted_text or "", criteria)}
            ],
        )

        text_block = next((b for b in response.content if b.type == "text"), None)
        if not text_block:
            return False

        raw = text_block.text.strip()
        raw = re.sub(r"^```(?:json)?\s*", "", raw)
        raw = re.sub(r"\s*```$", "", raw)
        data: dict[str, Any] = json.loads(raw)

        candidate.score = float(data.get("score", 0))
        candidate.years_experience = float(data.get("years_experience", 0))
        candidate.score_reason = str(data.get("score_reason", ""))
        candidate.matched_skills = json.dumps(data.get("matched_skills", []))
        candidate.missing_skills = json.dumps(data.get("missing_skills", []))
        return True

    except Exception:  # noqa: BLE001
        return False


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------

def rank_candidates(candidates: list[Candidate], criteria: JobCriteria) -> list[Candidate]:
    for candidate in candidates:
        cv_text = (candidate.extracted_text or "").strip()
        if not cv_text:
            candidate.score = 0.0
            candidate.years_experience = 0.0
            candidate.score_reason = "No text could be extracted from this file."
            candidate.matched_skills = "[]"
            candidate.missing_skills = "[]"
            continue

        # Try Claude first; fall back to rule-based if key missing/invalid/error
        if not _score_with_claude(candidate, criteria):
            _score_with_rules(candidate, criteria)

    ranked = sorted(candidates, key=lambda c: c.score, reverse=True)
    for i, candidate in enumerate(ranked, start=1):
        candidate.rank = i

    return ranked
