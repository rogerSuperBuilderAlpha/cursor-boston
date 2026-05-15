# /// script
# requires-python = ">=3.11"
# dependencies = [
#   "marimo>=0.17.0",
#   "duckdb>=1.5.2",
#   "pandas>=2.2.0",
#   "numpy>=2.0.0",
#   "altair>=5.4.0",
#   "mosaic-widget>=0.4.0",
#   "pyarrow>=16.0.0",
#   "requests>=2.32.0",
#   "psutil>=6.0.0",
# ]
# ///

import marimo

__generated_with = "0.23.6"
app = marimo.App(width="full")


@app.cell
def _():
    import marimo as mo

    return (mo,)


@app.cell(hide_code=True)
def _(mo):
    mo.md(r"""
    # One BIG Idea: explore GTEx without moving the matrix

    **One biological question:** which non-liver tissues look most
    transcriptionally similar to liver in GTEx, and which marker genes make that
    similarity convincing or misleading?

    **One systems question:** can a Marimo notebook act as the narrative shell while
    Mosaic supplies linked views and DuckDB's new Quack protocol keeps the GTEx
    warehouse remote, query-driven, and thin-client?

    **The big idea:** Quack lets us explore a large biological corpus without
    shuffling the expression matrix through notebook memory or browser tables.
    That matters more as the corpus gets larger: the notebook stays lightweight
    while DuckDB keeps the heavy data and aggregation work close to the source.

    The [Quack protocol](https://github.com/duckdb/duckdb-quack) turns DuckDB
    into a client/server system, so one DuckDB instance can serve another over
    the network instead of forcing every client to load the same data locally.
    I've wanted to test how that protocol performs when paired with
    **Mosaic**-linked visualizations inside **Marimo**, where the frontend stays
    narrative and reactive while DuckDB does the heavy query work.
    """)
    return


@app.cell
def _():
    import json
    import math
    import os
    import platform
    import secrets
    import socket
    import subprocess
    import sys
    import textwrap
    import time
    import urllib.request
    from dataclasses import dataclass
    from pathlib import Path

    import altair as alt
    import duckdb
    import numpy as np
    import pandas as pd

    try:
        from mosaic_widget import MosaicWidget
    except Exception as exc:  # surfaced in the UI below
        MosaicWidget = None
        MOSAIC_IMPORT_ERROR = exc
    else:
        MOSAIC_IMPORT_ERROR = None
    return (
        MOSAIC_IMPORT_ERROR,
        MosaicWidget,
        Path,
        alt,
        dataclass,
        duckdb,
        json,
        pd,
        secrets,
        socket,
        subprocess,
        sys,
        time,
        urllib,
    )


@app.cell
def _(Path):
    CACHE_DIR = Path.home() / ".cache" / "pydata-2026-quack-gtex"
    CACHE_DIR.mkdir(parents=True, exist_ok=True)

    GTEX_MEDIAN_TPM_URL = (
        "https://storage.googleapis.com/adult-gtex/bulk-gex/v10/rna-seq/"
        "GTEx_Analysis_v10_RNASeQCv2.4.2_gene_median_tpm.gct.gz"
    )
    GTEX_METADATA_API = (
        "https://gtexportal.org/api/v2/dataset/openAccessFilesMetadata"
        "?project_id=adult-gtex"
    )
    GTEX_DATASET_API = "https://gtexportal.org/api/v2/metadata/dataset"
    GTEX_MEDIAN_FILE = CACHE_DIR / "GTEx_Analysis_v10_gene_median_tpm.gct.gz"
    GTEX_DB = CACHE_DIR / "gtex_tissue_atlas.duckdb"

    LIVER_MARKER_PANEL = [
        "ALB",
        "APOB",
        "PCSK9",
        "F9",
        "TTR",
        "CYP3A4",
        "SERPINA1",
        "APOA1",
    ]

    PROJECT_LINKS = {
        "GTEx portal": "https://gtexportal.org/home/datasets",
        "DuckDB Quack docs": "https://duckdb.org/docs/current/quack/overview.html",
        "duckdb-quack source": "https://github.com/duckdb/duckdb-quack",
        "Mosaic source": "https://github.com/uwdata/mosaic",
        "Mosaic docs": "https://idl.uw.edu/mosaic/",
        "marimo wide dataframe issue": "https://github.com/marimo-team/marimo/issues/2991",
        "marimo large preview issue": "https://github.com/marimo-team/marimo/issues/2269",
    }
    return (
        GTEX_DATASET_API,
        GTEX_DB,
        GTEX_MEDIAN_FILE,
        GTEX_MEDIAN_TPM_URL,
        PROJECT_LINKS,
    )


@app.cell
def _(Path, duckdb, json, pd, time, urllib):
    BUILD_VERSION = 4

    def download_if_missing(url: str, dest: Path) -> Path:
        if dest.exists() and dest.stat().st_size > 0:
            return dest
        tmp = dest.with_suffix(dest.suffix + ".tmp")
        with urllib.request.urlopen(url, timeout=90) as response:
            with tmp.open("wb") as handle:
                handle.write(response.read())
        tmp.replace(dest)
        return dest

    def gtex_context(dataset_api_url: str) -> dict:
        try:
            with urllib.request.urlopen(dataset_api_url, timeout=30) as response:
                datasets = json.loads(response.read().decode("utf-8"))
        except Exception:
            return {}
        for item in datasets:
            if item.get("datasetId") == "gtex_v10":
                return item
        return {}

    def database_ready(db_path: Path) -> bool:
        if not db_path.exists():
            return False
        try:
            con = duckdb.connect(str(db_path), read_only=True)
            version = con.execute(
                "SELECT value::INTEGER FROM build_info WHERE key = 'version'"
            ).fetchone()[0]
            required = {
                "tissue_gene_median",
                "variable_genes",
                "tissue_similarity",
                "liver_neighbors",
                "liver_vs_tissue_markers",
                "marker_panel",
            }
            tables = {
                row[0]
                for row in con.execute(
                    "SELECT table_name FROM information_schema.tables"
                ).fetchall()
            }
            con.close()
            return version == BUILD_VERSION and required.issubset(tables)
        except Exception:
            return False

    def build_database(db_path: Path, gct_path: Path) -> dict:
        if database_ready(db_path):
            con = duckdb.connect(str(db_path), read_only=True)
            info = dict(con.execute("SELECT key, value FROM build_info").fetchall())
            con.close()
            return info

        started = time.perf_counter()
        wide = pd.read_csv(gct_path, sep="\t", skiprows=2)
        wide = wide.rename(columns={"Name": "gene_id", "Description": "gene_symbol"})
        tissue_cols = [c for c in wide.columns if c not in {"gene_id", "gene_symbol"}]
        liver_tissue = next((t for t in tissue_cols if t.lower() == "liver"), None)
        if liver_tissue is None:
            liver_tissue = next(t for t in tissue_cols if "liver" in t.lower())

        long = wide.melt(
            id_vars=["gene_id", "gene_symbol"],
            value_vars=tissue_cols,
            var_name="tissue",
            value_name="median_tpm",
        )
        long["median_tpm"] = pd.to_numeric(long["median_tpm"], errors="coerce")
        long = long.dropna(subset=["median_tpm"])

        con = duckdb.connect(str(db_path))
        for table_name in [
            "build_info",
            "marker_panel",
            "liver_vs_tissue_markers",
            "liver_neighbors",
            "tissue_similarity",
            "variable_genes",
            "tissue_gene_median",
        ]:
            con.execute(f"DROP TABLE IF EXISTS {table_name}")
        con.register("median_long_df", long)
        con.execute(
            """
            CREATE TABLE tissue_gene_median AS
            SELECT
                regexp_replace(gene_id, '\\.[0-9]+$', '') AS gene_id,
                NULLIF(gene_symbol, '?') AS gene_symbol,
                tissue,
                median_tpm::DOUBLE AS median_tpm,
                log10(median_tpm::DOUBLE + 0.1) AS log_tpm
            FROM median_long_df
            WHERE median_tpm IS NOT NULL
            """
        )
        con.execute(
            """
            CREATE TABLE variable_genes AS
            SELECT
                gene_id,
                any_value(gene_symbol) AS gene_symbol,
                stddev_pop(log_tpm) AS tissue_variability,
                max(median_tpm) AS max_tpm,
                avg(median_tpm) AS mean_tpm
            FROM tissue_gene_median
            GROUP BY gene_id
            HAVING max(median_tpm) >= 1
            ORDER BY tissue_variability DESC
            LIMIT 5000
            """
        )
        con.execute(
            """
            CREATE TABLE tissue_similarity AS
            SELECT
                a.tissue AS tissue_a,
                b.tissue AS tissue_b,
                corr(a.log_tpm, b.log_tpm) AS pearson,
                count(*) AS gene_count
            FROM tissue_gene_median a
            JOIN tissue_gene_median b USING (gene_id)
            JOIN variable_genes v USING (gene_id)
            GROUP BY a.tissue, b.tissue
            """
        )
        con.execute(
            """
            CREATE TABLE liver_neighbors AS
            SELECT
                tissue_b AS tissue,
                pearson,
                gene_count,
                row_number() OVER (ORDER BY pearson DESC) AS rank
            FROM tissue_similarity
            WHERE tissue_a = ?
              AND tissue_b <> ?
              AND lower(tissue_b) NOT LIKE '%liver%'
            ORDER BY pearson DESC
            """,
            [liver_tissue, liver_tissue],
        )
        con.execute(
            """
            CREATE TABLE liver_vs_tissue_markers AS
            WITH liver AS (
                SELECT gene_id, gene_symbol, median_tpm AS liver_tpm, log_tpm AS liver_log_tpm
                FROM tissue_gene_median
                WHERE tissue = ?
            ),
            scored AS (
                SELECT
                    m.tissue,
                    coalesce(m.gene_symbol, l.gene_symbol, m.gene_id) AS gene,
                    m.gene_id,
                    l.liver_tpm,
                    m.median_tpm AS tissue_tpm,
                    l.liver_log_tpm - m.log_tpm AS liver_minus_tissue_log10,
                    abs(l.liver_log_tpm - m.log_tpm) AS abs_log10_gap,
                    v.tissue_variability
                FROM tissue_gene_median m
                JOIN liver l USING (gene_id)
                JOIN variable_genes v USING (gene_id)
                WHERE m.tissue <> ?
            )
            SELECT *
            FROM scored
            QUALIFY row_number() OVER (
                PARTITION BY tissue ORDER BY abs_log10_gap DESC, tissue_variability DESC
            ) <= 75
            """,
            [liver_tissue, liver_tissue],
        )
        con.execute(
            """
            CREATE TABLE marker_panel AS
            SELECT
                tissue,
                upper(gene_symbol) AS gene,
                median_tpm,
                log_tpm
            FROM tissue_gene_median
            WHERE upper(gene_symbol) IN (
                'ALB', 'APOB', 'PCSK9', 'F9', 'TTR', 'CYP3A4', 'SERPINA1', 'APOA1'
            )
            """
        )
        row_counts = dict(
            con.execute(
                """
                SELECT 'tissue_gene_median', count(*) FROM tissue_gene_median
                UNION ALL SELECT 'variable_genes', count(*) FROM variable_genes
                UNION ALL SELECT 'tissue_similarity', count(*) FROM tissue_similarity
                UNION ALL SELECT 'liver_neighbors', count(*) FROM liver_neighbors
                UNION ALL SELECT 'liver_vs_tissue_markers', count(*) FROM liver_vs_tissue_markers
                """
            ).fetchall()
        )
        con.execute("CREATE TABLE build_info (key VARCHAR, value VARCHAR)")
        con.executemany(
            "INSERT INTO build_info VALUES (?, ?)",
            [
                ("version", str(BUILD_VERSION)),
                ("source", str(gct_path)),
                ("liver_tissue", liver_tissue),
                ("tissue_count", str(len(tissue_cols))),
                ("gene_count", str(wide.shape[0])),
                ("elapsed_seconds", f"{time.perf_counter() - started:.2f}"),
                ("row_counts", json.dumps(row_counts)),
            ],
        )
        con.close()
        return {
            "version": str(BUILD_VERSION),
            "source": str(gct_path),
            "liver_tissue": liver_tissue,
            "tissue_count": str(len(tissue_cols)),
            "gene_count": str(wide.shape[0]),
            "elapsed_seconds": f"{time.perf_counter() - started:.2f}",
            "row_counts": json.dumps(row_counts),
        }

    return build_database, download_if_missing, gtex_context


@app.cell
def _(
    GTEX_DATASET_API,
    GTEX_DB,
    GTEX_MEDIAN_FILE,
    GTEX_MEDIAN_TPM_URL,
    build_database,
    download_if_missing,
    gtex_context,
):
    gtex_info = gtex_context(GTEX_DATASET_API)
    median_file = download_if_missing(GTEX_MEDIAN_TPM_URL, GTEX_MEDIAN_FILE)
    build_info = build_database(GTEX_DB, median_file)
    return build_info, gtex_info, median_file


@app.cell
def _(dataclass, duckdb, secrets, socket):
    @dataclass
    class QuackRuntime:
        server: object
        client: object
        uri: str
        token: str
        smoke_rows: int
        duckdb_version: str

    def sql_literal(value: str) -> str:
        return "'" + value.replace("'", "''") + "'"

    def free_port() -> int:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            sock.bind(("127.0.0.1", 0))
            return sock.getsockname()[1]

    def start_quack(db_path) -> QuackRuntime:
        uri = f"quack:localhost:{free_port()}"
        token = "pydata-" + secrets.token_hex(12)
        server = duckdb.connect(str(db_path))
        client = duckdb.connect()
        for con in (server, client):
            con.execute("INSTALL quack FROM core_nightly")
            con.execute("LOAD quack")
        server.execute(
            f"CALL quack_serve({sql_literal(uri)}, token = {sql_literal(token)})"
        )
        client.execute(
            "CREATE SECRET ("
            "TYPE quack, "
            f"TOKEN {sql_literal(token)}, "
            f"SCOPE {sql_literal(uri)}"
            ")"
        )
        client.execute(f"ATTACH {sql_literal(uri)} AS remote (TYPE quack)")
        smoke_rows = client.execute(
            "SELECT count(*) FROM remote.tissue_gene_median"
        ).fetchone()[0]
        client.execute(
            "CREATE OR REPLACE VIEW liver_neighbors AS "
            "SELECT * FROM remote.liver_neighbors"
        )
        client.execute(
            "CREATE OR REPLACE VIEW marker_panel AS "
            "SELECT * FROM remote.marker_panel"
        )
        client.execute(
            "CREATE OR REPLACE VIEW liver_vs_tissue_markers AS "
            "SELECT * FROM remote.liver_vs_tissue_markers"
        )
        version = client.execute("SELECT version()").fetchone()[0]
        return QuackRuntime(server, client, uri, token, smoke_rows, version)

    return (start_quack,)


@app.cell
def _(GTEX_DB, start_quack):
    quack = start_quack(GTEX_DB)
    return (quack,)


@app.cell(hide_code=True)
def _(build_info, gtex_info, mo, quack):
    tissue_count = build_info.get("tissue_count", "?")
    gene_count = build_info.get("gene_count", "?")
    sample_count = gtex_info.get("rnaSeqSampleCount", "unknown")
    subject_count = gtex_info.get("subjectCount", "unknown")
    mo.md(
        f"""
        ## Data and runtime preflight

        - Dataset: GTEx Analysis v10 median gene TPM table.
        - Context from GTEx metadata API: {sample_count} RNA-seq samples,
          {subject_count} subjects, {tissue_count} tissues.
        - Local atlas cache: {gene_count} genes x {tissue_count} tissues.
        - Required Quack path: `{quack.uri}` served {quack.smoke_rows:,} rows
          to a separate DuckDB client.
        - DuckDB client version: `{quack.duckdb_version}`.

        If this cell runs, the notebook is not using a silent local fallback:
        the dashboard queries below go through the Quack-backed client.
        """
    )
    return


@app.cell
def _(quack):
    neighbors_df = quack.client.execute(
        """
        SELECT rank, tissue, pearson, gene_count
        FROM liver_neighbors
        ORDER BY rank
        """
    ).fetchdf()
    marker_panel_df = quack.client.execute(
        """
        SELECT tissue, gene, median_tpm
        FROM marker_panel
        ORDER BY gene, median_tpm DESC
        """
    ).fetchdf()
    top_neighbor = neighbors_df.iloc[0].to_dict()
    tissue_options = neighbors_df["tissue"].tolist()
    return neighbors_df, tissue_options, top_neighbor


@app.cell(hide_code=True)
def _(mo, top_neighbor):
    mo.md(
        f"""
        ## Finding

        Among GTEx v10 tissue-level expression profiles, **{top_neighbor["tissue"]}**
        is the closest non-liver neighbor to liver across the 5,000 most
        tissue-variable expressed genes (Pearson r = {top_neighbor["pearson"]:.3f}).

        The biological point is not that expression similarity proves delivery
        feasibility. It is a hypothesis-generation lens: if a tissue looks
        liver-like globally, the next question is which marker genes support
        that similarity and which genes reveal a tissue-specific gap.
        """
    )
    return


@app.cell
def _(mo, tissue_options):
    selected_tissue = mo.ui.dropdown(
        options=tissue_options,
        value=tissue_options[0],
        label="Compare liver against tissue",
    )
    top_n = mo.ui.slider(5, 40, value=15, step=5, label="marker genes to show")
    mo.hstack([selected_tissue, top_n], justify="start")
    return selected_tissue, top_n


@app.cell
def _(alt, neighbors_df):
    neighbor_chart = (
        alt.Chart(neighbors_df.head(20))
        .mark_bar()
        .encode(
            x=alt.X("pearson:Q", title="correlation to liver"),
            y=alt.Y("tissue:N", sort="-x", title=None),
            color=alt.Color("pearson:Q", scale=alt.Scale(scheme="viridis")),
            tooltip=["rank:Q", "tissue:N", alt.Tooltip("pearson:Q", format=".3f")],
        )
        .properties(
            title="Nearest non-liver GTEx tissue profiles",
            width=720,
            height=420,
        )
    )
    neighbor_chart
    return


@app.cell
def _(quack, selected_tissue, top_n):
    marker_df = quack.client.execute(
        """
        SELECT
            gene,
            liver_tpm,
            tissue_tpm,
            liver_minus_tissue_log10,
            abs_log10_gap
        FROM liver_vs_tissue_markers
        WHERE tissue = ?
        ORDER BY abs_log10_gap DESC
        LIMIT ?
        """,
        [selected_tissue.value, top_n.value],
    ).fetchdf()
    marker_df
    return (marker_df,)


@app.cell
def _(alt, marker_df, selected_tissue):
    marker_chart = (
        alt.Chart(marker_df)
        .mark_bar()
        .encode(
            x=alt.X("liver_minus_tissue_log10:Q", title="log10 liver - selected tissue"),
            y=alt.Y("gene:N", sort="-x", title=None),
            color=alt.condition(
                alt.datum.liver_minus_tissue_log10 > 0,
                alt.value("#2f7ed8"),
                alt.value("#d95f02"),
            ),
            tooltip=[
                "gene:N",
                alt.Tooltip("liver_tpm:Q", format=".2f"),
                alt.Tooltip("tissue_tpm:Q", format=".2f"),
                alt.Tooltip("liver_minus_tissue_log10:Q", format=".2f"),
            ],
        )
        .properties(
            title=f"Genes that separate liver from {selected_tissue.value}",
            width=720,
            height=360,
        )
    )
    marker_chart
    return


@app.cell(hide_code=True)
def _(mo):
    mo.md(r"""
    ## Why not a raw table?

    A GTEx expression matrix is a poor browser interaction primitive: thousands of
    genes by dozens to thousands of samples create wide, high-cardinality tables.
    This is not a critique of Marimo; Marimo is the narrative shell here. The point
    is that raw dataframe rendering is the wrong UI for linked biological
    exploration.

    Two public Marimo issues motivate the design boundary:

    - `marimo-team/marimo#2991`: around 1,000 dataframe columns can make the browser
      sluggish, and around 10,000 columns can crash the tab.
    - `marimo-team/marimo#2269`: large dataframe previews can load too much before
      filtering.

    Mosaic is the linked-view layer, and Quack is the remote DuckDB layer. Together,
    the browser sees aggregate tiles and top-N marker tables instead of the raw
    warehouse.
    """)
    return


@app.cell
def _(MOSAIC_IMPORT_ERROR, MosaicWidget, mo, quack):
    mosaic_spec = {
        "meta": {
            "title": "GTEx liver-neighbor explorer",
            "description": (
                "Linked Mosaic views over Quack-backed DuckDB summaries. "
                "Mosaic source: https://github.com/uwdata/mosaic"
            ),
        },
        "params": {"pick": {"select": "single"}},
        "vconcat": [
            {
                "plot": [
                    {
                        "mark": "barX",
                        "data": {"from": "liver_neighbors"},
                        "x": "pearson",
                        "y": "tissue",
                        "fill": "#4c78a8",
                    },
                    {"select": "toggleY", "as": "$pick"},
                    {"select": "highlight", "by": "$pick"},
                ],
                "width": 720,
                "height": 420,
                "xLabel": "Pearson correlation",
                "yLabel": None,
            },
            {
                "plot": [
                    {
                        "mark": "dot",
                        "data": {"from": "marker_panel", "filterBy": "$pick"},
                        "x": "gene",
                        "y": "median_tpm",
                        "fill": "tissue",
                        "r": 4,
                    }
                ],
                "width": 720,
                "height": 260,
                "yScale": "log",
                "xLabel": "liver marker panel",
                "yLabel": "median TPM",
            },
        ],
    }
    if MosaicWidget is None:
        mosaic_view = mo.md(
            f"""
            **Mosaic import failed.** The submitted notebook intentionally links
            to Mosaic and expects `mosaic-widget` to be installed.

            Error: `{type(MOSAIC_IMPORT_ERROR).__name__}: {MOSAIC_IMPORT_ERROR}`
            """
        )
    else:
        mosaic_view = mo.ui.anywidget(MosaicWidget(mosaic_spec, con=quack.client))
    mosaic_view
    return


@app.cell
def _(json, np, subprocess, sys, textwrap, time):
    def eager_subprocess_benchmark(base_rows, scale_factor=8, memory_mb=512, timeout=20):
        code = textwrap.dedent(
            r"""
            import json, resource, sys, time
            import numpy as np
            import pandas as pd

            base_rows = int(sys.argv[1])
            scale_factor = int(sys.argv[2])
            memory_mb = int(sys.argv[3])
            limit = memory_mb * 1024 * 1024
            try:
                resource.setrlimit(resource.RLIMIT_AS, (limit, limit))
            except (ValueError, OSError) as exc:
                print(json.dumps({
                    "status": "memory_cap_unavailable",
                    "reason": f"{type(exc).__name__}: {exc}",
                    "memory_limit_mb": memory_mb
                }))
                sys.exit(0)

            started = time.perf_counter()
            rows = base_rows * scale_factor
            # This intentionally models the bad notebook anti-pattern:
            # materialize an expanded client-side table instead of asking
            # DuckDB/Quack for a small aggregate result.
            df = pd.DataFrame(
                np.ones((rows, 5), dtype=np.float64),
                columns=["gene", "tissue", "tpm", "replicate", "scratch"],
            )
            print(json.dumps({
                "status": "materialized",
                "rows": int(len(df)),
                "columns": int(len(df.columns)),
                "elapsed_seconds": round(time.perf_counter() - started, 3)
            }))
            """
        )
        started = time.perf_counter()
        proc = subprocess.run(
            [sys.executable, "-c", code, str(base_rows), str(scale_factor), str(memory_mb)],
            capture_output=True,
            text=True,
            timeout=timeout,
        )
        elapsed = round(time.perf_counter() - started, 3)
        if proc.stdout.strip():
            payload = json.loads(proc.stdout.strip())
            payload["mode"] = "local_eager_bad"
            payload["memory_limit_mb"] = memory_mb
            payload.setdefault("elapsed_seconds", elapsed)
            return payload
        return {
            "mode": "local_eager_bad",
            "status": "failed_as_expected",
            "returncode": proc.returncode,
            "memory_limit_mb": memory_mb,
            "elapsed_seconds": elapsed,
            "stderr_tail": proc.stderr[-500:],
        }

    def local_duckdb_benchmark(con, scale_factor=8):
        started = time.perf_counter()
        df = con.execute(
            """
            SELECT tissue, avg(median_tpm) AS mean_tpm, count(*) AS expanded_rows
            FROM tissue_gene_median, range(?) r(i)
            GROUP BY tissue
            ORDER BY mean_tpm DESC
            LIMIT 10
            """,
            [scale_factor],
        ).fetchdf()
        return {
            "mode": "local_duckdb_lazy",
            "status": "aggregated",
            "rows_returned": int(len(df)),
            "expanded_rows_scanned": int(df["expanded_rows"].sum()),
            "elapsed_seconds": round(time.perf_counter() - started, 3),
        }

    def lazy_duckdb_benchmark(con, scale_factor=8):
        started = time.perf_counter()
        df = con.execute(
            """
            SELECT tissue, avg(median_tpm) AS mean_tpm, count(*) AS expanded_rows
            FROM remote.tissue_gene_median, range(?) r(i)
            GROUP BY tissue
            ORDER BY mean_tpm DESC
            LIMIT 10
            """,
            [scale_factor],
        ).fetchdf()
        return {
            "mode": "remote_quack",
            "status": "aggregated",
            "rows_returned": int(len(df)),
            "expanded_rows_scanned": int(df["expanded_rows"].sum()),
            "elapsed_seconds": round(time.perf_counter() - started, 3),
        }

    def run_benchmarks(quack_runtime, scale_factor=8, memory_mb=512):
        base_rows = quack_runtime.client.execute(
            "SELECT count(*) FROM remote.tissue_gene_median"
        ).fetchone()[0]
        eager = eager_subprocess_benchmark(base_rows, scale_factor, memory_mb)
        local = local_duckdb_benchmark(quack_runtime.server, scale_factor)
        remote = lazy_duckdb_benchmark(quack_runtime.client, scale_factor)
        return [eager, local, remote]

    def interpret_benchmark(results):
        by_mode = {row["mode"]: row for row in results if "mode" in row}
        local = by_mode.get("local_duckdb_lazy", {})
        remote = by_mode.get("remote_quack", {})
        eager = by_mode.get("local_eager_bad", {})
        local_s = local.get("elapsed_seconds")
        remote_s = remote.get("elapsed_seconds")
        if local_s is not None and remote_s is not None and remote_s > local_s:
            speed_sentence = (
                f"On this localhost run, in-process DuckDB was faster "
                f"({local_s:.3f}s) than Quack ({remote_s:.3f}s), because Quack "
                "adds protocol/client-server overhead."
            )
        elif local_s is not None and remote_s is not None:
            speed_sentence = (
                f"On this run, Quack ({remote_s:.3f}s) was competitive with local "
                f"DuckDB ({local_s:.3f}s), but the claim should still be "
                "architecture rather than localhost speed."
            )
        else:
            speed_sentence = (
                "The benchmark did not produce comparable local and Quack timings."
            )

        if eager.get("status") == "memory_cap_unavailable":
            eager_sentence = (
                "The eager-client failure path could not enforce a memory cap on "
                "this macOS runtime, so it is reported honestly instead of being "
                "counted as an OOM."
            )
        elif eager.get("status") == "failed_as_expected":
            eager_sentence = (
                "The eager-client path failed under the memory cap, which is the "
                "notebook anti-pattern this architecture avoids."
            )
        else:
            eager_sentence = (
                "The eager-client path materialized successfully at this scale; "
                "increase the scale factor to make the anti-pattern more expensive."
            )

        return (
            "### Benchmark interpretation\n\n"
            f"{speed_sentence}\n\n"
            f"{eager_sentence}\n\n"
            "**Conclusion:** Quack is not a magic accelerator for local DuckDB. "
            "Its value here is making the notebook a thin client: the data can "
            "live in a served DuckDB process, Mosaic and Marimo request small "
            "aggregates, and the browser never needs the raw expression matrix. "
            "That is the one BIG idea in this project."
        )

    return interpret_benchmark, run_benchmarks


@app.cell
def _(mo):
    benchmark_scale = mo.ui.slider(
        2, 20, value=8, step=2, label="synthetic benchmark scale factor"
    )
    benchmark_memory = mo.ui.slider(
        256, 2048, value=512, step=256, label="eager subprocess memory cap (MB)"
    )
    run_benchmark = mo.ui.run_button(label="Run controlled benchmark")
    mo.vstack(
        [
            mo.hstack([benchmark_scale, benchmark_memory], justify="start"),
            run_benchmark,
        ]
    )
    return benchmark_memory, benchmark_scale, run_benchmark


@app.cell
def _(
    benchmark_memory,
    benchmark_scale,
    interpret_benchmark,
    mo,
    quack,
    run_benchmark,
    run_benchmarks,
):
    if run_benchmark.value:
        benchmark_results = run_benchmarks(
            quack,
            scale_factor=benchmark_scale.value,
            memory_mb=benchmark_memory.value,
        )
        benchmark_output = mo.vstack(
            [benchmark_results, mo.md(interpret_benchmark(benchmark_results))]
        )
    else:
        benchmark_results = []
        benchmark_output = mo.md(
            """
            The benchmark is opt-in so the notebook does not deliberately stress
            the machine on load. Click the button to compare a memory-limited
            eager pandas materialization with Quack-backed server-side aggregation.
            """
        )
    benchmark_output
    return (benchmark_results,)


@app.cell(hide_code=True)
def _(PROJECT_LINKS, benchmark_results, build_info, median_file, mo, quack, textwrap):
    row_counts = build_info.get("row_counts", "{}")
    links = "\n".join(f"- [{name}]({url})" for name, url in PROJECT_LINKS.items())
    benchmark_note = (
        "`Run controlled benchmark` has not been clicked yet."
        if not benchmark_results
        else f"`{benchmark_results}`"
    )
    mo.md(
        textwrap.dedent(
            f"""
        ## Reproducibility and citations

        - Median TPM source file: `{median_file}`
        - Cached DuckDB database: `{quack.uri}` serving local file-backed tables
        - Build row counts: `{row_counts}`
        - Benchmark status: {benchmark_note}

        Links used by this notebook:

        {links}
        """
        )
    )
    return


if __name__ == "__main__":
    app.run()
