# /// script
# requires-python = ">=3.14"
# dependencies = [
#     "marimo",
#     "matplotlib==3.10.9",
#     "numpy==2.4.4",
#     "pandas==3.0.3",
#     "scikit-learn==1.8.0",
# ]
# ///

import marimo

__generated_with = "0.23.6"
app = marimo.App(width="medium")


@app.cell(hide_code=True)
def notebook_imports():
    import csv
    import io
    from pathlib import Path
    from textwrap import dedent
    from zoneinfo import ZoneInfo

    import marimo as mo
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    import numpy as np
    import pandas as pd
    from sklearn.neighbors import BallTree

    return BallTree, Path, ZoneInfo, csv, dedent, io, mo, np, pd, plt


@app.cell(hide_code=True)
def intro_markdown(dedent, mo):
    return mo.md(
        dedent(
            r"""
            # Bluebikes after dark and the lit street grid

            **Lens:** compare *night* trip ends (9pm–6am) to *day* ends using distance to the **nearest streetlight** among ~74k city fixtures.

            **Data:** Bluebikes Feb–Apr 2026 trip files, Boston streetlight locations, hospital locations (coordinate sanity check), and the BTD traffic *study catalog* CSV.
            """
        ).strip()
    )


@app.cell(hide_code=True)
def paths(Path):
    ROOT = Path(__file__).resolve().parent
    DATA_DIR = ROOT / "data" / "funny boston data"
    return (DATA_DIR,)


@app.cell(hide_code=True)
def load_trips(DATA_DIR, ZoneInfo, pd):
    paths = [
        DATA_DIR / "202602-bluebikes-tripdata.csv",
        DATA_DIR / "202603-bluebikes-tripdata.csv",
        DATA_DIR / "202604-bluebikes-tripdata.csv",
    ]
    trips = pd.concat([pd.read_csv(p) for p in paths], ignore_index=True)
    trips["ended_at"] = pd.to_datetime(trips["ended_at"], utc=True).dt.tz_convert(
        ZoneInfo("America/New_York")
    )
    trips["hour"] = trips["ended_at"].dt.hour
    trips["is_night"] = (trips["hour"] >= 21) | (trips["hour"] < 6)
    trips = trips.dropna(subset=["end_lat", "end_lng"])
    return (trips,)


@app.cell(hide_code=True)
def load_light_radians(DATA_DIR, np, pd):
    lights = pd.read_csv(DATA_DIR / "streetlight-locations.csv")
    light_radians = np.radians(lights[["Lat", "Long"]].dropna().values.astype(np.float64))
    return (light_radians,)


@app.cell(hide_code=True)
def light_tree(BallTree, light_radians):
    light_tree = BallTree(light_radians, metric="haversine")
    return (light_tree,)


@app.cell(hide_code=True)
def nearest_light_distance(light_tree, np, trips):
    ends = np.radians(trips[["end_lat", "end_lng"]].values.astype(np.float64))
    d_rad, _ = light_tree.query(ends, k=1)
    earth_r_m = 6_371_000.0
    trips_scored = trips.assign(nearest_light_m=(d_rad.ravel() * earth_r_m).astype(np.float32))
    return (trips_scored,)


@app.cell(hide_code=True)
def night_day_summary(trips_scored):
    night_median_m = float(
        trips_scored.loc[trips_scored["is_night"], "nearest_light_m"].median()
    )
    day_median_m = float(
        trips_scored.loc[~trips_scored["is_night"], "nearest_light_m"].median()
    )
    n_night = int(trips_scored["is_night"].sum())
    n_day = int((~trips_scored["is_night"]).sum())
    return day_median_m, n_day, n_night, night_median_m


@app.cell(hide_code=True)
def distance_boxplot(dedent, io, mo, plt, trips_scored):
    _fig, _ax = plt.subplots(figsize=(9, 4.5))
    day_d = trips_scored.loc[~trips_scored["is_night"], "nearest_light_m"].clip(upper=500)
    night_d = trips_scored.loc[trips_scored["is_night"], "nearest_light_m"].clip(upper=500)
    _ax.boxplot(
        [day_d, night_d],
        tick_labels=["Day ends (6:00–21:00)", "Night ends (21:00–6:00)"],
        showfliers=False,
    )
    _ax.set_ylabel("Distance to nearest streetlight (m, clipped at 500)")
    _ax.set_title("Trip end proximity to streetlights: day vs night")
    _fig.tight_layout()
    _buf = io.BytesIO()
    _fig.savefig(_buf, format="png", bbox_inches="tight", dpi=120)
    plt.close(_fig)
    _caption = mo.md(
        dedent(
            """
            **Figure:** side-by-side boxplots of nearest-streetlight distance at trip *end* (winsorized display clip at 500 m; outliers hidden).
            """
        ).strip()
    )
    return mo.vstack(_caption, mo.image(_buf.getvalue()))


@app.cell(hide_code=True)
def trip_ends_map_scatter(dedent, io, mo, np, plt, trips_scored):
    rng = np.random.default_rng(42)
    n = min(12_000, len(trips_scored))
    idx = rng.choice(len(trips_scored), size=n, replace=False)
    sample = trips_scored.iloc[idx]
    _fig, _ax = plt.subplots(figsize=(8.5, 8.5))
    _sc = _ax.scatter(
        sample["end_lng"],
        sample["end_lat"],
        c=sample["nearest_light_m"],
        cmap="viridis",
        vmin=0,
        vmax=250,
        alpha=0.35,
        s=5,
        edgecolors="none",
    )
    _ax.set_xlabel("Longitude")
    _ax.set_ylabel("Latitude")
    _ax.set_title("Trip ends (subsample): color = distance to nearest streetlight (m)")
    _ax.set_aspect("equal", adjustable="box")
    _fig.colorbar(_sc, ax=_ax, label="Nearest light (m)", shrink=0.72)
    _fig.tight_layout()
    _buf = io.BytesIO()
    _fig.savefig(_buf, format="png", bbox_inches="tight", dpi=130)
    plt.close(_fig)
    _caption = mo.md(
        dedent(
            """
            **Map-style view:** 12,000 trip ends (or fewer if the dataset is smaller), uniform random subsample with seed **42**. Color shows each end’s distance to the nearest of ~74k streetlight points (not a street-network buffer).
            """
        ).strip()
    )
    return mo.vstack(_caption, mo.image(_buf.getvalue()))


@app.cell(hide_code=True)
def thesis_markdown(day_median_m, dedent, mo, n_day, n_night, night_median_m):
    pct_night = 100.0 * n_night / (n_night + n_day)
    if night_median_m < day_median_m:
        comp = "closer"
        hint = "night travel may be more concentrated in the dense, well-lit downtown grid than daytime ends spread across the system"
    else:
        comp = "farther"
        hint = "daytime ends may sit closer to fixtures than night ends in this sample — worth exploring station siting and suburbs"
    body = dedent(
        f"""
        ### One-line takeaway

        **Night trip ends are about {night_median_m:.0f} m from the nearest streetlight (median), versus {day_median_m:.0f} m during the day — night ends are *{comp}* on average**, while night rides are only ~{pct_night:.1f}% of trips. That pattern is *descriptive* and is plausibly related to {hint}.

        This is not proof that riders choose lit corridors; confounders include where stations sit and land use.
        """
    ).strip()
    return mo.md(body)


@app.cell(hide_code=True)
def hospital_section_markdown(dedent, mo):
    return mo.md(
        dedent(
            r"""
            ### Hospital coordinates (sanity check)

            Parsed WGS84 from `Location` vs `lat ≈ YCOORD/1e6`, `lon ≈ -XCOORD/1e6` (sample rows and aggregate error in meters).
            """
        ).strip()
    )


@app.cell(hide_code=True)
def hospital_xy_validation(DATA_DIR, csv, dedent, mo, np, pd):
    with open(DATA_DIR / "hospital-locations.csv", newline="", encoding="utf-8") as f:
        hrows = list(csv.DictReader(f))
    hosp = pd.DataFrame(hrows)
    hosp["lat_parsed"] = hosp["Location"].str.extract(
        r"\(([-0-9.]+),", expand=False
    ).astype(float)
    hosp["lon_parsed"] = hosp["Location"].str.extract(
        r",\s*([-0-9.]+)\)", expand=False
    ).astype(float)
    hosp["XCOORD"] = hosp["XCOORD"].astype(np.int64)
    hosp["YCOORD"] = hosp["YCOORD"].astype(np.int64)
    hosp["lat_from_y"] = hosp["YCOORD"] / 1_000_000.0
    hosp["lon_from_x"] = -(hosp["XCOORD"] / 1_000_000.0)
    dlat_m = (hosp["lat_parsed"] - hosp["lat_from_y"]) * 111_000.0
    dlon_m = (hosp["lon_parsed"] - hosp["lon_from_x"]) * 111_000.0 * np.cos(
        np.radians(hosp["lat_parsed"])
    )
    hosp["xy_vs_wgs84_m"] = np.sqrt(dlat_m**2 + dlon_m**2)
    max_xy_error_m = float(hosp["xy_vs_wgs84_m"].max())
    mean_xy_error_m = float(hosp["xy_vs_wgs84_m"].mean())
    preview = hosp[
        ["NAME", "lat_parsed", "lon_parsed", "lat_from_y", "lon_from_x", "xy_vs_wgs84_m"]
    ].head(5)
    stats = mo.md(
        dedent(
            f"""
            **Aggregate:** mean absolute mismatch ≈ **{mean_xy_error_m:.0f} m**, worst hospital ≈ **{max_xy_error_m:.0f} m** (rough planar approximation).

            **Sample rows:**
            """
        ).strip()
    )
    return mo.vstack(stats, mo.ui.table(preview))


@app.cell(hide_code=True)
def traffic_section_markdown(dedent, mo):
    return mo.md(
        dedent(
            r"""
            ### Traffic file = study catalog (not volumes)

            Rows describe archived **traffic studies** (dates, neighborhood, study type). There are **no hourly vehicle counts** in this CSV — only where studies were logged.
            """
        ).strip()
    )


@app.cell(hide_code=True)
def traffic_study_catalog(DATA_DIR, pd):
    traffic = pd.read_csv(DATA_DIR / "city-of-boston-traffic-data-collection.csv")
    nb_counts = (
        traffic.groupby("Neighborhood Code", dropna=False)
        .size()
        .sort_values(ascending=False)
        .head(15)
    )
    return (nb_counts,)


@app.cell(hide_code=True)
def traffic_bar_png(dedent, io, mo, nb_counts, plt):
    _fig, _ax = plt.subplots(figsize=(9, 4.5))
    nb_counts.sort_values().plot(kind="barh", ax=_ax, color="#2ca02c")
    _ax.set_xlabel("Number of study records (rows in this CSV)")
    _ax.set_ylabel("Neighborhood code")
    _ax.set_title(
        "Boston traffic study catalog: where rows were archived (not vehicle volumes)"
    )
    _fig.tight_layout()
    _buf = io.BytesIO()
    _fig.savefig(_buf, format="png", bbox_inches="tight", dpi=120)
    plt.close(_fig)
    _caption = mo.md(
        dedent(
            """
            **Figure:** horizontal bar chart of how many *catalog rows* fall under each `Neighborhood Code` in the BTD extract — useful for “where did the city file paperwork,” not for congestion intensity.
            """
        ).strip()
    )
    return mo.vstack(_caption, mo.image(_buf.getvalue()))


@app.cell(hide_code=True)
def caveats_markdown(dedent, mo):
    return mo.md(
        dedent(
            r"""
            ### Data caveats

            - **Traffic CSV:** metadata about *traffic study artifacts* — not congestion or AADT.
            - **Streetlights:** static fixture locations; lamp type, outages, and canopy are not modeled.
            - **Night definition:** fixed clock hours (9pm–6am local) — no sunset variation.
            - **Hospitals:** use parsed lat/lon from `Location` for mapping; `XCOORD`/`YCOORD` scaling is approximate (see table above).
            """
        ).strip()
    )


if __name__ == "__main__":
    app.run()
