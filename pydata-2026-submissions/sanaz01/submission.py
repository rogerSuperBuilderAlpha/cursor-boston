# /// script
# dependencies = [
#     "anywidget==0.11.0",
#     "marimo",
#     "pandas==3.0.3",
#     "plotly==6.7.0",
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
    return


@app.cell(hide_code=True)
def _():
    __import__('marimo').md('## Employee Earnings Dataset Overview\n\nThis notebook summarizes Boston employee earnings data across **15 annual CSV files** spanning **2011 to 2025** (`employee-earnings-report-YYYY.csv`). Each file captures payroll outcomes for that calendar year, with records organized by employee name, department, title, earnings components, and postal code.\n\nUsing `payroll_categories.xlsx`, the core earnings buckets can be interpreted as:\n- **Regular**: base salary and related non-overtime earnings\n- **Retro**: retroactive adjustments\n- **Other**: bonuses, buybacks, stipends, reimbursements, and settlements\n- **Overtime**: overtime and overtime-related premiums\n- **Injured**: earnings related to injured leave\n- **Detail**: paid detail earnings\n- **Quinn / Education**: education incentive earnings (notably for police uniform roles)\n\nAcross the timeline, header labels change slightly (for example, `TOTAL EARNINGS` vs `TOTAL_GROSS`, and several `QUINN` naming variants), but the underlying payroll concepts stay consistent. This makes the dataset suitable for year-over-year comparisons of compensation patterns by department and role.\n')
    return


@app.cell(hide_code=True)
def _():
    __import__('marimo').md('## Population Distribution by Department, Title, and ZIP Code\n\nThe distributions below combine all available payroll records from **2011 through 2025**. Each bar represents the number of payroll rows associated with a category, so you can compare where records are concentrated across organizational units, job roles, and neighborhoods.\n\n- **Department view** highlights which city departments contain the largest share of payroll entries.\n- **Title view** shows how records are distributed across job classifications.\n- **ZIP Code view** reveals the geographic spread of employee residences.\n\nEach chart is interactive: **hover** to inspect exact counts and relative share.\n')
    return


@app.cell
def _():
    from pathlib import Path
    import re
    import pandas as pd
    import plotly.express as px

    def _read_yearly_csv(file_path: Path) -> pd.DataFrame:
        for enc in ("utf-8-sig", "cp1252", "latin-1"):
            try:
                return pd.read_csv(file_path, dtype=str, encoding=enc)
            except UnicodeDecodeError:
                continue
        return pd.read_csv(file_path, dtype=str, encoding="latin-1")

    def _canonical_column(col: str) -> str:
        c = re.sub(r"\s+", "_", str(col).strip().upper())
        c = c.replace("/", "_")
        c = re.sub(r"_+", "_", c)
        return c

    def _pick_column(columns: list[str], candidates: list[str]) -> str:
        for c in candidates:
            if c in columns:
                return c
        raise KeyError(f"Missing expected column. Looked for: {candidates}")

    all_frames = []
    for csv_file in sorted(Path("data").glob("employee-earnings-report-*.csv")):
        year_match = re.search(r"(\d{4})", csv_file.stem)
        if year_match is None:
            continue

        frame = _read_yearly_csv(csv_file)
        frame.columns = [_canonical_column(c) for c in frame.columns]

        dep_col = _pick_column(frame.columns.tolist(), ["DEPARTMENT_NAME", "DEPARTMENT"])
        title_col = _pick_column(frame.columns.tolist(), ["TITLE"])
        zip_col = _pick_column(frame.columns.tolist(), ["POSTAL", "ZIP", "ZIP_CODE"])

        normalized = pd.DataFrame(
            {
                "year": int(year_match.group(1)),
                "department": frame[dep_col],
                "title": frame[title_col],
                "zip_code": frame[zip_col],
            }
        )
        all_frames.append(normalized)

    population = pd.concat(all_frames, ignore_index=True)

    for col in ["department", "title", "zip_code"]:
        population[col] = (
            population[col]
            .fillna("Unknown")
            .astype(str)
            .str.strip()
            .replace({"": "Unknown"})
        )

    total_rows = len(population)

    def top_distribution(series: pd.Series, top_n: int = 25) -> pd.DataFrame:
        counts = series.value_counts(dropna=False).rename_axis("group").reset_index(name="count")
        top = counts.head(top_n).copy()
        top["share_pct"] = (top["count"] / total_rows * 100).round(2)
        return top.sort_values("count")

    department_dist = top_distribution(population["department"], top_n=25)
    title_dist = top_distribution(population["title"], top_n=25)
    zip_dist = top_distribution(population["zip_code"], top_n=25)

    fig_department = px.bar(
        department_dist,
        x="count",
        y="group",
        orientation="h",
        title="Top Departments by Payroll Record Count (2011-2025)",
        labels={"group": "Department", "count": "Payroll records"},
        hover_data={"share_pct": True, "count": True, "group": True},
    )
    fig_department.update_layout(height=700)

    fig_title = px.bar(
        title_dist,
        x="count",
        y="group",
        orientation="h",
        title="Top Titles by Payroll Record Count (2011-2025)",
        labels={"group": "Title", "count": "Payroll records"},
        hover_data={"share_pct": True, "count": True, "group": True},
    )
    fig_title.update_layout(height=700)

    fig_zip = px.bar(
        zip_dist,
        x="count",
        y="group",
        orientation="h",
        title="Top ZIP Codes by Payroll Record Count (2011-2025)",
        labels={"group": "ZIP code", "count": "Payroll records"},
        hover_data={"share_pct": True, "count": True, "group": True},
    )
    fig_zip.update_layout(height=700)

    fig_department, fig_title, fig_zip

    return


@app.cell(hide_code=True)
def _():
    __import__('marimo').md('## Massachusetts ZIP Map with Hover-Driven Earnings Breakdown\n\nThis interactive map is segmented by Massachusetts ZIP codes present in the payroll files. Use **zoom in/out** directly on the map to inspect specific areas.\n\nWhen you **mouse over a ZIP code**, the charts next to the map update to show:\n- Top 5 **Departments** by total earnings in that ZIP\n- Top 5 **Titles** by total earnings in that ZIP\n')
    return


@app.cell
def _():
    import pathlib as _pathlib
    import re as _re
    import json as _json
    import urllib.request as _urlreq
    import pandas as _pd
    import plotly.graph_objects as _go

    _zip_csv_files = sorted(_pathlib.Path("data").glob("employee-earnings-report-*.csv"))


    def _zip_read_csv(_p: _pathlib.Path) -> _pd.DataFrame:
        for _enc in ("utf-8-sig", "cp1252", "latin-1"):
            try:
                return _pd.read_csv(_p, dtype=str, encoding=_enc)
            except UnicodeDecodeError:
                continue
        return _pd.read_csv(_p, dtype=str, encoding="latin-1")


    def _zip_clean_col(_c: str) -> str:
        _x = _re.sub(r"\s+", "_", str(_c).strip().upper())
        _x = _x.replace("/", "_")
        _x = _re.sub(r"_+", "_", _x)
        return _x


    def _zip_pick_col(_cols: list[str], _candidates: list[str]) -> str:
        for _cand in _candidates:
            if _cand in _cols:
                return _cand
        raise KeyError(f"Missing expected column from {_candidates}")


    def _zip_to_float(_s: _pd.Series) -> _pd.Series:
        _x = _s.fillna("0").astype(str).str.strip()
        _x = _x.str.replace(r"[$,]", "", regex=True)
        _x = _x.str.replace(r"^\((.*)\)$", r"-\1", regex=True)
        return _pd.to_numeric(_x, errors="coerce").fillna(0.0)


    _zip_rows = []
    for _csv in _zip_csv_files:
        _df = _zip_read_csv(_csv)
        _df.columns = [_zip_clean_col(_c) for _c in _df.columns]

        _dep_col = _zip_pick_col(_df.columns.tolist(), ["DEPARTMENT_NAME", "DEPARTMENT"])
        _title_col = _zip_pick_col(_df.columns.tolist(), ["TITLE"])
        _zip_col = _zip_pick_col(_df.columns.tolist(), ["POSTAL", "ZIP", "ZIP_CODE"])
        _total_col = _zip_pick_col(_df.columns.tolist(), ["TOTAL_EARNINGS", "TOTAL_GROSS"])

        _tmp = _pd.DataFrame(
            {
                "department": _df[_dep_col].fillna("Unknown").astype(str).str.strip().replace({"": "Unknown"}),
                "title": _df[_title_col].fillna("Unknown").astype(str).str.strip().replace({"": "Unknown"}),
                "zip_code": _df[_zip_col].fillna("").astype(str).str.extract(r"(\d{5})", expand=False),
                "total_earnings": _zip_to_float(_df[_total_col]),
            }
        )
        _tmp = _tmp[_tmp["zip_code"].notna()].copy()
        _zip_rows.append(_tmp)

    _zip_data = _pd.concat(_zip_rows, ignore_index=True)

    _zip_geo_url = "https://raw.githubusercontent.com/OpenDataDE/State-zip-code-GeoJSON/master/ma_massachusetts_zip_codes_geo.min.json"
    with _urlreq.urlopen(_zip_geo_url) as _resp:
        _zip_geojson = _json.load(_resp)

    _zip_prop_candidates = ["ZCTA5CE10", "ZCTA5CE", "ZIP_CODE", "zip_code", "ZCTA5"]
    _zip_feature_props = _zip_geojson["features"][0].get("properties", {})
    _zip_prop_key = None
    for _k in _zip_prop_candidates:
        if _k in _zip_feature_props:
            _zip_prop_key = _k
            break
    if _zip_prop_key is None:
        _zip_prop_key = next(iter(_zip_feature_props.keys()))

    _zip_geo_zips = {
        str(_f.get("properties", {}).get(_zip_prop_key, "")).zfill(5)
        for _f in _zip_geojson["features"]
    }

    _zip_data = _zip_data[_zip_data["zip_code"].isin(_zip_geo_zips)].copy()

    _zip_zip_summary = (
        _zip_data.groupby("zip_code", as_index=False)
        .agg(total_earnings=("total_earnings", "sum"), payroll_rows=("zip_code", "size"))
        .sort_values("total_earnings", ascending=False)
    )

    _zip_map = _go.FigureWidget(
        _go.Choroplethmapbox(
            geojson=_zip_geojson,
            locations=_zip_zip_summary["zip_code"],
            z=_zip_zip_summary["total_earnings"],
            featureidkey=f"properties.{_zip_prop_key}",
            colorscale="YlGnBu",
            marker_opacity=0.7,
            marker_line_width=0.4,
            customdata=_zip_zip_summary[["payroll_rows"]].to_numpy(),
            hovertemplate="ZIP %{location}<br>Total earnings: $%{z:,.0f}<br>Payroll rows: %{customdata[0]:,}<extra></extra>",
            colorbar={"title": "Total earnings ($)"},
        )
    )

    _zip_map.update_layout(
        title="Massachusetts Payroll Total Earnings by ZIP Code (2011-2025)",
        mapbox={"style": "carto-positron", "center": {"lat": 42.25, "lon": -71.8}, "zoom": 6.6},
        margin={"l": 0, "r": 0, "t": 50, "b": 0},
        height=700,
    )

    _zip_dept = _go.FigureWidget(_go.Bar(x=[], y=[], orientation="h"))
    _zip_title = _go.FigureWidget(_go.Bar(x=[], y=[], orientation="h"))


    def _zip_top_five(_zip_value: str):
        _d = (
            _zip_data[_zip_data["zip_code"] == _zip_value]
            .groupby("department", as_index=False)["total_earnings"]
            .sum()
            .sort_values("total_earnings", ascending=False)
            .head(5)
            .sort_values("total_earnings", ascending=True)
        )
        _t = (
            _zip_data[_zip_data["zip_code"] == _zip_value]
            .groupby("title", as_index=False)["total_earnings"]
            .sum()
            .sort_values("total_earnings", ascending=False)
            .head(5)
            .sort_values("total_earnings", ascending=True)
        )
        return _d, _t


    def _zip_update_bars(_zip_value: str):
        _d, _t = _zip_top_five(_zip_value)

        with _zip_dept.batch_update():
            _zip_dept.data[0].x = _d["total_earnings"]
            _zip_dept.data[0].y = _d["department"]
            _zip_dept.data[0].hovertemplate = "Department: %{y}<br>Total earnings: $%{x:,.0f}<extra></extra>"
            _zip_dept.layout.title = f"Top 5 Departments in ZIP {_zip_value}"
            _zip_dept.layout.height = 330
            _zip_dept.layout.margin = {"l": 10, "r": 10, "t": 45, "b": 20}
            _zip_dept.layout.xaxis.title = "Total earnings ($)"

        with _zip_title.batch_update():
            _zip_title.data[0].x = _t["total_earnings"]
            _zip_title.data[0].y = _t["title"]
            _zip_title.data[0].hovertemplate = "Title: %{y}<br>Total earnings: $%{x:,.0f}<extra></extra>"
            _zip_title.layout.title = f"Top 5 Titles in ZIP {_zip_value}"
            _zip_title.layout.height = 330
            _zip_title.layout.margin = {"l": 10, "r": 10, "t": 45, "b": 20}
            _zip_title.layout.xaxis.title = "Total earnings ($)"


    _zip_default = _zip_zip_summary.iloc[0]["zip_code"]
    _zip_update_bars(_zip_default)


    def _zip_on_hover(_trace, _points, _state):
        if _points.point_inds:
            _idx = _points.point_inds[0]
            _hover_zip = _zip_zip_summary.iloc[_idx]["zip_code"]
            _zip_update_bars(_hover_zip)


    _zip_map.data[0].on_hover(_zip_on_hover)

    _mo_zip = __import__("marimo")
    _mo_zip.hstack([_zip_map, _mo_zip.vstack([_zip_dept, _zip_title])], widths=[0.62, 0.38])

    return


@app.cell(hide_code=True)
def _():
    __import__('marimo').md('## Interactive Title Filter: ZIP Heatmap of Normalized Earnings\n\nUse the dropdown to select a **Title**. The map updates to show a ZIP-level heatmap of **normalized total earnings**, defined as:\n\n**sum(total earnings in ZIP for selected title) / number of individuals in that ZIP for selected title**.\n\nThis lets you compare average earnings intensity for the selected role across Massachusetts ZIP codes.\n')
    return


@app.cell
def _():
    import pathlib as _p
    import re as _re
    import json as _json
    import urllib.request as _urlreq
    import pandas as _pd

    _role_csvs = sorted(_p.Path("data").glob("employee-earnings-report-*.csv"))


    def _role_read_csv(_path: _p.Path) -> _pd.DataFrame:
        for _enc in ("utf-8-sig", "cp1252", "latin-1"):
            try:
                return _pd.read_csv(_path, dtype=str, encoding=_enc)
            except UnicodeDecodeError:
                continue
        return _pd.read_csv(_path, dtype=str, encoding="latin-1")


    def _role_clean_col(_name: str) -> str:
        _x = _re.sub(r"\s+", "_", str(_name).strip().upper())
        _x = _x.replace("/", "_")
        _x = _re.sub(r"_+", "_", _x)
        return _x


    def _role_pick_col(_cols: list[str], _cands: list[str]) -> str:
        for _c in _cands:
            if _c in _cols:
                return _c
        raise KeyError(f"Missing expected columns from {_cands}")


    def _role_to_num(_s: _pd.Series) -> _pd.Series:
        _x = _s.fillna("0").astype(str).str.strip()
        _x = _x.str.replace(r"[$,]", "", regex=True)
        _x = _x.str.replace(r"^\((.*)\)$", r"-\1", regex=True)
        return _pd.to_numeric(_x, errors="coerce").fillna(0.0)


    def _role_clean_text(_s: _pd.Series) -> _pd.Series:
        return _s.fillna("Unknown").astype(str).str.strip().replace({"": "Unknown"})


    def _role_clean_zip(_s: _pd.Series) -> _pd.Series:
        return _s.fillna("").astype(str).str.extract(r"(\d{5})", expand=False)


    _role_rows = []
    for _csv in _role_csvs:
        _df = _role_read_csv(_csv)
        _df.columns = [_role_clean_col(_c) for _c in _df.columns]

        _title_col = _role_pick_col(_df.columns.tolist(), ["TITLE"])
        _zip_col = _role_pick_col(_df.columns.tolist(), ["POSTAL", "ZIP", "ZIP_CODE"])
        _tot_col = _role_pick_col(_df.columns.tolist(), ["TOTAL_EARNINGS", "TOTAL_GROSS"])
        _name_col = _role_pick_col(_df.columns.tolist(), ["NAME"])

        _part = _pd.DataFrame(
            {
                "title": _role_clean_text(_df[_title_col]),
                "zip_code": _role_clean_zip(_df[_zip_col]),
                "total_earnings": _role_to_num(_df[_tot_col]),
                "name": _role_clean_text(_df[_name_col]),
            }
        )
        _part = _part[_part["zip_code"].notna()].copy()
        _role_rows.append(_part)

    role_data = _pd.concat(_role_rows, ignore_index=True)

    _role_geo_url = "https://raw.githubusercontent.com/OpenDataDE/State-zip-code-GeoJSON/master/ma_massachusetts_zip_codes_geo.min.json"
    with _urlreq.urlopen(_role_geo_url) as _resp:
        role_geojson = _json.load(_resp)

    _role_prop_keys = ["ZCTA5CE10", "ZCTA5CE", "ZIP_CODE", "zip_code", "ZCTA5"]
    _role_props = role_geojson["features"][0].get("properties", {})
    role_prop_key = next((k for k in _role_prop_keys if k in _role_props), next(iter(_role_props.keys())))

    _role_geo_zips = {
        str(_f.get("properties", {}).get(role_prop_key, "")).zfill(5)
        for _f in role_geojson["features"]
    }
    role_data = role_data[role_data["zip_code"].isin(_role_geo_zips)].copy()

    _role_title_counts = role_data["title"].value_counts()
    role_options = sorted(_role_title_counts[_role_title_counts >= 100].index.tolist())
    if not role_options:
        role_options = sorted(role_data["title"].unique().tolist())

    role_default = role_options[0]
    role_dropdown = __import__("marimo").ui.dropdown(options=role_options, value=role_default, label="Select title")


    def role_zip_summary(_title: str) -> _pd.DataFrame:
        _flt = role_data[role_data["title"] == _title].copy()
        if _flt.empty:
            return _pd.DataFrame(columns=["zip_code", "total_earnings", "individual_count", "normalized_earnings"])

        _grp = (
            _flt.groupby("zip_code", as_index=False)
            .agg(
                total_earnings=("total_earnings", "sum"),
                individual_count=("name", "nunique"),
            )
        )
        _grp = _grp[_grp["individual_count"] > 0].copy()
        _grp["normalized_earnings"] = _grp["total_earnings"] / _grp["individual_count"]
        return _grp

    __import__("marimo").vstack([
        __import__("marimo").md("Use the dropdown to change title. The map in the next cell updates automatically."),
        role_dropdown,
    ])

    return role_dropdown, role_geojson, role_prop_key, role_zip_summary


@app.cell
def _(role_dropdown, role_geojson, role_prop_key, role_zip_summary):
    import plotly.express as _px

    role_selected = role_dropdown.value
    role_zip = role_zip_summary(role_selected)

    role_fig = _px.choropleth_mapbox(
        role_zip,
        geojson=role_geojson,
        locations="zip_code",
        featureidkey=f"properties.{role_prop_key}",
        color="normalized_earnings",
        color_continuous_scale="YlOrRd",
        mapbox_style="carto-positron",
        zoom=6.6,
        center={"lat": 42.25, "lon": -71.8},
        opacity=0.72,
        hover_data={
            "zip_code": True,
            "total_earnings": ":,.0f",
            "individual_count": True,
            "normalized_earnings": ":,.0f",
        },
        labels={
            "zip_code": "ZIP",
            "total_earnings": "Total earnings ($)",
            "individual_count": "Individuals",
            "normalized_earnings": "Normalized earnings per individual ($)",
        },
        title=f"Massachusetts ZIP Heatmap for Title: {role_selected}",
    )
    role_fig.update_layout(height=760, margin={"l": 0, "r": 0, "t": 55, "b": 0})
    role_fig

    return


@app.cell(hide_code=True)
def _():
    __import__('marimo').md('## Best and Worst Title Earnings Progression (2011-2025)\n\nThis view highlights titles with the strongest and weakest long-term earnings progression across the dataset.\n\nMethod used:\n- Compute yearly **average total earnings per Title**.\n- Keep titles with enough observations in both endpoint years (2011 and 2025).\n- Measure progression using endpoint growth and CAGR from 2011 to 2025.\n\nThe result pairs a diverging leaderboard (best vs worst CAGR) with time-series trends so you can inspect whether growth was steady, volatile, or late-cycle.\n')
    return


@app.cell
def _():
    from pathlib import Path as _tp_Path
    import re as _tp_re
    import pandas as _tp_pd
    import plotly.express as _tp_px


    def _tp2_read_csv(file_path: _tp_Path) -> _tp_pd.DataFrame:
        for enc in ("utf-8-sig", "cp1252", "latin-1"):
            try:
                return _tp_pd.read_csv(file_path, dtype=str, encoding=enc)
            except UnicodeDecodeError:
                continue
        return _tp_pd.read_csv(file_path, dtype=str, encoding="latin-1")


    def _tp2_norm_col(col: str) -> str:
        c = _tp_re.sub(r"\s+", "_", str(col).strip().upper())
        c = c.replace("/", "_")
        c = _tp_re.sub(r"_+", "_", c)
        return c


    def _tp2_pick_col(columns: list[str], candidates: list[str]) -> str:
        for cand in candidates:
            if cand in columns:
                return cand
        raise KeyError(f"Missing expected column; looked for {candidates}")


    def _tp2_to_num(series: _tp_pd.Series) -> _tp_pd.Series:
        s = series.fillna("0").astype(str).str.strip()
        s = s.str.replace(r"[$,]", "", regex=True)
        s = s.str.replace(r"^\((.*)\)$", r"-\1", regex=True)
        return _tp_pd.to_numeric(s, errors="coerce").fillna(0.0)


    _tp2_records = []
    for _tp2_csv_path in sorted(_tp_Path("data").glob("employee-earnings-report-*.csv")):
        _tp2_m = _tp_re.search(r"(\d{4})", _tp2_csv_path.stem)
        if not _tp2_m:
            continue
        _tp2_year = int(_tp2_m.group(1))

        _tp2_df = _tp2_read_csv(_tp2_csv_path)
        _tp2_df.columns = [_tp2_norm_col(c) for c in _tp2_df.columns]

        _tp2_title_col = _tp2_pick_col(_tp2_df.columns.tolist(), ["TITLE"])
        _tp2_total_col = _tp2_pick_col(_tp2_df.columns.tolist(), ["TOTAL_EARNINGS", "TOTAL_GROSS"])

        _tp2_part = _tp_pd.DataFrame(
            {
                "year": _tp2_year,
                "title": _tp2_df[_tp2_title_col].fillna("Unknown").astype(str).str.strip().replace({"": "Unknown"}),
                "total_earnings": _tp2_to_num(_tp2_df[_tp2_total_col]),
            }
        )
        _tp2_records.append(_tp2_part)

    _tp2_full = _tp_pd.concat(_tp2_records, ignore_index=True)

    _tp2_annual = (
        _tp2_full.groupby(["year", "title"], as_index=False)
        .agg(
            avg_earnings=("total_earnings", "mean"),
            employee_rows=("title", "size"),
            total_earnings=("total_earnings", "sum"),
        )
    )

    _tp2_start_year, _tp2_end_year = 2011, 2025
    _tp2_min_rows = 20

    _tp2_start = _tp2_annual[
        (_tp2_annual["year"] == _tp2_start_year) & (_tp2_annual["employee_rows"] >= _tp2_min_rows)
    ][["title", "avg_earnings", "employee_rows"]].rename(columns={"avg_earnings": "avg_start", "employee_rows": "rows_start"})

    _tp2_end = _tp2_annual[
        (_tp2_annual["year"] == _tp2_end_year) & (_tp2_annual["employee_rows"] >= _tp2_min_rows)
    ][["title", "avg_earnings", "employee_rows"]].rename(columns={"avg_earnings": "avg_end", "employee_rows": "rows_end"})

    _tp2_progress = _tp2_start.merge(_tp2_end, on="title", how="inner")
    _tp2_progress = _tp2_progress[_tp2_progress["avg_start"] > 0].copy()
    _tp2_progress["growth_pct"] = (_tp2_progress["avg_end"] / _tp2_progress["avg_start"] - 1.0) * 100.0
    _tp2_progress["cagr_pct"] = ((_tp2_progress["avg_end"] / _tp2_progress["avg_start"]) ** (1 / (_tp2_end_year - _tp2_start_year)) - 1.0) * 100.0
    _tp2_progress["direction"] = _tp2_progress["cagr_pct"].map(lambda x: "Best progression" if x >= 0 else "Worst progression")

    _tp2_best_n, _tp2_worst_n = 8, 8
    _tp2_best = _tp2_progress.sort_values("cagr_pct", ascending=False).head(_tp2_best_n)
    _tp2_worst = _tp2_progress.sort_values("cagr_pct", ascending=True).head(_tp2_worst_n)
    _tp2_leaders = _tp_pd.concat([_tp2_best, _tp2_worst], ignore_index=True).sort_values("cagr_pct", ascending=True)

    _tp2_bar = _tp_px.bar(
        _tp2_leaders,
        x="cagr_pct",
        y="title",
        color="direction",
        orientation="h",
        color_discrete_map={"Best progression": "#1f77b4", "Worst progression": "#d62728"},
        hover_data={
            "avg_start": ":,.0f",
            "avg_end": ":,.0f",
            "growth_pct": ":.1f",
            "cagr_pct": ":.2f",
            "rows_start": True,
            "rows_end": True,
        },
        labels={
            "cagr_pct": "CAGR of average earnings (%)",
            "title": "Title",
            "avg_start": f"Avg earnings {_tp2_start_year}",
            "avg_end": f"Avg earnings {_tp2_end_year}",
            "growth_pct": f"Growth {_tp2_start_year}-{_tp2_end_year} (%)",
            "rows_start": f"Rows {_tp2_start_year}",
            "rows_end": f"Rows {_tp2_end_year}",
        },
        title=f"Title Earnings Progression Leaderboard ({_tp2_start_year} to {_tp2_end_year})",
    )
    _tp2_bar.add_vline(x=0, line_dash="dash", line_color="gray")
    _tp2_bar.update_layout(height=700, legend_title_text="")

    _tp2_selected_titles = _tp2_leaders["title"].tolist()
    _tp2_trend = _tp2_annual[_tp2_annual["title"].isin(_tp2_selected_titles)].copy()
    _tp2_best_set = set(_tp2_best["title"])
    _tp2_trend["group"] = _tp2_trend["title"].map(lambda t: "Best progression" if t in _tp2_best_set else "Worst progression")

    _tp2_line = _tp_px.line(
        _tp2_trend.sort_values(["title", "year"]),
        x="year",
        y="avg_earnings",
        color="title",
        line_dash="group",
        hover_data={"employee_rows": True, "total_earnings": ":,.0f", "avg_earnings": ":,.0f"},
        labels={
            "year": "Year",
            "avg_earnings": "Average total earnings ($)",
            "employee_rows": "Payroll rows",
            "total_earnings": "Aggregate total earnings ($)",
        },
        title="How Those Titles Evolved Year by Year",
    )
    _tp2_line.update_layout(height=700)

    __import__('marimo').vstack([
        __import__('marimo').md(
            f"Showing **{_tp2_best_n} best** and **{_tp2_worst_n} worst** titles by CAGR of average earnings, "
            f"with a minimum of **{_tp2_min_rows} payroll rows** in both {_tp2_start_year} and {_tp2_end_year}."
        ),
        _tp2_bar,
        _tp2_line,
    ])

    return


if __name__ == "__main__":
    app.run()
