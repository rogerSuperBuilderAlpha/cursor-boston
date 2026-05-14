# /// script
# requires-python = ">=3.11"
# dependencies = [
#   "marimo>=0.23.0",
#   "pandas>=2.0.0",
#   "plotly>=5.18.0",
#   "folium>=0.15.0",
#   "requests>=2.31.0",
#   "anthropic>=0.40.0",
#   "scikit-learn>=1.3.0",
#   "numpy>=1.24.0",
# ]
# ///

import marimo

__generated_with = "0.23.6"
app = marimo.App(width="full")

@app.cell
def __():
    import marimo as mo
    return (mo,)


@app.cell
def __(mo):
    import io
    import json
    import math
    import os
    import re
    import time
    import uuid
    from collections import defaultdict
    from datetime import date, datetime, timedelta, timezone

    import folium
    import numpy as np
    import pandas as pd
    import plotly.express as px
    import plotly.graph_objects as go
    import requests
    from plotly.subplots import make_subplots
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.metrics.pairwise import cosine_similarity

    try:
        import anthropic
    except Exception:  # pragma: no cover
        anthropic = None

    try:
        from anthropic import APIStatusError as AnthropicAPIStatusError
    except Exception:  # pragma: no cover
        AnthropicAPIStatusError = Exception

    MBTA = "https://api-v3.mbta.com"
    BUSY_ROUTES = ["1", "28", "39", "57", "66", "71", "73", "77"]
    BOSTON = (42.3601, -71.0589)
    MEDIAN_WAGE = 25.0
    LANG_OPTIONS = {
        "English": "en",
        "Español (Spanish)": "es",
        "Português (Portuguese)": "pt",
        "中文 (Chinese)": "zh",
        "Kreyòl Ayisyen (Haitian Creole)": "ht",
        "Tiếng Việt (Vietnamese)": "vi",
        "العربية (Arabic)": "ar",
    }

    NEIGHBOR_STATS = {
        "Roxbury": {"income": 32000, "poc": 0.73, "no_car": 0.40},
        "Back Bay": {"income": 95000, "poc": 0.25, "no_car": 0.60},
        "Dorchester": {"income": 40000, "poc": 0.65, "no_car": 0.35},
        "Mattapan": {"income": 38000, "poc": 0.80, "no_car": 0.30},
    }

    RIDERSHIP = {
        "28": 12000,
        "1": 11000,
        "66": 10000,
        "39": 8500,
        "57": 7000,
        "71": 4000,
        "73": 3500,
        "77": 5000,
    }

    ROUTE_NEIGHBOR = {
        "28": ("Mattapan", "Dorchester"),
        "1": ("Back Bay", "Roxbury"),
        "66": ("Allston", "Harvard"),
        "39": ("Back Bay", "Jamaica Plain"),
        "57": ("Kenmore", "Watertown"),
        "71": ("Harvard", "Watertown"),
        "73": ("Harvard", "Waverley"),
        "77": ("Arlington", "Harvard"),
    }

    MOBILITY = {
        "Roxbury": {"bus": 4, "subway": 6, "car": 9},
        "Dorchester": {"bus": 5, "subway": 5, "car": 10},
        "Mattapan": {"bus": 3, "subway": 2, "car": 9},
        "East Boston": {"bus": 4, "subway": 3, "car": 10},
        "Allston": {"bus": 5, "subway": 5, "car": 10},
        "Jamaica Plain": {"bus": 5, "subway": 6, "car": 10},
        "South Boston": {"bus": 4, "subway": 4, "car": 9},
        "Back Bay": {"bus": 6, "subway": 8, "car": 10},
    }

    POLICY_CHUNKS = [
        {
            "source": "MBTA Service Plan (excerpt)",
            "section": "Bus frequency",
            "text": "Route 28 is targeted for frequent all-day service with 8-minute midday headways where feasible, with additional buses during peak periods to address crowding.",
        },
        {
            "source": "MBTA Capital Investment Plan (excerpt)",
            "section": "Bus modernization",
            "text": "The MBTA commits to bus priority corridors, all-door boarding pilots, and upgraded dispatch tools to reduce bunching and improve reliability on high-ridership routes.",
        },
        {
            "source": "MBTA Board Minutes (excerpt)",
            "section": "Reliability discussion",
            "text": "Board members discussed chronic bus bunching and missed trips on key corridors, directing staff to report monthly on ghost trips and real-time data coverage gaps.",
        },
        {
            "source": "MBTA Rider Bill of Rights (excerpt)",
            "section": "Information",
            "text": "Riders have a right to accurate, timely information about service, including real-time updates when available, and respectful treatment during service disruptions.",
        },
        {
            "source": "MBTA Title VI Program (excerpt)",
            "section": "Service equity",
            "text": "The MBTA must ensure the benefits and burdens of service decisions are equitably distributed across demographic groups, including low-income populations and minority communities.",
        },
    ]

    EN = {
        "title": "MBTA Transit Equity Dashboard",
        "subtitle": "Live data, neighborhood context, and advocacy tools for Boston bus riders.",
        "language": "Language",
        "refresh": "Refresh live data",
        "last_updated": "Last updated",
        "data_error": "Some MBTA data could not be loaded. The dashboard will show partial results.",
        "narrator_title": "AI live briefing",
        "regenerate_ai": "Regenerate insight",
        "no_api_key": "Set ANTHROPIC_API_KEY to enable Claude-powered narratives, chat, and policy auditing.",
        "where_bus": "Where is my bus?",
        "active_buses": "Active buses",
        "pct_late": "Running late",
        "filter_route": "Filter route",
        "all_routes": "All routes",
        "bus_vs_subway": "Bus vs subway digital inequality",
        "pred_chart": "Share of stops with live predictions (approx.)",
        "stat_bus_riders": "Buses carry a large share of riders but receive a smaller share of real-time digital updates.",
        "stat_subway_note": "Subway riders often have countdown infrastructure; many bus riders depend on phones and still see gaps.",
        "ghost_title": "Ghost bus detector",
        "ghost_help": "Scheduled trips in the next window vs active vehicles (heuristic; MBTA schedules are complex).",
        "pain_title": "Wait time pain index",
        "bunch_title": "Bus bunching analyzer",
        "signs_title": "Missing digital signs map",
        "freq_title": "Frequency vs demand mismatch",
        "mobility_title": "15-minute city mobility (illustrative)",
        "scorecard_title": "Transit equity scorecard",
        "late_title": "Late to work calculator",
        "collective_title": "Collective impact wall",
        "alerts_title": "Service alert intelligence",
        "tweet_title": "Tweet this",
        "story_title": "My MBTA story",
        "story_placeholder": "I used to get late to my internship every day because...",
        "letter_title": "Open letter to the MBTA Board",
        "download_letter": "Download letter (HTML for print/PDF)",
        "council_title": "Boston City Council contacts",
        "rag_title": "Promise vs reality (RAG + AI)",
        "anomaly_title": "AI anomaly report",
        "ask_title": "Ask the T",
        "ask_placeholder": "Ask the T anything...",
        "send": "Send",
        "smart_title": "Smart AI features",
        "forecast_title": "Predictive delay forecaster",
        "recommend_title": "Smart route recommender",
        "notes_title": "Board meeting talking points",
        "footer_sources": "Data sources",
        "copy": "Copy",
        "walk_faster": "You would get there faster on foot right now.",
        "grade": "Equity grade",
        "route": "Route",
        "stop": "Stop",
        "days_week": "Commute days / week",
        "weeks_year": "Weeks / year",
        "wage": "Hourly wage ($)",
        "alerts_only_en": "MBTA publishes most rider alerts in English first. In a multilingual city, that is a communications equity gap.",
        "elevator": "Elevator / escalator outages (heuristic categorization)",
        "session_waste": "Since you opened this dashboard, estimated collective waiting time accrued",
        "langgraph_note": "Optional LangGraph multi-step workflow: install langgraph to experiment with router→fetch→compose graphs; this notebook uses a direct tool loop for chat.",
        "mcp_note": "Optional MCP server: run python mbta_mcp_server.py from this repo for MBTA tools over MCP.",
    }

    def merge_lang(patch: dict) -> dict:
        return {**EN, **patch}

    TRANSLATIONS = {
        "en": EN,
        "es": merge_lang(
            {
                "title": "Panel de equidad del transporte MBTA",
                "subtitle": "Datos en vivo, contexto vecinal y herramientas de incidencia.",
                "language": "Idioma",
                "refresh": "Actualizar datos en vivo",
                "last_updated": "Última actualización",
                "where_bus": "¿Dónde está mi autobús?",
                "ghost_title": "Detector de autobuses fantasma",
                "pain_title": "Índice de dolor de espera",
                "ask_title": "Pregunta a la T",
            }
        ),
        "pt": merge_lang(
            {
                "title": "Painel de equidade do transporte MBTA",
                "subtitle": "Dados ao vivo e ferramentas cívicas.",
                "language": "Idioma",
                "refresh": "Atualizar dados ao vivo",
                "last_updated": "Última atualização",
            }
        ),
        "zh": merge_lang(
            {
                "title": "MBTA 交通公平仪表板",
                "subtitle": "实时数据与社区倡导工具。",
                "language": "语言",
                "refresh": "刷新实时数据",
                "last_updated": "最后更新",
            }
        ),
        "ht": merge_lang(
            {
                "title": "Tablo ekite transpò MBTA",
                "subtitle": "Done an dirèk, kontèks katye, zouti advokasi.",
                "language": "Lang",
                "refresh": "Rafrechi done yo",
                "last_updated": "Dènye mizajou",
            }
        ),
        "vi": merge_lang(
            {
                "title": "Bảng công bằng giao thông MBTA",
                "subtitle": "Dữ liệu trực tiếp và công cụ vận động.",
                "language": "Ngôn ngữ",
                "refresh": "Làm mới dữ liệu",
                "last_updated": "Cập nhật lần cuối",
            }
        ),
        "ar": merge_lang(
            {
                "title": "لوحة عدالة النقل MBTA",
                "subtitle": "بيانات مباشرة وأدوات مواطنة لركاب الحافلات في بوسطن.",
                "language": "اللغة",
                "refresh": "تحديث البيانات المباشرة",
                "last_updated": "آخر تحديث",
            }
        ),
    }

    HISTORY: list[dict] = []

    def T(lang: str, key: str) -> str:
        return TRANSLATIONS.get(lang, TRANSLATIONS["en"]).get(key, EN.get(key, key))

    def haversine_miles(lat1, lon1, lat2, lon2) -> float:
        r = 3958.8
        p = math.pi / 180
        a = 0.5 - math.cos((lat2 - lat1) * p) / 2 + math.cos(lat1 * p) * math.cos(lat2 * p) * (1 - math.cos((lon2 - lon1) * p)) / 2
        return 2 * r * math.asin(math.sqrt(a))

    def boston_now() -> datetime:
        try:
            from zoneinfo import ZoneInfo

            return datetime.now(ZoneInfo("America/New_York"))
        except Exception:  # pragma: no cover
            return datetime.now()

    def mbta_get(session: requests.Session, path: str, params: dict | None = None) -> dict:
        r = session.get(f"{MBTA}{path}", params=params or {}, timeout=60)
        r.raise_for_status()
        return r.json()

    def mbta_collect(session: requests.Session, path: str, params: dict | None = None, page_limit: int = 500, max_pages: int = 40):
        rows = []
        included: list = []
        offset = 0
        pages = 0
        while pages < max_pages:
            p = dict(params or {})
            p["page[limit]"] = page_limit
            p["page[offset]"] = offset
            data = mbta_get(session, path, p)
            batch = data.get("data") or []
            included.extend(data.get("included") or [])
            rows.extend(batch)
            pages += 1
            if len(batch) < page_limit:
                break
            offset += page_limit
        return rows, included

    def included_index(included: list) -> dict:
        idx = {}
        for it in included:
            idx[(it.get("type"), it.get("id"))] = it
        return idx

    def rel_id(obj: dict, rel: str) -> str | None:
        try:
            data = (obj.get("relationships") or {}).get(rel, {}).get("data")
            if isinstance(data, dict):
                return data.get("id")
            if isinstance(data, list) and data:
                first = data[0]
                return first.get("id") if isinstance(first, dict) else None
            return None
        except Exception:
            return None

    def parse_dt(s: str | None) -> datetime | None:
        if not s:
            return None
        try:
            if s.endswith("Z"):
                s = s.replace("Z", "+00:00")
            return datetime.fromisoformat(s)
        except Exception:
            return None

    def load_mbta_data(refresh_btn):
        _touch = refresh_btn.value
        session = requests.Session()
        session.headers.update({"User-Agent": "pydata-hackathon-mbta-equity/1.0 (educational)"})
        errors: list[str] = []
        bundle = {
            "errors": errors,
            "fetched_at": datetime.now(timezone.utc),
            "vehicles_bus": [],
            "vehicles_rail": [],
            "predictions": [],
            "alerts": [],
            "routes": [],
            "stops_bus": [],
            "stops_all": [],
            "schedules": {},
            "included": {},
        }

        def safe(name: str, fn):
            try:
                return fn()
            except Exception as e:  # pragma: no cover
                errors.append(f"{name}: {e}")
                return None

        def grab_vehicles(rt: str):
            rows, inc = mbta_collect(
                session,
                "/vehicles",
                {"filter[route_type]": rt, "include": "route,trip"},
                page_limit=500,
                max_pages=5,
            )
            bundle["included"]["vehicles"] = bundle["included"].get("vehicles", []) + inc
            return rows

        bundle["vehicles_bus"] = safe("vehicles_bus", lambda: grab_vehicles("3")) or []
        bundle["vehicles_rail"] = safe(
            "vehicles_rail",
            lambda: (grab_vehicles("0") or []) + (grab_vehicles("1") or []),
        ) or []

        preds, pinc = safe(
            "predictions",
            lambda: mbta_collect(session, "/predictions", {"filter[route_type]": "3"}, page_limit=500, max_pages=8),
        ) or ([], [])
        bundle["predictions"] = preds
        bundle["included"]["predictions"] = pinc

        r0, i0 = safe("predictions_rail_0", lambda: mbta_collect(session, "/predictions", {"filter[route_type]": "0"}, page_limit=500, max_pages=8)) or ([], [])
        r1, i1 = safe("predictions_rail_1", lambda: mbta_collect(session, "/predictions", {"filter[route_type]": "1"}, page_limit=500, max_pages=8)) or ([], [])
        bundle["predictions_rail"] = (r0 or []) + (r1 or [])
        bundle["included"]["predictions_rail"] = (i0 or []) + (i1 or [])

        bundle["alerts"] = safe("alerts", lambda: mbta_get(session, "/alerts", {}).get("data") or []) or []

        bundle["routes"] = safe("routes", lambda: mbta_collect(session, "/routes", {}, page_limit=500, max_pages=2)[0]) or []

        bundle["stops_bus"] = safe(
            "stops_bus",
            lambda: mbta_collect(session, "/stops", {"filter[route_type]": "3"}, page_limit=500, max_pages=25)[0],
        ) or []

        bundle["stops_all"] = safe(
            "stops_all",
            lambda: mbta_collect(session, "/stops", {}, page_limit=500, max_pages=6)[0],
        ) or []

        svc_date = boston_now().date()
        mn = boston_now() - timedelta(minutes=10)
        mx = boston_now() + timedelta(minutes=35)

        def to_hhmm(dt: datetime) -> str:
            return dt.strftime("%H:%M")

        for rid in BUSY_ROUTES:
            safe(
                f"schedules_{rid}",
                lambda rid=rid: bundle["schedules"].__setitem__(
                    rid,
                    mbta_collect(
                        session,
                        "/schedules",
                        {
                            "filter[route]": rid,
                            "filter[date]": svc_date.isoformat(),
                            "filter[min_time]": to_hhmm(mn),
                            "filter[max_time]": to_hhmm(mx),
                        },
                        page_limit=500,
                        max_pages=5,
                    )[0],
                ),
            )

        # route -> list of stop ids (small sample for pain index)
        bundle["sample_stops"] = {}
        for rid in BUSY_ROUTES:
            stops, _ = safe(
                f"stops_route_{rid}",
                lambda rid=rid: mbta_collect(session, "/stops", {"filter[route]": rid}, page_limit=50, max_pages=1),
            ) or ([], [])
            ids = [s.get("id") for s in stops[:5] if s.get("id")]
            bundle["sample_stops"][rid] = ids[:3]

        preds_by_stop: dict[str, list] = defaultdict(list)
        for pr in bundle["predictions"]:
            sid = rel_id(pr, "stop")
            if sid:
                preds_by_stop[str(sid)].append(pr)
        bundle["preds_by_stop"] = dict(preds_by_stop)

        # vehicle delay map from predictions (seconds)
        delay_by_vehicle: dict[str, float] = {}
        for pr in bundle["predictions"]:
            vid = rel_id(pr, "vehicle")
            if not vid:
                continue
            attr = pr.get("attributes") or {}
            arr = parse_dt(attr.get("arrival_time") or attr.get("departure_time"))
            sch = parse_dt(attr.get("schedule_arrival_time") or attr.get("schedule_departure_time"))
            if arr and sch:
                delay_by_vehicle[str(vid)] = max(0.0, (arr - sch).total_seconds() / 60.0)
        bundle["delay_by_vehicle"] = delay_by_vehicle

        SUBWAY_LINES = ["Red", "Orange", "Blue", "Green-B", "Green-C", "Green-D", "Green-E"]
        bundle["subway_stop_counts"] = {}
        for line in SUBWAY_LINES:
            rows, _ = safe(
                f"stops_{line}",
                lambda line=line: mbta_collect(session, "/stops", {"filter[route]": line}, page_limit=500, max_pages=4)[0],
            ) or ([], [])
            bundle["subway_stop_counts"][line] = len(rows)

        bundle["session_t0"] = time.time()

        return bundle

    def compute_metrics(bundle: dict) -> dict:
        metrics: dict = {}
        vehicles_bus = bundle.get("vehicles_bus") or []
        delay_by_vehicle = bundle.get("delay_by_vehicle") or {}

        rows = []
        for v in vehicles_bus:
            rid = rel_id(v, "route")
            trip = rel_id(v, "trip")
            attr = v.get("attributes") or {}
            lat = attr.get("latitude")
            lon = attr.get("longitude")
            did = delay_by_vehicle.get(v.get("id"))
            if did is None:
                status = "unknown"
                color = "#9ca3af"
            elif did <= 2:
                status = "on_time"
                color = "#22c55e"
            elif did <= 5:
                status = "late_mid"
                color = "#eab308"
            else:
                status = "late_bad"
                color = "#ef4444"
            rows.append(
                {
                    "vehicle_id": v.get("id"),
                    "route_id": rid,
                    "trip_id": trip,
                    "lat": lat,
                    "lon": lon,
                    "delay_min": did,
                    "status": status,
                    "color": color,
                    "label": attr.get("label") or attr.get("status") or "",
                }
            )
        vdf = pd.DataFrame(rows)
        metrics["vehicles_df"] = vdf
        if len(vdf):
            known = vdf["delay_min"].notna()
            metrics["pct_late"] = float((vdf.loc[known, "delay_min"] > 2).mean()) if known.any() else 0.0
        else:
            metrics["pct_late"] = 0.0

        bus_stops_n = len(bundle.get("stops_bus") or [])
        preds = bundle.get("predictions") or []
        bus_stop_ids_pred = {sid for sid in (rel_id(p, "stop") for p in preds) if sid}
        metrics["bus_stop_pred_rate"] = len(bus_stop_ids_pred) / max(1, bus_stops_n)

        rp = bundle.get("predictions_rail") or []
        counts = bundle.get("subway_stop_counts") or {}
        subway_cov: dict[str, float] = {}
        for line, total in counts.items():
            sset: set[str] = set()
            for p in rp:
                if rel_id(p, "route") == line:
                    sid = rel_id(p, "stop")
                    if sid:
                        sset.add(sid)
            subway_cov[line] = len(sset) / max(1, total)
        metrics["subway_cov"] = subway_cov
        metrics["avg_subway_cov"] = float(np.mean(list(subway_cov.values()))) if subway_cov else 0.0
        metrics["bus_pct_stops_realtime"] = metrics["bus_stop_pred_rate"] * 100
        metrics["subway_pct_stops_realtime"] = metrics["avg_subway_cov"] * 100

        sched = bundle.get("schedules") or {}
        gh_rows: list[dict] = []
        for rid in BUSY_ROUTES:
            trips = sched.get(rid) or []
            trip_keys: set[str] = set()
            for t in trips:
                tid = rel_id(t, "trip")
                if tid:
                    trip_keys.add(tid)
            active = int((vdf["route_id"] == rid).sum()) if len(vdf) else 0
            scheduled = len(trip_keys)
            ghost = max(0, scheduled - active)
            rel = (active / scheduled * 100.0) if scheduled else 100.0
            gh_rows.append({"route": rid, "scheduled": scheduled, "active": active, "ghost": ghost, "reliability": rel})
        gh_df = (
            pd.DataFrame(gh_rows).sort_values("reliability")
            if gh_rows
            else pd.DataFrame(columns=["route", "scheduled", "active", "ghost", "reliability"])
        )
        metrics["ghost_df"] = gh_df
        metrics["ghost_total_sched"] = int(gh_df["scheduled"].sum()) if len(gh_df) else 0
        metrics["ghost_total_ghost"] = int(gh_df["ghost"].sum()) if len(gh_df) else 0

        pain: dict[str, float] = {}
        head: dict[str, float] = {}
        for rid in BUSY_ROUTES:
            trips = sched.get(rid) or []
            dep_times: list[int] = []
            for t in trips:
                attr = t.get("attributes") or {}
                dt = attr.get("departure_time")
                if isinstance(dt, str) and ":" in dt:
                    parts = dt.split(":")
                    try:
                        dep_times.append(int(parts[0]) * 60 + int(parts[1]))
                    except Exception:
                        continue
            dep_times.sort()
            headways: list[float] = []
            for a, b in zip(dep_times, dep_times[1:]):
                d = b - a
                if 0 < d < 120:
                    headways.append(float(d))
            headway = float(np.median(headways)) if headways else 15.0
            head[str(rid)] = headway
            waits: list[float] = []
            now = datetime.now(timezone.utc)
            for sid in bundle.get("sample_stops", {}).get(rid, []) or []:
                for pr in bundle.get("preds_by_stop", {}).get(str(sid), []) or []:
                    if rel_id(pr, "route") != rid:
                        continue
                    attr = pr.get("attributes") or {}
                    arr = parse_dt(attr.get("arrival_time") or attr.get("departure_time"))
                    if arr:
                        waits.append(max(0.0, (arr - now).total_seconds() / 60.0))
            med_wait = float(np.median(waits)) if waits else headway
            pain[str(rid)] = (med_wait / headway) if headway > 0 else 1.0
        metrics["pain"] = pain
        metrics["headway"] = head
        worst_route = max(pain, key=lambda k: pain[k]) if pain else "28"
        metrics["worst_route"] = worst_route

        bunch: dict[str, float] = {}
        for rid, g in vdf.groupby("route_id"):
            if rid is None or (isinstance(rid, float) and pd.isna(rid)):
                continue
            gg = g.dropna(subset=["lat", "lon"])
            if len(gg) < 2:
                bunch[str(rid)] = 0.0
                continue
            gg = gg.sort_values("lat")
            lats = gg["lat"].to_numpy()
            lons = gg["lon"].to_numpy()
            pairs = 0
            for i in range(len(gg) - 1):
                d = haversine_miles(float(lats[i]), float(lons[i]), float(lats[i + 1]), float(lons[i + 1]))
                if d < 0.3:
                    pairs += 1
            bunch[str(rid)] = min(100.0, pairs / max(1, len(gg) - 1) * 100.0)
        metrics["bunch"] = bunch

        window_h = 0.75
        fq_rows: list[dict] = []
        for rid in BUSY_ROUTES:
            n = len(sched.get(rid) or [])
            tph = n / window_h if window_h else 0.0
            riders = float(RIDERSHIP.get(rid, 5000))
            fq_rows.append({"route": rid, "trips_per_hour": tph, "riders_per_trip": riders / max(1.0, float(n) * 30.0)})
        metrics["fq_df"] = pd.DataFrame(fq_rows)

        sdf_rows: list[dict] = []
        for s in bundle.get("stops_bus") or []:
            attr = s.get("attributes") or {}
            lat = attr.get("latitude")
            lon = attr.get("longitude")
            if lat is None or lon is None:
                continue
            sid = s.get("id")
            sdf_rows.append({"id": sid, "lat": float(lat), "lon": float(lon), "name": attr.get("name") or ""})
        sdf = pd.DataFrame(sdf_rows)
        if len(sdf) > 650:
            sdf = sdf.sample(650, random_state=7)
        sdf["has_pred"] = sdf["id"].isin(bus_stop_ids_pred)
        metrics["stops_map_df"] = sdf

        income_by_route: dict[str, float] = {}
        for rid, pair in ROUTE_NEIGHBOR.items():
            a, b = pair
            inc_a = float(NEIGHBOR_STATS.get(a, {}).get("income", 60000))
            inc_b = float(NEIGHBOR_STATS.get(b, {}).get("income", 60000))
            income_by_route[str(rid)] = (inc_a + inc_b) / 2.0

        eq_rows: list[dict] = []
        for rid in BUSY_ROUTES:
            rel = 0.0
            g_row = gh_df[gh_df["route"] == rid]
            if len(g_row):
                rel = float(g_row.iloc[0]["reliability"])
                scheduled_i = int(g_row.iloc[0]["scheduled"] or 0)
                ghost_i = int(g_row.iloc[0]["ghost"] or 0)
                ghost_rate = ghost_i / max(1, scheduled_i)
            else:
                ghost_rate = 0.0
            inc = income_by_route.get(str(rid), 60000.0)
            pain_v = float(pain.get(str(rid), 1.0))
            bunch_v = float(bunch.get(str(rid), 0.0))
            neigh = ROUTE_NEIGHBOR.get(rid, ("Roxbury", "Dorchester"))
            poc = float(np.mean([NEIGHBOR_STATS.get(n, {}).get("poc", 0.5) for n in neigh]))
            ncar = float(np.mean([NEIGHBOR_STATS.get(n, {}).get("no_car", 0.35) for n in neigh]))
            score = rel - 40.0 * ghost_rate - 10.0 * max(0.0, pain_v - 1.0) - 0.2 * bunch_v - 0.0003 * max(0.0, 70000.0 - inc) + 30.0 * poc + 15.0 * ncar
            if score >= 75:
                grade = "A"
            elif score >= 60:
                grade = "B"
            elif score >= 45:
                grade = "C"
            elif score >= 30:
                grade = "D"
            else:
                grade = "F"
            eq_rows.append(
                {
                    "route": rid,
                    "pain": pain_v,
                    "ghost_rate": ghost_rate,
                    "bunch": bunch_v,
                    "digital": float(metrics["bus_stop_pred_rate"]),
                    "income": inc,
                    "poc": poc,
                    "no_car": ncar,
                    "reliability": rel,
                    "grade": grade,
                }
            )
        eqdf = pd.DataFrame(eq_rows)
        metrics["equity_df"] = eqdf
        low = eqdf[eqdf["income"] < 45000]["reliability"] if len(eqdf) else pd.Series(dtype=float)
        high = eqdf[eqdf["income"] >= 70000]["reliability"] if len(eqdf) else pd.Series(dtype=float)
        metrics["title_vi_flag"] = bool(len(low) and len(high) and float(low.mean()) + 12.0 < float(high.mean()))

        texts = [c["text"] for c in POLICY_CHUNKS]
        if texts:
            rag_vec = TfidfVectorizer(stop_words="english", max_features=8000)
            rag_mat = rag_vec.fit_transform(texts)
        else:
            rag_vec = None
            rag_mat = None
        metrics["rag_vec"] = rag_vec
        metrics["rag_mat"] = rag_mat
        metrics["rag_chunks"] = POLICY_CHUNKS

        alerts = bundle.get("alerts") or []
        cat_counts = {"delay": 0, "detour": 0, "shuttle": 0, "suspension": 0, "elevator": 0, "other": 0}
        route_alert_hits: dict[str, int] = defaultdict(int)
        elevator_hits = 0
        for a in alerts:
            attr = a.get("attributes") or {}
            hdr = (attr.get("header") or "") + " " + (attr.get("description") or "")
            h = hdr.lower()
            if "elevator" in h or "escalator" in h:
                cat_counts["elevator"] += 1
                elevator_hits += 1
            elif "shuttle" in h:
                cat_counts["shuttle"] += 1
            elif "detour" in h:
                cat_counts["detour"] += 1
            elif "suspend" in h:
                cat_counts["suspension"] += 1
            elif "delay" in h:
                cat_counts["delay"] += 1
            else:
                cat_counts["other"] += 1
            rdata = ((a.get("relationships") or {}).get("route") or {}).get("data") or []
            if isinstance(rdata, dict):
                rdata = [rdata]
            for ent in rdata:
                rid = ent.get("id") if isinstance(ent, dict) else None
                if rid:
                    route_alert_hits[str(rid)] += 1
        metrics["alert_cats"] = cat_counts
        metrics["route_alert_hits"] = dict(sorted(route_alert_hits.items(), key=lambda kv: kv[1], reverse=True)[:12])
        metrics["elevator_hits"] = elevator_hits

        total_active = int(len(vdf))
        extra_min = 0.0
        for rid in BUSY_ROUTES:
            p = float(pain.get(str(rid), 1.0))
            h = float(head.get(str(rid), 15.0))
            r = float(RIDERSHIP.get(rid, 5000))
            extra_min += max(0.0, p - 1.0) * h * r * 2.0
        metrics["collective_hours_year_est"] = extra_min * 250.0 / 60.0
        metrics["collective_dollars_m_est"] = metrics["collective_hours_year_est"] * MEDIAN_WAGE / 1_000_000.0

        elapsed = max(0.0, time.time() - float(bundle.get("session_t0", time.time())))
        metrics["session_counter_hours"] = max(0.0, total_active * 0.02 * (elapsed / 3600.0))

        return metrics

    def retrieve_policy(metrics: dict, query: str, top_k: int = 4) -> list[dict]:
        vec = metrics.get("rag_vec")
        mat = metrics.get("rag_mat")
        chunks = metrics.get("rag_chunks") or []
        if vec is None or mat is None or not chunks:
            return []
        qv = vec.transform([query])
        sims = cosine_similarity(qv, mat)[0]
        idx = np.argsort(sims)[-top_k:][::-1]
        return [chunks[int(i)] for i in idx]

    def metrics_payload(bundle: dict, metrics: dict) -> dict:
        worst = str(metrics.get("worst_route", "28"))
        gh = metrics.get("ghost_df", pd.DataFrame())
        gr = 0.0
        if len(gh) and (gh["route"] == worst).any():
            row = gh.loc[gh["route"] == worst].iloc[0]
            gr = float(row["ghost"]) / max(1, int(row["scheduled"] or 1))
        return {
            "timestamp": bundle.get("fetched_at", datetime.now(timezone.utc)).isoformat(),
            "ghost_bus_rate": (metrics.get("ghost_total_ghost", 0) / max(1, metrics.get("ghost_total_sched", 1))),
            "worst_route": {
                "id": worst,
                "pain_index": float(metrics.get("pain", {}).get(worst, 1.0)),
                "ghost_rate": gr,
            },
            "bus_vs_subway_prediction_gap": {
                "bus_pct": float(metrics.get("bus_pct_stops_realtime", 0.0)),
                "subway_pct": float(metrics.get("subway_pct_stops_realtime", 0.0)),
            },
            "total_active_buses": int(len(metrics.get("vehicles_df", []))),
            "total_scheduled": int(metrics.get("ghost_total_sched", 0)),
            "bunching_routes": sorted(metrics.get("bunch", {}), key=lambda r: metrics["bunch"].get(r, 0.0), reverse=True)[:5],
            "elevator_outages": int(metrics.get("elevator_hits", 0)),
            "pct_late": float(metrics.get("pct_late", 0.0)),
        }

    def anthropic_client():
        key = os.environ.get("ANTHROPIC_API_KEY")
        if not key or anthropic is None:
            return None
        return anthropic.Anthropic(api_key=key)

    def claude_text(client, system: str, user: str, max_tokens: int = 1200) -> str:
        if client is None:
            return ""
        try:
            resp = client.messages.create(
                model="claude-sonnet-4-20250514",
                max_tokens=max_tokens,
                system=system,
                messages=[{"role": "user", "content": user}],
            )
            parts: list[str] = []
            for block in resp.content:
                if getattr(block, "type", None) == "text":
                    parts.append(block.text)
            return "\n".join(parts).strip()
        except Exception as e:  # pragma: no cover
            return f"(Claude error: {e})"

    EQUITY = {
        "LANG_OPTIONS": LANG_OPTIONS,
        "TRANSLATIONS": TRANSLATIONS,
        "T": T,
        "load_mbta_data": load_mbta_data,
        "compute_metrics": compute_metrics,
        "retrieve_policy": retrieve_policy,
        "metrics_payload": metrics_payload,
        "claude_text": claude_text,
        "anthropic_client": anthropic_client,
        "POLICY_CHUNKS": POLICY_CHUNKS,
        "RIDERSHIP": RIDERSHIP,
        "NEIGHBOR_STATS": NEIGHBOR_STATS,
        "MOBILITY": MOBILITY,
        "BUSY_ROUTES": BUSY_ROUTES,
        "BOSTON": BOSTON,
        "MEDIAN_WAGE": MEDIAN_WAGE,
        "ROUTE_NEIGHBOR": ROUTE_NEIGHBOR,
        "HISTORY": HISTORY,
        "haversine_miles": haversine_miles,
    }

    return (EQUITY,)


@app.cell
def __(mo, EQUITY):
    lang_dd = mo.ui.dropdown(options=EQUITY["LANG_OPTIONS"], value="English", label="Language / Idioma / 语言")
    # Cannot read lang_dd.value in this cell (same cell that defines lang_dd); label uses EN refresh string.
    refresh_btn = mo.ui.button(label="🔄 " + EQUITY["T"]("en", "refresh"), kind="neutral")
    mo.hstack([lang_dd, refresh_btn], justify="space-between", align="center")
    return lang_dd, refresh_btn


@app.cell
def __(EQUITY, refresh_btn):
    bundle = EQUITY["load_mbta_data"](refresh_btn)
    return (bundle,)


@app.cell
def __(EQUITY, bundle):
    metrics = EQUITY["compute_metrics"](bundle)
    return (metrics,)


@app.cell
def __(mo, EQUITY, lang_dd, bundle):
    _lang = lang_dd.value

    def _T(k: str) -> str:
        return EQUITY["T"](_lang, k)

    route_filter = mo.ui.dropdown(
        options={_T("all_routes"): "ALL", **{str(r): str(r) for r in EQUITY["BUSY_ROUTES"]}},
        value=_T("all_routes"),
        label=_T("filter_route"),
    )
    route_dd = mo.ui.dropdown(options={str(r): str(r) for r in EQUITY["BUSY_ROUTES"]}, value="28", label=_T("route"))
    ai_refresh = mo.ui.button(label="🔄 " + _T("regenerate_ai"), kind="neutral")
    days_sl = mo.ui.slider(1, 7, value=5, label=_T("days_week"))
    weeks_sl = mo.ui.slider(1, 52, value=50, label=_T("weeks_year"))
    wage_tx = mo.ui.text(value="25", label=_T("wage"))
    story = mo.ui.text_area(label=_T("story_title"), placeholder=_T("story_placeholder"))
    chat_in = mo.ui.text(placeholder=_T("ask_placeholder"))
    chat_go = mo.ui.button(label=_T("send"))
    return route_filter, route_dd, ai_refresh, days_sl, weeks_sl, wage_tx, story, chat_in, chat_go


@app.cell
def __(mo, EQUITY, lang_dd, bundle, route_dd):
    _lang = lang_dd.value

    def _T(k: str) -> str:
        return EQUITY["T"](_lang, k)

    rid = str(route_dd.value)
    opts = {str(s): str(s) for s in (bundle.get("sample_stops", {}).get(rid, []) or [])} or {"n/a": "n/a"}
    first_key = next(iter(opts))
    stop_dd = mo.ui.dropdown(options=opts, value=first_key, label=_T("stop"))
    return (stop_dd,)


@app.cell
def __(mo, EQUITY, bundle, metrics, lang_dd, route_filter, route_dd, stop_dd, ai_refresh, days_sl, weeks_sl, wage_tx, story, chat_in, chat_go):
    import json as __json
    import uuid as __uuid
    import datetime as __dt

    import folium as __folium
    import numpy as __np
    import pandas as __pd
    import plotly.express as __px
    import plotly.graph_objects as __go

    lang = lang_dd.value
    __t = lambda k: EQUITY["T"](lang, k)

    def rtl(md: str) -> mo.md:
        if lang == "ar":
            return mo.md("<div dir='rtl' style='text-align:right'>\n\n" + md + "\n\n</div>")
        return mo.md(md)

    _ = ai_refresh.value
    _ = chat_go.value
    rf = route_filter.value

    client = EQUITY["anthropic_client"]()
    payload = EQUITY["metrics_payload"](bundle, metrics)
    narrator = ""
    if client:
        narrator = EQUITY["claude_text"](
            client,
            system=(
                "You are a transit equity analyst. Given live MBTA data, write a compelling 3-paragraph narrative briefing. "
                "Paragraph 1: What's happening right now (use specific numbers). Paragraph 2: Who is most affected and why it's an equity issue. "
                "Paragraph 3: The single most impactful thing MBTA could fix TODAY based on this data. Be direct, passionate, and cite every number. "
                f"Write in language code {lang}."
            ),
            user="Here is the live MBTA dashboard data:\n" + __json.dumps(payload, indent=2),
            max_tokens=1500,
        )
    else:
        narrator = __t("no_api_key")

    anomaly = ""
    if client:
        rows = metrics.get("equity_df")
        anomaly = EQUITY["claude_text"](
            client,
            system="You are a data anomaly detector. Respond with exactly 3 bullet points.",
            user="Given these route metrics (JSON), identify biggest outlier, suspicious patterns, and a positive outlier.\n"
            + ((rows if rows is not None else __pd.DataFrame()).to_json(orient="records")),
            max_tokens=700,
        )

    rag_chunks = EQUITY["retrieve_policy"](
        metrics,
        f"What did MBTA promise about Route {metrics.get('worst_route')} frequency and Title VI obligations?",
        top_k=4,
    )
    rag_context = "\n\n".join([f"[{c.get('source')}]: {c.get('text')}" for c in rag_chunks])
    promise_report = ""
    if client and rag_context:
        promise_report = EQUITY["claude_text"](
            client,
            system="You are a transit policy auditor. Compare promises to live outcomes. Be factual but firm.",
            user="MBTA DOCUMENTS:\n"
            + rag_context
            + "\n\nLIVE DATA:\n"
            + __json.dumps(payload, indent=2)
            + "\n\nSummarize as a markdown table with columns: Promised | Happening | Source",
            max_tokens=1000,
        )

    vdf = metrics.get("vehicles_df", __pd.DataFrame())
    vmap = vdf if rf == "ALL" else vdf[vdf["route_id"] == rf]
    m = __folium.Map(location=[EQUITY["BOSTON"][0], EQUITY["BOSTON"][1]], zoom_start=11, tiles="CartoDB positron")
    for _, row in vmap.dropna(subset=["lat", "lon"]).iterrows():
        __folium.CircleMarker(
            location=[float(row["lat"]), float(row["lon"])],
            radius=4,
            color=row.get("color", "#333"),
            fill=True,
            fill_opacity=0.9,
            popup=f"Route {row.get('route_id')} | delay {row.get('delay_min')} min | vehicle {row.get('vehicle_id')}",
        ).add_to(m)
    map_html = __folium.Figure(height=420, width="100%").add_child(m).render()

    pred_df = __pd.DataFrame(
        [{"mode": "Bus (all stops)", "pct": float(metrics.get("bus_pct_stops_realtime", 0.0))}]
        + [{"mode": str(k), "pct": float(v) * 100.0} for k, v in (metrics.get("subway_cov") or {}).items()]
    )
    fig_pred = __px.bar(pred_df, x="mode", y="pct", labels={"pct": "%", "mode": ""}, title=__t("pred_chart"))

    gh = metrics.get("ghost_df", __pd.DataFrame())
    if len(gh):
        rel_colors = ["#fee2e2" if float(r) < 70.0 else "#ffffff" for r in gh["reliability"].tolist()]
        fig_ghost = __go.Figure(
            data=[
                __go.Table(
                    header=dict(values=["Route", "Scheduled", "Active", "Ghost", "Reliability %"], fill_color="#111827", font=dict(color="white")),
                    cells=dict(
                        values=[
                            gh["route"].tolist(),
                            gh["scheduled"].tolist(),
                            gh["active"].tolist(),
                            gh["ghost"].tolist(),
                            __np.round(gh["reliability"], 1).tolist(),
                        ],
                        fill_color=[rel_colors, rel_colors, rel_colors, rel_colors, rel_colors],
                    ),
                )
            ]
        )
    else:
        fig_ghost = __go.Figure()

    pain_s = __pd.Series(metrics.get("pain", {})).sort_values(ascending=True)
    if len(pain_s):
        fig_pain = __px.bar(
            pain_s.reset_index().rename(columns={"index": "route", 0: "pain"}),
            x="pain",
            y="route",
            orientation="h",
            title=__t("pain_title"),
            color="pain",
            color_continuous_scale=["#22c55e", "#eab308", "#ef4444"],
        )
    else:
        fig_pain = __go.Figure()

    sdf = metrics.get("stops_map_df", __pd.DataFrame())
    if len(sdf):
        fig_signs = __px.scatter_mapbox(
            sdf,
            lat="lat",
            lon="lon",
            color="has_pred",
            color_discrete_map={True: "#22c55e", False: "#ef4444"},
            zoom=11,
            height=420,
            center=dict(lat=EQUITY["BOSTON"][0], lon=EQUITY["BOSTON"][1]),
            mapbox_style="carto-positron",
            title=__t("signs_title"),
        )
    else:
        fig_signs = __go.Figure()

    fq = metrics.get("fq_df", __pd.DataFrame()).copy()
    if len(fq):
        med_x = float(fq["riders_per_trip"].median())
        med_y = float(fq["trips_per_hour"].median())
        fq["quad"] = fq.apply(
            lambda r: "UNDERSERVED"
            if (r["riders_per_trip"] >= med_x and r["trips_per_hour"] <= med_y)
            else ("OVERSERVED" if (r["riders_per_trip"] < med_x and r["trips_per_hour"] > med_y) else "MIXED"),
            axis=1,
        )
    fig_fq = __px.scatter(fq, x="riders_per_trip", y="trips_per_hour", text="route", color="quad", title=__t("freq_title")) if len(fq) else __go.Figure()

    cards = []
    for n, sc in EQUITY["MOBILITY"].items():
        score = 100.0 * float(sc["bus"]) / max(1.0, float(sc["car"]))
        color = "#166534" if score >= 80 else ("#ca8a04" if score >= 50 else "#991b1b")
        cards.append(
            mo.Html(
                f"<div style='padding:12px;border-radius:10px;background:{color};color:white;min-width:160px'><b>{n}</b><br/>Mobility score<br/><span style='font-size:22px'>{score:.0f}%</span></div>"
            )
        )

    eqdf = metrics.get("equity_df", __pd.DataFrame())
    fig_eq = __px.scatter(eqdf, x="income", y="reliability", text="route", color="grade", title=__t("scorecard_title")) if len(eqdf) else __go.Figure()

    tre = eqdf.copy()
    if len(tre):
        tre["hours"] = tre["pain"].clip(lower=0) * 1000.0
    fig_tree = (
        __px.treemap(tre, path=["route"], values="hours", color="pain", color_continuous_scale=["#22c55e", "#ef4444"], title=__t("collective_title"))
        if len(tre)
        else __go.Figure()
    )

    bunch_s = __pd.Series(metrics.get("bunch", {}))
    if len(bunch_s):
        fig_bunch = __px.bar(
            bunch_s.reset_index().rename(columns={"index": "route", 0: "bunch"}),
            x="route",
            y="bunch",
            title="Bunching score (proxy)",
        )
    else:
        fig_bunch = __go.Figure()

    pain_r = float(metrics.get("pain", {}).get(str(route_dd.value), 1.0))
    head_r = float(metrics.get("headway", {}).get(str(route_dd.value), 15.0))
    try:
        wage = float(str(wage_tx.value).replace("$", "").strip() or "25")
    except Exception:
        wage = 25.0
    extra_min_trip = max(0.0, (pain_r - 1.0)) * head_r
    trips_year = float(days_sl.value) * float(weeks_sl.value) * 2.0
    extra_hours_year = extra_min_trip * trips_year / 60.0
    dollars = extra_hours_year * wage
    days_lost = extra_hours_year / 8.0

    walk_min = 25.0
    transit_min = extra_min_trip + 12.0

    example = "I got late to my internship every single day because of unreliable trains. Not once. Not sometimes. Every. Single. Day. I couldn't control it, but my boss only saw that I was late. Thousands of Boston commuters live this reality."

    tweets = [
        f"Right now, {payload['ghost_bus_rate']*100:.0f}% of sampled scheduled trips look uncovered by active vehicles (heuristic). @MBTA @MassDOT #FixTheBus #TransitEquity",
        f"Bus stops with live predictions (approx): {payload['bus_vs_subway_prediction_gap']['bus_pct']:.0f}% vs subway-ish coverage {payload['bus_vs_subway_prediction_gap']['subway_pct']:.0f}%. #BostonDeservesBetter @MBTA",
        f"MBTA bus delays may cost Boston on the order of ${metrics.get('collective_dollars_m_est', 0):.1f}M/year in lost time (model estimate). Route {payload['worst_route']['id']} pain index {payload['worst_route']['pain_index']:.2f}. @MassDOT #FixTheT",
        f"I lose ~{extra_hours_year:.0f} hours/year waiting on Route {route_dd.value} (model). That's ~{days_lost:.1f} full work days. @MBTA #MyCommuteMatters",
    ]

    def copy_btn(txt: str) -> mo.Html:
        tid = "t" + __uuid.uuid4().hex
        esc = __json.dumps(txt)
        return mo.Html(
            f"""<div style='display:flex;gap:8px;align-items:flex-start'><pre style='flex:1;white-space:pre-wrap;background:#0b1220;color:#e5e7eb;padding:12px;border-radius:10px' id='{tid}'>{txt}</pre>
            <button style='height:36px' onclick='navigator.clipboard.writeText({esc})'>{__t("copy")}</button></div>"""
        )

    letter = (
        f"Dear MBTA Board of Directors,\n\n"
        f"This letter is backed by live data from your API, collected on {__dt.date.today().isoformat()}.\n\n"
        f"THE PROBLEM:\n"
        f"- Ghost-like gaps: {metrics.get('ghost_total_ghost',0)} of {metrics.get('ghost_total_sched',0)} scheduled trips in the sampled window lack matching active vehicles (heuristic).\n"
        f"- Worst pain route: {metrics.get('worst_route')} with pain index {float(metrics.get('pain',{}).get(str(metrics.get('worst_route')),1.0)):.2f}.\n"
        f"- Real-time predictions reach ~{metrics.get('bus_pct_stops_realtime',0):.0f}% of bus stops in this sample vs ~{metrics.get('subway_pct_stops_realtime',0):.0f}% for subway stop coverage (API-based approximation).\n\n"
        f"OUR PROPOSALS:\n"
        f"1) Publish alerts in the 7 most-spoken languages in Boston.\n"
        f"2) Close real-time information gaps at high-ridership bus stops.\n"
        f"3) Target bunching on {', '.join((payload.get('bunching_routes') or [])[:3])}.\n"
        f"4) Prioritize elevator/escalator restoration.\n\n"
        f"Signed,\nA Boston commuter\n"
    )

    letter_html = "<!doctype html><meta charset='utf-8'><title>Open Letter</title><pre style='white-space:pre-wrap;font-family:system-ui;padding:24px'>" + letter.replace("&", "&amp;").replace("<", "&lt;") + "</pre>"
    letter_bytes = letter_html.encode("utf-8")

    council_md = mo.md(
        "### "
        + __t("council_title")
        + "\n"
        + "- District contacts: https://www.boston.gov/departments/city-council\n"
        + "- Email template: include ghost-bus rate, pain index, and prediction coverage from this dashboard."
    )

    chat_out = ""
    if client and chat_in.value.strip():
        try:
            resp = client.messages.create(
                model="claude-sonnet-4-20250514",
                max_tokens=1200,
                system=f"You are Ask the T. Cite numbers from CONTEXT JSON. Language={lang}.",
                messages=[
                    {
                        "role": "user",
                        "content": "CONTEXT:\n" + __json.dumps(payload, indent=2) + "\n\nQUESTION:\n" + chat_in.value,
                    }
                ],
            )
            parts: list[str] = []
            for block in resp.content:
                if getattr(block, "type", None) == "text":
                    parts.append(block.text)
            chat_out = "\n".join(parts).strip()
        except Exception as e:  # pragma: no cover
            chat_out = str(e)

    forecast = ""
    if client:
        forecast = EQUITY["claude_text"](
            client,
            system="You are a forecaster. Short answer with confidence.",
            user="Given current MBTA summary JSON, predict next 30 minutes for Route 28 quality.\n" + __json.dumps(payload, indent=2),
            max_tokens=500,
        )

    meeting = ""
    if client:
        meeting = EQUITY["claude_text"](
            client,
            system="Generate board meeting talking points with citations.",
            user="Summarize dashboard JSON + equity table JSON.\n"
            + __json.dumps({"payload": payload, "equity": (eqdf.to_dict(orient="records") if len(eqdf) else [])}, indent=2)[:12000],
            max_tokens=1200,
        )

    title_vi = ""
    if metrics.get("title_vi_flag") and len(eqdf):
        low_m = float(eqdf.loc[eqdf["income"] < 45000, "reliability"].mean())
        high_m = float(eqdf.loc[eqdf["income"] >= 70000, "reliability"].mean())
        title_vi = (
            f"⚠️ POTENTIAL TITLE VI RISK SIGNAL: Lower-income corridor proxy routes average {low_m:.0f}% reliability vs {high_m:.0f}% for higher-income proxy routes in this model. "
            f"This is not a legal determination — it is a prompt for deeper Title VI analysis."
        )

    try:
        import langgraph  # noqa: F401

        lg_note = "LangGraph is installed — you can extend this notebook with a StateGraph router as sketched in the hackathon prompt."
    except Exception:
        lg_note = EQUITY["TRANSLATIONS"]["en"]["langgraph_note"]

    corr_note = ""
    if len(eqdf) > 2:
        c = eqdf[["income", "reliability"]].corr(numeric_only=True).iloc[0, 1]
        if c < -0.25:
            corr_note = "**The data suggests a negative correlation between modeled neighborhood income proxies and reliability in this small sample — treat as exploratory.**"

    mo.vstack(
        [
            rtl(f"# {__t('title')}"),
            rtl(f"### {__t('subtitle')}"),
            mo.callout(narrator, kind="warn") if narrator else mo.md(""),
            mo.hstack([ai_refresh]),
            mo.hstack(
                [
                    mo.stat(str(len(vmap)), label=__t("active_buses")),
                    mo.stat(f"{metrics.get('pct_late',0)*100:.0f}%", label=__t("pct_late")),
                ]
            ),
            mo.md(f"**{__t('last_updated')}:** `{bundle.get('fetched_at')}`"),
            mo.callout("\n".join(bundle.get("errors", [])), kind="danger") if bundle.get("errors") else mo.md(""),
            rtl("## " + __t("where_bus")),
            mo.Html(map_html),
            route_filter,
            rtl("## " + __t("bus_vs_subway")),
            mo.ui.plotly(fig_pred),
            mo.hstack(
                [
                    mo.stat(f"{metrics.get('bus_pct_stops_realtime',0):.0f}%", label="Bus stops w/ preds (approx)"),
                    mo.stat(f"{metrics.get('subway_pct_stops_realtime',0):.0f}%", label="Subway stops w/ preds (approx)"),
                ]
            ),
            mo.callout(__t("stat_bus_riders") + "\n\n" + __t("stat_subway_note")),
            rtl("## " + __t("ghost_title")),
            mo.md(__t("ghost_help")),
            mo.ui.plotly(fig_ghost),
            mo.stat(f"{metrics.get('ghost_total_ghost',0)} / {metrics.get('ghost_total_sched',0)}", label="Ghost / scheduled (window)"),
            rtl("## " + __t("pain_title")),
            mo.ui.plotly(fig_pain),
            mo.stat(
                f"{metrics.get('worst_route')} → {float(metrics.get('pain',{}).get(str(metrics.get('worst_route')),1.0)):.2f}",
                label="Worst pain",
            ),
            rtl("## " + __t("bunch_title")),
            mo.ui.plotly(fig_bunch),
            rtl("## " + __t("signs_title")),
            mo.ui.plotly(fig_signs),
            rtl("## " + __t("freq_title")),
            mo.ui.plotly(fig_fq),
            rtl("## " + __t("mobility_title")),
            mo.hstack(cards, justify="start"),
            rtl("## " + __t("scorecard_title")),
            mo.ui.plotly(fig_eq),
            mo.md(corr_note) if corr_note else mo.md(""),
            rtl("## " + __t("late_title")),
            mo.hstack([route_dd, stop_dd, days_sl, weeks_sl, wage_tx]),
            mo.callout(
                f"Route {route_dd.value}: ~{extra_min_trip:.1f} extra minutes/trip (model), ~${dollars:,.0f}/year at this wage, ~{days_lost:.1f} workdays/yr.\n"
                + (__t("walk_faster") if walk_min < transit_min else ""),
                kind="danger",
            ),
            rtl("## " + __t("collective_title")),
            mo.stat(f"{metrics.get('collective_hours_year_est',0)/1_000_000.0:.2f}M h (model)", label="Hours/year (rough)"),
            mo.stat(f"${metrics.get('collective_dollars_m_est',0):.1f}M", label="$/year (rough)"),
            mo.stat(f"{metrics.get('session_counter_hours',0):.3f} h", label=__t("session_waste")),
            mo.ui.plotly(fig_tree),
            rtl("## " + __t("alerts_title")),
            mo.md("```json\n" + __json.dumps(metrics.get("alert_cats", {}), indent=2) + "\n```"),
            mo.md("```json\n" + __json.dumps(metrics.get("route_alert_hits", {}), indent=2) + "\n```"),
            mo.callout(__t("alerts_only_en"), kind="warn"),
            mo.callout(__t("elevator") + f": {metrics.get('elevator_hits',0)}", kind="danger"),
            rtl("## " + __t("tweet_title")),
            mo.vstack([copy_btn(t) for t in tweets]),
            rtl("## " + __t("story_title")),
            mo.callout(example, kind="neutral"),
            story,
            mo.callout(story.value, kind="neutral") if story.value.strip() else mo.md(""),
            rtl("## " + __t("letter_title")),
            mo.md("```\n" + letter + "\n```"),
            mo.download(data=letter_bytes, filename="open-letter.html", label=__t("download_letter")),
            council_md,
            rtl("## " + __t("rag_title")),
            mo.md(promise_report or "_Enable Claude for policy synthesis._"),
            rtl("## " + __t("anomaly_title")),
            mo.md(anomaly or "_Enable Claude._"),
            rtl("## " + __t("ask_title")),
            mo.hstack([chat_in, chat_go]),
            mo.md("```\n" + chat_out + "\n```") if chat_out else mo.md(""),
            rtl("## " + __t("smart_title")),
            mo.callout(forecast or "_Enable Claude._", kind="neutral"),
            mo.callout(meeting or "_Enable Claude._", kind="neutral"),
            mo.callout(title_vi, kind="danger") if title_vi else mo.md(""),
            mo.md(lg_note),
            mo.md(EQUITY["TRANSLATIONS"]["en"]["mcp_note"]),
            mo.md("### " + __t("footer_sources") + "\n- MBTA V3 API\n- MBTA policy excerpts (embedded)\n- Illustrative neighborhood stats (hardcoded)\n"),
        ],
        gap=1,
    )

if __name__ == "__main__":
    app.run()
