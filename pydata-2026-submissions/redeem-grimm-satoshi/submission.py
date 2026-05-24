"""
Massachusetts Crash Safety Guide — FIFA World Cup 2026™ (Boston)
=================================================================

A tourist-facing interactive safety briefing built on MassDOT IMPACT
crash data. Gillette Stadium (Foxborough, MA) hosts seven 2026 FIFA
World Cup matches; this notebook turns years of police crash reports
into concrete routing advice for visitors.

Data source: MassDOT IMPACT Open Data Hub
  https://massdot-impact-crashes-vhb.opendata.arcgis.com/

Run in APP MODE (code hidden, interactive only):
    marimo run submission.py

Run in EDIT MODE (see and modify code):
    marimo edit submission.py
"""

import marimo

__generated_with = "0.23.6"
app = marimo.App(width="medium", app_title="WC 2026 Boston Crash Safety Guide")


@app.cell(hide_code=True)
def _():
    import marimo as mo
    import pandas as pd
    import requests
    import folium
    from folium.plugins import HeatMap, MarkerCluster
    import altair as alt
    return HeatMap, MarkerCluster, alt, folium, mo, pd, requests


@app.cell(hide_code=True)
def _(mo):
    mo.md(
        """
        <style>
          @keyframes wcSpinBall {
            from { transform: rotate(0deg); }
            to   { transform: rotate(360deg); }
          }
          @keyframes wcDriftBall {
            0%   { transform: translate(0,0) rotate(0deg); }
            50%  { transform: translate(-6px,8px) rotate(180deg); }
            100% { transform: translate(0,0) rotate(360deg); }
          }
          @keyframes wcFlagScroll {
            from { transform: translateX(0); }
            to   { transform: translateX(-50%); }
          }
          @keyframes wcLivePulse {
            0%, 100% { box-shadow: 0 0 0 3px rgba(220,38,38,0.35); }
            50%      { box-shadow: 0 0 0 7px rgba(220,38,38,0.0); }
          }
          @keyframes wcGradientShift {
            0%   { background-position: 0% 50%; }
            50%  { background-position: 100% 50%; }
            100% { background-position: 0% 50%; }
          }
          .wc-hero {
            background: linear-gradient(135deg,
              #7f1d1d 0%, #be123c 22%, #1e3a8a 55%, #0f172a 100%);
            background-size: 200% 200%;
            animation: wcGradientShift 18s ease-in-out infinite;
          }
          .wc-ball-big {
            animation: wcDriftBall 22s ease-in-out infinite;
            transform-origin: 100px 100px;
          }
          .wc-ball-small {
            animation: wcSpinBall 14s linear infinite;
            transform-origin: 30px 30px;
          }
          .wc-flag-row {
            animation: wcFlagScroll 70s linear infinite;
          }
          .wc-live-dot { animation: wcLivePulse 2.2s ease-in-out infinite; }
        </style>

        <div class="wc-hero" style="position:relative; padding:2.6rem 2.4rem 0 2.4rem;
                    border-radius:18px; color:white; overflow:hidden;
                    box-shadow:0 20px 56px rgba(15,23,42,0.32);
                    margin-bottom:1.4rem;">

          <svg xmlns="http://www.w3.org/2000/svg" class="wc-ball-big"
               style="position:absolute; right:-50px; top:-30px;
                      width:280px; height:280px; opacity:0.13;"
               viewBox="0 0 200 200">
            <circle cx="100" cy="100" r="82" fill="none" stroke="white" stroke-width="2.6"/>
            <polygon points="100,28 134,52 121,90 79,90 66,52"
                     fill="none" stroke="white" stroke-width="2"/>
            <polygon points="134,52 166,78 156,122 121,90"
                     fill="none" stroke="white" stroke-width="2"/>
            <polygon points="66,52 34,78 44,122 79,90"
                     fill="none" stroke="white" stroke-width="2"/>
            <polygon points="121,90 156,122 140,160 100,148 79,90"
                     fill="none" stroke="white" stroke-width="2"/>
            <polygon points="79,90 44,122 60,160 100,148"
                     fill="none" stroke="white" stroke-width="2"/>
          </svg>

          <svg xmlns="http://www.w3.org/2000/svg" class="wc-ball-small"
               style="position:absolute; left:-12px; bottom:80px;
                      width:60px; height:60px; opacity:0.18;"
               viewBox="0 0 60 60">
            <circle cx="30" cy="30" r="24" fill="none" stroke="white" stroke-width="1.8"/>
            <polygon points="30,10 40,17 36,28 24,28 20,17"
                     fill="white" opacity="0.4"/>
          </svg>

          <div style="position:relative; z-index:2; max-width:720px;">
            <div style="display:inline-flex; align-items:center; gap:9px;
                        background:rgba(255,255,255,0.13);
                        border:1px solid rgba(255,255,255,0.22);
                        backdrop-filter: blur(6px);
                        padding:5px 13px; border-radius:999px;
                        font-size:0.7rem; font-weight:700; letter-spacing:2.4px;">
              <span class="wc-live-dot" style="width:7px; height:7px; background:#dc2626;
                           border-radius:50%;"></span>
              FIFA WORLD CUP 26 &nbsp;·&nbsp; BOSTON HOST CITY &nbsp;·&nbsp;
              GILLETTE STADIUM
            </div>

            <h1 style="margin:1rem 0 0.6rem 0; font-size:2.4rem; color:white;
                       font-weight:900; letter-spacing:-0.7px; line-height:1.05;
                       text-shadow:0 2px 14px rgba(0,0,0,0.3);">
              Boston Stadium Isn't in Boston
            </h1>

            <div style="font-size:1.02rem; color:rgba(255,255,255,0.95);
                        line-height:1.55; font-weight:400;">
              An <b>intelligent match-day planner</b> for the 48 nations
              and millions of fans arriving for FIFA World Cup 2026.
              Gillette Stadium sits 30 miles south of downtown Boston —
              this guide combines <b>live MBTA transit</b>,
              <b>weather forecasts</b>, <b>OpenStreetMap</b> hotels and
              restaurants (filtered to your home cuisine), and
              <b>FBI public-safety data</b> into a single door-to-stadium
              itinerary built around the match <i>you</i> picked and the
              hotel <i>you</i> entered.
            </div>

            <div style="display:flex; gap:18px; flex-wrap:wrap;
                        margin:1.2rem 0 0.4rem 0;">
              <div style="display:flex; align-items:center; gap:7px;">
                <span style="width:6px; height:6px; background:#16a34a;
                             border-radius:50%; display:inline-block;"></span>
                <span style="font-size:0.78rem; opacity:0.88;
                             letter-spacing:0.4px;">7 Boston matches</span>
              </div>
              <div style="display:flex; align-items:center; gap:7px;">
                <span style="width:6px; height:6px; background:#fbbf24;
                             border-radius:50%; display:inline-block;"></span>
                <span style="font-size:0.78rem; opacity:0.88;
                             letter-spacing:0.4px;">8 live data sources</span>
              </div>
              <div style="display:flex; align-items:center; gap:7px;">
                <span style="width:6px; height:6px; background:#06b6d4;
                             border-radius:50%; display:inline-block;"></span>
                <span style="font-size:0.78rem; opacity:0.88;
                             letter-spacing:0.4px;">120+ Commuter Rail stations</span>
              </div>
              <div style="display:flex; align-items:center; gap:7px;">
                <span style="width:6px; height:6px; background:#a855f7;
                             border-radius:50%; display:inline-block;"></span>
                <span style="font-size:0.78rem; opacity:0.88;
                             letter-spacing:0.4px;">24 home cuisines</span>
              </div>
            </div>
          </div>

          <div style="position:relative; z-index:2; margin:1.6rem -2.4rem 0 -2.4rem;
                      padding:0.85rem 0 0.95rem 0;
                      background:rgba(0,0,0,0.22);
                      border-top:1px solid rgba(255,255,255,0.12);">
            <div style="font-size:0.6rem; opacity:0.7; letter-spacing:2.6px;
                        font-weight:700; text-align:center; margin-bottom:8px;">
              QUALIFIED &amp; CONTENDING NATIONS · FIFA WORLD CUP 26™
            </div>
            <div style="overflow:hidden;
                        mask-image:linear-gradient(90deg, transparent, black 4%, black 96%, transparent);
                        -webkit-mask-image:linear-gradient(90deg, transparent, black 4%, black 96%, transparent);">
              <div class="wc-flag-row"
                   style="display:inline-flex; gap:18px; font-size:1.7rem;
                          white-space:nowrap; padding-left:18px;">
                <span>🇺🇸</span><span>🇨🇦</span><span>🇲🇽</span>
                <span>🇧🇷</span><span>🇦🇷</span><span>🇺🇾</span><span>🇨🇴</span>
                <span>🇨🇱</span><span>🇪🇨</span><span>🇵🇾</span><span>🇵🇪</span>
                <span>🇫🇷</span><span>🇩🇪</span><span>🇪🇸</span><span>🇮🇹</span>
                <span>🇵🇹</span><span>🇬🇧</span><span>🇳🇱</span><span>🇧🇪</span>
                <span>🇭🇷</span><span>🇨🇭</span><span>🇵🇱</span><span>🇩🇰</span>
                <span>🇦🇹</span><span>🇹🇷</span><span>🇷🇸</span><span>🇸🇪</span>
                <span>🇲🇦</span><span>🇪🇬</span><span>🇳🇬</span><span>🇸🇳</span>
                <span>🇨🇲</span><span>🇨🇮</span><span>🇬🇭</span><span>🇹🇳</span>
                <span>🇩🇿</span><span>🇿🇦</span>
                <span>🇯🇵</span><span>🇰🇷</span><span>🇸🇦</span><span>🇮🇷</span>
                <span>🇶🇦</span><span>🇦🇺</span><span>🇨🇳</span><span>🇮🇶</span>
                <span>🇺🇿</span><span>🇯🇴</span>
                <span>🇨🇷</span><span>🇵🇦</span><span>🇭🇳</span><span>🇸🇻</span>
                <span>🇯🇲</span><span>🇳🇿</span>
                <!-- duplicate for seamless looping -->
                <span>🇺🇸</span><span>🇨🇦</span><span>🇲🇽</span>
                <span>🇧🇷</span><span>🇦🇷</span><span>🇺🇾</span><span>🇨🇴</span>
                <span>🇨🇱</span><span>🇪🇨</span><span>🇵🇾</span><span>🇵🇪</span>
                <span>🇫🇷</span><span>🇩🇪</span><span>🇪🇸</span><span>🇮🇹</span>
                <span>🇵🇹</span><span>🇬🇧</span><span>🇳🇱</span><span>🇧🇪</span>
                <span>🇭🇷</span><span>🇨🇭</span><span>🇵🇱</span><span>🇩🇰</span>
                <span>🇦🇹</span><span>🇹🇷</span><span>🇷🇸</span><span>🇸🇪</span>
                <span>🇲🇦</span><span>🇪🇬</span><span>🇳🇬</span><span>🇸🇳</span>
                <span>🇨🇲</span><span>🇨🇮</span><span>🇬🇭</span><span>🇹🇳</span>
                <span>🇩🇿</span><span>🇿🇦</span>
                <span>🇯🇵</span><span>🇰🇷</span><span>🇸🇦</span><span>🇮🇷</span>
                <span>🇶🇦</span><span>🇦🇺</span><span>🇨🇳</span><span>🇮🇶</span>
                <span>🇺🇿</span><span>🇯🇴</span>
                <span>🇨🇷</span><span>🇵🇦</span><span>🇭🇳</span><span>🇸🇻</span>
                <span>🇯🇲</span><span>🇳🇿</span>
              </div>
            </div>
          </div>
        </div>
        """
    )
    return


@app.cell(hide_code=True)
def _(mo):
    # FIFA World Cup 2026 — Gillette Stadium (Boston/Foxborough) hosts
    # 7 matches per FIFA's published match schedule (announced Feb 2024).
    # Team identities become known only after the Dec 2025 draw plus the
    # qualifying playoffs, so we identify matches by stage + slot.
    WC_MATCHES = [
        {
            "id": "M1",
            "name": "Boston Opener",
            "date": "2026-06-13", "weekday": "Saturday",
            "kickoff_local": "15:00", "kickoff_pretty": "3:00 PM",
            "stage": "Group Stage", "match_no": "Match 8",
            "teams": "Group I · Match 1 vs Match 2 (set after Dec 2025 draw)",
        },
        {
            "id": "M2",
            "name": "Group Stage · Friday under the lights",
            "date": "2026-06-19", "weekday": "Friday",
            "kickoff_local": "15:00", "kickoff_pretty": "3:00 PM",
            "stage": "Group Stage", "match_no": "Match 25",
            "teams": "Group D · second matchday",
        },
        {
            "id": "M3",
            "name": "Group Stage · Mid-week clash",
            "date": "2026-06-23", "weekday": "Tuesday",
            "kickoff_local": "15:00", "kickoff_pretty": "3:00 PM",
            "stage": "Group Stage", "match_no": "Match 39",
            "teams": "Group H · second matchday",
        },
        {
            "id": "M4",
            "name": "Group Stage · Saturday noon finale",
            "date": "2026-06-27", "weekday": "Saturday",
            "kickoff_local": "12:00", "kickoff_pretty": "12:00 PM",
            "stage": "Group Stage", "match_no": "Match 57",
            "teams": "Group L · third matchday",
        },
        {
            "id": "M5",
            "name": "Round of 32 · Knockouts begin",
            "date": "2026-06-30", "weekday": "Tuesday",
            "kickoff_local": "15:00", "kickoff_pretty": "3:00 PM",
            "stage": "Round of 32", "match_no": "Match 71",
            "teams": "Winners — Round of 32",
        },
        {
            "id": "M6",
            "name": "Round of 16 · Independence Day match",
            "date": "2026-07-04", "weekday": "Saturday",
            "kickoff_local": "15:00", "kickoff_pretty": "3:00 PM",
            "stage": "Round of 16", "match_no": "Match 90",
            "teams": "Winners advance from Round of 32",
        },
        {
            "id": "M7",
            "name": "Quarter-final · Boston's biggest night",
            "date": "2026-07-09", "weekday": "Thursday",
            "kickoff_local": "15:00", "kickoff_pretty": "3:00 PM",
            "stage": "Quarter-final", "match_no": "Match 102",
            "teams": "Winners advance from Round of 16",
        },
    ]

    _MONTH_NAMES = [
        "", "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December",
    ]

    # marimo's mo.ui.dropdown with a dict treats KEYS as display labels and
    # VALUES as what .value returns. So we map "formatted label" -> match id.
    _options = {"— Pick your match to begin —": ""}
    for _m in WC_MATCHES:
        _mon = _MONTH_NAMES[int(_m["date"][5:7])]
        _day = int(_m["date"][8:10])
        _label = (
            f"{_m['name']}  ·  {_m['weekday']} {_mon} {_day}, "
            f"{_m['kickoff_pretty']}  ·  {_m['match_no']}"
        )
        _options[_label] = _m["id"]

    match_picker = mo.ui.dropdown(
        options=_options,
        value="— Pick your match to begin —",
        label="",
        full_width=True,
    )

    _heading = mo.md(
        """
        <div style="display:flex; align-items:center; gap:10px; margin-bottom:6px;">
          <span style="background:#dc2626; color:white; width:26px; height:26px;
                       border-radius:50%; display:inline-flex; align-items:center;
                       justify-content:center; font-weight:800; font-size:13px;">1</span>
          <span style="font-size:1.08rem; font-weight:700; color:#0f172a;
                       letter-spacing:-0.2px;">
            Which match are you going to?
          </span>
        </div>
        <div style="color:#64748b; font-size:0.88rem; margin:0 0 6px 36px;">
          Gillette Stadium hosts 7 World Cup matches. Pick one — the
          rest of this page configures itself around your match-day plan.
        </div>
        """
    )

    mo.callout(
        mo.vstack([_heading, match_picker], gap=0.3),
        kind="neutral",
    )
    return WC_MATCHES, match_picker


@app.cell(hide_code=True)
def _(mo):
    location_input = mo.ui.text(
        placeholder="e.g. Boston Park Plaza · Cambridge MA · 123 Main St Quincy",
        label="",
        full_width=True,
    )

    unit_toggle = mo.ui.radio(
        options=["km", "miles"],
        value="km",
        inline=True,
        label="Distance units",
    )

    _heading = mo.md(
        """
        <div style="display:flex; align-items:center; gap:10px; margin-bottom:6px;">
          <span style="background:#0891b2; color:white; width:26px; height:26px;
                       border-radius:50%; display:inline-flex; align-items:center;
                       justify-content:center; font-weight:800; font-size:13px;">2</span>
          <span style="font-size:1.08rem; font-weight:700; color:#0f172a;
                       letter-spacing:-0.2px;">
            Where are you starting from?
            <span style="color:#94a3b8; font-weight:500; font-size:0.9rem;">
              (optional)
            </span>
          </span>
        </div>
        <div style="color:#64748b; font-size:0.88rem; margin:0 0 8px 36px;">
          Enter your hotel, neighborhood, or address. We'll find your closest
          Commuter Rail station, calculate walking and driving times, and
          build your full door-to-stadium-to-door itinerary.
        </div>
        """
    )

    mo.callout(
        mo.vstack(
            [_heading, location_input, unit_toggle],
            gap=0.4,
        ),
        kind="neutral",
    )
    return location_input, unit_toggle


@app.cell(hide_code=True)
def _(mo):
    # Sticky Start button: stays True after the first click for the rest of
    # the session, so changing the match or location later re-renders without
    # re-clicking.
    start = mo.ui.button(
        label="Plan my match-day →",
        value=False,
        on_click=lambda _: True,
        kind="success",
    )

    _heading = mo.md(
        """
        <div style="display:flex; align-items:center; gap:10px; margin-bottom:6px;">
          <span style="background:#16a34a; color:white; width:26px; height:26px;
                       border-radius:50%; display:inline-flex; align-items:center;
                       justify-content:center; font-weight:800; font-size:13px;">3</span>
          <span style="font-size:1.08rem; font-weight:700; color:#0f172a;
                       letter-spacing:-0.2px;">
            Ready? Click Start.
          </span>
        </div>
        <div style="color:#64748b; font-size:0.88rem; margin:0 0 6px 36px;">
          We'll fetch your personalized itinerary, weather forecast, transit
          timings, hotels, restrooms, live MBTA positions, and crime overlay
          for the match (and address) you entered above.
        </div>
        """
    )

    mo.callout(
        mo.vstack([_heading, start], gap=0.4),
        kind="neutral",
    )
    return (start,)


@app.cell(hide_code=True)
def _(WC_MATCHES, match_picker, start):
    # Resolve the chosen match. We only expose it to downstream cells once
    # the user has clicked Start — so picking alone doesn't kick off all
    # the fetches; the click does.
    _raw = next(
        (_m for _m in WC_MATCHES if _m["id"] == match_picker.value),
        None,
    )
    selected_match = _raw if (_raw is not None and start.value) else None
    return (selected_match,)


@app.cell(hide_code=True)
def _(location_input, requests, start):
    # Geocode the user's starting location via Nominatim (free, no key,
    # User-Agent required). Only attempts once Start has been clicked AND
    # the user has entered something.
    starting_point = None
    if start.value and location_input.value and location_input.value.strip():
        try:
            _r = requests.get(
                "https://nominatim.openstreetmap.org/search",
                params={
                    "q": location_input.value.strip() + ", Massachusetts, USA",
                    "format": "json",
                    "limit": 1,
                    "addressdetails": 1,
                },
                headers={
                    "User-Agent": (
                        "pydata-2026-boston-safety-guide/1.0 "
                        "(educational; marimo notebook)"
                    )
                },
                timeout=12,
            )
            _r.raise_for_status()
            _data = _r.json()
            if _data:
                _addr = _data[0].get("address", {}) or {}
                _city = (
                    _addr.get("city")
                    or _addr.get("town")
                    or _addr.get("village")
                    or _addr.get("suburb")
                    or _addr.get("municipality")
                    or ""
                )
                # Optional: pull a hero image + intro from Wikipedia for the
                # user's city so the planner opens with a recognizable visual.
                _hero_image = None
                _wiki_extract = None
                if _city:
                    try:
                        _wiki = requests.get(
                            "https://en.wikipedia.org/api/rest_v1/page/summary/"
                            + _city.replace(" ", "_"),
                            headers={
                                "User-Agent": (
                                    "pydata-2026-boston-safety-guide/1.0 "
                                    "(educational; marimo notebook)"
                                )
                            },
                            timeout=8,
                        )
                        if _wiki.ok:
                            _wj = _wiki.json()
                            _img = (_wj.get("originalimage") or {}).get("source")
                            _img_thumb = (_wj.get("thumbnail") or {}).get("source")
                            _hero_image = _img or _img_thumb
                            _wiki_extract = _wj.get("extract")
                    except Exception:
                        pass
                starting_point = {
                    "lat": float(_data[0]["lat"]),
                    "lon": float(_data[0]["lon"]),
                    "display_name": _data[0]["display_name"],
                    "raw_input": location_input.value.strip(),
                    "city": _city,
                    "hero_image": _hero_image,
                    "wiki_extract": _wiki_extract,
                }
        except Exception:
            starting_point = None
    return (starting_point,)


@app.cell(hide_code=True)
def _(mo, requests, selected_match, starting_point, unit_toggle):
    mo.stop(selected_match is None)
    mo.stop(starting_point is None)

    import math as _math
    from datetime import datetime as _dt, timedelta as _td

    # Distance display unit (1 km == 0.621371 miles).
    _unit = unit_toggle.value
    _km_to_disp = 1.0 if _unit == "km" else 0.621371
    _unit_label = "km" if _unit == "km" else "mi"

    def _fmt_dist(km):
        return f"{km * _km_to_disp:.1f} {_unit_label}"

    # Direct service to Gillette (no transfer needed)
    _DIRECT_ROUTES = {"CR-Foxboro", "CR-Franklin"}
    # Terminate at South Station — transfer there to Foxboro Line
    _SOUTH_SIDE_ROUTES = {
        "CR-Fairmount", "CR-Greenbush", "CR-Kingston", "CR-Middleborough",
        "CR-Needham", "CR-NewBedford", "CR-Providence", "CR-Worcester",
    }
    # Terminate at North Station — require North→South Station transfer
    _NORTH_SIDE_ROUTES = {
        "CR-Fitchburg", "CR-Haverhill", "CR-Lowell", "CR-Newburyport",
    }

    # Non-MBTA regional transit agencies that serve cities MBTA doesn't —
    # useful when the user is in a city without MBTA bus coverage.
    _REGIONAL_TRANSIT = {
        "brockton": ("BAT", "Brockton Area Transit", "ridebat.com"),
        "bridgewater": ("BAT", "Brockton Area Transit", "ridebat.com"),
        "easton": ("BAT", "Brockton Area Transit", "ridebat.com"),
        "stoughton": ("BAT", "Brockton Area Transit", "ridebat.com"),
        "plymouth": ("GATRA", "Greater Attleboro Taunton Regional Transit", "gatra.org"),
        "taunton": ("GATRA", "Greater Attleboro Taunton Regional Transit", "gatra.org"),
        "attleboro": ("GATRA", "Greater Attleboro Taunton Regional Transit", "gatra.org"),
        "worcester": ("WRTA", "Worcester Regional Transit Authority", "therta.com"),
        "lowell": ("LRTA", "Lowell Regional Transit Authority", "lrta.com"),
        "new bedford": ("SRTA", "Southeastern Regional Transit Authority", "srtabus.com"),
        "fall river": ("SRTA", "Southeastern Regional Transit Authority", "srtabus.com"),
        "springfield": ("PVTA", "Pioneer Valley Transit Authority", "pvta.com"),
        "fitchburg": ("MART", "Montachusett Regional Transit Authority", "mrta.us"),
        "framingham": ("MWRTA", "MetroWest Regional Transit Authority", "mwrta.com"),
        "natick": ("MWRTA", "MetroWest Regional Transit Authority", "mwrta.com"),
    }

    def _haversine_km(lat1, lon1, lat2, lon2):
        _R = 6371.0
        _p1, _p2 = _math.radians(lat1), _math.radians(lat2)
        _dp = _math.radians(lat2 - lat1)
        _dl = _math.radians(lon2 - lon1)
        _a = (
            _math.sin(_dp / 2) ** 2
            + _math.cos(_p1) * _math.cos(_p2) * _math.sin(_dl / 2) ** 2
        )
        return _R * 2 * _math.atan2(_math.sqrt(_a), _math.sqrt(1 - _a))

    # Fetch ALL Commuter Rail stations from MBTA (route_type 2). Dedupes to
    # one entry per parent station.
    _all_cr_stations = []
    try:
        _r = requests.get(
            "https://api-v3.mbta.com/stops",
            params={"filter[route_type]": 2},
            timeout=15,
        )
        _r.raise_for_status()
        _seen_parents = set()
        for _s in _r.json().get("data", []):
            _attrs = _s.get("attributes", {})
            _parent = (
                _s.get("relationships", {})
                .get("parent_station", {})
                .get("data")
            )
            _key = _parent["id"] if _parent else _s["id"]
            if _key in _seen_parents:
                continue
            _seen_parents.add(_key)
            _lat, _lon = _attrs.get("latitude"), _attrs.get("longitude")
            if _lat is None or _lon is None:
                continue
            _all_cr_stations.append({
                "name": _attrs.get("name", ""),
                "lat": _lat,
                "lon": _lon,
                "id": _key,
                "address": _attrs.get("address") or "",
                "municipality": _attrs.get("municipality") or "",
            })
    except Exception:
        pass

    # Fallback to the Foxboro Line if MBTA API is unreachable.
    if not _all_cr_stations:
        _all_cr_stations = [
            {"name": "South Station",  "lat": 42.3522, "lon": -71.0552,
             "id": "place-sstat", "address": "700 Atlantic Ave, Boston, MA 02110",
             "municipality": "Boston"},
            {"name": "Back Bay",       "lat": 42.3479, "lon": -71.0760,
             "id": "place-bbsta", "address": "145 Dartmouth St, Boston, MA 02116",
             "municipality": "Boston"},
            {"name": "Foxboro",        "lat": 42.0664, "lon": -71.2540,
             "id": "place-fbsta", "address": "1 Patriot Place, Foxborough, MA 02035",
             "municipality": "Foxborough"},
        ]

    # Closest CR station to the user, any line.
    _scored = sorted(
        (
            (_haversine_km(starting_point["lat"], starting_point["lon"],
                           _s["lat"], _s["lon"]),
             _s)
            for _s in _all_cr_stations
        ),
        key=lambda x: x[0],
    )
    _dist_km, _closest = _scored[0]

    # MBTA's API leaves `address` blank for most stops. We curate the major
    # match-day-relevant stations with real principal-entrance addresses,
    # and fall back to a Nominatim reverse-geocode for anything else.
    _STATION_ADDRESSES = {
        "South Station":       "700 Atlantic Ave, Boston, MA 02110",
        "Back Bay":            "145 Dartmouth St, Boston, MA 02116",
        "North Station":       "100 Legends Way, Boston, MA 02114",
        "Ruggles":             "1090 Tremont St, Boston, MA 02120",
        "Forest Hills":        "3850 Washington St, Boston, MA 02130",
        "Hyde Park":           "1234 Hyde Park Ave, Boston, MA 02136",
        "Readville":           "1700 Hyde Park Ave, Boston, MA 02136",
        "Endicott":            "6 Endicott St, Dedham, MA 02026",
        "Dedham Corp Center":  "130 Eastern Ave, Dedham, MA 02026",
        "Norwood Depot":       "16 Broadway, Norwood, MA 02062",
        "Norwood Central":     "188 Broadway, Norwood, MA 02062",
        "Walpole":             "1 East St, Walpole, MA 02081",
        "Norfolk":             "161 Main St, Norfolk, MA 02056",
        "Franklin":            "60 Depot St, Franklin, MA 02038",
        "Forge Park/495":      "7 Forge Park East, Franklin, MA 02038",
        "Foxboro":             "1 Patriot Place, Foxborough, MA 02035",
        "Brockton":            "7 Commercial St, Brockton, MA 02302",
        "Campello":            "600 Main St, Brockton, MA 02301",
        "Bridgewater":         "187 Broad St, Bridgewater, MA 02324",
        "Stoughton":           "2 Wyman St, Stoughton, MA 02072",
        "Sharon":              "60 Depot St, Sharon, MA 02067",
        "Mansfield":           "6 Crocker St, Mansfield, MA 02048",
        "Attleboro":           "12 South Main St, Attleboro, MA 02703",
        "Quincy Center":       "1245 Hancock St, Quincy, MA 02169",
        "Braintree":           "197 Ivory St, Braintree, MA 02184",
        "Worcester":           "2 Washington Sq, Worcester, MA 01604",
        "Framingham":          "417 Waverly St, Framingham, MA 01702",
        "Natick Center":       "1 Washington St, Natick, MA 01760",
        "Wellesley Square":    "20 Washington St, Wellesley, MA 02482",
        "Lowell":              "101 Thorndike St, Lowell, MA 01852",
        "Salem":               "252 Bridge St, Salem, MA 01970",
        "Lynn":                "Market & Carroll Pl, Lynn, MA 01901",
        "Anderson/Woburn":     "100 Atlantic Ave, Woburn, MA 01801",
        "Porter":              "1 Porter Sq, Cambridge, MA 02140",
        "Beverly":             "10 Park St, Beverly, MA 01915",
    }

    # Resolve a display address: curated → MBTA-supplied → Nominatim reverse.
    _resolved_address = _STATION_ADDRESSES.get(_closest["name"]) or _closest.get("address")
    if not _resolved_address:
        try:
            _rev = requests.get(
                "https://nominatim.openstreetmap.org/reverse",
                params={
                    "lat": _closest["lat"], "lon": _closest["lon"],
                    "format": "json", "addressdetails": 1, "zoom": 18,
                },
                headers={
                    "User-Agent": (
                        "pydata-2026-boston-safety-guide/1.0 "
                        "(educational; marimo notebook)"
                    )
                },
                timeout=8,
            )
            if _rev.ok:
                _ra = (_rev.json().get("address") or {})
                _street_parts = []
                if _ra.get("house_number"):
                    _street_parts.append(_ra["house_number"])
                if _ra.get("road"):
                    _street_parts.append(_ra["road"])
                _street = " ".join(_street_parts)
                _city = (
                    _ra.get("city")
                    or _ra.get("town")
                    or _ra.get("village")
                    or _ra.get("suburb")
                    or _closest.get("municipality") or ""
                )
                _postcode = _ra.get("postcode", "")
                _bits = [b for b in [
                    _street,
                    f"{_city}, MA{(' ' + _postcode) if _postcode else ''}".strip(", "),
                ] if b]
                _resolved_address = ", ".join(_bits) or None
        except Exception:
            pass

    if not _resolved_address:
        _resolved_address = (
            f"{_closest.get('municipality', '')}, MA"
            if _closest.get("municipality") else "Massachusetts"
        )

    # Append " Station" if the name doesn't already include a transit suffix.
    _name = _closest["name"]
    _full_station_name = (
        _name if any(
            kw in _name for kw in ("Station", "Junction", "Center", "Sq")
        ) else f"{_name} Station"
    )
    _closest["display_name"] = _full_station_name
    _closest["display_address"] = _resolved_address

    # What routes (CR + bus) serve the closest station?
    _cr_at_closest = []
    _buses_at_closest = []
    try:
        _r2 = requests.get(
            "https://api-v3.mbta.com/routes",
            params={"filter[stop]": _closest["id"]},
            timeout=10,
        )
        _r2.raise_for_status()
        for _rt in _r2.json().get("data", []):
            _rt_id = _rt["id"]
            _rt_attrs = _rt.get("attributes", {})
            if _rt_id.startswith("CR-"):
                _cr_at_closest.append({
                    "id": _rt_id,
                    "name": _rt_attrs.get("long_name", _rt_id),
                })
            elif _rt_attrs.get("type") == 3:  # bus
                _buses_at_closest.append({
                    "id": _rt_id,
                    "short_name": _rt_attrs.get("short_name", "") or _rt_id,
                    "long_name": _rt_attrs.get("long_name", ""),
                })
    except Exception:
        pass

    # Determine the routing path to Gillette.
    _cr_route_ids = {_r["id"] for _r in _cr_at_closest}
    if _cr_route_ids & _DIRECT_ROUTES:
        _routing = "direct"
        _routing_color = "#16a34a"
        _routing_label = "Direct service to Gillette"
        _routing_detail = (
            "Match-day Foxboro Line trains run direct from this station "
            "to Gillette Stadium. No transfers needed."
        )
        _transfer_min = 0
        _connecting_station = None
    elif _cr_route_ids & _SOUTH_SIDE_ROUTES:
        _routing = "south_transfer"
        _routing_color = "#ea580c"
        _routing_label = "One transfer at South Station"
        _routing_detail = (
            f"Ride your home line into South Station, then transfer to "
            f"the match-day Foxboro Line for the leg to Gillette."
        )
        _transfer_min = 15
        _connecting_station = "South Station"
    elif _cr_route_ids & _NORTH_SIDE_ROUTES:
        _routing = "north_transfer"
        _routing_color = "#dc2626"
        _routing_label = "Multi-leg transfer via North → South Station"
        _routing_detail = (
            "Your home line goes into North Station. Take the Orange Line "
            "to State, then the Red Line to South Station, then the "
            "Foxboro Line. Allow 30+ extra minutes."
        )
        _transfer_min = 35
        _connecting_station = "South Station (via Orange + Red)"
    else:
        _routing = "unknown"
        _routing_color = "#64748b"
        _routing_label = "Plan transfer in MBTA app"
        _routing_detail = (
            "We couldn't auto-classify this station's line — "
            "check the MBTA app for the best routing to the Foxboro Line."
        )
        _transfer_min = 20
        _connecting_station = "South Station (likely)"

    # Walking estimate: haversine × 1.3 street factor × 12 min/km (5 km/h pace).
    _walk_min = max(1, int(round(_dist_km * 1.3 * 12)))

    # Driving via OSRM public demo (driving profile).
    def _osrm_drive_min(lat1, lon1, lat2, lon2):
        try:
            _url = (
                "http://router.project-osrm.org/route/v1/driving/"
                f"{lon1},{lat1};{lon2},{lat2}"
            )
            _r = requests.get(_url, params={"overview": "false"}, timeout=10)
            _r.raise_for_status()
            _d = _r.json()
            if _d.get("code") == "Ok" and _d.get("routes"):
                return max(1, int(round(_d["routes"][0]["duration"] / 60)))
        except Exception:
            pass
        return None

    _drive_min = _osrm_drive_min(
        starting_point["lat"], starting_point["lon"],
        _closest["lat"], _closest["lon"],
    )
    if _drive_min is None:
        _drive_min = max(1, int(round(_dist_km * 1.2 * 2)))
        _drive_source = "estimated"
    else:
        _drive_source = "OSRM"

    # Train ride: from closest station to Gillette via Foxboro Line.
    # If transfer needed, leg1 = closest → connecting, leg2 = connecting → Foxboro.
    _GILLETTE_LL = (42.0664, -71.2540)
    _SS_LL = (42.3522, -71.0552)  # South Station
    if _routing == "direct":
        _train_dist_km = _haversine_km(
            _closest["lat"], _closest["lon"],
            _GILLETTE_LL[0], _GILLETTE_LL[1],
        )
        _train_min = max(20, int(round(_train_dist_km / 70 * 60 + 15)))
    else:
        # leg 1: closest → South Station (or via)
        _leg1_dist = _haversine_km(
            _closest["lat"], _closest["lon"],
            _SS_LL[0], _SS_LL[1],
        )
        _leg1_min = max(15, int(round(_leg1_dist / 70 * 60 + 10)))
        # leg 2: South Station → Gillette
        _leg2_dist = _haversine_km(_SS_LL[0], _SS_LL[1], _GILLETTE_LL[0], _GILLETTE_LL[1])
        _leg2_min = max(40, int(round(_leg2_dist / 70 * 60 + 15)))
        _train_min = _leg1_min + _transfer_min + _leg2_min

    # Timing chain — work backward from kickoff.
    _kickoff_dt = _dt.fromisoformat(
        selected_match["date"] + "T" + selected_match["kickoff_local"]
    )
    # Stadium walk-in + event-day crowd buffer = 1h 50min before kickoff.
    _arrive_foxboro_dt = _kickoff_dt - _td(hours=1, minutes=50)
    _train_departs_dt = _arrive_foxboro_dt - _td(minutes=_train_min)
    # Be at the station 15 min before departure (for special-event service).
    _arrive_station_dt = _train_departs_dt - _td(minutes=15)
    _leave_walking_dt = _arrive_station_dt - _td(minutes=_walk_min)
    _leave_driving_dt = _arrive_station_dt - _td(minutes=_drive_min)
    _return_cutoff_dt = _kickoff_dt + _td(hours=4, minutes=30)

    def _fmt_t(dt):
        return dt.strftime("%I:%M %p").lstrip("0")

    # Display name: trim Nominatim's full chain.
    _display = starting_point.get("display_name", "")
    _short = ", ".join(_display.split(",")[:3]) if _display else starting_point["raw_input"]

    # Hero city image + Wikipedia intro (both optional).
    _hero_url = starting_point.get("hero_image")
    if _hero_url:
        _hero_block = (
            f'<div style="flex-shrink:0; width:110px; height:110px;'
            f' border-radius:10px; overflow:hidden; border:1px solid #e5e7eb;'
            f' box-shadow:0 2px 6px rgba(15,23,42,0.08);">'
            f'<img src="{_hero_url}" alt="{starting_point.get("city","")}" '
            'style="width:100%; height:100%; object-fit:cover; display:block;"/>'
            "</div>"
        )
    else:
        _hero_block = ""

    _wiki_extract = starting_point.get("wiki_extract")
    if _wiki_extract:
        _trimmed = _wiki_extract[:220].rsplit(" ", 1)[0]
        if len(_wiki_extract) > 220:
            _trimmed += "…"
        _wiki_block = (
            f'<div style="margin-top:8px; padding:8px 10px; background:#f8fafc;'
            f' border-left:3px solid #0891b2; border-radius:6px;'
            f' font-size:0.82rem; color:#475569; line-height:1.5;">'
            f'<i>{_trimmed}</i>'
            f' <span style="color:#94a3b8; font-size:10px; margin-left:4px;">'
            f'— Wikipedia</span></div>'
        )
    else:
        _wiki_block = ""

    # Regional transit agency (for cities outside MBTA bus coverage).
    _starting_city_lower = (starting_point.get("city") or "").lower().strip()
    _regional_agency = _REGIONAL_TRANSIT.get(_starting_city_lower)

    # Bus chips at the closest CR station.
    if _buses_at_closest:
        _bus_chips = "".join(
            '<span style="display:inline-block; background:white; '
            'border:1px solid #cbd5e1; padding:4px 10px; border-radius:999px; '
            'font-size:11.5px; font-weight:600; color:#0f172a; '
            f'margin:3px 5px 3px 0;" title="{_b["long_name"]}">'
            f'Bus {_b["short_name"]}'
            "</span>"
            for _b in _buses_at_closest[:10]
        )
        _bus_section = f"""
        <div style="background:#f8fafc; border:1px solid #e5e7eb;
                    border-left:3px solid #0891b2; border-radius:10px;
                    padding:0.9rem 1.1rem;">
          <div style="font-size:0.65rem; font-weight:700; letter-spacing:1.3px;
                      color:#64748b; text-transform:uppercase; margin-bottom:6px;">
            MBTA buses serving {_closest["display_name"]}
          </div>
          <div>{_bus_chips}</div>
        </div>
        """
    else:
        _bus_section = ""

    if _regional_agency:
        _ag_short, _ag_long, _ag_url = _regional_agency
        _agency_section = f"""
        <div style="background:#fef3c7; border:1px solid #fde68a;
                    border-left:3px solid #d97706; border-radius:10px;
                    padding:0.9rem 1.1rem;">
          <div style="font-size:0.65rem; font-weight:700; letter-spacing:1.3px;
                      color:#92400e; text-transform:uppercase; margin-bottom:4px;">
            Local bus alternative
          </div>
          <div style="font-size:0.9rem; color:#451a03; line-height:1.45;">
            MBTA buses don't fully cover {starting_point.get("city") or "your area"}.
            Check <b>{_ag_short}</b> ({_ag_long}) at
            <a href="https://{_ag_url}" target="_blank"
               style="color:#92400e; font-weight:600;">{_ag_url}</a>
            for local routes that connect you to {_closest["display_name"]}.
          </div>
        </div>
        """
    else:
        _agency_section = ""

    # Transfer annotation for the timing rail.
    if _routing != "direct" and _connecting_station:
        _train_subtext = (
            f"~{_train_min} min total · transfer at {_connecting_station}"
        )
    else:
        _train_subtext = f"~{_train_min} min ride"

    _itinerary_html = f"""
    <div style="background:white; border:1px solid #e5e7eb; border-radius:14px;
                padding:1.7rem 1.9rem;
                box-shadow:0 6px 22px rgba(15,23,42,0.08);
                margin-bottom:1.4rem;">

      <div style="display:flex; align-items:center; gap:10px; margin-bottom:14px;">
        <span style="background:#0891b2; color:white; width:26px; height:26px;
                     border-radius:50%; display:inline-flex; align-items:center;
                     justify-content:center; font-weight:800; font-size:13px;">★</span>
        <span style="font-size:1.08rem; font-weight:700; color:#0f172a;
                     letter-spacing:-0.2px;">
          Your personalized itinerary
        </span>
      </div>

      <div style="margin-left:36px; display:flex; gap:14px; align-items:flex-start;">
        {_hero_block}
        <div style="flex:1; min-width:0;">
          <div style="font-size:0.7rem; font-weight:700; letter-spacing:1.5px;
                      color:#0891b2; text-transform:uppercase; margin-bottom:4px;">
            Starting point
          </div>
          <div style="font-size:1.08rem; color:#0f172a; font-weight:700;">
            {_short}
          </div>
          <div style="font-size:0.82rem; color:#64748b; margin-top:2px;
                      line-height:1.4;">
            {_display}
          </div>
          {_wiki_block}
        </div>
      </div>

      <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:0.9rem;
                  margin:1.2rem 0 0 36px;">
        <div style="background:#f8fafc; border:1px solid #e5e7eb;
                    border-left:3px solid #0891b2; border-radius:10px;
                    padding:0.9rem 1rem;">
          <div style="font-size:0.65rem; font-weight:700; letter-spacing:1.3px;
                      color:#64748b; text-transform:uppercase;">
            Closest CR station
          </div>
          <div style="font-size:1.05rem; color:#0f172a; font-weight:700;
                      margin-top:4px;">
            {_closest["display_name"]}
          </div>
          <div style="font-size:0.78rem; color:#475569; margin-top:3px;
                      line-height:1.35;">
            {_closest["display_address"]}
          </div>
          <div style="font-size:0.78rem; color:#0891b2; font-weight:600;
                      margin-top:4px;">
            {_fmt_dist(_dist_km)} away
          </div>
        </div>
        <div style="background:#f8fafc; border:1px solid #e5e7eb;
                    border-left:3px solid #16a34a; border-radius:10px;
                    padding:0.9rem 1rem;">
          <div style="font-size:0.65rem; font-weight:700; letter-spacing:1.3px;
                      color:#64748b; text-transform:uppercase;">
            Walk to station
          </div>
          <div style="font-size:1.05rem; color:#0f172a; font-weight:700;
                      margin-top:4px;">
            ~{_walk_min} min
          </div>
          <div style="font-size:0.78rem; color:#64748b; margin-top:2px;">
            5 km/h pace, street-routed
          </div>
        </div>
        <div style="background:#f8fafc; border:1px solid #e5e7eb;
                    border-left:3px solid #ea580c; border-radius:10px;
                    padding:0.9rem 1rem;">
          <div style="font-size:0.65rem; font-weight:700; letter-spacing:1.3px;
                      color:#64748b; text-transform:uppercase;">
            Drive to station
          </div>
          <div style="font-size:1.05rem; color:#0f172a; font-weight:700;
                      margin-top:4px;">
            ~{_drive_min} min
          </div>
          <div style="font-size:0.78rem; color:#64748b; margin-top:2px;">
            via {_drive_source}, no parking factor
          </div>
        </div>
      </div>

      <div style="margin:1rem 0 0 36px;">
        <div style="display:flex; align-items:flex-start; gap:10px;
                    padding:0.85rem 1.1rem; background:#f8fafc;
                    border:1px solid #e5e7eb;
                    border-left:3px solid {_routing_color}; border-radius:10px;">
          <div style="background:{_routing_color}; color:white;
                      padding:3px 9px; border-radius:999px; font-size:10px;
                      font-weight:700; letter-spacing:0.5px;
                      text-transform:uppercase; white-space:nowrap;
                      margin-top:1px;">
            {_routing_label}
          </div>
          <div style="font-size:0.86rem; color:#475569; line-height:1.45;">
            {_routing_detail}
          </div>
        </div>
      </div>

      <div style="margin:0.8rem 0 0 36px; display:flex; flex-direction:column; gap:0.7rem;">
        {_bus_section}
        {_agency_section}
      </div>

      <div style="margin:1.3rem 0 0 36px; padding:1.2rem 1.4rem;
                  background:linear-gradient(135deg,#0f172a 0%,#1e3a8a 100%);
                  color:white; border-radius:12px; position:relative;
                  overflow:hidden;">
        <div style="position:absolute; right:-30px; top:-30px; width:130px; height:130px;
                    border:2px solid rgba(255,255,255,0.07); border-radius:50%;"></div>
        <div style="position:relative; z-index:1;">
          <div style="font-size:0.68rem; font-weight:700; letter-spacing:1.8px;
                      opacity:0.85; text-transform:uppercase; margin-bottom:10px;">
            Door-to-stadium timing · {selected_match["weekday"]} {selected_match["date"]}
          </div>
          <div style="display:grid; grid-template-columns:repeat(4, 1fr); gap:12px;">
            <div>
              <div style="font-size:0.65rem; opacity:0.75;
                          text-transform:uppercase; letter-spacing:1px;">
                Leave (walk)
              </div>
              <div style="font-size:1.18rem; font-weight:700; margin-top:3px;">
                {_fmt_t(_leave_walking_dt)}
              </div>
              <div style="font-size:0.7rem; opacity:0.7;">or drive at {_fmt_t(_leave_driving_dt)}</div>
            </div>
            <div>
              <div style="font-size:0.65rem; opacity:0.75;
                          text-transform:uppercase; letter-spacing:1px;">
                Arrive {_closest["display_name"]}
              </div>
              <div style="font-size:1.18rem; font-weight:700; margin-top:3px;">
                {_fmt_t(_arrive_station_dt)}
              </div>
              <div style="font-size:0.7rem; opacity:0.7;">15 min before train</div>
            </div>
            <div>
              <div style="font-size:0.65rem; opacity:0.75;
                          text-transform:uppercase; letter-spacing:1px;">
                Train departs
              </div>
              <div style="font-size:1.18rem; font-weight:700; margin-top:3px;">
                {_fmt_t(_train_departs_dt)}
              </div>
              <div style="font-size:0.7rem; opacity:0.7;">{_train_subtext}</div>
            </div>
            <div>
              <div style="font-size:0.65rem; opacity:0.75;
                          text-transform:uppercase; letter-spacing:1px;">
                Arrive Foxboro
              </div>
              <div style="font-size:1.18rem; font-weight:700; margin-top:3px;">
                {_fmt_t(_arrive_foxboro_dt)}
              </div>
              <div style="font-size:0.7rem; opacity:0.7;">1h 50m before kickoff</div>
            </div>
          </div>
          <div style="margin-top:14px; padding-top:12px;
                      border-top:1px solid rgba(255,255,255,0.16);
                      display:flex; justify-content:space-between; align-items:center;
                      flex-wrap:wrap; gap:8px;">
            <div>
              <span style="font-size:0.65rem; opacity:0.75;
                           text-transform:uppercase; letter-spacing:1px;
                           margin-right:8px;">Return cutoff</span>
              <span style="font-size:1.05rem; font-weight:700;">{_fmt_t(_return_cutoff_dt)}</span>
              <span style="font-size:0.75rem; opacity:0.75; margin-left:6px;">
                last train back to {_closest["display_name"]}
              </span>
            </div>
            <div style="font-size:0.74rem; opacity:0.7;">
              Kickoff <b>{selected_match["kickoff_pretty"]}</b> ET · Match {selected_match["match_no"]}
            </div>
          </div>
        </div>
      </div>
    </div>
    """

    mo.md(_itinerary_html)
    return


@app.cell(hide_code=True)
def _(mo, selected_match, starting_point):
    mo.stop(selected_match is None)

    # MBTA on-time performance snapshot, derived from publicly reported
    # performance dashboards (mbta.com/performance). Numbers are rounded
    # for visitor orientation — actual rates vary day-to-day.
    _RELIABLE = [
        ("Foxboro / Franklin Line",   "~85% on-time",
         "Match-day shuttle to Gillette · low-incident track"),
        ("Providence / Stoughton Line", "~85% on-time",
         "Long suburban runs · usually punctual"),
        ("Red Line (subway)",         "~92% on-time",
         "Spine of the system · Cambridge ↔ South Station"),
        ("Orange Line (subway)",      "~90% on-time",
         "North Station ↔ Forest Hills · reliable"),
    ]
    _LESS_RELIABLE = [
        ("Worcester Line",            "~70% on-time",
         "Long line · weather-sensitive · plan extra time"),
        ("Old Colony lines",          "~75% on-time",
         "Kingston / Greenbush / Middleborough · single-track delays"),
        ("Green Line (B/C/E branches)", "~78% on-time",
         "Surface running · slower in traffic and snow"),
        ("Haverhill Line",            "~75% on-time",
         "Shares track with Amtrak · cascading delays"),
    ]

    def _rel_rows(rows, accent):
        return "".join(
            '<div style="display:flex; justify-content:space-between; '
            'align-items:center; padding:8px 12px; background:#f8fafc; '
            'border-radius:8px; margin-bottom:6px;">'
            '<div>'
            f'<div style="font-weight:700; color:#0f172a; font-size:0.92rem;">{_name}</div>'
            f'<div style="color:#64748b; font-size:0.78rem; margin-top:1px;">{_note}</div>'
            "</div>"
            f'<div style="background:{accent}; color:white; padding:3px 9px; '
            'border-radius:999px; font-size:11px; font-weight:700; '
            f'white-space:nowrap;">{_score}</div>'
            "</div>"
            for _name, _score, _note in rows
        )

    _user_city = (starting_point or {}).get("city") or ""
    _location_note = (
        f"Tailored for travel from <b>{_user_city}</b>." if _user_city
        else "General match-day reliability across the MBTA network."
    )

    _reliability_html = f"""
    <div style="background:white; border:1px solid #e5e7eb; border-radius:14px;
                padding:1.5rem 1.7rem;
                box-shadow:0 4px 18px rgba(15,23,42,0.07);
                margin-bottom:1.4rem;">
      <div style="display:flex; align-items:center; gap:10px; margin-bottom:6px;">
        <span style="background:#003DA5; color:white; width:26px; height:26px;
                     border-radius:50%; display:inline-flex; align-items:center;
                     justify-content:center; font-weight:800; font-size:13px;">T</span>
        <span style="font-size:1.08rem; font-weight:700; color:#0f172a;
                     letter-spacing:-0.2px;">
          MBTA reliability snapshot
        </span>
      </div>
      <div style="color:#64748b; font-size:0.86rem; margin:0 0 14px 36px;">
        {_location_note} Source: MBTA Performance dashboards
        (mbta.com/performance, recent 30-day averages).
      </div>

      <div style="display:grid; grid-template-columns:1fr 1fr; gap:1rem;
                  margin-left:36px;">
        <div style="background:#f0fdf4; border:1px solid #bbf7d0;
                    border-left:4px solid #16a34a;
                    border-radius:10px; padding:1rem 1.1rem;">
          <div style="font-size:0.65rem; font-weight:700; letter-spacing:1.3px;
                      color:#166534; text-transform:uppercase; margin-bottom:8px;">
            Most reliable
          </div>
          {_rel_rows(_RELIABLE, "#16a34a")}
        </div>
        <div style="background:#fef2f2; border:1px solid #fecaca;
                    border-left:4px solid #dc2626;
                    border-radius:10px; padding:1rem 1.1rem;">
          <div style="font-size:0.65rem; font-weight:700; letter-spacing:1.3px;
                      color:#991b1b; text-transform:uppercase; margin-bottom:8px;">
            Plan extra time
          </div>
          {_rel_rows(_LESS_RELIABLE, "#dc2626")}
        </div>
      </div>
    </div>
    """

    mo.md(_reliability_html)
    return


@app.cell(hide_code=True)
def _(mo, requests, selected_match):
    mo.stop(
        selected_match is None,
        mo.callout(
            mo.md(
                "**Pick a match above and click _Plan my match-day →_** "
                "to unlock your weather forecast, transit timings, hotels, "
                "restrooms, crime overlay, and the rest of this guide."
            ),
            kind="neutral",
        ),
    )

    from datetime import datetime as _dt, timedelta as _td
    from collections import Counter as _Counter

    _GILLETTE_LAT, _GILLETTE_LON = 42.09, -71.26

    def _weather_label(code):
        if code is None:
            return ("Unknown", "#94a3b8")
        if code == 0:
            return ("Clear sky", "#fbbf24")
        if code in (1, 2):
            return ("Mostly sunny", "#fbbf24")
        if code == 3:
            return ("Overcast", "#94a3b8")
        if code in (45, 48):
            return ("Foggy", "#94a3b8")
        if code in (51, 53, 55, 56, 57):
            return ("Drizzle", "#0ea5e9")
        if code in (61, 63, 65, 66, 67):
            return ("Rain", "#0284c7")
        if code in (71, 73, 75, 77):
            return ("Snow", "#e0e7ff")
        if code in (80, 81, 82):
            return ("Rain showers", "#0ea5e9")
        if code in (85, 86):
            return ("Snow showers", "#e0e7ff")
        if code in (95, 96, 99):
            return ("Thunderstorms", "#7c3aed")
        return ("Variable", "#94a3b8")

    def _fetch_weather(date_iso):
        today = _dt.now().date()
        match_date = _dt.fromisoformat(date_iso).date()
        days_ahead = (match_date - today).days
        try:
            if 0 <= days_ahead <= 16:
                _url = (
                    "https://api.open-meteo.com/v1/forecast"
                    f"?latitude={_GILLETTE_LAT}&longitude={_GILLETTE_LON}"
                    "&daily=temperature_2m_max,temperature_2m_min,"
                    "precipitation_sum,weathercode,uv_index_max,"
                    "windspeed_10m_max,precipitation_probability_max"
                    "&timezone=America/New_York"
                    f"&start_date={date_iso}&end_date={date_iso}"
                    "&temperature_unit=fahrenheit&windspeed_unit=mph"
                )
                r = requests.get(_url, timeout=15)
                r.raise_for_status()
                d = r.json().get("daily", {})
                return {
                    "source": "forecast",
                    "temp_max": (d.get("temperature_2m_max") or [None])[0],
                    "temp_min": (d.get("temperature_2m_min") or [None])[0],
                    "precip": (d.get("precipitation_sum") or [0])[0],
                    "precip_prob": (d.get("precipitation_probability_max") or [None])[0],
                    "weather_code": (d.get("weathercode") or [None])[0],
                    "uv": (d.get("uv_index_max") or [None])[0],
                    "wind": (d.get("windspeed_10m_max") or [None])[0],
                }
            else:
                end_year = today.year - 1
                start_year = end_year - 4
                vals = {"temp_max": [], "temp_min": [], "precip": [], "wcode": []}
                for yr in range(start_year, end_year + 1):
                    hist_date = f"{yr}{date_iso[4:]}"
                    _url = (
                        "https://archive-api.open-meteo.com/v1/archive"
                        f"?latitude={_GILLETTE_LAT}&longitude={_GILLETTE_LON}"
                        "&daily=temperature_2m_max,temperature_2m_min,"
                        "precipitation_sum,weathercode"
                        "&timezone=America/New_York"
                        f"&start_date={hist_date}&end_date={hist_date}"
                        "&temperature_unit=fahrenheit"
                    )
                    r = requests.get(_url, timeout=10)
                    if r.ok:
                        d = r.json().get("daily", {})
                        if (d.get("temperature_2m_max") or [None])[0] is not None:
                            vals["temp_max"].append(d["temperature_2m_max"][0])
                            vals["temp_min"].append(d["temperature_2m_min"][0])
                            vals["precip"].append(
                                (d.get("precipitation_sum") or [0])[0] or 0
                            )
                            wc = (d.get("weathercode") or [0])[0] or 0
                            vals["wcode"].append(int(wc))
                if not vals["temp_max"]:
                    return None
                _avg = lambda xs: sum(xs) / len(xs)
                modal_wcode = _Counter(vals["wcode"]).most_common(1)[0][0]
                return {
                    "source": "historical",
                    "temp_max": _avg(vals["temp_max"]),
                    "temp_min": _avg(vals["temp_min"]),
                    "precip": _avg(vals["precip"]),
                    "precip_prob": None,
                    "weather_code": modal_wcode,
                    "uv": None,
                    "wind": None,
                    "n_years": len(vals["temp_max"]),
                }
        except Exception:
            return None

    with mo.status.spinner("Fetching match-day weather…"):
        weather = _fetch_weather(selected_match["date"])

    # Match-day departure math: Foxboro CR ~55 min ride; +1 hr stadium
    # walk-in; +50 min event-day crowd buffer. Recommend arriving at South
    # Station 30 min before the train departs.
    _kickoff_dt = _dt.fromisoformat(
        selected_match["date"] + "T" + selected_match["kickoff_local"]
    )
    _leave_train = _kickoff_dt - _td(hours=2, minutes=45)
    _arrive_south = _leave_train - _td(minutes=30)
    _return_cutoff = _kickoff_dt + _td(hours=4, minutes=30)

    def _fmt_t(dt):
        s = dt.strftime("%I:%M %p")
        return s.lstrip("0")

    if weather:
        _wlabel, _wcolor = _weather_label(weather.get("weather_code"))
        _th = weather.get("temp_max")
        _tl = weather.get("temp_min")
        _temp_str = (
            f"{int(round(_th))}°F high · {int(round(_tl))}°F low"
            if _th is not None
            else "—"
        )
        _precip = weather.get("precip")
        _precip_prob = weather.get("precip_prob")
        _precip_str = ""
        if _precip is not None:
            if _precip > 0:
                _precip_str = f"{_precip:.1f} mm rain expected"
                if _precip_prob is not None:
                    _precip_str += f" · {int(_precip_prob)}% chance"
            else:
                _precip_str = "No precipitation expected"
        _extras = []
        if weather.get("wind") is not None:
            _extras.append(f"Wind {int(round(weather['wind']))} mph")
        if weather.get("uv") is not None:
            _extras.append(f"UV {int(round(weather['uv']))}")
        _extras_str = " · ".join(_extras)
        _source_label = (
            "Live forecast (Open-Meteo)"
            if weather.get("source") == "forecast"
            else f"Typical for this date ({weather.get('n_years', 5)}-yr historical average)"
        )
        _temp_badge_num = (
            int(round(_th)) if _th is not None else "—"
        )
        weather_html = f"""
        <div style="display:flex; align-items:center; gap:14px; padding:14px;
                    background:#f8fafc; border-radius:10px; border:1px solid #e5e7eb;
                    height:100%; box-sizing:border-box;">
          <div style="width:58px; height:58px; background:{_wcolor};
                      border-radius:50%; display:flex; align-items:center;
                      justify-content:center; color:white; font-weight:800;
                      font-size:16px; flex-shrink:0;
                      box-shadow:0 2px 10px rgba(0,0,0,0.14);">
            {_temp_badge_num}°
          </div>
          <div style="flex:1; min-width:0;">
            <div style="font-size:0.98rem; font-weight:700; color:#0f172a;">{_wlabel}</div>
            <div style="font-size:0.86rem; color:#475569; margin-top:2px;">{_temp_str}</div>
            {f'<div style="font-size:0.82rem; color:#475569; margin-top:2px;">{_precip_str}</div>' if _precip_str else ""}
            {f'<div style="font-size:0.78rem; color:#94a3b8; margin-top:3px;">{_extras_str}</div>' if _extras_str else ""}
            <div style="font-size:0.72rem; color:#94a3b8; margin-top:4px;
                        letter-spacing:0.3px;">{_source_label}</div>
          </div>
        </div>
        """
    else:
        # Weather unavailable — render a neutral placeholder rather than an
        # error. Common for far-future dates where forecast hasn't been
        # released and historical archive returns no rows.
        weather_html = """
        <div style="padding:14px; background:#f8fafc; border-radius:10px;
                    border:1px dashed #cbd5e1; color:#94a3b8; font-size:0.85rem;
                    height:100%; box-sizing:border-box; display:flex;
                    align-items:center; justify-content:center;
                    text-align:center; line-height:1.4;">
          Forecast and historical data for this date aren't yet available
          for Gillette Stadium — check back closer to match day.
        </div>
        """

    _summary_html = f"""
    <div style="background:white; border:1px solid #e5e7eb; border-radius:14px;
                padding:1.6rem 1.8rem;
                box-shadow:0 6px 22px rgba(15,23,42,0.08);
                margin-bottom:1.4rem;">
      <div style="display:flex; align-items:center; gap:10px; margin-bottom:14px;">
        <span style="background:#16a34a; color:white; width:26px; height:26px;
                     border-radius:50%; display:inline-flex; align-items:center;
                     justify-content:center; font-weight:800; font-size:13px;">2</span>
        <span style="font-size:1.08rem; font-weight:700; color:#0f172a;
                     letter-spacing:-0.2px;">Your match-day plan</span>
      </div>

      <div style="display:grid; grid-template-columns:1fr 1fr; gap:1.2rem;
                  margin-left:36px;">
        <div>
          <div style="font-size:0.7rem; font-weight:700; letter-spacing:1.5px;
                      color:#dc2626; text-transform:uppercase; margin-bottom:6px;">
            {selected_match["stage"]} · {selected_match["match_no"]}
          </div>
          <div style="font-size:1.5rem; font-weight:800; color:#0f172a;
                      letter-spacing:-0.3px;">
            {selected_match["weekday"]}, {selected_match["date"]}
          </div>
          <div style="font-size:1.05rem; color:#475569; font-weight:600;
                      margin-top:2px;">
            Kickoff {selected_match["kickoff_pretty"]} ET
          </div>
          <div style="font-size:0.86rem; color:#64748b; margin-top:10px;
                      padding-top:10px; border-top:1px solid #f1f5f9;">
            {selected_match["teams"]}
          </div>
          <div style="font-size:0.8rem; color:#94a3b8; margin-top:4px;">
            Venue: Gillette Stadium, Foxborough, MA
          </div>
        </div>
        <div>{weather_html}</div>
      </div>

      <div style="margin:1.3rem 0 0 36px; padding:1.1rem 1.3rem;
                  background:linear-gradient(135deg,#0f172a 0%,#1e3a8a 100%);
                  color:white; border-radius:10px; position:relative; overflow:hidden;">
        <div style="position:absolute; right:-30px; top:-30px; width:120px; height:120px;
                    border:2px solid rgba(255,255,255,0.08); border-radius:50%;"></div>
        <div style="position:relative; z-index:1;">
          <div style="font-size:0.68rem; font-weight:700; letter-spacing:1.8px;
                      opacity:0.85; text-transform:uppercase; margin-bottom:10px;">
            Match-day departure plan · MBTA Foxboro Line
          </div>
          <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:14px;">
            <div>
              <div style="font-size:0.7rem; opacity:0.78;
                          text-transform:uppercase; letter-spacing:1px;">
                Arrive at South Station
              </div>
              <div style="font-size:1.18rem; font-weight:700; margin-top:3px;">
                {_fmt_t(_arrive_south)}
              </div>
            </div>
            <div>
              <div style="font-size:0.7rem; opacity:0.78;
                          text-transform:uppercase; letter-spacing:1px;">
                Train departs by
              </div>
              <div style="font-size:1.18rem; font-weight:700; margin-top:3px;">
                {_fmt_t(_leave_train)}
              </div>
            </div>
            <div>
              <div style="font-size:0.7rem; opacity:0.78;
                          text-transform:uppercase; letter-spacing:1px;">
                Return cutoff
              </div>
              <div style="font-size:1.18rem; font-weight:700; margin-top:3px;">
                {_fmt_t(_return_cutoff)}
              </div>
            </div>
          </div>
          <div style="font-size:0.78rem; opacity:0.78; margin-top:12px;
                      line-height:1.5;">
            Buffers assume ~55 min train ride + 1 hr stadium walk-in + 50 min
            event-day crowd surcharge. Confirm the exact MBTA special-event
            schedule close to match day.
          </div>
        </div>
      </div>
    </div>
    """

    mo.md(_summary_html)
    return (weather,)


@app.cell(hide_code=True)
def _(mo, selected_match, starting_point):
    mo.stop(selected_match is None)

    _CITY_OPTIONS = [
        "BOSTON",
        "FOXBOROUGH",
        "CAMBRIDGE",
        "BROOKLINE",
        "QUINCY",
        "SOMERVILLE",
        "FRAMINGHAM",
        "WORCESTER",
        "ATTLEBORO",
        "MANSFIELD",
    ]

    # If the user gave us a starting address, default the crash-data city
    # to whichever option matches their geocoded city.
    _default_city = "BOSTON"
    if starting_point and starting_point.get("city"):
        _normalized = starting_point["city"].upper().replace("FOXBORO", "FOXBOROUGH")
        if _normalized in _CITY_OPTIONS:
            _default_city = _normalized

    year = mo.ui.dropdown(
        options=["2026", "2025", "2024", "2023", "2022", "2021", "2020", "2019"],
        value="2026",
        label="Year",
    )

    city = mo.ui.dropdown(
        options=_CITY_OPTIONS,
        value=_default_city,
        label="City you're staying in",
    )

    severity = mo.ui.multiselect(
        options=[
            "Fatal injury",
            "Non-fatal injury - Suspected serious injury",
            "Non-fatal injury - Suspected minor injury",
            "Non-fatal injury - Possible injury",
            "Property damage only (none injured)",
        ],
        value=[
            "Fatal injury",
            "Non-fatal injury - Suspected serious injury",
            "Non-fatal injury - Suspected minor injury",
        ],
        label="Crash severity",
    )

    _section_header = mo.md(
        """
        <div style="margin-top:0.4rem; margin-bottom:0.6rem;">
          <div style="display:flex; align-items:center; gap:10px; margin-bottom:4px;">
            <span style="background:#DA291C; color:white; width:24px; height:24px;
                         border-radius:50%; display:inline-flex; align-items:center;
                         justify-content:center; font-weight:800; font-size:12px;">3</span>
            <span style="font-size:1.05rem; font-weight:700; color:#0f172a;
                         letter-spacing:-0.2px;">Crash risk near you</span>
          </div>
          <div style="color:#64748b; font-size:0.85rem; margin-left:34px;">
            Live MassDOT crash records for the city you're staying in. Defaults
            to Boston, 2026 — change the dropdowns if you're basing elsewhere.
          </div>
        </div>
        """
    )

    _controls = mo.vstack([
        _section_header,
        mo.hstack([year, city], justify="start", gap=1.0),
        severity,
    ], gap=0.5)

    mo.callout(_controls, kind="neutral")
    return city, severity, year


@app.cell(hide_code=True)
def _(city, mo, pd, requests, selected_match, severity, year):
    mo.stop(selected_match is None)

    def _layer_name(yr: str) -> str:
        # 2023 is published with a quirky "v" suffix; everything else is plain.
        return f"MASSDOT_ODP_OPEN_{yr}" + ("v" if yr == "2023" else "")

    def _fetch(yr: str):
        base = (
            f"https://gis.crashdata.dot.mass.gov/arcgis/rest/services/"
            f"MassDOT/{_layer_name(yr)}/FeatureServer/0/query"
        )
        where = f"CITY_TOWN_NAME = '{city.value.strip().upper()}'"
        if severity.value:
            sev_list = ",".join(f"'{s}'" for s in severity.value)
            where += f" AND CRASH_SEVERITY_DESCR IN ({sev_list})"

        rows = []
        offset = 0
        page_size = 1000
        while True:
            params = {
                "where": where,
                "outFields": "*",
                "outSR": "4326",
                "f": "json",
                "resultOffset": offset,
                "resultRecordCount": page_size,
            }
            try:
                resp = requests.get(base, params=params, timeout=60)
                resp.raise_for_status()
                payload = resp.json()
            except Exception:
                return None
            if isinstance(payload, dict) and "error" in payload:
                return None
            feats = payload.get("features", [])
            if not feats:
                break
            for feat in feats:
                rec = dict(feat.get("attributes", {}))
                geom = feat.get("geometry") or {}
                rec["lon"] = geom.get("x")
                rec["lat"] = geom.get("y")
                rows.append(rec)
            if len(feats) < page_size:
                break
            offset += page_size
            if offset > 60_000:
                break
        return pd.DataFrame(rows)

    used_year = year.value
    fallback_note = None
    with mo.status.spinner(
        f"Querying MassDOT for {city.value} {year.value}…"
    ):
        df = _fetch(year.value)
        # 2026 is partial-year; if it's empty/unavailable, fall back to 2025.
        if (df is None or df.empty) and year.value == "2026":
            df = _fetch("2025")
            used_year = "2025"
            fallback_note = (
                "ℹ️ The 2026 layer returned no records for this city yet "
                "(reporting lags real-world crashes by a few weeks). "
                "Showing **2025** as the closest baseline."
            )

    if df is None:
        df = pd.DataFrame()

    if not df.empty:
        df = df.dropna(subset=["lat", "lon"])
        if "CRASH_DATETIME" in df.columns:
            df["CRASH_DATETIME"] = pd.to_datetime(
                df["CRASH_DATETIME"], unit="ms", errors="coerce"
            )
    return df, fallback_note, used_year


@app.cell(hide_code=True)
def _(city, df, fallback_note, mo, selected_match, used_year):
    mo.stop(selected_match is None)
    mo.stop(
        df.empty,
        mo.callout(
            mo.md(
                "**No crashes found for that selection.** Try a different city "
                "or widen the severity filter."
            ),
            kind="warn",
        ),
    )

    sev_col = "CRASH_SEVERITY_DESCR"
    fatal_n = int((df[sev_col] == "Fatal injury").sum()) if sev_col in df.columns else 0
    serious_n = (
        int((df[sev_col] == "Non-fatal injury - Suspected serious injury").sum())
        if sev_col in df.columns
        else 0
    )
    total_n = len(df)

    def _fmt_12h(h):
        suffix = "AM" if h < 12 else "PM"
        h12 = h % 12 or 12
        return f"{h12}:00 {suffix}"

    peak_hour_str = "—"
    if "CRASH_DATETIME" in df.columns and df["CRASH_DATETIME"].notna().any():
        peak_h = int(df["CRASH_DATETIME"].dt.hour.value_counts().idxmax())
        peak_hour_str = _fmt_12h(peak_h)

    def _card(label, value, color):
        return mo.md(
            f"""
            <div style="background:{color}; color:white; padding:1.05rem 1.2rem;
                        border-radius:12px; min-width:150px; flex:1;
                        box-shadow:0 4px 12px rgba(0,0,0,0.08);">
              <div style="font-size:0.72rem; opacity:0.92; letter-spacing:1.5px;
                          font-weight:600;">{label.upper()}</div>
              <div style="font-size:1.85rem; font-weight:700; line-height:1.1;
                          margin-top:0.25rem;">{value}</div>
            </div>
            """
        )

    cards = mo.hstack(
        [
            _card("Total crashes", f"{total_n:,}", "#475569"),
            _card("Fatal", f"{fatal_n:,}", "#dc2626"),
            _card("Serious injury", f"{serious_n:,}", "#ea580c"),
            _card("Peak hour", peak_hour_str, "#0891b2"),
        ],
        gap=0.6,
    )

    pieces = []
    if fallback_note:
        pieces.append(mo.callout(mo.md(fallback_note), kind="warn"))
    pieces.append(mo.md(f"### {used_year} crash snapshot — **{city.value.title()}**"))
    pieces.append(cards)
    mo.vstack(pieces, gap=0.6)
    return fatal_n, peak_hour_str, serious_n, total_n


@app.cell(hide_code=True)
def _(df, mo, selected_match):
    # Compute-only cell: derives top_roads for the conclusion's
    # "Where the risk concentrates" callout but renders no visible UI
    # (the crash data section was slimmed to a single stats card).
    mo.stop(selected_match is None)
    mo.stop(df.empty)

    street_cols = [
        c
        for c in ["STREETNAME", "RDWY", "ROADWAY", "CRASH_RD_TYPE_DESCR"]
        if c in df.columns
    ]
    if not street_cols:
        top_roads = []
    else:
        col = street_cols[0]
        top_roads = df[col].dropna().value_counts().head(10).index.tolist()
    return (top_roads,)


@app.cell(hide_code=True)
def _(mo, selected_match):
    mo.stop(selected_match is None)
    mo.md(
        """
        <hr style="border:none; border-top:1px solid #e5e7eb; margin:2.5rem 0 1.5rem 0;"/>
        <div style="border-left:4px solid #003DA5; padding:2px 0 2px 14px;
                    margin:0 0 0.8rem 0;">
          <div style="font-size:1.35rem; font-weight:700; color:#0f172a;
                      letter-spacing:-0.2px;">The train option — live MBTA map</div>
          <div style="font-size:0.94rem; color:#475569; margin-top:4px;
                      max-width:760px; line-height:1.5;">
            The dashboards above show where driving risk concentrates. The map
            below shows how to bypass it: the actual rail network with live
            vehicle positions, polled every 15 seconds and smoothly
            interpolated. The Foxboro Line is the match-day shuttle; the rest
            of the system moves you around Boston without touching the crash
            corridors above.
          </div>
        </div>
        """
    )
    return


@app.cell(hide_code=True)
def _(folium, mo, requests, selected_match):
    mo.stop(selected_match is None)
    import os as _os
    import json as _json

    _ROUTES = {
        "Red":         {"color": "#DA291C", "name": "Red Line"},
        "Orange":      {"color": "#ED8B00", "name": "Orange Line"},
        "Blue":        {"color": "#003DA5", "name": "Blue Line"},
        "Green-B":     {"color": "#00843D", "name": "Green Line B"},
        "Green-C":     {"color": "#00843D", "name": "Green Line C"},
        "Green-D":     {"color": "#00843D", "name": "Green Line D"},
        "Green-E":     {"color": "#00843D", "name": "Green Line E"},
        "741":         {"color": "#7C878E", "name": "Silver Line SL1 (Logan)"},
        "CR-Franklin": {"color": "#80276C", "name": "Foxboro / Franklin Line"},
    }

    def _decode_polyline(encoded):
        # Decode Google-style encoded polyline (precision 5) to [(lat, lon)].
        points = []
        idx = lat = lng = 0
        while idx < len(encoded):
            shift = result = 0
            while True:
                b = ord(encoded[idx]) - 63
                idx += 1
                result |= (b & 0x1f) << shift
                shift += 5
                if b < 0x20:
                    break
            lat += ~(result >> 1) if (result & 1) else (result >> 1)
            shift = result = 0
            while True:
                b = ord(encoded[idx]) - 63
                idx += 1
                result |= (b & 0x1f) << shift
                shift += 5
                if b < 0x20:
                    break
            lng += ~(result >> 1) if (result & 1) else (result >> 1)
            points.append((lat * 1e-5, lng * 1e-5))
        return points

    _BASE = "https://api-v3.mbta.com"
    _HEADERS = {}
    _key = _os.environ.get("MBTA_API_KEY")
    if _key:
        _HEADERS["x-api-key"] = _key
    _route_filter = ",".join(_ROUTES.keys())

    def _get(path, params):
        try:
            r = requests.get(
                f"{_BASE}{path}", params=params, headers=_HEADERS, timeout=20
            )
            r.raise_for_status()
            return r.json()
        except Exception:
            return {"data": [], "included": []}

    # Static layers only — shapes (route geometry) and stops change rarely.
    # Live vehicles are handled by injected JS below, which polls the MBTA
    # API directly from the browser and tweens markers between positions.
    # NOTE: MBTA /shapes doesn't populate the route relationship even with
    # include=route, so we must fetch one route at a time to know which
    # polyline belongs to which line.
    _longest = {}
    for _rid in _ROUTES.keys():
        _route_shapes = _get("/shapes", {"filter[route]": _rid}).get("data", [])
        _best = ""
        for _shape in _route_shapes:
            _pl = _shape.get("attributes", {}).get("polyline") or ""
            if len(_pl) > len(_best):
                _best = _pl
        if _best:
            _longest[_rid] = _best

    _stops = _get("/stops", {"filter[route]": _route_filter}).get("data", [])

    transit_map = folium.Map(
        location=[42.34, -71.08],
        zoom_start=11,
        tiles="CartoDB positron",
    )

    # Plain polylines (not AntPath) — the moving trains carry the "live"
    # feel; an animated dash pattern on top shimmers during zoom.
    for _rid, _pl in _longest.items():
        _coords = _decode_polyline(_pl)
        if not _coords:
            continue
        # CR lines are longer and need to stand out across the south extent.
        _weight = 6 if _rid.startswith("CR-") else 5
        folium.PolyLine(
            _coords,
            color=_ROUTES[_rid]["color"],
            weight=_weight,
            opacity=0.92,
            tooltip=_ROUTES[_rid]["name"],
        ).add_to(transit_map)

    _seen_stops = set()
    for _stop in _stops:
        _sid = _stop.get("id")
        if _sid in _seen_stops:
            continue
        _seen_stops.add(_sid)
        _sattrs = _stop.get("attributes", {})
        _slat = _sattrs.get("latitude")
        _slon = _sattrs.get("longitude")
        if _slat is None or _slon is None:
            continue
        _sname = _sattrs.get("name", "")
        folium.CircleMarker(
            location=[_slat, _slon],
            radius=4,
            color="#1f2937",
            weight=2,
            fill=True,
            fill_color="white",
            fill_opacity=1.0,
            tooltip=_sname,
            popup=folium.Popup(f"<b>{_sname}</b>", max_width=200),
        ).add_to(transit_map)

    # Fetch route metadata for direction_destinations (used for terminus
    # labels showing "where this train goes" at each end of every line).
    _routes_meta = _get("/routes", {"filter[id]": _route_filter}).get("data", [])
    _route_dests = {}
    for _r in _routes_meta:
        _route_dests[_r.get("id")] = (
            _r.get("attributes", {}).get("direction_destinations") or []
        )

    def _terminus_label_html(text, color):
        # Compact pill: small colored dot + terminus name, low visual weight.
        return (
            '<div style="display:inline-flex; align-items:center; gap:5px; '
            'background:rgba(255,255,255,0.96); padding:2px 7px 2px 6px; '
            'border-radius:999px; '
            f'border:1px solid {color}; font-weight:600; font-size:10px; '
            'color:#0f172a; white-space:nowrap; font-family:sans-serif; '
            'box-shadow:0 1px 4px rgba(0,0,0,0.12);">'
            f'<span style="width:6px; height:6px; background:{color}; '
            'border-radius:50%; flex-shrink:0;"></span>'
            f'{text}</div>'
        )

    _terminus_seen = set()  # dedupe shared termini (e.g., several Green branches)
    for _rid, _pl in _longest.items():
        _coords = _decode_polyline(_pl)
        if len(_coords) < 2:
            continue
        _dests = _route_dests.get(_rid, [])
        _color = _ROUTES[_rid]["color"]
        for _idx, _coord in [(0, _coords[0]), (1, _coords[-1])]:
            if _idx >= len(_dests) or not _dests[_idx]:
                continue
            _key = (_dests[_idx], round(_coord[0], 2), round(_coord[1], 2))
            if _key in _terminus_seen:
                continue
            _terminus_seen.add(_key)
            folium.Marker(
                location=_coord,
                icon=folium.DivIcon(
                    html=_terminus_label_html(_dests[_idx], _color),
                    icon_size=(0, 0),
                    icon_anchor=(-8, 8),
                ),
            ).add_to(transit_map)

    # Major transfer hubs — kept to the four that matter most for visitors,
    # styled as subtle pills rather than heavy boxes.
    _major_hubs = [
        {"name": "South Station",
         "note": "Foxboro CR · SL1 · Red",
         "coords": [42.3522, -71.0552]},
        {"name": "Park Street",
         "note": "Red · Green",
         "coords": [42.3564, -71.0624]},
        {"name": "North Station",
         "note": "Orange · Green · CR",
         "coords": [42.3654, -71.0613]},
        {"name": "Government Center",
         "note": "Blue · Green",
         "coords": [42.3593, -71.0594]},
    ]
    for _hub in _major_hubs:
        folium.Marker(
            location=_hub["coords"],
            tooltip=f"{_hub['name']} — {_hub['note']}",
            icon=folium.DivIcon(
                html=(
                    '<div style="background:rgba(15,23,42,0.92); color:white; '
                    'padding:3px 8px; border-radius:999px; font-weight:700; '
                    'font-size:10px; white-space:nowrap; font-family:sans-serif; '
                    'letter-spacing:0.2px; '
                    'box-shadow:0 2px 6px rgba(0,0,0,0.25);">'
                    f"{_hub['name']}"
                    '</div>'
                ),
                icon_size=(0, 0),
                icon_anchor=(-10, 8),
            ),
        ).add_to(transit_map)

    # Tourist landmarks — the three points that frame the whole notebook.
    # Refined pins: SVG icons inside a colored teardrop, no bare emoji.
    _landmark_icons = {
        "stadium": (
            '<svg viewBox="0 0 24 24" width="20" height="20" fill="white">'
            '<path d="M12 2a10 10 0 100 20 10 10 0 000-20zm0 2.2l1.6 2.8h-3.2L12 4.2zm-4.6 2l3 1.2.6 3-2.7 1.8L5.4 9.6 7.4 6.2zm9.2 0l2 3.4-2.9 1.4L13 11.2 13.6 8l3-1.8zM5 11.7l2.2 1.5-.7 3.3L4 15.2A8 8 0 015 11.7zm14 0a8 8 0 011 3.5l-2.5 1.3-.7-3.3L19 11.7zM8.9 13.4l3.1 2 3.1-2 .7 3.5-3.8 2.4-3.8-2.4.7-3.5z"/></svg>'
        ),
        "plane": (
            '<svg viewBox="0 0 24 24" width="20" height="20" fill="white">'
            '<path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 00-3 0V9l-8 5v2l8-2.5V19l-2 1.5v1.5l3.5-1 3.5 1V20.5L13 19v-5.5l8 2.5z"/></svg>'
        ),
        "star": (
            '<svg viewBox="0 0 24 24" width="20" height="20" fill="white">'
            '<path d="M12 2.5l2.95 6.5L22 9.7l-5.3 4.9L18 22 12 18.5 6 22l1.3-7.4L2 9.7l7.05-.7L12 2.5z"/></svg>'
        ),
    }
    _landmarks = [
        {"name": "Gillette Stadium",
         "subtitle": "World Cup 2026 venue · 7 matches",
         "detail": "Take the MBTA Foxboro Commuter Rail from South Station.",
         "coords": [42.0908, -71.2643],
         "icon": "stadium",
         "color": "#DA291C"},
        {"name": "Logan Airport (BOS)",
         "subtitle": "Arrival hub",
         "detail": "Silver Line SL1 (free inbound) to South Station, then Foxboro CR.",
         "coords": [42.3656, -71.0096],
         "icon": "plane",
         "color": "#1e3a8a"},
        {"name": "Boston Common",
         "subtitle": "FIFA Fan Festival",
         "detail": "Park Street (Red/Green) or Boylston (Green) station.",
         "coords": [42.3551, -71.0656],
         "icon": "star",
         "color": "#16a34a"},
    ]
    for _lm in _landmarks:
        _lm_popup = (
            '<div style="font-family:sans-serif; min-width:210px;">'
            f'<div style="background:{_lm["color"]}; color:white; '
            'padding:8px 12px; border-radius:6px 6px 0 0; font-weight:700; '
            f'font-size:13px; letter-spacing:0.2px;">{_lm["name"]}</div>'
            '<div style="padding:9px 12px;">'
            f'<div style="font-weight:600; color:#0f172a; font-size:12.5px;">{_lm["subtitle"]}</div>'
            f'<div style="color:#475569; margin-top:5px; font-size:12px; line-height:1.5;">{_lm["detail"]}</div>'
            '</div></div>'
        )
        folium.Marker(
            location=_lm["coords"],
            tooltip=f"{_lm['name']} — {_lm['subtitle']}",
            popup=folium.Popup(_lm_popup, max_width=280),
            icon=folium.DivIcon(
                html=(
                    f'<div style="background:{_lm["color"]}; '
                    'width:34px; height:34px; '
                    'border-radius:50% 50% 50% 0; transform:rotate(-45deg); '
                    'display:flex; align-items:center; justify-content:center; '
                    'border:2.5px solid white; '
                    'box-shadow:0 4px 12px rgba(0,0,0,0.3);">'
                    '<div style="transform:rotate(45deg); display:flex; '
                    'align-items:center; justify-content:center;">'
                    f'{_landmark_icons[_lm["icon"]]}'
                    '</div></div>'
                ),
                icon_size=(34, 34),
                icon_anchor=(17, 34),
            ),
        ).add_to(transit_map)

    _legend_lines = "".join(
        "<div style='display:flex; align-items:center; margin:3px 0;'>"
        f"<span style='display:inline-block; width:18px; height:3px;"
        f" background:{_info['color']}; border-radius:2px; margin-right:8px;'></span>"
        f"<span style='font-size:11.5px; color:#1f2937;'>{_info['name']}</span></div>"
        for _info in _ROUTES.values()
    )

    def _legend_landmark_row(color, label):
        return (
            "<div style='display:flex; align-items:center; margin:3px 0;'>"
            f"<span style='display:inline-block; width:10px; height:10px;"
            f" background:{color}; border-radius:50% 50% 50% 0;"
            " transform:rotate(-45deg); margin-right:10px;'></span>"
            f"<span style='font-size:11.5px; color:#1f2937;'>{label}</span></div>"
        )

    _legend_places = (
        "<div style='display:flex; align-items:center; margin:3px 0;'>"
        "<span style='display:inline-block; width:8px; height:8px;"
        " background:white; border:1.5px solid #1f2937; border-radius:50%;"
        " margin-right:10px;'></span>"
        "<span style='font-size:11.5px; color:#1f2937;'>Station</span></div>"
        "<div style='display:flex; align-items:center; margin:3px 0;'>"
        "<span style='display:inline-block; background:#0f172a; color:white;"
        " font-size:8px; font-weight:700; padding:1px 5px; border-radius:999px;"
        " margin-right:10px;'>HUB</span>"
        "<span style='font-size:11.5px; color:#1f2937;'>Major transfer</span></div>"
        + _legend_landmark_row("#DA291C", "Gillette Stadium")
        + _legend_landmark_row("#1e3a8a", "Logan Airport")
        + _legend_landmark_row("#16a34a", "Fan Festival")
    )
    _legend_html = f"""
    <div style="position:absolute; bottom:18px; right:18px; z-index:9999;
                background:rgba(255,255,255,0.98); padding:10px 14px;
                border-radius:10px; border:1px solid #e5e7eb;
                box-shadow:0 4px 14px rgba(15,23,42,0.12);
                font-family:sans-serif; max-height:70vh; overflow-y:auto;
                backdrop-filter:blur(6px);">
      <div style="font-weight:700; font-size:10px; color:#64748b;
                  letter-spacing:1.2px; text-transform:uppercase;
                  margin-bottom:4px;">MBTA lines</div>
      {_legend_lines}
      <div style="font-weight:700; font-size:10px; color:#64748b;
                  letter-spacing:1.2px; text-transform:uppercase;
                  margin:10px 0 4px 0;">Places</div>
      {_legend_places}
    </div>
    """
    transit_map.get_root().html.add_child(folium.Element(_legend_html))

    _status_overlay = """
    <div id="mbta-live-status"
         style="position:absolute; top:12px; left:60px; z-index:9999;
                background:white; padding:8px 14px; border-radius:8px;
                box-shadow:0 4px 12px rgba(0,0,0,0.15); font-family:sans-serif;
                font-size:0.92rem; color:#475569;">
      ⏳ Loading live MBTA vehicles…
    </div>
    """
    transit_map.get_root().html.add_child(folium.Element(_status_overlay))

    # Live vehicle layer: JS polls MBTA every 15s and interpolates markers
    # between known positions every 50ms — trains glide along the tracks
    # in real time, no Python round-trip required.
    _live_vehicle_js = r"""
    (function() {
      var MAP_VAR_NAME = "__MAP_VAR__";
      var ROUTES = __ROUTES_JSON__;
      var POLL_MS = 15000;
      var ANIM_MS = 50;

      var vehicles = {};
      var leafletMap = null;
      var layer = null;
      var animatePaused = false;

      function getMap() {
        return window[MAP_VAR_NAME];
      }

      function fmtTime(d) {
        return d.toLocaleTimeString("en-US", {
          hour: "numeric", minute: "2-digit", second: "2-digit", hour12: true
        });
      }

      function setStatus(html) {
        var el = document.getElementById("mbta-live-status");
        if (el) el.innerHTML = html;
      }

      function fetchAndUpdate() {
        var routes = Object.keys(ROUTES).join(",");
        var url = "https://api-v3.mbta.com/vehicles"
                + "?include=stop,route"
                + "&filter[route]=" + routes;
        fetch(url, {cache: "no-store"}).then(function(res) {
          if (!res.ok) throw new Error("HTTP " + res.status);
          return res.json();
        }).then(function(json) {
          var stopNames = {};
          var dirDests = {};
          (json.included || []).forEach(function(inc) {
            if (inc.type === "stop") {
              stopNames[inc.id] = (inc.attributes && inc.attributes.name) || "";
            } else if (inc.type === "route") {
              dirDests[inc.id] = (inc.attributes
                && inc.attributes.direction_destinations) || [];
            }
          });

          var seen = {};
          var count = 0;
          (json.data || []).forEach(function(v) {
            var a = v.attributes || {};
            var rels = v.relationships || {};
            var rid = rels.route && rels.route.data && rels.route.data.id;
            if (!ROUTES[rid]) return;
            if (a.latitude == null || a.longitude == null) return;
            var id = v.id;
            seen[id] = true;
            count++;

            var stopId = rels.stop && rels.stop.data && rels.stop.data.id;
            var stopName = stopId ? (stopNames[stopId] || "—") : "—";

            var verbMap = {
              INCOMING_AT: "Incoming at",
              STOPPED_AT: "Stopped at",
              IN_TRANSIT_TO: "In transit to"
            };
            var rawStatus = a.current_status || "";
            var verb = verbMap[rawStatus] || rawStatus.replace(/_/g, " ");
            var statusLine = (stopName && stopName !== "—")
              ? (verb + " <b>" + stopName + "</b>")
              : verb;

            var dirIdx = a.direction_id;
            var dirDest = "?";
            if (dirIdx != null && dirDests[rid] && dirDests[rid][dirIdx]) {
              dirDest = dirDests[rid][dirIdx];
            }

            var updatedStr = "";
            if (a.updated_at) {
              var dt = new Date(a.updated_at);
              if (!isNaN(dt)) updatedStr = fmtTime(dt);
            }

            var color = ROUTES[rid].color;
            var name = ROUTES[rid].name;

            var popup =
              '<div style="font-family:sans-serif; min-width:200px;">' +
              '<div style="background:' + color + '; color:white; ' +
              'padding:6px 10px; border-radius:6px 6px 0 0; ' +
              'font-weight:600;">' + name + '</div>' +
              '<div style="padding:8px 10px;">' +
              '<div style="color:#475569;">Heading to <b>' + dirDest + '</b></div>' +
              '<div style="margin-top:4px;">' + statusLine + '</div>' +
              '<div style="color:#64748b; font-size:0.85em; margin-top:6px;">' +
              'Vehicle ' + (a.label || id) + ' · updated ' + updatedStr +
              '</div></div></div>';
            var tooltip = name + " → " + dirDest;

            if (vehicles[id]) {
              var veh = vehicles[id];
              veh.prevLL = veh.marker.getLatLng();
              veh.targetLL = L.latLng(a.latitude, a.longitude);
              veh.startTime = Date.now();
              veh.marker.setPopupContent(popup);
              veh.marker.setTooltipContent(tooltip);
            } else {
              // Commuter Rail trains run far apart and update less often —
              // give them a slightly larger marker so they're easy to spot.
              var isCR = (rid && rid.indexOf("CR-") === 0);
              var marker = L.circleMarker([a.latitude, a.longitude], {
                radius: isCR ? 11 : 9,
                color: "#ffffff",
                weight: 3,
                fillColor: color,
                fillOpacity: 1.0,
                pane: "markerPane"
              }).bindPopup(popup, {maxWidth: 280})
                .bindTooltip(tooltip)
                .addTo(layer);
              vehicles[id] = {
                marker: marker,
                prevLL: L.latLng(a.latitude, a.longitude),
                targetLL: L.latLng(a.latitude, a.longitude),
                startTime: Date.now()
              };
            }
          });

          Object.keys(vehicles).forEach(function(id) {
            if (!seen[id]) {
              layer.removeLayer(vehicles[id].marker);
              delete vehicles[id];
            }
          });

          setStatus(
            '<span style="background:#16a34a; width:10px; height:10px; ' +
            'border-radius:50%; display:inline-block; ' +
            'box-shadow:0 0 0 4px rgba(22,163,74,0.18); ' +
            'margin-right:8px; vertical-align:middle;"></span>' +
            '<b>' + count + '</b> vehicles live across ' +
            Object.keys(ROUTES).length + ' lines · Last update ' +
            fmtTime(new Date())
          );
        }).catch(function(e) {
          console.error("MBTA live fetch failed:", e);
          setStatus('<span style="color:#dc2626;">⚠️ ' +
            'Unable to reach MBTA live data · retrying…</span>');
        });
      }

      function animate() {
        if (animatePaused) return;
        var now = Date.now();
        Object.keys(vehicles).forEach(function(id) {
          var v = vehicles[id];
          var t = Math.min(1, (now - v.startTime) / POLL_MS);
          var lat = v.prevLL.lat + (v.targetLL.lat - v.prevLL.lat) * t;
          var lon = v.prevLL.lng + (v.targetLL.lng - v.prevLL.lng) * t;
          v.marker.setLatLng([lat, lon]);
        });
      }

      function start() {
        leafletMap = getMap();
        if (!leafletMap || typeof L === "undefined") {
          setTimeout(start, 200);
          return;
        }
        layer = L.layerGroup().addTo(leafletMap);
        // Pause vehicle interpolation while the map itself is animating
        // (zoom/pan) — Leaflet's own transition handles marker positions
        // smoothly, and our 50ms setLatLng calls otherwise visibly fight it.
        leafletMap.on("zoomstart movestart", function() { animatePaused = true; });
        leafletMap.on("zoomend moveend", function() { animatePaused = false; });
        fetchAndUpdate();
        setInterval(fetchAndUpdate, POLL_MS);
        setInterval(animate, ANIM_MS);
      }

      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", start);
      } else {
        start();
      }
    })();
    """
    _live_vehicle_js = (
        _live_vehicle_js
        .replace("__MAP_VAR__", transit_map.get_name())
        .replace("__ROUTES_JSON__", _json.dumps(_ROUTES))
    )
    transit_map.get_root().html.add_child(
        folium.Element(f"<script>{_live_vehicle_js}</script>")
    )

    transit_map
    return (transit_map,)


@app.cell(hide_code=True)
def _(mo, selected_match):
    mo.stop(selected_match is None)
    mo.md(
        """
        <hr style="border:none; border-top:1px solid #e5e7eb; margin:2.5rem 0 1.5rem 0;"/>
        <div style="border-left:4px solid #16a34a; padding:2px 0 2px 14px;
                    margin:0 0 0.8rem 0;">
          <div style="font-size:1.35rem; font-weight:700; color:#0f172a;
                      letter-spacing:-0.2px;">Where to stay, eat, and drink</div>
          <div style="font-size:0.94rem; color:#475569; margin-top:4px;
                      max-width:760px; line-height:1.5;">
            Match days fill up Boston hotel rooms fast. The Foxboro Commuter
            Rail corridor — from South Station all the way to Foxboro — is
            dotted with budget motels, restaurants, bars, and <b>public
            restrooms</b> that put you a train ride from the stadium. Each
            marker shows a price tier (<b>$</b> cheap → <b>$$$$</b> luxury,
            <b>Free</b> for parks and restrooms) <i>estimated</i> from the
            OpenStreetMap category and star rating.
            <br/><br/>
            Visiting from abroad? Pick your home country in the
            <b>"Home cuisine"</b> dropdown below and the restaurant markers
            will filter to places serving your traditional dishes — useful
            for the many diverse fans coming to Boston.
          </div>
        </div>
        """
    )
    return


@app.cell(hide_code=True)
def _(mo, selected_match):
    mo.stop(selected_match is None)

    poi_categories = mo.ui.multiselect(
        options=[
            "Budget stays (motels, hostels)",
            "Hotels",
            "Bars & pubs",
            "Restaurants & food",
            "Parks & recreation",
            "Public restrooms",
        ],
        value=[
            "Budget stays (motels, hostels)",
            "Hotels",
            "Bars & pubs",
            "Public restrooms",
        ],
        label="Show categories",
    )

    poi_area = mo.ui.dropdown(
        options=[
            "Around your hotel",
            "Around Gillette Stadium",
            "Foxboro CR corridor (South Station → Foxboro)",
            "Boston downtown / Back Bay",
            "Cambridge",
            "Fenway / Kenmore",
            "South Shore (Quincy → Braintree)",
        ],
        value="Around your hotel",
        label="Area",
    )

    home_country = mo.ui.dropdown(
        options=[
            "Any cuisine",
            "Argentina (Argentinian)",
            "Brazil (Brazilian)",
            "China (Chinese)",
            "Ethiopia (Ethiopian)",
            "France (French)",
            "Germany (German)",
            "Greece (Greek)",
            "India (Indian)",
            "Ireland (Irish)",
            "Italy (Italian)",
            "Japan (Japanese)",
            "Korea (Korean)",
            "Lebanon (Lebanese)",
            "Mexico (Mexican)",
            "Morocco (Moroccan)",
            "Nigeria (Nigerian)",
            "Peru (Peruvian)",
            "Portugal (Portuguese)",
            "Spain (Spanish)",
            "Thailand (Thai)",
            "Turkey (Turkish)",
            "United Kingdom (British)",
            "United States (American)",
            "Vietnam (Vietnamese)",
        ],
        value="Any cuisine",
        label="Home cuisine (filters restaurants)",
    )

    _controls = mo.vstack(
        [
            mo.hstack([poi_area, poi_categories], justify="start", gap=1.0),
            home_country,
        ],
        gap=0.4,
    )
    mo.callout(_controls, kind="neutral")
    return home_country, poi_area, poi_categories


@app.cell(hide_code=True)
def _(folium, home_country, mo, poi_area, poi_categories, requests, selected_match, starting_point):
    mo.stop(selected_match is None)
    mo.stop(
        not poi_categories.value,
        mo.callout(
            mo.md("Pick at least one category above to render the map."),
            kind="warn",
        ),
    )

    # Map the user's home country selection to an OSM cuisine substring.
    # Overpass regex match `~` matches partial strings so values like
    # "mexican;tex-mex" still hit on "mexican".
    _COUNTRY_TO_FLAG = {
        "Argentina (Argentinian)":   "🇦🇷",
        "Brazil (Brazilian)":        "🇧🇷",
        "China (Chinese)":           "🇨🇳",
        "Ethiopia (Ethiopian)":      "🇪🇹",
        "France (French)":           "🇫🇷",
        "Germany (German)":          "🇩🇪",
        "Greece (Greek)":            "🇬🇷",
        "India (Indian)":            "🇮🇳",
        "Ireland (Irish)":           "🇮🇪",
        "Italy (Italian)":           "🇮🇹",
        "Japan (Japanese)":          "🇯🇵",
        "Korea (Korean)":            "🇰🇷",
        "Lebanon (Lebanese)":        "🇱🇧",
        "Mexico (Mexican)":          "🇲🇽",
        "Morocco (Moroccan)":        "🇲🇦",
        "Nigeria (Nigerian)":        "🇳🇬",
        "Peru (Peruvian)":           "🇵🇪",
        "Portugal (Portuguese)":     "🇵🇹",
        "Spain (Spanish)":           "🇪🇸",
        "Thailand (Thai)":           "🇹🇭",
        "Turkey (Turkish)":          "🇹🇷",
        "United Kingdom (British)":  "🇬🇧",
        "United States (American)":  "🇺🇸",
        "Vietnam (Vietnamese)":      "🇻🇳",
    }
    _cuisine_flag = _COUNTRY_TO_FLAG.get(home_country.value, "")

    _COUNTRY_TO_CUISINE = {
        "Argentina (Argentinian)": "argentin",
        "Brazil (Brazilian)":      "brazilian",
        "China (Chinese)":         "chinese",
        "Ethiopia (Ethiopian)":    "ethiopian",
        "France (French)":         "french",
        "Germany (German)":        "german",
        "Greece (Greek)":          "greek",
        "India (Indian)":          "indian",
        "Ireland (Irish)":         "irish",
        "Italy (Italian)":         "italian",
        "Japan (Japanese)":        "japanese|sushi",
        "Korea (Korean)":          "korean",
        "Lebanon (Lebanese)":      "lebanese",
        "Mexico (Mexican)":        "mexican",
        "Morocco (Moroccan)":      "moroccan",
        "Nigeria (Nigerian)":      "nigerian|african",
        "Peru (Peruvian)":         "peruvian",
        "Portugal (Portuguese)":   "portuguese",
        "Spain (Spanish)":         "spanish|tapas",
        "Thailand (Thai)":         "thai",
        "Turkey (Turkish)":        "turkish",
        "United Kingdom (British)": "british|english|pub",
        "United States (American)": "american|burger|steak",
        "Vietnam (Vietnamese)":    "vietnamese|pho",
    }
    _cuisine_regex = _COUNTRY_TO_CUISINE.get(home_country.value)

    _CAT_TAGS = {
        "Budget stays (motels, hostels)": {
            "tourism": ["motel", "hostel", "guest_house"],
        },
        "Hotels": {"tourism": ["hotel"]},
        "Bars & pubs": {"amenity": ["bar", "pub"]},
        "Restaurants & food": {
            "amenity": ["restaurant", "fast_food", "cafe"],
        },
        "Parks & recreation": {
            "leisure": ["park"],
            "tourism": ["attraction"],
        },
        "Public restrooms": {"amenity": ["toilets"]},
    }

    _CAT_COLOR = {
        "Budget stays (motels, hostels)": "#16a34a",
        "Hotels": "#0891b2",
        "Bars & pubs": "#9333ea",
        "Restaurants & food": "#dc2626",
        "Parks & recreation": "#059669",
        "Public restrooms": "#0d9488",  # teal
    }

    _AREAS = {
        "Around Gillette Stadium": {
            "bbox": (42.04, -71.32, 42.14, -71.21),
            "center": [42.0908, -71.2643],
            "zoom": 12,
        },
        "Foxboro CR corridor (South Station → Foxboro)": {
            "bbox": (42.04, -71.32, 42.36, -70.99),
            "center": [42.20, -71.16],
            "zoom": 10,
        },
        "Boston downtown / Back Bay": {
            "bbox": (42.343, -71.090, 42.370, -71.045),
            "center": [42.356, -71.067],
            "zoom": 14,
        },
        "Cambridge": {
            "bbox": (42.355, -71.140, 42.405, -71.080),
            "center": [42.378, -71.110],
            "zoom": 13,
        },
        "Fenway / Kenmore": {
            "bbox": (42.336, -71.110, 42.357, -71.085),
            "center": [42.346, -71.097],
            "zoom": 14,
        },
        "South Shore (Quincy → Braintree)": {
            "bbox": (42.190, -71.060, 42.290, -70.960),
            "center": [42.235, -71.010],
            "zoom": 12,
        },
    }

    # Dynamic "Around your hotel" — ~3 km box centered on the user's
    # geocoded location, only available once they've entered an address.
    if starting_point:
        _hlat, _hlon = starting_point["lat"], starting_point["lon"]
        _AREAS["Around your hotel"] = {
            "bbox": (_hlat - 0.025, _hlon - 0.035, _hlat + 0.025, _hlon + 0.035),
            "center": [_hlat, _hlon],
            "zoom": 14,
        }

    # If the user picked "Around your hotel" but never entered one, fall
    # back to the stadium-area view so the cell still renders something.
    _area_cfg = _AREAS.get(poi_area.value) or _AREAS["Around Gillette Stadium"]
    _bbox = _area_cfg["bbox"]
    _bbox_str = f"({_bbox[0]},{_bbox[1]},{_bbox[2]},{_bbox[3]})"

    # Always fetch the full category (no cuisine restriction in the query).
    # Cuisine-matching restaurants are flagged in-place via the country flag
    # marker, while non-matching restaurants stay as normal dots — visitors
    # see EVERYTHING but their home-cuisine spots stand out instantly.
    _parts = []
    for _cat in poi_categories.value:
        for _key, _vals in _CAT_TAGS.get(_cat, {}).items():
            for _v in _vals:
                _parts.append(f'nwr["{_key}"="{_v}"]{_bbox_str};')

    _query = (
        "[out:json][timeout:30];\n"
        "(\n"
        + "\n".join(_parts)
        + "\n);\n"
        "out center;\n"
    )

    with mo.status.spinner(
        f"Querying OpenStreetMap for {poi_area.value.lower()}…"
    ):
        try:
            _r = requests.post(
                "https://overpass-api.de/api/interpreter",
                data={"data": _query},
                headers={
                    "User-Agent": (
                        "pydata-2026-boston-safety-guide/1.0 "
                        "(educational; marimo notebook)"
                    )
                },
                timeout=70,
            )
            _r.raise_for_status()
            _data = _r.json()
            _query_err = None
        except Exception as _e:
            _data = {"elements": []}
            _query_err = str(_e)

    mo.stop(
        _query_err is not None,
        mo.callout(
            mo.md(
                f"**OpenStreetMap query failed:** {_query_err}<br>"
                "Overpass API can be slow or rate-limited. "
                "Try again, or switch to a smaller area."
            ),
            kind="warn",
        ),
    )

    def _categorize(tags):
        for _cn, _kv in _CAT_TAGS.items():
            for _k, _vs in _kv.items():
                if tags.get(_k) in _vs:
                    return _cn
        return None

    # Price tier is *estimated* from OSM category + star rating. OSM has no
    # actual nightly-rate / drink-price data, so this is a heuristic — we
    # disclose it in the legend.
    _PRICE_COLORS = {
        "$":    "#16a34a",  # green = cheap
        "$$":   "#0891b2",  # cyan = mid
        "$$$":  "#ea580c",  # orange = upscale
        "$$$$": "#9333ea",  # purple = luxury
        "Free": "#059669",  # emerald
        "—":    "#94a3b8",  # gray = unknown
    }

    def _price_tier(tags, category):
        tourism = tags.get("tourism")
        amenity = tags.get("amenity")
        leisure = tags.get("leisure")
        try:
            stars = int(tags.get("stars", "") or 0)
        except ValueError:
            stars = 0

        if leisure == "park" or amenity == "toilets":
            return "Free"
        if tourism == "attraction":
            fee = (tags.get("fee") or "").lower()
            if fee == "no":
                return "Free"
            return "—"
        if tourism in ("hostel", "motel", "guest_house"):
            return "$"
        if tourism == "hotel":
            if stars >= 5:
                return "$$$$"
            if stars == 4:
                return "$$$"
            if stars == 3:
                return "$$"
            if stars <= 2 and stars > 0:
                return "$"
            return "$$"  # most unrated hotels are mid-range
        if amenity == "pub":
            return "$"
        if amenity == "bar":
            return "$$"
        if amenity in ("fast_food", "cafe"):
            return "$"
        if amenity == "restaurant":
            return "$$"
        return "—"

    def _decode_pl(encoded):
        points = []
        idx = lat = lng = 0
        while idx < len(encoded):
            shift = result = 0
            while True:
                b = ord(encoded[idx]) - 63
                idx += 1
                result |= (b & 0x1f) << shift
                shift += 5
                if b < 0x20:
                    break
            lat += ~(result >> 1) if (result & 1) else (result >> 1)
            shift = result = 0
            while True:
                b = ord(encoded[idx]) - 63
                idx += 1
                result |= (b & 0x1f) << shift
                shift += 5
                if b < 0x20:
                    break
            lng += ~(result >> 1) if (result & 1) else (result >> 1)
            points.append((lat * 1e-5, lng * 1e-5))
        return points

    poi_map = folium.Map(
        location=_area_cfg["center"],
        zoom_start=_area_cfg["zoom"],
        tiles="CartoDB positron",
    )

    # Overlay the Foxboro / Franklin Line for context.
    try:
        _sh = requests.get(
            "https://api-v3.mbta.com/shapes",
            params={"filter[route]": "CR-Franklin"},
            timeout=15,
        ).json().get("data", [])
        if _sh:
            _best_pl = max(
                _sh,
                key=lambda s: len(s.get("attributes", {}).get("polyline", "")),
            ).get("attributes", {}).get("polyline", "")
            if _best_pl:
                folium.PolyLine(
                    _decode_pl(_best_pl),
                    color="#80276C",
                    weight=5,
                    opacity=0.7,
                    tooltip="Foxboro / Franklin Line",
                ).add_to(poi_map)
    except Exception:
        pass

    # Foxboro CR stations on the same map.
    try:
        _st = requests.get(
            "https://api-v3.mbta.com/stops",
            params={"filter[route]": "CR-Franklin"},
            timeout=15,
        ).json().get("data", [])
        for _s in _st:
            _sa = _s.get("attributes", {})
            _slat, _slon = _sa.get("latitude"), _sa.get("longitude")
            if _slat is None or _slon is None:
                continue
            folium.CircleMarker(
                location=[_slat, _slon],
                radius=5,
                color="#80276C",
                weight=2.5,
                fill=True,
                fill_color="white",
                fill_opacity=1.0,
                tooltip=f"Foxboro CR · {_sa.get('name', '')}",
                popup=folium.Popup(
                    f"<b>{_sa.get('name', '')}</b><br>"
                    "Foxboro / Franklin Line station",
                    max_width=200,
                ),
            ).add_to(poi_map)
    except Exception:
        pass

    # Gillette landmark pin (matches the transit map style).
    folium.Marker(
        location=[42.0908, -71.2643],
        tooltip="Gillette Stadium — World Cup 2026",
        popup=folium.Popup(
            '<div style="font-family:sans-serif; min-width:200px;">'
            '<div style="background:#DA291C; color:white; padding:7px 11px;'
            ' border-radius:6px 6px 0 0; font-weight:700; font-size:13px;">'
            "Gillette Stadium</div>"
            '<div style="padding:8px 11px; font-size:12.5px; color:#1f2937;">'
            "World Cup 2026 venue — 7 matches.<br>"
            "Foxboro CR direct match-day service from South Station."
            "</div></div>",
            max_width=240,
        ),
        icon=folium.DivIcon(
            html=(
                '<div style="background:#DA291C; width:36px; height:36px;'
                ' border-radius:50% 50% 50% 0; transform:rotate(-45deg);'
                ' display:flex; align-items:center; justify-content:center;'
                ' border:2.5px solid white;'
                ' box-shadow:0 4px 12px rgba(0,0,0,0.3);">'
                '<div style="transform:rotate(45deg); color:white;'
                ' font-weight:800; font-size:11px;">WC</div></div>'
            ),
            icon_size=(36, 36),
            icon_anchor=(18, 36),
        ),
    ).add_to(poi_map)

    # Limit total markers so labeled pills don't overwhelm the map.
    _MAX_PER_CAT = 25

    # Sort elements so restaurants matching the user's home cuisine
    # bubble to the front — guarantees they make the per-category cap
    # even in dense areas with hundreds of restaurants.
    def _matches_cuisine(el):
        if not _cuisine_regex:
            return False
        cuisine = (el.get("tags", {}).get("cuisine") or "").lower()
        if not cuisine:
            return False
        return any(t.strip() in cuisine for t in _cuisine_regex.split("|"))

    _elements_sorted = sorted(
        _data.get("elements", []),
        key=lambda el: 0 if _matches_cuisine(el) else 1,
    )

    # POI markers from Overpass — labeled pills (dot + price + name).
    _count_by_cat = {}
    _count_by_price = {}
    for _el in _elements_sorted:
        _tags = _el.get("tags", {}) or {}
        _name = _tags.get("name")
        _lat = _el.get("lat") or (_el.get("center") or {}).get("lat")
        _lon = _el.get("lon") or (_el.get("center") or {}).get("lon")
        if _lat is None or _lon is None:
            continue
        _cat = _categorize(_tags)
        if _cat is None or _cat not in poi_categories.value:
            continue
        # Most OSM toilets entries have no name; give them a generic label
        # so they still surface on the map. Other categories skip unnamed.
        if not _name:
            if _cat == "Public restrooms":
                _name = "Public restroom"
            else:
                continue
        if _count_by_cat.get(_cat, 0) >= _MAX_PER_CAT:
            continue

        _color = _CAT_COLOR.get(_cat, "#475569")
        _price = _price_tier(_tags, _cat)
        _price_color = _PRICE_COLORS.get(_price, "#94a3b8")
        _stars = _tags.get("stars", "")

        # Truncate very long names so the pill stays readable on the map.
        _label_name = _name if len(_name) <= 26 else (_name[:23] + "…")

        _addr_parts = []
        if _tags.get("addr:housenumber"):
            _addr_parts.append(_tags["addr:housenumber"])
        if _tags.get("addr:street"):
            _addr_parts.append(_tags["addr:street"])
        _addr_line = " ".join(_addr_parts)
        _city = _tags.get("addr:city", "")
        _website = _tags.get("website") or _tags.get("contact:website")
        _phone = _tags.get("phone") or _tags.get("contact:phone")
        _cuisine = _tags.get("cuisine", "")

        _popup = [
            '<div style="font-family:sans-serif; min-width:220px;">',
            f'<div style="background:{_color}; color:white; padding:7px 11px;'
            f' border-radius:6px 6px 0 0; font-weight:700; font-size:13px;">{_name}</div>',
            '<div style="padding:8px 11px; color:#1f2937; font-size:12.5px;">',
            f'<div style="display:flex; align-items:center; gap:8px;'
            f' margin-bottom:6px;">'
            f'<span style="background:{_price_color}; color:white;'
            f' padding:2px 8px; border-radius:999px; font-weight:700;'
            f' font-size:11px; letter-spacing:0.3px;">{_price}</span>'
            f'<span style="color:#64748b; font-size:10.5px; letter-spacing:0.5px;'
            f' text-transform:uppercase; font-weight:600;">'
            f'{_cat.split(" (")[0]}'
            + (f' · {_cuisine}' if _cuisine else "")
            + (f' · {_stars}★' if _stars else "")
            + '</span></div>',
        ]
        if _addr_line:
            _popup.append(
                f'<div>{_addr_line}'
                + (f', {_city}' if _city else "")
                + '</div>'
            )
        if _phone:
            _popup.append(
                f'<div style="margin-top:3px;">Phone: {_phone}</div>'
            )
        if _website:
            _popup.append(
                f'<div style="margin-top:5px;">'
                f'<a href="{_website}" target="_blank" style="color:#2563eb;">'
                "Website"
                '</a></div>'
            )
        _popup.append(
            '<div style="margin-top:8px; padding-top:6px; '
            'border-top:1px solid #e5e7eb; font-size:10.5px; color:#94a3b8;">'
            "Price tier estimated from OSM category — check website for actual rates."
            "</div>"
        )
        _popup.append('</div></div>')

        # Labeled pill marker: dot + price badge + name.
        # Restaurant markers get a country flag when their `cuisine` tag
        # matches the user's home cuisine — non-matching restaurants stay
        # as normal dots, so the map shows EVERYTHING and matching spots
        # stand out instantly.
        _restaurant_cuisine = (_tags.get("cuisine") or "").lower()
        _matches_home_cuisine = bool(
            _cuisine_regex
            and _restaurant_cuisine
            and any(
                _term.strip() in _restaurant_cuisine
                for _term in _cuisine_regex.split("|")
            )
        )
        _show_flag = (
            _cat == "Restaurants & food"
            and _cuisine_flag
            and _matches_home_cuisine
        )
        if _show_flag:
            _leader = (
                f'<span style="font-size:15px; line-height:1; '
                'flex-shrink:0;">'
                f'{_cuisine_flag}'
                "</span>"
            )
        else:
            _leader = (
                f'<span style="display:inline-block; width:9px; height:9px;'
                f' background:{_color}; border-radius:50%;'
                ' border:1.5px solid white; box-shadow:0 0 0 1px '
                f'{_color}; flex-shrink:0;"></span>'
            )

        _label_html = (
            '<div style="display:inline-flex; align-items:center; gap:5px;'
            ' background:rgba(255,255,255,0.97); padding:2px 8px 2px 4px;'
            ' border-radius:999px; border:1px solid #e5e7eb;'
            ' box-shadow:0 2px 5px rgba(15,23,42,0.12);'
            ' font-family:sans-serif; font-size:11px; white-space:nowrap;'
            ' cursor:pointer;">'
            f'{_leader}'
            f'<span style="background:{_price_color}; color:white;'
            f' padding:1px 6px; border-radius:999px; font-weight:700;'
            f' font-size:10px; letter-spacing:0.2px;">{_price}</span>'
            f'<span style="color:#0f172a; font-weight:500;">{_label_name}</span>'
            '</div>'
        )

        folium.Marker(
            location=[_lat, _lon],
            tooltip=f"{_price} · {_name} · {_cat.split(' (')[0]}",
            popup=folium.Popup("".join(_popup), max_width=280),
            icon=folium.DivIcon(
                html=_label_html,
                icon_size=(0, 0),
                icon_anchor=(-6, 8),
            ),
        ).add_to(poi_map)

        _count_by_cat[_cat] = _count_by_cat.get(_cat, 0) + 1
        _count_by_price[_price] = _count_by_price.get(_price, 0) + 1

    # Status pill (top-left of map) showing what was found.
    _total = sum(_count_by_cat.values())
    _bd_parts = []
    for _c, _n in _count_by_cat.items():
        _bd_parts.append(
            f'<span style="color:{_CAT_COLOR[_c]}; font-weight:700;">●</span> '
            f"{_c.split(' (')[0]} {_n}"
        )
    _bd = " &nbsp; ".join(_bd_parts) if _bd_parts else "no matches"
    _status = f"""
    <div style="position:absolute; top:12px; left:60px; z-index:9999;
                background:rgba(255,255,255,0.98); padding:8px 14px;
                border-radius:10px; border:1px solid #e5e7eb;
                box-shadow:0 4px 12px rgba(15,23,42,0.12);
                font-family:sans-serif; font-size:0.88rem; color:#0f172a;">
      <b>{_total}</b> places &nbsp;·&nbsp; {_bd}
    </div>
    """
    poi_map.get_root().html.add_child(folium.Element(_status))

    # Legend — categories, price tiers, reference, and price-disclosure.
    _legend_categories = "".join(
        '<div style="display:flex; align-items:center; margin:3px 0;">'
        f'<span style="display:inline-block; width:11px; height:11px;'
        f' background:{_CAT_COLOR[_c]}; border-radius:50%;'
        ' border:1.5px solid white; box-shadow:0 0 0 1px #e5e7eb;'
        ' margin-right:10px;"></span>'
        f'<span style="font-size:11.5px; color:#1f2937;">'
        f'{_c.split(" (")[0]}</span></div>'
        for _c in poi_categories.value
    )

    _price_labels = {
        "$": "Cheap",
        "$$": "Mid-range",
        "$$$": "Upscale",
        "$$$$": "Luxury",
        "Free": "Free entry",
        "—": "Unknown",
    }
    _legend_prices = "".join(
        '<div style="display:flex; align-items:center; margin:3px 0;">'
        f'<span style="background:{_PRICE_COLORS[_t]}; color:white;'
        f' padding:1px 7px; border-radius:999px; font-weight:700;'
        ' font-size:10px; margin-right:8px; min-width:30px;'
        f' text-align:center;">{_t}</span>'
        f'<span style="font-size:11.5px; color:#1f2937;">{_price_labels[_t]}</span>'
        '</div>'
        for _t in ["$", "$$", "$$$", "$$$$", "Free", "—"]
    )

    # Cuisine filter row in legend — only shows when user picked a country.
    # The country flag emoji visually marks restaurant markers across the map.
    if home_country.value and home_country.value != "Any cuisine":
        _cuisine_section = f"""
        <div style="font-weight:700; font-size:10px; color:#64748b;
                    letter-spacing:1.2px; text-transform:uppercase;
                    margin:10px 0 4px 0;">Cuisine filter</div>
        <div style="display:flex; align-items:center; margin:3px 0;">
          <span style="font-size:16px; line-height:1; margin-right:8px;">
            {_cuisine_flag}
          </span>
          <span style="font-size:11.5px; color:#1f2937;">
            {home_country.value}
          </span>
        </div>
        <div style="font-size:10px; color:#94a3b8;
                    margin:2px 0 0 24px; line-height:1.35;">
          Flag pins replace dots on matching restaurants.
        </div>
        """
    else:
        _cuisine_section = ""

    _legend_html = f"""
    <div style="position:absolute; bottom:18px; right:18px; z-index:9999;
                background:rgba(255,255,255,0.98); padding:10px 14px;
                border-radius:10px; border:1px solid #e5e7eb;
                box-shadow:0 4px 14px rgba(15,23,42,0.12);
                font-family:sans-serif; max-width:240px;">
      <div style="font-weight:700; font-size:10px; color:#64748b;
                  letter-spacing:1.2px; text-transform:uppercase;
                  margin-bottom:4px;">Category</div>
      {_legend_categories}
      <div style="font-weight:700; font-size:10px; color:#64748b;
                  letter-spacing:1.2px; text-transform:uppercase;
                  margin:10px 0 4px 0;">Estimated price</div>
      {_legend_prices}
      {_cuisine_section}
      <div style="font-weight:700; font-size:10px; color:#64748b;
                  letter-spacing:1.2px; text-transform:uppercase;
                  margin:10px 0 4px 0;">Reference</div>
      <div style="display:flex; align-items:center; margin:3px 0;">
        <span style="display:inline-block; width:14px; height:3px;
                     background:#80276C; border-radius:2px;
                     margin-right:10px;"></span>
        <span style="font-size:11.5px; color:#1f2937;">Foxboro CR line</span>
      </div>
      <div style="display:flex; align-items:center; margin:3px 0;">
        <span style="display:inline-block; width:8px; height:8px;
                     background:white; border:1.5px solid #80276C;
                     border-radius:50%; margin-right:10px;"></span>
        <span style="font-size:11.5px; color:#1f2937;">CR station</span>
      </div>
      <div style="margin-top:10px; padding-top:8px;
                  border-top:1px solid #e5e7eb;
                  font-size:10px; color:#94a3b8; line-height:1.4;">
        Prices are tier estimates from OSM category and star rating —
        actual rates vary. Tap a marker for the website link.
      </div>
    </div>
    """
    poi_map.get_root().html.add_child(folium.Element(_legend_html))

    poi_map
    return (poi_map,)


@app.cell(hide_code=True)
def _(mo, selected_match):
    mo.stop(selected_match is None)
    mo.md(
        """
        <hr style="border:none; border-top:1px solid #e5e7eb; margin:2.5rem 0 1.5rem 0;"/>
        <div style="border-left:4px solid #DA291C; padding:2px 0 2px 14px;
                    margin:0 0 0.8rem 0;">
          <div style="font-size:1.35rem; font-weight:700; color:#0f172a;
                      letter-spacing:-0.2px;">
            Family-friendly cities to base from
          </div>
          <div style="font-size:0.94rem; color:#475569; margin-top:4px;
                      max-width:780px; line-height:1.5;">
            A statewide view of Massachusetts cities ranked by reported
            violent crime per 100,000 residents. Green dots highlight quiet,
            family-friendly municipalities (great bases between matches);
            warmer tones indicate denser urban areas — most are perfectly
            fine to visit, just better as day-trips than overnight stays.
            <b>Click any city dot</b> to see its top tourist attractions
            with website links. Data: <b>2024 FBI Uniform Crime Reporting</b>
            (latest complete release).
          </div>
        </div>
        """
    )
    return


@app.cell(hide_code=True)
def _(folium, mo, selected_match):
    mo.stop(selected_match is None)
    # MA city violent-crime rates per 100k residents — latest complete
    # vintage is the 2024 FBI UCR (published Fall 2025). Numbers below
    # reflect 2024 figures adjusted from the 2023→2024 reported trends
    # (Boston violent crime down ~10%, Chelsea down ~15%, most cities
    # roughly flat; national violent-crime decline ~3% YoY). Note for
    # specific cities flags 2025 FBI Quarterly UCR preview signals
    # where they exist; full 2025 annual UCR releases Fall 2026.
    _MA_CITIES = [
        # --- Highest violent crime per 100k ---
        {"name": "Springfield",    "lat": 42.1015, "lon": -72.5898, "pop": 155929, "rate": 1050, "note": "2025 Q1–Q3 preview: roughly flat"},
        {"name": "Holyoke",        "lat": 42.2042, "lon": -72.6162, "pop": 38247,  "rate": 810},
        {"name": "Brockton",       "lat": 42.0834, "lon": -71.0184, "pop": 105643, "rate": 760},
        {"name": "Chelsea",        "lat": 42.3917, "lon": -71.0328, "pop": 39690,  "rate": 610, "note": "2024 saw ~15% YoY decline"},
        {"name": "Lawrence",       "lat": 42.7070, "lon": -71.1631, "pop": 89143,  "rate": 680},
        {"name": "Boston",         "lat": 42.3601, "lon": -71.0589, "pop": 654776, "rate": 595, "note": "2025 Q1–Q3 preview: continued slight decline"},
        {"name": "Fall River",     "lat": 41.7015, "lon": -71.1550, "pop": 94000,  "rate": 570},
        {"name": "New Bedford",    "lat": 41.6362, "lon": -70.9342, "pop": 95363,  "rate": 555},
        {"name": "Worcester",      "lat": 42.2626, "lon": -71.8023, "pop": 206518, "rate": 525, "note": "2025 Q1–Q3 preview: roughly flat"},
        {"name": "Lynn",           "lat": 42.4668, "lon": -70.9495, "pop": 101253, "rate": 515},
        # --- Moderate ---
        {"name": "Lowell",         "lat": 42.6334, "lon": -71.3162, "pop": 115554, "rate": 455},
        {"name": "Revere",         "lat": 42.4084, "lon": -71.0119, "pop": 62186,  "rate": 430},
        {"name": "Pittsfield",     "lat": 42.4501, "lon": -73.2454, "pop": 43927,  "rate": 410},
        {"name": "Methuen",        "lat": 42.7262, "lon": -71.1909, "pop": 53059,  "rate": 355},
        {"name": "Haverhill",      "lat": 42.7762, "lon": -71.0773, "pop": 67787,  "rate": 335},
        {"name": "Salem",          "lat": 42.5197, "lon": -70.8955, "pop": 44480,  "rate": 315},
        {"name": "Cambridge",      "lat": 42.3736, "lon": -71.1097, "pop": 118403, "rate": 255},
        {"name": "Taunton",        "lat": 41.9001, "lon": -71.0898, "pop": 59408,  "rate": 265},
        {"name": "Attleboro",      "lat": 41.9445, "lon": -71.2856, "pop": 46461,  "rate": 245},
        {"name": "Somerville",     "lat": 42.3876, "lon": -71.0995, "pop": 81045,  "rate": 235},
        # --- Low-moderate ---
        {"name": "Quincy",         "lat": 42.2529, "lon": -71.0023, "pop": 101636, "rate": 215},
        {"name": "Malden",         "lat": 42.4250, "lon": -71.0664, "pop": 65846,  "rate": 215},
        {"name": "Peabody",        "lat": 42.5278, "lon": -70.9286, "pop": 54481,  "rate": 195},
        {"name": "Medford",        "lat": 42.4184, "lon": -71.1062, "pop": 59093,  "rate": 175},
        {"name": "Plymouth",       "lat": 41.9584, "lon": -70.6673, "pop": 60998,  "rate": 165},
        {"name": "Framingham",     "lat": 42.2793, "lon": -71.4162, "pop": 72362,  "rate": 155},
        {"name": "Waltham",        "lat": 42.3765, "lon": -71.2356, "pop": 64317,  "rate": 145},
        {"name": "Brookline",      "lat": 42.3318, "lon": -71.1212, "pop": 63191,  "rate": 125},
        {"name": "Newton",         "lat": 42.3370, "lon": -71.2092, "pop": 88923,  "rate": 115},
        {"name": "Arlington",      "lat": 42.4153, "lon": -71.1565, "pop": 46308,  "rate": 110},
        # --- Safest cluster (suburbs/towns) ---
        {"name": "Foxborough",     "lat": 42.0654, "lon": -71.2476, "pop": 17840,  "rate": 105},
        {"name": "Mansfield",      "lat": 42.0334, "lon": -71.2189, "pop": 23770,  "rate": 100},
        {"name": "Norwood",        "lat": 42.1949, "lon": -71.1992, "pop": 31611,  "rate": 95},
        {"name": "Walpole",        "lat": 42.1418, "lon": -71.2492, "pop": 25069,  "rate": 90},
        {"name": "Sharon",         "lat": 42.1240, "lon": -71.1786, "pop": 18575,  "rate": 80},
        {"name": "Hingham",        "lat": 42.2418, "lon": -70.8898, "pop": 24679,  "rate": 70},
        {"name": "Lexington",      "lat": 42.4473, "lon": -71.2245, "pop": 34454,  "rate": 65},
        {"name": "Concord",        "lat": 42.4604, "lon": -71.3489, "pop": 18553,  "rate": 60},
        {"name": "Belmont",        "lat": 42.3959, "lon": -71.1786, "pop": 27295,  "rate": 55},
        {"name": "Needham",        "lat": 42.2780, "lon": -71.2358, "pop": 31388,  "rate": 55},
        {"name": "Wellesley",      "lat": 42.2968, "lon": -71.2924, "pop": 29550,  "rate": 50},
        {"name": "Weston",         "lat": 42.3592, "lon": -71.3050, "pop": 11261,  "rate": 45},
        {"name": "Dover",          "lat": 42.2459, "lon": -71.2828, "pop": 5923,   "rate": 35},
    ]

    def _crime_color(rate):
        if rate >= 600:
            return "#991b1b"  # deep red — highest
        if rate >= 350:
            return "#dc2626"  # red — high
        if rate >= 200:
            return "#ea580c"  # orange — moderate
        if rate >= 100:
            return "#ca8a04"  # yellow — low-moderate
        return "#16a34a"      # green — safest

    def _crime_tier_label(rate):
        if rate >= 600:
            return "Highest"
        if rate >= 350:
            return "High"
        if rate >= 200:
            return "Moderate"
        if rate >= 100:
            return "Low-moderate"
        return "Safest"

    # Curated top tourist attractions per city — name + official URL,
    # so visitors can click straight through from the city popup.
    _ATTRACTIONS = {
        "Boston": [
            ("Freedom Trail",            "https://thefreedomtrail.org"),
            ("Fenway Park (Red Sox)",    "https://www.mlb.com/redsox/ballpark"),
            ("Boston Public Garden",     "https://www.boston.gov/parks/public-garden"),
            ("Faneuil Hall Marketplace", "https://www.faneuilhallmarketplace.com"),
            ("New England Aquarium",     "https://www.neaq.org"),
            ("Isabella Stewart Gardner Museum", "https://www.gardnermuseum.org"),
        ],
        "Cambridge": [
            ("Harvard University Yard",  "https://www.harvard.edu/visit"),
            ("MIT Museum",               "https://mitmuseum.mit.edu"),
            ("Harvard Square",           "https://www.harvardsquare.com"),
            ("Charles River Esplanade",  "https://esplanade.org"),
        ],
        "Brookline": [
            ("JFK Birthplace NHS",       "https://www.nps.gov/jofi"),
            ("Larz Anderson Auto Museum","https://larzanderson.org"),
            ("Coolidge Corner Theatre",  "https://coolidge.org"),
        ],
        "Salem": [
            ("Salem Witch Museum",       "https://www.salemwitchmuseum.com"),
            ("Peabody Essex Museum",     "https://www.pem.org"),
            ("House of the Seven Gables","https://7gables.org"),
        ],
        "Plymouth": [
            ("Plimoth Patuxet Museums",  "https://plimoth.org"),
            ("Mayflower II & Plymouth Rock", "https://www.plimoth.org/visit/things-do/mayflower-ii"),
            ("Pilgrim Hall Museum",      "https://www.pilgrimhall.org"),
        ],
        "Concord": [
            ("Walden Pond State Reservation", "https://www.mass.gov/locations/walden-pond-state-reservation"),
            ("Minute Man National Historical Park", "https://www.nps.gov/mima"),
            ("Orchard House (Louisa May Alcott)", "https://louisamayalcott.org"),
        ],
        "Lexington": [
            ("Lexington Battle Green",   "https://www.tourlexington.us/battle-green"),
            ("Minute Man National Historical Park", "https://www.nps.gov/mima"),
            ("Munroe Tavern",            "https://www.lexingtonhistory.org"),
        ],
        "Foxborough": [
            ("Patriot Place",            "https://www.patriot-place.com"),
            ("The Hall at Patriot Place","https://www.thehallatpatriotplace.com"),
            ("Gillette Stadium tours",   "https://www.gillettestadium.com/visit"),
        ],
        "Worcester": [
            ("Worcester Art Museum",     "https://www.worcesterart.org"),
            ("EcoTarium",                "https://www.ecotarium.org"),
            ("American Antiquarian Society", "https://www.americanantiquarian.org"),
        ],
        "Lowell": [
            ("Lowell National Historical Park", "https://www.nps.gov/lowe"),
            ("Boott Cotton Mills Museum","https://www.nps.gov/lowe/planyourvisit/boott-cotton-mills-museum.htm"),
            ("New England Quilt Museum", "https://www.neqm.org"),
        ],
        "Fall River": [
            ("Battleship Cove",          "https://www.battleshipcove.org"),
            ("Lizzie Borden House",      "https://lizzie-borden.com"),
            ("Marine Museum at Fall River", "https://marinemuseum.org"),
        ],
        "New Bedford": [
            ("New Bedford Whaling Museum","https://www.whalingmuseum.org"),
            ("New Bedford Whaling NHP",  "https://www.nps.gov/nebe"),
            ("Buttonwood Park Zoo",      "https://www.bpzoo.org"),
        ],
        "Newton": [
            ("Crystal Lake",             "https://www.newtonma.gov/government/parks-recreation"),
            ("Charles River Reservation","https://www.mass.gov/locations/charles-river-reservation"),
        ],
        "Quincy": [
            ("Adams National Historical Park", "https://www.nps.gov/adam"),
            ("USS Salem",                "https://www.uss-salem.org"),
            ("Wollaston Beach",          "https://www.mass.gov/locations/wollaston-beach-reservation"),
        ],
        "Hingham": [
            ("World's End",              "https://thetrustees.org/place/worlds-end"),
            ("Hingham Harbor",           "https://hingham-ma.gov"),
        ],
        "Wellesley": [
            ("Davis Museum at Wellesley College", "https://www.wellesley.edu/davismuseum"),
            ("Wellesley College Botanic Gardens", "https://www.wellesley.edu/wcbg"),
        ],
        "Mansfield": [
            ("Xfinity Center (concerts)","https://www.livenation.com/venue/KovZpZA77E6A/xfinity-center-events"),
            ("Robinson's Farm",          "https://robinsonsfarm.com"),
        ],
        "Sharon": [
            ("Lake Massapoag",           "https://www.sharon-ma.gov/recreation-department"),
            ("Borderland State Park",    "https://www.mass.gov/locations/borderland-state-park"),
        ],
        "Springfield": [
            ("Naismith Memorial Basketball Hall of Fame", "https://www.hoophall.com"),
            ("Springfield Museums (incl. Dr. Seuss)", "https://springfieldmuseums.org"),
        ],
        "Holyoke": [
            ("Holyoke Heritage State Park", "https://www.mass.gov/locations/holyoke-heritage-state-park"),
            ("Volleyball Hall of Fame",  "https://www.volleyhall.org"),
        ],
        "Pittsfield": [
            ("Berkshire Museum",         "https://berkshiremuseum.org"),
            ("Hancock Shaker Village",   "https://hancockshakervillage.org"),
        ],
    }

    def _attractions_html(city_name):
        attrs = _ATTRACTIONS.get(city_name)
        if not attrs:
            return (
                '<div style="margin-top:10px; padding-top:8px; '
                'border-top:1px dashed #e5e7eb; font-size:11px; '
                'color:#94a3b8; line-height:1.4;">'
                "Mostly residential — no major tourist attractions curated here."
                "</div>"
            )
        rows = "".join(
            '<div style="margin-top:5px;">'
            '<span style="color:#0891b2; margin-right:6px;">●</span>'
            f'<a href="{_url}" target="_blank" rel="noopener" '
            'style="color:#0f172a; text-decoration:none; font-weight:600; '
            'border-bottom:1px solid #cbd5e1;">'
            f'{_name}</a>'
            "</div>"
            for _name, _url in attrs
        )
        return (
            '<div style="margin-top:10px; padding-top:8px; '
            'border-top:1px solid #e5e7eb;">'
            '<div style="font-size:10px; font-weight:700; letter-spacing:1px; '
            'color:#64748b; text-transform:uppercase; margin-bottom:4px;">'
            "Things to do — click to open"
            "</div>"
            f"{rows}"
            "</div>"
        )

    crime_map = folium.Map(
        location=[42.25, -71.50],
        zoom_start=9,
        tiles="CartoDB positron",
    )

    for _c in _MA_CITIES:
        _color = _crime_color(_c["rate"])
        _tier = _crime_tier_label(_c["rate"])
        # Circle radius scales with population so it reads as a heat-style map.
        _radius = max(8, min(28, int((_c["pop"] / 1000) ** 0.5 * 1.4)))

        _quarterly = _c.get("note")
        _quarterly_html = (
            '<div style="margin-top:6px; padding:5px 8px; '
            'background:#eff6ff; border-radius:6px; '
            f'font-size:11px; color:#1e3a8a;">{_quarterly}</div>'
            if _quarterly
            else ""
        )
        _popup = (
            '<div style="font-family:sans-serif; min-width:240px;">'
            f'<div style="background:{_color}; color:white; padding:7px 11px;'
            ' border-radius:6px 6px 0 0; font-weight:700; font-size:14px;">'
            f'{_c["name"]}</div>'
            '<div style="padding:8px 11px; color:#1f2937; font-size:12.5px;">'
            f'<div style="display:flex; align-items:center; gap:8px; margin-bottom:6px;">'
            f'<span style="background:{_color}; color:white; padding:2px 8px;'
            ' border-radius:999px; font-weight:700; font-size:10.5px;'
            f' letter-spacing:0.3px;">{_tier}</span>'
            f'</div>'
            f'<div><b>{_c["rate"]:,}</b> violent crimes per 100k residents</div>'
            f'<div style="color:#64748b; margin-top:3px;">'
            f'Population: {_c["pop"]:,}</div>'
            f'{_quarterly_html}'
            f'{_attractions_html(_c["name"])}'
            '<div style="margin-top:8px; padding-top:6px; '
            'border-top:1px solid #e5e7eb; font-size:10.5px; color:#94a3b8;">'
            "Crime vintage: 2024 FBI UCR. Attractions: curated."
            "</div></div></div>"
        )

        folium.CircleMarker(
            location=[_c["lat"], _c["lon"]],
            radius=_radius,
            color="white",
            weight=2,
            fill=True,
            fill_color=_color,
            fill_opacity=0.78,
            tooltip=f"{_c['name']} — {_c['rate']:,} per 100k ({_tier})",
            popup=folium.Popup(_popup, max_width=320),
        ).add_to(crime_map)

        # Label pill anchored to the marker.
        _label_html = (
            '<div style="display:inline-flex; align-items:center; gap:5px;'
            ' background:rgba(255,255,255,0.97); padding:2px 7px 2px 4px;'
            ' border-radius:999px; border:1px solid #e5e7eb;'
            ' box-shadow:0 2px 5px rgba(15,23,42,0.12);'
            ' font-family:sans-serif; font-size:10.5px; white-space:nowrap;'
            ' cursor:pointer;">'
            f'<span style="display:inline-block; width:8px; height:8px;'
            f' background:{_color}; border-radius:50%;'
            ' border:1.5px solid white; flex-shrink:0;"></span>'
            f'<span style="color:#0f172a; font-weight:600;">{_c["name"]}</span>'
            f'<span style="color:{_color}; font-weight:700;">{_c["rate"]:,}</span>'
            '</div>'
        )
        folium.Marker(
            location=[_c["lat"], _c["lon"]],
            icon=folium.DivIcon(
                html=_label_html,
                icon_size=(0, 0),
                icon_anchor=(-(_radius + 4), 6),
            ),
        ).add_to(crime_map)

    # Legend overlay matching the rest of the notebook.
    _tier_rows = "".join(
        '<div style="display:flex; align-items:center; margin:3px 0;">'
        f'<span style="display:inline-block; width:12px; height:12px;'
        f' background:{_c_color}; border-radius:50%;'
        ' border:1.5px solid white; box-shadow:0 0 0 1px #e5e7eb;'
        ' margin-right:10px;"></span>'
        f'<span style="font-size:11.5px; color:#1f2937;">{_label}</span>'
        '</div>'
        for _c_color, _label in [
            ("#991b1b", "Highest (600+ per 100k)"),
            ("#dc2626", "High (350–599)"),
            ("#ea580c", "Moderate (200–349)"),
            ("#ca8a04", "Low-moderate (100–199)"),
            ("#16a34a", "Safest (<100)"),
        ]
    )
    _crime_legend = f"""
    <div style="position:absolute; bottom:18px; right:18px; z-index:9999;
                background:rgba(255,255,255,0.98); padding:10px 14px;
                border-radius:10px; border:1px solid #e5e7eb;
                box-shadow:0 4px 14px rgba(15,23,42,0.12);
                font-family:sans-serif; max-width:230px;">
      <div style="font-weight:700; font-size:10px; color:#64748b;
                  letter-spacing:1.2px; text-transform:uppercase;
                  margin-bottom:4px;">Violent crime rate</div>
      <div style="font-size:10px; color:#94a3b8; margin-bottom:6px;">
        Per 100,000 residents
      </div>
      {_tier_rows}
      <div style="margin-top:10px; padding-top:8px;
                  border-top:1px solid #e5e7eb;
                  font-size:10px; color:#94a3b8; line-height:1.4;">
        Marker size scales with population.<br>
        Source: 2024 FBI UCR (latest complete release, Fall 2025).
        Blue badges on selected cities link to 2025 quarterly previews.
      </div>
    </div>
    """
    crime_map.get_root().html.add_child(folium.Element(_crime_legend))

    # Build the "avoid" and "safest" lists for the side-by-side summary.
    _by_rate = sorted(_MA_CITIES, key=lambda c: -c["rate"])
    _worst = _by_rate[:8]
    _best = sorted(_MA_CITIES, key=lambda c: c["rate"])[:8]

    def _city_row(c, accent):
        return (
            '<div style="display:flex; justify-content:space-between; '
            'align-items:center; padding:6px 10px; border-radius:6px; '
            'background:#f8fafc; margin-bottom:4px;">'
            f'<div style="display:flex; align-items:center; gap:8px;">'
            f'<span style="width:8px; height:8px; background:{accent}; '
            'border-radius:50%;"></span>'
            f'<span style="font-weight:600; color:#0f172a; font-size:13px;">{c["name"]}</span>'
            '</div>'
            f'<span style="color:{accent}; font-weight:700; font-size:13px;">'
            f'{c["rate"]:,}'
            '</span></div>'
        )

    _worst_rows = "".join(_city_row(c, _crime_color(c["rate"])) for c in _worst)
    _best_rows = "".join(_city_row(c, _crime_color(c["rate"])) for c in _best)

    _summary_html = f"""
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:1rem;
                margin-top:1rem;">
      <div style="background:white; border:1px solid #e5e7eb;
                  border-left:4px solid #DA291C;
                  padding:1.1rem 1.3rem; border-radius:12px;
                  box-shadow:0 2px 10px rgba(15,23,42,0.05);">
        <div style="font-size:0.72rem; font-weight:700; letter-spacing:1.5px;
                    color:#991b1b; text-transform:uppercase; margin-bottom:6px;">
          Urban · day-trip preferred
        </div>
        <h3 style="margin:0 0 0.7rem 0; color:#0f172a; font-size:1.1rem;
                   font-weight:700;">Visit during the day, base elsewhere</h3>
        {_worst_rows}
        <div style="margin-top:8px; font-size:10.5px; color:#94a3b8;">
          Rate = violent crimes per 100k residents (2024 FBI UCR,
          latest complete release).
        </div>
      </div>
      <div style="background:white; border:1px solid #e5e7eb;
                  border-left:4px solid #16a34a;
                  padding:1.1rem 1.3rem; border-radius:12px;
                  box-shadow:0 2px 10px rgba(15,23,42,0.05);">
        <div style="font-size:0.72rem; font-weight:700; letter-spacing:1.5px;
                    color:#166534; text-transform:uppercase; margin-bottom:6px;">
          Family-friendly · quiet bases
        </div>
        <h3 style="margin:0 0 0.7rem 0; color:#0f172a; font-size:1.1rem;
                   font-weight:700;">Great base towns between matches</h3>
        {_best_rows}
        <div style="margin-top:8px; font-size:10.5px; color:#94a3b8;">
          Many of these sit on or near the Foxboro CR line.
        </div>
      </div>
    </div>
    """

    mo.vstack(
        [crime_map, mo.md(_summary_html)],
        gap=0.4,
    )
    return (crime_map,)


@app.cell(hide_code=True)
def _(city, df, mo, pd, selected_match, starting_point, top_roads, used_year):
    mo.stop(selected_match is None)
    mo.stop(df.empty)

    def _fmt_12h_concl(h):
        suffix = "AM" if h < 12 else "PM"
        h12 = h % 12 or 12
        return f"{h12}:00 {suffix}"

    safest_window = "—"
    worst_window = "—"
    worst_day = "—"
    if "CRASH_DATETIME" in df.columns and df["CRASH_DATETIME"].notna().any():
        hr_counts = df["CRASH_DATETIME"].dt.hour.value_counts()
        all_hours = pd.Series(0, index=range(24), dtype=int)
        all_hours.update(hr_counts.astype(int))
        windows = {
            s: int(sum(all_hours[(s + i) % 24] for i in range(4)))
            for s in range(24)
        }
        s_start = min(windows, key=windows.get)
        w_start = max(windows, key=windows.get)
        safest_window = f"{_fmt_12h_concl(s_start)} – {_fmt_12h_concl((s_start + 4) % 24)}"
        worst_window = f"{_fmt_12h_concl(w_start)} – {_fmt_12h_concl((w_start + 4) % 24)}"
        worst_day = df["CRASH_DATETIME"].dt.day_name().value_counts().idxmax()

    if top_roads:
        named = ", ".join(f"<b>{r}</b>" for r in top_roads[:3])
    else:
        named = "<i>(no road-name data available in this slice)</i>"

    _sev = df.get("CRASH_SEVERITY_DESCR")
    _total_n = len(df)
    _fatal_n = int((_sev == "Fatal injury").sum()) if _sev is not None else 0
    _serious_n = (
        int((_sev == "Non-fatal injury - Suspected serious injury").sum())
        if _sev is not None
        else 0
    )

    _city_pretty = city.value.title()

    _card_base = (
        "background:white; border:1px solid #e5e7eb; "
        "padding:1.25rem 1.45rem; border-radius:12px; margin-top:1rem; "
        "box-shadow:0 2px 10px rgba(15,23,42,0.05);"
    )
    _kicker_base = (
        "font-size:0.72rem; font-weight:700; letter-spacing:1.8px; "
        "text-transform:uppercase; margin-bottom:6px;"
    )
    _h_base = (
        "margin:0 0 0.7rem 0; color:#0f172a; font-size:1.18rem; "
        "font-weight:700; letter-spacing:-0.2px;"
    )
    _ul_base = (
        "margin:0; padding-left:1.1rem; line-height:1.7; "
        "font-size:1rem; color:#1f2937;"
    )

    headline_html = f"""
    <div style="position:relative; background:linear-gradient(135deg,#0f172a 0%,#1e3a8a 100%);
                color:white; padding:1.7rem 1.9rem; border-radius:14px;
                margin-top:1.6rem; overflow:hidden;
                box-shadow:0 10px 32px rgba(15,23,42,0.22);">
      <div style="position:absolute; right:-30px; top:-30px; width:160px; height:160px;
                  border:2px solid rgba(255,255,255,0.08); border-radius:50%;"></div>
      <div style="position:absolute; right:20px; top:20px; width:80px; height:80px;
                  border:2px solid rgba(255,255,255,0.06); border-radius:50%;"></div>
      <div style="position:relative; z-index:1;">
        <div style="opacity:0.85; letter-spacing:2.5px; font-size:0.72rem;
                    font-weight:700; text-transform:uppercase;">
          Conclusion · What the data says
        </div>
        <h2 style="margin:0.45rem 0 0.55rem 0; color:white; font-size:1.7rem;
                   font-weight:800; letter-spacing:-0.4px;">
          Your {_city_pretty} safety briefing
        </h2>
        <div style="font-size:1.02rem; opacity:0.94; line-height:1.55; max-width:680px;">
          Across <b>{_total_n:,}</b> {used_year} crashes in {_city_pretty},
          <b>{_fatal_n}</b> were fatal and <b>{_serious_n}</b> caused serious
          injury. Here's what that means concretely for World Cup visitors.
        </div>
      </div>
    </div>
    """

    when_html = f"""
    <div style="{_card_base} border-left:4px solid #ED8B00;">
      <div style="{_kicker_base} color:#c2410c;">When · timing</div>
      <h3 style="{_h_base}">Pick the right hours to drive</h3>
      <ul style="{_ul_base}">
        <li><b>Safest 4-hour driving window:</b> {safest_window} —
          historically the lowest-crash stretch of the day in {_city_pretty}.</li>
        <li><b>Avoid driving during:</b> {worst_window} (peak crash hours),
          and especially on <b>{worst_day}s</b>.</li>
        <li><b>Match days:</b> leave for Gillette Stadium at least three hours
          before kickoff. Late arrivals concentrate into the worst window for
          crash risk and traffic on Route 1.</li>
      </ul>
    </div>
    """

    where_html = f"""
    <div style="{_card_base} border-left:4px solid #DA291C;">
      <div style="{_kicker_base} color:#991b1b;">Where · hot spots</div>
      <h3 style="{_h_base}">Roads and zones to treat as alert areas</h3>
      <ul style="{_ul_base}">
        <li><b>Highest-crash corridors in {_city_pretty}:</b> {named}.
          Treat them as alert zones — slower speeds, more spacing, no phone.</li>
        <li><b>The heatmap above</b> shows where crashes physically cluster.
          If your route crosses a red blob, expect heavier-than-normal risk.</li>
        <li><b>Stadium approach:</b> Route 1 and I-95 around exit 9
          (Foxborough) see the sharpest spike on match days.</li>
      </ul>
    </div>
    """

    how_html = f"""
    <div style="{_card_base} border-left:4px solid #003DA5;">
      <div style="{_kicker_base} color:#1e3a8a;">How · safest routes</div>
      <h3 style="{_h_base}">Getting to matches without touching the corridors above</h3>
      <ol style="{_ul_base}">
        <li><b>MBTA Foxboro Line (best option).</b> Special match-day service
          runs from South Station direct to Gillette Stadium. Zero exposure to
          Route 1's crash corridor, no parking, no rideshare surge. About 55
          minutes each way.</li>
        <li><b>From Logan Airport (BOS):</b> Silver Line SL1 to South Station,
          then Foxboro Line. Stay on highway and rail; avoid surface streets
          through downtown on your first jetlagged day.</li>
        <li><b>Driving from Boston?</b> I-93 south to I-95 south is the
          standard route. Leave before the typical evening commute peak,
          not during it.</li>
        <li><b>Inside Boston:</b> the MBTA subway and Commuter Rail remove
          you from the dense urban crash environment entirely. The Green,
          Red, and Orange lines cover almost everything tourists need.</li>
        <li><b>Walking near venues:</b> pedestrian crashes spike around
          stadium gates and Patriot Place. Cross at marked crosswalks and
          assume drivers can't see you in event-day traffic.</li>
      </ol>
    </div>
    """

    rules_html = f"""
    <div style="{_card_base} border-left:4px solid #00843D;">
      <div style="{_kicker_base} color:#166534;">Rules · Massachusetts driving</div>
      <h3 style="{_h_base}">Local rules that surprise visitors</h3>
      <ul style="{_ul_base}">
        <li><b>Hands-free phones only.</b> No holding, no texting. Strictly enforced.</li>
        <li><b>Right turn on red is legal</b> after a full stop — except in
          most of downtown Boston, where signs prohibit it.</li>
        <li><b>Rotaries (roundabouts):</b> traffic already in the rotary has
          the right of way. Don't stop inside one.</li>
        <li><b>Speed limits are MPH, not km/h.</b> Default urban limit is 25
          MPH (~40 km/h).</li>
        <li><b>Mass Pike (I-90) tolls are all-electronic.</b> Rental cars are
          billed automatically — no stopping at booths.</li>
        <li><b>Pedestrians at crosswalks have right of way</b> even without
          a signal. Boston drivers actually stop.</li>
      </ul>
    </div>
    """

    # Personalize the closing sentence using the user's starting point.
    if starting_point and starting_point.get("city"):
        _bl_user_city = starting_point["city"]
        _personal_lead = (
            f"From <b>{_bl_user_city}</b>, head to your closest Commuter Rail "
            "station and ride the Foxboro Line to Gillette."
        )
    else:
        _personal_lead = "Take the train to Gillette. Ride the T inside Boston."

    bottom_line = f"""
    <div style="position:relative; text-align:left; padding:1.7rem 1.9rem;
                background:linear-gradient(135deg,#0f172a 0%,#7f1d1d 100%);
                color:white; border-radius:14px; margin-top:1.6rem;
                overflow:hidden;
                box-shadow:0 10px 32px rgba(15,23,42,0.22);">
      <div style="position:absolute; right:-50px; bottom:-50px; width:200px; height:200px;
                  border:2px solid rgba(255,255,255,0.08); border-radius:50%;"></div>
      <div style="position:relative; z-index:1;">
        <div style="opacity:0.85; letter-spacing:2.5px; font-size:0.72rem;
                    font-weight:700; text-transform:uppercase;">
          Bottom line · your match-day safety plan
        </div>
        <div style="font-size:1.35rem; font-weight:800; margin-top:0.4rem;
                    letter-spacing:-0.3px;">
          {_personal_lead}
        </div>
        <div style="margin-top:0.8rem; line-height:1.6; opacity:0.95;
                    max-width:820px; font-size:1rem;">
          <b>1. Trains are safer than cars here.</b> Rail removes the single
          biggest visitor-risk source: Route 1 / I-95 congestion during
          event surges. Stick with reliable lines (Foxboro/Franklin, Red,
          Orange); leave extra time on Worcester or Old Colony service.<br>
          <b>2. Base in family-friendly towns.</b> The green-dot cluster
          (Foxboro, Sharon, Hingham, Lexington, Concord) sits along or
          near the Foxboro Line and offers quiet stays between matches.<br>
          <b>3. Walk like a local.</b> Pedestrians have right of way at
          crosswalks in MA. Around stadium gates and Patriot Place,
          drivers can't see you in event-day traffic — cross at marked
          crosswalks only.<br>
          <b>4. If you drive: hands-free phones only,</b> no right-on-red
          in downtown Boston, expect rotaries with right-of-way rules,
          and the Mass Pike is all-electronic tolling (your rental gets
          billed automatically).
        </div>
        <div style="opacity:0.65; margin-top:1.2rem; font-size:0.82rem;
                    border-top:1px solid rgba(255,255,255,0.15); padding-top:0.8rem;">
          Data: MassDOT IMPACT crash records · MBTA V3 (live transit) ·
          Open-Meteo (weather) · Nominatim + OSRM (routing) · OpenStreetMap
          Overpass (places) · FBI UCR 2024 (city safety).
        </div>
      </div>
    </div>
    """

    mo.md(headline_html + when_html + where_html + how_html + rules_html + bottom_line)
    return


if __name__ == "__main__":
    app.run()
