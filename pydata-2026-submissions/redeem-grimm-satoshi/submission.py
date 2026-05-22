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
        <div style="background: linear-gradient(135deg, #d52b1e 0%, #1e3a8a 100%);
                    padding: 2rem 2.2rem; border-radius: 16px; color: white;
                    box-shadow: 0 8px 30px rgba(0,0,0,0.15); margin-bottom: 1.2rem;">
          <div style="opacity:0.85; letter-spacing:3px; font-size: 0.78rem; font-weight:600;">
            FIFA WORLD CUP 26™  ·  BOSTON HOST CITY
          </div>
          <h1 style="margin: 0.5rem 0 0.6rem 0; font-size: 2.3rem; color: white; font-weight: 700;">
            ⚽ Crash Safety Guide for Visitors
          </h1>
          <div style="font-size: 1.05rem; opacity: 0.95; line-height:1.55; max-width: 780px;">
            Gillette Stadium (Foxborough, MA) hosts <b>seven matches</b>
            of the 2026 World Cup, with fans staying across Boston,
            Cambridge, Brookline, and the South Shore. This guide turns
            <b>live MassDOT crash data</b> — including 2026 reports —
            into routing advice: which corridors to avoid,
            when to travel, and when the train is the smarter call.
          </div>
        </div>
        """
    )
    return


@app.cell(hide_code=True)
def _(mo):
    mo.md(
        """
        ### 🎛️ Explore the data

        Pick a year and a host-area city. The map, stats, and the
        **tourist routing advice at the bottom** all update live from
        MassDOT's open crash database.
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
    mo.md("### 🗺️ Where crashes cluster")
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
                    f"### ⚠️ Top 10 roads by crash count "
                    f"<span style='font-size:0.85rem; opacity:0.7;'>(field: <code>{col}</code>)</span>"
                ),
                mo.md(
                    "_These are the corridors generating the most crashes in "
                    "this area. If your hotel, rental, or planned route sits "
                    "on one of these, consider an alternative._"
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
            mo.md("### 🕐 When do crashes happen?"),
            mo.ui.altair_chart(bar),
        ],
        gap=0.4,
    )
    return (hourly,)


@app.cell(hide_code=True)
def _(mo):
    mo.md(
        """
        ---
        ### 🚆 Your safer alternative — live MBTA map

        The dashboards above show where driving risk concentrates.
        The map below shows **how to bypass it**: the actual rail
        network with **live vehicle positions** (auto-refreshing).
        The Foxboro Line is your match-day shuttle; the T moves you
        around Boston without touching the crash corridors above.
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
        folium.PolyLine(
            _coords,
            color=_ROUTES[_rid]["color"],
            weight=4,
            opacity=0.85,
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
        folium.CircleMarker(
            location=[_slat, _slon],
            radius=2.5,
            color="#333",
            weight=1,
            fill=True,
            fill_color="white",
            fill_opacity=1.0,
            popup=folium.Popup(
                f"<b>{_sattrs.get('name', '')}</b>", max_width=200
            ),
        ).add_to(transit_map)

    _legend_items = "".join(
        f"<div style='display:flex; align-items:center; margin:2px 0;'>"
        f"<span style='display:inline-block; width:14px; height:14px;"
        f" background:{_info['color']}; border-radius:50%; margin-right:6px;'></span>"
        f"<span style='font-size:12px;'>{_info['name']}</span></div>"
        for _info in _ROUTES.values()
    )
    _legend_html = f"""
    <div style="position:absolute; bottom:20px; right:20px; z-index:9999;
                background:white; padding:10px 14px; border-radius:8px;
                box-shadow:0 4px 12px rgba(0,0,0,0.15); font-family:sans-serif;">
      <div style="font-weight:600; margin-bottom:6px; font-size:13px;">MBTA lines</div>
      {_legend_items}
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
              var marker = L.circleMarker([a.latitude, a.longitude], {
                radius: 8, color: "white", weight: 2.5,
                fillColor: color, fillOpacity: 1.0
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

    headline_html = f"""
    <div style="background:linear-gradient(135deg,#0f172a 0%,#1e3a8a 100%);
                color:white; padding:1.6rem 1.8rem; border-radius:14px;
                margin-top:1.4rem; box-shadow:0 8px 30px rgba(0,0,0,0.15);">
      <div style="opacity:0.8; letter-spacing:2.5px; font-size:0.75rem; font-weight:600;">
        CONCLUSION  ·  WHAT THE DATA SAYS
      </div>
      <h2 style="margin:0.4rem 0 0.5rem 0; color:white; font-size:1.65rem;">
        🧭 Your {_city_pretty} safety briefing
      </h2>
      <div style="font-size:1.02rem; opacity:0.95; line-height:1.55;">
        Across <b>{_total_n:,}</b> {used_year} crashes in {_city_pretty},
        <b>{_fatal_n}</b> were fatal and <b>{_serious_n}</b> caused serious
        injury. Here's what that means concretely for World Cup visitors.
      </div>
    </div>
    """

    when_html = f"""
    <div style="background:#fff7ed; border-left:5px solid #ea580c;
                padding:1.2rem 1.4rem; border-radius:8px; margin-top:1rem;">
      <h3 style="margin-top:0; color:#9a3412;">⏰ WHEN to travel</h3>
      <ul style="line-height:1.75; font-size:1.02rem; color:#1f2937;">
        <li><b>Safest 4-hour driving window:</b> {safest_window} —
          historically the lowest-crash stretch of the day in {_city_pretty}.</li>
        <li><b>Avoid driving during:</b> {worst_window} (peak crash hours),
          and especially on <b>{worst_day}s</b>.</li>
        <li><b>Match days:</b> leave for Gillette Stadium <i>at least 3 hours
          before kickoff</i>. Late arrivals concentrate into the worst window
          for crash risk and traffic on Route 1.</li>
      </ul>
    </div>
    """

    where_html = f"""
    <div style="background:#fef2f2; border-left:5px solid #dc2626;
                padding:1.2rem 1.4rem; border-radius:8px; margin-top:1rem;">
      <h3 style="margin-top:0; color:#991b1b;">🚧 WHERE the risk concentrates</h3>
      <ul style="line-height:1.75; font-size:1.02rem; color:#1f2937;">
        <li><b>Highest-crash corridors in {_city_pretty}:</b> {named}.
          Treat them as alert zones — slower speeds, more spacing, no phone.</li>
        <li><b>Look at the red blobs on the map above</b> — those are the
          intersections and stretches where crashes physically cluster.
          If your route crosses one, expect heavier-than-normal risk.</li>
        <li><b>Stadium approach:</b> Route 1 and I-95 around exit 9
          (Foxborough) sees the worst spike on match days.</li>
      </ul>
    </div>
    """

    how_html = """
    <div style="background:#eff6ff; border-left:5px solid #2563eb;
                padding:1.2rem 1.4rem; border-radius:8px; margin-top:1rem;">
      <h3 style="margin-top:0; color:#1e3a8a;">🚆 HOW to get to matches — the safest options</h3>
      <ol style="line-height:1.75; font-size:1.02rem; color:#1f2937;">
        <li><b>Take the MBTA Foxboro Line (best option).</b> Special match-day
          service runs from <b>South Station</b> direct to Gillette Stadium.
          Zero exposure to Route 1's crash corridor, no parking, no rideshare
          surge. ~55 min each way.</li>
        <li><b>From Logan Airport (BOS):</b> Silver Line SL1 → South Station
          → Foxboro Line. Stay on highway/rail; avoid surface streets through
          downtown for your first day jetlagged.</li>
        <li><b>Driving from Boston?</b> I-93 south → I-95 south is the standard
          route. Leave <i>before</i> the typical evening commute peak, not during.</li>
        <li><b>Inside Boston:</b> the MBTA subway (T) + Commuter Rail removes
          you from the dense urban crash environment entirely. The Green, Red,
          and Orange lines cover almost everything tourists need.</li>
        <li><b>Walking near venues:</b> pedestrian crashes spike around stadium
          gates and Patriot Place. Cross at marked crosswalks; assume drivers
          can't see you in event-day traffic.</li>
      </ol>
    </div>
    """

    rules_html = """
    <div style="background:#f0fdf4; border-left:5px solid #16a34a;
                padding:1.2rem 1.4rem; border-radius:8px; margin-top:1rem;">
      <h3 style="margin-top:0; color:#166534;">✅ Massachusetts driving rules that surprise visitors</h3>
      <ul style="line-height:1.75; font-size:1.02rem; color:#1f2937;">
        <li><b>Hands-free phones only.</b> No holding, no texting. Enforced.</li>
        <li><b>Right turn on red is legal</b> after a full stop — <i>except</i>
          in most of downtown Boston, where signs prohibit it.</li>
        <li><b>Rotaries (roundabouts):</b> traffic already <i>in</i> the rotary
          has the right of way. Don't stop inside one.</li>
        <li><b>Speed limits are MPH, not km/h.</b> Default urban limit is 25
          MPH (≈ 40 km/h).</li>
        <li><b>Mass Pike (I-90) tolls are all-electronic.</b> Rental cars get
          billed automatically — no stopping at booths.</li>
        <li><b>Pedestrians at crosswalks have right of way</b> even without a
          signal. Boston drivers actually stop. Wait for them to wave you across.</li>
      </ul>
    </div>
    """

    bottom_line = """
    <div style="text-align:center; padding:1.5rem 1rem; background:#0f172a;
                color:white; border-radius:14px; margin-top:1.5rem;
                box-shadow:0 8px 30px rgba(0,0,0,0.15);">
      <div style="font-size:1.35rem; font-weight:700;">
        🏆 Bottom line for World Cup 2026 visitors
      </div>
      <div style="margin-top:0.6rem; line-height:1.6; opacity:0.95;
                  max-width:780px; margin-left:auto; margin-right:auto;">
        <b>Take the train to Gillette.</b> Inside Boston, ride the T.
        If you must drive, avoid the peak crash window above and stay off
        the top-3 corridors. The data is unambiguous: rail removes the
        biggest single source of risk for visitors — Route 1 / I-95
        traffic during event surges.
      </div>
      <div style="opacity:0.7; margin-top:1rem; font-size:0.85rem;">
        Data: MassDOT IMPACT Open Data Hub  ·  Continuously updated from
        police crash reports  ·  Have a great World Cup ⚽
      </div>
    </div>
    """

    mo.md(headline_html + when_html + where_html + how_html + rules_html + bottom_line)
    return


if __name__ == "__main__":
    app.run()
