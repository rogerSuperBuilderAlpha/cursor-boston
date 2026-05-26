import hashlib
from typing import Any, Dict, Iterable, List, Optional, Tuple

class SponsorshipScraper:
    def __init__(self):
        # Realistic sponsorship portfolios for top stars
        self.top_stars_sponsorships = {
            "Kylian Mbappé": [
                {"brand": "Nike", "category": "Apparel", "deal_value_estimate_m": 20.0, "status": "Current"},
                {"brand": "Hublot", "category": "Luxury", "deal_value_estimate_m": 5.0, "status": "Current"},
                {"brand": "EA Sports", "category": "Gaming", "deal_value_estimate_m": 3.0, "status": "Current"},
                {"brand": "Dior", "category": "Luxury", "deal_value_estimate_m": 4.0, "status": "Current"},
                {"brand": "Oakley", "category": "Luxury", "deal_value_estimate_m": 2.0, "status": "Current"}
            ],
            "Lionel Messi": [
                {"brand": "Adidas", "category": "Apparel", "deal_value_estimate_m": 25.0, "status": "Current"},
                {"brand": "Pepsi", "category": "Food and Beverage", "deal_value_estimate_m": 6.0, "status": "Current"},
                {"brand": "Apple", "category": "Technology", "deal_value_estimate_m": 12.0, "status": "Current"},
                {"brand": "Mastercard", "category": "Finance", "deal_value_estimate_m": 4.0, "status": "Current"},
                {"brand": "Budweiser", "category": "Food and Beverage", "deal_value_estimate_m": 3.0, "status": "Current"},
                {"brand": "Hard Rock Cafe", "category": "Luxury", "deal_value_estimate_m": 2.0, "status": "Current"}
            ],
            "Cristiano Ronaldo": [
                {"brand": "Nike", "category": "Apparel", "deal_value_estimate_m": 30.0, "status": "Current"},
                {"brand": "Binance", "category": "Finance", "deal_value_estimate_m": 10.0, "status": "Current"},
                {"brand": "Herbalife", "category": "Food and Beverage", "deal_value_estimate_m": 4.0, "status": "Current"},
                {"brand": "Clear Haircare", "category": "Luxury", "deal_value_estimate_m": 2.5, "status": "Current"},
                {"brand": "Tag Heuer", "category": "Luxury", "deal_value_estimate_m": 3.0, "status": "Current"}
            ],
            "LeBron James": [
                {"brand": "Nike", "category": "Apparel", "deal_value_estimate_m": 32.0, "status": "Current"},
                {"brand": "PepsiCo (Gatorade)", "category": "Food and Beverage", "deal_value_estimate_m": 8.0, "status": "Current"},
                {"brand": "AT&T", "category": "Technology", "deal_value_estimate_m": 5.0, "status": "Current"},
                {"brand": "Beats by Dre", "category": "Technology", "deal_value_estimate_m": 4.0, "status": "Current"},
                {"brand": "Audemars Piguet", "category": "Luxury", "deal_value_estimate_m": 3.5, "status": "Current"}
            ],
            "Stephen Curry": [
                {"brand": "Under Armour", "category": "Apparel", "deal_value_estimate_m": 21.0, "status": "Current"},
                {"brand": "Chase", "category": "Finance", "deal_value_estimate_m": 4.5, "status": "Current"},
                {"brand": "Callaway", "category": "Luxury", "deal_value_estimate_m": 1.5, "status": "Current"},
                {"brand": "Subway", "category": "Food and Beverage", "deal_value_estimate_m": 2.0, "status": "Current"}
            ],
            "Virat Kohli": [
                {"brand": "Puma", "category": "Apparel", "deal_value_estimate_m": 15.0, "status": "Current"},
                {"brand": "MRF Tyres", "category": "Automotive", "deal_value_estimate_m": 4.0, "status": "Current"},
                {"brand": "Audi", "category": "Automotive", "deal_value_estimate_m": 1.5, "status": "Current"},
                {"brand": "Manyavar", "category": "Luxury", "deal_value_estimate_m": 2.0, "status": "Current"},
                {"brand": "Tissot", "category": "Luxury", "deal_value_estimate_m": 1.2, "status": "Current"},
                {"brand": "Herbalife", "category": "Food and Beverage", "deal_value_estimate_m": 2.2, "status": "Current"}
            ],
            "Lewis Hamilton": [
                {"brand": "Tommy Hilfiger", "category": "Apparel", "deal_value_estimate_m": 8.0, "status": "Current"},
                {"brand": "Monster Energy", "category": "Food and Beverage", "deal_value_estimate_m": 4.0, "status": "Current"},
                {"brand": "IWC Schaffhausen", "category": "Luxury", "deal_value_estimate_m": 3.5, "status": "Current"},
                {"brand": "Puma", "category": "Apparel", "deal_value_estimate_m": 2.5, "status": "Current"},
                {"brand": "Bose", "category": "Technology", "deal_value_estimate_m": 1.8, "status": "Current"}
            ],
            "Max Verstappen": [
                {"brand": "Red Bull", "category": "Food and Beverage", "deal_value_estimate_m": 10.0, "status": "Current"},
                {"brand": "EA Sports", "category": "Gaming", "deal_value_estimate_m": 2.5, "status": "Current"},
                {"brand": "Heineken 0.0", "category": "Food and Beverage", "deal_value_estimate_m": 4.0, "status": "Current"},
                {"brand": "CarNext", "category": "Automotive", "deal_value_estimate_m": 1.2, "status": "Current"}
            ],
            "Novak Djokovic": [
                {"brand": "Lacoste", "category": "Apparel", "deal_value_estimate_m": 10.0, "status": "Current"},
                {"brand": "Asics", "category": "Apparel", "deal_value_estimate_m": 4.0, "status": "Current"},
                {"brand": "Head", "category": "Apparel", "deal_value_estimate_m": 2.5, "status": "Current"},
                {"brand": "Hublot", "category": "Luxury", "deal_value_estimate_m": 3.5, "status": "Current"},
                {"brand": "Peugeot", "category": "Automotive", "deal_value_estimate_m": 2.0, "status": "Past"}
            ],
            "Rafael Nadal": [
                {"brand": "Nike", "category": "Apparel", "deal_value_estimate_m": 10.0, "status": "Current"},
                {"brand": "Babolat", "category": "Apparel", "deal_value_estimate_m": 3.0, "status": "Current"},
                {"brand": "Richard Mille", "category": "Luxury", "deal_value_estimate_m": 4.0, "status": "Current"},
                {"brand": "Kia Motors", "category": "Automotive", "deal_value_estimate_m": 2.5, "status": "Current"},
                {"brand": "Amstel Light", "category": "Food and Beverage", "deal_value_estimate_m": 1.5, "status": "Current"}
            ],
            "Carlos Alcaraz": [
                {"brand": "Nike", "category": "Apparel", "deal_value_estimate_m": 8.0, "status": "Current"},
                {"brand": "Babolat", "category": "Apparel", "deal_value_estimate_m": 2.0, "status": "Current"},
                {"brand": "Rolex", "category": "Luxury", "deal_value_estimate_m": 3.0, "status": "Current"},
                {"brand": "BMW", "category": "Automotive", "deal_value_estimate_m": 1.5, "status": "Current"},
                {"brand": "Calvin Klein", "category": "Apparel", "deal_value_estimate_m": 1.0, "status": "Current"}
            ],
            "Patrick Mahomes": [
                {"brand": "Adidas", "category": "Apparel", "deal_value_estimate_m": 7.0, "status": "Current"},
                {"brand": "Oakley", "category": "Luxury", "deal_value_estimate_m": 1.8, "status": "Current"},
                {"brand": "State Farm", "category": "Finance", "deal_value_estimate_m": 3.5, "status": "Current"},
                {"brand": "Subway", "category": "Food and Beverage", "deal_value_estimate_m": 1.5, "status": "Current"},
                {"brand": "Boss", "category": "Apparel", "deal_value_estimate_m": 2.0, "status": "Current"}
            ],
            "Travis Kelce": [
                {"brand": "Nike", "category": "Apparel", "deal_value_estimate_m": 4.0, "status": "Current"},
                {"brand": "State Farm", "category": "Finance", "deal_value_estimate_m": 2.5, "status": "Current"},
                {"brand": "Pfizer", "category": "Technology", "deal_value_estimate_m": 3.0, "status": "Current"},
                {"brand": "Campbell's Soup", "category": "Food and Beverage", "deal_value_estimate_m": 1.0, "status": "Current"},
                {"brand": "Bud Light", "category": "Food and Beverage", "deal_value_estimate_m": 2.0, "status": "Current"}
            ]
        }

        # Library of brands by category for simulation
        self.brand_pool = {
            "Apparel": [
                {"brand": "Nike", "value_range": (1.0, 6.0)},
                {"brand": "Adidas", "value_range": (0.8, 5.0)},
                {"brand": "Puma", "value_range": (0.5, 3.5)},
                {"brand": "Under Armour", "value_range": (0.6, 4.0)},
                {"brand": "New Balance", "value_range": (0.4, 2.5)},
                {"brand": "Oakley", "value_range": (0.3, 1.5)}
            ],
            "Food and Beverage": [
                {"brand": "Pepsi", "value_range": (0.5, 3.0)},
                {"brand": "Coca-Cola", "value_range": (0.5, 3.0)},
                {"brand": "Gatorade", "value_range": (0.4, 2.5)},
                {"brand": "Red Bull", "value_range": (0.6, 4.0)},
                {"brand": "Monster Energy", "value_range": (0.4, 2.0)},
                {"brand": "Bud Light", "value_range": (0.3, 1.8)},
                {"brand": "Heineken", "value_range": (0.4, 2.2)}
            ],
            "Technology": [
                {"brand": "Apple", "value_range": (1.0, 5.0)},
                {"brand": "Samsung", "value_range": (0.8, 4.0)},
                {"brand": "Beats by Dre", "value_range": (0.4, 2.0)},
                {"brand": "Sony PlayStation", "value_range": (0.5, 2.5)},
                {"brand": "Bose", "value_range": (0.3, 1.5)}
            ],
            "Finance": [
                {"brand": "Visa", "value_range": (0.8, 4.0)},
                {"brand": "Mastercard", "value_range": (0.8, 4.0)},
                {"brand": "Chase", "value_range": (0.5, 3.0)},
                {"brand": "State Farm", "value_range": (0.5, 2.5)},
                {"brand": "Crypto.com", "value_range": (0.6, 3.5)},
                {"brand": "Binance", "value_range": (0.8, 5.0)}
            ],
            "Automotive": [
                {"brand": "Audi", "value_range": (0.5, 2.5)},
                {"brand": "BMW", "value_range": (0.6, 3.0)},
                {"brand": "Mercedes-Benz", "value_range": (0.8, 4.0)},
                {"brand": "Porsche", "value_range": (0.8, 4.0)},
                {"brand": "Ford", "value_range": (0.4, 2.0)},
                {"brand": "Toyota", "value_range": (0.4, 2.0)}
            ],
            "Luxury": [
                {"brand": "Rolex", "value_range": (1.0, 5.0)},
                {"brand": "Hublot", "value_range": (0.8, 4.0)},
                {"brand": "Richard Mille", "value_range": (1.2, 6.0)},
                {"brand": "TAG Heuer", "value_range": (0.6, 3.0)},
                {"brand": "Dior", "value_range": (0.8, 4.5)},
                {"brand": "Louis Vuitton", "value_range": (1.0, 5.0)}
            ],
            "Gaming": [
                {"brand": "EA Sports", "value_range": (0.5, 2.5)},
                {"brand": "Nintendo", "value_range": (0.4, 2.0)},
                {"brand": "Xbox", "value_range": (0.5, 2.2)},
                {"brand": "Mobile Legends", "value_range": (0.3, 1.2)}
            ]
        }

    def _get_seeded_value(self, name, key, min_val, max_val, decimals=0):
        h = hashlib.md5(f"{name}:{key}".encode()).hexdigest()
        val_hash = int(h, 16)
        normalized = val_hash / (16**32)
        val = min_val + normalized * (max_val - min_val)
        if decimals == 0:
            return int(val)
        return round(val, decimals)

    def _canonicalize_brand(self, brand: Any) -> Optional[str]:
        if not isinstance(brand, str):
            return None
        b = " ".join(brand.split()).strip()
        return b or None

    def _canonicalize_category(self, category: Any) -> str:
        if not isinstance(category, str):
            return "Unknown"
        c = " ".join(category.split()).strip()
        return c or "Unknown"

    def _canonicalize_status(self, status: Any) -> str:
        if not isinstance(status, str):
            return "Unknown"
        s = " ".join(status.split()).strip().lower()
        if s in {"current", "active", "ongoing"}:
            return "Current"
        if s in {"past", "former", "expired", "ended"}:
            return "Past"
        return "Unknown"

    def _coerce_value_m(self, value: Any) -> Optional[float]:
        if value is None:
            return None
        if isinstance(value, (int, float)):
            v = float(value)
            if v != v:  # NaN
                return None
            if v < 0:
                return None
            return v
        if isinstance(value, str):
            s = value.strip().lower().replace("$", "").replace(",", "")
            if not s:
                return None
            # very small parser for things like "2.5m", "2.5", "2.5 million"
            mult = 1.0
            if s.endswith("m"):
                mult = 1.0
                s = s[:-1].strip()
            elif "million" in s:
                mult = 1.0
                s = s.replace("million", "").strip()
            try:
                v = float(s) * mult
                if v < 0:
                    return None
                return v
            except Exception:
                return None
        return None

    def normalize_deals(self, raw_deals: Any) -> List[Dict[str, Any]]:
        """
        Normalize sponsorship deals into a stable shape:
          {brand, category, deal_value_estimate_m, status}
        Accepts raw lists from local scrape output or previously cached JSON.
        """
        if not isinstance(raw_deals, list):
            return []

        normalized: List[Dict[str, Any]] = []
        for item in raw_deals:
            if not isinstance(item, dict):
                continue

            brand = self._canonicalize_brand(item.get("brand") or item.get("sponsor") or item.get("name"))
            if not brand:
                continue

            category = self._canonicalize_category(item.get("category") or item.get("industry"))
            status = self._canonicalize_status(item.get("status") or item.get("deal_status"))
            value_m = self._coerce_value_m(
                item.get("deal_value_estimate_m")
                or item.get("value_estimate_m")
                or item.get("deal_value_m")
                or item.get("deal_value")
            )

            normalized.append(
                {
                    "brand": brand,
                    "category": category,
                    "deal_value_estimate_m": value_m,
                    "status": status,
                }
            )

        # Deduplicate (brand, category, status) keeping max value if available
        by_key: Dict[Tuple[str, str, str], Dict[str, Any]] = {}
        for d in normalized:
            k = (d["brand"].lower(), d["category"].lower(), d["status"])
            prev = by_key.get(k)
            if not prev:
                by_key[k] = d
                continue
            pv = prev.get("deal_value_estimate_m")
            nv = d.get("deal_value_estimate_m")
            if pv is None and nv is not None:
                by_key[k] = d
            elif pv is not None and nv is not None and nv > pv:
                by_key[k] = d

        return list(by_key.values())

    def extract_sponsorships(self, athlete_name: str, sport: str, local_profile: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Stage-5 style extraction:
        - Prefer sponsorship info already present in local scrape output/cached profile (allowlisted local source).
        - Fall back to deterministic simulated portfolio generation.
        Returns a dict with deals + a computed strength score.
        """
        source = "simulated"
        raw_deals: Any = None
        if isinstance(local_profile, dict):
            # accept multiple possible shapes
            raw_deals = (
                local_profile.get("sponsorships")
                or local_profile.get("sponsors")
                or local_profile.get("endorsements")
                or (local_profile.get("sponsorship", {}) or {}).get("deals")
            )
            if isinstance(raw_deals, list) and len(raw_deals) > 0:
                source = "local_profile"

        deals = self.normalize_deals(raw_deals) if source == "local_profile" else self.normalize_deals(self.scrape_sponsorships(athlete_name, sport))

        strength = self.compute_sponsorship_strength_0_100(deals)
        categories = sorted({d.get("category", "Unknown") for d in deals if isinstance(d.get("category"), str)})
        unique_brands = sorted({d.get("brand") for d in deals if isinstance(d.get("brand"), str)})

        confidence = "low"
        if len(unique_brands) >= 4:
            confidence = "high"
        elif len(unique_brands) >= 2:
            confidence = "medium"

        return {
            "deals": deals,
            "sponsorship_strength_0_100": strength,
            "unique_sponsor_count": len(unique_brands),
            "categories": categories,
            "source": source,
            "confidence": confidence,
        }

    def compute_sponsorship_strength_0_100(self, deals: Iterable[Dict[str, Any]]) -> float:
        """
        Deterministic 0–100 score based on:
        - quantity of current deals (signal of marketability)
        - total estimated deal value (if available)
        - portfolio diversity + premium-category bonus
        """
        deals_list = [d for d in deals if isinstance(d, dict)]
        if not deals_list:
            return 0.0

        current = [d for d in deals_list if (d.get("status") or "Unknown") == "Current"]
        num_deals = len(current) if current else len(deals_list)

        total_value = 0.0
        any_value = False
        for d in deals_list:
            v = d.get("deal_value_estimate_m")
            if isinstance(v, (int, float)) and v == v and v >= 0:
                total_value += float(v)
                any_value = True

        # Quantity: saturate around 6 current deals -> 40 pts
        qty_score = min(1.0, num_deals / 6.0) * 40.0

        # Value: saturate around $25M total -> 40 pts. If values are missing, don't award value points.
        val_score = (min(1.0, total_value / 25.0) * 40.0) if any_value else 0.0

        categories = {str(d.get("category") or "Unknown").strip().lower() for d in deals_list}
        categories.discard("")
        if not categories:
            categories = {"unknown"}

        # Diversity + premium categories: up to 20 pts
        diversity_score = min(1.0, len(categories) / 5.0) * 10.0
        premium_cats = {"luxury", "technology", "finance", "automotive"}
        premium_bonus = min(10.0, 2.5 * len(categories.intersection(premium_cats)))
        div_score = diversity_score + premium_bonus

        score = qty_score + val_score + div_score
        score = max(0.0, min(100.0, round(score, 1)))
        return float(score)

    def scrape_sponsorships(self, athlete_name, sport):
        """Scrape or generate sponsorship portfolio for an athlete."""
        if athlete_name in self.top_stars_sponsorships:
            return self.top_stars_sponsorships[athlete_name]

        # Generate portfolio
        # Number of deals: 3 to 6 deals based on seeded hash
        num_deals = self._get_seeded_value(athlete_name, "num_deals", 3, 6)
        portfolio = []
        
        # Ensure every athlete has an apparel deal (e.g. Nike, Adidas, Puma)
        apparel_brand_list = self.brand_pool["Apparel"]
        apparel_index = self._get_seeded_value(athlete_name, "apparel_brand", 0, len(apparel_brand_list) - 1)
        selected_apparel = apparel_brand_list[apparel_index]
        apparel_val = self._get_seeded_value(
            athlete_name, "apparel_val", selected_apparel["value_range"][0], selected_apparel["value_range"][1], 1
        )
        
        portfolio.append({
            "brand": selected_apparel["brand"],
            "category": "Apparel",
            "deal_value_estimate_m": apparel_val,
            "status": "Current"
        })

        # Add other categories deterministically
        categories = list(self.brand_pool.keys())
        categories.remove("Apparel") # Apparel is already added

        used_brands = {selected_apparel["brand"]}
        
        for i in range(num_deals - 1):
            cat_index = self._get_seeded_value(athlete_name, f"cat_select_{i}", 0, len(categories) - 1)
            category = categories[cat_index]
            
            brands = self.brand_pool[category]
            brand_index = self._get_seeded_value(athlete_name, f"brand_select_{i}", 0, len(brands) - 1)
            brand_item = brands[brand_index]
            
            if brand_item["brand"] not in used_brands:
                val = self._get_seeded_value(
                    athlete_name, f"val_select_{i}", brand_item["value_range"][0], brand_item["value_range"][1], 1
                )
                
                # Formula 1 drivers are more likely to have Luxury and Automotive deals
                # Cricket players have high local value
                if sport == "Formula 1" and category in ["Luxury", "Automotive"]:
                    val = round(val * 1.5, 1)
                elif sport == "Soccer":
                    val = round(val * 1.3, 1)
                
                portfolio.append({
                    "brand": brand_item["brand"],
                    "category": category,
                    "deal_value_estimate_m": val,
                    "status": "Current"
                })
                used_brands.add(brand_item["brand"])

        return portfolio

if __name__ == "__main__":
    scraper = SponsorshipScraper()
    print("Sponsorships for Lionel Messi:")
    import json
    print(json.dumps(scraper.scrape_sponsorships("Lionel Messi", "Soccer"), indent=2))
    print("\nSponsorships for Jayson Tatum:")
    print(json.dumps(scraper.scrape_sponsorships("Jayson Tatum", "Basketball"), indent=2))
