import math

class ScoreCalculator:
    def __init__(self):
        pass

    def calculate_social_reach_score(self, social_data):
        """Calculate Social Reach Score (25% weight) based on total cross-platform followers."""
        ig = social_data.get("instagram", {}).get("followers", 0) or 0
        fb = social_data.get("facebook", {}).get("followers", 0) or 0
        tt = social_data.get("tiktok", {}).get("followers", 0) or 0
        yt = social_data.get("youtube", {}).get("subscribers", 0) or 0

        total_followers = ig + fb + tt + yt
        if total_followers <= 0:
            return 10.0

        # Normalization using a logarithmic scale
        # 100k followers -> log10(100,000) = 5 -> ~10 points
        # 10M followers -> log10(10,000,000) = 7 -> ~60 points
        # 500M+ followers -> log10(500,000,000) = 8.7 -> 100 points
        log_followers = math.log10(total_followers)
        score = 10.0 + (log_followers - 5.0) * (90.0 / 3.7)
        return float(max(10.0, min(100.0, round(score, 1))))

    def calculate_engagement_quality_score(self, social_data):
        """Calculate Engagement Quality Score (30% weight) adjusted for follower size."""
        ig_followers = social_data.get("instagram", {}).get("followers", 1000000) or 1000000
        ig_eng = social_data.get("instagram", {}).get("engagement_rate", 2.0) or 2.0
        tt_viral = social_data.get("tiktok", {}).get("viral_frequency", 0.1) or 0.1
        
        # Follower-size adjusted baseline:
        # Mega-stars (50M+ followers): 2.0% is world-class (100 pts), 1.0% is standard (75 pts)
        # Macro-stars (10M-50M): 3.0% is world-class (100 pts), 1.5% is standard (75 pts)
        # Mid-tier (1M-10M): 4.5% is world-class (100 pts), 2.0% is standard (70 pts)
        # Rising (<1M): 6.0% is world-class (100 pts), 3.0% is standard (70 pts)
        if ig_followers >= 50000000:
            base_target = 2.0
        elif ig_followers >= 10000000:
            base_target = 3.0
        elif ig_followers >= 1000000:
            base_target = 4.5
        else:
            base_target = 6.0
            
        ig_score = (ig_eng / base_target) * 90.0
        # Add a baseline of 10
        ig_score = 10.0 + ig_score
        
        # Add a bonus for TikTok virality if available (viral_frequency ranges 0.0 to 0.40)
        # Capping viral frequency target at 0.25 for 100 points
        tt_score = 10.0 + (tt_viral / 0.25) * 90.0
        
        if tt_viral > 0 and social_data.get("tiktok", {}).get("followers", 0) > 0:
            score = (ig_score * 0.7) + (tt_score * 0.3)
        else:
            score = ig_score

        return float(max(10.0, min(100.0, round(score, 1))))

    def calculate_search_trend_score(self, trends_data):
        """Calculate Search Trend Score (20% weight) directly from Google Trends score & trajectory."""
        base_score = trends_data.get("score", 50)
        trajectory = trends_data.get("trajectory", "stable")
        
        modifier = 0
        if trajectory == "rising":
            modifier = 8
        elif trajectory == "declining":
            modifier = -8
            
        score = base_score + modifier
        return float(max(10.0, min(100.0, round(score, 1))))

    def calculate_sponsorship_strength_score(self, sponsorships):
        """Calculate Sponsorship Strength Score (15% weight) based on quantity and estimate value of deals."""
        if not sponsorships:
            return 10.0
            
        num_deals = len(sponsorships)
        total_value = sum(deal.get("deal_value_estimate_m", 0.0) or 0.0 for deal in sponsorships)
        
        # 5 deals -> 50 points base
        # $10M total value -> +20 points
        base_points = num_deals * 10
        value_points = total_value * 2.0
        
        score = base_points + value_points
        return float(max(10.0, min(100.0, round(score, 1))))

    def calculate_market_value_score(self, market_value_m):
        """Calculate Athletic Market Value Score (10% weight) normalized between 0-100."""
        if not market_value_m or market_value_m <= 0:
            return 45.0 # Default baseline for top athletes
            
        # 180M -> 100 points
        # 20M -> ~35 points
        score = 25.0 + (market_value_m * 0.45)
        return float(max(10.0, min(100.0, round(score, 1))))

    def compute_brand_power_score(self, athlete_name, sport, social_data, trends_data, sponsorships, market_value_m):
        """Compute the final Brand Power Score (0-100) using the weighted formula."""
        reach_score = self.calculate_social_reach_score(social_data)
        eng_score = self.calculate_engagement_quality_score(social_data)
        trend_score = self.calculate_search_trend_score(trends_data)
        sponsor_score = self.calculate_sponsorship_strength_score(sponsorships)
        market_val_score = self.calculate_market_value_score(market_value_m)

        final_score = (
            (reach_score * 0.25) +
            (eng_score * 0.30) +
            (trend_score * 0.20) +
            (sponsor_score * 0.15) +
            (market_val_score * 0.10)
        )

        final_score = float(max(10.0, min(100.0, round(final_score, 1))))

        # Determine Tier
        if final_score >= 90.0:
            tier = "Global Icon"
        elif final_score >= 80.0:
            tier = "Elite Influencer"
        elif final_score >= 70.0:
            tier = "Major Star"
        else:
            tier = "Rising Talent"

        return {
            "overall_score": final_score,
            "tier": tier,
            "sub_scores": {
                "social_reach": reach_score,
                "engagement_quality": eng_score,
                "search_trend": trend_score,
                "sponsorship_strength": sponsor_score,
                "athletic_market_value": market_val_score
            }
        }

if __name__ == "__main__":
    calc = ScoreCalculator()
    social = {
        "instagram": {"followers": 110000000, "engagement_rate": 3.2, "post_frequency_per_week": 2.5},
        "tiktok": {"followers": 45000000, "avg_views_millions": 8.2, "viral_frequency": 0.22},
        "youtube": {"subscribers": 12000000, "avg_views_millions": 4.1},
        "facebook": {"followers": 28000000}
    }
    trends = {"score": 94, "trajectory": "rising"}
    sponsorships = [
        {"brand": "Nike", "deal_value_estimate_m": 20.0},
        {"brand": "Hublot", "deal_value_estimate_m": 5.0},
        {"brand": "EA Sports", "deal_value_estimate_m": 3.0},
        {"brand": "Dior", "deal_value_estimate_m": 4.0},
        {"brand": "Oakley", "deal_value_estimate_m": 2.0}
    ]
    val = 180.0
    
    score = calc.compute_brand_power_score("Kylian Mbappé", "Soccer", social, trends, sponsorships, val)
    import json
    print(json.dumps(score, indent=2))
