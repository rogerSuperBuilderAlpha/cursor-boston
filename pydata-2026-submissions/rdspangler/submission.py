# /// script
# dependencies = [
#     "marimo",
#     "plotly==6.7.0",
#     "polars==1.40.1",
# ]
# requires-python = ">=3.13"
# ///

import marimo

__generated_with = "0.23.6"
app = marimo.App(width="medium")


@app.cell(hide_code=True)
def notebook_imports():
    import base64
    from pathlib import Path

    import marimo as mo
    import polars as pl
    import plotly.graph_objects as go

    return Path, base64, go, mo, pl


@app.cell(hide_code=True)
def title_markdown(mo):
    mo.md(r"""
    # Exoplanet Explorer

    **Out of thousands of confirmed planets beyond our solar system, which ones look most Earth-like — and how did we find them?**

    This notebook walks through the full confirmed exoplanet catalog from the
    [NASA Exoplanet Archive](https://exoplanetarchive.ipac.caltech.edu/), from the history of discovery
    all the way to an interactive shortlist of Earth-like candidates.

    Use the controls below to filter the planet population and explore what we know.
    """)
    return


@app.cell(hide_code=True)
def load_data_markdown(mo):
    mo.md(r"""
    ## The catalog

    We query the **Planetary Systems Composite Parameters** (`pscomppars`) table from the
    [NASA Exoplanet Archive](https://exoplanetarchive.ipac.caltech.edu/) — one row per confirmed
    planet, with best-estimate physical parameters drawn from peer-reviewed literature.
    The table is cached locally after the first download so the demo never needs a live connection.

    ### Planet measurements

    | Column | Full name | Unit | What it tells us |
    |---|---|---|---|
    | `pl_name` | Planet name | — | The IAU-assigned name, usually host star + letter (e.g. *Kepler-442 b*) |
    | `pl_rade` | Planet radius | Earth radii (R⊕) | Size of the planet relative to Earth. Rocky planets are typically < 1.6 R⊕; gas giants > 4 R⊕ |
    | `pl_bmasse` | Planet mass (best) | Earth masses (M⊕) | Best available mass estimate — from radial velocity, transit timing, or both. Missing for many transit-only planets |
    | `pl_orbper` | Orbital period | Days | How long one year is on this planet. Earth = 365.25 days; hot Jupiters are often < 5 days |
    | `pl_eqt` | Equilibrium temperature | Kelvin (K) | Theoretical surface temperature assuming no atmosphere and a fixed albedo. Earth ≈ 255 K. Not the same as actual surface temperature |

    ### System & star measurements

    | Column | Full name | Unit | What it tells us |
    |---|---|---|---|
    | `hostname` | Host star name | — | The star this planet orbits |
    | `st_teff` | Stellar effective temperature | Kelvin (K) | Surface temperature of the host star. Sun ≈ 5,778 K. Cooler M-dwarfs are 2,400–3,900 K |
    | `st_rad` | Stellar radius | Solar radii (R☉) | Size of the host star. Useful for understanding transit depth and habitability zone |
    | `sy_dist` | System distance | Parsecs (pc) | Distance from Earth. 1 parsec ≈ 3.26 light-years. The nearest star system, Alpha Centauri, is ~1.3 pc |

    ### Discovery metadata

    | Column | Full name | What it tells us |
    |---|---|---|
    | `discoverymethod` | Discovery method | How we know the planet exists — see the timeline below for a breakdown of each technique |
    | `disc_year` | Discovery year | When the planet was confirmed, not when it was first detected as a candidate |
    | `disc_facility` | Discovery facility | The telescope or instrument that made the discovery (e.g. *Kepler*, *TESS*, *Keck*) |

    ---

    ### Quick reference: all discovery methods

    | Method | Principle | Strengths | Limitations |
    |---|---|---|---|
    | **Transit** | Planet passes in front of its star, causing a tiny, periodic dip in brightness | Finds small planets; Kepler and TESS use this; scales to thousands of detections | Requires the orbital plane to be edge-on as seen from Earth; only ~1% of orbits are aligned favourably |
    | **Radial Velocity** | The planet's gravity tugs the star back and forth; measured as a Doppler shift in the star's spectrum | Works for any orbital orientation; gives planet mass directly | Requires bright, quiet stars; biased toward massive, close-in planets |
    | **Imaging** | The planet's own light (or reflected starlight) is resolved separately from the host star | Direct photons from the planet; can obtain spectra | Only works for young, hot, far-out giants; host star glare is overwhelming for closer, cooler planets |
    | **Microlensing** | A foreground star (with a planet) briefly bends and amplifies light from a background star | Sensitive to planets at wide orbits and even free-floating rogue planets; unique distance reach | Events happen once and cannot be repeated; discovered planets usually cannot be followed up |
    | **Astrometry** | The star's precise position on the sky wobbles due to the planet's gravitational pull | Works for massive planets at wide orbits; being revolutionised by ESA's Gaia mission | Requires extraordinarily precise positional measurements; historically very few confirmations |
    | **Transit Timing Variations (TTV)** | In a multi-planet system, planets gravitationally perturb each other, shifting the exact timing of each transit | Can confirm and weigh planets that are not themselves transiting; measures planet masses | Requires a known transiting planet in the same system; signal modelling is complex |
    | **Eclipse Timing Variations (ETV)** | Similar to TTV but applied to binary star systems — a circumbinary planet shifts the eclipse timing | Detects planets around binary stars that are hard to study other ways | Only applicable to eclipsing binaries; rare geometry required |
    | **Pulsar Timing** | Pulsars emit radio pulses with extreme regularity; a planet shifts the arrival times of those pulses | Exquisitely sensitive — led to the very first confirmed exoplanet in 1992 | Pulsars are the remnants of supernova explosions; their planets are radiation-bathed and almost certainly not habitable |
    | **Pulsation Timing Variations** | Like pulsar timing but applied to pulsating giant stars (oscillating subdwarfs, white dwarfs) | Sensitive to long-period, wide-orbit companions | Stellar pulsations are far less stable than pulsar clocks, making interpretation difficult |
    | **Orbital Brightness Modulation (OBM)** | Measures periodic brightness changes caused by the planet's reflected light, ellipsoidal distortion of the star, and Doppler boosting | No special orbital alignment required; works with high-precision photometry (Kepler) | Only detects very massive, close-in planets where the brightness signal is large enough |
    | **Disk Kinematics** | In protoplanetary disks, a forming planet carves a gap and perturbs the gas velocity field — detected via millimetre-wave radio (ALMA) | Detects planets while they are still actively forming, before they are otherwise detectable | Still emerging; very few confirmed detections; requires nearby, bright protoplanetary disks |
    """)
    return


@app.cell(hide_code=True)
def load_and_clean(Path, pl):
    csv_path = Path("data/exoplanets/pscomppars.csv")

    df_raw = pl.read_csv(csv_path, null_values=["", "NA", "nan"])

    df = (
        df_raw
        .rename({c: c.strip() for c in df_raw.columns})
        .with_columns([
            pl.col("pl_rade").cast(pl.Float64, strict=False),
            pl.col("pl_bmasse").cast(pl.Float64, strict=False),
            pl.col("pl_orbper").cast(pl.Float64, strict=False),
            pl.col("pl_eqt").cast(pl.Float64, strict=False),
            pl.col("st_teff").cast(pl.Float64, strict=False),
            pl.col("st_rad").cast(pl.Float64, strict=False),
            pl.col("sy_dist").cast(pl.Float64, strict=False),
            pl.col("disc_year").cast(pl.Int32, strict=False),
        ])
        .filter(pl.col("pl_name").is_not_null())
    )

    n_total = df.height
    n_with_radius = df.filter(pl.col("pl_rade").is_not_null()).height
    n_with_temp = df.filter(pl.col("pl_eqt").is_not_null()).height

    df
    return df, n_total, n_with_radius, n_with_temp


@app.cell(hide_code=True)
def catalog_summary(mo, n_total, n_with_radius, n_with_temp):
    mo.md(f"""
    Loaded **{n_total:,} confirmed exoplanets**.

    - {n_with_radius:,} have a measured radius estimate
    - {n_with_temp:,} have an equilibrium temperature estimate

    Missing values are handled gracefully throughout — filters and plots only use
    planets with the relevant measurement available.
    """)
    return


@app.cell(hide_code=True)
def discovery_boom_markdown(mo):
    mo.md(r"""
    ## The discovery boom

    The `disc_year` column records when each planet was officially *confirmed* — not just when a
    candidate signal was spotted. The interactive chart below tells a clear story:

    **Exoplanet discovery is an instrument-driven story. The curve changes when our tools change.**

    Use the mode selector to view:
    - **Cumulative** — how the total catalog has grown
    - **Annual** — new confirmations each year, showing the spikes around telescope milestones
    - **Method share** — how the dominant detection technique has shifted over time
    """)
    return


@app.cell(hide_code=True)
def technology_milestones():
    # Each entry: (year, short_label, detail, color)
    milestones = [
        (1992, "First\nexoplanet",
         "PSR 1257+12 b/c — pulsar planets confirmed via Timing Variations.<br>Proved other solar systems exist, though around a stellar corpse.",
         "#9467bd"),
        (1995, "51 Peg b",
         "51 Pegasi b — first planet around a Sun-like star (Radial Velocity).<br>A hot Jupiter in a 4-day orbit. Changed astronomy overnight.",
         "#8c564b"),
        (2009, "Kepler\nlaunches",
         "NASA Kepler Space Telescope begins surveying 150,000 stars for transits.<br>Designed specifically to count Earth-size planets.",
         "#1f77b4"),
        (2014, "Kepler\nwave",
         "Kepler confirmation wave: 715 planets announced in one day via statistical validation.<br>Transit becomes the dominant discovery method permanently.",
         "#17becf"),
        (2018, "TESS\nlaunches",
         "TESS (Transiting Exoplanet Survey Satellite) begins all-sky transit survey.<br>Covers 400× more sky than Kepler; focuses on bright, nearby stars.",
         "#2ca02c"),
        (2021, "JWST\nlaunches",
         "James Webb Space Telescope launches Dec 25 2021; science begins 2022.<br>First instrument capable of characterising atmospheres of small rocky planets.",
         "#d62728"),
    ]
    return (milestones,)


@app.cell(hide_code=True)
def timeline_yearly_data(df, pl):
    timeline_yearly = (
        df
        .filter(pl.col("disc_year").is_not_null())
        .group_by(["disc_year", "discoverymethod"])
        .agg(pl.len().alias("count"))
        .sort(["disc_year", "discoverymethod"])
    )
    data_methods = sorted(
        timeline_yearly.get_column("discoverymethod").unique().to_list()
    )
    data_years = sorted(timeline_yearly.get_column("disc_year").unique().to_list())

    data_annual = {}
    data_cumulative = {}
    for data_method in data_methods:
        data_method_map = {
            data_row["disc_year"]: data_row["count"]
            for data_row in timeline_yearly.filter(
                pl.col("discoverymethod") == data_method
            ).iter_rows(named=True)
        }
        data_running = 0
        data_annual[data_method] = {}
        data_cumulative[data_method] = {}
        for data_year in data_years:
            data_count = data_method_map.get(data_year, 0)
            data_running += data_count
            data_annual[data_method][data_year] = data_count
            data_cumulative[data_method][data_year] = data_running

    data_total_annual = {
        data_year: sum(
            data_annual[data_method].get(data_year, 0)
            for data_method in data_methods
        )
        for data_year in data_years
    }

    timeline_data = {
        "methods": data_methods,
        "years": data_years,
        "annual": data_annual,
        "cumulative": data_cumulative,
        "total_annual": data_total_annual,
    }
    return (timeline_data,)


@app.cell(hide_code=True)
def timeline_mode_control(mo):
    timeline_mode = mo.ui.dropdown(
        options=["Cumulative", "Annual", "Method share"],
        value="Cumulative",
        label="Timeline view",
    )
    return (timeline_mode,)


@app.cell(hide_code=True)
def annotated_discovery_timeline(
    go, milestones, timeline_data, timeline_mode,
):
    plot_methods = timeline_data["methods"]
    plot_years = timeline_data["years"]
    plot_annual = timeline_data["annual"]
    plot_cumulative = timeline_data["cumulative"]
    plot_total_annual = timeline_data["total_annual"]
    plot_mode = timeline_mode.value

    timeline_fig = go.Figure()
    sorted_plot_methods = sorted(
        plot_methods,
        key=lambda method_key: -plot_cumulative[method_key][plot_years[-1]],
    )

    if plot_mode == "Cumulative":
        for plot_method in sorted_plot_methods:
            timeline_fig.add_trace(go.Scatter(
                x=plot_years,
                y=[plot_cumulative[plot_method][plot_year] for plot_year in plot_years],
                mode="lines",
                name=plot_method,
                stackgroup="one",
                hovertemplate=(
                    f"<b>{plot_method}</b><br>Year: %{{x}}<br>"
                    "Cumulative total: %{y:,}<extra></extra>"
                ),
            ))
        timeline_yaxis_title = "Cumulative planets confirmed"
        timeline_title = "Cumulative confirmed exoplanet discoveries by method"

    elif plot_mode == "Annual":
        for plot_method in sorted_plot_methods:
            timeline_fig.add_trace(go.Bar(
                x=plot_years,
                y=[plot_annual[plot_method][plot_year] for plot_year in plot_years],
                name=plot_method,
                hovertemplate=(
                    f"<b>{plot_method}</b><br>Year: %{{x}}<br>"
                    "New that year: %{y:,}<extra></extra>"
                ),
            ))
        timeline_fig.update_layout(barmode="stack")
        timeline_yaxis_title = "New planets confirmed"
        timeline_title = "Annual confirmed exoplanet discoveries by method"

    else:
        for plot_method in sorted_plot_methods:
            plot_shares = []
            for plot_year in plot_years:
                plot_total = plot_total_annual.get(plot_year, 0)
                plot_share = (
                    round(100 * plot_annual[plot_method].get(plot_year, 0) / plot_total, 1)
                    if plot_total
                    else 0
                )
                plot_shares.append(plot_share)
            timeline_fig.add_trace(go.Scatter(
                x=plot_years,
                y=plot_shares,
                mode="lines",
                name=plot_method,
                stackgroup="one",
                groupnorm="percent",
                hovertemplate=(
                    f"<b>{plot_method}</b><br>Year: %{{x}}<br>"
                    "Share: %{y:.1f}%<extra></extra>"
                ),
            ))
        timeline_yaxis_title = "% of new confirmations"
        timeline_title = "Discovery method share by year"

    for plot_index, (
        plot_milestone_year,
        plot_milestone_label,
        plot_milestone_detail,
        plot_milestone_color,
    ) in enumerate(milestones):
        plot_ay_offset = -55 if plot_index % 2 == 0 else -110

        timeline_fig.add_vline(
            x=plot_milestone_year,
            line=dict(color=plot_milestone_color, width=1.5, dash="dot"),
        )
        timeline_fig.add_annotation(
            x=plot_milestone_year,
            y=1.0,
            yref="paper",
            text=f"<b>{plot_milestone_label}</b>",
            showarrow=True,
            arrowhead=2,
            arrowsize=0.7,
            arrowcolor=plot_milestone_color,
            ax=0,
            ay=plot_ay_offset,
            font=dict(size=9, color=plot_milestone_color),
            bgcolor="rgba(255,255,255,0.85)",
            bordercolor=plot_milestone_color,
            borderwidth=1,
            borderpad=3,
            hovertext=plot_milestone_detail,
            hoverlabel=dict(
                bgcolor="white",
                bordercolor=plot_milestone_color,
                font_size=12,
            ),
        )

    timeline_fig.update_layout(
        title=timeline_title,
        xaxis=dict(title="Year", range=[1991, 2026]),
        yaxis_title=timeline_yaxis_title,
        legend_title="Discovery method",
        hovermode="x unified",
        margin=dict(t=100),
        height=520,
    )

    return (timeline_fig,)


@app.cell(hide_code=True)
def timeline_display(mo, timeline_fig, timeline_mode):
    mo.vstack([timeline_mode, timeline_fig])
    return


@app.cell(hide_code=True)
def era_selector(milestones, mo):
    def _make_era_labels():
        return [
            f"{milestone_year} — {milestone_label.replace(chr(10), ' ')}"
            for milestone_year, milestone_label, _, _ in milestones
        ]

    era_labels = _make_era_labels()
    era_dropdown = mo.ui.dropdown(
        options=era_labels,
        value=era_labels[2],   # Default to Kepler launch
        label="Explore a technology era",
    )
    return (era_dropdown, era_labels)


@app.cell(hide_code=True)
def era_summary_card(
    era_dropdown, era_labels, milestones, mo, timeline_data,
):
    era_idx = era_labels.index(era_dropdown.value)
    era_year, era_label, era_detail, _era_color = milestones[era_idx]
    era_methods = timeline_data["methods"]
    era_years = timeline_data["years"]
    era_annual = timeline_data["annual"]

    era_total_by_year = sum(
        sum(era_annual[era_method].get(era_year_item, 0) for era_method in era_methods)
        for era_year_item in era_years
        if era_year_item <= era_year
    )

    era_window_years = [
        era_year_item
        for era_year_item in era_years
        if era_year - 1 <= era_year_item <= era_year + 1
    ]
    era_method_counts = {
        era_method: sum(
            era_annual[era_method].get(era_year_item, 0)
            for era_year_item in era_window_years
        )
        for era_method in era_methods
    }
    era_dominant_method = max(era_method_counts, key=era_method_counts.get)

    era_window5 = [
        era_year_item
        for era_year_item in era_years
        if era_year - 5 <= era_year_item <= era_year + 5
    ]
    era_year_totals = {
        era_year_item: sum(
            era_annual[era_method].get(era_year_item, 0)
            for era_method in era_methods
        )
        for era_year_item in era_window5
    }
    era_peak_year = max(era_year_totals, key=era_year_totals.get)
    era_peak_n = era_year_totals[era_peak_year]

    era_before_5yr = [
        era_year_item
        for era_year_item in era_years
        if era_year - 6 <= era_year_item <= era_year - 1
    ]
    era_after_5yr = [
        era_year_item
        for era_year_item in era_years
        if era_year <= era_year_item <= era_year + 4
    ]
    era_n_before = sum(
        sum(era_annual[era_method].get(era_year_item, 0) for era_method in era_methods)
        for era_year_item in era_before_5yr
    )
    era_n_after = sum(
        sum(era_annual[era_method].get(era_year_item, 0) for era_method in era_methods)
        for era_year_item in era_after_5yr
    )
    era_multiplier = round(era_n_after / era_n_before, 1) if era_n_before > 0 else "—"

    era_summary_component = mo.vstack([
        era_dropdown,
        mo.md(f"### Technology era: {era_label.replace(chr(10), ' ')} ({era_year})"),
        mo.hstack([
            mo.stat(label="Total confirmed by this year", value=f"{era_total_by_year:,}"),
            mo.stat(label="Dominant method (±1 yr)", value=era_dominant_method),
            mo.stat(label="Peak single year nearby", value=f"{era_peak_year} ({era_peak_n:,} planets)"),
            mo.stat(label="Discovery rate change", value=f"{era_multiplier}× (5 yr before vs after)"),
        ]),
        mo.md(era_detail.replace("<br>", "\n\n")),
        mo.callout(
            mo.md(
                f"**5 years before {era_year}:** {era_n_before:,} new confirmations. "
                f"**5 years after {era_year}:** {era_n_after:,} new confirmations. "
                f"That is a **{era_multiplier}× change in discovery rate** — driven almost entirely "
                f"by the new instrument, not by planets suddenly becoming more common."
            ),
            kind="info",
        ),
    ])
    return (era_summary_component,)


@app.cell(hide_code=True)
def era_summary_display(era_summary_component):
    era_summary_component
    return


@app.cell(hide_code=True)
def planet_zoo_markdown(mo):
    mo.md(r"""
    ## The planet zoo

    Plotting **orbital period** (`pl_orbper`, x-axis, log scale) against **planet radius**
    (`pl_rade`, y-axis, log scale) reveals the extraordinary diversity of confirmed worlds.

    Use the **year slider** to watch the population grow over time — notice how the plot
    looked almost empty before Kepler, then fills in dramatically after 2009 and again after 2014.

    - **Hot Jupiters** cluster at short periods (< 10 days) and large radii (> 5 R⊕) — easy to find, likely rare in reality.
    - **The Fulton gap** (radius valley) sits at 1.5–2.0 R⊕ — stellar irradiation sorts planets into rocky or gas-wrapped.
    - **Super-Earths and mini-Neptunes** (1–4 R⊕) are the most common Kepler type.
    - **The green band** marks the Earth-size zone (0.8–1.25 R⊕).

    Each point is one confirmed planet. Hover for name, temperature, and distance.
    """)
    return


@app.cell(hide_code=True)
def zoo_year_slider(df, mo, pl):
    min_yr = int(df.filter(pl.col("disc_year").is_not_null()).get_column("disc_year").min())
    max_yr = int(df.filter(pl.col("disc_year").is_not_null()).get_column("disc_year").max())

    zoo_slider = mo.ui.slider(
        start=min_yr,
        stop=max_yr,
        step=1,
        value=max_yr,
        label="Show planets discovered up to year",
        show_value=True,
    )
    return (zoo_slider,)


@app.cell(hide_code=True)
def planet_zoo_scatter(df, go, mo, pl, zoo_slider):
    def _build_planet_zoo_scatter():
        cutoff = zoo_slider.value

        df_zoo = df.filter(
            pl.col("pl_rade").is_not_null() &
            pl.col("pl_orbper").is_not_null() &
            pl.col("disc_year").is_not_null() &
            pl.col("disc_year").le(cutoff)
        )

        n_shown = df_zoo.height
        methods_all = sorted(
            df_zoo.get_column("discoverymethod").drop_nulls().unique().to_list()
        )

        zoo_fig = go.Figure()

        for method_name in methods_all:
            sub = df_zoo.filter(pl.col("discoverymethod") == method_name)
            zoo_fig.add_trace(go.Scatter(
                x=sub["pl_orbper"].to_list(),
                y=sub["pl_rade"].to_list(),
                mode="markers",
                name=method_name,
                marker=dict(size=4, opacity=0.65),
                text=sub["pl_name"].to_list(),
                customdata=list(zip(
                    sub["hostname"].to_list(),
                    [
                        f"{v:.1f}" if v is not None else "NA"
                        for v in sub["pl_eqt"].to_list()
                    ],
                    [
                        f"{v:.0f}" if v is not None else "NA"
                        for v in sub["sy_dist"].to_list()
                    ],
                    [
                        str(v) if v is not None else "—"
                        for v in sub["disc_year"].to_list()
                    ],
                )),
                hovertemplate=(
                    "<b>%{text}</b><br>"
                    "Host: %{customdata[0]}<br>"
                    "Orbital period: %{x:.2f} d<br>"
                    "Radius: %{y:.2f} R⊕<br>"
                    "Eq. temp: %{customdata[1]} K<br>"
                    "Distance: %{customdata[2]} pc<br>"
                    "Discovered: %{customdata[3]}<extra></extra>"
                ),
            ))

        zoo_fig.update_layout(
            title=(
                f"Planet zoo up to {cutoff} — "
                f"{n_shown:,} planets with radius & period data"
            ),
            xaxis=dict(title="Orbital period (days)", type="log"),
            yaxis=dict(title="Planet radius (Earth radii)", type="log"),
            legend_title="Discovery method",
        )

        zoo_fig.add_hrect(
            y0=0.8, y1=1.25, line_width=0, fillcolor="green", opacity=0.07,
            annotation_text="Earth-size zone", annotation_position="top left",
        )

        return mo.vstack([zoo_slider, zoo_fig])

    return _build_planet_zoo_scatter()


@app.cell(hide_code=True)
def radius_dist_markdown(mo):
    mo.md(r"""
    ## Where do planets cluster by radius?

    The distribution of `pl_rade` (planet radius in Earth radii) shows three broad families:

    | Radius range | Planet class | Examples |
    |---|---|---|
    | 0.5 – 1.25 R⊕ | Rocky Earth/super-Earth | Earth, Venus, TRAPPIST-1e |
    | 1.5 – 2.0 R⊕ | **Fulton gap** — few planets live here | — |
    | 2.0 – 4.0 R⊕ | Mini-Neptunes (likely gas/water envelopes) | Kepler-22b, GJ 1214 b |
    | 4 – 10 R⊕ | Neptune- to Saturn-class giants | Neptune (3.9 R⊕), Saturn (9.1 R⊕) |
    | > 10 R⊕ | Jupiter-class and inflated hot Jupiters | Jupiter (11.2 R⊕) |

    The spike near 1–1.5 R⊕ reflects Kepler's detection sensitivity — small planets are common
    but hard to find, and Kepler was specifically designed to find them around Sun-like stars.
    The orange shading marks the Fulton gap where the population is notably thin.
    """)
    return


@app.cell(hide_code=True)
def radius_histogram(df, go, pl):
    def _build_radius_histogram():
        df_rad = df.filter(
            pl.col("pl_rade").is_not_null() &
            (pl.col("pl_rade") <= 20)
        )

        hist_fig = go.Figure(go.Histogram(
            x=df_rad["pl_rade"].to_list(),
            xbins=dict(start=0, end=20, size=0.2),
            marker_color="steelblue",
            opacity=0.8,
            hovertemplate="Radius bin: %{x:.1f} R⊕<br>Count: %{y}<extra></extra>",
            name="Confirmed planets",
        ))

        radius_bands = [
            (0.0, 0.8, "rgba(180,230,180,0.18)"),
            (0.8, 1.25, "rgba(60,180,60,0.18)"),
            (1.25, 1.6, "rgba(180,230,180,0.12)"),
            (1.6, 2.2, "rgba(255,180,60,0.13)"),
            (2.2, 4.0, "rgba(100,160,230,0.13)"),
            (4.0, 8.0, "rgba(160,100,220,0.12)"),
            (8.0, 15.0, "rgba(220,80,80,0.11)"),
            (15.0, 20.0, "rgba(180,60,60,0.09)"),
        ]
        for band_start, band_stop, band_color in radius_bands:
            hist_fig.add_vrect(
                x0=band_start,
                x1=band_stop,
                fillcolor=band_color,
                line_width=0,
            )

        radius_band_labels = [
            (0.4, "Sub-\nEarth"),
            (1.02, "Earth-\nsize"),
            (1.42, "Super-\nEarth"),
            (1.9, "Fulton\ngap"),
            (3.1, "Mini-\nNeptune"),
            (6.0, "Neptune\nclass"),
            (11.5, "Jupiter\nclass"),
            (17.5, "Super-\nJupiter"),
        ]
        for label_x, band_label in radius_band_labels:
            hist_fig.add_annotation(
                x=label_x, y=1.0, yref="paper",
                text=band_label, showarrow=False,
                font=dict(size=9, color="rgba(60,60,60,0.75)"),
                align="center", yanchor="bottom",
                xanchor="center",
            )

        solar_refs = [
            (1.000, "Earth", "#2ca02c"),
            (2.545, "Neptune", "#1f77b4"),
            (9.449, "Saturn", "#ff7f0e"),
            (11.21, "Jupiter", "#d62728"),
        ]
        for ref_radius, ref_name, ref_color in solar_refs:
            hist_fig.add_vline(
                x=ref_radius,
                line=dict(color=ref_color, width=2, dash="dash"),
            )
            hist_fig.add_annotation(
                x=ref_radius, y=0.97, yref="paper",
                text=f"<b>{ref_name}</b><br>{ref_radius} R⊕",
                showarrow=True,
                arrowhead=2, arrowsize=0.8,
                arrowcolor=ref_color,
                ax=0, ay=-36,
                font=dict(size=10, color=ref_color),
                bgcolor="rgba(255,255,255,0.8)",
                bordercolor=ref_color,
                borderwidth=1,
                borderpad=3,
            )

        hist_fig.update_layout(
            title="Distribution of planet radii (≤ 20 R⊕) — with solar system benchmarks",
            xaxis=dict(title="Planet radius (Earth radii)", range=[0, 20], dtick=2),
            yaxis_title="Number of planets",
            bargap=0.05,
            showlegend=False,
            margin=dict(t=80),
        )

        return hist_fig

    return _build_radius_histogram()


@app.cell(hide_code=True)
def filter_section_markdown(mo):
    mo.md(r"""
    ## Find Earth-like candidates

    Use the controls below to narrow the catalog toward planets that share key properties with Earth.
    We filter on three physical dimensions:

    | Filter | Column | Earth's value | Why it matters |
    |---|---|---|---|
    | **Planet radius** | `pl_rade` | 1.0 R⊕ | Radius is the best proxy for composition when mass is unknown. Below ~1.6 R⊕, planets are likely rocky |
    | **Equilibrium temperature** | `pl_eqt` | ~255 K | The theoretical blackbody temperature assuming a fixed albedo and no greenhouse effect. Earth's actual surface is ~288 K due to its atmosphere. Liquid water requires roughly 200–350 K as a starting point |
    | **System distance** | `sy_dist` | 0 pc | Closer planets are higher-priority targets for atmosphere characterisation with JWST or future telescopes. 1 parsec ≈ 3.26 light-years |

    You can also filter by **discovery method** to see which detection technique surfaces the most Earth-like candidates.

    Adjust the sliders and see the ranked shortlist update live below.
    """)
    return


@app.cell(hide_code=True)
def filter_controls(df, mo, pl):
    radius_slider = mo.ui.range_slider(
        start=0.5, stop=4.0, step=0.1, value=[0.5, 1.6],
        label="Planet radius range (Earth radii)",
    )

    temp_slider = mo.ui.range_slider(
        start=0, stop=1000, step=10, value=[200, 350],
        label="Equilibrium temperature range (K)",
    )

    dist_slider = mo.ui.slider(
        start=1, stop=2000, step=10, value=500,
        label="Max distance (parsecs)",
    )

    methods_available = sorted(
        df.filter(pl.col("discoverymethod").is_not_null())
        .get_column("discoverymethod").unique().to_list()
    )

    method_dropdown = mo.ui.multiselect(
        options=methods_available,
        value=methods_available,
        label="Discovery method",
    )

    mo.vstack([
        radius_slider,
        temp_slider,
        dist_slider,
        method_dropdown,
    ])
    return dist_slider, method_dropdown, radius_slider, temp_slider


@app.cell(hide_code=True)
def apply_filters(
    df,
    dist_slider,
    method_dropdown,
    pl,
    radius_slider,
    temp_slider,
):
    r_lo, r_hi = radius_slider.value
    t_lo, t_hi = temp_slider.value
    d_max = dist_slider.value
    selected_methods = method_dropdown.value

    df_filtered = df.filter(
        pl.col("pl_rade").is_not_null() &
        pl.col("pl_eqt").is_not_null() &
        pl.col("sy_dist").is_not_null() &
        pl.col("pl_rade").is_between(r_lo, r_hi) &
        pl.col("pl_eqt").is_between(t_lo, t_hi) &
        pl.col("sy_dist").le(d_max) &
        pl.col("discoverymethod").is_in(selected_methods)
    )
    return (df_filtered,)


@app.cell(hide_code=True)
def score_planets(df_filtered, pl):
    EARTH_RADIUS = 1.0
    EARTH_TEMP = 255.0

    df_scored = df_filtered.with_columns([
        (1.0 / (1.0 + (pl.col("pl_rade") - EARTH_RADIUS).abs())).alias("radius_score"),
        (1.0 / (1.0 + ((pl.col("pl_eqt") - EARTH_TEMP) / 100.0).abs())).alias("temp_score"),
        (1.0 / (1.0 + pl.col("sy_dist") / 100.0)).alias("dist_score"),
    ]).with_columns(
        ((pl.col("radius_score") * 0.5) +
         (pl.col("temp_score") * 0.35) +
         (pl.col("dist_score") * 0.15)).alias("earth_likeness_score")
    ).sort("earth_likeness_score", descending=True)
    return (df_scored,)


@app.cell(hide_code=True)
def ranking_markdown(mo):
    mo.md(r"""
    ## Earth-likeness ranking

    The score is a transparent, weighted sum — **not a scientific habitability claim**.
    It is designed to be explainable in 30 seconds during a demo.

    | Component | Column used | Earth reference | Weight | Formula |
    |---|---|---|---|---|
    | **Radius score** | `pl_rade` | 1.0 R⊕ | 50% | `1 / (1 + |radius − 1.0|)` — peaks at 1.0 R⊕, falls off symmetrically |
    | **Temperature score** | `pl_eqt` | 255 K | 35% | `1 / (1 + |temp − 255| / 100)` — peaks at 255 K, tolerant over a ~100 K range |
    | **Distance score** | `sy_dist` | 0 pc | 15% | `1 / (1 + distance / 100)` — lightly rewards nearby systems |

    All three components are normalised to (0, 1], so the final score also lives in (0, 1].
    A score of 1.0 would mean a planet with exactly Earth's radius, Earth's equilibrium temperature,
    and zero distance — which is Earth itself.

    Planets missing any of the three measurements are excluded from the ranking.
    """)
    return


@app.cell(hide_code=True)
def ranking_table_and_chart(df_scored, go, mo, pl):
    top10 = df_scored.select([
        "pl_name", "hostname", "discoverymethod", "disc_year",
        "pl_rade", "pl_eqt", "sy_dist", "pl_orbper", "earth_likeness_score"
    ]).head(10)

    # ── helpers ──────────────────────────────────────────────────────────────
    def _lerp_color(lo_rgb, hi_rgb, t):
        """Linearly interpolate between two RGB tuples; return CSS rgb() string."""
        t = max(0.0, min(1.0, t))
        r = int(lo_rgb[0] + (hi_rgb[0] - lo_rgb[0]) * t)
        g = int(lo_rgb[1] + (hi_rgb[1] - lo_rgb[1]) * t)
        b = int(lo_rgb[2] + (hi_rgb[2] - lo_rgb[2]) * t)
        return f"rgb({r},{g},{b})"

    COLD  = (214, 234, 248)   # pale blue  → bad/extreme
    MID   = (253, 254, 254)   # near-white → neutral
    WARM  = (171, 235, 198)   # pale green → Earth-like / good
    FAR   = (250, 219, 216)   # pale red   → far away / bad

    def _radius_color(v):
        """Green near 1.0 R⊕, fades to blue as it deviates."""
        if v is None:
            return "rgb(245,245,245)"
        closeness = max(0.0, 1.0 - abs(v - 1.0) / 2.0)
        return _lerp_color(COLD, WARM, closeness)

    def _temp_color(v):
        """Green near 255 K (Earth eq. temp), blue outside 200–350 K."""
        if v is None:
            return "rgb(245,245,245)"
        closeness = max(0.0, 1.0 - abs(v - 255) / 250.0)
        return _lerp_color(COLD, WARM, closeness)

    def _dist_color(v):
        """Green for nearby, fades to red for distant systems."""
        if v is None:
            return "rgb(245,245,245)"
        closeness = max(0.0, 1.0 - v / 500.0)
        return _lerp_color(FAR, WARM, closeness)

    def _score_color(v):
        """Full green-to-blue gradient across the score range."""
        if v is None:
            return "rgb(245,245,245)"
        return _lerp_color(COLD, WARM, v)

    def _neutral(v):
        return MID_CSS

    MID_CSS = f"rgb({MID[0]},{MID[1]},{MID[2]})"

    rows = top10.iter_rows(named=True)
    data = list(rows)

    col_planets  = [r["pl_name"] for r in data]
    col_hosts    = [r["hostname"] or "—" for r in data]
    col_methods  = [r["discoverymethod"] or "—" for r in data]
    col_years    = [str(r["disc_year"]) if r["disc_year"] else "—" for r in data]
    col_radii    = [f"{r['pl_rade']:.2f}" if r["pl_rade"] is not None else "—" for r in data]
    col_temps    = [f"{int(r['pl_eqt'])}" if r["pl_eqt"] is not None else "—" for r in data]
    col_dists    = [f"{r['sy_dist']:.1f}" if r["sy_dist"] is not None else "—" for r in data]
    col_periods  = [f"{r['pl_orbper']:.2f}" if r["pl_orbper"] is not None else "—" for r in data]
    col_scores   = [f"{r['earth_likeness_score']:.4f}" for r in data]

    fill_planets = [MID_CSS] * len(data)
    fill_hosts   = [MID_CSS] * len(data)
    fill_methods = [MID_CSS] * len(data)
    fill_years   = [MID_CSS] * len(data)
    fill_radii   = [_radius_color(r["pl_rade"]) for r in data]
    fill_temps   = [_temp_color(r["pl_eqt"]) for r in data]
    fill_dists   = [_dist_color(r["sy_dist"]) for r in data]
    fill_periods = [MID_CSS] * len(data)
    fill_scores  = [_score_color(r["earth_likeness_score"]) for r in data]

    header_color = "rgb(44, 62, 80)"
    header_font  = dict(color="white", size=12)
    cell_font    = dict(size=12)

    heatmap_table = go.Figure(go.Table(
        columnwidth=[160, 120, 140, 60, 100, 110, 110, 90, 80],
        header=dict(
            values=[
                "<b>Planet</b>", "<b>Host Star</b>", "<b>Method</b>", "<b>Year</b>",
                "<b>Radius (R⊕)</b><br><i>green → Earth-size</i>",
                "<b>Eq. Temp (K)</b><br><i>green → ~255 K</i>",
                "<b>Distance (pc)</b><br><i>green → nearby</i>",
                "<b>Period (d)</b>",
                "<b>Score</b><br><i>green → top</i>",
            ],
            fill_color=header_color,
            font=header_font,
            align="center",
            height=40,
        ),
        cells=dict(
            values=[
                col_planets, col_hosts, col_methods, col_years,
                col_radii, col_temps, col_dists, col_periods, col_scores,
            ],
            fill_color=[
                fill_planets, fill_hosts, fill_methods, fill_years,
                fill_radii, fill_temps, fill_dists, fill_periods, fill_scores,
            ],
            font=cell_font,
            align="center",
            height=30,
        ),
    ))

    heatmap_table.update_layout(
        title="Top 10 candidates — heatmap colors show Earth-likeness per column",
        margin=dict(l=0, r=0, t=50, b=0),
        height=380,
    )

    # ── bar chart ─────────────────────────────────────────────────────────────
    bar_colors = [_score_color(r["earth_likeness_score"]) for r in data]

    bar_fig = go.Figure(go.Bar(
        x=[r["pl_name"] for r in data],
        y=[r["earth_likeness_score"] for r in data],
        marker_color=bar_colors,
        marker_line_color="rgba(44,62,80,0.4)",
        marker_line_width=1,
        text=[f"{r['earth_likeness_score']:.3f}" for r in data],
        textposition="outside",
        hovertemplate="<b>%{x}</b><br>Score: %{y:.4f}<extra></extra>",
    ))
    bar_fig.update_layout(
        title="Top 10 candidates by Earth-likeness score",
        xaxis_title="Planet",
        yaxis_title="Earth-likeness score",
        yaxis=dict(range=[0, 1.08]),
        xaxis_tickangle=-30,
    )

    mo.vstack([bar_fig, heatmap_table])
    return


@app.cell(hide_code=True)
def candidate_card_markdown(mo):
    mo.md(r"""
    ## Planet candidate card

    Select any planet from the current filtered ranking to see a detailed profile.
    Each card shows eight key measurements and a plain-English interpretation of
    what those numbers mean for Earth-likeness.
    """)
    return


@app.cell(hide_code=True)
def candidate_selector(df_scored, mo):
    planet_options = df_scored.head(50).get_column("pl_name").to_list()

    planet_dropdown = mo.ui.dropdown(
        options=planet_options,
        value=planet_options[0] if planet_options else None,
        label="Select a planet",
    )

    return (planet_dropdown,)


@app.cell(hide_code=True)
def candidate_card(base64, df_scored, mo, pl, planet_dropdown):
    selected = planet_dropdown.value

    def _fmt(val, unit="", decimals=2):
        if val is None:
            return "Not measured"
        return f"{round(val, decimals)} {unit}".strip()

    if selected is None or df_scored.height == 0:
        candidate_profile_card = mo.callout(
            mo.md("*No planets match the current filters. Adjust the sliders above.*"),
            kind="warn",
        )
    else:
        row = df_scored.filter(pl.col("pl_name") == selected).head(1)

        if row.height == 0:
            candidate_profile_card = mo.callout(
                mo.md("*Planet not found in current filter results.*"),
                kind="warn",
            )
        else:
            r = row.row(0, named=True)
            score = r["earth_likeness_score"]

            if r["pl_rade"] is not None:
                if r["pl_rade"] <= 1.25:
                    radius_note = "Rocky Earth-size world — likely a solid, geologically active planet."
                elif r["pl_rade"] <= 1.6:
                    radius_note = "Super-Earth, possibly rocky. Could have a thick atmosphere or shallow ocean."
                elif r["pl_rade"] <= 4.0:
                    radius_note = "Mini-Neptune — probably has a substantial gas or water envelope above a rocky core."
                else:
                    radius_note = "Gas giant — no solid surface expected."
            else:
                radius_note = "Radius not measured."

            if r["pl_eqt"] is not None:
                if 200 <= r["pl_eqt"] <= 350:
                    temp_note = "Equilibrium temperature broadly compatible with liquid water — in the right ballpark for habitability."
                elif r["pl_eqt"] < 200:
                    temp_note = "Equilibrium temperature is cold — liquid water would require a strong greenhouse effect."
                elif r["pl_eqt"] <= 500:
                    temp_note = "Warmer than Earth's equilibrium temperature — potentially still interesting with the right atmosphere."
                else:
                    temp_note = "Too hot for liquid water on the surface under most atmospheric scenarios."
            else:
                temp_note = "Equilibrium temperature not measured."

            nearby = r["sy_dist"] is not None and r["sy_dist"] < 100
            dist_note = (
                f"At only {_fmt(r['sy_dist'], 'pc')}, this is a relatively nearby system — "
                "a high-priority target for future atmospheric follow-up."
                if nearby else
                f"At {_fmt(r['sy_dist'], 'pc')}, this system is fairly distant — "
                "atmospheric characterisation would be very challenging with current technology."
            )

            artist_image_path = (
                "/Users/ryans/.cursor/projects/"
                "Users-ryans-Desktop-Moderna-Hackathon/assets/"
                "wolf-1069-b-artist-impression.png"
            )
            artist_image_html = ""
            if selected == "Wolf 1069 b":
                try:
                    with open(artist_image_path, "rb") as image_file:
                        image_data = base64.b64encode(image_file.read()).decode("ascii")
                    artist_image_html = f"""
<figure style="margin: 0 0 1rem 0;">
  <img
    src="data:image/png;base64,{image_data}"
    alt="Artist impression of Wolf 1069 b"
    style="width: 100%; border-radius: 12px; box-shadow: 0 4px 16px rgba(0,0,0,0.18);"
  />
  <figcaption style="font-size: 0.85rem; color: #586069; margin-top: 0.35rem;">
    Artist-style illustration generated for this demo, not a telescope image.
    Wolf 1069 b has not been directly photographed.
  </figcaption>
</figure>
"""
                except FileNotFoundError:
                    artist_image_html = ""

            candidate_profile_card = mo.vstack([
                mo.md(f"### {selected}"),
                mo.md(artist_image_html) if artist_image_html else mo.md(""),
                mo.hstack([
                    mo.stat(label="Radius", value=_fmt(r["pl_rade"], "R⊕")),
                    mo.stat(label="Eq. temperature", value=_fmt(r["pl_eqt"], "K", 0)),
                    mo.stat(label="Orbital period", value=_fmt(r["pl_orbper"], "days")),
                    mo.stat(label="Distance", value=_fmt(r["sy_dist"], "pc")),
                ]),
                mo.hstack([
                    mo.stat(label="Host star", value=r["hostname"] or "Unknown"),
                    mo.stat(label="Discovery method", value=r["discoverymethod"] or "Unknown"),
                    mo.stat(label="Discovery year", value=str(r["disc_year"]) if r["disc_year"] else "Unknown"),
                    mo.stat(label="Earth-likeness score", value=f"{score:.4f}"),
                ]),
                mo.md(f"""
**Size:** {radius_note}

**Temperature:** {temp_note}

**Distance:** {dist_note}
"""),
                mo.callout(
                    mo.md(
                        "The Earth-likeness score is exploratory only. It rewards small radius, "
                        "Earth-like equilibrium temperature, and closer distance. "
                        "It says nothing about atmosphere composition, water, stellar activity, "
                        "moons, or actual habitability."
                    ),
                    kind="info",
                ),
            ])

    return (candidate_profile_card,)


@app.cell(hide_code=True)
def candidate_card_display(candidate_profile_card):
    candidate_profile_card
    return


@app.cell(hide_code=True)
def final_insight_markdown(mo):
    mo.md(r"""
    ## What this tells us

    A few key takeaways from the catalog:

    - **We are biased toward what we can detect.** Transit and radial velocity methods favor
      large planets on short orbits close to bright stars. The true population of small,
      temperate, far-out planets is almost certainly much larger than our current census.

    - **The Fulton gap is real.** There is a genuine deficit of planets with radii 1.5–2 R⊕,
      suggesting that planets either stay rocky or puff up with hydrogen envelopes — atmospheric
      escape from stellar irradiation likely sets the boundary.

    - **The nearest candidates are achievable targets.** Future missions like
      LIFE, HWO (Habitable Worlds Observatory), or ELT direct imaging could
      characterize the atmospheres of the closest Earth-size planets in temperate zones.

    - **Earth is rare in the catalog — but not necessarily rare in the universe.**
      Our planet is harder to find than most of what we have confirmed so far.
      The small temperate planets that exist are simply harder to detect.
    """)
    return


if __name__ == "__main__":
    app.run()
