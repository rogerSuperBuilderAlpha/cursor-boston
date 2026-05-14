# /// script
# dependencies = [
#     "altair==6.1.0",
#     "marimo",
#     "numpy==2.4.4",
#     "pandas==3.0.3",
#     "ucimlrepo==0.0.7",
# ]
# requires-python = ">=3.12"
# ///

import marimo

__generated_with = "0.23.6"
app = marimo.App(width="medium")


@app.cell(hide_code=True)
def _():
    import marimo as mo

    mo.md(
        "Build an interactive customer segmentation dashboard in a marimo notebook (hackathon.py) using the UCI Online Retail dataset — that tells a business \"who your customers are and what to do about each group.\""
    )

    return (mo,)


@app.cell(hide_code=True)
def _(mo):
    mo.md("""
    Hello!
    """)
    return


@app.cell(hide_code=True)
def _(mo):
    mo.md("""
    ## Goal 1 — Get the data in

    Load the Online Retail dataset, then **clean** it so downstream cells only see trustworthy transactions:

    - Drop rows with missing **CustomerID**
    - **Remove returns** using **non-positive `Quantity`** (this UCI export does not include `InvoiceNo`, so we cannot match credit-note prefixes; quantity sign is the reliable return signal here)
    - **Filter bad rows**: drop non-positive **UnitPrice**, blank **Description**, and rows where **InvoiceDate** cannot be parsed

    Output: one **`retail_clean`** dataframe, ready for customer-level aggregation and segmentation.
    """)
    return


@app.cell
def _():
    from ucimlrepo import fetch_ucirepo

    online_retail = fetch_ucirepo(id=352)
    retail_features = online_retail.data.features
    retail_targets = online_retail.data.targets
    retail_metadata = online_retail.metadata
    (retail_features, retail_targets, retail_metadata)

    return (retail_features,)


@app.cell
def _(retail_features):
    import pandas as pd

    _df = retail_features.copy()
    _df.columns = [str(c).strip() for c in _df.columns]

    _df = _df.loc[_df["CustomerID"].notna()].copy()
    _df = _df.loc[_df["Quantity"] > 0].copy()
    _df = _df.loc[_df["UnitPrice"] > 0].copy()

    _df["Description"] = _df["Description"].fillna("").astype(str).str.strip()
    _df = _df.loc[_df["Description"] != ""].copy()

    _df["InvoiceDate"] = pd.to_datetime(_df["InvoiceDate"], errors="coerce")
    _df = _df.loc[_df["InvoiceDate"].notna()].copy()

    retail_clean = _df.reset_index(drop=True)

    return (retail_clean,)


@app.cell(hide_code=True)
def _(mo):
    mo.md("""
    ## Goal 2 — Visual storytelling + RFM scoring

    **Charts** set the scene: revenue over time, top countries, top products (by line description), and an **overview** card with headline KPIs.

    **RFM per customer** (this export has no invoice numbers):

    - **Recency** — days since last purchase (relative to the latest timestamp in the cleaned data)
    - **Frequency** — number of distinct **purchase calendar days** per customer (proxy for repeat buying / order occasions)
    - **Monetary** — total spend, sum of `Quantity * UnitPrice`

    Each of **R**, **F**, and **M** is scored **1–5** using quintiles (more recent purchases earn a higher **R**; higher activity and spend earn higher **F** and **M**).
    """)
    return


@app.cell
def _(retail_clean):
    import pandas as pdd

    _r = retail_clean.assign(revenue=retail_clean["Quantity"] * retail_clean["UnitPrice"])
    _ref_date = _r["InvoiceDate"].max().normalize()

    _freq = (
        _r.assign(purchase_day=_r["InvoiceDate"].dt.normalize())
        .groupby("CustomerID")["purchase_day"]
        .nunique()
        .reset_index(name="frequency")
    )
    _rfm = _r.groupby("CustomerID", as_index=False).agg(
        last_purchase=("InvoiceDate", "max"),
        monetary=("revenue", "sum"),
    )
    rfm_customer = _rfm.merge(_freq, on="CustomerID", how="left")
    rfm_customer["frequency"] = rfm_customer["frequency"].fillna(0).astype(int)
    rfm_customer["recency_days"] = (
        _ref_date - rfm_customer["last_purchase"].dt.normalize()
    ).dt.days.astype(int)

    for col, labels in (
        ("recency_days", [5, 4, 3, 2, 1]),
        ("frequency", [1, 2, 3, 4, 5]),
        ("monetary", [1, 2, 3, 4, 5]),
    ):
        tag = {"recency_days": "R_score", "frequency": "F_score", "monetary": "M_score"}[col]
        try:
            if rfm_customer[col].nunique() < 2:
                rfm_customer[tag] = 3
            else:
                rfm_customer[tag] = pdd.qcut(
                    rfm_customer[col], q=5, labels=labels, duplicates="drop"
                ).astype(int)
        except (ValueError, TypeError):
            rfm_customer[tag] = 3

    rfm_customer

    return (rfm_customer,)


@app.cell
def _(mo, retail_clean, rfm_customer):
    import altair as alt

    _r = retail_clean.assign(revenue=retail_clean["Quantity"] * retail_clean["UnitPrice"])
    _total_rev = float(_r["revenue"].sum())
    _n_cust = int(rfm_customer["CustomerID"].nunique())
    _n_cntry = int(_r["Country"].nunique())
    _d0 = _r["InvoiceDate"].min().date()
    _d1 = _r["InvoiceDate"].max().date()

    _overview = mo.md(
        "### Overview\n\n"
        + "| | |\n|:---|---:|\n"
        + f"| **Total revenue (GBP)** | {_total_rev:,.0f} |\n"
        + f"| **Customers (RFM)** | {_n_cust:,} |\n"
        + f"| **Countries** | {_n_cntry} |\n"
        + f"| **Date range** | {_d0} -> {_d1} |\n"
    )

    _monthly = (
        _r.assign(ym=_r["InvoiceDate"].dt.to_period("M").astype(str))
        .groupby("ym", as_index=False)["revenue"]
        .sum()
        .sort_values("ym")
    )
    _ym_order = _monthly["ym"].tolist()
    ch_month = (
        alt.Chart(_monthly)
        .mark_line(point=True, color="#6366f1", strokeWidth=3)
        .encode(
            x=alt.X("ym:N", sort=_ym_order, title="Month"),
            y=alt.Y("revenue:Q", title="Revenue (GBP)"),
            tooltip=["ym", "revenue"],
        )
        .properties(height=240, title="Retail dashboard · Revenue over time (monthly)")
    )

    _by_c = (
        _r.groupby("Country", as_index=False)["revenue"]
        .sum()
        .sort_values("revenue", ascending=False)
        .head(12)
    )
    ch_c = (
        alt.Chart(_by_c)
        .mark_bar(color="#f97316")
        .encode(
            x=alt.X("revenue:Q", title="Revenue (GBP)"),
            y=alt.Y("Country:N", sort="-x", title=None),
            tooltip=["Country", "revenue"],
        )
        .properties(width=320, height=280, title="Retail dashboard · Top countries (revenue)")
    )

    _by_p = (
        _r.groupby("Description", as_index=False)["revenue"]
        .sum()
        .sort_values("revenue", ascending=False)
        .head(12)
    )
    ch_p = (
        alt.Chart(_by_p)
        .mark_bar(color="#22c55e")
        .encode(
            x=alt.X("revenue:Q", title="Revenue (GBP)"),
            y=alt.Y("Description:N", sort="-x", title=None),
            tooltip=["Description", "revenue"],
        )
        .properties(width=360, height=300, title="Retail dashboard · Top products (revenue)")
    )

    _sample = rfm_customer[
        [
            "CustomerID",
            "recency_days",
            "frequency",
            "monetary",
            "R_score",
            "F_score",
            "M_score",
        ]
    ].head(12)
    _tbl = mo.ui.table(data=_sample, pagination=False, label="RFM sample (12 customers)")

    goal2_story = mo.vstack(
        [
            _overview,
            mo.md("### Goal 2 · Revenue & category mix"),
            ch_month,
            mo.hstack(
                [
                    mo.vstack([mo.md("#### Goal 2 · Top countries"), ch_c]),
                    mo.vstack([mo.md("#### Goal 2 · Top products"), ch_p]),
                ],
                justify="start",
            ),
            mo.md("### Goal 2 · RFM sample"),
            _tbl,
        ],
        gap=1,
    )
    goal2_story

    return


@app.cell(hide_code=True)
def _(mo):
    mo.md("""
    ## Goal 3 — Segment customers

    Assign every customer to a **named lifecycle segment** from their **RFM scores** (priority-ordered rules so labels stay mutually exclusive).

    Then review **segment sizes** in a colorful bar chart to see where the base concentrates (Champions, Loyal, At Risk, Lost, New, and a few supporting buckets).
    """)
    return


@app.cell
def _(rfm_customer):
    import numpy as np

    _r = rfm_customer["R_score"].to_numpy()
    _f = rfm_customer["F_score"].to_numpy()
    _m = rfm_customer["M_score"].to_numpy()

    _conds = [
        (_r >= 4) & (_f >= 4) & (_m >= 4),
        (_r <= 2) & (_f <= 2) & (_m <= 2),
        (_r >= 4) & (_f <= 2),
        (_r <= 2) & (_m >= 4),
        (_r <= 2) & (_f >= 3) & (_m >= 3),
        (_f >= 4) & (_m >= 4),
        (_r >= 4) & (_m >= 3),
        (_r <= 2) & ((_f + _m) >= 5),
    ]
    _labels = [
        "Champions",
        "Lost",
        "New",
        "Cannot Lose Them",
        "At Risk",
        "Loyal Customers",
        "Promising",
        "Hibernating",
    ]
    _segment = np.select(_conds, _labels, default="Needs Attention")
    rfm_segments = rfm_customer.assign(segment=_segment)
    rfm_segments

    return (rfm_segments,)


@app.cell
def _(mo, rfm_segments):
    import altair as alt_g3

    _counts = (
        rfm_segments.groupby("segment", as_index=False)
        .agg(customers=("CustomerID", "count"))
        .sort_values("customers", ascending=False)
    )
    _palette = {
        "Champions": "#16a34a",
        "Loyal Customers": "#2563eb",
        "Promising": "#06b6d4",
        "New": "#a855f7",
        "Needs Attention": "#eab308",
        "At Risk": "#f97316",
        "Cannot Lose Them": "#e11d48",
        "Hibernating": "#64748b",
        "Lost": "#0f172a",
    }
    _domain = _counts["segment"].tolist()
    _range = [_palette.get(s, "#94a3b8") for s in _domain]

    _ch = (
        alt_g3.Chart(_counts)
        .mark_bar(cornerRadiusEnd=4)
        .encode(
            x=alt_g3.X("customers:Q", title="Customers"),
            y=alt_g3.Y("segment:N", sort="-x", title=None),
            color=alt_g3.Color(
                "segment:N",
                scale=alt_g3.Scale(domain=_domain, range=_range),
                legend=None,
            ),
            tooltip=["segment", "customers"],
        )
        .properties(
            width=680,
            height=max(300, 32 * len(_domain)),
            title="Retail dashboard · Segment sizes (customers)",
        )
    )

    mo.vstack(
        [
            mo.md("### Goal 3 · Segment distribution"),
            _ch,
        ],
        gap=1,
    )

    return


@app.cell(hide_code=True)
def _(mo):
    mo.md("""
    ## Goal 4 — Make it interactive

    **Pick a segment** from the dropdown (next cell). Two **Altair** charts summarize **every** segment at once: **customer counts** and **total revenue** (sum of per-customer `monetary`, GBP). The **table** at the bottom reacts to your choice and lists customers in that segment (sorted by spend).
    """)
    return


@app.cell
def _(mo, rfm_segments):
    _opts = sorted(rfm_segments["segment"].astype(str).unique().tolist())
    segment_dropdown = mo.ui.dropdown(
        options=_opts,
        value=_opts[0],
        label="Pick a segment",
    )
    segment_dropdown

    return (segment_dropdown,)


@app.cell
def _(mo, rfm_segments, segment_dropdown):
    import altair as alt_g4

    _agg = (
        rfm_segments.groupby("segment", as_index=False)
        .agg(
            customers=("CustomerID", "count"),
            revenue=("monetary", "sum"),
        )
        .sort_values("customers", ascending=False)
    )
    _palette = {
        "Champions": "#16a34a",
        "Loyal Customers": "#2563eb",
        "Promising": "#06b6d4",
        "New": "#a855f7",
        "Needs Attention": "#eab308",
        "At Risk": "#f97316",
        "Cannot Lose Them": "#e11d48",
        "Hibernating": "#64748b",
        "Lost": "#0f172a",
    }
    _domain = _agg["segment"].tolist()
    _rng = [_palette.get(s, "#94a3b8") for s in _domain]

    ch_size = (
        alt_g4.Chart(_agg)
        .mark_bar(cornerRadiusEnd=4)
        .encode(
            x=alt_g4.X("customers:Q", title="Customers"),
            y=alt_g4.Y("segment:N", sort="-x", title=None),
            color=alt_g4.Color(
                "segment:N",
                scale=alt_g4.Scale(domain=_domain, range=_rng),
                legend=None,
            ),
            tooltip=["segment", "customers"],
        )
        .properties(
            width=380,
            height=max(260, 28 * len(_domain)),
            title="Retail dashboard · Customers per segment",
        )
    )

    ch_revenue = (
        alt_g4.Chart(_agg)
        .mark_bar(cornerRadiusEnd=4)
        .encode(
            x=alt_g4.X("revenue:Q", title="Sum monetary (GBP)"),
            y=alt_g4.Y("segment:N", sort="-x", title=None),
            color=alt_g4.Color(
                "segment:N",
                scale=alt_g4.Scale(domain=_domain, range=_rng),
                legend=None,
            ),
            tooltip=["segment", alt_g4.Tooltip("revenue:Q", format=",.0f")],
        )
        .properties(
            width=380,
            height=max(260, 28 * len(_domain)),
            title="Retail dashboard · Revenue per segment (GBP)",
        )
    )

    _sel = segment_dropdown.value
    _cols = [
        c
        for c in [
            "CustomerID",
            "segment",
            "recency_days",
            "frequency",
            "monetary",
            "R_score",
            "F_score",
            "M_score",
            "last_purchase",
        ]
        if c in rfm_segments.columns
    ]
    _slice = rfm_segments.loc[rfm_segments["segment"] == _sel, _cols].sort_values(
        "monetary", ascending=False
    )
    customer_table = mo.ui.table(
        data=_slice,
        pagination=True,
        page_size=15,
        label="Customers in the selected segment",
    )

    goal4_explorer = mo.vstack(
        [
            mo.md("### Goal 4 · Segment sizes & revenue (all segments)"),
            mo.hstack([ch_size, ch_revenue], justify="start", gap=1),
            mo.md("### Goal 4 · Customers in the selected segment"),
            customer_table,
        ],
        gap=1,
    )
    goal4_explorer

    return


@app.cell(hide_code=True)
def _(mo):
    mo.md("""
    ## Goal 5 — AI layer (offline)

    Insights are **pre-generated** and stored as **`ai_insights.json`** next to this notebook — **no API keys** and **no live model calls** at runtime.

    The cell below **loads the JSON** and renders **styled cards** (HTML in markdown) with emoji, bold headings, accent borders, and soft backgrounds per segment, plus **expandable Q&A** snippets.
    """)
    return


@app.cell
def _(mo):
    import html
    import json
    from pathlib import Path


    def _insights_path() -> Path:
        cwd = Path.cwd()
        for base in (cwd, cwd / "pydata-2026-submissions" / "vishalprasanna11"):
            p = base / "ai_insights.json"
            if p.is_file():
                return p
        return cwd / "ai_insights.json"


    _p = _insights_path()
    if not _p.is_file():
        goal5_ai_layer = mo.callout(
            mo.md(
                "Could not find **`ai_insights.json`**. Place it next to `hackathon-notebook.py` (or run marimo from the submission folder) and re-run this cell."
            ),
            kind="warn",
        )
    else:
        _doc = json.loads(_p.read_text(encoding="utf-8"))
        _order = list(_doc.get("display_order") or [])
        _segs = _doc.get("segments") or {}
        for _name in sorted(_segs.keys()):
            if _name not in _order:
                _order.append(_name)

        _parts: list[str] = []
        _parts.append(
            '<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;line-height:1.45">'
        )
        _parts.append(
            '<h2 style="margin:0 0 12px 0;color:#0f172a">'
            + html.escape(str((_doc.get("meta") or {}).get("title", "Segment insights")))
            + "</h2>"
        )
        _parts.append(
            '<p style="margin:0 0 16px 0;color:#475569">'
            + html.escape(
                str(
                    (_doc.get("meta") or {}).get(
                        "note",
                        "Offline playbook JSON — edit the file to refresh messaging.",
                    )
                )
            )
            + "</p>"
        )

        for _seg in _order:
            _row = _segs.get(_seg)
            if not isinstance(_row, dict):
                continue
            _icon = html.escape(str(_row.get("icon", "📌")))
            _accent = html.escape(str(_row.get("accent", "#334155")))
            _bg = html.escape(str(_row.get("background", "#f8fafc")))
            _d = html.escape(str(_row.get("description", "")))
            _a = html.escape(str(_row.get("action", "")))
            _title = html.escape(str(_seg))
            _parts.append(
                f'<div style="background:{_bg};border-radius:14px;padding:16px 18px;margin:14px 0;'
                f"border-left:6px solid {_accent};box-shadow:0 1px 2px rgba(15,23,42,0.06)\">"
                f'<h3 style="margin:0 0 10px 0;font-size:1.05rem;color:#0f172a">{_icon} <b>{_title}</b></h3>'
                f'<p style="margin:6px 0;color:#334155"><span style="color:{_accent};font-weight:700">Who they are</span> — {_d}</p>'
                f'<p style="margin:6px 0;color:#334155"><span style="color:{_accent};font-weight:700">Recommended play</span> — {_a}</p>'
                "</div>"
            )

        _faq = _doc.get("faq") or []
        if _faq:
            _parts.append(
                '<h3 style="margin:24px 0 10px 0;color:#0f172a">Quick Q&amp;A</h3>'
            )
            for _i, _item in enumerate(_faq):
                if not isinstance(_item, dict):
                    continue
                _q = html.escape(str(_item.get("q", "")))
                _ans = html.escape(str(_item.get("a", "")))
                _hue = ["#4f46e5", "#0d9488", "#c026d3"][_i % 3]
                _parts.append(
                    f'<details style="margin:10px 0;border:2px solid {_hue};border-radius:10px;padding:10px 12px;background:#fafafa">'
                    f'<summary style="cursor:pointer;font-weight:800;color:{_hue};list-style:revert">Q: {_q}</summary>'
                    f'<div style="margin-top:10px;color:#334155">A: {_ans}</div>'
                    "</details>"
                )

        _parts.append("</div>")
        goal5_ai_layer = mo.md("".join(_parts))

    goal5_ai_layer

    return


@app.cell(hide_code=True)
def _(mo):
    mo.md("""
    ## Goal 6 — Polish & demo

    **Executive snapshot** at the end of the story: hero KPIs, a **segment recap strip** (emoji + colors aligned with `ai_insights.json` and your charts), a **highlighted takeaway**, and a **thank-you** card for the hackathon.
    """)
    return


@app.cell
def _(mo, rfm_segments):
    from json import loads
    from pathlib import Path as _GPath
    import html as html_g6


    def _insights_path_g6() -> _GPath:
        cwd = _GPath.cwd()
        for base in (cwd, cwd / "pydata-2026-submissions" / "vishalprasanna11"):
            p = base / "ai_insights.json"
            if p.is_file():
                return p
        return cwd / "ai_insights.json"


    _bg = _insights_path_g6()
    _doc = loads(_bg.read_text(encoding="utf-8")) if _bg.is_file() else {"segments": {}, "display_order": []}
    _meta = _doc.get("segments") or {}
    _order = list(_doc.get("display_order") or [])
    for _s in sorted(_meta.keys()):
        if _s not in _order:
            _order.append(_s)

    _total_cust = int(rfm_segments["CustomerID"].nunique())
    _total_rev = float(rfm_segments["monetary"].sum())
    _n_seg = int(rfm_segments["segment"].nunique())
    _vc = rfm_segments["segment"].value_counts()

    _parts: list[str] = []
    _parts.append(
        '<section style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;color:#0f172a">'
    )
    _parts.append(
        '<h3 style="margin:0 0 10px 0;font-size:1.05rem;color:#312e81">Executive snapshot</h3>'
    )
    _parts.append(
        '<div style="display:flex;gap:14px;flex-wrap:wrap;margin:4px 0 22px 0">'
    )
    _hero = [
        ("Total customers", f"{_total_cust:,}", "#312e81", "linear-gradient(135deg,#eef2ff,#e0e7ff)", "#c7d2fe"),
        ("Total revenue (GBP)", f"{_total_rev:,.0f}", "#312e81", "linear-gradient(135deg,#fdf4ff,#fce7f3)", "#f5d0fe"),
        ("Active segments", str(_n_seg), "#312e81", "linear-gradient(135deg,#ecfeff,#e0f2fe)", "#bae6fd"),
    ]
    for _lbl, _val, _tc, _grad, _bd in _hero:
        _parts.append(
            f'<div style="flex:1;min-width:170px;border-radius:16px;padding:18px 16px;border:1px solid {_bd};background:{_grad};box-shadow:0 8px 24px rgba(15,23,42,0.06)">'
            f'<div style="font-size:0.78rem;text-transform:uppercase;letter-spacing:0.04em;font-weight:800;color:#4338ca">{html_g6.escape(_lbl)}</div>'
            f'<div style="font-size:1.9rem;font-weight:900;color:{_tc};margin-top:6px">{html_g6.escape(_val)}</div>'
            "</div>"
        )
    _parts.append("</div>")

    _parts.append(
        '<h3 style="margin:8px 0 12px 0;font-size:1.05rem;color:#312e81">Segment recap — side by side</h3>'
    )
    _parts.append('<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:stretch">')
    for _name in _order:
        _row = _meta.get(_name)
        if not isinstance(_row, dict):
            _row = {}
        _icon = html_g6.escape(str(_row.get("icon", "📌")))
        _accent = html_g6.escape(str(_row.get("accent", "#64748b")))
        _bg = html_g6.escape(str(_row.get("background", "#f8fafc")))
        _cnt = int(_vc.loc[_name]) if _name in _vc.index else 0
        _nm = html_g6.escape(str(_name))
        _parts.append(
            f'<div style="flex:1 1 140px;min-width:118px;max-width:200px;border-radius:14px;padding:10px 10px 12px 10px;'
            f'border-left:5px solid {_accent};background:{_bg};text-align:center;box-shadow:0 1px 3px rgba(15,23,42,0.08)">'
            f'<div style="font-size:1.35rem">{_icon}</div>'
            f'<div style="font-weight:800;font-size:0.78rem;margin-top:4px;color:#0f172a;line-height:1.15">{_nm}</div>'
            f'<div style="margin-top:6px;font-size:1.15rem;font-weight:900;color:{_accent}">{_cnt:,}</div>'
            f'<div style="font-size:0.68rem;color:#64748b;text-transform:uppercase;letter-spacing:0.05em">customers</div>'
            "</div>"
        )
    _parts.append("</div></section>")

    _closing = (
        '<div style="margin-top:22px;text-align:center;padding:26px 20px;border-radius:18px;'
        "background:linear-gradient(120deg,#4f46e5,#7c3aeb,#db2777);color:white;"
        'box-shadow:0 14px 42px rgba(79,70,229,0.38);font-family:system-ui,sans-serif">'
        '<div style="font-size:0.85rem;opacity:0.92;font-weight:600;letter-spacing:0.06em">CURSOR BOSTON</div>'
        '<div style="font-size:1.45rem;font-weight:900;margin-top:8px;line-height:1.25">Thank you — Cursor Boston Hackathon 🎉</div>'
        '<div style="font-size:0.95rem;margin-top:10px;opacity:0.92">Built with marimo + offline insights</div>'
        "</div>"
    )

    _takeaway = mo.md(
        "**Where to focus:** Champions and Loyal customers usually anchor revenue and margin — protect them with recognition, not noise. **At Risk** and **Cannot Lose Them** need **surgical** win-backs (clear reason to return + tight deadlines), while **New**/**Promising** deserve crisp onboarding so they graduate into repeat buyers."
    )

    goal6_finale = mo.vstack(
        [
            mo.md("".join(_parts)),
            mo.callout(_takeaway, kind="success"),
            mo.md(_closing),
        ],
        gap=1,
    )
    goal6_finale

    return


if __name__ == "__main__":
    app.run()
