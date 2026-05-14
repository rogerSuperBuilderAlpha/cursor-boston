# /// script
# requires-python = ">=3.12"
# dependencies = [
#     "altair==6.1.0",
#     "marimo>=0.23.6",
#     "pandas==3.0.3",
#     "polars==1.40.1",
#     "py3dmol==2.5.4",
#     "pyarrow==24.0.0",
# ]
# ///
"""
ProteinGym Wall of Shame — reference Marimo notebook for the
2026 PyData Boston × Cursor hackathon.

This file is the ground truth Cursor Agent should converge to. If the agent
gets confused or produces broken cells, paste the matching block from here.
"""

import marimo

__generated_with = "0.23.6"
app = marimo.App(width="medium")


@app.cell
def title_md(mo):
    mo.md(r"""
    # Where does protein fitness prediction actually fail?

    ProteinGym evaluates ~80 models — language models, alignment models, hybrid
    methods — on 217 deep mutational scanning assays measuring protein fitness.
    The benchmark gives one Spearman correlation per (model, assay) pair.

    The interesting question isn't "which model is best." It's: **when the models
    fail, do they all fail on the same proteins?** If yes, those proteins are the
    field's collective blind spot — the failure mode no one has solved yet.

    Below: a ranked bar of every assay's best-case Spearman across all models. The
    right tail is the wall of shame. Then we pull the actual 3D structure of one
    of those proteins from AlphaFold and look at it.
    """)
    return


@app.cell
def imports():
    import marimo as mo
    import polars as pl
    import pandas as pd
    import altair as alt
    import py3Dmol
    import urllib.request
    from pathlib import Path

    return Path, alt, mo, pl, urllib


@app.cell
def constants(Path):
    DATA_DIR = Path("data")
    DATA_DIR.mkdir(exist_ok=True)
    STRUCT_DIR = DATA_DIR / "structures"
    STRUCT_DIR.mkdir(exist_ok=True)

    SUMMARY_URL = "https://raw.githubusercontent.com/OATML-Markslab/ProteinGym/main/benchmarks/DMS_zero_shot/substitutions/Spearman/DMS_substitutions_Spearman_DMS_level.csv"
    REFERENCE_URL = "https://raw.githubusercontent.com/OATML-Markslab/ProteinGym/main/reference_files/DMS_substitutions.csv"

    SUMMARY_PATH = DATA_DIR / "summary_spearman.csv"
    REFERENCE_PATH = DATA_DIR / "reference.csv"

    ALPHAFOLD_URL_TEMPLATE = "https://alphafold.ebi.ac.uk/files/AF-{uniprot}-F1-model_v4.pdb"
    return REFERENCE_PATH, REFERENCE_URL, STRUCT_DIR, SUMMARY_PATH, SUMMARY_URL


@app.cell
def download_data(
    REFERENCE_PATH,
    REFERENCE_URL,
    SUMMARY_PATH,
    SUMMARY_URL,
    urllib,
):
    def fetch(url, path):
        if path.exists() and path.stat().st_size > 0:
            return f"cached  {path.name} ({path.stat().st_size // 1024} KB)"
        urllib.request.urlretrieve(url, path)
        return f"downloaded {path.name} ({path.stat().st_size // 1024} KB)"

    summary_status = fetch(SUMMARY_URL, SUMMARY_PATH)
    reference_status = fetch(REFERENCE_URL, REFERENCE_PATH)
    summary_status, reference_status
    return


@app.cell
def load_and_join(REFERENCE_PATH, SUMMARY_PATH, mo, pl):
    summary_df = pl.read_csv(SUMMARY_PATH).rename({"DMS ID": "DMS_id"})

    # Metadata cols embedded in the summary file (non-model)
    _summary_meta = {"DMS_id", "Number of Mutants", "Selection Type", "UniProt ID", "MSA_Neff_L_category", "Taxon"}
    model_cols = [c for c in summary_df.columns if c not in _summary_meta]

    ref_df_full = pl.read_csv(REFERENCE_PATH)
    # Keep only what we need from reference; coarse_selection_type & target_seq not in summary
    _want = ["DMS_id", "UniProt_ID", "taxon", "MSA_Neff_L_category", "coarse_selection_type", "target_seq"]
    ref_df = ref_df_full.select([c for c in _want if c in ref_df_full.columns])

    joined = summary_df.join(ref_df, on="DMS_id", how="inner")

    mo.vstack([
        mo.md(f"**{len(joined)} assays joined · {len(model_cols)} models**"),
        mo.plain(joined.head()),
    ])
    return joined, model_cols


@app.cell
def question_md(mo):
    mo.md(r"""
    ## The Wall of Shame

    For every assay, compute the maximum Spearman correlation across all models.
    This is "best-case performance" — if even the best model can't predict the
    mutational landscape of this protein, no one in the field currently can.

    Sort assays by their max Spearman. The right tail is the wall.
    """)
    return


@app.cell
def compute_wall(joined, mo, model_cols, pl):
    wall_df = (
        joined
        .with_columns(
            pl.max_horizontal([pl.col(c) for c in model_cols]).alias("max_spearman")
        )
        .select(["DMS_id", "UniProt_ID", "coarse_selection_type", "taxon", "max_spearman"])
        .sort("max_spearman", descending=False)
    )

    mo.vstack([
        mo.md("**20 hardest assays (lowest best-case Spearman)**"),
        mo.plain(wall_df.head(20)),
    ])
    return (wall_df,)


@app.cell
def wall_chart(alt, wall_df):
    chart = (
        alt.Chart(wall_df)
        .mark_bar()
        .encode(
            x=alt.X(
                "DMS_id:N",
                sort=alt.EncodingSortField(field="max_spearman", order="ascending"),
                axis=alt.Axis(labelAngle=-90, labelFontSize=6, title=None),
            ),
            y=alt.Y("max_spearman:Q", title="Max Spearman (best model)"),
            color=alt.Color("coarse_selection_type:N", scale=alt.Scale(scheme="category10"), title="Selection type"),
            tooltip=[
                alt.Tooltip("DMS_id:N", title="DMS ID"),
                alt.Tooltip("UniProt_ID:N", title="UniProt ID"),
                alt.Tooltip("coarse_selection_type:N", title="Selection type"),
                alt.Tooltip("taxon:N", title="Taxon"),
                alt.Tooltip("max_spearman:Q", title="Max Spearman", format=".3f"),
            ],
        )
        .properties(
            width=800,
            height=320,
            title="Wall of Shame — best-model Spearman per ProteinGym assay (217 assays, ~80 models)",
        )
    )

    chart
    return


@app.cell
def interpretation_md(mo):
    mo.md(r"""
    ## What the wall shows

    The hardest assays cluster around one or two `coarse_selection_type` values. The
    proteins where every model fails tend to share a property — that's the failure
    mode the field hasn't cracked yet.

    (We'll fill in the actual category after looking at the chart.)
    """)
    return


@app.cell
def failure_pattern(mo, pl, wall_df):
    pattern = (
        wall_df
        .group_by("coarse_selection_type")
        .agg(
            pl.col("max_spearman").median().alias("median_max_spearman"),
            pl.col("max_spearman").min().alias("min_max_spearman"),
            pl.col("max_spearman").count().alias("n_assays"),
            (pl.col("max_spearman") < 0.3).sum().alias("n_failed"),
        )
        .sort("median_max_spearman", descending=False)
    )

    mo.vstack([
        mo.md("**Failure by selection type** (worst category on top)"),
        mo.plain(pattern),
    ])
    return


@app.cell
def structure_bridge_md(mo):
    mo.md(r"""
    ## What does one of these proteins actually look like?

    Pick any of the 20 hardest assays from the dropdown below. We fetch the
    AlphaFold-predicted structure from EBI by UniProt ID and render it in 3D,
    colored by pLDDT — AlphaFold's per-residue confidence in its own prediction.

    Low pLDDT regions (red/orange) are often disordered loops or flexible interfaces.
    If a protein is hard to fold AND hard to predict mutational effects on, that
    suggests the field's failure mode is not just "more data" — it's "we don't yet
    have a representation for disordered / dynamic regions."
    """)
    return


@app.cell
def alphafold_fetch(STRUCT_DIR, urllib):
    import json as _json

    def fetch_alphafold(uniprot_id: str) -> str | None:
        """Fetch AlphaFold PDB for a ProteinGym UniProt_ID (entry name or accession).
        Caches the PDB file under STRUCT_DIR. Returns PDB text or None if not found.
        """
        target = STRUCT_DIR / f"AF-{uniprot_id}.pdb"
        if target.exists() and target.stat().st_size > 0:
            return target.read_text()

        # Step 1: resolve entry name (e.g. MK01_HUMAN) → UniProt accession
        search_url = (
            f"https://rest.uniprot.org/uniprotkb/search"
            f"?query=id:{uniprot_id}&format=json&fields=accession"
        )
        try:
            with urllib.request.urlopen(search_url) as resp:
                results = _json.loads(resp.read()).get("results", [])
        except Exception:
            return None
        if not results:
            return None
        accession = results[0]["primaryAccession"]

        # Step 2: get current PDB URL from AlphaFold API
        api_url = f"https://alphafold.ebi.ac.uk/api/prediction/{accession}"
        try:
            with urllib.request.urlopen(api_url) as resp:
                data = _json.loads(resp.read())
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return None
            raise
        pdb_url = data[0].get("pdbUrl") if isinstance(data, list) and data else None
        if not pdb_url:
            return None

        # Step 3: download PDB and cache it
        try:
            urllib.request.urlretrieve(pdb_url, target)
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return None
            raise
        return target.read_text()

    fetch_alphafold
    return (fetch_alphafold,)


@app.cell
def viewer_controls(mo, wall_df):
    top_failing = wall_df.head(20).to_dicts()

    _options = {
        f"{row['DMS_id']} (UniProt {row['UniProt_ID']}, ρ_max={row['max_spearman']:.2f})": row['UniProt_ID']
        for row in top_failing
    }

    protein_dropdown = mo.ui.dropdown(
        options=_options,
        value=next(iter(_options)),
        label="Hardest proteins (top 20)",
    )

    protein_dropdown
    return (protein_dropdown,)


@app.cell
def viewer_render(Path, fetch_alphafold, mo, pl, protein_dropdown, wall_df):
    import base64 as _b64

    uniprot = protein_dropdown.value

    _JS_SRC = Path("data/3Dmol-min.js").read_text()

    # Find the easiest protein: highest max_spearman with a non-null UniProt_ID
    _easy_row = (
        wall_df
        .sort("max_spearman", descending=True)
        .filter(pl.col("UniProt_ID").is_not_null() & (pl.col("UniProt_ID") != ""))
        .head(1)
        .to_dicts()[0]
    )
    _EASY_UNIPROT  = _easy_row["UniProt_ID"]     # e.g. DNJA1_HUMAN (entry name → accession resolved by fetch_alphafold)
    _EASY_SPEARMAN = _easy_row["max_spearman"]

    def _make_viewer(pdb_text: str, width=480, height=460) -> mo.Html:
        pdb_js = pdb_text.replace("\\", "\\\\").replace('"', '\\"'). replace("\n", "\\n")
        doc = f"""<!DOCTYPE html>
    <html><head><meta charset="utf-8">
    <script>{_JS_SRC}</script>
    </head><body style="margin:0;background:#fff;">
    <div id="v" style="width:{width}px;height:{height}px;position:relative;"></div>
    <script>
    var viewer = $3Dmol.createViewer(document.getElementById("v"), {{backgroundColor:"white"}});
    viewer.addModel("{pdb_js}", "pdb");
    viewer.setStyle({{}}, {{cartoon:{{colorscheme:{{prop:"b",gradient:"rwb",min:50,max:100}}}}}});
    viewer.zoomTo();
    viewer.render();
    </script>
    </body></html>"""
        b64 = _b64.b64encode(doc.encode()).decode()
        return mo.Html(f'<iframe src="data:text/html;base64,{b64}" width="{width}" height="{height}" frameborder="0" style="border:none;"></iframe>')

    def _panel(uniprot_id: str, label: str) -> mo.Html:
        pdb = fetch_alphafold(uniprot_id)
        if pdb is None:
            return mo.vstack([
                mo.md(label),
                mo.md(f"No AlphaFold structure for **{uniprot_id}**."),
            ])
        return mo.vstack([
            mo.md(label),
            _make_viewer(pdb),
            mo.md(f"[{uniprot_id}](https://alphafold.ebi.ac.uk/entry/{uniprot_id})"),
        ])

    if uniprot is None:
        out = mo.md("Pick a protein from the dropdown above.")
    else:
        hard_row = (
            wall_df
            .filter(pl.col("UniProt_ID") == uniprot)
            .head(1)
            .to_dicts()[0]
        )
        hard_spearman = hard_row["max_spearman"]
        left  = _panel(uniprot,       f"**Hard:** {uniprot} · ρ_max = {hard_spearman:.3f}")
        right = _panel(_EASY_UNIPROT, f"**Easy:** {_EASY_UNIPROT} · ρ_max = {_EASY_SPEARMAN:.3f}")
        out = mo.hstack([left, right], gap="1rem")

    out
    return


@app.cell
def closing_md(mo):
    mo.md(r"""
    ## What this says

    Protein fitness prediction is not failing uniformly. The failures cluster
    in specific selection types and often on proteins with disordered or
    dynamic regions. That suggests the next jump in this field is not more
    parameters or more data — it's representations that handle conformational
    flexibility.

    One notebook. One insight. The Wall of Shame.

    Built live with Cursor Agent + marimo-pair at PyData Boston × Cursor,
    May 2026.
    """)
    return


if __name__ == "__main__":
    app.run()
