# /// script
# dependencies = [
#     "marimo",
#     "folium==0.20.0",
#     "pyproj",
#     "pandas==3.0.3",
# ]
# requires-python = ">=3.14"
# ///

import marimo

__generated_with = "0.23.6"
app = marimo.App(width="medium")


@app.cell(hide_code=True)
def imports():
    import html

    import marimo as mo
    import folium
    import pandas as pd
    from pathlib import Path
    from pyproj import Transformer
    from folium.plugins import MarkerCluster, HeatMap
    (mo, folium, html, pd, Path, Transformer, MarkerCluster, HeatMap)
    return HeatMap, MarkerCluster, Path, Transformer, folium, html, mo, pd


@app.cell(hide_code=True)
def liquor_map_intro(mo):
    mo.md(r"""
    ### Liquor license locations (interactive map)

    Boston open-data export ``tmpy2tro3vm.csv``: coordinates are **EPSG:2249** (MA State Plane, US survey feet) in ``gpsx`` / ``gpsy``, reprojected to **WGS84** for Folium. Markers are **clustered** for performance (~1.5k points).
    """)
    return


@app.cell(hide_code=True)
def liquor_license_map(MarkerCluster, Path, Transformer, folium, html, mo, pd):
    base = Path.cwd()
    path = base / "tmpy2tro3vm.csv"
    if not path.is_file():
        path = Path(__file__).resolve().parent / "tmpy2tro3vm.csv"
    liquor_df = pd.read_csv(path)
    df = liquor_df[
        liquor_df["gpsx"].notna() & liquor_df["gpsy"].notna() &
        (liquor_df["gpsx"] != 0) & (liquor_df["gpsy"] != 0)
    ].copy()
    transformer = Transformer.from_crs("EPSG:2249", "EPSG:4326", always_xy=True)
    lon, lat = transformer.transform(
        df["gpsx"].astype("float64").to_numpy(),
        df["gpsy"].astype("float64").to_numpy(),
    )
    df = df.assign(lon=lon, lat=lat)
    center_lat = float(df["lat"].mean())
    center_lon = float(df["lon"].mean())
    m = folium.Map(
        location=[center_lat, center_lon],
        zoom_start=10,
        tiles="OpenStreetMap",
        control_scale=True,
    )
    cluster = MarkerCluster(name="Licenses").add_to(m)
    for _, row in df.iterrows():
        dba = row.get("dba_name")
        biz = row.get("business_name", "")
        if isinstance(dba, str) and dba.strip():
            label = dba.strip()
        elif isinstance(biz, str):
            label = biz.strip()[:120]
        else:
            label = ""
        addr = str(row.get("address", "") or "")[:140]
        ltype = str(row.get("license_type", "") or "")[:160]
        text = chr(10).join([html.escape(label), html.escape(addr), html.escape(ltype)])
        folium.CircleMarker(
            location=[float(row["lat"]), float(row["lon"])],
            radius=4,
            color="#1d4ed8",
            weight=1,
            fill=True,
            fill_color="#38bdf8",
            fill_opacity=0.78,
            popup=folium.Popup(text, max_width=280),
        ).add_to(cluster)
    south = float(df["lat"].min())
    west = float(df["lon"].min())
    north = float(df["lat"].max())
    east = float(df["lon"].max())
    m.fit_bounds([[south, west], [north, east]], padding=(28, 28))
    mo.Html(m._repr_html_())
    return center_lat, center_lon, df, east, north, south, west


@app.cell(hide_code=True)
def _(mo):
    mo.md(r"""
    ### Liquor license density (KDE heatmap)

    Same dataset, different lens: kernel density estimation shows **where licenses concentrate**
    across the city. Warmer colors = higher density. Zoom in to explore neighborhoods.
    """)
    return


@app.cell(hide_code=True)
def _(
    HeatMap,
    center_lat,
    center_lon,
    df,
    east,
    folium,
    mo,
    north,
    south,
    west,
):
    heat_m = folium.Map(
        location=[center_lat, center_lon],
        zoom_start=13,
        tiles="CartoDB dark_matter",
        control_scale=True,
    )
    heat_data = df[["lat", "lon"]].values.tolist()
    HeatMap(
        heat_data,
        radius=18,
        blur=14,
        min_opacity=0.35,
        gradient={0.3: "#0ea5e9", 0.6: "#a855f7", 0.8: "#ef4444", 1.0: "#fbbf24"},
    ).add_to(heat_m)
    heat_m.fit_bounds([[south, west], [north, east]], padding=(28, 28))
    mo.Html(heat_m._repr_html_())
    return


@app.cell(hide_code=True)
def time_heatmap_intro(mo):
    mo.md(r"""
    ### Open establishments by time of day
    """)
    return


@app.cell(hide_code=True)
def df_time_prep(df, pd):
    import re as _re

    def _parse_closing(s):
        if pd.isna(s):
            return None
        raw = str(s).strip()
        cleaned = _re.sub(r"\s+", "", raw).upper().replace(".", "")
        if cleaned in ("MIDNIGHT", "12:00AM", "1200AM"):
            return 0
        if cleaned.startswith("TO:"):
            raw = raw[3:].strip()
        raw = _re.sub(r"\s+", "", raw)
        raw = _re.sub(r"\.(?=\d)", ":", raw)
        m = _re.match(r"^(\d{1,2}):?(\d{2})\s*([APap]\.?[Mm]\.?)$", raw)
        if m:
            h, mn = int(m.group(1)), int(m.group(2))
            p = m.group(3).upper().replace(".", "")
            h = (0 if h == 12 else h) if "A" in p else (h if h == 12 else h + 12)
            return h * 60 + mn
        m2 = _re.match(r"^(\d{1,2}):(\d{2})$", raw)
        if m2:
            h, mn = int(m2.group(1)), int(m2.group(2))
            return (0 if h == 12 else h + 12) * 60 + mn
        return None

    def _adjust(mins):
        return None if mins is None else mins + 1440 if mins < 360 else mins

    def _fmt_hour(h):
        a = h % 24
        return f"{a % 12 or 12}:00 {'AM' if a < 12 else 'PM'}"

    _cadj = df["closing"].apply(_parse_closing).apply(_adjust)
    df_time = df.assign(closing_adj=_cadj).loc[_cadj.notna()].copy()
    return (df_time,)


@app.cell(hide_code=True)
def time_slider(mo):
    tod_slider = mo.ui.slider(start=6, stop=28, step=1, value=20, show_value=False, label="Hour of day")
    tod_slider
    return (tod_slider,)


@app.cell
def _():
    return


@app.cell(hide_code=True)
def time_heatmap(
    HeatMap,
    center_lat,
    center_lon,
    df_time,
    east,
    folium,
    mo,
    north,
    south,
    tod_slider,
    west,
):
    _hour = tod_slider.value
    _open = df_time[df_time["closing_adj"] >= _hour * 60]
    _m = folium.Map(
        location=[center_lat, center_lon], zoom_start=13,
        tiles="CartoDB dark_matter", control_scale=True,
    )
    HeatMap(
        _open[["lat", "lon"]].values.tolist(),
        radius=18, blur=14, min_opacity=0.35,
        gradient={0.3: "#0ea5e9", 0.6: "#a855f7", 0.8: "#ef4444", 1.0: "#fbbf24"},
    ).add_to(_m)
    _m.fit_bounds([[south, west], [north, east]], padding=(28, 28))
    mo.vstack([
        mo.md(f"*{len(_open):,} of {len(df_time):,} establishments still open*"),
        mo.Html(_m._repr_html_()),
    ])
    return


if __name__ == "__main__":
    app.run()
