# /// script
# dependencies = [
#     "marimo",
#     "numpy==2.4.4",
#     "plotly==6.7.0",
#     "polars==1.40.1",
# ]
# requires-python = ">=3.14"
# ///

import marimo

__generated_with = "0.23.6"
app = marimo.App(width="medium")


@app.cell(hide_code=True)
def imports():
    import marimo as mo
    import polars as pl
    import plotly.graph_objects as go
    from pathlib import Path

    return Path, go, mo, pl


@app.cell(hide_code=True)
def project_story(mo):
    mo.md("""
    # MBTA Reliability Oracle

    This notebook builds a fast, hackathon-ready reliability baseline for Boston rapid transit.
    We focus on **Red**, **Orange**, and **Blue** lines and skip Green Line scope for this first layer.

    The workflow below is intentionally pragmatic:
    - scan only required columns from monthly 2026 CSVs
    - engineer time features for reliability diagnostics
    - compute route-pair reliability metrics
    - surface unstable station pairs and anomaly days
    """)
    return


@app.cell(hide_code=True)
def data_scope_config(Path, mo):
    PROJECT_ROOT = Path.cwd()
    DATA_ROOT = PROJECT_ROOT.parent
    CACHE_DIR = PROJECT_ROOT / "data" / "cache"
    CACHE_DIR.mkdir(parents=True, exist_ok=True)

    HR_FILES = sorted(DATA_ROOT.glob("2026-*_HRTravelTimes.csv"))
    TARGET_LINES = ("Red", "Orange", "Blue")

    subset_cache_path = CACHE_DIR / "rapid_transit_subset_2026_q1q2_v3.parquet"
    metrics_cache_path = CACHE_DIR / "reliability_metrics_2026_q1q2_v3.parquet"

    mo.md(
        f"""
        **Data scope configured**

        - Input files found: `{len(HR_FILES)}` monthly heavy-rail CSV files
        - Target lines: `{', '.join(TARGET_LINES)}`
        - Cache directory: `{CACHE_DIR}`
        """
    )
    return HR_FILES, TARGET_LINES, metrics_cache_path, subset_cache_path


@app.cell(hide_code=True)
def reliability_helpers(pl):
    def build_subset_lazyframe(files, target_lines):
        selected_columns = [
            "service_date",
            "route_id",
            "from_parent_station",
            "to_parent_station",
            "from_stop_name",
            "to_stop_name",
            "from_stop_departure_datetime",
            "to_stop_arrival_datetime",
            "travel_time_sec",
        ]

        scans = [
            pl.scan_csv(path, schema_overrides={"travel_time_sec": pl.Float64})
            .select(selected_columns)
            for path in files
        ]

        if not scans:
            return pl.DataFrame(schema={
                "service_date": pl.String,
                "route_id": pl.String,
                "from_parent_station": pl.String,
                "to_parent_station": pl.String,
                "from_stop_name": pl.String,
                "to_stop_name": pl.String,
                "from_stop_departure_datetime": pl.String,
                "to_stop_arrival_datetime": pl.String,
                "travel_time_sec": pl.Float64,
            }).lazy()

        return (
            pl.concat(scans, how="vertical_relaxed")
            .filter(pl.col("route_id").is_in(target_lines))
            .filter(pl.col("from_parent_station") != pl.col("to_parent_station"))
            .with_columns(
                pl.col("from_stop_departure_datetime")
                .str.strptime(
                    pl.Datetime(time_zone="UTC"),
                    format="%Y-%m-%dT%H:%M:%SZ",
                    strict=False,
                )
                .alias("departure_ts")
            )
            .with_columns(
                pl.col("departure_ts").dt.hour().alias("hour_of_day"),
                pl.col("departure_ts").dt.weekday().alias("day_of_week"),
                pl.col("departure_ts").dt.weekday().is_in([6, 7]).alias("is_weekend"),
                pl.concat_str([
                    pl.col("from_stop_name"),
                    pl.lit(" -> "),
                    pl.col("to_stop_name"),
                ]).alias("route_pair"),
            )
            .drop_nulls(["departure_ts", "travel_time_sec", "from_stop_name", "to_stop_name"])
        )


    def compute_pair_metrics(lf):
        return (
            lf.group_by(["route_id", "from_stop_name", "to_stop_name", "route_pair"])
            .agg(
                pl.col("travel_time_sec").median().alias("median_travel_time_sec"),
                pl.col("travel_time_sec").mean().alias("mean_travel_time_sec"),
                pl.col("travel_time_sec").std().fill_null(0.0).alias("std_travel_time_sec"),
                pl.col("travel_time_sec").quantile(0.95).alias("p95_travel_time_sec"),
                pl.len().alias("trip_count"),
            )
            .with_columns(
                pl.when(pl.col("mean_travel_time_sec") > 0)
                .then(pl.col("std_travel_time_sec") / pl.col("mean_travel_time_sec"))
                .otherwise(None)
                .alias("cv")
            )
            .sort("cv", descending=True)
        )

    return build_subset_lazyframe, compute_pair_metrics


@app.cell(hide_code=True)
def subset_and_metrics_loader(
    HR_FILES,
    TARGET_LINES,
    build_subset_lazyframe,
    compute_pair_metrics,
    metrics_cache_path,
    mo,
    pl,
    subset_cache_path,
):
    if subset_cache_path.exists():
        subset_lf = pl.scan_parquet(subset_cache_path)
    else:
        subset_df = build_subset_lazyframe(HR_FILES, TARGET_LINES).collect(engine="streaming")
        subset_df.write_parquet(subset_cache_path)
        subset_lf = pl.scan_parquet(subset_cache_path)

    if metrics_cache_path.exists():
        pair_metrics = pl.read_parquet(metrics_cache_path)
    else:
        pair_metrics = compute_pair_metrics(subset_lf).collect(engine="streaming")
        pair_metrics.write_parquet(metrics_cache_path)

    row_count = subset_lf.select(pl.len()).collect().item()
    metrics_count = pair_metrics.height

    mo.md(
        f"""
        **Subset loaded and cached**

        - Trips in scoped subset: `{row_count:,}`
        - Route pairs with metrics: `{metrics_count:,}`
        - Subset cache: `{subset_cache_path.name}`
        - Metrics cache: `{metrics_cache_path.name}`
        """
    )
    return pair_metrics, subset_lf


@app.cell(hide_code=True)
def schema_and_sample_review(mo, pl, subset_lf):
    subset_schema = subset_lf.collect_schema()
    column_summary = pl.DataFrame(
        {
            "column": list(subset_schema.keys()),
            "dtype": [str(dtype) for dtype in subset_schema.values()],
        }
    )

    sample_records = (
        subset_lf.select(
            "route_id",
            "from_stop_name",
            "to_stop_name",
            "departure_ts",
            "travel_time_sec",
            "hour_of_day",
            "day_of_week",
            "is_weekend",
        )
        .limit(8)
        .collect()
    )

    mo.vstack([
        mo.md("""
        ## Column and type inspection

        We only keep fields needed for reliability analytics and feature engineering.
        """),
        column_summary,
        mo.md("""
        ### Sample transformed rows
        """),
        sample_records,
    ])
    return


@app.cell(hide_code=True)
def top20_least_reliable_plot(go, pair_metrics, pl):
    top20_least_reliable = (
        pair_metrics
        .filter(pl.col("trip_count") >= 100)
        .sort("cv", descending=True)
        .head(20)
    )

    top20_plot = go.Figure(
        data=[
            go.Bar(
                x=top20_least_reliable["cv"].to_list(),
                y=top20_least_reliable["route_pair"].to_list(),
                orientation="h",
                marker={"color": top20_least_reliable["trip_count"].to_list(), "colorscale": "RdBu"},
                customdata=top20_least_reliable.select(
                    "route_id",
                    "trip_count",
                    "median_travel_time_sec",
                    "mean_travel_time_sec",
                    "std_travel_time_sec",
                    "p95_travel_time_sec",
                ).rows(),
                hovertemplate=(
                    "Pair: %{y}<br>CV: %{x:.3f}<br>Line: %{customdata[0]}<br>Trips: %{customdata[1]}"
                    "<br>Median: %{customdata[2]:.1f}s<br>Mean: %{customdata[3]:.1f}s"
                    "<br>Std: %{customdata[4]:.1f}s<br>P95: %{customdata[5]:.1f}s<extra></extra>"
                ),
            )
        ]
    )
    top20_plot.update_layout(
        title="Top 20 least reliable station pairs (by coefficient of variation)",
        xaxis_title="Coefficient of variation (std / mean)",
        yaxis_title="Route pair",
        height=700,
    )

    top20_plot
    return (top20_least_reliable,)


@app.cell(hide_code=True)
def select_severe_route(mo, pair_metrics, pl, subset_lf, top20_least_reliable):
    if top20_least_reliable.height == 0:
        severe_route = pair_metrics.sort("cv", descending=True).head(1)
    else:
        severe_route = top20_least_reliable.head(1)

    severe_row = severe_route.to_dicts()[0]

    severe_pair_lf = subset_lf.filter(
        (pl.col("route_id") == severe_row["route_id"])
        & (pl.col("from_stop_name") == severe_row["from_stop_name"])
        & (pl.col("to_stop_name") == severe_row["to_stop_name"])
    )

    severe_trip_df = severe_pair_lf.select(
        "service_date",
        "departure_ts",
        "travel_time_sec",
        "hour_of_day",
        "day_of_week",
        "is_weekend",
    ).collect()

    severe_label = f"{severe_row['route_id']}: {severe_row['route_pair']}"

    mo.md(
        f"""
        ## Deep dive route selected

        **{severe_label}** has the highest observed variability in the scoped data.
        We use it for distribution and anomaly diagnostics.
        """
    )
    return severe_label, severe_trip_df


@app.cell(hide_code=True)
def severe_route_distribution(go, severe_label, severe_trip_df):
    histogram_plot = go.Figure(
        data=[
            go.Histogram(
                x=severe_trip_df["travel_time_sec"].to_list(),
                nbinsx=60,
                marker={"color": "#1f77b4"},
                opacity=0.85,
            )
        ]
    )
    histogram_plot.update_layout(
        title=f"Travel time distribution for {severe_label}",
        xaxis_title="Travel time (seconds)",
        yaxis_title="Trip count",
        bargap=0.05,
    )

    histogram_plot
    return


@app.cell(hide_code=True)
def severe_route_anomaly_timeline(go, pl, severe_label, severe_trip_df):
    daily_profile = (
        severe_trip_df
        .with_columns(pl.col("service_date").str.strptime(pl.Date, strict=False))
        .group_by("service_date")
        .agg(
            pl.col("travel_time_sec").median().alias("daily_median_sec"),
            pl.len().alias("daily_trips"),
        )
        .sort("service_date")
    )

    daily_stats = daily_profile.select(
        pl.col("daily_median_sec").mean().alias("mean_daily_median"),
        pl.col("daily_median_sec").std().fill_null(0.0).alias("std_daily_median"),
    ).row(0, named=True)

    daily_profile = daily_profile.with_columns(
        pl.when(daily_stats["std_daily_median"] > 0)
        .then(
            (pl.col("daily_median_sec") - daily_stats["mean_daily_median"])
            / daily_stats["std_daily_median"]
        )
        .otherwise(0.0)
        .alias("z_score")
    ).with_columns((pl.col("z_score").abs() >= 2).alias("is_anomaly"))

    normal_days = daily_profile.filter(~pl.col("is_anomaly"))
    anomaly_days_df = daily_profile.filter(pl.col("is_anomaly"))

    timeline_plot = go.Figure()
    timeline_plot.add_trace(
        go.Scatter(
            x=normal_days["service_date"].to_list(),
            y=normal_days["daily_median_sec"].to_list(),
            mode="lines+markers",
            name="Normal",
            marker={"color": "#2ca02c"},
        )
    )
    timeline_plot.add_trace(
        go.Scatter(
            x=anomaly_days_df["service_date"].to_list(),
            y=anomaly_days_df["daily_median_sec"].to_list(),
            mode="markers",
            name="|z| >= 2",
            marker={"color": "#d62728", "size": 10, "symbol": "diamond"},
        )
    )
    timeline_plot.update_layout(
        title=f"Daily median travel time anomalies for {severe_label}",
        xaxis_title="Date",
        yaxis_title="Daily median travel time (sec)",
    )

    timeline_plot
    return (daily_profile,)


@app.cell(hide_code=True)
def infrastructure_failure_detector_markdown(mo):
    mo.md(r"""
    ## Infrastructure Failure Detector

    A true infrastructure failure should show both degraded travel time and reduced service volume. Travel time alone can indicate congestion, but travel time spike + trip count collapse suggests service disruption, shutdown, or infrastructure failure.

    We flag likely failure days when both conditions are true for a route on a date:
    - median travel time z-score > 2
    - trip count ratio < 0.65
    """)
    return


@app.cell(hide_code=True)
def infrastructure_failure_detector_table(mo, pl, subset_lf):
    daily_route_stats = (
        subset_lf
        .group_by(["service_date", "route_id"])
        .agg(
            pl.col("travel_time_sec").median().alias("daily_median_travel_time_sec"),
            pl.col("travel_time_sec").quantile(0.95).alias("daily_p95_travel_time_sec"),
            pl.len().alias("daily_trip_count"),
        )
        .with_columns(pl.col("service_date").str.strptime(pl.Date, strict=False))
        .sort(["route_id", "service_date"])
        .with_columns(
            pl.col("daily_trip_count").median().over("route_id").alias("route_median_trip_count"),
            pl.col("daily_median_travel_time_sec").mean().over("route_id").alias("route_mean_daily_median"),
            pl.col("daily_median_travel_time_sec").std().over("route_id").fill_null(0.0).alias("route_std_daily_median"),
        )
        .with_columns(
            pl.when(pl.col("route_median_trip_count") > 0)
            .then(pl.col("daily_trip_count") / pl.col("route_median_trip_count"))
            .otherwise(None)
            .alias("trip_count_ratio"),
            pl.when(pl.col("route_std_daily_median") > 0)
            .then(
                (pl.col("daily_median_travel_time_sec") - pl.col("route_mean_daily_median"))
                / pl.col("route_std_daily_median")
            )
            .otherwise(0.0)
            .alias("median_travel_time_zscore"),
        )
        .with_columns(
            (
                (pl.col("median_travel_time_zscore") > 2)
                & (pl.col("trip_count_ratio") < 0.65)
            ).alias("is_flagged_failure_day")
        )
        .with_columns(
            (
                pl.col("median_travel_time_zscore")
                * (1 - pl.col("trip_count_ratio").fill_null(1.0))
            ).alias("severity_score")
        )
        .collect(engine="streaming")
    )

    flagged_failure_days = (
        daily_route_stats
        .filter(pl.col("is_flagged_failure_day"))
        .select(
            "service_date",
            "route_id",
            "daily_median_travel_time_sec",
            "daily_p95_travel_time_sec",
            "daily_trip_count",
            "trip_count_ratio",
            "median_travel_time_zscore",
            "severity_score",
        )
        .sort(
            ["severity_score", "median_travel_time_zscore", "trip_count_ratio"],
            descending=[True, True, False],
        )
    )

    mo.vstack([
        mo.md(f"""
    ### Flagged Failure Days

    Likely failures found: **{flagged_failure_days.height}**
    """),
        flagged_failure_days,
    ])
    return daily_route_stats, flagged_failure_days


@app.cell(hide_code=True)
def infrastructure_failure_detector_timeline(
    daily_route_stats,
    flagged_failure_days,
    go,
    pl,
):
    route_colors = {
        "Red": "#d62728",
        "Orange": "#ff7f0e",
        "Blue": "#1f77b4",
    }

    failure_timeline = go.Figure()

    for route in sorted(daily_route_stats["route_id"].unique().to_list()):
        route_df = daily_route_stats.filter(pl.col("route_id") == route)
        failure_timeline.add_trace(
            go.Scatter(
                x=route_df["service_date"].to_list(),
                y=route_df["median_travel_time_zscore"].to_list(),
                mode="lines+markers",
                name=f"{route} daily z-score",
                marker={"size": 6},
                line={"width": 2, "color": route_colors.get(route)},
                hovertemplate=(
                    "route=%{text}<br>date=%{x}<br>median z-score=%{y:.2f}<extra></extra>"
                ),
                text=[route] * route_df.height,
            )
        )

    failure_timeline.add_trace(
        go.Scatter(
            x=flagged_failure_days["service_date"].to_list(),
            y=flagged_failure_days["median_travel_time_zscore"].to_list(),
            mode="markers",
            name="Flagged failure days",
            marker={"color": "#e31a1c", "size": 16, "symbol": "diamond", "line": {"color": "#7f0000", "width": 1.5}},
            customdata=list(zip(
                flagged_failure_days["route_id"].to_list(),
                flagged_failure_days["daily_trip_count"].to_list(),
                flagged_failure_days["trip_count_ratio"].to_list(),
                flagged_failure_days["daily_median_travel_time_sec"].to_list(),
            )),
            hovertemplate=(
                "<b>Flagged failure day</b><br>"
                "route=%{customdata[0]}<br>"
                "date=%{x}<br>"
                "z-score=%{y:.2f}<br>"
                "trip_count=%{customdata[1]}<br>"
                "trip_count_ratio=%{customdata[2]:.2f}<br>"
                "daily_median_sec=%{customdata[3]:.1f}<extra></extra>"
            ),
        )
    )

    failure_timeline.add_hline(y=2, line_dash="dash", line_color="#7f7f7f")

    failure_timeline.update_layout(
        title="Infrastructure Failure Detector: Daily Median Travel Time Z-Scores",
        xaxis_title="Service Date",
        yaxis_title="Median travel time z-score",
        legend_title="Route",
    )

    failure_timeline
    return


@app.cell(hide_code=True)
def foundational_insights(
    daily_profile,
    flagged_failure_days,
    mo,
    pair_metrics,
    pl,
    severe_label,
    top20_least_reliable,
):
    top_three = top20_least_reliable.select(
        "route_id", "route_pair", "cv", "trip_count"
    ).head(3)

    anomaly_days = daily_profile.filter(pl.col("is_anomaly")).height
    failure_days = flagged_failure_days.height

    if failure_days > 0:
        worst_failure = flagged_failure_days.row(0, named=True)
        worst_failure_text = (
            f"{worst_failure['route_id']} on {worst_failure['service_date']} "
            f"(z={worst_failure['median_travel_time_zscore']:.2f}, "
            f"ratio={worst_failure['trip_count_ratio']:.2f})"
        )
    else:
        worst_failure_text = "No days met the joint failure thresholds in the current slice."

    mo.vstack([
        mo.md("""
        ## First-layer insights

        This foundational layer gives us a reusable reliability backbone for hackathon iteration.
        """),
        mo.md(
            f"""
            - Highest-variability pair currently: **{severe_label}**
            - Route-pairs analyzed: **{pair_metrics.height:,}**
            - Anomaly days detected on selected pair: **{anomaly_days}**
            - Infrastructure failure days flagged: **{failure_days}**
            - Most severe failure signal: **{worst_failure_text}**
            - Next incremental step: segment reliability by hour buckets and weekend vs weekday.
            """
        ),
        top_three,
    ])
    return


if __name__ == "__main__":
    app.run()
