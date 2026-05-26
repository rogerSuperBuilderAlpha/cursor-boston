import time
import random
import hashlib

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

from pytrends.request import TrendReq

class TrendsScraper:
    def __init__(self):
        try:
            self.pytrends = TrendReq(hl='en-US', tz=360, timeout=10, retries=2, backoff_factor=0.5)
            self.api_available = True
        except Exception as e:
            print(f"Warning: Failed to initialize Pytrends: {e}. Using simulated fallback.")
            self.api_available = False

    def _get_seeded_value(self, name, key, min_val, max_val, decimals=0):
        h = hashlib.md5(f"{name}:{key}".encode()).hexdigest()
        val_hash = int(h, 16)
        normalized = val_hash / (16**32)
        val = min_val + normalized * (max_val - min_val)
        if decimals == 0:
            return int(val)
        return round(val, decimals)

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
        if not self.api_available:
            return self.get_simulated_trends(athlete_name)

        try:
            # Add a random sleep to avoid rate limiting
            time.sleep(random.uniform(0.5, 1.5))
            
            # Request interest over the last 12 months
            self.pytrends.build_payload([athlete_name], cat=0, timeframe='today 12-m', geo='')
            df = self.pytrends.interest_over_time()
            
            if df.empty or athlete_name not in df:
                # Try with a simplified name query
                simplified_name = athlete_name.split()
                if len(simplified_name) > 1:
                    query_name = f"{simplified_name[0]} {simplified_name[1]}"
                    self.pytrends.build_payload([query_name], cat=0, timeframe='today 12-m', geo='')
                    df = self.pytrends.interest_over_time()
            
            if not df.empty and athlete_name in df:
                interest_data = df[athlete_name].tolist()
                
                # Group 52 weekly data points into 12 monthly averages
                step = max(1, len(interest_data) // 12)
                monthly_history = []
                for i in range(0, len(interest_data), step):
                    chunk = interest_data[i:i+step]
                    monthly_history.append(int(sum(chunk) / len(chunk)))
                
                # Trim to exactly 12 points
                monthly_history = monthly_history[:12]
                while len(monthly_history) < 12:
                    monthly_history.append(monthly_history[-1] if monthly_history else 50)
                
                first_half = sum(monthly_history[:6]) / 6
                second_half = sum(monthly_history[6:]) / 6
                diff = second_half - first_half
                
                if diff > 5:
                    trajectory = "rising"
                elif diff < -5:
                    trajectory = "declining"
                else:
                    trajectory = "stable"
                
                avg_score = int(sum(monthly_history) / 12)
                
                return {
                    "score": avg_score,
                    "trajectory": trajectory,
                    "interest_history": monthly_history,
                    "status": "live"
                }
            else:
                return self.get_simulated_trends(athlete_name)
                
        except Exception as e:
            # Fall back to simulation on error (e.g. rate limit HTTP 429)
            print(f"Trends API rate limit/error for '{athlete_name}': {e}. Using simulated data.")
            return self.get_simulated_trends(athlete_name)

if __name__ == "__main__":
    scraper = TrendsScraper()
    print("Scraping Kylian Mbappé trends...")
    print(scraper.scrape_trends("Kylian Mbappé"))
