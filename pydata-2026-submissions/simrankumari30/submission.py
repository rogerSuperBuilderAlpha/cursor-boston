# /// script
# dependencies = [
#     "marimo",
#     "matplotlib==3.10.9",
#     "pandas==3.0.3",
# ]
# requires-python = ">=3.11"
# ///

import marimo

__generated_with = "0.23.6"
app = marimo.App(width="medium")


@app.cell
def _():
    return


@app.cell(hide_code=True)
def _():
    import marimo as mo

    mo.md("Hello!")
    return


@app.cell
def _():
    from pathlib import Path
    import urllib.request
    import zipfile

    DATA_DIR = Path.cwd() / "data" / "mbta"
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    urllib.request.urlretrieve(
        "https://cdn.mbta.com/archive/archived_feeds.txt",
        DATA_DIR / "archived_feeds.txt",
    )

    zip_path = DATA_DIR / "gtfs_20260429.zip"
    urllib.request.urlretrieve(
        "https://cdn.mbtace.com/archive/20260429.zip",
        zip_path,
    )

    extract_dir = DATA_DIR / "gtfs_20260429"
    extract_dir.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(zip_path, "r") as zf:
        zf.extractall(extract_dir)

    summary = {
        "data_dir": str(DATA_DIR.resolve()),
        "gtfs_txt_count": sum(1 for p in extract_dir.glob("*.txt")),
        "sample_tables": sorted(p.name for p in extract_dir.glob("*.txt"))[:10],
    }
    summary
    return (extract_dir,)


@app.cell
def _(extract_dir):
    import csv

    schema_rows = []
    for path in sorted(extract_dir.glob("*.txt")):
        with path.open(newline="", encoding="utf-8", errors="replace") as f:
            header = next(csv.reader(f), [])
        schema_rows.append(
            {
                "file": path.name,
                "num_columns": len(header),
                "columns": header,
            }
        )

    schema_rows
    return


@app.cell
def _(extract_dir):
    import csv as _csv
    from collections import Counter

    import matplotlib.pyplot as plt

    rt_counts: list[int] = []
    with (extract_dir / "routes.txt").open(newline="", encoding="utf-8", errors="replace") as routes_file:
        for row in _csv.DictReader(routes_file):
            rt_counts.append(int(row["route_type"]))

    by_type = Counter(rt_counts)
    label_map = {
        0: "Tram / LRT",
        1: "Subway / metro",
        2: "Rail",
        3: "Bus",
        4: "Ferry",
        5: "Cable tram",
        6: "Aerial lift",
        7: "Funicular",
        11: "Trolleybus",
        12: "Monorail",
    }

    order = sorted(by_type.keys())
    labels = [label_map.get(k, "Type " + str(k)) for k in order]
    values = [by_type[k] for k in order]

    fig, ax = plt.subplots(figsize=(9, 4.5))
    ax.bar(labels, values, color="#2a6f97", edgecolor="#023047", linewidth=0.6)
    ax.set_title("MBTA GTFS: number of routes by route_type")
    ax.set_ylabel("Route count")
    ax.tick_params(axis="x", rotation=35)
    fig.tight_layout()
    fig
    return


@app.cell
def _(extract_dir):
    import csv as csv_bus
    from collections import defaultdict

    import matplotlib.pyplot as mpl

    bus_route_ids: set[str] = set()
    with (extract_dir / "routes.txt").open(newline="", encoding="utf-8", errors="replace") as routes_fh:
        for rec in csv_bus.DictReader(routes_fh):
            if rec["route_type"] == "3":
                bus_route_ids.add(rec["route_id"])

    bus_shape_ids: set[str] = set()
    with (extract_dir / "trips.txt").open(newline="", encoding="utf-8", errors="replace") as trips_fh:
        for rec in csv_bus.DictReader(trips_fh):
            if rec["route_id"] not in bus_route_ids:
                continue
            sid = (rec.get("shape_id") or "").strip()
            if sid:
                bus_shape_ids.add(sid)

    by_shape: dict[str, list[tuple[int, float, float]]] = defaultdict(list)
    with (extract_dir / "shapes.txt").open(newline="", encoding="utf-8", errors="replace") as shapes_fh:
        for rec in csv_bus.DictReader(shapes_fh):
            sid = rec["shape_id"]
            if sid not in bus_shape_ids:
                continue
            seq = int(rec["shape_pt_sequence"])
            lat = float(rec["shape_pt_lat"])
            lon = float(rec["shape_pt_lon"])
            by_shape[sid].append((seq, lat, lon))

    fig_bus, ax_bus = mpl.subplots(figsize=(10, 9))
    for sid, pts in by_shape.items():
        pts.sort(key=lambda t: t[0])
        lats = [t[1] for t in pts]
        lons = [t[2] for t in pts]
        ax_bus.plot(lons, lats, color="#c1121f", linewidth=0.35, alpha=0.4)

    ax_bus.set_aspect("equal", adjustable="box")
    ax_bus.set_xlabel("Longitude")
    ax_bus.set_ylabel("Latitude")
    ax_bus.set_title("MBTA bus routes (GTFS shape polylines)")
    ax_bus.grid(True, alpha=0.25)
    fig_bus.tight_layout()
    fig_bus
    return


@app.cell
def _():
    import pathlib
    import urllib.request as urlrequest

    _mbta_data = pathlib.Path.cwd() / "data" / "mbta"
    _mbta_data.mkdir(parents=True, exist_ok=True)
    reliability_csv = _mbta_data / "reliability_opendata.csv"
    _rel_url = "https://mbta-massdot.opendata.arcgis.com/datasets/b3a24561c2104422a78b593e92b566d5_0.csv"
    if not reliability_csv.exists():
        urlrequest.urlretrieve(_rel_url, str(reliability_csv))
    reliability_csv
    return (reliability_csv,)


@app.cell
def _(extract_dir, reliability_csv):
    import csv as csv_map
    from collections import Counter, defaultdict

    import matplotlib as mpl_map
    import matplotlib.pyplot as plt_map
    import numpy as np
    import pandas as pd
    from matplotlib import colors as mcolors
    from matplotlib.collections import LineCollection

    _usecols = ["mode_type", "gtfs_route_short_name", "otp_numerator", "otp_denominator"]

    trip_nums: dict[str, int] = {}
    trip_dens: dict[str, int] = {}

    for _chunk in pd.read_csv(
        reliability_csv,
        usecols=_usecols,
        chunksize=300_000,
        encoding="utf-8-sig",
        dtype={"gtfs_route_short_name": "string", "mode_type": "string"},
    ):
        _bus = _chunk[_chunk["mode_type"] == "Bus"]
        if _bus.empty:
            continue
        _grp = _bus.groupby("gtfs_route_short_name", sort=False)[["otp_numerator", "otp_denominator"]].sum()
        for _route, _row in _grp.iterrows():
            trip_nums[_route] = trip_nums.get(_route, 0) + int(_row["otp_numerator"])
            trip_dens[_route] = trip_dens.get(_route, 0) + int(_row["otp_denominator"])

    _rec = []
    for _route in trip_nums:
        _d = trip_dens[_route]
        if _d < 1:
            continue
        _n = trip_nums[_route]
        _rec.append(
            {
                "route": _route,
                "otp_numerator": _n,
                "otp_denominator": _d,
                "reliability_pct": 100.0 * _n / _d,
            }
        )

    _otp_df = pd.DataFrame(_rec)
    _min_obs = 25_000
    _sig = (
        _otp_df[_otp_df["otp_denominator"] >= _min_obs]
        .sort_values("reliability_pct", ascending=False)
        .reset_index(drop=True)
    )

    _best = _sig.head(15).copy()
    _worst = _sig.tail(15).sort_values("reliability_pct").copy()
    pct_lookup = dict(zip(_sig["route"].astype(str), _sig["reliability_pct"]))

    rid_to_short: dict[str, str] = {}
    with (extract_dir / "routes.txt").open(newline="", encoding="utf-8", errors="replace") as fh:
        for rec in csv_map.DictReader(fh):
            if rec["route_type"] == "3":
                rid_to_short[rec["route_id"]] = str(rec["route_short_name"])

    shape_rid_ctr: dict[str, Counter] = defaultdict(Counter)
    with (extract_dir / "trips.txt").open(newline="", encoding="utf-8", errors="replace") as fh:
        for rec in csv_map.DictReader(fh):
            rid = rec["route_id"]
            sid = (rec.get("shape_id") or "").strip()
            if sid and rid in rid_to_short:
                shape_rid_ctr[sid][rid] += 1

    shape_to_short: dict[str, str] = {}
    for sid, ctr in shape_rid_ctr.items():
        best_rid, _ = ctr.most_common(1)[0]
        shape_to_short[sid] = rid_to_short[best_rid]

    by_shape: dict[str, list[tuple[int, float, float]]] = defaultdict(list)
    with (extract_dir / "shapes.txt").open(newline="", encoding="utf-8", errors="replace") as fh:
        for rec in csv_map.DictReader(fh):
            sid = rec["shape_id"]
            if sid not in shape_to_short:
                continue
            seq = int(rec["shape_pt_sequence"])
            lat = float(rec["shape_pt_lat"])
            lon = float(rec["shape_pt_lon"])
            by_shape[sid].append((seq, lon, lat))

    def _segments_for_routes(route_shorts: set[str]) -> tuple[list[np.ndarray], list[float]]:
        segs: list[np.ndarray] = []
        pcts: list[float] = []
        for sid, pts in by_shape.items():
            rname = shape_to_short.get(sid)
            if rname is None or rname not in route_shorts:
                continue
            pc = pct_lookup.get(rname)
            if pc is None:
                continue
            pts.sort(key=lambda t: t[0])
            arr = np.array([[p[1], p[2]] for p in pts], dtype=float)
            if arr.shape[0] < 2:
                continue
            segs.append(arr)
            pcts.append(float(pc))
        return segs, pcts

    def _draw_route_map(route_shorts: set[str], title: str, dark_bg: bool):
        segs, pcts = _segments_for_routes(route_shorts)
        if not segs:
            fig, ax = plt_map.subplots(figsize=(8, 3))
            ax.text(0.5, 0.5, "No shapes for these routes", ha="center", va="center")
            ax.axis("off")
            return fig

        vmin, vmax = min(pcts), max(pcts)
        if vmax - vmin < 1e-9:
            vmax = vmin + 1e-6
        norm = mcolors.Normalize(vmin=vmin, vmax=vmax)
        cmap = mpl_map.colormaps["magma"]

        style = "dark_background" if dark_bg else "default"
        with plt_map.style.context(style):
            fig, ax = plt_map.subplots(figsize=(10, 9))
            if dark_bg:
                fig.patch.set_facecolor("#0d1117")
                ax.set_facecolor("#0d1117")
            line_segs = [np.column_stack([s[:, 0], s[:, 1]]) for s in segs]
            lc = LineCollection(
                line_segs,
                cmap=cmap,
                norm=norm,
                array=np.array(pcts, dtype=float),
                linewidths=2.2 if dark_bg else 1.8,
                alpha=0.95,
            )
            ax.add_collection(lc)
            ax.autoscale()
            ax.set_aspect("equal", adjustable="box")
            ax.set_title(title, fontsize=12)
            ax.set_xlabel("Longitude")
            ax.set_ylabel("Latitude")
            if not dark_bg:
                ax.grid(True, alpha=0.35)
            cbar = fig.colorbar(lc, ax=ax, shrink=0.72, pad=0.02)
            cbar.set_label("Adherence % (dark → light = lower → higher)")
        fig.tight_layout()
        return fig

    _notes = (
        "Source: MBTA MassDOT ArcGIS reliability export (bus **Headway / Schedule Adherence**). "
        "Lines use GTFS shapes; each shape is colored by that route’s `reliability_pct` within the highlighted set. "
        "Map **1** uses a **dark** figure style; map **2** uses a **light** figure style. "
        "Colormap **magma** is the same direction on both: **dark = lower %**, **light = higher %**."
    )

    fig_map_dark = _draw_route_map(
        set(_best["route"].astype(str)),
        "1 — Best-performing bus routes (dark map, magma: dark→light by %)",
        dark_bg=True,
    )
    fig_map_light = _draw_route_map(
        set(_worst["route"].astype(str)),
        "2 — Most delayed bus routes (light map, same dark→light scale)",
        dark_bg=False,
    )
    return


@app.cell
def _():
    return


if __name__ == "__main__":
    app.run()
