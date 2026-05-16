# /// script
# dependencies = [
#     "marimo",
#     "matplotlib==3.10.9",
#     "pandas==3.0.3",
#     "plotly==6.7.0",
#     "statsmodels==0.14.6",
# ]
# requires-python = ">=3.11"
# ///

import marimo

__generated_with = "0.23.6"
app = marimo.App(width="medium")


@app.cell(hide_code=True)
def _():
    return


@app.cell(hide_code=True)
def _():
    return


@app.cell(hide_code=True)
def _():
    return


@app.cell(hide_code=True)
def _():
    return


@app.cell(hide_code=True)
def _():
    return


@app.cell(hide_code=True)
def _():
    return


@app.cell(hide_code=True)
def _():
    return


@app.cell(hide_code=True)
def _():
    return


@app.cell
def _():
    import marimo as mo

    return (mo,)


@app.cell(hide_code=True)
def _():
    import marimo as mo

    mo.md("*Eighty-four months of Boston—planes, paychecks, and towers still waiting in the wings.*")
    return (mo,)


@app.cell(hide_code=True)
def _(mo):
    mo.md(r"""
    # Boston’s pulse, month by month (2013–2019)

    One CSV row per month stitches together what the Planning Department once watched in parallel: Logan’s
    footsteps through the terminal, hotel keys turning, payrolls swelling or shrinking, the **shadow inventory
    of cranes-to-be**, and the quieter ink of foreclosures and deeds.

    The tape stops at **December 2019**. Today’s dashboards pick up from **2019 onward** with hubs and fresher
    vintages—this chapter is deliberately **retro**, a fixed window where boom, caution, and late-decade cooling
    all share the same schema.

    **The cast:** mobility and hospitality (`logan_*`, `hotel_*`), labor (`total_jobs`, `unemp_rate`,
    `labor_force_part_rate`), pipeline economics, stress in `foreclosure_*`, and housing fields that sometimes
    fade to zeros when reporting thins out. The next cell is the **program note**—plain-language names inferred
    from columns until an official dictionary ships beside the file.
    """)
    return


@app.cell(hide_code=True)
def _(mo):
    mo.md(r"""
    ## Field guide — who each column plays

    Before the charts land, meet the ensemble. Names come straight from the CSV; labels here keep the cast
    straight so nobody reads `pipeline_sqft` as baggage claim square footage.

    | Column | Likely meaning |
    |--------|----------------|
    | `Year`, `Month` | Calendar period for the row |
    | `logan_passengers` | Passenger volume at Logan Airport (proxy for mobility / tourism) |
    | `logan_intl_flights` | International flight operations (connectivity) |
    | `hotel_occup_rate` | Hotel occupancy rate (0–1 scale in file) |
    | `hotel_avg_daily_rate` | ADR — average daily room rate ($) |
    | `total_jobs` | All jobs in scope of the series (city / MSA per source metadata) |
    | `unemp_rate` | Unemployment rate (fraction, e.g. `0.05` ≈ 5%) |
    | `labor_force_part_rate` | Labor-force participation (fraction) |
    | `pipeline_unit` | Units in the development pipeline |
    | `pipeline_total_dev_cost` | Reported development cost in pipeline ($) |
    | `pipeline_sqft` | Pipeline square footage |
    | `pipeline_const_jobs` | Construction jobs linked to pipeline activity |
    | `foreclosure_pet` | Foreclosure petitions filed |
    | `foreclosure_deeds` | Foreclosure deeds recorded |
    | `med_housing_price` | Median home price ($) |
    | `housing_sales_vol` | Count of home sales |
    | `new_housing_const_permits` | New private housing unit permits |
    | `new-affordable_housing_permits` | Affordable-housing permits (hyphenated column name in CSV) |

    Official open-data documentation still wins for units and geography—treat this table as **program notes**,
    not statute.
    """)
    return


@app.cell(hide_code=True)
def _(mo):
    from pathlib import Path
    import pandas as pd

    DATA_PATH = Path(__file__).resolve().parent / "data" / "economic-indicators.csv"
    df = pd.read_csv(DATA_PATH)
    df["date"] = pd.to_datetime(
        {"year": df["Year"], "month": df["Month"], "day": 1},
        errors="coerce",
    )

    meta = mo.md(
        f"The manuscript is **`{DATA_PATH.name}`**: {len(df):,} monthly beats from **{df['date'].min():%Y-%m}** "
        f"through **{df['date'].max():%Y-%m}**, carrying **{len(df.columns)}** measurements each time the calendar flips."
    )

    mo.vstack(
        [
            meta,
            mo.md("### Opening bars — the first six months on stage"),
            mo.ui.table(df.head(6)),
            mo.md("### Curtain call — the last four rows"),
            mo.ui.table(df.tail(4)),
            mo.md("### Types & what actually arrived each month"),
            mo.ui.table(
                pd.DataFrame(
                    {"dtype": df.dtypes.astype(str), "non_null": df.notna().sum()}
                )
                .reset_index()
                .rename(columns={"index": "column"})
            ),
        ],
        gap=1,
    )
    return (df,)


@app.cell(hide_code=True)
def _(df, mo):
    num = df.select_dtypes(include=["number", "bool"])
    frac_zero = (num == 0).mean().sort_values(ascending=False)

    mo.vstack(
        [
            mo.md(
                "### The silence written as zeros\n"
                "Some housing columns fall to **zero** and stay there—not always because the city had no homes, "
                "but because a legacy extract stopped carrying the signal. Correlations and logs can hear ghosts "
                "unless the story names the hole: **zero is not always truth**, sometimes it is **missing light**."
            ),
            mo.ui.table(
                frac_zero.rename("fraction_of_rows_equal_to_0").to_frame().head(20)
            ),
        ],
        gap=1,
    )
    return


@app.cell(hide_code=True)
def _(df, mo):
    import plotly.graph_objects as go_jobs
    from plotly.subplots import make_subplots as make_subplots_jobs

    _jobs_fig = make_subplots_jobs(specs=[[{"secondary_y": True}]])

    _jobs_fig.add_trace(
        go_jobs.Scatter(
            x=df["date"],
            y=df["total_jobs"] / 1e3,
            name="Total jobs (k)",
            mode="lines",
            line=dict(color="#1f77b4", width=2),
            hovertemplate="%{x|%Y-%m}<br>Jobs (k): %{y:.1f}<extra></extra>",
        ),
        secondary_y=False,
    )
    _jobs_fig.add_trace(
        go_jobs.Scatter(
            x=df["date"],
            y=df["unemp_rate"] * 100,
            name="Unemployment (%)",
            mode="lines",
            line=dict(color="#d62728", width=2),
            hovertemplate="%{x|%Y-%m}<br>Unemployment: %{y:.2f}%<extra></extra>",
        ),
        secondary_y=True,
    )
    _jobs_fig.update_layout(
        title="Boston legacy indicators: employment level vs unemployment rate",
        hovermode="x unified",
        height=420,
        legend=dict(orientation="h", yanchor="bottom", y=1.05, x=0.5, xanchor="center"),
        margin=dict(l=55, r=55, t=70, b=45),
    )
    _jobs_fig.update_xaxes(title_text="Month")
    _jobs_fig.update_yaxes(title_text="Jobs (k)", secondary_y=False, showgrid=True)
    _jobs_fig.update_yaxes(title_text="Unemployment (%)", secondary_y=True, showgrid=False)

    mo.ui.plotly(_jobs_fig)
    return


@app.cell(hide_code=True)
def _(mo):
    mo.md(r"""
    ## Acts still waiting in the wings

    The monthly line already hints at sequels this extract never filmed: **pipeline variables murmuring a beat
    ahead of permits**, Logan and hotels rising as one tourist tide, unemployment arguing with participation in
    the same labor scene. Foreclosures can be remixed into a **stress score** beside prices. Seasonality—already
    unmasked for mobility and hotels—can be compared before and after the big pipeline summers of **2017–2019**.
    Layer in CPI or mortgage rates from outside Boston and the audience suddenly hears what was national versus
    local.

    Pick one through-line, scrub the sparse columns honestly, and the next chart becomes a closing argument—not
    a footnote.
    """)
    return


@app.cell(hide_code=True)
def _(mo):
    mo.md(r"""
    ## Does Boston breathe on a calendar?

    Winter runways empty out; summer fills them again—sometimes gently, sometimes like a gate change announced
    too late. Hotels hum the same chorus with occupancy and ADR. The blocks below score **how wide the year swings**,
    paint **year × month** for Logan, then split the signal with **STL**—trend, seasonal wobble, and the improvisational
    spikes left in the residuals (`seasonal=13` is the usual monthly knob).
    """)
    return


@app.cell(hide_code=True)
def _(df, mo):
    _mobility = ["logan_passengers", "hotel_occup_rate", "hotel_avg_daily_rate", "total_jobs"]
    _moy = df.groupby("Month", observed=True)[_mobility].mean().sort_index()

    _lines = [
        "| Series | Seasonal swing (% of mean-of-monthly-means) |",
        "|---|---|",
    ]
    for _col in _mobility:
        _m = df.groupby("Month", observed=True)[_col].mean()
        _amp = (float(_m.max()) - float(_m.min())) / max(float(_m.mean()), 1e-12) * 100
        _lines.append(f"| `{_col}` | {_amp:.1f}% |")

    mo.vstack(
        [
            mo.md(
                "### How wide the year swings\n"
                "Each row averages the same calendar month across 2013–2019. **Swing %** measures how far the "
                "peak month sits above the trough, relative to the average month—a spotlight on **within-year drama**, "
                "not a full variance decomposition."
            ),
            mo.md("\n".join(_lines)),
            mo.md("### Month-by-month averages"),
            mo.ui.table(_moy.round(4)),
        ],
        gap=1,
    )
    return


@app.cell(hide_code=True)
def _(df, mo):
    import plotly.graph_objects as go_hm

    _piv = df.pivot_table(index="Year", columns="Month", values="logan_passengers", aggfunc="mean")
    _hm = go_hm.Figure(
        data=go_hm.Heatmap(
            z=_piv.values,
            x=[str(m) for m in _piv.columns],
            y=[str(y) for y in _piv.index],
            colorscale="YlOrRd",
            hovertemplate="Year=%{y}<br>Month=%{x}<br>Passengers=%{z:,}<extra></extra>",
        )
    )
    _hm.update_layout(
        title="Logan passengers — year × month (hover + zoom)",
        height=400,
        xaxis_title="Calendar month",
        yaxis_title="Year",
        margin=dict(l=60, r=30, t=55, b=50),
    )

    mo.vstack(
        [
            mo.md(
                "### Logan as a calendar quilt\n"
                "Years climb top to bottom; months march left to right. When summers glow the same hue every lap "
                "around the sun, seasonality is writing the plot. When a lone square flares, something episodic "
                "stole the scene—zoom and hover to read which month it was."
            ),
            mo.ui.plotly(_hm),
        ],
        gap=1,
    )
    return


@app.cell(hide_code=True)
def _(df, mo):
    import plotly.graph_objects as go_stl
    from plotly.subplots import make_subplots as make_subplots_stl
    from statsmodels.tsa.seasonal import STL

    _d = df.sort_values("date").set_index("date")
    _logan_s = _d["logan_passengers"].astype(float)
    _hotel_s = _d["hotel_occup_rate"].astype(float)

    _fit_l = STL(_logan_s, seasonal=13, robust=True).fit()
    _fit_h = STL(_hotel_s, seasonal=13, robust=True).fit()

    _xt = _logan_s.index
    _sfig = make_subplots_stl(
        rows=3,
        cols=2,
        shared_xaxes=True,
        vertical_spacing=0.07,
        subplot_titles=(
            "Logan — trend",
            "Hotel occ — trend",
            "Logan — seasonal",
            "Hotel occ — seasonal",
            "Logan — residual",
            "Hotel occ — residual",
        ),
    )

    _sfig.add_trace(
        go_stl.Scatter(
            x=_xt,
            y=_fit_l.trend,
            mode="lines",
            line=dict(color="#1f77b4", width=2),
            showlegend=False,
            hovertemplate="%{x|%Y-%m}<br>trend: %{y:,.0f}<extra></extra>",
        ),
        row=1,
        col=1,
    )
    _sfig.add_trace(
        go_stl.Scatter(
            x=_xt,
            y=_fit_h.trend,
            mode="lines",
            line=dict(color="#1f77b4", width=2),
            showlegend=False,
            hovertemplate="%{x|%Y-%m}<br>trend: %{y:.3f}<extra></extra>",
        ),
        row=1,
        col=2,
    )
    _sfig.add_trace(
        go_stl.Scatter(
            x=_xt,
            y=_fit_l.seasonal,
            mode="lines",
            line=dict(color="#2ca02c", width=2),
            showlegend=False,
            hovertemplate="%{x|%Y-%m}<br>seasonal: %{y:,.0f}<extra></extra>",
        ),
        row=2,
        col=1,
    )
    _sfig.add_trace(
        go_stl.Scatter(
            x=_xt,
            y=_fit_h.seasonal,
            mode="lines",
            line=dict(color="#2ca02c", width=2),
            showlegend=False,
            hovertemplate="%{x|%Y-%m}<br>seasonal: %{y:.4f}<extra></extra>",
        ),
        row=2,
        col=2,
    )
    _sfig.add_trace(
        go_stl.Scatter(
            x=_xt,
            y=_fit_l.resid,
            mode="lines",
            line=dict(color="#7f7f7f", width=1),
            showlegend=False,
            hovertemplate="%{x|%Y-%m}<br>resid: %{y:,.0f}<extra></extra>",
        ),
        row=3,
        col=1,
    )
    _sfig.add_trace(
        go_stl.Scatter(
            x=_xt,
            y=_fit_h.resid,
            mode="lines",
            line=dict(color="#7f7f7f", width=1),
            showlegend=False,
            hovertemplate="%{x|%Y-%m}<br>resid: %{y:.4f}<extra></extra>",
        ),
        row=3,
        col=2,
    )

    _sfig.update_layout(height=720, hovermode="x unified", margin=dict(t=90, b=45))
    _sfig.update_xaxes(title_text="Date", row=3, col=1)
    _sfig.update_xaxes(title_text="Date", row=3, col=2)

    mo.vstack(
        [
            mo.md(
                "### Peeling Logan and hotels into trend, season, and noise\n"
                "**Trend** carries the long arc—recovery, crowded summers, policy ripples. **Seasonal** is the "
                "metronome of twelve months. **Residual** is the subplot: storms, holidays, strikes, odd prints. "
                "Drag the Plotly toolbar to zoom—freeze-frame a spike, then tell the Boston headline that lived there."
            ),
            mo.ui.plotly(_sfig),
        ],
        gap=1,
    )
    return


@app.cell(hide_code=True)
def _(mo):
    mo.md(r"""
    ### Director’s notes on the STL knobs

    Dial **seasonal=`** with odd integers: higher smooths the summer–winter wave; lower lets mid-year kinks speak.
    If Logan’s swings grow with its level, logging the series (`log1p`) before STL reframes the noise as multiplicative.
    Labor totals and pipelines move slowly—STL’s seasonal line may barely whisper; **year-over-year growth** or a gentle
    HP filter sometimes steals that scene instead.

    Closing shot for judges: **heatmap first**, one STL wall, then a single sentence tying a residual spike to a
    headline Boston lived through.
    """)
    return


@app.cell(hide_code=True)
def _(mo):
    mo.md(r"""
    ## When jobs tables meet deed rooms

    Same month, same city: payroll, unemployment, and participation on one side of the glass; pipeline tonnage,
    permits, foreclosures, and sale ink on the other. The heatmaps below are **contemporaneous duets**—they rise
    and fall together when macro weather hits every instrument at once; they are not proof one lever pulled the
    other. Housing fields hollow out into zeros in later measures, so **Pearson stays honest about linear tilt**,
    while **Spearman listens in ranks**—neither fixes a structural zero, which is why a filtered chapter follows.
    """)
    return


@app.cell(hide_code=True)
def _(df, mo):
    import plotly.graph_objects as go_labor_re

    _labor_cols = ["total_jobs", "unemp_rate", "labor_force_part_rate"]
    _re_cols = [
        "pipeline_unit",
        "pipeline_total_dev_cost",
        "pipeline_sqft",
        "pipeline_const_jobs",
        "foreclosure_pet",
        "foreclosure_deeds",
        "med_housing_price",
        "housing_sales_vol",
        "new_housing_const_permits",
        "new-affordable_housing_permits",
    ]
    _all = _labor_cols + _re_cols

    _cross_p = df[_all].corr(method="pearson", numeric_only=True).loc[_labor_cols, _re_cols]
    _cross_s = df[_all].corr(method="spearman", numeric_only=True).loc[_labor_cols, _re_cols]

    _fig_p = go_labor_re.Figure(
        data=go_labor_re.Heatmap(
            z=_cross_p.values,
            x=[str(c) for c in _cross_p.columns],
            y=[str(c) for c in _cross_p.index],
            zmin=-1,
            zmax=1,
            colorscale="RdBu",
            zmid=0,
            hovertemplate="Labor: %{y}<br>Real estate: %{x}<br>Pearson r = %{z:.3f}<extra></extra>",
        )
    )
    _fig_p.update_layout(
        title="Pearson r — labor (rows) vs real estate (columns)",
        height=340,
        margin=dict(l=120, r=30, t=55, b=160),
        xaxis=dict(tickangle=-45),
    )

    _fig_s = go_labor_re.Figure(
        data=go_labor_re.Heatmap(
            z=_cross_s.values,
            x=[str(c) for c in _cross_s.columns],
            y=[str(c) for c in _cross_s.index],
            zmin=-1,
            zmax=1,
            colorscale="RdBu",
            zmid=0,
            hovertemplate="Labor: %{y}<br>Real estate: %{x}<br>Spearman ρ = %{z:.3f}<extra></extra>",
        )
    )
    _fig_s.update_layout(
        title="Spearman ρ — same split (rank-based)",
        height=340,
        margin=dict(l=120, r=30, t=55, b=160),
        xaxis=dict(tickangle=-45),
    )

    mo.vstack(
        [
            mo.md(
                "### Two lenses on the same duet\n"
                "**Pearson** tracks straight-line leaning; **Spearman** tracks whether highs and lows line up "
                "monotonically. Walk the rows with a labor hat, the columns with a real-estate hat—hover paints "
                "each coefficient like a line reading."
            ),
            mo.ui.plotly(_fig_p),
            mo.ui.plotly(_fig_s),
        ],
        gap=1,
    )
    return


@app.cell(hide_code=True)
def _(df, mo):
    import plotly.graph_objects as go_labor_re_sub

    sub_labor = ["total_jobs", "unemp_rate", "labor_force_part_rate"]
    sub_re = [
        "pipeline_unit",
        "pipeline_total_dev_cost",
        "pipeline_sqft",
        "pipeline_const_jobs",
        "foreclosure_pet",
        "foreclosure_deeds",
        "med_housing_price",
        "housing_sales_vol",
        "new_housing_const_permits",
        "new-affordable_housing_permits",
    ]
    sub_all = sub_labor + sub_re

    sub_mask = (df["med_housing_price"] > 0) & (df["housing_sales_vol"] > 0)
    sub_dfh = df.loc[sub_mask, sub_all]
    sub_n = len(sub_dfh)

    sub_cross_h = sub_dfh.corr(method="spearman", numeric_only=True).loc[sub_labor, sub_re]

    sub_fig_h = go_labor_re_sub.Figure(
        data=go_labor_re_sub.Heatmap(
            z=sub_cross_h.values,
            x=[str(c) for c in sub_cross_h.columns],
            y=[str(c) for c in sub_cross_h.index],
            zmin=-1,
            zmax=1,
            colorscale="RdBu",
            zmid=0,
            hovertemplate="Labor: %{y}<br>RE: %{x}<br>Spearman ρ = %{z:.3f}<extra></extra>",
        )
    )
    sub_fig_h.update_layout(
        title="Spearman ρ — months with med_housing_price > 0 AND housing_sales_vol > 0",
        height=360,
        margin=dict(l=120, r=30, t=55, b=160),
        xaxis=dict(tickangle=-45),
    )

    mo.vstack(
        [
            mo.md(
                f"### The months when price and volume still spoke\n"
                f"**{sub_n}** nights keep both median price and sales volume above zero—Spearman finally hears "
                f"housing traffic without the later tape hiss of all-zero months. Pipeline and foreclosure columns "
                f"ride the same surviving dates; read them as echoes, not as the whole city."
            ),
            mo.ui.plotly(sub_fig_h),
        ],
        gap=1,
    )
    return


@app.cell(hide_code=True)
def _(df, mo):
    ins_labor = ["total_jobs", "unemp_rate", "labor_force_part_rate"]
    ins_re = [
        "pipeline_unit",
        "pipeline_total_dev_cost",
        "pipeline_sqft",
        "pipeline_const_jobs",
        "foreclosure_pet",
        "foreclosure_deeds",
        "med_housing_price",
        "housing_sales_vol",
        "new_housing_const_permits",
        "new-affordable_housing_permits",
    ]
    ins_all = ins_labor + ins_re
    ins_spear = df[ins_all].corr(method="spearman", numeric_only=True).loc[ins_labor, ins_re]

    ins_pairs = []
    for ins_L in ins_labor:
        for ins_R in ins_re:
            ins_v = float(ins_spear.loc[ins_L, ins_R])
            ins_pairs.append((abs(ins_v), ins_L, ins_R, ins_v))
    ins_pairs.sort(key=lambda t: t[0], reverse=True)
    ins_top6 = ins_pairs[:6]
    ins_bot3 = sorted(ins_pairs, key=lambda t: t[3])[:3]

    ins_lines = ["| | Labor variable | Real-estate variable | Spearman ρ |", "|---|---|---|---|"]
    for _, ins_L, ins_R, ins_v in ins_top6:
        ins_lines.append(f"| strong | `{ins_L}` | `{ins_R}` | {ins_v:+.2f} |")
    ins_md_table = "\n".join(ins_lines)

    ins_weak = ["| | Labor variable | Real-estate variable | Spearman ρ |", "|---|---|---|---|"]
    for _, ins_L, ins_R, ins_v in ins_bot3:
        ins_weak.append(f"| weak / negative | `{ins_L}` | `{ins_R}` | {ins_v:+.2f} |")
    ins_md_weak = "\n".join(ins_weak)

    mo.md(
        "## The moral of the correlation duet\n\n"
        "**Spearman** narrates in ranks—polite to outliers, still honest about direction. Every coefficient here "
        "shares a calendar page: **macro weather** can lift jobs and pipeline in the same paragraph without either "
        "being the author of the other.\n\n"
        "### Motifs that keep returning\n"
        "- **Pipeline scale** beside employment: when staging gets ambitious, payroll often looks busy too— "
        "construction finance, confidence, and migration share that lighting, so the story reads it as **shared boom "
        "glow**, not a single lever called housing.\n"
        "- **Foreclosures alongside unemployment**: both get louder when the city tightens; the alignment is "
        "**emotional realism** for downturn chapters even if the mechanism is slow.\n"
        "- **Price and sales vs labor** once zeros flood in: the broad heatmap exaggerates silence; trust the "
        "filtered act where both housing voices stay above zero.\n\n"
        "### Loudest Spearman lines (same-month, all months)\n"
        + ins_md_table
        + "\n\n### Quietest or inverse threads\n"
        + ins_md_weak
        + "\n\n### Landing this on stage in two minutes\n"
        "Open on **one pipeline series and unemployment or participation** as a cycle shot. "
        "Name the zeros before a judge does. "
        "If the pitch needs causality, change costumes—lags, VARs, or external instruments—or keep the language "
        "squarely in co-movement.\n"
    )
    return


if __name__ == "__main__":
    app.run()
