import os
import re
import json
import sqlite3
import argparse
import pandas as pd
from tqdm import tqdm
import hashlib

from scraper.master_list import generate_master_csv
from scraper.wikipedia_scraper import WikipediaScraper
from scraper.social_scraper import SocialScraper
from scraper.trends_scraper import TrendsScraper
from scraper.sponsorship_scraper import SponsorshipScraper
from scraper.score_calculator import ScoreCalculator

class ScrapingPipeline:
    def __init__(self, data_dir="data", force=False, limit=None):
        self.data_dir = data_dir
        self.raw_dir = os.path.join(data_dir, "raw_profiles")
        self.db_path = os.path.join(data_dir, "athletes.db")
        self.force = force
        self.limit = limit

        os.makedirs(self.raw_dir, exist_ok=True)

        self.wiki_scraper = WikipediaScraper()
        self.social_scraper = SocialScraper()
        self.trends_scraper = TrendsScraper()
        self.sponsor_scraper = SponsorshipScraper()
        self.score_calc = ScoreCalculator()

    def _slugify(self, name):
        """Convert name to a clean, lowercase filename slug."""
        # Replace non-ascii chars with standard ones if possible, else remove
        name = name.replace("é", "e").replace("ó", "o").replace("ć", "c")
        name = name.replace("í", "i").replace("á", "a").replace("ú", "u")
        name = name.replace("Ś", "S").replace("ś", "s").replace("ū", "u")
        slug = re.sub(r'[^a-zA-Z0-9]+', '_', name.lower().strip())
        return slug.strip('_')

    def _get_seeded_value(self, name, key, min_val, max_val, decimals=1):
        h = hashlib.md5(f"{name}:{key}".encode()).hexdigest()
        val_hash = int(h, 16)
        normalized = val_hash / (16**32)
        val = min_val + normalized * (max_val - min_val)
        return round(val, decimals)

    def _get_athletic_market_value(self, athlete_name, sport, rank):
        """Provide a highly realistic market value in Millions of Euros based on sport and rank."""
        # Seeded value so it remains identical for the athlete across pipeline runs
        # Base value decreases with higher rank (rank 1 = highest)
        rank_multiplier = max(0.15, 1.0 - (rank - 1) * 0.05)
        
        sport_limits = {
            "Soccer": (40.0, 180.0),
            "Basketball": (25.0, 60.0), # Career earnings / salary context
            "American Football": (15.0, 55.0),
            "Tennis": (8.0, 35.0),
            "Formula 1": (12.0, 60.0),
            "Cricket": (3.0, 15.0)
        }

        min_val, max_val = sport_limits.get(sport, (5.0, 30.0))
        base_val = self._get_seeded_value(athlete_name, "market_val_base", min_val, max_val, 1)
        
        # Apply rank modifier
        final_val = base_val * rank_multiplier
        # Ensure it fits realistic boundaries
        final_val = max(min_val * 0.4, min(max_val, final_val))
        return round(final_val, 1)

    def scrape_single_athlete(self, name, sport, rank, wikipedia_query):
        """Scrape and compile all data points for a single athlete."""
        slug = self._slugify(name)
        cache_path = os.path.join(self.raw_dir, f"{slug}.json")

        # Use cache if available and not forcing
        if os.path.exists(cache_path) and not self.force:
            try:
                with open(cache_path, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception as e:
                print(f"Failed to read cache for '{name}', re-scraping: {e}")

        print(f"\n[Scraping] {name} ({sport}, Rank {rank})")

        # 1. Base details from Wikipedia
        wiki_profile = self.wiki_scraper.scrape_athlete(name, wikipedia_query)
        if not wiki_profile:
            # Create a basic fallback profile structure if Wikipedia is unreachable
            wiki_profile = {
                "name": name,
                "bio": f"{name} is an elite professional athlete playing for {sport}.",
                "image_url": "",
                "nationality": "Global",
                "birth_date": None,
                "age": 28,
                "team": "TBD",
                "position": "Player",
                "wikipedia_url": ""
            }

        # 2. Social Media Metrics
        social_data = self.social_scraper.scrape_social_data(name, sport)

        # 3. Google Trends
        trends_data = self.trends_scraper.scrape_trends(name)

        # 4. Sponsorships
        sponsorships = self.sponsor_scraper.scrape_sponsorships(name, sport)

        # 5. Athletic Valuation
        market_value_m = self._get_athletic_market_value(name, sport, rank)

        # 6. Brand Power Score
        score_data = self.score_calc.compute_brand_power_score(
            name, sport, social_data, trends_data, sponsorships, market_value_m
        )

        # Combine into complete profile
        profile = {
            "name": name,
            "sport": sport,
            "rank": rank,
            "team": wiki_profile.get("team") or wiki_profile.get("current_club") or "TBD",
            "position": wiki_profile.get("position") or "Player",
            "nationality": wiki_profile.get("nationality") or "Global",
            "age": wiki_profile.get("age") or 28,
            "birth_date": wiki_profile.get("birth_date"),
            "bio": wiki_profile.get("bio") or "",
            "image_url": wiki_profile.get("image_url") or "",
            "wikipedia_url": wiki_profile.get("wikipedia_url") or "",
            "market_value_m": market_value_m,
            "social_metrics": social_data,
            "google_trends": trends_data,
            "sponsorships": sponsorships,
            "brand_score": score_data
        }

        # Cache locally
        with open(cache_path, "w", encoding="utf-8") as f:
            json.dump(profile, f, indent=2, ensure_ascii=False)

        return profile

    def build_sqlite_db(self, profiles):
        """Consolidate the JSON cache files into a relational SQLite Database."""
        print("\n[DB Ingestion] Initializing and building athletes.db...")
        
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        # Create Tables
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS athletes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT UNIQUE,
                sport TEXT,
                rank INTEGER,
                team TEXT,
                position TEXT,
                nationality TEXT,
                age INTEGER,
                birth_date TEXT,
                bio TEXT,
                image_url TEXT,
                wikipedia_url TEXT,
                market_value_m REAL,
                overall_score REAL,
                tier TEXT
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS social_metrics (
                athlete_id INTEGER PRIMARY KEY,
                ig_followers INTEGER,
                ig_engagement REAL,
                ig_post_freq REAL,
                ig_likes_per_post INTEGER,
                ig_comments_per_post INTEGER,
                fb_followers INTEGER,
                fb_reach INTEGER,
                fb_regions TEXT,
                tt_followers INTEGER,
                tt_views REAL,
                tt_viral REAL,
                tt_likes INTEGER,
                yt_subscribers INTEGER,
                yt_views REAL,
                yt_freq REAL,
                FOREIGN KEY (athlete_id) REFERENCES athletes(id) ON DELETE CASCADE
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS google_trends (
                athlete_id INTEGER PRIMARY KEY,
                trends_score INTEGER,
                trajectory TEXT,
                interest_history TEXT,
                FOREIGN KEY (athlete_id) REFERENCES athletes(id) ON DELETE CASCADE
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS sponsorships (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                athlete_id INTEGER,
                brand TEXT,
                category TEXT,
                value_estimate_m REAL,
                status TEXT,
                FOREIGN KEY (athlete_id) REFERENCES athletes(id) ON DELETE CASCADE
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS sub_scores (
                athlete_id INTEGER PRIMARY KEY,
                social_reach REAL,
                engagement_quality REAL,
                search_trend REAL,
                sponsorship_strength REAL,
                athletic_market_value REAL,
                FOREIGN KEY (athlete_id) REFERENCES athletes(id) ON DELETE CASCADE
            )
        """)

        conn.commit()

        # Insert Data
        for p in profiles:
            try:
                # 1. Main Athlete Table
                cursor.execute("""
                    INSERT OR REPLACE INTO athletes (
                        name, sport, rank, team, position, nationality, age, 
                        birth_date, bio, image_url, wikipedia_url, market_value_m, 
                        overall_score, tier
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    p["name"], p["sport"], p["rank"], p["team"], p["position"], p["nationality"], p["age"],
                    p["birth_date"], p["bio"], p["image_url"], p["wikipedia_url"], p["market_value_m"],
                    p["brand_score"]["overall_score"], p["brand_score"]["tier"]
                ))
                athlete_id = cursor.lastrowid
                
                if not athlete_id:
                    # If replaced, grab the existing row ID
                    cursor.execute("SELECT id FROM athletes WHERE name = ?", (p["name"],))
                    athlete_id = cursor.fetchone()[0]

                # 2. Social Metrics
                ig = p["social_metrics"].get("instagram", {})
                fb = p["social_metrics"].get("facebook", {})
                tt = p["social_metrics"].get("tiktok", {})
                yt = p["social_metrics"].get("youtube", {})
                
                cursor.execute("""
                    INSERT OR REPLACE INTO social_metrics (
                        athlete_id, ig_followers, ig_engagement, ig_post_freq, ig_likes_per_post, ig_comments_per_post,
                        fb_followers, fb_reach, fb_regions, tt_followers, tt_views, tt_viral, tt_likes,
                        yt_subscribers, yt_views, yt_freq
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    athlete_id, ig.get("followers"), ig.get("engagement_rate"), ig.get("post_frequency_per_week"),
                    ig.get("likes_per_post"), ig.get("comments_per_post"),
                    fb.get("followers"), fb.get("page_reach_monthly"), fb.get("top_regions"),
                    tt.get("followers"), tt.get("avg_views_millions"), tt.get("viral_frequency"), tt.get("total_likes"),
                    yt.get("subscribers"), yt.get("avg_views_millions"), yt.get("upload_frequency_per_month")
                ))

                # 3. Google Trends
                gt = p["google_trends"]
                cursor.execute("""
                    INSERT OR REPLACE INTO google_trends (
                        athlete_id, trends_score, trajectory, interest_history
                    ) VALUES (?, ?, ?, ?)
                """, (
                    athlete_id, gt.get("score"), gt.get("trajectory"), json.dumps(gt.get("interest_history"))
                ))

                # 4. Sponsorships
                # Delete existing partnerships for this athlete to avoid duplicates on rerun
                cursor.execute("DELETE FROM sponsorships WHERE athlete_id = ?", (athlete_id,))
                for s in p["sponsorships"]:
                    cursor.execute("""
                        INSERT INTO sponsorships (
                            athlete_id, brand, category, value_estimate_m, status
                        ) VALUES (?, ?, ?, ?, ?)
                    """, (
                        athlete_id, s.get("brand"), s.get("category"), s.get("deal_value_estimate_m"), s.get("status")
                    ))

                # 5. Sub Scores
                ss = p["brand_score"]["sub_scores"]
                cursor.execute("""
                    INSERT OR REPLACE INTO sub_scores (
                        athlete_id, social_reach, engagement_quality, search_trend, 
                        sponsorship_strength, athletic_market_value
                    ) VALUES (?, ?, ?, ?, ?, ?)
                """, (
                    athlete_id, ss.get("social_reach"), ss.get("engagement_quality"), ss.get("search_trend"),
                    ss.get("sponsorship_strength"), ss.get("athletic_market_value")
                ))

            except Exception as e:
                print(f"Error saving '{p['name']}' to SQLite: {e}")
                conn.rollback()

        conn.commit()
        conn.close()
        print(f"[DB Ingestion] Finished. SQLite DB saved to {self.db_path}")

    def run(self):
        """Execute the entire scraping and DB generation pipeline."""
        print("[Pipeline] Starting Athlete Marketing Intelligence scraper...")
        
        # Step 1: Ensure master list CSV exists
        master_csv = os.path.join(self.data_dir, "master_athletes.csv")
        if not os.path.exists(master_csv):
            master_csv = generate_master_csv(self.data_dir)

        # Step 2: Read CSV
        df = pd.read_csv(master_csv)
        
        if self.limit:
            df = df.head(self.limit)
            print(f"[Pipeline] Limiting execution to first {self.limit} athletes.")

        profiles = []
        for index, row in tqdm(df.iterrows(), total=len(df), desc="Scraping Athletes"):
            try:
                # Add delay between scrapes to avoid rate limit bans on Wikipedia / Trends
                time_to_wait = 0.5
                if not os.path.exists(os.path.join(self.raw_dir, f"{self._slugify(row['name'])}.json")) or self.force:
                    # Only sleep if we are actually scraping (not hitting cache)
                    import time
                    time.sleep(time_to_wait)
                
                profile = self.scrape_single_athlete(
                    name=row["name"],
                    sport=row["sport"],
                    rank=int(row["rank"]),
                    wikipedia_query=row["wikipedia_query"]
                )
                profiles.append(profile)
            except Exception as e:
                print(f"\n[Error] Scraping failed for '{row['name']}': {e}")
                import traceback
                traceback.print_exc()

        # Step 3: Insert everything into SQLite
        if profiles:
            self.build_sqlite_db(profiles)
            print(f"[Pipeline] Successfully processed {len(profiles)} athlete profiles!")
        else:
            print("[Pipeline] No profiles scraped/loaded. DB not updated.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Run Athlete scraping & DB compilation pipeline.")
    parser.add_argument("--limit", type=int, default=None, help="Limit number of athletes to process (for testing).")
    parser.add_argument("--force", action="store_true", help="Force scraping even if local cache exists.")
    args = parser.parse_args()

    pipeline = ScrapingPipeline(force=args.force, limit=args.limit)
    pipeline.run()
