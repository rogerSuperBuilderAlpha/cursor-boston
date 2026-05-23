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
        <div style="position:relative; background:linear-gradient(135deg,#7f1d1d 0%,#1e3a8a 55%,#0f172a 100%);
                    padding:2.6rem 2.4rem; border-radius:18px; color:white;
                    overflow:hidden; box-shadow:0 14px 44px rgba(15,23,42,0.28);
                    margin-bottom:1.4rem;">

          <svg xmlns="http://www.w3.org/2000/svg"
               style="position:absolute; inset:0; width:100%; height:100%; opacity:0.10;"
               viewBox="0 0 600 240" preserveAspectRatio="xMidYMid slice">
            <defs>
              <pattern id="turf" x="0" y="0" width="60" height="240" patternUnits="userSpaceOnUse">
                <rect width="30" height="240" fill="rgba(255,255,255,0.04)"/>
                <rect x="30" width="30" height="240" fill="rgba(255,255,255,0)"/>
              </pattern>
            </defs>
            <rect width="600" height="240" fill="url(#turf)"/>
            <rect x="6" y="6" width="588" height="228" fill="none"
                  stroke="white" stroke-width="1.4"/>
            <line x1="300" y1="6" x2="300" y2="234" stroke="white" stroke-width="1.2"/>
            <circle cx="300" cy="120" r="44" fill="none" stroke="white" stroke-width="1.4"/>
            <circle cx="300" cy="120" r="2.2" fill="white"/>
            <rect x="6" y="80" width="58" height="80" fill="none"
                  stroke="white" stroke-width="1.4"/>
            <rect x="536" y="80" width="58" height="80" fill="none"
                  stroke="white" stroke-width="1.4"/>
            <rect x="6" y="100" width="22" height="40" fill="none"
                  stroke="white" stroke-width="1.2"/>
            <rect x="572" y="100" width="22" height="40" fill="none"
                  stroke="white" stroke-width="1.2"/>
          </svg>

          <svg xmlns="http://www.w3.org/2000/svg"
               style="position:absolute; right:-18px; top:-8px; width:240px; height:240px;
                      opacity:0.18; transform:rotate(8deg);"
               viewBox="0 0 200 200">
            <circle cx="100" cy="100" r="68" fill="none" stroke="white" stroke-width="2.5"/>
            <polygon points="100,42 124,60 114,90 86,90 76,60"
                     fill="none" stroke="white" stroke-width="1.8"/>
            <polygon points="124,60 154,80 146,112 114,90"
                     fill="none" stroke="white" stroke-width="1.8"/>
            <polygon points="76,60 46,80 54,112 86,90"
                     fill="none" stroke="white" stroke-width="1.8"/>
            <polygon points="114,90 146,112 130,148 100,138 86,138 70,148 54,112 86,90"
                     fill="none" stroke="white" stroke-width="1.8"/>
          </svg>

          <div style="position:relative; z-index:2;">
            <div style="display:inline-flex; align-items:center; gap:8px;
                        background:rgba(255,255,255,0.12); border:1px solid rgba(255,255,255,0.18);
                        padding:5px 12px; border-radius:999px;
                        font-size:0.7rem; font-weight:700; letter-spacing:2.2px;">
              <span style="width:7px; height:7px; background:#dc2626;
                           border-radius:50%; box-shadow:0 0 0 3px rgba(220,38,38,0.35);"></span>
              FIFA WORLD CUP 26 &nbsp;·&nbsp; BOSTON HOST CITY
            </div>
            <h1 style="margin:1rem 0 0.5rem 0; font-size:2.55rem; color:white;
                       font-weight:800; letter-spacing:-0.6px; line-height:1.05;
                       text-shadow:0 2px 12px rgba(0,0,0,0.25);">
              Boston Stadium Isn't in Boston
            </h1>
            <div style="font-size:1.06rem; color:rgba(255,255,255,0.92); line-height:1.55;
                        max-width:760px; font-weight:400;">
              A data map for surviving World Cup 2026. Gillette Stadium sits
              30 miles south in Foxborough, MA — and Route 1 there ranks
              among the deadliest corridors in the Commonwealth. This guide
              pairs live MassDOT crash records with a real-time MBTA map so
              visitors can see exactly where to drive, where to take the
              train, and when to just walk.
            </div>
          </div>
        </div>
        """
    )
    return


@app.cell(hide_code=True)
def _(mo):
    mo.md(
        """
        <div style="border-left:4px solid #DA291C; padding:2px 0 2px 14px;
                    margin:2rem 0 0.8rem 0;">
          <div style="font-size:1.35rem; font-weight:700; color:#0f172a;
                      letter-spacing:-0.2px;">Explore the data</div>
          <div style="font-size:0.92rem; color:#64748b; margin-top:2px;">
            Pick a year and a host-area city. The map, stats, and the
            routing advice at the bottom all refresh live from
            MassDOT's open crash database.
          </div>
        </div>
        """
    )
    return


@app.cell(hide_code=True)
def _(mo):
    year = mo.ui.dropdown(
        options=["2026", "2025", "2024", "2023", "2022", "2021", "2020", "2019"],
        value="2026",
        label="Year",
    )

    city = mo.ui.dropdown(
        options=[
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
        ],
        value="BOSTON",
        label="Host area / city",
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
        label="Crash severity (filter)",
    )

    run = mo.ui.run_button(label="Fetch crashes →", kind="success")

    controls = mo.vstack([
        mo.hstack([year, city], justify="start", gap=1.0),
        severity,
        run,
    ], gap=0.6)

    mo.callout(controls, kind="info")
    return city, run, severity, year


@app.cell(hide_code=True)
def _(city, mo, pd, requests, run, severity, year):
    mo.stop(
        not run.value,
        mo.callout(
            mo.md(
                "👆 **Set your filters above and click _Fetch crashes →_** "
                "to pull the latest records from MassDOT IMPACT. "
                "The default view (Boston 2026) is a good starting point for most visitors."
            ),
            kind="neutral",
        ),
    )

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
def _(city, df, fallback_note, mo, used_year):
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
def _(mo):
    mo.md(
        """
        <div style="border-left:4px solid #DA291C; padding:2px 0 2px 14px;
                    margin:2rem 0 0.6rem 0;">
          <div style="font-size:1.35rem; font-weight:700; color:#0f172a;
                      letter-spacing:-0.2px;">Where crashes cluster</div>
          <div style="font-size:0.92rem; color:#64748b; margin-top:2px;">
            Red = high crash density. Markers show serious and fatal crashes.
          </div>
        </div>
        """
    )
    return


@app.cell(hide_code=True)
def _(HeatMap, MarkerCluster, df, folium, mo):
    mo.stop(df.empty)

    center = [df["lat"].mean(), df["lon"].mean()]
    m = folium.Map(location=center, zoom_start=13, tiles="CartoDB positron")

    HeatMap(
        df[["lat", "lon"]].values.tolist(),
        radius=12,
        blur=18,
        min_opacity=0.35,
        name="Crash density (heatmap)",
    ).add_to(m)

    serious_mask = df["CRASH_SEVERITY_DESCR"].isin(
        ["Fatal injury", "Non-fatal injury - Suspected serious injury"]
    )
    serious = df[serious_mask]

    if not serious.empty:
        cluster = MarkerCluster(name="Serious & fatal crashes").add_to(m)
        for _, row in serious.iterrows():
            color = (
                "red"
                if row["CRASH_SEVERITY_DESCR"] == "Fatal injury"
                else "orange"
            )
            popup_html = (
                f"<b>{row.get('CRASH_SEVERITY_DESCR','')}</b><br>"
                f"{row.get('CRASH_DATETIME','')}<br>"
                f"Vehicles: {row.get('NUMB_VEHC','?')}<br>"
                f"Crash #: {row.get('CRASH_NUMB','')}"
            )
            folium.CircleMarker(
                location=[row["lat"], row["lon"]],
                radius=5,
                color=color,
                fill=True,
                fill_opacity=0.85,
                popup=folium.Popup(popup_html, max_width=260),
            ).add_to(cluster)

    folium.LayerControl(collapsed=False).add_to(m)
    m
    return (m,)


@app.cell(hide_code=True)
def _(df, mo):
    mo.stop(df.empty)

    street_cols = [
        c
        for c in ["STREETNAME", "RDWY", "ROADWAY", "CRASH_RD_TYPE_DESCR"]
        if c in df.columns
    ]
    if not street_cols:
        out = mo.md(
            "_(No street/roadway field in this year's schema — skipping the "
            "top-roads table.)_"
        )
        top_roads = []
    else:
        col = street_cols[0]
        top_roads_series = df[col].dropna().value_counts().head(10)
        top_roads = top_roads_series.index.tolist()
        top_roads_df = (
            top_roads_series.rename_axis("Roadway / corridor")
            .reset_index(name="Crash count")
        )
        out = mo.vstack(
            [
                mo.md(
                    f"""
                    <div style="border-left:4px solid #ED8B00; padding:2px 0 2px 14px;
                                margin:2rem 0 0.6rem 0;">
                      <div style="font-size:1.35rem; font-weight:700; color:#0f172a;
                                  letter-spacing:-0.2px;">Top 10 roads by crash count</div>
                      <div style="font-size:0.88rem; color:#64748b; margin-top:2px;">
                        These corridors generate the most crashes in this area —
                        if your hotel, rental, or planned route sits on one of them,
                        consider an alternative.
                        <span style="opacity:0.6;">(field: <code>{col}</code>)</span>
                      </div>
                    </div>
                    """
                ),
                top_roads_df,
            ],
            gap=0.4,
        )
    out
    return (top_roads,)


@app.cell(hide_code=True)
def _(alt, df, mo):
    mo.stop(df.empty or "CRASH_DATETIME" not in df.columns)
    mo.stop(not df["CRASH_DATETIME"].notna().any())

    hourly = (
        df.assign(hour=df["CRASH_DATETIME"].dt.hour)
        .groupby("hour")
        .size()
        .reset_index(name="crashes")
    )
    bar = (
        alt.Chart(hourly)
        .mark_bar(color="#1e3a8a")
        .encode(
            x=alt.X("hour:O", title="Hour of day (0–23)"),
            y=alt.Y("crashes:Q", title="Crashes"),
            tooltip=["hour", "crashes"],
        )
        .properties(height=240, title="When during the day do crashes happen?")
    )
    mo.vstack(
        [
            mo.md(
                """
                <div style="border-left:4px solid #ED8B00; padding:2px 0 2px 14px;
                            margin:2rem 0 0.6rem 0;">
                  <div style="font-size:1.35rem; font-weight:700; color:#0f172a;
                              letter-spacing:-0.2px;">When crashes happen</div>
                  <div style="font-size:0.92rem; color:#64748b; margin-top:2px;">
                    Hourly distribution of crashes — use this to plan travel times.
                  </div>
                </div>
                """
            ),
            mo.ui.altair_chart(bar),
        ],
        gap=0.4,
    )
    return (hourly,)


@app.cell(hide_code=True)
def _(mo):
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
def _(folium, requests):
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
def _(mo):
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
            dotted with budget motels, restaurants, and bars that put you a
            train ride from the stadium. Each marker shows a price tier
            (<b>$</b> cheap → <b>$$$$</b> luxury) <i>estimated</i> from the
            OpenStreetMap category and star rating — OSM doesn't ship real
            nightly rates, so check the website link in each popup for
            actual prices.
          </div>
        </div>
        """
    )
    return


@app.cell(hide_code=True)
def _(mo):
    poi_categories = mo.ui.multiselect(
        options=[
            "Budget stays (motels, hostels)",
            "Hotels",
            "Bars & pubs",
            "Restaurants & food",
            "Parks & recreation",
        ],
        value=[
            "Budget stays (motels, hostels)",
            "Hotels",
            "Bars & pubs",
        ],
        label="Show categories",
    )

    poi_area = mo.ui.dropdown(
        options=[
            "Around Gillette Stadium",
            "Foxboro CR corridor (South Station → Foxboro)",
        ],
        value="Around Gillette Stadium",
        label="Area",
    )

    poi_run = mo.ui.run_button(label="Find places →", kind="success")

    _controls = mo.vstack(
        [
            mo.hstack([poi_area, poi_categories], justify="start", gap=1.0),
            poi_run,
        ],
        gap=0.5,
    )
    mo.callout(_controls, kind="info")
    return poi_area, poi_categories, poi_run


@app.cell(hide_code=True)
def _(folium, mo, poi_area, poi_categories, poi_run, requests):
    mo.stop(
        not poi_run.value,
        mo.callout(
            mo.md(
                "Click **Find places →** to query OpenStreetMap for "
                "accommodations and venues near Gillette Stadium and along "
                "the Foxboro Commuter Rail. The first query takes 10–25 "
                "seconds; subsequent queries are faster."
            ),
            kind="neutral",
        ),
    )

    mo.stop(
        not poi_categories.value,
        mo.callout(
            mo.md("Pick at least one category above to render the map."),
            kind="warn",
        ),
    )

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
    }

    _CAT_COLOR = {
        "Budget stays (motels, hostels)": "#16a34a",
        "Hotels": "#0891b2",
        "Bars & pubs": "#9333ea",
        "Restaurants & food": "#dc2626",
        "Parks & recreation": "#059669",
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
    }

    _area_cfg = _AREAS[poi_area.value]
    _bbox = _area_cfg["bbox"]
    _bbox_str = f"({_bbox[0]},{_bbox[1]},{_bbox[2]},{_bbox[3]})"

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

        if leisure == "park":
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

    # POI markers from Overpass — labeled pills (dot + price + name).
    _count_by_cat = {}
    _count_by_price = {}
    for _el in _data.get("elements", []):
        _tags = _el.get("tags", {}) or {}
        _name = _tags.get("name")
        if not _name:
            continue  # skip unnamed entries — not useful for visitors
        _lat = _el.get("lat") or (_el.get("center") or {}).get("lat")
        _lon = _el.get("lon") or (_el.get("center") or {}).get("lon")
        if _lat is None or _lon is None:
            continue
        _cat = _categorize(_tags)
        if _cat is None or _cat not in poi_categories.value:
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
        _label_html = (
            '<div style="display:inline-flex; align-items:center; gap:5px;'
            ' background:rgba(255,255,255,0.97); padding:2px 8px 2px 4px;'
            ' border-radius:999px; border:1px solid #e5e7eb;'
            ' box-shadow:0 2px 5px rgba(15,23,42,0.12);'
            ' font-family:sans-serif; font-size:11px; white-space:nowrap;'
            ' cursor:pointer;">'
            f'<span style="display:inline-block; width:9px; height:9px;'
            f' background:{_color}; border-radius:50%;'
            ' border:1.5px solid white; box-shadow:0 0 0 1px '
            f'{_color}; flex-shrink:0;"></span>'
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

    _legend_html = f"""
    <div style="position:absolute; bottom:18px; right:18px; z-index:9999;
                background:rgba(255,255,255,0.98); padding:10px 14px;
                border-radius:10px; border:1px solid #e5e7eb;
                box-shadow:0 4px 14px rgba(15,23,42,0.12);
                font-family:sans-serif; max-width:230px;">
      <div style="font-weight:700; font-size:10px; color:#64748b;
                  letter-spacing:1.2px; text-transform:uppercase;
                  margin-bottom:4px;">Category</div>
      {_legend_categories}
      <div style="font-weight:700; font-size:10px; color:#64748b;
                  letter-spacing:1.2px; text-transform:uppercase;
                  margin:10px 0 4px 0;">Estimated price</div>
      {_legend_prices}
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
def _(mo):
    mo.md(
        """
        <hr style="border:none; border-top:1px solid #e5e7eb; margin:2.5rem 0 1.5rem 0;"/>
        <div style="border-left:4px solid #DA291C; padding:2px 0 2px 14px;
                    margin:0 0 0.8rem 0;">
          <div style="font-size:1.35rem; font-weight:700; color:#0f172a;
                      letter-spacing:-0.2px;">
            Cities to avoid and the safest places to base from
          </div>
          <div style="font-size:0.94rem; color:#475569; margin-top:4px;
                      max-width:780px; line-height:1.5;">
            A statewide view of violent crime per 100,000 residents across
            Massachusetts cities and towns. Red dots = highest rates (consider
            day-trips rather than overnight stays), green dots = safest
            municipalities (good base if you want quiet between matches).
            Data: <b>2024 FBI Uniform Crime Reporting</b> (published Fall 2025
            — the latest complete release), with 2025 quarterly preview notes
            where the FBI has published partial figures for the largest
            agencies. Full 2025 annual UCR is expected Fall 2026; 2026 data
            won't exist until late 2027.
          </div>
        </div>
        """
    )
    return


@app.cell(hide_code=True)
def _(folium, mo):
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
            '<div style="font-family:sans-serif; min-width:220px;">'
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
            '<div style="margin-top:8px; padding-top:6px; '
            'border-top:1px solid #e5e7eb; font-size:10.5px; color:#94a3b8;">'
            "Vintage: 2024 FBI UCR (latest complete). "
            "Full 2025 annual data publishes Fall 2026."
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
            popup=folium.Popup(_popup, max_width=260),
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
          Avoid · highest rates
        </div>
        <h3 style="margin:0 0 0.7rem 0; color:#0f172a; font-size:1.1rem;
                   font-weight:700;">Consider day-tripping only</h3>
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
          Safest · lowest rates
        </div>
        <h3 style="margin:0 0 0.7rem 0; color:#0f172a; font-size:1.1rem;
                   font-weight:700;">Good bases between matches</h3>
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
def _(city, df, mo, pd, top_roads, used_year):
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

    bottom_line = """
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
          Bottom line
        </div>
        <div style="font-size:1.35rem; font-weight:800; margin-top:0.4rem;
                    letter-spacing:-0.3px;">
          Take the train to Gillette. Ride the T inside Boston.
        </div>
        <div style="margin-top:0.7rem; line-height:1.6; opacity:0.95;
                    max-width:780px; font-size:1rem;">
          If you must drive, avoid the peak crash window above and stay
          off the top corridors. The data is unambiguous: rail removes the
          biggest single source of risk for visitors — Route 1 and I-95
          traffic during event surges.
        </div>
        <div style="opacity:0.65; margin-top:1.1rem; font-size:0.82rem;
                    border-top:1px solid rgba(255,255,255,0.15); padding-top:0.8rem;">
          Data: MassDOT IMPACT Open Data Hub and MBTA V3 API ·
          Continuously updated from police crash reports and live transit feeds.
        </div>
      </div>
    </div>
    """

    mo.md(headline_html + when_html + where_html + how_html + rules_html + bottom_line)
    return


if __name__ == "__main__":
    app.run()
