# /// script
# dependencies = [
#     "marimo",
#     "numpy==2.4.4",
#     "openpyxl==3.1.5",
#     "pandas==3.0.3",
#     "plotly==6.7.0",
#     "scikit-learn==1.8.0",
# ]
# requires-python = ">=3.13"
# ///

import marimo

__generated_with = "0.23.6"
app = marimo.App(width="medium")


@app.cell
def _():
    import io
    import zipfile
    from pathlib import Path
    from urllib.request import urlopen

    import marimo as mo
    import numpy as np
    import pandas as pd
    import plotly.express as px
    from sklearn.cluster import KMeans
    from sklearn.preprocessing import MinMaxScaler

    mo
    return KMeans, MinMaxScaler, Path, io, mo, np, pd, px, urlopen, zipfile


@app.cell(hide_code=True)
def md_project_overview(mo):
    mo.md(r"""
    # Revenue concentration risk — Online Retail (README walkthrough)

    This notebook implements the **activities and phases** described in the project `README.md`: data understanding, cleaning, exploratory analysis (business, time, geography, products, customers), **RFM** segmentation, **revenue concentration** (Pareto-style), **VIP churn simulations**, notes toward **predictive churn prep**, and **business conclusions**.

    **Dataset:** UCI *Online Retail* (UK non-store retailer, **2010-12-01**–**2011-12-09**).
    **Load strategy:** use `Online Retail.xlsx` in the working directory if present; otherwise download the official UCI zip and read the spreadsheet from memory.

    **Columns:** `InvoiceNo`, `StockCode`, `Description`, `Quantity`, `InvoiceDate`, `UnitPrice`, `CustomerID`, `Country`.
    """)
    return


@app.cell(hide_code=True)
def md_phase1(mo):
    mo.md(r"""
    ## Phase 1 — Data understanding

    **Goals:** map the schema, list business-relevant fields, and surface **data quality** issues (missing values, duplicates, invalid signs, dtypes).

    **Below:** load the table, show shape/dtypes/head, missing counts, duplicate rows, and cancellation share (`InvoiceNo` starting with `C`).
    """)
    return


@app.cell(hide_code=True)
def load_and_phase1(Path, io, mo, pd, urlopen, zipfile):
    _local_xlsx = Path.cwd() / "Online Retail.xlsx"
    if _local_xlsx.exists():
        raw = pd.read_excel(_local_xlsx, engine="openpyxl")
        _src = str(_local_xlsx)
    else:
        _URL = "https://archive.ics.uci.edu/static/public/352/online+retail.zip"
        with urlopen(_URL, timeout=180) as _resp:
            _z = zipfile.ZipFile(io.BytesIO(_resp.read()))
            raw = pd.read_excel(
                io.BytesIO(_z.read("Online Retail.xlsx")),
                engine="openpyxl",
            )
        _src = "UCI zip (Online Retail.xlsx)"

    raw["InvoiceDate"] = pd.to_datetime(raw["InvoiceDate"], errors="coerce")
    raw["line_revenue"] = raw["Quantity"].astype(float) * raw["UnitPrice"].astype(float)
    raw["is_cancel"] = raw["InvoiceNo"].astype(str).str.startswith("C", na=False)

    mo.md(f"### Load + line revenue\n\n**Rows:** {len(raw):,} · **Source:** `{_src}`")

    miss = raw.isna().sum()
    miss_nz = miss[miss > 0].rename("missing_count").to_frame()
    dup_n = int(raw.duplicated().sum())
    mo.md("### Missing values (columns with any NA)")
    mo.ui.table(miss_nz.reset_index().rename(columns={"index": "column"}), selection=None)
    mo.md(f"### Duplicates\n\nFully duplicate rows: **{dup_n:,}**")

    mo.md("### Dtypes")
    mo.ui.table(
        pd.DataFrame({"column": raw.columns, "dtype": raw.dtypes.astype(str).values}),
        selection=None,
    )

    mo.md("### Peek")
    raw.head(8)
    return (raw,)


@app.cell(hide_code=True)
def md_phase2(mo):
    mo.md(r"""
    ## Phase 2 — Data cleaning

    **Goals:** remove cancelled invoices, drop negative `Quantity` / negative `UnitPrice`, handle missing `CustomerID` for customer-level work, standardize dates, and engineer **revenue** plus simple **calendar features**.

    **Working sets:** `sales` (no cancellations) and `sales_valid` (also `Quantity > 0`, non-negative price, known `CustomerID`) for RFM / concentration / simulations.
    """)
    return


@app.cell(hide_code=True)
def clean_and_features(mo, raw):
    sales = raw.loc[~raw["is_cancel"]].copy()
    sales_valid = sales.loc[
        (sales["Quantity"] > 0)
        & (sales["UnitPrice"] >= 0)
        & sales["CustomerID"].notna()
    ].copy()

    sales["invoice_month"] = sales["InvoiceDate"].dt.to_period("M").astype(str)
    sales["invoice_week"] = sales["InvoiceDate"].dt.to_period("W").astype(str)
    sales["invoice_dow"] = sales["InvoiceDate"].dt.day_name()
    sales["invoice_hour"] = sales["InvoiceDate"].dt.hour

    sales_valid["invoice_month"] = sales_valid["InvoiceDate"].dt.to_period("M").astype(str)
    sales_valid["invoice_week"] = sales_valid["InvoiceDate"].dt.to_period("W").astype(str)

    mo.md(
        f"- **`sales`:** {len(sales):,} rows (excludes cancellations)\n"
        f"- **`sales_valid`:** {len(sales_valid):,} rows (adds quantity/price/customer filters)"
    )
    return sales, sales_valid


@app.cell(hide_code=True)
def md_phase3(mo):
    mo.md(r"""
    ## Phase 3 — Exploratory data analysis (EDA)

    The README splits EDA into: **3.1** business overview, **3.2** time series, **3.3** geography, **3.4** products, **3.5** customer behavior. Each subsection below answers the guiding questions with tables or charts.
    """)
    return


@app.cell(hide_code=True)
def eda_step_3_1(mo, pd, sales, sales_valid):
    mo.md("### Step 3.1 — Business overview")

    total_rev = float(sales["line_revenue"].sum())
    orders = int(sales["InvoiceNo"].nunique())
    customers_all = int(sales["CustomerID"].nunique())
    customers_v = int(sales_valid["CustomerID"].nunique())
    aov = total_rev / max(orders, 1)
    arpc = total_rev / max(customers_v, 1)

    kpi = pd.DataFrame(
        {
            "metric": [
                "Total revenue (£)",
                "Total orders (invoices)",
                "Unique customers (all rows)",
                "Unique customers (sales_valid)",
                "Average order value (£)",
                "Avg revenue per customer (£, valid)",
            ],
            "value": [
                f"{total_rev:,.0f}",
                f"{orders:,}",
                f"{customers_all:,}",
                f"{customers_v:,}",
                f"{aov:,.2f}",
                f"{arpc:,.2f}",
            ],
        }
    )
    mo.ui.table(kpi, selection=None)
    return


@app.cell(hide_code=True)
def eda_step_3_2(mo, px, sales):
    mo.md("### Step 3.2 — Time series (month / week / day)")

    monthly = (
        sales.groupby("invoice_month", as_index=False)["line_revenue"]
        .sum()
        .rename(columns={"line_revenue": "revenue"})
    )
    weekly = (
        sales.groupby("invoice_week", as_index=False)["line_revenue"]
        .sum()
        .rename(columns={"line_revenue": "revenue"})
    )
    daily = (
        sales.groupby(sales["InvoiceDate"].dt.normalize(), as_index=False)["line_revenue"]
        .sum()
        .rename(columns={"InvoiceDate": "day", "line_revenue": "revenue"})
    )

    fig_m = px.bar(monthly, x="invoice_month", y="revenue", title="Revenue by month")
    fig_w = px.line(weekly, x="invoice_week", y="revenue", title="Revenue by week")
    fig_d = px.line(daily, x="day", y="revenue", title="Revenue by day")
    mo.vstack([fig_m, fig_w, fig_d])
    return


@app.cell(hide_code=True)
def eda_step_3_3(mo, px, sales):
    mo.md("### Step 3.3 — Geography")

    country_rev = (
        sales.groupby("Country", as_index=False)["line_revenue"]
        .sum()
        .sort_values("line_revenue", ascending=False)
    )
    topc = country_rev.head(18).iloc[::-1]
    fig_c = px.bar(
        topc,
        x="line_revenue",
        y="Country",
        orientation="h",
        title="Top countries by revenue",
    )
    fig_c.update_layout(xaxis_title="Revenue (£)", yaxis_title="")
    fig_c
    return


@app.cell(hide_code=True)
def eda_step_3_4(mo, px, sales):
    mo.md("### Step 3.4 — Products")

    top_skus = (
        sales.groupby(["StockCode", "Description"], as_index=False)["line_revenue"]
        .sum()
        .sort_values("line_revenue", ascending=False)
        .head(25)
    )
    top_skus["label"] = top_skus["StockCode"].astype(str) + " — " + top_skus["Description"].fillna("").str.slice(0, 48)
    fig_p = px.bar(
        top_skus.iloc[::-1],
        x="line_revenue",
        y="label",
        orientation="h",
        title="Top 25 product lines by revenue",
    )
    fig_p.update_layout(xaxis_title="Revenue (£)", yaxis_title="")
    fig_p
    return


@app.cell(hide_code=True)
def eda_step_3_5(mo, px, sales_valid):
    mo.md("### Step 3.5 — Customer behavior")

    inv_per_cust = sales_valid.groupby("CustomerID")["InvoiceNo"].nunique()
    rev_per_cust = sales_valid.groupby("CustomerID")["line_revenue"].sum()
    one_time = int((inv_per_cust == 1).mean() * 100)

    mo.md(
        f"- **Share of customers with a single invoice:** ~**{one_time}%**\n"
        "- Distributions below: invoices per customer and revenue per customer (valid cohort)."
    )

    fig_f = px.histogram(
        inv_per_cust.reset_index(drop=False).rename(columns={"InvoiceNo": "invoices"}),
        x="invoices",
        nbins=40,
        title="Purchase frequency (# distinct invoices)",
    )
    fig_m2 = px.histogram(
        rev_per_cust.reset_index(drop=False).rename(columns={"line_revenue": "revenue"}),
        x="revenue",
        nbins=50,
        title="Customer spending distribution (£)",
    )
    mo.vstack([fig_f, fig_m2])
    return


@app.cell(hide_code=True)
def md_phase4(mo):
    mo.md(r"""
    ## Phase 4 — Customer segmentation (RFM)

    **Recency / frequency / monetary** are computed per `CustomerID` on `sales_valid`. Quintile scores **R, F, M** (1–5) and a simple **rule-based segment** label (Champions, Loyal, At risk, Lost, One-time, Other) help compare groups before concentration analysis.

    A small **KMeans** view (4 clusters on log-scaled, min–max normalized RFM features) offers an alternative grouping for discussion.
    """)
    return


@app.cell(hide_code=True)
def rfm_and_segments(KMeans, MinMaxScaler, mo, np, pd, px, sales_valid):
    ref_date = sales_valid["InvoiceDate"].max().normalize() + pd.Timedelta(days=1)
    cust = sales_valid.groupby("CustomerID").agg(
        last_date=("InvoiceDate", "max"),
        frequency=("InvoiceNo", "nunique"),
        monetary=("line_revenue", "sum"),
    )
    cust["recency_days"] = (ref_date - cust["last_date"]).dt.days

    r_q = pd.qcut(
        cust["recency_days"].rank(method="first"), q=5, labels=[5, 4, 3, 2, 1]
    )
    f_q = pd.qcut(cust["frequency"].rank(method="first"), q=5, labels=[1, 2, 3, 4, 5])
    m_q = pd.qcut(cust["monetary"].rank(method="first"), q=5, labels=[1, 2, 3, 4, 5])
    cust = cust.assign(R=r_q.astype(int), F=f_q.astype(int), M=m_q.astype(int))
    cust["RFM_score"] = cust["R"] + cust["F"] + cust["M"]

    def _rfm_label(row):
        r, f, m, freq = int(row["R"]), int(row["F"]), int(row["M"]), int(row["frequency"])
        if freq <= 1:
            return "One-time"
        if r >= 4 and f >= 4 and m >= 4:
            return "Champions"
        if r <= 2 and f >= 3 and m >= 3:
            return "At risk"
        if r <= 2 and f <= 2 and m <= 2:
            return "Lost/Hibernating"
        if f >= 4 and m >= 3:
            return "Loyal"
        return "Other"

    cust["rfm_segment"] = cust.apply(_rfm_label, axis=1)

    seg_rev = (
        cust.reset_index()
        .groupby("rfm_segment", as_index=False)["monetary"]
        .sum()
        .sort_values("monetary", ascending=False)
    )
    mo.md(f"### RFM snapshot (reference date **{ref_date.date()}**)")
    mo.ui.table(seg_rev, selection=None)

    scatter = px.scatter(
        cust.reset_index(),
        x="recency_days",
        y="monetary",
        size="frequency",
        color="RFM_score",
        hover_data=["CustomerID", "rfm_segment"],
        title="Recency vs monetary (size = invoice count)",
        color_continuous_scale="Viridis",
    )
    scatter.update_layout(xaxis_title="Recency (days)", yaxis_title="Monetary (£)")

    X = cust[["recency_days", "frequency", "monetary"]].astype(float)
    X_t = MinMaxScaler().fit_transform(np.log1p(X))
    km = KMeans(n_clusters=4, random_state=42, n_init="auto")
    cust_seg = cust.copy()
    cust_seg["ksegment"] = km.fit_predict(X_t).astype(str)

    km_fig = px.scatter(
        cust_seg.reset_index(),
        x="recency_days",
        y="monetary",
        color="ksegment",
        size="frequency",
        hover_data=["CustomerID"],
        title="Customers colored by KMeans segment",
    )
    mo.vstack([scatter, mo.md("### KMeans clusters (4) on log1p RFM"), km_fig])
    return


@app.cell(hide_code=True)
def md_phase5(mo):
    mo.md(r"""
    ## Phase 5 — Revenue concentration (Pareto / "WOW" insight)

    Customers are ranked by **lifetime revenue** on `sales_valid`. We report the **share of total revenue** contributed by the **top 1%, 5%, 10%, and 20%** of customers (by count).

    This directly answers README questions on the **Pareto principle** and **dependency risk** on VIPs.
    """)
    return


@app.cell(hide_code=True)
def revenue_concentration(mo, np, pd, px, sales_valid):
    rev_cust = (
        sales_valid.groupby("CustomerID", as_index=False)["line_revenue"]
        .sum()
        .rename(columns={"line_revenue": "customer_revenue"})
        .sort_values("customer_revenue", ascending=False)
        .reset_index(drop=True)
    )
    total_cust_rev = float(rev_cust["customer_revenue"].sum())
    n_cust = len(rev_cust)
    rows = []
    for pct in (1, 5, 10, 20):
        k = max(1, int(np.ceil(n_cust * pct / 100)))
        share = float(rev_cust.head(k)["customer_revenue"].sum() / total_cust_rev)
        rows.append({"top_%_of_customers": pct, "customers_in_tail": k, "revenue_share_%": round(100 * share, 2)})
    conc = pd.DataFrame(rows)
    mo.md("### Concentration table")
    mo.ui.table(conc, selection=None)

    rev_cust["cum_share"] = rev_cust["customer_revenue"].cumsum() / total_cust_rev
    rev_cust["cust_pct"] = (np.arange(1, n_cust + 1) / n_cust) * 100
    fig_lorenz = px.line(
        rev_cust,
        x="cust_pct",
        y=rev_cust["cum_share"] * 100,
        title="Revenue concentration curve (% customers vs % cumulative revenue)",
    )
    fig_lorenz.update_layout(xaxis_title="% of customers (ranked)", yaxis_title="Cumulative % of revenue")
    fig_lorenz
    return (rev_cust,)


@app.cell(hide_code=True)
def md_phase6(mo):
    mo.md(r"""
    ## Phase 6 — Churn risk simulation (VIP spend shock)

    **VIP customers** = the **top 20%** of customers by lifetime revenue. We simulate uniform **reductions** in their observed spend (10%, 20%, 50%) and measure **implied total revenue** assuming all other customers unchanged — a simple **stress test** for dependency risk.
    """)
    return


@app.cell(hide_code=True)
def churn_simulation(mo, np, pd, rev_cust, sales_valid):
    n_top = max(1, int(np.ceil(0.20 * len(rev_cust))))
    vip_ids = set(rev_cust.head(n_top)["CustomerID"])
    base_total = float(sales_valid["line_revenue"].sum())
    vip_mask = sales_valid["CustomerID"].isin(vip_ids)
    vip_rev_component = float(sales_valid.loc[vip_mask, "line_revenue"].sum())

    sim_rows = []
    for shock in (0.10, 0.20, 0.50):
        new_total = base_total - shock * vip_rev_component
        sim_rows.append(
            {
                "vip_spend_reduction": f"{int(shock * 100)}%",
                "revenue_after_shock_£": round(new_total, 2),
                "revenue_drop_vs_baseline_%": round(100 * (base_total - new_total) / base_total, 2),
            }
        )
    sim_df = pd.DataFrame(sim_rows)
    mo.md(
        f"**Baseline revenue (`sales_valid`):** £{base_total:,.0f}  \n"
        f"**VIP (top 20% customers) revenue share:** {100 * vip_rev_component / base_total:.1f}%"
    )
    mo.ui.table(sim_df, selection=None)
    return


@app.cell(hide_code=True)
def md_phase7(mo):
    mo.md(r"""
    ## Phase 7 — Predictive modeling preparation

    **Goal (README):** later predict **customer inactivity / churn**.
    **Churn definition (example):** no purchase in a future window (not fit here — we only materialize **candidate features** from history).

    **Features below:** recency (days), frequency (invoices), monetary total, average basket (`monetary/frequency`), inter-purchase **mean/std** days (approx from per-customer invoice dates), and **SKU diversity** (`nunique` stock codes).
    """)
    return


@app.cell(hide_code=True)
def predictive_feature_table(mo, np, pd, sales_valid):
    def _cust_feats(g):
        g = g.sort_values("InvoiceDate")
        days_between = g["InvoiceDate"].dt.normalize().diff().dt.days.dropna()
        return pd.Series(
            {
                "last_purchase": g["InvoiceDate"].max(),
                "frequency": g["InvoiceNo"].nunique(),
                "monetary": g["line_revenue"].sum(),
                "sku_diversity": g["StockCode"].nunique(),
                "mean_gap_days": days_between.mean() if len(days_between) else np.nan,
                "std_gap_days": days_between.std() if len(days_between) else np.nan,
            }
        )

    cust_features = sales_valid.groupby("CustomerID", group_keys=False).apply(_cust_feats)
    cust_features["avg_basket"] = cust_features["monetary"] / cust_features["frequency"].replace(0, np.nan)
    mo.md("### Feature preview (first rows)")
    mo.ui.table(cust_features.head(12).reset_index(), selection=None)
    return


@app.cell(hide_code=True)
def md_phase8(mo):
    mo.md(r"""
    ## Phase 8 — Business conclusions (README checklist)

    1. **What drives revenue most?** A relatively small set of SKUs and customers; geographic concentration (UK-heavy) is typical for this file.
    2. **Which customers matter most?** High **RFM_score** / **Champions** and the **top revenue deciles** identified in Phase 5.
    3. **How concentrated is revenue?** See the **top 1/5/10/20%** table and Lorenz-style curve — often strongly skewed (Pareto-like).
    4. **VIP loss risk?** Phase 6 shows revenue is **sensitive** to shocks concentrated on the **top-20% spenders**.
    5. **Who to retain?** Prioritize **Champions / high monetary** with rising **recency** (moving toward *At risk*).

    **Suggested deck flow:** dataset → cleaning → EDA highlights → segmentation → concentration "wow" → churn stress test → recommendations.
    """)
    return


@app.cell(hide_code=True)
def md_tools_and_outcome(mo):
    mo.md(r"""
    ## Recommended tools (from README)

    - **Core:** Python, **pandas**, **numpy**
    - **Charts:** **plotly** (this notebook), optional matplotlib/seaborn for static styling
    - **Later ML:** scikit-learn / XGBoost for churn classifiers using the Phase 7 feature frame

    **Outcome:** structured EDA, segmentation, quantified concentration, simple VIP shock scenarios, and a feature table ready for labeled churn modeling once you pick a horizon.
    """)
    return


if __name__ == "__main__":
    app.run()
