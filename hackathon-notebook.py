# /// script
# dependencies = [
#     "marimo",
#     "matplotlib==3.10.9",
#     "numpy==2.4.4",
#     "pandas==3.0.3",
# ]
# requires-python = ">=3.13"
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
    df

    return (df,)


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
def _(df, mo):
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

    # Second histogram: split by how many campaign contacts so far (1–3 vs 4+). "3 or more"
    # in the prompt is treated as strictly more than 3 so groups do not overlap.
    _bal_few = df.loc[df["campaign"].between(1, 3, inclusive="both"), "balance"]
    _bal_many = df.loc[df["campaign"] > 3, "balance"]
    _edges = np.linspace(df["balance"].min(), df["balance"].max(), 61)

    fig2, ax2 = plt.subplots(figsize=(9, 4.5))
    ax2.hist(
        _bal_few,
        bins=_edges,
        color="#2c5282",
        edgecolor="white",
        linewidth=0.35,
        log=True,
        alpha=0.65,
        label="1–3",
    )
    ax2.hist(
        _bal_many,
        bins=_edges,
        color="#c05621",
        edgecolor="white",
        linewidth=0.35,
        log=True,
        alpha=0.65,
        label="4+",
    )
    ax2.set_xlabel("Average yearly balance (euros)")
    ax2.set_ylabel("Count (log scale)")
    ax2.set_title("Histogram of balance by prior marketing calls in this campaign")
    ax2.legend(title="Number of marketing calls before loan")
    ax2.spines["top"].set_visible(False)
    ax2.spines["right"].set_visible(False)
    fig2.tight_layout()

    mo.vstack(
        [
            mo.md(
                "The public UCI file does not record **when a loan began** or a stable **customer id** across calls. "
                "For the first plot, **starting period** means **`campaign == 1`**. "
                "For the second plot, **`campaign`** counts contacts in the **current** campaign on that row; "
                "we treat that as a stand-in for how many marketing calls occurred **before** the modeled outcome, "
                "and group **1–3** vs **4+** so bins do not double-count the same call count. "
                "Both histograms use a **log-scaled count axis**."
            ),
            mo.mpl.interactive(fig1),
            mo.mpl.interactive(fig2),
        ]
    )

    return


if __name__ == "__main__":
    app.run()
