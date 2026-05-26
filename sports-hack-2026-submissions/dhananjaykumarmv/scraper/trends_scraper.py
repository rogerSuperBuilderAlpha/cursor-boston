import time
import random
import hashlib
import os
import json
from datetime import datetime, timezone

# Urllib3 v2.0 compatibility monkeypatch for Pytrends
try:
    import urllib3.util.retry
    original_init = urllib3.util.retry.Retry.__init__
    def patched_init(self, *args, **kwargs):
        if 'method_whitelist' in kwargs:
            kwargs['allowed_methods'] = kwargs.pop('method_whitelist')
        original_init(self, *args, **kwargs)
    urllib3.util.retry.Retry.__init__ = patched_init
except Exception as e:
    print(f"Note: urllib3 patch was not applied: {e}")

try:
    from pytrends.request import TrendReq
except Exception:
    TrendReq = None

class TrendsScraper:
    def __init__(self, cache_dir=None, cache_ttl_hours=24 * 7):
        try:
            if TrendReq is None:
                raise ImportError("pytrends is not installed")
            self.pytrends = TrendReq(hl='en-US', tz=360, timeout=10, retries=2, backoff_factor=0.5)
            self.api_available = True
        except Exception as e:
            print(f"Warning: Failed to initialize Pytrends: {e}. Using simulated fallback.")
            self.api_available = False

        self.cache_dir = cache_dir or os.path.join(".cache", "google_trends")
        self.cache_ttl_seconds = int(cache_ttl_hours * 3600)
        os.makedirs(self.cache_dir, exist_ok=True)

    def _get_seeded_value(self, name, key, min_val, max_val, decimals=0):
        h = hashlib.md5(f"{name}:{key}".encode()).hexdigest()
        val_hash = int(h, 16)
        normalized = val_hash / (16**32)
        val = min_val + normalized * (max_val - min_val)
        if decimals == 0:
            return int(val)
        return round(val, decimals)

    def _cache_key(self, query, timeframe="today 12-m", geo=""):
        normalized = " ".join(str(query).split()).strip().lower()
        raw = f"q={normalized}|tf={timeframe}|geo={geo}"
        return hashlib.md5(raw.encode("utf-8")).hexdigest()

    def _cache_path(self, cache_key):
        return os.path.join(self.cache_dir, f"{cache_key}.json")

    def _now_iso(self):
        return datetime.now(timezone.utc).isoformat()

    def _load_cache(self, cache_key):
        path = self._cache_path(cache_key)
        if not os.path.exists(path):
            return None
        try:
            with open(path, "r", encoding="utf-8") as f:
                payload = json.load(f)
            ts = payload.get("cached_at")
            if not ts:
                return None
            cached_at = datetime.fromisoformat(ts)
            age_s = (datetime.now(timezone.utc) - cached_at).total_seconds()
            if age_s > self.cache_ttl_seconds:
                return None
            return payload.get("data")
        except Exception:
            return None

    def _save_cache(self, cache_key, data):
        path = self._cache_path(cache_key)
        try:
            with open(path, "w", encoding="utf-8") as f:
                json.dump({"cached_at": self._now_iso(), "data": data}, f, indent=2, ensure_ascii=False)
        except Exception:
            # Cache failures should never break the pipeline.
            pass

    def _to_monthly_12(self, series):
        """
        Convert an arbitrary-length (weekly/daily) interest series into 12 month-ish buckets.
        Uses evenly-sized buckets rather than attempting calendar alignment (pytrends frequency varies).
        """
        if not series:
            return []
        step = max(1, len(series) // 12)
        monthly = []
        for i in range(0, len(series), step):
            chunk = series[i:i + step]
            if not chunk:
                continue
            monthly.append(int(round(sum(chunk) / len(chunk))))
        monthly = monthly[:12]
        while len(monthly) < 12:
            monthly.append(monthly[-1] if monthly else 0)
        return monthly

    def _compute_trajectory(self, monthly_history):
        if not monthly_history or len(monthly_history) < 12:
            return "unknown"
        first_half = sum(monthly_history[:6]) / 6
        second_half = sum(monthly_history[6:]) / 6
        diff = second_half - first_half
        if diff > 5:
            return "rising"
        if diff < -5:
            return "declining"
        return "stable"

    def get_simulated_trends(self, athlete_name):
        """Generate high-fidelity, deterministic simulated search trends data."""
        base_score = self._get_seeded_value(athlete_name, "trends_base", 45, 98)
        
        # Trajectory (0: declining, 1: stable, 2: rising)
        traj_index = self._get_seeded_value(athlete_name, "trends_traj", 0, 3)
        trajectories = ["declining", "stable", "rising"]
        trajectory = trajectories[traj_index]
        
        # Generate 12 months of interest history
        history = []
        current_score = base_score
        for i in range(12):
            if trajectory == "rising":
                step = self._get_seeded_value(athlete_name, f"step_{i}", -2, 8)
            elif trajectory == "declining":
                step = self._get_seeded_value(athlete_name, f"step_{i}", -8, 2)
            else:
                step = self._get_seeded_value(athlete_name, f"step_{i}", -4, 4)
                
            current_score = max(10, min(100, current_score + step))
            history.append(int(current_score))
            
        avg_score = int(sum(history) / len(history))
        
        return {
            "score": avg_score,
            "trajectory": trajectory,
            "interest_history": history,
            "status": "simulated"
        }

    def scrape_trends(self, athlete_name):
        """Scrape 12-month Google Trends data for the given athlete."""
        timeframe = "today 12-m"
        geo = ""

        # Cache first to reduce rate limits / throttling.
        cache_key = self._cache_key(athlete_name, timeframe=timeframe, geo=geo)
        cached = self._load_cache(cache_key)
        if cached is not None:
            # Mark cache hit without mutating cached payload (idempotent).
            data = dict(cached)
            data["status"] = "cached"
            return data

        if not self.api_available:
            data = self.get_simulated_trends(athlete_name)
            # Cache simulated too, so repeated runs are fast/deterministic.
            self._save_cache(cache_key, data)
            return data

        try:
            # Add a random sleep to avoid rate limiting
            time.sleep(random.uniform(0.5, 1.5))
            
            # Request interest over the last 12 months
            query_terms = [athlete_name]
            self.pytrends.build_payload(query_terms, cat=0, timeframe=timeframe, geo=geo)
            df = self.pytrends.interest_over_time()
            
            used_query = athlete_name
            if df.empty or used_query not in df:
                # Try with a simplified name query
                simplified_name = athlete_name.split()
                if len(simplified_name) > 1:
                    used_query = f"{simplified_name[0]} {simplified_name[1]}"
                    self.pytrends.build_payload([used_query], cat=0, timeframe=timeframe, geo=geo)
                    df = self.pytrends.interest_over_time()
            
            if df.empty or used_query not in df:
                data = {
                    "score": None,
                    "trajectory": "unknown",
                    "interest_history": [],
                    "status": "empty",
                    "error": "empty_response"
                }
                self._save_cache(cache_key, data)
                return data

            # `interest_over_time` includes an `isPartial` column; ignore it.
            interest_data = df[used_query].astype(float).fillna(0).tolist()
            monthly_history = self._to_monthly_12(interest_data)
            trajectory = self._compute_trajectory(monthly_history)
            avg_score = int(round(sum(monthly_history) / 12)) if monthly_history else None

            data = {
                "score": avg_score,
                "trajectory": trajectory,
                "interest_history": monthly_history,
                "status": "live",
                "query": used_query
            }
            self._save_cache(cache_key, data)
            return data
                
        except Exception as e:
            # Robust behavior: do not hallucinate trends if Google is blocked/rate-limiting.
            # Cache the error briefly so reruns don't hammer the endpoint.
            print(f"Trends API error for '{athlete_name}': {e}. Returning empty trends payload.")
            data = {
                "score": None,
                "trajectory": "unknown",
                "interest_history": [],
                "status": "error",
                "error": "exception"
            }
            self._save_cache(cache_key, data)
            return data

if __name__ == "__main__":
    scraper = TrendsScraper()
    print("Scraping Kylian Mbappé trends...")
    print(scraper.scrape_trends("Kylian Mbappé"))
