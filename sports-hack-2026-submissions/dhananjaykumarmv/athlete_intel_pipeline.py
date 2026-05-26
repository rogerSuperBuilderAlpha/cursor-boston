#!/usr/bin/env python3
import argparse
import json
import math
import os
import re
import time
from dataclasses import dataclass
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple

import requests


def _slugify(name: str) -> str:
    # Keep stable keys across runs; mirror scraper behavior.
    name = (
        name.replace("é", "e")
        .replace("ó", "o")
        .replace("ć", "c")
        .replace("í", "i")
        .replace("á", "a")
        .replace("ú", "u")
        .replace("Ś", "S")
        .replace("ś", "s")
        .replace("ū", "u")
    )
    slug = re.sub(r"[^a-zA-Z0-9]+", "_", name.lower().strip())
    return slug.strip("_")


def _as_number(x: Any) -> Optional[float]:
    if x is None:
        return None
    if isinstance(x, bool):
        return None
    if isinstance(x, (int, float)):
        v = float(x)
        return v if math.isfinite(v) else None
    if isinstance(x, str):
        try:
            v = float(x.strip())
        except Exception:
            return None
        return v if math.isfinite(v) else None
    return None


def _safe_str(x: Any, max_len: int = 4000) -> str:
    if x is None:
        return ""
    s = str(x)
    s = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f]", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    if len(s) > max_len:
        return s[: max_len - 3] + "..."
    return s


def _read_json(path: str) -> Dict[str, Any]:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def _iter_profile_paths(raw_dir: str) -> List[str]:
    if not os.path.isdir(raw_dir):
        return []
    paths: List[str] = []
    for name in os.listdir(raw_dir):
        if name.lower().endswith(".json"):
            paths.append(os.path.join(raw_dir, name))
    paths.sort()
    return paths


def build_enriched_document_text(profile: Dict[str, Any]) -> str:
    """
    Deterministic text template: stable field ordering and formatting so embeddings
    are comparable across runs.
    """
    name = _safe_str(profile.get("name"))
    sport = _safe_str(profile.get("sport"))
    team = _safe_str(profile.get("team"))
    position = _safe_str(profile.get("position"))
    nationality = _safe_str(profile.get("nationality"))
    age = _as_number(profile.get("age"))
    bio = _safe_str(profile.get("bio"), max_len=8000)

    market_value_m = _as_number(profile.get("market_value_m"))

    gt = profile.get("google_trends") or {}
    trends_score = _as_number(gt.get("score"))
    trajectory = _safe_str(gt.get("trajectory"))

    sponsorships = profile.get("sponsorships") or []
    sponsor_brands: List[str] = []
    sponsor_categories: List[str] = []
    if isinstance(sponsorships, list):
        for s in sponsorships[:50]:
            if not isinstance(s, dict):
                continue
            b = _safe_str(s.get("brand"))
            c = _safe_str(s.get("category"))
            if b:
                sponsor_brands.append(b)
            if c:
                sponsor_categories.append(c)

    brand_score = profile.get("brand_score") or {}
    overall = _as_number(brand_score.get("overall_score"))
    tier = _safe_str(brand_score.get("tier"))
    sub = brand_score.get("sub_scores") or {}
    social_reach = _as_number(sub.get("social_reach"))
    engagement_quality = _as_number(sub.get("engagement_quality"))
    search_trend = _as_number(sub.get("search_trend"))
    sponsorship_strength = _as_number(sub.get("sponsorship_strength"))
    athletic_market_value_score = _as_number(sub.get("athletic_market_value"))

    social_metrics = profile.get("social_metrics") or {}
    ig = social_metrics.get("instagram") or {}
    tt = social_metrics.get("tiktok") or {}
    yt = social_metrics.get("youtube") or {}
    fb = social_metrics.get("facebook") or {}

    ig_followers = _as_number(ig.get("followers"))
    ig_engagement = _as_number(ig.get("engagement_rate"))
    tt_followers = _as_number(tt.get("followers"))
    yt_subscribers = _as_number(yt.get("subscribers"))
    fb_followers = _as_number(fb.get("followers"))

    lines: List[str] = []
    lines.append("DOCUMENT_TYPE: athlete_profile_enriched_v1")
    lines.append(f"NAME: {name}")
    lines.append(f"SPORT: {sport}")
    if team:
        lines.append(f"TEAM: {team}")
    if position:
        lines.append(f"POSITION: {position}")
    if nationality:
        lines.append(f"NATIONALITY: {nationality}")
    if age is not None:
        lines.append(f"AGE: {int(age) if age.is_integer() else age}")

    if market_value_m is not None:
        lines.append(f"MARKET_VALUE_M_EUR: {market_value_m}")

    sm = []
    if ig_followers is not None:
        sm.append(f"ig_followers={int(ig_followers)}")
    if ig_engagement is not None:
        sm.append(f"ig_engagement_rate={ig_engagement}")
    if tt_followers is not None:
        sm.append(f"tt_followers={int(tt_followers)}")
    if yt_subscribers is not None:
        sm.append(f"yt_subscribers={int(yt_subscribers)}")
    if fb_followers is not None:
        sm.append(f"fb_followers={int(fb_followers)}")
    if sm:
        lines.append("SOCIAL_METRICS: " + ", ".join(sm))

    if trends_score is not None or trajectory:
        parts = []
        if trends_score is not None:
            parts.append(f"score_0_100={trends_score}")
        if trajectory:
            parts.append(f"trajectory={trajectory}")
        lines.append("GOOGLE_TRENDS: " + ", ".join(parts))

    if sponsor_brands or sponsor_categories:
        uniq_brands = sorted(set(sponsor_brands))[:25]
        uniq_cats = sorted(set(sponsor_categories))[:25]
        if uniq_brands:
            lines.append("SPONSORS: " + "; ".join(uniq_brands))
        if uniq_cats:
            lines.append("SPONSOR_CATEGORIES: " + "; ".join(uniq_cats))

    if overall is not None or tier:
        parts = []
        if overall is not None:
            parts.append(f"brand_power_score_0_100={overall}")
        if tier:
            parts.append(f"tier={tier}")
        lines.append("BRAND_POWER: " + ", ".join(parts))

    comp_parts = []
    if social_reach is not None:
        comp_parts.append(f"social_reach={social_reach}")
    if engagement_quality is not None:
        comp_parts.append(f"engagement_quality={engagement_quality}")
    if search_trend is not None:
        comp_parts.append(f"search_trend={search_trend}")
    if sponsorship_strength is not None:
        comp_parts.append(f"sponsorship_strength={sponsorship_strength}")
    if athletic_market_value_score is not None:
        comp_parts.append(f"athletic_market_value={athletic_market_value_score}")
    if comp_parts:
        lines.append("BRAND_POWER_COMPONENTS: " + ", ".join(comp_parts))

    if bio:
        lines.append("BIO: " + bio)

    return "\n".join(lines).strip() + "\n"


@dataclass(frozen=True)
class Config:
    supabase_url: str
    supabase_service_role_key: str
    cohere_api_key: str
    cohere_model: str = "embed-english-v3.0"
    embedding_dim: int = 1024
    rpc_name: str = "upsert_player_document"
    request_timeout_s: int = 30
    max_retries: int = 4


def load_config() -> Config:
    supabase_url = os.environ.get("SUPABASE_URL", "").strip()
    supabase_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()
    cohere_key = os.environ.get("COHERE_API_KEY", "").strip()
    model = os.environ.get("COHERE_EMBED_MODEL", "embed-english-v3.0").strip() or "embed-english-v3.0"
    dim = int(os.environ.get("EMBEDDING_DIM", "1024").strip() or "1024")
    rpc_name = os.environ.get("SUPABASE_UPSERT_RPC", "upsert_player_document").strip() or "upsert_player_document"

    if not supabase_url:
        raise SystemExit("Missing env var SUPABASE_URL")
    if not supabase_key:
        raise SystemExit("Missing env var SUPABASE_SERVICE_ROLE_KEY")
    if not cohere_key:
        raise SystemExit("Missing env var COHERE_API_KEY")

    return Config(
        supabase_url=supabase_url,
        supabase_service_role_key=supabase_key,
        cohere_api_key=cohere_key,
        cohere_model=model,
        embedding_dim=dim,
        rpc_name=rpc_name,
    )


def _with_retries(fn, *, max_retries: int, base_sleep_s: float = 0.75):
    last_err: Optional[Exception] = None
    for attempt in range(max_retries + 1):
        try:
            return fn()
        except Exception as e:
            last_err = e
            if attempt >= max_retries:
                raise
            time.sleep(base_sleep_s * (2**attempt))
    raise last_err  # pragma: no cover


def embed_texts_cohere(cfg: Config, texts: Sequence[str]) -> List[List[float]]:
    if not texts:
        return []

    url = "https://api.cohere.com/v1/embed"
    headers = {
        "Authorization": f"Bearer {cfg.cohere_api_key}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }
    payload: Dict[str, Any] = {
        "model": cfg.cohere_model,
        "texts": list(texts),
        "input_type": "search_document",
        "embedding_types": ["float"],
    }

    def _do():
        resp = requests.post(url, headers=headers, json=payload, timeout=cfg.request_timeout_s)
        if resp.status_code >= 400:
            raise RuntimeError(f"Cohere embed failed ({resp.status_code}): {resp.text[:500]}")
        data = resp.json()
        embeddings = data.get("embeddings")
        if embeddings is None:
            raise RuntimeError("Cohere response missing embeddings")
        if isinstance(embeddings, dict) and "float" in embeddings:
            embeddings = embeddings["float"]
        if not isinstance(embeddings, list):
            raise RuntimeError("Cohere embeddings unexpected shape")

        out: List[List[float]] = []
        for i, e in enumerate(embeddings):
            if not isinstance(e, list):
                raise RuntimeError(f"Cohere embedding {i} not a list")
            if cfg.embedding_dim and len(e) != cfg.embedding_dim:
                raise RuntimeError(f"Embedding dim mismatch: expected {cfg.embedding_dim}, got {len(e)}")
            vec = []
            for v in e:
                fv = float(v)
                if not math.isfinite(fv):
                    raise RuntimeError("Non-finite embedding value")
                vec.append(fv)
            out.append(vec)
        return out

    return _with_retries(_do, max_retries=cfg.max_retries)


def supabase_upsert_player_document(
    cfg: Config,
    *,
    player_key: str,
    sport: str,
    document_type: str,
    embedding: List[float],
    content: Dict[str, Any],
    metadata: Dict[str, Any],
    brand_power_score: Optional[float],
) -> Dict[str, Any]:
    rpc_url = cfg.supabase_url.rstrip("/") + f"/rest/v1/rpc/{cfg.rpc_name}"
    headers = {
        "apikey": cfg.supabase_service_role_key,
        "Authorization": f"Bearer {cfg.supabase_service_role_key}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }
    embedding_as_text = json.dumps(embedding, separators=(",", ":"))
    payload = {
        "p_player_key": player_key,
        "p_sport": sport,
        "p_document_type": document_type,
        "p_embedding_as_text": embedding_as_text,
        "p_content": content,
        "p_metadata": metadata,
        "p_brand_power_score": brand_power_score,
    }

    def _do():
        resp = requests.post(rpc_url, headers=headers, json=payload, timeout=cfg.request_timeout_s)
        if resp.status_code >= 400:
            raise RuntimeError(f"Supabase RPC failed ({resp.status_code}): {resp.text[:500]}")
        data = resp.json()
        if not isinstance(data, dict):
            raise RuntimeError("Supabase RPC returned unexpected payload (expected object)")
        return data

    return _with_retries(_do, max_retries=cfg.max_retries)


def _chunk(seq: Sequence[Any], size: int) -> Iterable[Sequence[Any]]:
    for i in range(0, len(seq), size):
        yield seq[i : i + size]


def cmd_reindex(args: argparse.Namespace) -> int:
    cfg = load_config()

    raw_dir = os.path.join(args.data_dir, "raw_profiles")
    paths = _iter_profile_paths(raw_dir)
    if args.limit is not None:
        paths = paths[: args.limit]

    if not paths:
        print(f"No cached athlete profiles found in {raw_dir}")
        return 2

    document_type = args.document_type
    batch_size = max(1, min(32, args.batch_size))

    ok = 0
    failed = 0
    skipped = 0

    for path_batch in _chunk(paths, batch_size):
        texts: List[str] = []
        rows: List[Tuple[str, str, Optional[float], Dict[str, Any], Dict[str, Any]]] = []

        for pth in path_batch:
            try:
                profile = _read_json(pth)
                name = _safe_str(profile.get("name"))
                sport = _safe_str(profile.get("sport"))
                if not name or not sport:
                    skipped += 1
                    continue

                player_key = _safe_str(profile.get("player_key")) or _slugify(name)
                overall = _as_number((profile.get("brand_score") or {}).get("overall_score"))

                enriched_text = build_enriched_document_text(profile)

                content = dict(profile)
                content["player_key"] = player_key
                content["pipeline_stage"] = content.get("pipeline_stage") or "6_score_done"
                content["vector_document_text"] = enriched_text

                metadata = {
                    "source": "local_cache",
                    "source_path": os.path.relpath(pth, args.data_dir),
                    "name": name,
                    "sport": sport,
                    "document_type": document_type,
                    "updated_at_unix": int(time.time()),
                }

                texts.append(enriched_text)
                rows.append((player_key, sport, overall, content, metadata))
            except Exception as e:
                failed += 1
                print(f"[reindex:error] {os.path.basename(pth)}: {e}")

        if not texts:
            continue

        try:
            embeddings = embed_texts_cohere(cfg, texts)
        except Exception as e:
            failed += len(texts)
            print(f"[reindex:error] embed batch failed: {e}")
            continue

        for (player_key, sport, overall, content, metadata), emb in zip(rows, embeddings):
            try:
                if args.dry_run:
                    ok += 1
                    continue
                _ = supabase_upsert_player_document(
                    cfg,
                    player_key=player_key,
                    sport=sport,
                    document_type=document_type,
                    embedding=emb,
                    content=content,
                    metadata=metadata,
                    brand_power_score=overall,
                )
                ok += 1
            except Exception as e:
                failed += 1
                print(f"[reindex:error] upsert failed ({player_key}): {e}")

        if args.sleep_s > 0:
            time.sleep(float(args.sleep_s))

    print(f"[reindex] done ok={ok} skipped={skipped} failed={failed} total={len(paths)}")
    return 0 if failed == 0 else 1


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description="Athlete Intel pipeline utilities (vector reindex).")
    sub = p.add_subparsers(dest="cmd", required=True)

    reidx = sub.add_parser("reindex", help="Re-embed enriched profiles and upsert to Supabase pgvector.")
    reidx.add_argument(
        "--data-dir",
        type=str,
        default=os.path.abspath(os.path.join(os.path.dirname(__file__), "data")),
        help="Data directory containing raw_profiles/*.json",
    )
    reidx.add_argument("--limit", type=int, default=None, help="Limit number of profiles processed.")
    reidx.add_argument("--batch-size", type=int, default=16, help="Embedding batch size (1-32).")
    reidx.add_argument(
        "--document-type",
        type=str,
        default="player_profile",
        help="Supabase athlete_documents.document_type value for upsert keying.",
    )
    reidx.add_argument("--sleep-s", type=float, default=0.0, help="Optional sleep between batches.")
    reidx.add_argument("--dry-run", action="store_true", help="Compute embeddings but do not upsert.")
    reidx.set_defaults(func=cmd_reindex)
    return p


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    return int(args.func(args))


if __name__ == "__main__":
    raise SystemExit(main())

#!/usr/bin/env python3
import argparse
import json
import math
import os
import re
import time
from dataclasses import dataclass
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple

import requests


def _slugify(name: str) -> str:
    # Keep stable keys across runs; mirror scraper behavior.
    name = (
        name.replace("é", "e")
        .replace("ó", "o")
        .replace("ć", "c")
        .replace("í", "i")
        .replace("á", "a")
        .replace("ú", "u")
        .replace("Ś", "S")
        .replace("ś", "s")
        .replace("ū", "u")
    )
    slug = re.sub(r"[^a-zA-Z0-9]+", "_", name.lower().strip())
    return slug.strip("_")


def _clamp01(x: float) -> float:
    return 0.0 if x < 0.0 else 1.0 if x > 1.0 else x


def _as_number(x: Any) -> Optional[float]:
    if x is None:
        return None
    if isinstance(x, bool):
        return None
    if isinstance(x, (int, float)):
        v = float(x)
        if math.isfinite(v):
            return v
        return None
    if isinstance(x, str):
        try:
            v = float(x.strip())
        except Exception:
            return None
        return v if math.isfinite(v) else None
    return None


def _safe_str(x: Any, max_len: int = 4000) -> str:
    if x is None:
        return ""
    s = str(x)
    s = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f]", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    if len(s) > max_len:
        return s[: max_len - 3] + "..."
    return s


def _read_json(path: str) -> Dict[str, Any]:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def _iter_profile_paths(raw_dir: str) -> List[str]:
    if not os.path.isdir(raw_dir):
        return []
    paths: List[str] = []
    for name in os.listdir(raw_dir):
        if name.lower().endswith(".json"):
            paths.append(os.path.join(raw_dir, name))
    paths.sort()
    return paths


def build_enriched_document_text(profile: Dict[str, Any]) -> str:
    """
    Deterministic text template: stable field ordering and formatting so embeddings
    are comparable across runs.
    """
    name = _safe_str(profile.get("name"))
    sport = _safe_str(profile.get("sport"))
    team = _safe_str(profile.get("team"))
    position = _safe_str(profile.get("position"))
    nationality = _safe_str(profile.get("nationality"))
    age = _as_number(profile.get("age"))
    bio = _safe_str(profile.get("bio"), max_len=8000)

    market_value_m = _as_number(profile.get("market_value_m"))

    gt = profile.get("google_trends") or {}
    trends_score = _as_number(gt.get("score"))
    trajectory = _safe_str(gt.get("trajectory"))

    sponsorships = profile.get("sponsorships") or []
    sponsor_brands: List[str] = []
    sponsor_categories: List[str] = []
    if isinstance(sponsorships, list):
        for s in sponsorships[:50]:
            if not isinstance(s, dict):
                continue
            b = _safe_str(s.get("brand"))
            c = _safe_str(s.get("category"))
            if b:
                sponsor_brands.append(b)
            if c:
                sponsor_categories.append(c)

    brand_score = profile.get("brand_score") or {}
    overall = _as_number(brand_score.get("overall_score"))
    tier = _safe_str(brand_score.get("tier"))
    sub = brand_score.get("sub_scores") or {}
    social_reach = _as_number(sub.get("social_reach"))
    engagement_quality = _as_number(sub.get("engagement_quality"))
    search_trend = _as_number(sub.get("search_trend"))
    sponsorship_strength = _as_number(sub.get("sponsorship_strength"))
    athletic_market_value_score = _as_number(sub.get("athletic_market_value"))

    social_metrics = profile.get("social_metrics") or {}
    ig = social_metrics.get("instagram") or {}
    tt = social_metrics.get("tiktok") or {}
    yt = social_metrics.get("youtube") or {}
    fb = social_metrics.get("facebook") or {}

    ig_followers = _as_number(ig.get("followers"))
    ig_engagement = _as_number(ig.get("engagement_rate"))
    tt_followers = _as_number(tt.get("followers"))
    yt_subscribers = _as_number(yt.get("subscribers"))
    fb_followers = _as_number(fb.get("followers"))

    lines: List[str] = []
    lines.append("DOCUMENT_TYPE: athlete_profile_enriched_v1")
    lines.append(f"NAME: {name}")
    lines.append(f"SPORT: {sport}")
    if team:
        lines.append(f"TEAM: {team}")
    if position:
        lines.append(f"POSITION: {position}")
    if nationality:
        lines.append(f"NATIONALITY: {nationality}")
    if age is not None:
        lines.append(f"AGE: {int(age) if age.is_integer() else age}")

    if market_value_m is not None:
        lines.append(f"MARKET_VALUE_M_EUR: {market_value_m}")

    if ig_followers is not None or ig_engagement is not None:
        lines.append(
            "INSTAGRAM: "
            + ", ".join(
                [
                    f"followers={int(ig_followers)}" if ig_followers is not None else "",
                    f"engagement_rate={ig_engagement}" if ig_engagement is not None else "",
                ]
            ).replace(", ,", ", ").strip(", ").strip()
        )
    if tt_followers is not None:
        lines.append(f"TIKTOK: followers={int(tt_followers)}")
    if yt_subscribers is not None:
        lines.append(f"YOUTUBE: subscribers={int(yt_subscribers)}")
    if fb_followers is not None:
        lines.append(f"FACEBOOK: followers={int(fb_followers)}")

    if trends_score is not None or trajectory:
        parts = []
        if trends_score is not None:
            parts.append(f"score_0_100={trends_score}")
        if trajectory:
            parts.append(f"trajectory={trajectory}")
        lines.append("GOOGLE_TRENDS: " + ", ".join(parts))

    if sponsor_brands or sponsor_categories:
        uniq_brands = sorted(set(sponsor_brands))[:25]
        uniq_cats = sorted(set(sponsor_categories))[:25]
        if uniq_brands:
            lines.append("SPONSORS: " + "; ".join(uniq_brands))
        if uniq_cats:
            lines.append("SPONSOR_CATEGORIES: " + "; ".join(uniq_cats))

    if overall is not None or tier:
        parts = []
        if overall is not None:
            parts.append(f"brand_power_score_0_100={overall}")
        if tier:
            parts.append(f"tier={tier}")
        lines.append("BRAND_POWER: " + ", ".join(parts))

    comp_parts = []
    if social_reach is not None:
        comp_parts.append(f"social_reach={social_reach}")
    if engagement_quality is not None:
        comp_parts.append(f"engagement_quality={engagement_quality}")
    if search_trend is not None:
        comp_parts.append(f"search_trend={search_trend}")
    if sponsorship_strength is not None:
        comp_parts.append(f"sponsorship_strength={sponsorship_strength}")
    if athletic_market_value_score is not None:
        comp_parts.append(f"athletic_market_value={athletic_market_value_score}")
    if comp_parts:
        lines.append("BRAND_POWER_COMPONENTS: " + ", ".join(comp_parts))

    if bio:
        lines.append("BIO: " + bio)

    return "\n".join(lines).strip() + "\n"


@dataclass(frozen=True)
class Config:
    supabase_url: str
    supabase_service_role_key: str
    cohere_api_key: str
    cohere_model: str = "embed-english-v3.0"
    embedding_dim: int = 1024
    rpc_name: str = "upsert_player_document"
    request_timeout_s: int = 30
    max_retries: int = 4


def load_config() -> Config:
    supabase_url = os.environ.get("SUPABASE_URL", "").strip()
    supabase_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()
    cohere_key = os.environ.get("COHERE_API_KEY", "").strip()
    model = os.environ.get("COHERE_EMBED_MODEL", "embed-english-v3.0").strip() or "embed-english-v3.0"
    dim = int(os.environ.get("EMBEDDING_DIM", "1024").strip() or "1024")
    rpc_name = os.environ.get("SUPABASE_UPSERT_RPC", "upsert_player_document").strip() or "upsert_player_document"
    if not supabase_url:
        raise SystemExit("Missing env var SUPABASE_URL")
    if not supabase_key:
        raise SystemExit("Missing env var SUPABASE_SERVICE_ROLE_KEY")
    if not cohere_key:
        raise SystemExit("Missing env var COHERE_API_KEY")
    return Config(
        supabase_url=supabase_url,
        supabase_service_role_key=supabase_key,
        cohere_api_key=cohere_key,
        cohere_model=model,
        embedding_dim=dim,
        rpc_name=rpc_name,
    )


def _with_retries(fn, *, max_retries: int, base_sleep_s: float = 0.75):
    last_err: Optional[Exception] = None
    for attempt in range(max_retries + 1):
        try:
            return fn()
        except Exception as e:
            last_err = e
            if attempt >= max_retries:
                raise
            sleep_s = base_sleep_s * (2**attempt)
            time.sleep(sleep_s)
    raise last_err  # pragma: no cover


def embed_texts_cohere(cfg: Config, texts: Sequence[str]) -> List[List[float]]:
    if not texts:
        return []

    url = "https://api.cohere.com/v1/embed"
    headers = {
        "Authorization": f"Bearer {cfg.cohere_api_key}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }
    payload: Dict[str, Any] = {
        "model": cfg.cohere_model,
        "texts": list(texts),
        "input_type": "search_document",
        "embedding_types": ["float"],
    }

    def _do():
        resp = requests.post(url, headers=headers, json=payload, timeout=cfg.request_timeout_s)
        if resp.status_code >= 400:
            raise RuntimeError(f"Cohere embed failed ({resp.status_code}): {resp.text[:500]}")
        data = resp.json()
        embeddings = data.get("embeddings")
        if embeddings is None:
            raise RuntimeError("Cohere response missing embeddings")
        # Cohere can return {"embeddings": {"float": [[...], ...]}} for multi-type responses.
        if isinstance(embeddings, dict) and "float" in embeddings:
            embeddings = embeddings["float"]
        if not isinstance(embeddings, list):
            raise RuntimeError("Cohere embeddings unexpected shape")
        out: List[List[float]] = []
        for i, e in enumerate(embeddings):
            if not isinstance(e, list):
                raise RuntimeError(f"Cohere embedding {i} not a list")
            if cfg.embedding_dim and len(e) != cfg.embedding_dim:
                raise RuntimeError(f"Embedding dim mismatch: expected {cfg.embedding_dim}, got {len(e)}")
            vec = []
            for v in e:
                fv = float(v)
                if not math.isfinite(fv):
                    raise RuntimeError("Non-finite embedding value")
                vec.append(fv)
            out.append(vec)
        return out

    return _with_retries(_do, max_retries=cfg.max_retries)


def supabase_upsert_player_document(
    cfg: Config,
    *,
    player_key: str,
    sport: str,
    document_type: str,
    embedding: List[float],
    content: Dict[str, Any],
    metadata: Dict[str, Any],
    brand_power_score: Optional[float],
) -> Dict[str, Any]:
    rpc_url = cfg.supabase_url.rstrip("/") + f"/rest/v1/rpc/{cfg.rpc_name}"
    headers = {
        "apikey": cfg.supabase_service_role_key,
        "Authorization": f"Bearer {cfg.supabase_service_role_key}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }
    embedding_as_text = json.dumps(embedding, separators=(",", ":"))
    payload = {
        "p_player_key": player_key,
        "p_sport": sport,
        "p_document_type": document_type,
        "p_embedding_as_text": embedding_as_text,
        "p_content": content,
        "p_metadata": metadata,
        "p_brand_power_score": brand_power_score,
    }

    def _do():
        resp = requests.post(rpc_url, headers=headers, json=payload, timeout=cfg.request_timeout_s)
        if resp.status_code >= 400:
            raise RuntimeError(f"Supabase RPC failed ({resp.status_code}): {resp.text[:500]}")
        data = resp.json()
        if not isinstance(data, dict):
            raise RuntimeError("Supabase RPC returned unexpected payload (expected object)")
        return data

    return _with_retries(_do, max_retries=cfg.max_retries)


def _chunk(seq: Sequence[Any], size: int) -> Iterable[Sequence[Any]]:
    for i in range(0, len(seq), size):
        yield seq[i : i + size]


def cmd_reindex(args: argparse.Namespace) -> int:
    cfg = load_config()

    raw_dir = os.path.join(args.data_dir, "raw_profiles")
    paths = _iter_profile_paths(raw_dir)
    if args.limit is not None:
        paths = paths[: args.limit]

    if not paths:
        print(f"No cached athlete profiles found in {raw_dir}")
        return 2

    document_type = args.document_type
    batch_size = max(1, min(32, args.batch_size))

    ok = 0
    failed = 0
    skipped = 0

    for path_batch in _chunk(paths, batch_size):
        profiles: List[Dict[str, Any]] = []
        texts: List[str] = []
        keys: List[Tuple[str, str, Optional[float], Dict[str, Any], Dict[str, Any]]] = []

        for pth in path_batch:
            try:
                profile = _read_json(pth)
                name = _safe_str(profile.get("name"))
                sport = _safe_str(profile.get("sport"))
                if not name or not sport:
                    skipped += 1
                    continue

                player_key = _safe_str(profile.get("player_key")) or _slugify(name)
                overall = _as_number((profile.get("brand_score") or {}).get("overall_score"))

                enriched_text = build_enriched_document_text(profile)

                content = dict(profile)
                content["player_key"] = player_key
                content["pipeline_stage"] = content.get("pipeline_stage") or "6_score_done"
                content["vector_document_text"] = enriched_text

                metadata = {
                    "source": "local_cache",
                    "source_path": os.path.relpath(pth, args.data_dir),
                    "name": name,
                    "sport": sport,
                    "document_type": document_type,
                    "updated_at_unix": int(time.time()),
                }

                profiles.append(profile)
                texts.append(enriched_text)
                keys.append((player_key, sport, overall, content, metadata))
            except Exception as e:
                failed += 1
                print(f"[reindex:error] {os.path.basename(pth)}: {e}")

        if not texts:
            continue

        try:
            embeddings = embed_texts_cohere(cfg, texts)
        except Exception as e:
            failed += len(texts)
            print(f"[reindex:error] embed batch failed: {e}")
            continue

        for (player_key, sport, overall, content, metadata), emb in zip(keys, embeddings):
            try:
                if args.dry_run:
                    ok += 1
                    continue
                _ = supabase_upsert_player_document(
                    cfg,
                    player_key=player_key,
                    sport=sport,
                    document_type=document_type,
                    embedding=emb,
                    content=content,
                    metadata=metadata,
                    brand_power_score=overall,
                )
                ok += 1
            except Exception as e:
                failed += 1
                print(f"[reindex:error] upsert failed ({player_key}): {e}")

        if args.sleep_s > 0:
            time.sleep(float(args.sleep_s))

    print(f"[reindex] done ok={ok} skipped={skipped} failed={failed} total={len(paths)}")
    return 0 if failed == 0 else 1


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description="Athlete Intel pipeline utilities (vector reindex).")
    sub = p.add_subparsers(dest="cmd", required=True)

    reidx = sub.add_parser("reindex", help="Re-embed enriched profiles and upsert to Supabase pgvector.")
    reidx.add_argument(
        "--data-dir",
        type=str,
        default=os.path.abspath(os.path.join(os.path.dirname(__file__), "data")),
        help="Data directory containing raw_profiles/*.json",
    )
    reidx.add_argument("--limit", type=int, default=None, help="Limit number of profiles processed.")
    reidx.add_argument("--batch-size", type=int, default=16, help="Embedding batch size (1-32).")
    reidx.add_argument(
        "--document-type",
        type=str,
        default="player_profile",
        help="Supabase athlete_documents.document_type value for upsert keying.",
    )
    reidx.add_argument("--sleep-s", type=float, default=0.0, help="Optional sleep between batches.")
    reidx.add_argument("--dry-run", action="store_true", help="Compute embeddings but do not upsert.")
    reidx.set_defaults(func=cmd_reindex)
    return p


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    return int(args.func(args))


if __name__ == "__main__":
    raise SystemExit(main())
#!/usr/bin/env python3

import argparse
import dataclasses
import datetime as dt
import glob
import json
import math
import os
import re
import sys
import time
from dataclasses import dataclass
from typing import Any, Dict, Iterable, List, Optional, Tuple

import requests


DEFAULT_EMBED_MODEL = os.getenv("COHERE_EMBED_MODEL", "embed-english-v3.0")
DEFAULT_EMBED_DIM = int(os.getenv("COHERE_EMBED_DIM", "1024"))


def _utc_now_iso() -> str:
    return dt.datetime.now(dt.timezone.utc).isoformat()


def _slugify(text: str) -> str:
    # Keep consistent with existing scraper's filename slugs.
    text = (
        text.replace("é", "e")
        .replace("ó", "o")
        .replace("ć", "c")
        .replace("í", "i")
        .replace("á", "a")
        .replace("ú", "u")
        .replace("Ś", "S")
        .replace("ś", "s")
        .replace("ū", "u")
    )
    slug = re.sub(r"[^a-zA-Z0-9]+", "_", text.lower().strip())
    return slug.strip("_")


def _is_finite_number(x: Any) -> bool:
    try:
        return isinstance(float(x), float) and math.isfinite(float(x))
    except Exception:
        return False


def _clamp_0_100(x: Optional[float]) -> Optional[float]:
    if x is None:
        return None
    try:
        xf = float(x)
    except Exception:
        return None
    if not math.isfinite(xf):
        return None
    return max(0.0, min(100.0, xf))


@dataclass(frozen=True)
class Config:
    supabase_url: str
    supabase_service_role_key: str
    cohere_api_key: str
    embed_model: str = DEFAULT_EMBED_MODEL
    embed_dim: int = DEFAULT_EMBED_DIM
    request_timeout_s: float = 30.0
    max_retries: int = 4
    backoff_base_s: float = 0.8

    @staticmethod
    def from_env() -> "Config":
        supabase_url = (os.getenv("SUPABASE_URL") or "").strip().rstrip("/")
        supabase_key = (os.getenv("SUPABASE_SERVICE_ROLE_KEY") or "").strip()
        cohere_key = (os.getenv("COHERE_API_KEY") or "").strip()

        missing = []
        if not supabase_url:
            missing.append("SUPABASE_URL")
        if not supabase_key:
            missing.append("SUPABASE_SERVICE_ROLE_KEY")
        if not cohere_key:
            missing.append("COHERE_API_KEY")
        if missing:
            raise SystemExit(f"Missing required env var(s): {', '.join(missing)}")

        embed_dim = int(os.getenv("COHERE_EMBED_DIM", str(DEFAULT_EMBED_DIM)))
        embed_model = os.getenv("COHERE_EMBED_MODEL", DEFAULT_EMBED_MODEL)

        return Config(
            supabase_url=supabase_url,
            supabase_service_role_key=supabase_key,
            cohere_api_key=cohere_key,
            embed_model=embed_model,
            embed_dim=embed_dim,
        )


@dataclass
class PlayerProfile:
    player_name: str
    sport: str
    player_key: str
    raw: Dict[str, Any]

    @staticmethod
    def from_json(obj: Dict[str, Any]) -> "PlayerProfile":
        # Support both plan-style keys and the existing scraper output.
        name = (obj.get("player_name") or obj.get("name") or "").strip()
        sport = (obj.get("sport") or "").strip()
        if not name:
            raise ValueError("missing required field: name/player_name")
        if not sport:
            raise ValueError("missing required field: sport")
        player_key = _slugify(name)
        return PlayerProfile(player_name=name, sport=sport, player_key=player_key, raw=obj)


def build_document_text(p: PlayerProfile) -> str:
    o = p.raw

    def get(path: List[str], default: Any = None) -> Any:
        cur: Any = o
        for k in path:
            if not isinstance(cur, dict):
                return default
            cur = cur.get(k)
        return cur if cur is not None else default

    parts: List[str] = []
    parts.append(f"Player: {p.player_name}")
    parts.append(f"Sport: {p.sport}")
    if get(["team"]):
        parts.append(f"Team: {get(['team'])}")
    if get(["position"]):
        parts.append(f"Position: {get(['position'])}")
    if get(["nationality"]):
        parts.append(f"Nationality: {get(['nationality'])}")
    if get(["age"]):
        parts.append(f"Age: {get(['age'])}")
    if get(["bio"]):
        parts.append(f"Bio: {get(['bio'])}")
    if get(["wikipedia_url"]):
        parts.append(f"Wikipedia: {get(['wikipedia_url'])}")

    mv = get(["market_value_m"])
    if _is_finite_number(mv):
        parts.append(f"Market value (M): {float(mv):.1f}")

    # Social summary
    ig_followers = get(["social_metrics", "instagram", "followers"])
    ig_eng = get(["social_metrics", "instagram", "engagement_rate"])
    if _is_finite_number(ig_followers) or _is_finite_number(ig_eng):
        social_bits = []
        if _is_finite_number(ig_followers):
            social_bits.append(f"Instagram followers: {int(float(ig_followers))}")
        if _is_finite_number(ig_eng):
            social_bits.append(f"Instagram engagement rate: {float(ig_eng):.2f}%")
        parts.append("Social: " + "; ".join(social_bits))

    # Trends summary (already in scraped output for this repo)
    trends_score = get(["google_trends", "score"])
    trends_traj = get(["google_trends", "trajectory"])
    if _is_finite_number(trends_score) or isinstance(trends_traj, str):
        bits = []
        if _is_finite_number(trends_score):
            bits.append(f"Google Trends score (0-100): {int(float(trends_score))}")
        if isinstance(trends_traj, str) and trends_traj.strip():
            bits.append(f"Trajectory: {trends_traj.strip()}")
        if bits:
            parts.append("Trends: " + "; ".join(bits))

    # Sponsorships summary
    sponsorships = o.get("sponsorships")
    if isinstance(sponsorships, list) and sponsorships:
        sponsor_names = []
        for s in sponsorships[:10]:
            if isinstance(s, dict) and isinstance(s.get("brand"), str) and s["brand"].strip():
                sponsor_names.append(s["brand"].strip())
        if sponsor_names:
            parts.append("Sponsors: " + ", ".join(sponsor_names))

    # Score summary (already in scraped output for this repo)
    overall_score = get(["brand_score", "overall_score"])
    tier = get(["brand_score", "tier"])
    if _is_finite_number(overall_score) or isinstance(tier, str):
        bits = []
        if _is_finite_number(overall_score):
            bits.append(f"Brand power score (0-100): {float(overall_score):.1f}")
        if isinstance(tier, str) and tier.strip():
            bits.append(f"Tier: {tier.strip()}")
        if bits:
            parts.append("Scoring: " + "; ".join(bits))

    # Deterministic formatting: stable ordering + section separation.
    return "\n".join(parts).strip() + "\n"


def _retry_sleep(base_s: float, attempt: int) -> None:
    # Exponential backoff with small jitter derived from time.
    jitter = (time.time_ns() % 1000) / 1000.0
    time.sleep(base_s * (2**attempt) + 0.15 * jitter)


def cohere_embed_texts(cfg: Config, texts: List[str]) -> List[List[float]]:
    url = "https://api.cohere.com/v1/embed"
    headers = {
        "Authorization": f"Bearer {cfg.cohere_api_key}",
        "Content-Type": "application/json",
        "Accept": "application/json",
        "User-Agent": "athlete-intel-pipeline/1.0",
    }
    body = {"model": cfg.embed_model, "texts": texts, "input_type": "search_document"}

    last_err: Optional[Exception] = None
    for attempt in range(cfg.max_retries + 1):
        try:
            resp = requests.post(url, headers=headers, json=body, timeout=cfg.request_timeout_s)
            if resp.status_code >= 500:
                raise RuntimeError(f"Cohere server error {resp.status_code}: {resp.text[:300]}")
            if resp.status_code != 200:
                raise RuntimeError(f"Cohere error {resp.status_code}: {resp.text[:500]}")
            data = resp.json()
            embeddings = data.get("embeddings")
            if not isinstance(embeddings, list) or len(embeddings) != len(texts):
                raise RuntimeError("Cohere response missing/invalid embeddings")
            out: List[List[float]] = []
            for e in embeddings:
                if not isinstance(e, list):
                    raise RuntimeError("Cohere embedding is not a list")
                if len(e) != cfg.embed_dim:
                    raise RuntimeError(f"Embedding dim mismatch: expected {cfg.embed_dim}, got {len(e)}")
                floats = []
                for v in e:
                    if not _is_finite_number(v):
                        raise RuntimeError("Embedding contained non-finite value")
                    floats.append(float(v))
                out.append(floats)
            return out
        except Exception as e:
            last_err = e
            if attempt >= cfg.max_retries:
                break
            _retry_sleep(cfg.backoff_base_s, attempt)
    raise RuntimeError(f"Failed to embed texts after retries: {last_err}")


def _embedding_as_pgvector_text(embedding: List[float]) -> str:
    # pgvector expects: '[0.1,0.2,...]'. Use compact formatting.
    return "[" + ",".join(f"{v:.8f}" for v in embedding) + "]"


def supabase_rpc_upsert_player_document(
    cfg: Config,
    *,
    player_key: str,
    sport: str,
    document_type: str,
    embedding: Optional[List[float]],
    content: Dict[str, Any],
    metadata: Dict[str, Any],
    brand_power_score: Optional[float],
) -> Dict[str, Any]:
    url = f"{cfg.supabase_url}/rest/v1/rpc/upsert_player_document"
    headers = {
        "apikey": cfg.supabase_service_role_key,
        "Authorization": f"Bearer {cfg.supabase_service_role_key}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }

    body: Dict[str, Any] = {
        "p_player_key": player_key,
        "p_sport": sport,
        "p_document_type": document_type,
        "p_embedding_as_text": _embedding_as_pgvector_text(embedding) if embedding is not None else None,
        "p_content": content,
        "p_metadata": metadata,
        "p_brand_power_score": brand_power_score,
    }

    last_err: Optional[Exception] = None
    for attempt in range(cfg.max_retries + 1):
        try:
            resp = requests.post(url, headers=headers, json=body, timeout=cfg.request_timeout_s)
            if resp.status_code >= 500:
                raise RuntimeError(f"Supabase server error {resp.status_code}: {resp.text[:300]}")
            if resp.status_code != 200:
                raise RuntimeError(f"Supabase RPC error {resp.status_code}: {resp.text[:800]}")
            data = resp.json()
            if not isinstance(data, dict):
                raise RuntimeError("Supabase RPC returned non-object JSON")
            return data
        except Exception as e:
            last_err = e
            if attempt >= cfg.max_retries:
                break
            _retry_sleep(cfg.backoff_base_s, attempt)
    raise RuntimeError(f"Failed Supabase RPC upsert after retries: {last_err}")


def iter_player_files(input_glob: str) -> Iterable[str]:
    for path in sorted(glob.glob(input_glob)):
        if os.path.isfile(path) and path.lower().endswith(".json"):
            yield path


def load_json_file(path: str, max_bytes: int = 2_000_000) -> Dict[str, Any]:
    st = os.stat(path)
    if st.st_size > max_bytes:
        raise ValueError(f"file too large ({st.st_size} bytes): {path}")
    with open(path, "r", encoding="utf-8") as f:
        obj = json.load(f)
    if not isinstance(obj, dict):
        raise ValueError("expected JSON object at top level")
    return obj


def write_report_line(report_path: str, record: Dict[str, Any]) -> None:
    os.makedirs(os.path.dirname(report_path) or ".", exist_ok=True)
    with open(report_path, "a", encoding="utf-8") as f:
        f.write(json.dumps(record, ensure_ascii=False) + "\n")


def cmd_healthcheck(args: argparse.Namespace) -> int:
    cfg = Config.from_env()
    # Basic network sanity without touching table contents.
    url = f"{cfg.supabase_url}/rest/v1/"
    headers = {"apikey": cfg.supabase_service_role_key, "Authorization": f"Bearer {cfg.supabase_service_role_key}"}
    resp = requests.get(url, headers=headers, timeout=cfg.request_timeout_s)
    if resp.status_code not in (200, 401, 404):
        # Supabase can return 404 on root; key point is we can reach host.
        raise SystemExit(f"Supabase connectivity check failed: {resp.status_code} {resp.text[:200]}")
    print(
        json.dumps(
            {
                "ok": True,
                "supabase_url": cfg.supabase_url,
                "embed_model": cfg.embed_model,
                "embed_dim": cfg.embed_dim,
                "checked_at": _utc_now_iso(),
            }
        )
    )
    return 0


def cmd_ingest(args: argparse.Namespace) -> int:
    cfg = Config.from_env()

    input_glob = args.input_glob
    document_type = args.document_type
    dry_run = args.dry_run
    batch_size = args.batch_size
    report_path = args.report_path

    files = list(iter_player_files(input_glob))
    if not files:
        raise SystemExit(f"No JSON files matched: {input_glob}")

    processed = 0
    ok = 0
    skipped = 0
    failed = 0

    def flush_batch(batch: List[Tuple[str, PlayerProfile, str]]) -> None:
        nonlocal processed, ok, skipped, failed
        if not batch:
            return

        texts = [t for _, _, t in batch]
        embeddings = cohere_embed_texts(cfg, texts)

        for (path, profile, doc_text), emb in zip(batch, embeddings):
            processed += 1
            record_base = {
                "ts": _utc_now_iso(),
                "pipeline_stage": "1_ingest",
                "status": None,
                "player_key": profile.player_key,
                "player_name": profile.player_name,
                "sport": profile.sport,
                "file": path,
            }
            try:
                brand_score = profile.raw.get("brand_score", {})
                brand_power = None
                if isinstance(brand_score, dict):
                    brand_power = _clamp_0_100(brand_score.get("overall_score"))

                content = {
                    "raw_profile": profile.raw,
                    "pipeline_stage": "1_ingest",
                    "document_text_template": "v1",
                }
                metadata = {
                    "source": "local_json",
                    "source_path": os.path.relpath(path, start=os.getcwd()),
                    "embed_model": cfg.embed_model,
                    "embed_dim": cfg.embed_dim,
                    "ingested_at": _utc_now_iso(),
                }

                if dry_run:
                    skipped += 1
                    record = {**record_base, "status": "skipped", "reason": "dry_run"}
                    write_report_line(report_path, record)
                    continue

                _ = supabase_rpc_upsert_player_document(
                    cfg,
                    player_key=profile.player_key,
                    sport=profile.sport,
                    document_type=document_type,
                    embedding=emb,
                    content=content,
                    metadata=metadata,
                    brand_power_score=brand_power,
                )
                ok += 1
                record = {**record_base, "status": "ok"}
                write_report_line(report_path, record)
            except Exception as e:
                failed += 1
                record = {**record_base, "status": "error", "error": str(e)[:500]}
                write_report_line(report_path, record)

    batch: List[Tuple[str, PlayerProfile, str]] = []
    for path in files:
        record_base = {
            "ts": _utc_now_iso(),
            "pipeline_stage": "1_ingest",
            "status": None,
            "file": path,
        }
        try:
            obj = load_json_file(path)
            profile = PlayerProfile.from_json(obj)
            doc_text = build_document_text(profile)

            batch.append((path, profile, doc_text))
            if len(batch) >= batch_size:
                flush_batch(batch)
                batch = []
        except Exception as e:
            processed += 1
            failed += 1
            record = {**record_base, "status": "error", "error": str(e)[:500]}
            write_report_line(report_path, record)

    flush_batch(batch)

    summary = {
        "ok": True,
        "command": "ingest",
        "input_glob": input_glob,
        "document_type": document_type,
        "dry_run": dry_run,
        "embed_model": cfg.embed_model,
        "embed_dim": cfg.embed_dim,
        "counts": {"processed": processed, "ok": ok, "skipped": skipped, "failed": failed},
        "report_path": report_path,
        "finished_at": _utc_now_iso(),
    }
    print(json.dumps(summary, ensure_ascii=False))
    return 0 if failed == 0 else 2


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description="Athlete Intel pipeline (ingest + enrich + reindex).")
    sub = p.add_subparsers(dest="cmd", required=True)

    h = sub.add_parser("healthcheck", help="Validate env/config and basic connectivity.")
    h.set_defaults(func=cmd_healthcheck)

    i = sub.add_parser("ingest", help="Ingest local athlete JSON into Supabase pgvector.")
    i.add_argument(
        "--input-glob",
        default="sports-hack-2026-submissions/dhananjaykumarmv/data/raw_profiles/*.json",
        help="Glob of player JSON files to ingest.",
    )
    i.add_argument("--document-type", default="player_profile", help="Document type stored in pgvector table.")
    i.add_argument("--batch-size", type=int, default=16, help="Batch size for Cohere embeddings.")
    i.add_argument("--dry-run", action="store_true", help="Compute embeddings + validate, but do not upsert.")
    i.add_argument(
        "--report-path",
        default="sports-hack-2026-submissions/dhananjaykumarmv/run_report.jsonl",
        help="Append-only JSONL report output path.",
    )
    i.set_defaults(func=cmd_ingest)

    return p


def main(argv: Optional[List[str]] = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    return int(args.func(args))


if __name__ == "__main__":
    raise SystemExit(main())

