import argparse
import sys
import os

# Add parent directory to sys.path to allow running as `python scraper/main.py` directly from project root
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from scraper.pipeline import ScrapingPipeline

BANNER = """
============================================================
   ATHLETE MARKETING INTELLIGENCE PLATFORM - DATA PIPELINE
============================================================
   Stages 1-6: Scrapes Wikipedia, Socials, Google Trends,
   Sponsorship Portfolios & Computes Brand Power Scores.
============================================================
"""

def main():
    print(BANNER)
    
    parser = argparse.ArgumentParser(
        description="Run the end-to-end athlete scraping & DB ingestion pipeline.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Run the full pipeline for all 100 athletes:
  python scraper/main.py
  
  # Test the pipeline with only 3 athletes:
  python scraper/main.py --limit 3
  
  # Force a full scrape even if cached JSON profiles exist:
  python scraper/main.py --force
        """
    )
    
    parser.add_argument(
        "--limit", 
        type=int, 
        default=None, 
        help="Limit the number of athletes to process (useful for testing)."
    )
    parser.add_argument(
        "--force", 
        action="store_true", 
        help="Force re-scraping of athletes even if cached JSON files exist."
    )
    default_data_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data"))
    parser.add_argument(
        "--data-dir", 
        type=str, 
        default=default_data_dir, 
        help="Directory to store CSV master list, cached JSONs, and SQLite DB (defaults to root /data)."
    )

    args = parser.parse_args()

    pipeline = ScrapingPipeline(
        data_dir=args.data_dir,
        force=args.force,
        limit=args.limit
    )
    
    try:
        pipeline.run()
    except KeyboardInterrupt:
        print("\n\n[Pipeline] Process interrupted by user. Exiting.")
        sys.exit(1)
    except Exception as e:
        print(f"\n\n[Pipeline] Critical error occurred: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
