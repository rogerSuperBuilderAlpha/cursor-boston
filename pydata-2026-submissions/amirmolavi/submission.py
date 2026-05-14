# /// script
# dependencies = [
#     "altair==6.1.0",
#     "marimo",
#     "numpy==2.2.6",
#     "pandas==2.3.3",
#     "scipy==1.15.3",
# ]
# requires-python = ">=3.10"
# ///

import marimo

__generated_with = "0.23.6"
app = marimo.App(width="medium")


@app.cell(hide_code=True)
def _():
    import marimo as mo

    mo.md(
        """
        # The Valley Between Worlds

        Of the **5,000+ planets** we've found orbiting other suns, almost all are small — somewhere between Earth and Neptune. But when you measure them carefully, something strange happens.

        **There is a gap.** A narrow band of sizes that nature appears to avoid.

        Let's find it.
        """
    )

    return (mo,)


@app.cell(hide_code=True)
def _(mo):
    mo.md("""
    ## What we're about to do

    To find planets around other stars, the Kepler space telescope watched
    150,000 stars for four years, looking for the tiny dimming when a planet
    crosses in front of its star. From those dimmings, you can measure the
    planet's **size** with surprising precision.

    What you'd expect, naively, is a smooth distribution of sizes — lots of
    small planets, fewer big ones, maybe a bump or two from how planets form.
    A nice, well-behaved continuum.

    What you actually see is *nothing like that.*

    First, let's grab the data.
    """)
    return


@app.cell
def _(mo):
    import io
    import urllib.parse
    import urllib.request
    from pathlib import Path
    import pandas as pd

    # Cache the TAP fetch on disk so kernel restarts are instant.
    # The Archive's pscomppars view is slow (10-30s) — worth caching.
    _CACHE = Path("kepler_planets.csv")

    _TAP_QUERY = """
    SELECT pl_name, hostname, discoverymethod, disc_facility,
           pl_rade, pl_radeerr1, pl_radeerr2,
           pl_orbper, pl_insol,
           st_teff, st_rad, st_mass
    FROM pscomppars
    WHERE disc_facility LIKE '%Kepler%'
      AND pl_rade IS NOT NULL
      AND pl_orbper IS NOT NULL
    """

    if _CACHE.exists():
        planets_all = pd.read_csv(_CACHE)
        _source = f"loaded {len(planets_all):,} rows from local cache ({_CACHE})"
    else:
        _url = (
            "https://exoplanetarchive.ipac.caltech.edu/TAP/sync"
            "?query=" + urllib.parse.quote(_TAP_QUERY) +
            "&format=csv"
        )
        _raw = urllib.request.urlopen(_url, timeout=120).read().decode("utf-8")
        planets_all = pd.read_csv(io.StringIO(_raw))
        planets_all.to_csv(_CACHE, index=False)
        _source = f"fetched {len(planets_all):,} rows from NASA Exoplanet Archive (cached to {_CACHE})"

    mo.md(f"**{_source}**")

    return pd, planets_all


@app.cell
def _(mo, planets_all):
    import numpy as np

    # Tighter Fulton-style cuts — the gap is sharpest for short-period planets
    # around Sun-like stars, where Kepler's photometry gives the cleanest radii.
    _p = planets_all.dropna(subset=["pl_rade", "pl_orbper", "st_teff"]).copy()
    _p["_radius_unc_frac"] = (
        _p[["pl_radeerr1", "pl_radeerr2"]].abs().max(axis=1) / _p["pl_rade"]
    )

    planets = _p[
        (_p["pl_orbper"] < 30)                            # short period — gap is sharpest here
        & (_p["pl_rade"] < 6)
        & (_p["st_teff"].between(5000, 6500))             # G stars (Sun-like)
        & (_p["_radius_unc_frac"] < 0.10)                 # well-measured radii
    ].reset_index(drop=True)

    mo.md(f"""
    **Sample cuts**

    | Filter | Survivors |
    |---|---:|
    | All Kepler confirmed planets | {len(planets_all):,} |
    | Orbital period < 30 days | {((_p['pl_orbper'] < 30)).sum():,} |
    | Radius < 6 R⊕ | {((_p['pl_orbper'] < 30) & (_p['pl_rade'] < 6)).sum():,} |
    | Sun-like host star (5000 ≤ T<sub>eff</sub> ≤ 6500 K) | {((_p['pl_orbper'] < 30) & (_p['pl_rade'] < 6) & (_p['st_teff'].between(5000, 6500))).sum():,} |
    | **Radius uncertainty < 10%** (final sample) | **{len(planets):,}** |

    These are the cuts from Fulton et al. (2017): short-period planets around Sun-like stars, with radii measured to better than 10%. Smaller cleaner sample, but the signal stands out *much* more clearly.
    """)

    return np, planets


@app.cell
def _(np, pd, planets):
    import altair as alt
    from scipy.stats import gaussian_kde

    # Log-spaced radius bins from 0.5 to 6 R⊕
    _edges = np.logspace(np.log10(0.5), np.log10(6.0), 28)
    _centers = np.sqrt(_edges[:-1] * _edges[1:])
    _counts, _ = np.histogram(planets["pl_rade"], bins=_edges)

    _hist_df = pd.DataFrame({
        "radius": _centers,
        "count": _counts,
        "bin_left": _edges[:-1],
        "bin_right": _edges[1:],
    })

    # Gaussian KDE in log-radius space — produces the iconic smooth curve
    _logR = np.log10(planets["pl_rade"].dropna().values)
    _kde = gaussian_kde(_logR, bw_method=0.18)
    _grid = np.linspace(np.log10(0.5), np.log10(6.0), 400)
    _dens = _kde(_grid)
    # Scale density to roughly match histogram height for overlay
    _bin_width = (np.log10(_edges[1]) - np.log10(_edges[0]))
    _dens_scaled = _dens * len(_logR) * _bin_width
    _kde_df = pd.DataFrame({"radius": 10**_grid, "density": _dens_scaled})

    # Highlight the gap region 1.5-2.0 R⊕
    _gap = alt.Chart(pd.DataFrame({"x1": [1.5], "x2": [2.0]})).mark_rect(
        color="#ffcc00", opacity=0.18
    ).encode(x="x1:Q", x2="x2:Q")

    _bars = alt.Chart(_hist_df).mark_bar(
        color="#5B8DEF", stroke="white", strokeWidth=0.5, opacity=0.85
    ).encode(
        x=alt.X("bin_left:Q",
                scale=alt.Scale(type="log", domain=[0.5, 6]),
                axis=alt.Axis(title="Planet radius (R⊕)", values=[0.5, 1, 1.5, 2, 3, 4, 6], format=".1f")),
        x2="bin_right:Q",
        y=alt.Y("count:Q", axis=alt.Axis(title="Number of planets")),
        tooltip=[alt.Tooltip("radius:Q", title="R⊕", format=".2f"),
                 alt.Tooltip("count:Q", title="planets")],
    )

    _kde_line = alt.Chart(_kde_df).mark_line(
        color="#1a3a6e", strokeWidth=2.5
    ).encode(x="radius:Q", y="density:Q")

    _super_label = alt.Chart(pd.DataFrame({
        "x": [1.25], "y": [_counts.max() * 1.02], "text": ["super-Earths"]
    })).mark_text(fontSize=12, fontWeight="bold", color="#1a3a6e").encode(
        x="x:Q", y="y:Q", text="text:N"
    )

    _mini_label = alt.Chart(pd.DataFrame({
        "x": [2.45], "y": [_counts.max() * 1.02], "text": ["mini-Neptunes"]
    })).mark_text(fontSize=12, fontWeight="bold", color="#1a3a6e").encode(
        x="x:Q", y="y:Q", text="text:N"
    )

    _gap_label = alt.Chart(pd.DataFrame({
        "x": [1.75], "y": [_counts.max() * 0.55], "text": ["THE GAP"]
    })).mark_text(fontSize=16, fontWeight="bold", color="#b07c00").encode(
        x="x:Q", y="y:Q", text="text:N"
    )

    chart = (_gap + _bars + _kde_line + _super_label + _mini_label + _gap_label).properties(
        width=720, height=420,
        title=alt.TitleParams(
            text=f"The Fulton Gap — {len(planets)} Sun-like-star planets, P < 30 days",
            subtitle="Bars: planet counts in log-radius bins. Curve: smoothed density. Yellow band: the empty zone.",
            fontSize=18, subtitleFontSize=12, anchor="start"
        )
    ).configure_view(stroke=None).configure_axis(grid=False)

    chart

    return alt, gaussian_kde


@app.cell(hide_code=True)
def _(mo):
    mo.md("""
    ## Look at this thing

    The histogram below shows the *radii* of every planet in our sample. The
    horizontal axis is planet size in Earth-radii (log scale, so each tick is
    a factor of ~1.5). The bars are how many planets fall in each size bin.
    The dark curve is a smoothed version.

    **Two peaks. One valley.**

    - The left peak (around **1.3 R⊕**) is a population of *super-Earths* —
      rocky worlds a little larger than Earth.
    - The right peak (around **2.4 R⊕**) is a population of *mini-Neptunes* —
      planets with thick hydrogen-helium atmospheres puffing them up.
    - In between, at **1.8 R⊕**, there are barely any planets at all.

    Nature is making rocky worlds and gas worlds, but almost nothing in
    between. That's the **Fulton Gap**, discovered in 2017 by Benjamin Fulton
    and collaborators using exactly this kind of analysis.
    """)
    return


@app.cell(hide_code=True)
def _(mo):
    mo.md("""
    ## So what carved the gap?

    Two main theories — both involve **stripping atmospheres off planets**:

    - **Photoevaporation**: a star's ultraviolet and X-ray photons heat the outer atmosphere of a close-in planet until it boils off into space.
    - **Core-powered mass loss**: residual heat from a planet's hot rocky core leaks out, evaporating the puffy hydrogen envelope from underneath.

    Both theories make the same falsifiable prediction:

    > *The more energy a planet gets from its star, the more atmosphere it loses — so the gap should shift toward smaller radii for hotter planets.*

    **Let's check.** Slide the irradiation range and watch the gap move.
    """)
    return


@app.cell(hide_code=True)
def _(mo):
    mo.md("""
    ### Try it yourself

    The slider below filters the sample by **how much sunlight each planet
    receives** — measured in multiples of Earth's solar flux:

    - **Slide left** to see only planets that get little starlight (cooler,
      further from their star).
    - **Slide right** to see only planets that are roasted (closer in, more
      irradiated).
    - **Both ends together** = full sample, as in the chart above.

    The plot redraws as you slide. A red dashed line marks the empirical
    bottom of the gap. **Watch what happens to it.**
    """)
    return


@app.cell(hide_code=True)
def _(mo):
    import math

    insol_slider = mo.ui.range_slider(
        start=math.log10(3), stop=math.log10(3000), step=0.05,
        value=[math.log10(3), math.log10(3000)],
        label="How much starlight (× Earth's)",
        show_value=False,
        full_width=True,
    )

    return (insol_slider,)


@app.cell
def _(alt, gaussian_kde, insol_slider, mo, np, pd, planets):
    _lo, _hi = 10**insol_slider.value[0], 10**insol_slider.value[1]
    _sel = planets[(planets["pl_insol"] >= _lo) & (planets["pl_insol"] <= _hi)].dropna(subset=["pl_insol", "pl_rade"])

    _edges_r = np.logspace(np.log10(0.5), np.log10(6.0), 28)
    _centers_r = np.sqrt(_edges_r[:-1] * _edges_r[1:])
    _counts_r, _ = np.histogram(_sel["pl_rade"], bins=_edges_r)

    _hist_r = pd.DataFrame({
        "radius": _centers_r,
        "count": _counts_r,
        "bin_left": _edges_r[:-1],
        "bin_right": _edges_r[1:],
    })

    _inner = (_centers_r >= 1.3) & (_centers_r <= 2.5)
    if _inner.any() and len(_sel) >= 30:
        _gap_idx = np.argmin(np.where(_inner, _counts_r, np.inf))
        _gap_center = _centers_r[_gap_idx]
    else:
        _gap_center = None

    _bars_r = alt.Chart(_hist_r).mark_bar(
        color="#5B8DEF", stroke="white", strokeWidth=0.5, opacity=0.85
    ).encode(
        x=alt.X("bin_left:Q",
                scale=alt.Scale(type="log", domain=[0.5, 6]),
                axis=alt.Axis(title="Planet radius (R⊕)", values=[0.5, 1, 1.5, 2, 3, 4, 6], format=".1f")),
        x2="bin_right:Q",
        y=alt.Y("count:Q", axis=alt.Axis(title="Number of planets")),
        tooltip=[alt.Tooltip("radius:Q", title="R⊕", format=".2f"),
                 alt.Tooltip("count:Q", title="planets")],
    )

    _layers = [_bars_r]

    if len(_sel) >= 30:
        _logR = np.log10(_sel["pl_rade"].dropna().values)
        _kde = gaussian_kde(_logR, bw_method=0.20)
        _grid = np.linspace(np.log10(0.5), np.log10(6.0), 400)
        _bw = (np.log10(_edges_r[1]) - np.log10(_edges_r[0]))
        _dens_scaled = _kde(_grid) * len(_logR) * _bw
        _kde_df = pd.DataFrame({"radius": 10**_grid, "density": _dens_scaled})
        _layers.append(alt.Chart(_kde_df).mark_line(color="#1a3a6e", strokeWidth=2).encode(x="radius:Q", y="density:Q"))

    if _gap_center is not None:
        _layers.append(alt.Chart(pd.DataFrame({"x": [_gap_center]})).mark_rule(
            color="#e25", strokeWidth=2.5, strokeDash=[5, 4]
        ).encode(x="x:Q"))
        _layers.append(alt.Chart(pd.DataFrame({
            "x": [_gap_center], "y": [max(_counts_r.max(), 1) * 0.92],
            "text": [f"gap: {_gap_center:.2f} R⊕"]
        })).mark_text(fontSize=13, fontWeight="bold", color="#e25", dx=6, align="left").encode(
            x="x:Q", y="y:Q", text="text:N"
        ))

    chart_reactive = alt.layer(*_layers).properties(
        width=720, height=320,
        title=alt.TitleParams(
            text=f"Filtered sample: {len(_sel)} planets",
            subtitle="Red dashed line marks the deepest dip between super-Earths and mini-Neptunes." if _gap_center is not None else "Too few planets in this range to locate a gap.",
            fontSize=15, subtitleFontSize=12, anchor="start",
        )
    ).configure_view(stroke=None).configure_axis(grid=False)

    _readout = mo.md(
        f"Filtering to planets receiving **{_lo:.0f}× to {_hi:,.0f}×** Earth's solar irradiance "
        f"(Earth = 1, Mercury ≈ 7, hot Jupiters ≈ 1000+)."
    )

    # Stack slider, readout, and chart in one block so they stay together visually
    mo.vstack([insol_slider, _readout, chart_reactive], gap=0.5)

    return


@app.cell(hide_code=True)
def _(mo):
    mo.md("""
    ## One last view — every planet on one plot

    The histogram collapses a 2-D distribution into 1-D. Let's un-collapse it.

    Below, **every planet in our sample is one dot**: orbital period on the x-axis, radius on the y-axis. The gap appears as a horizontal valley — empty sky between the super-Earths and the mini-Neptunes.

    Notice how it tilts. Planets closer to their star (left side) get more energy, lose more atmosphere, and the gap shifts downward. The geometry of atmospheric loss, drawn directly by 525 worlds.
    """)
    return


@app.cell
def _(alt, np, pd, planets):
    _scatter_df = planets.dropna(subset=["pl_orbper", "pl_rade", "pl_insol"]).copy()
    _scatter_df["log_insol"] = np.log10(_scatter_df["pl_insol"])

    # Highlight the gap band 1.5-2.0 R⊕
    _band = alt.Chart(pd.DataFrame({"y1": [1.5], "y2": [2.0]})).mark_rect(
        color="#ffcc00", opacity=0.13
    ).encode(y="y1:Q", y2="y2:Q")

    _points = alt.Chart(_scatter_df).mark_circle(opacity=0.75, stroke="white", strokeWidth=0.4).encode(
        x=alt.X("pl_orbper:Q",
                scale=alt.Scale(type="log", domain=[0.5, 100]),
                axis=alt.Axis(title="Orbital period (days)", values=[1, 3, 10, 30, 100])),
        y=alt.Y("pl_rade:Q",
                scale=alt.Scale(type="log", domain=[0.7, 6]),
                axis=alt.Axis(title="Planet radius (R⊕)", values=[0.7, 1, 1.5, 2, 3, 4, 6], format=".1f")),
        color=alt.Color("log_insol:Q",
                        scale=alt.Scale(scheme="inferno", reverse=True),
                        legend=alt.Legend(title="Irradiation (log)", format=".1f")),
        size=alt.value(55),
        tooltip=[
            alt.Tooltip("pl_name:N", title="Planet"),
            alt.Tooltip("pl_rade:Q", title="Radius (R⊕)", format=".2f"),
            alt.Tooltip("pl_orbper:Q", title="Period (d)", format=".2f"),
            alt.Tooltip("pl_insol:Q", title="Irradiation (× Earth)", format=",.0f"),
            alt.Tooltip("st_teff:Q", title="Star Teff (K)", format=",.0f"),
        ],
    )

    scatter = (_band + _points).properties(
        width=720, height=440,
        title=alt.TitleParams(
            text="525 worlds, one chart, one gap.",
            subtitle="Yellow band marks the radius valley (1.5–2.0 R⊕). Color encodes how much sunlight each planet receives.",
            fontSize=18, subtitleFontSize=12, anchor="start",
        )
    ).configure_view(stroke=None).configure_axis(grid=False)

    scatter

    return


@app.cell(hide_code=True)
def _(mo):
    mo.md("""
    ---

    **Sources**
    - Data: [NASA Exoplanet Archive — pscomppars](https://exoplanetarchive.ipac.caltech.edu/) (Kepler-discovered confirmed planets)
    - Original finding: [Fulton et al. 2017, *AJ* 154:109](https://iopscience.iop.org/article/10.3847/1538-3881/aa80eb) — *The California-Kepler Survey. III. A Gap in the Radius Distribution of Small Planets*
    - Theory: [Owen & Wu 2017](https://iopscience.iop.org/article/10.3847/1538-4357/aa890a) (photoevaporation); [Ginzburg et al. 2018](https://academic.oup.com/mnras/article/476/1/759/4837866) (core-powered mass loss)
    """)
    return


if __name__ == "__main__":
    app.run()
