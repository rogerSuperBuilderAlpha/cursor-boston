import math

class ScoreCalculator:
    def __init__(self):
        # Deterministic scoring constants (no network / LLM calls).
        self.WEIGHTS = {
            "social_reach": 0.25,
            "engagement_quality": 0.30,
            "search_trend": 0.20,
            "sponsorship_strength": 0.15,
            "athletic_market_value": 0.10,
        }
        # Penalize missing components explicitly to avoid over-scoring sparse profiles.
        # Example: missing 2 components => multiplier = 1 - 2*0.08 = 0.84
        self.MISSING_COMPONENT_PENALTY_PER_COMPONENT = 0.08
        self.MIN_MISSING_MULTIPLIER = 0.60

    def _to_float_or_none(self, value):
        if value is None:
            return None
        try:
            f = float(value)
        except (TypeError, ValueError):
            return None
        if not math.isfinite(f):
            return None
        return f

    def _clamp_0_100(self, value):
        f = self._to_float_or_none(value)
        if f is None:
            return None
        return float(max(0.0, min(100.0, f)))

    def calculate_social_reach_score(self, social_data):
        """Calculate Social Reach Score (25% weight) based on total cross-platform followers."""
        if not isinstance(social_data, dict) or not social_data:
            return None

        ig = social_data.get("instagram", {}).get("followers")
        fb = social_data.get("facebook", {}).get("followers")
        tt = social_data.get("tiktok", {}).get("followers")
        yt = social_data.get("youtube", {}).get("subscribers")

        ig = self._to_float_or_none(ig) or 0.0
        fb = self._to_float_or_none(fb) or 0.0
        tt = self._to_float_or_none(tt) or 0.0
        yt = self._to_float_or_none(yt) or 0.0

        total_followers = ig + fb + tt + yt
        if total_followers <= 0:
            return None

        # Normalization using a logarithmic scale
        # 100k followers -> log10(100,000) = 5 -> ~10 points
        # 10M followers -> log10(10,000,000) = 7 -> ~60 points
        # 500M+ followers -> log10(500,000,000) = 8.7 -> 100 points
        log_followers = math.log10(total_followers)
        score = 10.0 + (log_followers - 5.0) * (90.0 / 3.7)
        return self._clamp_0_100(round(score, 1))

    def calculate_engagement_quality_score(self, social_data):
        """Calculate Engagement Quality Score (30% weight) adjusted for follower size."""
        if not isinstance(social_data, dict) or not social_data:
            return None

        ig_followers = self._to_float_or_none(social_data.get("instagram", {}).get("followers"))
        ig_eng = self._to_float_or_none(social_data.get("instagram", {}).get("engagement_rate"))
        tt_viral = self._to_float_or_none(social_data.get("tiktok", {}).get("viral_frequency"))

        # If we can't compute at least IG engagement, treat as missing rather than defaulting.
        if ig_eng is None:
            return None
        if ig_followers is None:
            ig_followers = 0.0
        
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
        if tt_viral is not None:
            tt_score = 10.0 + (tt_viral / 0.25) * 90.0
        else:
            tt_score = None

        tt_followers = self._to_float_or_none(social_data.get("tiktok", {}).get("followers")) or 0.0
        if tt_score is not None and tt_viral is not None and tt_viral > 0 and tt_followers > 0:
            score = (ig_score * 0.7) + (tt_score * 0.3)
        else:
            score = ig_score

        return self._clamp_0_100(round(score, 1))

    def calculate_search_trend_score(self, trends_data):
        """Calculate Search Trend Score (20% weight) directly from Google Trends score & trajectory."""
        if not isinstance(trends_data, dict) or not trends_data:
            return None

        base_score = self._to_float_or_none(trends_data.get("score"))
        trajectory = trends_data.get("trajectory") or "stable"
        if base_score is None:
            return None
        
        modifier = 0
        if trajectory == "rising":
            modifier = 8
        elif trajectory == "declining":
            modifier = -8
            
        score = base_score + modifier
        return self._clamp_0_100(round(score, 1))

    def calculate_sponsorship_strength_score(self, sponsorships):
        """Calculate Sponsorship Strength Score (15% weight) based on quantity and estimate value of deals."""
        if not sponsorships:
            return None
            
        num_deals = len(sponsorships)
        total_value = sum(deal.get("deal_value_estimate_m", 0.0) or 0.0 for deal in sponsorships)
        
        # 5 deals -> 50 points base
        # $10M total value -> +20 points
        base_points = num_deals * 10
        value_points = total_value * 2.0
        
        score = base_points + value_points
        return self._clamp_0_100(round(score, 1))

    def calculate_market_value_score(self, market_value_m):
        """Calculate Athletic Market Value Score (10% weight) normalized between 0-100."""
        mv = self._to_float_or_none(market_value_m)
        if mv is None or mv <= 0:
            return None
            
        # 180M -> 100 points
        # 20M -> ~35 points
        score = 25.0 + (mv * 0.45)
        return self._clamp_0_100(round(score, 1))

    def compute_brand_power_score(self, athlete_name, sport, social_data, trends_data, sponsorships, market_value_m):
        """Compute deterministic Brand Power Score (0–100) with explicit missing-data penalties."""
        reach_score = self.calculate_social_reach_score(social_data)
        eng_score = self.calculate_engagement_quality_score(social_data)
        trend_score = self.calculate_search_trend_score(trends_data)
        sponsor_score = self.calculate_sponsorship_strength_score(sponsorships)
        market_val_score = self.calculate_market_value_score(market_value_m)

        components = {
            "social_reach": reach_score,
            "engagement_quality": eng_score,
            "search_trend": trend_score,
            "sponsorship_strength": sponsor_score,
            "athletic_market_value": market_val_score,
        }

        missing_components = sorted([k for k, v in components.items() if v is None])
        missing_count = len(missing_components)

        weighted_sum = 0.0
        for key, weight in self.WEIGHTS.items():
            val = components.get(key)
            weighted_sum += weight * (val if val is not None else 0.0)

        penalty_multiplier = 1.0 - (missing_count * self.MISSING_COMPONENT_PENALTY_PER_COMPONENT)
        penalty_multiplier = max(self.MIN_MISSING_MULTIPLIER, penalty_multiplier)

        final_score = weighted_sum * penalty_multiplier

        final_score = float(max(0.0, min(100.0, round(final_score, 1))))

        # Deterministic tier mapping (code + label) based purely on final_score.
        if final_score >= 85.0:
            tier_code = "A"
            tier_label = "Global Icon"
        elif final_score >= 70.0:
            tier_code = "B"
            tier_label = "Elite Influencer"
        elif final_score >= 55.0:
            tier_code = "C"
            tier_label = "Major Star"
        else:
            tier_code = "D"
            tier_label = "Rising Talent"

        return {
            "overall_score": final_score,
            # Keep existing field name for downstream DB/schema compatibility.
            "tier": tier_label,
            "tier_code": tier_code,
            "sub_scores": {
                "social_reach": reach_score,
                "engagement_quality": eng_score,
                "search_trend": trend_score,
                "sponsorship_strength": sponsor_score,
                "athletic_market_value": market_val_score
            },
            "missing_components": missing_components,
            "missing_component_penalty_multiplier": round(penalty_multiplier, 3),
            "weights": dict(self.WEIGHTS),
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
