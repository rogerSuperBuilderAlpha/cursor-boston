# /// script
# requires-python = ">=3.9"
# dependencies = [
#     "marimo",
#     "pandas",
#     "numpy",
#     "plotly",
#     "httpx",
#     "google-generativeai",
# ]
# ///

import marimo

__generated_with = "0.17.6"
app = marimo.App(width="full", app_title="TERRA")


@app.cell
def _():
    import marimo as mo
    import pandas as pd
    import numpy as np
    import plotly.express as px
    import plotly.graph_objects as go
    import httpx
    import os
    import pathlib
    import hashlib
    import json
    import io

    CACHE_DIR = pathlib.Path(".exo_cache")
    CACHE_DIR.mkdir(exist_ok=True)

    def cached_get(url, params=None):
        key = hashlib.md5(
            (url + json.dumps(params or {}, sort_keys=True)).encode()
        ).hexdigest()
        cache_path = CACHE_DIR / f"{key}.cache"
        if cache_path.exists():
            return cache_path.read_text(encoding="utf-8")
        try:
            resp = httpx.get(url, params=params, timeout=30)
            resp.raise_for_status()
            cache_path.write_text(resp.text, encoding="utf-8")
            return resp.text
        except Exception:
            return None

    EARTH_RADIUS = 1.0
    EARTH_MASS = 1.0
    EARTH_TEQ = 255
    EARTH_INSOL = 1.0
    return (
        EARTH_INSOL,
        EARTH_MASS,
        EARTH_RADIUS,
        EARTH_TEQ,
        cached_get,
        go,
        io,
        mo,
        np,
        os,
        pd,
        px,
    )


@app.cell
def _(mo):
    mo.md("""
    # 🌍 TERRA — A Project Hail Mary Mission Planner

    Find candidate systems for humanity's most important mission.
    Inspired by Andy Weir's novel — an interactive explorer powered by NASA's confirmed exoplanet archive.
    """)
    return


@app.cell
def _(cached_get, io, mo, np, pd):
    _tap_url = "https://exoplanetarchive.ipac.caltech.edu/TAP/sync"
    _tap_params = {
        "query": (
            "select pl_name, hostname, pl_rade, pl_bmasse, pl_eqt, pl_insol, "
            "pl_orbper, st_teff, st_rad, sy_dist, disc_year, discoverymethod "
            "from ps where default_flag=1 and pl_rade is not null "
            "and pl_bmasse is not null"
        ),
        "format": "csv",
    }

    _raw_csv = cached_get(_tap_url, _tap_params)
    _using_synthetic = False

    if _raw_csv is not None:
        try:
            df_raw = pd.read_csv(io.StringIO(_raw_csv))
            if len(df_raw) == 0:
                raise ValueError("Empty result set")
        except Exception:
            _raw_csv = None

    if _raw_csv is None:
        _using_synthetic = True
        _rng = np.random.RandomState(42)
        _n = 500
        _methods = [
            "Transit", "Radial Velocity", "Direct Imaging",
            "Microlensing", "Transit Timing Variations",
        ]
        df_raw = pd.DataFrame({
            "pl_name": [f"SYN-{i:04d}b" for i in range(_n)],
            "hostname": [f"SYN-{i:04d}" for i in range(_n)],
            "pl_rade": _rng.uniform(0.3, 15.0, _n),
            "pl_bmasse": _rng.uniform(0.1, 500.0, _n),
            "pl_eqt": _rng.uniform(100, 2000, _n),
            "pl_insol": _rng.uniform(0.01, 100.0, _n),
            "pl_orbper": _rng.uniform(0.5, 1000.0, _n),
            "st_teff": _rng.uniform(2500, 10000, _n),
            "st_rad": _rng.uniform(0.1, 5.0, _n),
            "sy_dist": _rng.uniform(1, 3000, _n),
            "disc_year": _rng.randint(1995, 2026, _n),
            "discoverymethod": _rng.choice(_methods, _n),
        })

    _critical = ["pl_name", "pl_rade", "pl_bmasse"]
    df_raw = df_raw.dropna(subset=_critical).reset_index(drop=True)

    _source = "**Synthetic data** (NASA TAP unreachable)" if _using_synthetic else f"**NASA Exoplanet Archive** \u2014 {len(df_raw):,} confirmed planets loaded"
    data_status = mo.md(f"\U0001f4e1 Data source: {_source}")
    return (df_raw,)


@app.cell
def _(EARTH_INSOL, EARTH_MASS, EARTH_RADIUS, EARTH_TEQ, df_raw, np):
    def earth_similarity(row):
        dims = [
            (row.get("pl_rade", np.nan), EARTH_RADIUS, 0.57),
            (row.get("pl_bmasse", np.nan), EARTH_MASS, 1.07),
            (row.get("pl_eqt", np.nan), EARTH_TEQ, 5.58),
            (row.get("pl_insol", np.nan), EARTH_INSOL, 0.70),
        ]
        total_w = sum(w for _, _, w in dims)
        product = 1.0
        for x, x_e, w in dims:
            if np.isnan(x) or (x + x_e) == 0:
                continue
            si = 1.0 - abs(x - x_e) / (x + x_e)
            product *= si ** (w / total_w)
        return product

    df = df_raw.copy()
    df["esi"] = df.apply(earth_similarity, axis=1)
    df["viability"] = df["esi"] * np.exp(-df["sy_dist"].fillna(9999) / 12)
    df = df.sort_values("esi", ascending=False).reset_index(drop=True)
    return (df,)


@app.cell
def _(mo):
    radius_range = mo.ui.range_slider(
        start=0.3, stop=3.0, step=0.1, value=[0.5, 1.5],
        label="Planet radius (Earth radii)",
    )
    mass_range = mo.ui.range_slider(
        start=0.1, stop=10.0, step=0.1, value=[0.3, 3.0],
        label="Planet mass (Earth masses)",
    )
    temp_range = mo.ui.range_slider(
        start=100, stop=600, step=10, value=[200, 350],
        label="Equilibrium temperature (K)",
    )
    esi_threshold = mo.ui.slider(
        start=0.0, stop=1.0, step=0.05, value=0.5,
        label="Minimum ESI score",
    )

    mo.vstack([
        mo.md("### \U0001f39b\ufe0f Define your 'second Earth'"),
        radius_range,
        mass_range,
        temp_range,
        esi_threshold,
    ])
    return esi_threshold, mass_range, radius_range, temp_range


@app.cell
def _(mo):
    mission_mode = mo.ui.switch(value=False, label="\U0001f680 Mission Mode")
    mo.vstack([
        mo.md("_Toggle on for Project Hail Mary mission planning_"),
        mission_mode,
    ])
    return (mission_mode,)


@app.cell
def _(
    df,
    esi_threshold,
    mass_range,
    mission_mode,
    mo,
    radius_range,
    temp_range,
):
    _r_lo, _r_hi = radius_range.value
    _m_lo, _m_hi = mass_range.value
    _t_lo, _t_hi = temp_range.value
    _esi_min = esi_threshold.value

    _mask = (
        (df["pl_rade"] >= _r_lo) & (df["pl_rade"] <= _r_hi)
        & (df["pl_bmasse"] >= _m_lo) & (df["pl_bmasse"] <= _m_hi)
        & (df["pl_eqt"].fillna(0) >= _t_lo) & (df["pl_eqt"].fillna(0) <= _t_hi)
        & (df["esi"] >= _esi_min)
    )

    if mission_mode.value:
        _mask = _mask & (df["sy_dist"].fillna(9999) < 50)

    filtered_raw = df[_mask].copy()

    _mode_label = " (Mission Mode \U0001f680)" if mission_mode.value else ""
    mo.md(f"\U0001f50e **{len(filtered_raw)}** planets match your criteria{_mode_label}")
    return (filtered_raw,)


@app.cell
def _(filtered_raw, mission_mode):
    if mission_mode.value:
        filtered = filtered_raw.sort_values("viability", ascending=False).reset_index(drop=True)
    else:
        filtered = filtered_raw.sort_values("esi", ascending=False).reset_index(drop=True)
    return (filtered,)


@app.cell
def _(filtered, go, mission_mode, mo, px):
    _plot_df = filtered.copy()
    _plot_df["_size"] = _plot_df["pl_bmasse"].clip(upper=10)

    _color_col = "viability" if mission_mode.value else "esi"
    _color_scale = "Inferno" if mission_mode.value else "Viridis"
    _title = "Mission Candidate Systems \u2014 Project Hail Mary Planner" if mission_mode.value else "Earth's Cousins in the Galaxy"

    if len(_plot_df) > 0:
        _fig = px.scatter(
            _plot_df,
            x="pl_rade",
            y="pl_eqt",
            color=_color_col,
            size="_size",
            hover_name="pl_name",
            hover_data=["hostname", "sy_dist", "disc_year", "viability"],
            color_continuous_scale=_color_scale,
            template="plotly_dark",
            title=_title,
            labels={
                "pl_rade": "Planet Radius (Earth radii)",
                "pl_eqt": "Equilibrium Temperature (K)",
                "esi": "ESI Score",
                "viability": "Mission Viability",
            },
        )
    else:
        _fig = go.Figure()
        _fig.update_layout(
            template="plotly_dark",
            title=_title + " \u2014 no matches yet",
            xaxis_title="Planet Radius (Earth radii)",
            yaxis_title="Equilibrium Temperature (K)",
        )

    _fig.add_trace(go.Scatter(
        x=[1.0], y=[255],
        mode="markers+text",
        marker=dict(symbol="star", size=18, color="#FF6B35", line=dict(width=2, color="white")),
        text=["Earth"],
        textposition="top center",
        textfont=dict(color="#FF6B35", size=14),
        name="Earth",
        showlegend=True,
    ))

    _fig.update_layout(
        paper_bgcolor="#1a1a2e",
        plot_bgcolor="#16213e",
        font_color="#e0e0e0",
        coloraxis_colorbar_title_text="Viability" if mission_mode.value else "ESI",
        height=550,
    )

    mo.ui.plotly(_fig)
    return


@app.cell
def _(filtered, mo):
    _cols = ["pl_name", "hostname", "esi", "pl_rade", "pl_bmasse", "pl_eqt", "sy_dist", "disc_year", "discoverymethod"]
    _top5 = (
        filtered
        .head(5)
        [[c for c in _cols if c in filtered.columns]]
        .copy()
    )
    if "esi" in _top5.columns:
        _top5["esi"] = _top5["esi"].round(3)
    _rename = {
        "pl_name": "Planet", "hostname": "Host Star", "esi": "ESI",
        "pl_rade": "Radius (R\u2295)", "pl_bmasse": "Mass (M\u2295)",
        "pl_eqt": "Eq Temp (K)", "sy_dist": "Distance (pc)",
        "disc_year": "Discovery Year", "discoverymethod": "Method",
    }
    _top5 = _top5.rename(columns=_rename)

    mo.vstack([
        mo.md("### \U0001f3c6 Top Earth-like matches"),
        mo.ui.table(_top5) if len(_top5) > 0 else mo.md("_No matches \u2014 try widening the filters._"),
    ])
    return


@app.cell
def _(filtered, go, mo, np):
    _best = filtered.head(1)

    if len(_best) > 0:
        _row = _best.iloc[0]
        _planet_r = _row["pl_rade"]
        _planet_name = _row["pl_name"]
    else:
        _planet_r = 1.0
        _planet_name = "(none selected)"

    _earth_r = 1.0
    _max_r = max(_earth_r, _planet_r) * 1.3
    _gap = _max_r * 1.1

    _fig = go.Figure()

    _theta = np.linspace(0, 2 * np.pi, 120)

    _fig.add_trace(go.Scatter(
        x=(_earth_r * np.cos(_theta) - _gap / 2).tolist(),
        y=(_earth_r * np.sin(_theta)).tolist(),
        fill="toself",
        fillcolor="rgba(100,149,237,0.5)",
        line=dict(color="cornflowerblue", width=2),
        name="Earth",
        hoverinfo="text",
        text="Earth<br>Radius: 1.00 R\u2295",
    ))

    _fig.add_trace(go.Scatter(
        x=(_planet_r * np.cos(_theta) + _gap / 2).tolist(),
        y=(_planet_r * np.sin(_theta)).tolist(),
        fill="toself",
        fillcolor="rgba(255,107,53,0.45)",
        line=dict(color="#FF6B35", width=2),
        name=_planet_name,
        hoverinfo="text",
        text=f"{_planet_name}<br>Radius: {_planet_r:.2f} R\u2295",
    ))

    _fig.add_annotation(x=-_gap / 2, y=-_max_r * 0.95, text="Earth (1.00 R\u2295)",
                         showarrow=False, font=dict(color="cornflowerblue", size=13))
    _fig.add_annotation(x=_gap / 2, y=-_max_r * 0.95, text=f"{_planet_name} ({_planet_r:.2f} R\u2295)",
                         showarrow=False, font=dict(color="#FF6B35", size=13))

    _fig.update_layout(
        template="plotly_dark",
        title="Size Comparison \u2014 Earth vs. Top Match",
        paper_bgcolor="#1a1a2e",
        plot_bgcolor="#1a1a2e",
        font_color="#e0e0e0",
        xaxis=dict(visible=False, scaleanchor="y", scaleratio=1),
        yaxis=dict(visible=False),
        showlegend=False,
        height=400,
        margin=dict(l=20, r=20, t=50, b=40),
    )

    mo.ui.plotly(_fig)
    return


@app.cell
def _(filtered, mission_mode, mo, np, os):
    _top = filtered.head(1)
    _ai_summary = ""
    _is_mission = mission_mode.value

    def _safe_val(series_row, key, fallback="unknown"):
        v = series_row.get(key, fallback)
        if isinstance(v, float) and np.isnan(v):
            return fallback
        return v

    if len(_top) > 0:
        _row = _top.iloc[0]
        _dist = _safe_val(_row, "sy_dist", "unknown")
        _teq = _safe_val(_row, "pl_eqt", "unknown")
        _year = _safe_val(_row, "disc_year", "unknown")
        _year_s = str(int(_year)) if isinstance(_year, (int, float)) else str(_year)
        _viab = _row.get("viability", 0)

        if _is_mission:
            _prompt = (
                f"Write a one-sentence mission briefing in the voice of a NASA "
                f"mission director. Target: {_row['pl_name']}. Distance: {_dist} parsecs. "
                f"ESI: {_row['esi']:.3f}. Viability: {_viab:.4f}. "
                f"Keep it tense and concrete."
            )
        else:
            _prompt = (
                f"In one engaging sentence aimed at a general audience, describe the "
                f"exoplanet {_row['pl_name']}. It has radius {_row['pl_rade']:.2f} Earth radii, "
                f"mass {_row['pl_bmasse']:.2f} Earth masses, equilibrium temperature "
                f"{_teq} K, located {_dist} "
                f"parsecs away, discovered in {_year_s}. "
                f"Compare it concretely to Earth."
            )

        try:
            import google.generativeai as genai
            _api_key = os.environ.get("GEMINI_API_KEY", "")
            if not _api_key:
                raise ValueError("No GEMINI_API_KEY set")
            genai.configure(api_key=_api_key)
            _model = genai.GenerativeModel("gemini-2.0-flash")
            _response = _model.generate_content(
                _prompt,
                request_options={"timeout": 4},
            )
            _ai_summary = _response.text
        except Exception:
            if _is_mission:
                _dist_str = f"{_dist:.1f}" if isinstance(_dist, (int, float)) else str(_dist)
                _ai_summary = (
                    f"MISSION BRIEF: Target {_row['pl_name']} at {_dist_str} pc. "
                    f"Viability index {_viab:.4f}. ESI {_row['esi']:.3f}. "
                    f"Recommend immediate trajectory analysis for crewed rendezvous."
                )
            else:
                _temp_val = _row.get("pl_eqt", 255)
                if isinstance(_temp_val, float) and np.isnan(_temp_val):
                    _temp_val = 255
                _temp_desc = "scorching" if _temp_val > 350 else "chilly" if _temp_val < 200 else "temperate"
                _dist_str = f"{_dist:.1f}" if isinstance(_dist, (int, float)) else str(_dist)
                _ai_summary = (
                    f"{_row['pl_name']} is {_dist_str} parsecs from Earth. "
                    f"With a radius of {_row['pl_rade']:.2f}\u00d7 Earth's and a temperature of "
                    f"{_teq} K, it's a {_temp_desc} world that "
                    f"{'closely resembles' if _row['esi'] > 0.8 else 'echoes some features of'} our home planet."
                )
    else:
        _ai_summary = "No planets match the current filters. Try broadening your search!"

    _label = "**\U0001f6a8 Mission Briefing:**" if _is_mission else "**\U0001f916 AI Insight:**"
    _kind = "warn" if _is_mission else "info"
    mo.callout(mo.md(f"{_label} {_ai_summary}"), kind=_kind)
    return


@app.cell
def _(filtered, mission_mode, mo, np):
    if mission_mode.value and len(filtered) > 0:
        _target = filtered.iloc[0]
        _dist_pc = _target.get("sy_dist", float("nan"))
        if isinstance(_dist_pc, float) and np.isnan(_dist_pc):
            _dist_pc_s = "unknown"
            _travel_s = "unknown"
        else:
            _dist_pc_s = f"{_dist_pc:.1f}"
            _ly = _dist_pc * 3.2616
            _travel_years = _ly / 0.5
            _travel_s = f"~{_travel_years:,.0f} years"

        _teff = _target.get("st_teff", float("nan"))
        if isinstance(_teff, float) and not np.isnan(_teff):
            if _teff > 7500:
                _star_type = "A-type (hot)"
            elif _teff > 6000:
                _star_type = "F/G-type (Sun-like)"
            elif _teff > 3700:
                _star_type = "K-type (orange dwarf)"
            else:
                _star_type = "M-type (red dwarf)"
        else:
            _star_type = "unknown"

        _params_md = (
            f"| Parameter | Value |\n"
            f"|---|---|\n"
            f"| **Target** | {_target['pl_name']} ({_target['hostname']}) |\n"
            f"| **Distance** | {_dist_pc_s} pc ({_travel_s} at 0.5c) |\n"
            f"| **ESI** | {_target['esi']:.3f} |\n"
            f"| **Viability** | {_target['viability']:.4f} |\n"
            f"| **Host Star** | {_star_type} (T_eff = {_teff:.0f} K) |\n"
        )

        mo.callout(
            mo.md(f"### \U0001f680 MISSION PARAMETERS\n\n{_params_md}"),
            kind="danger",
        )
    else:
        mo.md("")
    return


@app.cell
def _(filtered, go, mo, px):
    _method_counts = filtered["discoverymethod"].value_counts().reset_index()
    _method_counts.columns = ["Method", "Count"]

    if len(_method_counts) > 0:
        _bar_fig = px.bar(
            _method_counts,
            x="Count",
            y="Method",
            orientation="h",
            template="plotly_dark",
            title="Detection Methods (filtered planets)",
            color="Count",
            color_continuous_scale="Oranges",
        )
    else:
        _bar_fig = go.Figure()
        _bar_fig.update_layout(
            template="plotly_dark",
            title="Detection Methods \u2014 no matches yet",
        )

    _bar_fig.update_layout(
        paper_bgcolor="#1a1a2e",
        plot_bgcolor="#16213e",
        font_color="#e0e0e0",
        height=300,
        showlegend=False,
    )

    mo.ui.plotly(_bar_fig)
    return


@app.cell
def _(mo):
    mo.md("""
    Built with [marimo](https://marimo.io) + Cursor (marimo-pair) for PyData Boston 2026. "
        "Data: [NASA Exoplanet Archive](https://exoplanetarchive.ipac.caltech.edu/). "
        "🛸 Mission mode inspired by *Project Hail Mary* by Andy Weir.
    """)
    return


if __name__ == "__main__":
    app.run()
