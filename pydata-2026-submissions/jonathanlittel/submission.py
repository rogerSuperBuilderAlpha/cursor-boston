# /// script
# dependencies = [
#     "marimo",
#     "matplotlib==3.10.9",
#     "numpy==2.4.4",
#     "pandas==3.0.3",
#     "scipy==1.17.1",
# ]
# requires-python = ">=3.13"
# ///

import marimo

__generated_with = "0.23.6"
app = marimo.App(width="medium")


@app.cell
def _():
    return


@app.cell
def _():
    import marimo as mo

    mo.md("## Bank Marketing Data Analysis")
    return (mo,)


@app.cell(hide_code=True)
def _():
    import io
    import zipfile
    import urllib.request

    import pandas as pd

    _URL = "https://archive.ics.uci.edu/ml/machine-learning-databases/00222/bank.zip"
    with urllib.request.urlopen(_URL) as resp:
        _buf = io.BytesIO(resp.read())
    with zipfile.ZipFile(_buf) as zf:
        df = pd.read_csv(zf.open("bank-full.csv"), sep=";")
    (df, pd)

    return df, pd


@app.cell(hide_code=True)
def _(df, mo):
    cat_cols = df.select_dtypes(include=["object", "string"]).columns.tolist()
    _s = df[cat_cols].nunique().rename("n_distinct")
    nunique_df = _s.reset_index().rename(columns={"index": "column"})
    num_desc = df.describe().T.reset_index().rename(columns={"index": "column"})
    _miss = df.isna().sum().rename("missing")
    missing_df = _miss.reset_index().rename(columns={"index": "column"})
    _y = df["y"].value_counts().rename("count")
    y_df = _y.reset_index().rename(columns={"index": "y"})

    mo.vstack(
        [
            mo.md("# Bank marketing — summary statistics"),
            mo.md(
                "**Dataset:** [UCI ML Repository #222 — Bank Marketing](https://archive.ics.uci.edu/dataset/222/bank+marketing)  \n"
                "**File loaded:** `bank-full.csv` from `bank.zip` (semicolon-separated)."
            ),
            mo.md(f"**Shape:** {df.shape[0]:,} rows × {df.shape[1]} columns"),
            mo.md("## dtypes"),
            mo.md("\n".join(f"- `{c}`: `{t}`" for c, t in df.dtypes.items())),
            mo.md("## Missing values"),
            mo.ui.table(missing_df),
            mo.md("## Numeric summary (`describe`)"),
            mo.ui.table(num_desc),
            mo.md("## Categorical columns — distinct value counts"),
            mo.ui.table(nunique_df),
            mo.md("## Target `y`"),
            mo.ui.table(y_df),
        ]
    )
    return


@app.cell(hide_code=True)
def _(df, mo, pd):
    import matplotlib.pyplot as plt
    import numpy as np

    # UCI Bank Marketing has no customer id or loan-origination date. "Starting period" is
    # proxied by the first contact in the current campaign (`campaign == 1`).
    _bal_start = df.loc[df["campaign"] == 1, "balance"]

    fig1, ax1 = plt.subplots(figsize=(9, 4.5))
    ax1.hist(
        _bal_start,
        bins=60,
        color="#2c5282",
        edgecolor="white",
        linewidth=0.35,
        log=True,
    )
    ax1.set_xlabel("Average yearly balance (euros)")
    ax1.set_ylabel("Count (log scale)")
    ax1.set_title("Histogram of balance at starting period (campaign = 1)")
    ax1.spines["top"].set_visible(False)
    ax1.spines["right"].set_visible(False)
    fig1.tight_layout()

    # `campaign` = number of contacts in the current campaign on this row (integer >= 1).
    _n_bins = 5
    _call_bins = pd.cut(
        df["campaign"],
        bins=_n_bins,
        include_lowest=True,
        duplicates="drop",
    )
    _by_bin = (
        df.assign(_call_bins=_call_bins)
        .groupby("_call_bins", observed=True)
        .agg(mean_balance=("balance", "mean"), n=("balance", "count"))
        .reset_index()
    )
    _labels = [str(iv) for iv in _by_bin["_call_bins"]]
    _x = np.arange(len(_by_bin))

    fig2, ax2 = plt.subplots(figsize=(9, 4.5))
    ax2.bar(
        _x,
        _by_bin["mean_balance"],
        color="#2c5282",
        edgecolor="white",
        linewidth=0.6,
    )
    ax2.set_xticks(_x, labels=_labels, rotation=25, ha="right")
    ax2.set_xlabel("Number of marketing calls (this campaign), equal-width bins")
    ax2.set_ylabel("Mean balance (euros)")
    ax2.set_title("Mean balance by binned call count")
    ax2.bar_label(ax2.containers[0], labels=[f"n={int(n)}" for n in _by_bin["n"]], padding=3, fontsize=8)
    ax2.spines["top"].set_visible(False)
    ax2.spines["right"].set_visible(False)
    fig2.tight_layout()

    _r_pearson = df["campaign"].corr(df["balance"], method="pearson")
    _r_spearman = df["campaign"].corr(df["balance"], method="spearman")

    mo.vstack(
        [
            mo.md(
                "The public UCI file does not record **when a loan began** or a stable **customer id** across calls. "
                "For the first plot, **starting period** means **`campaign == 1`**. "
                "The second chart bins **`campaign`** (contacts so far in this campaign) into **five equal-width** "
                "intervals and plots the **mean balance** per bin (bar labels show row counts). "
                "The first chart still uses a **log-scaled count** axis."
            ),
            mo.md(
                f"**Correlation (full sample, n = {len(df):,}):**  \n"
                f"- **Pearson r** (`campaign` vs `balance`): `{_r_pearson:.4f}`  \n"
                f"- **Spearman rho** (rank): `{_r_spearman:.4f}`  \n"
                "These are marginal associations only (no controls); outreach rules may target wealthier clients."
            ),
            mo.mpl.interactive(fig1),
            mo.mpl.interactive(fig2),
        ]
    )

    return


if __name__ == "__main__":
    app.run()
