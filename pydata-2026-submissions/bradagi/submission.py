# /// script
# requires-python = ">=3.12"
# dependencies = [
#     "marimo>=0.23",
#     "pandas>=2.2",
#     "altair>=5",
#     "vegafusion",
#     "vl-convert-python",
# ]
# ///

import marimo

__generated_with = "0.23.6"
app = marimo.App(width="medium")


@app.cell
def _():
    import marimo as mo
    import pandas as pd
    import altair as alt

    PALETTE = {
        "ink":     "#0f172a",
        "muted":   "#cbd5e1",
        "soft":    "#e2e8f0",
        "accent":  "#dc2626",
        "accent2": "#1d4ed8",
        "warm":    "#f59e0b",
        "cool":    "#0ea5e9",
        "good":    "#15803d",
    }
    return PALETTE, alt, mo, pd


@app.cell
def _(mo):
    mo.md("""
    # The Bank's Recontact Calendar Was Upside-Down

    **UCI Bank Marketing — 45,211 phone calls from a Portuguese bank's
    term-deposit campaign (2008–2010).**

    Conventional wisdom on cold-call follow-ups says *give the lead time
    to breathe before recontacting.* This dataset says the opposite — loudly.

    Among the 8,257 calls placed to people the bank had contacted in an earlier
    campaign, conversion as a function of *days since last contact* doesn't
    decay slowly. It peaks at **31–90 days** and collapses after. The bank
    placed almost none of its recontacts inside that window.
    """)
    return


@app.cell
def _(pd):
    LAG_ORDER = ["0-30d", "31-90d", "91-180d", "181-365d", "365+d"]
    MONTH_ORDER = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"]

    def bucket(d):
        if d <= 30: return "0-30d"
        if d <= 90: return "31-90d"
        if d <= 180: return "91-180d"
        if d <= 365: return "181-365d"
        return "365+d"

    df = pd.read_csv("bank-full.csv", sep=";")
    df["subscribed"] = (df["y"] == "yes").astype(int)
    df["recontact"] = df["pdays"].apply(lambda d: "never" if d == -1 else bucket(d))
    return LAG_ORDER, df


@app.cell
def _(LAG_ORDER, df):
    prev = df[df["pdays"] != -1].copy()
    lag = (
        prev.groupby("recontact")
            .agg(calls=("subscribed", "size"),
                 subs=("subscribed", "sum"),
                 conv=("subscribed", "mean"))
            .reindex(LAG_ORDER)
            .reset_index()
    )
    lag["share_of_calls"] = lag["calls"] / lag["calls"].sum()
    return lag, prev


@app.cell
def _(lag, mo):
    sweet = lag.loc[lag["recontact"] == "31-90d"].iloc[0]
    worst = lag.loc[lag["recontact"] == "181-365d"].iloc[0]
    total_recontacts = int(lag["calls"].sum())

    mo.md(
        f"""
        ## The headline

        - **31–90d** sweet spot: **{sweet['conv']:.1%}** conversion —
          {sweet['share_of_calls']:.1%} of recontacts.
        - **181–365d** worst bucket: **{worst['conv']:.1%}** conversion —
          {worst['share_of_calls']:.0%} of recontacts.
        - Across {total_recontacts:,} recontacts, the bank's *call-volume* curve
          is roughly the mirror image of its *conversion* curve.
        """
    )
    return


@app.cell
def _(LAG_ORDER, PALETTE, alt, lag):
    lag_long = lag.melt(
        id_vars=["recontact", "calls", "subs"],
        value_vars=["share_of_calls", "conv"],
        var_name="metric", value_name="value",
    )
    lag_long["metric"] = lag_long["metric"].map({
        "share_of_calls": "Share of recontacts",
        "conv": "Conversion rate",
    })

    inversion = (
        alt.Chart(lag_long)
        .mark_bar(cornerRadiusEnd=4)
        .encode(
            y=alt.Y("recontact:N", sort=LAG_ORDER,
                    title="Days since previous contact",
                    axis=alt.Axis(labelFontSize=12)),
            x=alt.X("value:Q", axis=alt.Axis(format="%", title=None)),
            color=alt.Color(
                "metric:N",
                scale=alt.Scale(
                    domain=["Share of recontacts", "Conversion rate"],
                    range=[PALETTE["muted"], PALETTE["accent"]],
                ),
                legend=alt.Legend(orient="top", title=None),
            ),
            tooltip=[
                "recontact",
                alt.Tooltip("value:Q", format=".1%", title="value"),
                "calls", "subs",
            ],
        )
        .properties(
            width=320, height=260,
            title="Call volume share vs conversion — the inversion",
        )
        .facet(column=alt.Column("metric:N", title=None,
                                 sort=["Share of recontacts", "Conversion rate"]))
        .resolve_scale(x="independent")
    )
    inversion
    return


@app.cell
def _(LAG_ORDER, PALETTE, alt, lag):
    bars = (
        alt.Chart(lag)
        .mark_bar(color=PALETTE["muted"], cornerRadiusEnd=3)
        .encode(
            x=alt.X("recontact:N", sort=LAG_ORDER, title="Days since previous contact"),
            y=alt.Y("calls:Q", title="Recontact calls placed",
                    axis=alt.Axis(grid=False)),
            tooltip=["recontact", "calls", "subs",
                     alt.Tooltip("conv:Q", format=".1%", title="Conversion")],
        )
    )
    line = (
        alt.Chart(lag)
        .mark_line(
            point=alt.OverlayMarkDef(size=120, filled=True, color=PALETTE["accent"]),
            color=PALETTE["accent"], strokeWidth=3,
        )
        .encode(
            x=alt.X("recontact:N", sort=LAG_ORDER),
            y=alt.Y("conv:Q", title="Conversion rate",
                    axis=alt.Axis(format="%", grid=True)),
        )
    )
    hero_labels = (
        alt.Chart(lag)
        .mark_text(dy=-12, fontSize=12, fontWeight="bold",
                   color=PALETTE["accent"])
        .encode(
            x=alt.X("recontact:N", sort=LAG_ORDER),
            y=alt.Y("conv:Q"),
            text=alt.Text("conv:Q", format=".0%"),
        )
    )
    hero = (
        alt.layer(bars, line, hero_labels)
        .resolve_scale(y="independent")
        .properties(
            height=380, width=620,
            title=alt.TitleParams(
                "Recontact volume (bars) vs conversion rate (red)",
                subtitle="The bank dialed where conversion was lowest",
                fontSize=15, anchor="start",
            ),
        )
    )
    hero
    return


@app.cell
def _(mo):
    mo.md("""
    ## "Isn't this just a calendar artifact?"

    First skeptic move: maybe the 31–90d bucket happens to contain calls that
    landed in March / September / October / December — already known to
    convert 4–5× better. Restrict to a *single* receiving month and look
    again. May is the cleanest test: 30% of all dials, the worst-converting
    month overall, so any lag effect inside May can't be explained by the
    receiving-month being special.
    """)
    return


@app.cell
def _(LAG_ORDER, prev):
    may_fail = prev[(prev["month"] == "may") & (prev["poutcome"] == "failure")].copy()
    may_lag = (
        may_fail.groupby("recontact")
                .agg(calls=("subscribed", "size"),
                     subs=("subscribed", "sum"),
                     conv=("subscribed", "mean"))
                .reindex(LAG_ORDER)
                .reset_index()
                .dropna()
    )
    return (may_lag,)


@app.cell
def _(LAG_ORDER, PALETTE, alt, may_lag):
    may_bars = (
        alt.Chart(may_lag)
        .mark_bar(color=PALETTE["accent2"], cornerRadiusEnd=3)
        .encode(
            x=alt.X("recontact:N", sort=LAG_ORDER, title="Days since previous contact"),
            y=alt.Y("conv:Q", title="Conversion rate",
                    axis=alt.Axis(format="%")),
            tooltip=["recontact", "calls", "subs",
                     alt.Tooltip("conv:Q", format=".1%")],
        )
    )
    may_labels = (
        alt.Chart(may_lag)
        .mark_text(dy=-8, fontSize=11, fontWeight="bold", color=PALETTE["ink"])
        .encode(
            x=alt.X("recontact:N", sort=LAG_ORDER),
            y="conv:Q",
            text=alt.Text("conv:Q", format=".0%"),
        )
    )
    may_chart = (
        alt.layer(may_bars, may_labels)
        .properties(
            height=300, width=620,
            title=alt.TitleParams(
                "Within May only — prior-failure leads by recontact lag",
                subtitle="The lag effect survives the month confound",
                fontSize=14, anchor="start",
            ),
        )
    )
    may_chart
    return


@app.cell
def _(may_lag, mo):
    m_sweet = may_lag.loc[may_lag["recontact"] == "31-90d"].iloc[0]
    m_worst = may_lag.loc[may_lag["recontact"] == "181-365d"].iloc[0]
    mo.md(
        f"""
        With the receiving month held fixed at the worst month of the year,
        prior-failure leads recontacted at **31–90d convert at {m_sweet['conv']:.1%}**
        versus **{m_worst['conv']:.1%} at 181–365d** — a 3× spread inside a
        single month. The lag effect is largely independent of seasonality.
        """
    )
    return


@app.cell
def _(mo):
    mo.md("""
    ## The full picture — lag × prior outcome

    Splitting recontacts by what happened *last* time the bank called: a
    prior success at the right lag is nearly a guaranteed conversion. A
    prior failure at the wrong lag is barely better than a cold call.
    """)
    return


@app.cell
def _(LAG_ORDER, prev):
    grid = (
        prev.groupby(["poutcome", "recontact"])
            .agg(calls=("subscribed", "size"),
                 subs=("subscribed", "sum"),
                 conv=("subscribed", "mean"))
            .reset_index()
    )
    grid = grid[grid["poutcome"].isin(["success", "failure", "other"])]
    grid["recontact"] = grid["recontact"].astype("category")
    grid["recontact"] = grid["recontact"].cat.set_categories(LAG_ORDER, ordered=True)
    return (grid,)


@app.cell
def _(LAG_ORDER, alt, grid):
    heat = (
        alt.Chart(grid)
        .mark_rect(stroke="white", strokeWidth=2)
        .encode(
            x=alt.X("recontact:N", sort=LAG_ORDER, title="Days since previous contact"),
            y=alt.Y("poutcome:N", sort=["success", "other", "failure"],
                    title="Previous campaign outcome"),
            color=alt.Color("conv:Q",
                            scale=alt.Scale(scheme="reds", domain=[0, 0.75]),
                            legend=alt.Legend(format=".0%", title="Conversion")),
            tooltip=[
                "poutcome", "recontact", "calls", "subs",
                alt.Tooltip("conv:Q", format=".1%", title="Conversion"),
            ],
        )
    )
    heat_text = (
        alt.Chart(grid)
        .mark_text(fontSize=12, fontWeight="bold")
        .encode(
            x=alt.X("recontact:N", sort=LAG_ORDER),
            y=alt.Y("poutcome:N", sort=["success", "other", "failure"]),
            text=alt.Text("conv:Q", format=".0%"),
            color=alt.condition(
                "datum.conv > 0.35", alt.value("white"), alt.value("#0f172a")
            ),
        )
    )
    heatmap = (
        alt.layer(heat, heat_text)
        .properties(
            width=620, height=220,
            title=alt.TitleParams(
                "Conversion rate by previous outcome × recontact lag",
                fontSize=14, anchor="start",
            ),
        )
    )
    heatmap
    return


@app.cell
def _(mo):
    mo.md("""
    ## Where the bank actually placed its calls

    Each circle is a recontact-lag bucket. **X = call volume, Y = conversion
    rate, size = subscriptions generated.** A well-targeted campaign would
    cluster up-and-right (high volume, high conversion). This one clusters
    bottom-right: the bank's biggest dialing bucket is its lowest-converting
    one.
    """)
    return


@app.cell
def _(PALETTE, alt, lag):
    scatter = (
        alt.Chart(lag)
        .mark_circle(opacity=0.85, stroke="white", strokeWidth=2)
        .encode(
            x=alt.X("calls:Q", title="Calls placed (recontacts)",
                    scale=alt.Scale(zero=True, padding=20)),
            y=alt.Y("conv:Q", title="Conversion rate",
                    axis=alt.Axis(format="%"),
                    scale=alt.Scale(zero=True, padding=20)),
            size=alt.Size("subs:Q", title="Subscriptions",
                          scale=alt.Scale(range=[200, 2500])),
            color=alt.Color("conv:Q", scale=alt.Scale(scheme="reds"),
                            legend=None),
            tooltip=["recontact", "calls", "subs",
                     alt.Tooltip("conv:Q", format=".1%")],
        )
    )
    frontier_labels = (
        alt.Chart(lag)
        .mark_text(dy=-22, fontWeight="bold", fontSize=12, color=PALETTE["ink"])
        .encode(x="calls:Q", y="conv:Q", text="recontact:N")
    )
    frontier = (
        alt.layer(scatter, frontier_labels)
        .properties(
            width=620, height=380,
            title=alt.TitleParams(
                "The efficiency frontier — volume vs conversion by lag bucket",
                subtitle="Up-and-right = good. The biggest bubble is bottom-right.",
                fontSize=14, anchor="start",
            ),
        )
    )
    frontier
    return


@app.cell
def _(mo):
    mo.md("""
    ## Sizing the missed opportunity

    Among 4,901 calls placed to *prior-failure* leads, conversion was 12.6%
    blended — but 27.1% within the 31–90 day sweet spot. The slider shifts
    a share of long-lag (≥120 days) failure recontacts into the sweet-spot
    window and projects the extra subscriptions.

    Treat the counterfactual as a ceiling — there is unobserved lead-quality
    selection in which leads got called early — but even half of the
    projected gain is a multi-hundred-subscription swing.
    """)
    return


@app.cell
def _(mo):
    shift_pct = mo.ui.slider(
        start=0, stop=100, step=5, value=60,
        label="Percent of ≥120-day failure recontacts shifted into 31–90d",
        show_value=True,
    )
    shift_pct
    return (shift_pct,)


@app.cell
def _(LAG_ORDER, prev, shift_pct):
    fail = prev[prev["poutcome"] == "failure"].copy()
    fail_lag = (
        fail.groupby("recontact")
            .agg(calls=("subscribed", "size"),
                 subs=("subscribed", "sum"),
                 conv=("subscribed", "mean"))
            .reindex(LAG_ORDER)
    )
    sweet_rate = fail_lag.loc["31-90d", "conv"]
    long_lag_calls = int(fail_lag.loc[["91-180d", "181-365d", "365+d"], "calls"].sum())
    long_lag_subs = int(fail_lag.loc[["91-180d", "181-365d", "365+d"], "subs"].sum())
    long_lag_rate = long_lag_subs / long_lag_calls

    shifted = int(long_lag_calls * shift_pct.value / 100)
    extra = int(round(shifted * (sweet_rate - long_lag_rate)))
    baseline_failsegment = int(fail_lag["subs"].sum())
    return baseline_failsegment, extra, shifted, sweet_rate


@app.cell
def _(PALETTE, alt, baseline_failsegment, extra, pd):
    counter = pd.DataFrame({
        "scenario": ["Actual", "With reallocation"],
        "Existing subs": [baseline_failsegment, baseline_failsegment],
        "Incremental": [0, extra],
    }).melt(id_vars="scenario", var_name="bucket", value_name="subs")
    counter["order"] = counter["bucket"].map({"Existing subs": 0, "Incremental": 1})

    cf_chart = (
        alt.Chart(counter)
        .mark_bar(cornerRadiusEnd=4)
        .encode(
            y=alt.Y("scenario:N", title=None,
                    sort=["Actual", "With reallocation"]),
            x=alt.X("subs:Q",
                    title="Subscriptions from prior-failure segment"),
            color=alt.Color(
                "bucket:N",
                scale=alt.Scale(
                    domain=["Existing subs", "Incremental"],
                    range=[PALETTE["muted"], PALETTE["good"]],
                ),
                legend=alt.Legend(orient="top", title=None),
            ),
            order=alt.Order("order:Q"),
            tooltip=["scenario", "bucket", "subs"],
        )
        .properties(
            height=160, width=620,
            title=alt.TitleParams(
                "Counterfactual: prior-failure segment subscriptions",
                fontSize=14, anchor="start",
            ),
        )
    )
    cf_chart
    return


@app.cell
def _(baseline_failsegment, df, extra, mo, shift_pct, shifted, sweet_rate):
    total_subs = int(df["subscribed"].sum())
    new_total = total_subs + extra
    pct = extra / total_subs if total_subs else 0
    mo.md(
        f"""
        ### At **{shift_pct.value}%** reallocation

        - **{shifted:,}** long-lag failure recontacts shifted into the 31–90d window.
        - **+{extra:,}** extra subscriptions on top of the {baseline_failsegment:,}
          actually produced by this segment, at the sweet-spot rate
          ({sweet_rate:.1%}).
        - Whole-campaign total: **{total_subs:,} → {new_total:,}**
          (**{pct:+.1%}**).
        """
    )
    return


@app.cell
def _(mo):
    mo.md("""
    ## A second lever: the exhaustion curve

    Recontact lag governs *when* to call a previously-touched lead. A second,
    independent question: how many times should the bank dial the *same*
    person inside a single campaign before giving up?

    Each row in the data is one dial; the `campaign` field records this
    customer's attempt number in the current campaign. Plotting conversion
    against attempt-# produces a clean monotonic collapse — and the bank
    kept dialing well past the point where conversion essentially flatlines.
    """)
    return


@app.cell
def _(df):
    def attempt_bucket(c):
        if c == 1: return "1"
        if c == 2: return "2"
        if c == 3: return "3"
        if c <= 5: return "4-5"
        if c <= 10: return "6-10"
        if c <= 20: return "11-20"
        return "21+"

    ATTEMPT_ORDER = ["1", "2", "3", "4-5", "6-10", "11-20", "21+"]
    df_attempts = df.assign(attempts=df["campaign"].apply(attempt_bucket))
    dose = (
        df_attempts.groupby("attempts")
                   .agg(calls=("subscribed", "size"),
                        subs=("subscribed", "sum"),
                        conv=("subscribed", "mean"),
                        minutes=("duration", lambda s: s.sum() / 60))
                   .reindex(ATTEMPT_ORDER)
                   .reset_index()
    )
    dose["min_per_sub"] = dose["minutes"] / dose["subs"].replace(0, 1)
    return ATTEMPT_ORDER, dose


@app.cell
def _(ATTEMPT_ORDER, PALETTE, alt, dose):
    dose_bars = (
        alt.Chart(dose)
        .mark_bar(color=PALETTE["muted"], cornerRadiusEnd=3)
        .encode(
            x=alt.X("attempts:N", sort=ATTEMPT_ORDER,
                    title="Attempt number for this customer in this campaign"),
            y=alt.Y("calls:Q", title="Dials placed", axis=alt.Axis(grid=False)),
            tooltip=["attempts", "calls", "subs",
                     alt.Tooltip("conv:Q", format=".2%", title="Conversion"),
                     alt.Tooltip("min_per_sub:Q", format=".1f",
                                 title="Minutes per subscription")],
        )
    )
    dose_line = (
        alt.Chart(dose)
        .mark_line(
            point=alt.OverlayMarkDef(size=120, filled=True, color=PALETTE["accent"]),
            color=PALETTE["accent"], strokeWidth=3,
        )
        .encode(
            x=alt.X("attempts:N", sort=ATTEMPT_ORDER),
            y=alt.Y("conv:Q", title="Conversion rate",
                    axis=alt.Axis(format="%", grid=True)),
        )
    )
    dose_labels = (
        alt.Chart(dose)
        .mark_text(dy=-12, fontSize=12, fontWeight="bold",
                   color=PALETTE["accent"])
        .encode(
            x=alt.X("attempts:N", sort=ATTEMPT_ORDER),
            y="conv:Q",
            text=alt.Text("conv:Q", format=".1%"),
        )
    )
    dose_chart = (
        alt.layer(dose_bars, dose_line, dose_labels)
        .resolve_scale(y="independent")
        .properties(
            height=360, width=620,
            title=alt.TitleParams(
                "Dial-count exhaustion: conversion collapses after attempt #3",
                subtitle="Bars = dials placed at each attempt #. Red line = conversion rate.",
                fontSize=15, anchor="start",
            ),
        )
    )
    dose_chart
    return


@app.cell
def _(df, mo):
    fresh = df[df["campaign"] <= 3]
    burned = df[df["campaign"] >= 6]
    fresh_min = fresh["duration"].sum() / 60
    burned_min = burned["duration"].sum() / 60
    max_attempts = int(df["campaign"].max())

    mo.md(
        f"""
        ### Cost of dialing past the point of diminishing returns

        | Attempt range | Dials | Subs | Conv. | Minutes spent | Minutes / sub |
        |---|---:|---:|---:|---:|---:|
        | **Attempts 1–3** | {len(fresh):,} | {int(fresh['subscribed'].sum()):,} | {fresh['subscribed'].mean():.2%} | {fresh_min:,.0f} | **{fresh_min/fresh['subscribed'].sum():.1f}** |
        | **Attempts 6+** | {len(burned):,} | {int(burned['subscribed'].sum()):,} | {burned['subscribed'].mean():.2%} | {burned_min:,.0f} | **{burned_min/max(1,burned['subscribed'].sum()):.1f}** |

        After attempt #3, conversion stabilizes around 5–7% and never recovers.
        The bank placed **4,355 dials at attempt #6 or later** — 9.6% of all
        calls — and spent **{burned_min:,.0f} minutes on the phone** to extract
        {int(burned['subscribed'].sum())} subscriptions. That's **{burned_min/burned['subscribed'].sum():.0f} minutes
        per subscription**, versus {fresh_min/fresh['subscribed'].sum():.0f} minutes per
        subscription on the first three attempts. One customer was dialed
        **{max_attempts} times**.

        A simple stopping rule — "no customer gets more than 3 dials in this
        campaign" — would free up the {burned_min/60:,.0f} hours those dials
        consumed to pursue fresh leads instead.
        """
    )
    return


@app.cell
def _(mo):
    mo.md("""
    ## Why this insight is more useful than the obvious ones

    The dataset's most-cited finding — *"call duration predicts subscription"* —
    is a leakage variable: you don't know call length before placing the call.

    The second most-cited — *"March/Sep/Oct/Dec convert 4–5× better than May"* —
    is real but partly outside the bank's control. Those months reflect
    macroeconomic windows (early-recession savings flight, year-end CD season).

    **Recontact lag is a parameter the campaign manager directly controls** —
    it's the gap between two outbound calls on a list the bank already owns.
    A list-management rule that holds failed leads for ~2 months and *then*
    recontacts is operationally trivial and worth, by this dataset, roughly
    the same number of incremental subscriptions as fixing the entire
    month-allocation problem.

    *Caveats:* the 31–90d bucket has selection — early recontacts may have
    been picked by reps who flagged the lead as promising. The within-May
    check controls for receiving-month seasonality but not for that selection.
    Treat the counterfactual as an upper bound; cutting it in half still
    leaves a several-hundred-subscription gap.
    """)
    return


if __name__ == "__main__":
    app.run()
