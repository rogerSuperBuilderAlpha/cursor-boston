# /// script
# dependencies = [
#     "altair==6.1.0",
#     "marimo",
#     "numpy==2.2.6",
#     "pandas==2.3.3",
#     "scikit-learn==1.7.2",
# ]
# requires-python = ">=3.10"
# ///

import marimo

__generated_with = "0.23.6"
app = marimo.App(width="medium")


@app.cell(hide_code=True)
def _():
    import altair as alt
    import marimo as mo
    import numpy as np
    import pandas as pd
    from pathlib import Path
    from sklearn.compose import ColumnTransformer
    from sklearn.linear_model import LogisticRegression
    from sklearn.metrics import (
        average_precision_score,
        confusion_matrix,
        precision_score,
        recall_score,
        roc_auc_score,
    )
    from sklearn.pipeline import Pipeline
    from sklearn.preprocessing import OneHotEncoder, StandardScaler
    import inspect

    alt.data_transformers.disable_max_rows()
    pd.set_option("display.max_columns", 50)
    return (
        ColumnTransformer,
        LogisticRegression,
        OneHotEncoder,
        Path,
        Pipeline,
        StandardScaler,
        alt,
        average_precision_score,
        confusion_matrix,
        inspect,
        mo,
        np,
        pd,
        precision_score,
        recall_score,
        roc_auc_score,
    )


@app.cell(hide_code=True)
def _(mo):
    mo.md("""
    # Recovery, timing, and warmer targeting

    **Question:** did bank marketing conversion rise as the campaign moved farther away from the 2008 financial crisis, and what is the interesting story behind that rise?

    This notebook uses the UCI Bank Marketing dataset (`bank/bank-full.csv`). The CSV does not include an explicit year, so year is inferred from chronological row order and month rollovers. The predictive models stay realistic by excluding `duration`, which is only known after a phone call ends.
    """)
    return


@app.cell(hide_code=True)
def _(Path, pd):
    data_path = Path("bank/bank-full.csv")
    df_raw = pd.read_csv(data_path, sep=";")

    month_order = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"]
    month_names = {
        "jan": "Jan",
        "feb": "Feb",
        "mar": "Mar",
        "apr": "Apr",
        "may": "May",
        "jun": "Jun",
        "jul": "Jul",
        "aug": "Aug",
        "sep": "Sep",
        "oct": "Oct",
        "nov": "Nov",
        "dec": "Dec",
    }
    month_numbers = dict(zip(month_order, range(1, 13)))
    month_labels = [month_names[m] for m in month_order]
    year_order = [2008, 2009, 2010]

    inferred_years = []
    current_year = 2008
    previous_month_number = month_numbers[df_raw.loc[0, "month"]]
    for month_code in df_raw["month"]:
        month_number = month_numbers[month_code]
        if month_number < previous_month_number:
            current_year += 1
        inferred_years.append(current_year)
        previous_month_number = month_number

    df = df_raw.copy()
    df["subscribed"] = df["y"].eq("yes")
    df["month"] = pd.Categorical(df["month"], categories=month_order, ordered=True)
    df["month_label"] = df["month"].astype(str).map(month_names)
    df["inferred_year"] = pd.Categorical(inferred_years, categories=year_order, ordered=True)
    df["year_label"] = df["inferred_year"].astype(str)
    df["previously_contacted"] = df["pdays"].ne(-1)
    df["prior_success"] = df["poutcome"].eq("success")

    target_rate = float(df["subscribed"].mean())
    positive_count = int(df["subscribed"].sum())
    negative_count = int((~df["subscribed"]).sum())

    assert df_raw.shape == (45211, 17)
    assert set(df_raw["y"].unique()) == {"yes", "no"}
    assert abs(target_rate - 0.117) < 0.002
    return (
        df,
        df_raw,
        month_labels,
        month_names,
        month_order,
        target_rate,
        year_order,
    )


@app.cell(hide_code=True)
def _(df):
    year_summary = (
        df.groupby("inferred_year", observed=True)
        .agg(
            calls=("subscribed", "size"),
            subscribers=("subscribed", "sum"),
            conversion_rate=("subscribed", "mean"),
            avg_duration=("duration", "mean"),
            cellular_share=("contact", lambda s: s.eq("cellular").mean()),
            previous_contact_share=("previously_contacted", "mean"),
            prior_success_share=("prior_success", "mean"),
            avg_campaign_contacts=("campaign", "mean"),
            avg_balance=("balance", "mean"),
            first_month=("month", "first"),
            last_month=("month", "last"),
            first_day=("day", "first"),
            last_day=("day", "last"),
        )
        .reset_index()
    )
    year_summary["year"] = year_summary["inferred_year"].astype(int)
    year_summary["year_label"] = year_summary["year"].astype(str)
    year_summary["conversion_lift_vs_2008"] = year_summary["conversion_rate"] / float(
        year_summary.loc[year_summary["year"].eq(2008), "conversion_rate"].iloc[0]
    )

    year_summary_display = year_summary.assign(
        conversion_rate=lambda d: d["conversion_rate"].map(lambda x: f"{x:.1%}"),
        conversion_lift_vs_2008=lambda d: d["conversion_lift_vs_2008"].map(lambda x: f"{x:.1f}x"),
        previous_contact_share=lambda d: d["previous_contact_share"].map(lambda x: f"{x:.1%}"),
        prior_success_share=lambda d: d["prior_success_share"].map(lambda x: f"{x:.1%}"),
        cellular_share=lambda d: d["cellular_share"].map(lambda x: f"{x:.1%}"),
    )[
        [
            "year_label",
            "calls",
            "subscribers",
            "conversion_rate",
            "conversion_lift_vs_2008",
            "prior_success_share",
            "previous_contact_share",
            "cellular_share",
        ]
    ]

    year_2008_rate = float(year_summary.loc[year_summary["year"].eq(2008), "conversion_rate"].iloc[0])
    year_2009_rate = float(year_summary.loc[year_summary["year"].eq(2009), "conversion_rate"].iloc[0])
    year_2010_rate = float(year_summary.loc[year_summary["year"].eq(2010), "conversion_rate"].iloc[0])
    year_2008_calls = int(year_summary.loc[year_summary["year"].eq(2008), "calls"].iloc[0])
    year_2009_calls = int(year_summary.loc[year_summary["year"].eq(2009), "calls"].iloc[0])
    year_2010_calls = int(year_summary.loc[year_summary["year"].eq(2010), "calls"].iloc[0])
    prior_success_2008 = float(year_summary.loc[year_summary["year"].eq(2008), "prior_success_share"].iloc[0])
    prior_success_2010 = float(year_summary.loc[year_summary["year"].eq(2010), "prior_success_share"].iloc[0])

    assert year_2008_calls == 27729
    assert year_2009_calls == 14862
    assert year_2010_calls == 2620
    assert abs(year_2008_rate - 0.051) < 0.002
    assert abs(year_2009_rate - 0.171) < 0.002
    assert abs(year_2010_rate - 0.516) < 0.002
    assert abs(prior_success_2010 - 0.287) < 0.002
    return (
        prior_success_2008,
        prior_success_2010,
        year_2008_calls,
        year_2008_rate,
        year_2009_rate,
        year_2010_calls,
        year_2010_rate,
        year_summary,
        year_summary_display,
    )


@app.cell(hide_code=True)
def _(df, mo, target_rate, year_2008_rate, year_2010_rate):
    mo.md(f"""
    <div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin:8px 0 18px 0;">
      <div style="border:1px solid #d9e2ec;border-radius:8px;padding:14px;background:#f8fafc;"><div style="font-size:13px;color:#52616b;">Total calls</div><div style="font-size:28px;font-weight:700;">{len(df):,}</div></div>
      <div style="border:1px solid #d9e2ec;border-radius:8px;padding:14px;background:#f8fafc;"><div style="font-size:13px;color:#52616b;">Overall conversion</div><div style="font-size:28px;font-weight:700;">{target_rate:.1%}</div></div>
      <div style="border:1px solid #d9e2ec;border-radius:8px;padding:14px;background:#f8fafc;"><div style="font-size:13px;color:#52616b;">2008 conversion</div><div style="font-size:28px;font-weight:700;">{year_2008_rate:.1%}</div></div>
      <div style="border:1px solid #d9e2ec;border-radius:8px;padding:14px;background:#f8fafc;"><div style="font-size:13px;color:#52616b;">2010 conversion</div><div style="font-size:28px;font-weight:700;">{year_2010_rate:.1%}</div></div>
    </div>
    """)
    return


@app.cell(hide_code=True)
def _(mo):
    mo.md("""
    ## Dataset context

    The data records direct marketing phone campaigns from a Portuguese banking institution. The full file is ordered by date from May 2008 through November 2010, but it only stores day and month, not year. The `inferred_year` field below is reconstructed by starting at 2008 and incrementing whenever the ordered month sequence rolls from December into January.

    Citation: Moro, S., Laureano, R., and Cortez, P. (2011). *Using Data Mining for Bank Direct Marketing: An Application of the CRISP-DM Methodology.* Proceedings of the European Simulation and Modelling Conference.
    """)
    return


@app.cell(hide_code=True)
def _(alt, mo, year_summary, year_summary_display):
    yearly_rate_chart = (
        alt.Chart(year_summary)
        .mark_bar(cornerRadiusTopLeft=4, cornerRadiusTopRight=4)
        .encode(
            x=alt.X("year_label:N", title="Inferred campaign year"),
            y=alt.Y("conversion_rate:Q", title="Subscription rate", axis=alt.Axis(format="%")),
            color=alt.Color("conversion_rate:Q", title="Conversion", scale=alt.Scale(scheme="tealblues")),
            tooltip=[
                alt.Tooltip("year_label:N", title="Year"),
                alt.Tooltip("calls:Q", title="Calls", format=","),
                alt.Tooltip("subscribers:Q", title="Subscribers", format=","),
                alt.Tooltip("conversion_rate:Q", title="Conversion", format=".1%"),
                alt.Tooltip("conversion_lift_vs_2008:Q", title="Lift vs 2008", format=".1f"),
            ],
        )
        .properties(width=250, height=260, title="Conversion rises after 2008")
    )

    yearly_volume_chart = (
        alt.Chart(year_summary)
        .mark_bar(cornerRadiusTopLeft=4, cornerRadiusTopRight=4, color="#3d5a80")
        .encode(
            x=alt.X("year_label:N", title="Inferred campaign year"),
            y=alt.Y("calls:Q", title="Calls", axis=alt.Axis(format="~s")),
            tooltip=[
                alt.Tooltip("year_label:N", title="Year"),
                alt.Tooltip("calls:Q", title="Calls", format=","),
                alt.Tooltip("conversion_rate:Q", title="Conversion", format=".1%"),
            ],
        )
        .properties(width=250, height=260, title="Call volume becomes smaller")
    )

    year_warmth_long = year_summary.melt(
        id_vars=["year_label"],
        value_vars=["prior_success_share", "previous_contact_share"],
        var_name="signal",
        value_name="share",
    )
    year_warmth_long["signal_label"] = year_warmth_long["signal"].map(
        {
            "prior_success_share": "Prior campaign success",
            "previous_contact_share": "Previously contacted",
        }
    )

    yearly_warmth_chart = (
        alt.Chart(year_warmth_long)
        .mark_line(point=True, strokeWidth=3)
        .encode(
            x=alt.X("year_label:N", title="Inferred campaign year"),
            y=alt.Y("share:Q", title="Share of contacted clients", axis=alt.Axis(format="%")),
            color=alt.Color("signal_label:N", title=None, scale=alt.Scale(range=["#d1495b", "#2f6f73"])),
            tooltip=[
                alt.Tooltip("year_label:N", title="Year"),
                alt.Tooltip("signal_label:N", title="Signal"),
                alt.Tooltip("share:Q", title="Share", format=".1%"),
            ],
        )
        .properties(width=320, height=260, title="The later campaign has warmer leads")
    )

    mo.vstack(
        [
            mo.md("## Post-crisis recovery or smarter targeting?"),
            mo.hstack([yearly_rate_chart, yearly_volume_chart], gap=1, justify="start"),
            yearly_warmth_chart,
            mo.ui.table(year_summary_display),
        ],
        gap=1,
    )
    return


@app.cell(hide_code=True)
def _(
    mo,
    prior_success_2008,
    prior_success_2010,
    year_2008_calls,
    year_2008_rate,
    year_2009_rate,
    year_2010_calls,
    year_2010_rate,
):
    mo.md(f"""
    ## The small insight

    Conversion does increase as the campaign moves farther from 2008: **{year_2008_rate:.1%}** in inferred 2008, **{year_2009_rate:.1%}** in 2009, and **{year_2010_rate:.1%}** in 2010.

    But the sharper insight is that the bank was not just waiting for the economy to heal. It also shifted toward warmer leads: prior campaign success rose from **{prior_success_2008:.1%}** of contacted clients in 2008 to **{prior_success_2010:.1%}** in 2010, while total call volume fell from **{year_2008_calls:,}** to **{year_2010_calls:,}**.
    """)
    return


@app.cell(hide_code=True)
def _(df, month_names, target_rate):
    month_summary = (
        df.groupby("month", observed=True)
        .agg(
            calls=("subscribed", "size"),
            subscribers=("subscribed", "sum"),
            conversion_rate=("subscribed", "mean"),
            cellular_share=("contact", lambda s: s.eq("cellular").mean()),
            known_prior_share=("poutcome", lambda s: s.ne("unknown").mean()),
        )
        .reset_index()
    )
    month_summary["month_code"] = month_summary["month"].astype(str)
    month_summary["month_label"] = month_summary["month_code"].map(month_names)
    month_summary["lift_vs_baseline"] = month_summary["conversion_rate"] / target_rate
    month_summary["rank"] = month_summary["conversion_rate"].rank(ascending=False, method="dense").astype(int)

    month_summary_display = month_summary.assign(
        conversion_rate=lambda d: d["conversion_rate"].map(lambda x: f"{x:.1%}"),
        lift_vs_baseline=lambda d: d["lift_vs_baseline"].map(lambda x: f"{x:.1f}x"),
        cellular_share=lambda d: d["cellular_share"].map(lambda x: f"{x:.0%}"),
        known_prior_share=lambda d: d["known_prior_share"].map(lambda x: f"{x:.0%}"),
    )[["rank", "month_label", "calls", "subscribers", "conversion_rate", "lift_vs_baseline", "cellular_share", "known_prior_share"]]
    return (month_summary,)


@app.cell(hide_code=True)
def _(alt, month_labels, month_summary, pd, target_rate):
    raw_month_bars = (
        alt.Chart(month_summary)
        .mark_bar(cornerRadiusTopLeft=3, cornerRadiusTopRight=3)
        .encode(
            x=alt.X("month_label:N", sort=month_labels, title="Last contact month"),
            y=alt.Y("conversion_rate:Q", title="Subscription rate", axis=alt.Axis(format="%")),
            color=alt.Color("lift_vs_baseline:Q", title="Lift vs baseline", scale=alt.Scale(scheme="tealblues")),
            tooltip=[
                alt.Tooltip("month_label:N", title="Month"),
                alt.Tooltip("calls:Q", title="Calls", format=","),
                alt.Tooltip("subscribers:Q", title="Subscribers", format=","),
                alt.Tooltip("conversion_rate:Q", title="Conversion", format=".1%"),
                alt.Tooltip("lift_vs_baseline:Q", title="Lift", format=".1f"),
            ],
        )
        .properties(height=300, title="Month still matters: raw conversion by month")
    )

    baseline_rule = (
        alt.Chart(pd.DataFrame({"baseline": [target_rate]}))
        .mark_rule(color="#d1495b", strokeDash=[6, 4], size=2)
        .encode(y="baseline:Q")
    )

    (raw_month_bars + baseline_rule).configure_view(strokeOpacity=0)
    return


@app.cell(hide_code=True)
def _(mo, month_summary, target_rate):
    best_raw_months = month_summary.sort_values("conversion_rate", ascending=False).head(4).copy()
    best_month_sentence = ", ".join(
        f"{row.month_label} ({row.conversion_rate:.1%})" for row in best_raw_months.itertuples()
    )

    mo.md(
        f"""
        ## Supporting timing evidence

        The month pattern reinforces the year story. The strongest months are **{best_month_sentence}**, far above the overall baseline of **{target_rate:.1%}**. Timing appears in both the broad campaign year and the seasonal contact month.
        """
    )
    return


@app.cell(hide_code=True)
def _(df, pd):
    duration_deciles = df.assign(
        duration_decile=pd.qcut(df["duration"].rank(method="first"), 10, labels=False) + 1
    )
    duration_summary = (
        duration_deciles.groupby("duration_decile")
        .agg(
            calls=("subscribed", "size"),
            avg_duration=("duration", "mean"),
            conversion_rate=("subscribed", "mean"),
        )
        .reset_index()
    )
    duration_summary["decile_label"] = duration_summary["duration_decile"].map(lambda x: f"D{x}")
    return (duration_summary,)


@app.cell(hide_code=True)
def _(alt, duration_summary, mo):
    duration_chart = (
        alt.Chart(duration_summary)
        .mark_line(point=True, strokeWidth=3, color="#7c3aed")
        .encode(
            x=alt.X("decile_label:N", sort=[f"D{i}" for i in range(1, 11)], title="Call duration decile"),
            y=alt.Y("conversion_rate:Q", title="Subscription rate", axis=alt.Axis(format="%")),
            tooltip=[
                alt.Tooltip("decile_label:N", title="Duration decile"),
                alt.Tooltip("avg_duration:Q", title="Avg seconds", format=".0f"),
                alt.Tooltip("conversion_rate:Q", title="Conversion", format=".1%"),
                alt.Tooltip("calls:Q", title="Calls", format=","),
            ],
        )
        .properties(height=240, title="Why duration is excluded")
    )

    mo.vstack(
        [
            mo.md(
                """
                ## Leakage check

                `duration` is extremely predictive, but it is not available before deciding who to call. Keeping it would make the model look smarter by giving it information from after the call.
                """
            ),
            duration_chart,
        ],
        gap=1,
    )
    return


@app.cell(hide_code=True)
def _(df, df_raw, pd):
    leakage_features = ["duration"]
    target_column = "subscribed"
    base_realistic_features = [column for column in df_raw.columns if column not in ["y", *leakage_features]]
    features_without_month = [column for column in base_realistic_features if column != "month"]
    features_with_year = base_realistic_features + ["inferred_year"]

    assert "duration" not in base_realistic_features
    assert "duration" not in features_with_year
    assert "y" not in base_realistic_features

    split_index = int(len(df) * 0.70)
    train_df = df.iloc[:split_index].copy()
    test_df = df.iloc[split_index:].copy()
    y_train = train_df[target_column].astype(int)
    y_test = test_df[target_column].astype(int)

    split_summary = pd.DataFrame(
        [
            {"split": "Train: earliest 70%", "rows": len(train_df), "subscribers": int(y_train.sum()), "conversion_rate": float(y_train.mean())},
            {"split": "Test: latest 30%", "rows": len(test_df), "subscribers": int(y_test.sum()), "conversion_rate": float(y_test.mean())},
        ]
    )
    split_summary_display = split_summary.assign(
        conversion_rate=lambda d: d["conversion_rate"].map(lambda x: f"{x:.1%}")
    )
    return (
        base_realistic_features,
        features_with_year,
        features_without_month,
        split_summary,
        split_summary_display,
        target_column,
        test_df,
        train_df,
        y_test,
        y_train,
    )


@app.cell(hide_code=True)
def _(alt, mo, split_summary, split_summary_display):
    split_chart = (
        alt.Chart(split_summary)
        .mark_bar(cornerRadiusTopLeft=3, cornerRadiusTopRight=3, color="#2f6f73")
        .encode(
            x=alt.X("split:N", title=None),
            y=alt.Y("conversion_rate:Q", title="Subscription rate", axis=alt.Axis(format="%")),
            tooltip=[
                alt.Tooltip("split:N", title="Split"),
                alt.Tooltip("rows:Q", title="Rows", format=","),
                alt.Tooltip("conversion_rate:Q", title="Conversion", format=".1%"),
            ],
        )
        .properties(height=220, title="Time-ordered validation")
    )

    mo.vstack(
        [
            mo.md(
                """
                ## Modeling setup

                Because the file is ordered by date, validation uses the latest 30% as the holdout. The model is intentionally pre-call: it excludes `duration` and compares whether adding inferred year improves out-of-time prediction.
                """
            ),
            split_chart,
            mo.ui.table(split_summary_display),
        ],
        gap=1,
    )
    return


@app.cell(hide_code=True)
def _(
    ColumnTransformer,
    LogisticRegression,
    OneHotEncoder,
    Pipeline,
    StandardScaler,
    average_precision_score,
    confusion_matrix,
    df,
    inspect,
    np,
    precision_score,
    recall_score,
    roc_auc_score,
    test_df,
    train_df,
    y_test,
    y_train,
):
    def make_one_hot_encoder():
        kwargs = {"handle_unknown": "ignore"}
        if "sparse_output" in inspect.signature(OneHotEncoder).parameters:
            kwargs["sparse_output"] = False
        else:
            kwargs["sparse"] = False
        return OneHotEncoder(**kwargs)


    def build_logistic_pipeline(feature_columns):
        categorical_features = df[feature_columns].select_dtypes(include=["object", "category"]).columns.tolist()
        numeric_features = [column for column in feature_columns if column not in categorical_features]
        preprocessor = ColumnTransformer(
            transformers=[
                ("categorical", make_one_hot_encoder(), categorical_features),
                ("numeric", StandardScaler(), numeric_features),
            ]
        )
        return Pipeline(
            steps=[
                ("preprocess", preprocessor),
                ("model", LogisticRegression(max_iter=2000, solver="lbfgs")),
            ]
        )


    def evaluate_probabilities(y_true, probabilities, top_fraction=0.10):
        y_array = np.asarray(y_true).astype(int)
        probabilities = np.asarray(probabilities)
        top_n = max(1, int(np.ceil(len(probabilities) * top_fraction)))
        top_indices = np.argsort(-probabilities)[:top_n]
        threshold = float(np.sort(probabilities)[-top_n])
        selected = probabilities >= threshold
        top_rate = float(y_array[top_indices].mean())
        base_rate = float(y_array.mean())
        tn, fp, fn, tp = confusion_matrix(y_array, selected).ravel()
        return {
            "roc_auc": float(roc_auc_score(y_array, probabilities)),
            "average_precision": float(average_precision_score(y_array, probabilities)),
            "base_rate": base_rate,
            "mean_prediction": float(probabilities.mean()),
            "top_decile_rate": top_rate,
            "top_decile_lift": top_rate / base_rate,
            "top_decile_threshold": threshold,
            "precision_top_decile": float(precision_score(y_array, selected, zero_division=0)),
            "recall_top_decile": float(recall_score(y_array, selected, zero_division=0)),
            "true_positives": int(tp),
            "false_positives": int(fp),
            "false_negatives": int(fn),
            "true_negatives": int(tn),
        }


    def fit_and_score(feature_columns, label):
        model = build_logistic_pipeline(feature_columns)
        model.fit(train_df[feature_columns], y_train)
        probabilities = model.predict_proba(test_df[feature_columns])[:, 1]
        scores = evaluate_probabilities(y_test, probabilities)
        scores["model"] = label
        scores["features"] = len(feature_columns)
        return model, probabilities, scores

    return build_logistic_pipeline, fit_and_score


@app.cell(hide_code=True)
def _(
    base_realistic_features,
    features_with_year,
    features_without_month,
    fit_and_score,
    pd,
):
    month_model, month_probabilities, month_scores = fit_and_score(
        base_realistic_features, "Month model"
    )
    no_month_model, no_month_probabilities, no_month_scores = fit_and_score(
        features_without_month, "No-month control"
    )
    year_model, year_probabilities, year_scores = fit_and_score(
        features_with_year, "Month + inferred year"
    )

    model_metrics = pd.DataFrame([month_scores, no_month_scores, year_scores])
    year_model_metrics = pd.DataFrame([month_scores, year_scores])
    model_metrics_display = model_metrics[
        [
            "model",
            "features",
            "roc_auc",
            "average_precision",
            "base_rate",
            "top_decile_rate",
            "top_decile_lift",
            "precision_top_decile",
            "recall_top_decile",
        ]
    ].assign(
        roc_auc=lambda d: d["roc_auc"].map(lambda x: f"{x:.3f}"),
        average_precision=lambda d: d["average_precision"].map(lambda x: f"{x:.3f}"),
        base_rate=lambda d: d["base_rate"].map(lambda x: f"{x:.1%}"),
        top_decile_rate=lambda d: d["top_decile_rate"].map(lambda x: f"{x:.1%}"),
        top_decile_lift=lambda d: d["top_decile_lift"].map(lambda x: f"{x:.2f}x"),
        precision_top_decile=lambda d: d["precision_top_decile"].map(lambda x: f"{x:.1%}"),
        recall_top_decile=lambda d: d["recall_top_decile"].map(lambda x: f"{x:.1%}"),
    )

    year_auc_gain = float(year_scores["roc_auc"] - month_scores["roc_auc"])
    assert year_scores["roc_auc"] > month_scores["roc_auc"]
    assert abs(month_scores["roc_auc"] - 0.685) < 0.01
    assert abs(year_scores["roc_auc"] - 0.692) < 0.01
    return model_metrics_display, month_scores, year_model_metrics, year_scores


@app.cell(hide_code=True)
def _(
    alt,
    mo,
    model_metrics_display,
    month_scores,
    year_model_metrics,
    year_scores,
):
    year_metrics_long = year_model_metrics.melt(
        id_vars="model",
        value_vars=["roc_auc", "average_precision", "top_decile_lift"],
        var_name="metric",
        value_name="value",
    )
    year_metrics_long["metric_label"] = year_metrics_long["metric"].map(
        {
            "roc_auc": "ROC AUC",
            "average_precision": "Average precision",
            "top_decile_lift": "Top-decile lift",
        }
    )

    year_model_chart = (
        alt.Chart(year_metrics_long)
        .mark_bar(cornerRadiusTopLeft=3, cornerRadiusTopRight=3)
        .encode(
            x=alt.X("model:N", title=None),
            y=alt.Y("value:Q", title="Value"),
            color=alt.Color("model:N", legend=None, scale=alt.Scale(range=["#1f77b4", "#d1495b"])),
            column=alt.Column("metric_label:N", title=None),
            tooltip=[
                alt.Tooltip("model:N", title="Model"),
                alt.Tooltip("metric_label:N", title="Metric"),
                alt.Tooltip("value:Q", title="Value", format=".3f"),
            ],
        )
        .properties(width=170, height=210, title="Does inferred year add signal?")
    )

    mo.vstack(
        [
            mo.md(
                f"""
                ## The year signal is predictive, not just descriptive

                Adding inferred year to the realistic pre-call model improves holdout ROC AUC from **{month_scores['roc_auc']:.3f}** to **{year_scores['roc_auc']:.3f}**. That is a small but real lift, which supports the presentation claim that year carries information beyond the basic client and campaign fields.
                """
            ),
            year_model_chart,
            mo.ui.table(model_metrics_display),
        ],
        gap=1,
    )
    return


@app.cell(hide_code=True)
def _(
    build_logistic_pipeline,
    df,
    features_with_year,
    pd,
    target_column,
    year_order,
    year_summary,
):
    scenario_year_model = build_logistic_pipeline(features_with_year)
    scenario_year_model.fit(df[features_with_year], df[target_column].astype(int))
    scenario_baseline_probability = float(scenario_year_model.predict_proba(df[features_with_year])[:, 1].mean())

    year_scenario_rows = []
    for scenario_year in year_order:
        scenario_frame = df[features_with_year].copy()
        scenario_frame["inferred_year"] = pd.Categorical(
            [scenario_year] * len(scenario_frame), categories=year_order, ordered=True
        )
        adjusted_probability = float(scenario_year_model.predict_proba(scenario_frame)[:, 1].mean())
        year_scenario_rows.append(
            {
                "year_label": str(scenario_year),
                "adjusted_probability": adjusted_probability,
                "adjusted_lift": adjusted_probability / scenario_baseline_probability,
            }
        )

    year_scenario = pd.DataFrame(year_scenario_rows)
    year_effect_comparison = year_summary[
        ["year_label", "calls", "conversion_rate", "conversion_lift_vs_2008", "prior_success_share"]
    ].merge(year_scenario, on="year_label")
    year_effect_display = year_effect_comparison.assign(
        conversion_rate=lambda d: d["conversion_rate"].map(lambda x: f"{x:.1%}"),
        conversion_lift_vs_2008=lambda d: d["conversion_lift_vs_2008"].map(lambda x: f"{x:.1f}x"),
        prior_success_share=lambda d: d["prior_success_share"].map(lambda x: f"{x:.1%}"),
        adjusted_probability=lambda d: d["adjusted_probability"].map(lambda x: f"{x:.1%}"),
        adjusted_lift=lambda d: d["adjusted_lift"].map(lambda x: f"{x:.1f}x"),
    )

    year_effect_long = pd.concat(
        [
            year_effect_comparison[["year_label", "conversion_rate"]]
            .rename(columns={"conversion_rate": "rate"})
            .assign(series="Raw observed"),
            year_effect_comparison[["year_label", "adjusted_probability"]]
            .rename(columns={"adjusted_probability": "rate"})
            .assign(series="Model-adjusted scenario"),
        ],
        ignore_index=True,
    )
    return year_effect_display, year_effect_long, year_scenario


@app.cell(hide_code=True)
def _(alt, mo, year_effect_display, year_effect_long, year_scenario):
    year_effect_chart = (
        alt.Chart(year_effect_long)
        .mark_line(point=True, strokeWidth=3)
        .encode(
            x=alt.X("year_label:N", title="Inferred campaign year"),
            y=alt.Y("rate:Q", title="Subscription rate", axis=alt.Axis(format="%")),
            color=alt.Color("series:N", title=None, scale=alt.Scale(range=["#2f6f73", "#d1495b"])),
            tooltip=[
                alt.Tooltip("year_label:N", title="Year"),
                alt.Tooltip("series:N", title="Series"),
                alt.Tooltip("rate:Q", title="Rate", format=".1%"),
            ],
        )
        .properties(height=300, title="Raw year lift vs model-adjusted year scenario")
    )

    adjusted_2010 = float(year_scenario.loc[year_scenario["year_label"].eq("2010"), "adjusted_probability"].iloc[0])
    adjusted_2008 = float(year_scenario.loc[year_scenario["year_label"].eq("2008"), "adjusted_probability"].iloc[0])

    mo.vstack(
        [
            mo.md(
                f"""
                ## Adjusted year scenario

                If the same client/campaign mix is scored as though it belonged to each inferred year, the modeled conversion still rises from **{adjusted_2008:.1%}** in 2008 to **{adjusted_2010:.1%}** in 2010. This is not causal proof, but it keeps the recovery-plus-targeting story alive after adjustment.
                """
            ),
            year_effect_chart,
            mo.ui.table(year_effect_display),
        ],
        gap=1,
    )
    return


@app.cell(hide_code=True)
def _(mo, month_order):
    month_picker = mo.ui.dropdown(options=month_order, value="mar", label="Month", searchable=True)
    segment_picker = mo.ui.dropdown(
        options=["job", "education", "marital", "housing", "loan", "contact", "poutcome", "inferred_year"],
        value="job",
        label="Segment",
    )
    min_calls_slider = mo.ui.slider(25, 1000, step=25, value=100, show_value=True, label="Minimum calls")

    mo.vstack(
        [
            mo.md("## Interactive segment explorer"),
            mo.hstack([month_picker, segment_picker, min_calls_slider], justify="start", gap=1),
        ],
        gap=0.75,
    )
    return min_calls_slider, month_picker, segment_picker


@app.cell(hide_code=True)
def _(
    alt,
    df,
    min_calls_slider,
    mo,
    month_names,
    month_picker,
    segment_picker,
):
    selected_month = month_picker.value
    selected_segment = segment_picker.value
    minimum_calls = int(min_calls_slider.value)
    selected_month_label = month_names[selected_month]

    segment_summary = (
        df[df["month"].astype(str).eq(selected_month)]
        .groupby(selected_segment, observed=True)
        .agg(calls=("subscribed", "size"), subscribers=("subscribed", "sum"), conversion_rate=("subscribed", "mean"))
        .reset_index()
        .sort_values(["conversion_rate", "calls"], ascending=[False, False])
    )
    segment_filtered = segment_summary[segment_summary["calls"].ge(minimum_calls)].copy()
    segment_filtered["lift_vs_month"] = segment_filtered["conversion_rate"] / max(
        float(df[df["month"].astype(str).eq(selected_month)]["subscribed"].mean()), 1e-12
    )
    segment_display = segment_filtered.assign(
        conversion_rate=lambda d: d["conversion_rate"].map(lambda x: f"{x:.1%}"),
        lift_vs_month=lambda d: d["lift_vs_month"].map(lambda x: f"{x:.1f}x"),
    ).head(12)

    if segment_filtered.empty:
        segment_explorer_output = mo.md(
            f"No `{selected_segment}` groups in {selected_month_label} have at least {minimum_calls:,} calls. Lower the minimum-call slider."
        )
    else:
        segment_chart = (
            alt.Chart(segment_filtered.head(12))
            .mark_bar(cornerRadiusTopLeft=3, cornerRadiusTopRight=3, color="#3d5a80")
            .encode(
                x=alt.X("conversion_rate:Q", title="Subscription rate", axis=alt.Axis(format="%")),
                y=alt.Y(f"{selected_segment}:N", sort="-x", title=selected_segment.replace("_", " ").title()),
                tooltip=[
                    alt.Tooltip(f"{selected_segment}:N", title=selected_segment.replace("_", " ").title()),
                    alt.Tooltip("calls:Q", title="Calls", format=","),
                    alt.Tooltip("conversion_rate:Q", title="Conversion", format=".1%"),
                    alt.Tooltip("lift_vs_month:Q", title="Lift vs selected month", format=".1f"),
                ],
            )
            .properties(height=300, title=f"Top {selected_segment.replace('_', ' ')} segments in {selected_month_label}")
        )
        segment_explorer_output = mo.vstack(
            [
                mo.md(
                    f"Showing `{selected_segment}` groups in **{selected_month_label}** with at least **{minimum_calls:,}** calls."
                ),
                segment_chart,
                mo.ui.table(segment_display),
            ],
            gap=1,
        )

    segment_explorer_output
    return minimum_calls, selected_month, selected_segment


@app.cell(hide_code=True)
def _(
    mo,
    prior_success_2008,
    prior_success_2010,
    year_2008_rate,
    year_2010_rate,
    year_scenario,
):
    adjusted_2010_display = float(year_scenario.loc[year_scenario["year_label"].eq("2010"), "adjusted_probability"].iloc[0])
    adjusted_2008_display = float(year_scenario.loc[year_scenario["year_label"].eq("2008"), "adjusted_probability"].iloc[0])

    mo.md(
        f"""
        <div style="border:1px solid #cad6e0;border-radius:8px;padding:22px;background:#f7fbfb;margin-top:12px;">
          <div style="font-size:14px;text-transform:uppercase;letter-spacing:0.08em;color:#52616b;font-weight:700;">Final recommendation</div>
          <div style="font-size:28px;line-height:1.2;font-weight:800;margin:8px 0 12px 0;">The rebound is real, but the campaign got smarter too.</div>
          <div style="font-size:16px;line-height:1.55;color:#25313b;">
            Conversion rises from <strong>{year_2008_rate:.1%}</strong> in inferred 2008 to <strong>{year_2010_rate:.1%}</strong> in 2010, while prior campaign success among contacted clients rises from <strong>{prior_success_2008:.1%}</strong> to <strong>{prior_success_2010:.1%}</strong>. After model adjustment, the year scenario still rises from <strong>{adjusted_2008_display:.1%}</strong> to <strong>{adjusted_2010_display:.1%}</strong>. The practical story is not just economic recovery; it is recovery plus warmer, better-timed targeting.
          </div>
        </div>
        """
    )
    return


@app.cell(hide_code=True)
def _(mo):
    presentation_script = """
    Most people would expect bank customers to be cautious right after the 2008 financial crisis, and the data shows exactly that at first. In the inferred 2008 campaign period, only about 5% of calls converted. But by 2009 that rises to 17%, and by 2010 it jumps to more than 50%.

    That sounds like a recovery story, but the interesting twist is that the bank also changed who it called. In 2008, almost nobody had a previous successful campaign outcome. By 2010, nearly 29% of contacted clients had that warm signal. So this is not just "the economy got better." It is also "the campaign got smarter."

    My takeaway is: after a shock like 2008, conversion can rebound dramatically, but the winning strategy is not simply waiting for time to pass. It is using timing plus prior relationship signals to focus calls on warmer clients.
    """.strip()

    mo.vstack(
        [
            mo.md("## 1-minute presentation script"),
            mo.md(f"> {presentation_script.replace(chr(10) + chr(10), chr(10) + chr(10) + '> ')}"),
        ],
        gap=1,
    )
    return (presentation_script,)


@app.cell(hide_code=True)
def _(
    base_realistic_features,
    df,
    df_raw,
    features_with_year,
    minimum_calls,
    mo,
    month_scores,
    pd,
    presentation_script,
    prior_success_2010,
    selected_month,
    selected_segment,
    year_2008_rate,
    year_2009_rate,
    year_2010_rate,
    year_scores,
):
    acceptance_checks = pd.DataFrame(
        [
            {"check": "Loaded expected bank-full.csv shape", "passed": df_raw.shape == (45211, 17)},
            {"check": "Inferred years cover May 2008 through November 2010", "passed": int(df["inferred_year"].iloc[0]) == 2008 and str(df["month"].iloc[0]) == "may" and int(df["inferred_year"].iloc[-1]) == 2010 and str(df["month"].iloc[-1]) == "nov"},
            {"check": "2008 conversion is near 5.1%", "passed": abs(year_2008_rate - 0.051) < 0.002},
            {"check": "2009 conversion is near 17.1%", "passed": abs(year_2009_rate - 0.171) < 0.002},
            {"check": "2010 conversion is near 51.6%", "passed": abs(year_2010_rate - 0.516) < 0.002},
            {"check": "2010 prior-success share is near 28.7%", "passed": abs(prior_success_2010 - 0.287) < 0.002},
            {"check": "Duration excluded from realistic models", "passed": "duration" not in base_realistic_features and "duration" not in features_with_year},
            {"check": "Inferred year improves holdout ROC AUC", "passed": year_scores["roc_auc"] > month_scores["roc_auc"] and abs(year_scores["roc_auc"] - 0.692) < 0.01},
            {"check": "Speaker script is present", "passed": len(presentation_script.split()) >= 120},
            {"check": "Interactive controls have selected values", "passed": all([selected_month is not None, selected_segment is not None, minimum_calls is not None])},
        ]
    )
    all_acceptance_checks_passed = bool(acceptance_checks["passed"].all())
    assert all_acceptance_checks_passed

    mo.vstack(
        [
            mo.md("## Acceptance checks"),
            mo.ui.table(acceptance_checks),
        ],
        gap=1,
    )
    return


if __name__ == "__main__":
    app.run()
