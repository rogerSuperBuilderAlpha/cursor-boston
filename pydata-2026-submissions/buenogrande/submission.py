# /// script
# dependencies = ["marimo"]
# requires-python = ">=3.10"
# ///

import marimo

__generated_with = "0.23.6"
app = marimo.App(width="medium")


@app.cell(hide_code=True)
def imports():
    import marimo as mo
    from pathlib import Path
    import csv
    import html
    import math
    import re
    import statistics
    import textwrap
    import urllib.request

    return Path, csv, html, mo, re, statistics, urllib


@app.cell(hide_code=True)
def opening_question(mo):
    mo.Html(r"""
    <style>
    .opening-wrap {font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #101828;}
    .opening-kicker {font-size: 12px; letter-spacing: .08em; text-transform: uppercase; color: #0f766e; font-weight: 800;}
    .opening-question {font-size: 46px; line-height: 1.03; margin: 8px 0 12px; font-weight: 850; max-width: 980px;}
    .opening-sub {font-size: 18px; line-height: 1.38; color: #475467; max-width: 900px; margin: 0;}
    .opening-bar {display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; margin-top: 18px;}
    .opening-chip {border: 1px solid #d0d5dd; border-radius: 8px; padding: 12px 14px; background: #fff;}
    .opening-chip b {display:block; font-size: 13px; color:#111827; margin-bottom: 4px;}
    .opening-chip span {display:block; font-size: 13px; color:#475467; line-height:1.34;}
    @media (max-width: 820px) {.opening-question {font-size: 34px;} .opening-bar {grid-template-columns: 1fr;}}
    </style>
    <div class="opening-wrap">
      <div class="opening-kicker">Mutation Radar</div>
      <div class="opening-question">A new viral mutation appears. Should we worry?</div>
      <p class="opening-sub">Whether the alert is SARS-CoV-2, Hantavirus, or the next unknown virus, a mutation is not automatically dangerous. First ask whether the protein can still do its job. Here, we test that question for Spike RBD binding.</p>
      <div class="opening-bar">
        <div class="opening-chip"><b>Input</b><span>Thousands of possible Spike mutations.</span></div>
        <div class="opening-chip"><b>Filter</b><span>Measured ACE2-binding fitness from ProteinGym.</span></div>
        <div class="opening-chip"><b>Output</b><span>A short list of mutations and sites to watch first.</span></div>
      </div>
    </div>
    """)
    return


@app.cell(hide_code=True)
def why_this_matters(mo):
    mo.Html(r"""
    <style>
    .story-wrap {font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #101828;}
    .story-kicker {font-size: 12px; letter-spacing: .08em; text-transform: uppercase; color: #667085; font-weight: 750;}
    .story-grid {display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin-top: 12px;}
    .story-card {border: 1px solid #d0d5dd; border-radius: 8px; padding: 16px; background: #fff; min-height: 112px;}
    .story-card h3 {margin: 0 0 8px; font-size: 18px; line-height: 1.12; color: #111827;}
    .story-card p {margin: 0; font-size: 14px; line-height: 1.42; color: #475467;}
    .story-arrow {font-size: 22px; line-height: 1; color: #0f766e; font-weight: 850; margin-bottom: 8px;}
    @media (max-width: 820px) {.story-grid {grid-template-columns: 1fr;}.story-card {min-height: 0;}}
    </style>
    <div class="story-wrap">
      <div class="story-kicker">Why this matters</div>
      <h2 style="margin: 4px 0 4px; font-size: 28px; line-height: 1.12;">The goal is early triage, not certainty.</h2>
      <p style="margin: 0; max-width: 880px; font-size: 15px; line-height: 1.45; color: #475467;">When a new sequence arrives, we need a fast first read: is this likely noise, or a mutation the virus can afford?</p>
      <div class="story-grid">
        <div class="story-card">
          <div class="story-arrow">1</div>
          <h3>Most changes fail</h3>
          <p>Many substitutions damage binding or structure, so they are less likely to matter.</p>
        </div>
        <div class="story-card">
          <div class="story-arrow">2</div>
          <h3>Some changes survive</h3>
          <p>A tolerated mutation keeps Spike functional, which makes it worth watching.</p>
        </div>
        <div class="story-card">
          <div class="story-arrow">3</div>
          <h3>The radar prioritizes</h3>
          <p>It turns experimental mutation data into a simple watchlist for surveillance.</p>
        </div>
      </div>
    </div>
    """)
    return


@app.cell(hide_code=True)
def method_at_a_glance(mo):
    mo.Html(r"""
    <style>
    .method-wrap {font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #101828;}
    .method-flow {display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 8px; margin-top: 12px;}
    .method-step {border: 1px solid #d0d5dd; border-radius: 8px; padding: 12px; background: #fff;}
    .method-step b {display:block; font-size: 13px; color:#111827; margin-bottom: 5px;}
    .method-step span {display:block; font-size: 12px; line-height:1.35; color:#475467;}
    @media (max-width: 900px) {.method-flow {grid-template-columns: 1fr 1fr;}}
    </style>
    <div class="method-wrap">
      <div style="font-size: 12px; letter-spacing: .08em; text-transform: uppercase; color: #667085; font-weight: 750;">Method</div>
      <h2 style="margin: 4px 0 4px; font-size: 24px; line-height: 1.15;">From mutation table to radar</h2>
      <div class="method-flow">
        <div class="method-step"><b>Load</b><span>ProteinGym SARS-CoV-2 Spike RBD ACE2-binding assay.</span></div>
        <div class="method-step"><b>Parse</b><span>Extract wild-type residue, position, and alternate residue.</span></div>
        <div class="method-step"><b>Score</b><span>Use DMS score as measured binding fitness.</span></div>
        <div class="method-step"><b>Aggregate</b><span>Summarize each position by tolerance and best variants.</span></div>
        <div class="method-step"><b>Prioritize</b><span>Surface flexible sites, brittle sites, and high-binding substitutions.</span></div>
      </div>
    </div>
    """)
    return


@app.cell(hide_code=True)
def data_config(Path):
    DATA_DIR = Path("data/proteingym")
    ASSAY_FILENAME = "SPIKE_SARS2_Starr_bind_2020.csv"
    REFERENCE_FILENAME = "ProteinGym_reference_file_substitutions.csv"
    ASSAY_URL = "https://huggingface.co/datasets/ICML2022/ProteinGym/resolve/main/ProteinGym_substitutions/SPIKE_SARS2_Starr_bind_2020.csv"
    REFERENCE_URL = "https://huggingface.co/datasets/ICML2022/ProteinGym/resolve/main/ProteinGym_reference_file_substitutions.csv"
    ASSAY_PATH = DATA_DIR / ASSAY_FILENAME
    REFERENCE_PATH = DATA_DIR / REFERENCE_FILENAME
    return ASSAY_PATH, ASSAY_URL, REFERENCE_PATH, REFERENCE_URL


@app.cell(hide_code=True)
def load_proteingym_data(
    ASSAY_PATH,
    ASSAY_URL,
    REFERENCE_PATH,
    REFERENCE_URL,
    csv,
    re,
    urllib,
):
    def load_proteingym_assay(assay_path, reference_path, assay_url, reference_url):
        def ensure_file(path, url):
            path.parent.mkdir(parents=True, exist_ok=True)
            if not path.exists() or path.stat().st_size < 1000:
                urllib.request.urlretrieve(url, path)

        ensure_file(assay_path, assay_url)
        ensure_file(reference_path, reference_url)

        mutation_pattern = re.compile(r"([A-Z])(\d+)([A-Z])")
        parsed = []
        with assay_path.open(newline="") as handle:
            for record in csv.DictReader(handle):
                match = mutation_pattern.fullmatch(record["mutant"])
                if not match:
                    continue
                wt, position, alt = match.groups()
                parsed.append(
                    {
                        "mutant": record["mutant"],
                        "wt": wt,
                        "position": int(position),
                        "alt": alt,
                        "score": float(record["DMS_score"]),
                        "fit": int(record["DMS_score_bin"]),
                    }
                )

        metadata = {}
        with reference_path.open(newline="") as handle:
            for record in csv.DictReader(handle):
                if record.get("DMS_filename") == assay_path.name:
                    metadata = record
                    break

        return parsed, metadata


    mutation_rows, assay_metadata = load_proteingym_assay(
        ASSAY_PATH,
        REFERENCE_PATH,
        ASSAY_URL,
        REFERENCE_URL,
    )
    return assay_metadata, mutation_rows


@app.cell(hide_code=True)
def summarize_mutation_landscape(mutation_rows, statistics):
    def summarize_mutation_landscape(records):
        def by_position_table(items):
            grouped = {}
            for item in items:
                grouped.setdefault(item["position"], []).append(item)

            stats = []
            for position, variants in grouped.items():
                scores = [variant["score"] for variant in variants]
                fit_count = sum(variant["fit"] for variant in variants)
                best_variants = sorted(variants, key=lambda variant: variant["score"], reverse=True)[:3]
                stats.append(
                    {
                        "position": position,
                        "wt": variants[0]["wt"],
                        "tested": len(variants),
                        "fit_count": fit_count,
                        "fit_fraction": fit_count / len(variants),
                        "mean_score": statistics.mean(scores),
                        "min_score": min(scores),
                        "max_score": max(scores),
                        "best": best_variants,
                    }
                )
            return stats

        position_stats = by_position_table(records)
        permissive_positions = sorted(
            position_stats,
            key=lambda item: (item["fit_fraction"], item["mean_score"], item["max_score"]),
            reverse=True,
        )
        constrained_positions = sorted(
            position_stats,
            key=lambda item: (item["fit_fraction"], item["mean_score"]),
        )
        top_individual = sorted(records, key=lambda item: item["score"], reverse=True)
        score_values = [item["score"] for item in records]

        return {
            "records": len(records),
            "positions": len(position_stats),
            "position_min": min(item["position"] for item in records),
            "position_max": max(item["position"] for item in records),
            "fit_records": sum(item["fit"] for item in records),
            "mean_score": statistics.mean(score_values),
            "median_score": statistics.median(score_values),
            "score_min": min(score_values),
            "score_max": max(score_values),
            "position_stats": position_stats,
            "permissive_positions": permissive_positions,
            "constrained_positions": constrained_positions,
            "top_individual": top_individual,
        }


    mutation_summary = summarize_mutation_landscape(mutation_rows)
    return (mutation_summary,)


@app.cell(hide_code=True)
def visual_helpers(html):
    def _score_to_color(score):
        if score is None:
            return "#f8fafc"
        if score <= -3.0:
            return "#7f1d1d"
        if score <= -1.0:
            return "#dc2626"
        if score <= -0.5:
            return "#f97316"
        if score <= 0.0:
            return "#facc15"
        return "#0f9f9a"


    def _format_pct(value):
        return f"{100 * value:.0f}%"


    def render_metric_cards(summary, metadata):
        title = html.escape(metadata.get("title", "ProteinGym Spike RBD DMS"))
        region = html.escape(metadata.get("region_mutated", f"{summary['position_min']}-{summary['position_max']}"))
        fit_pct = _format_pct(summary["fit_records"] / summary["records"])
        top = summary["top_individual"][0]
        top_label = html.escape(f"{top['mutant']} / {top['score']:.2f}")
        return f'''
        <style>
          .radar-wrap {{font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #101828;}}
          .radar-kicker {{font-size: 12px; letter-spacing: .08em; text-transform: uppercase; color: #667085; font-weight: 750;}}
          .radar-grid {{display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; margin: 12px 0 6px;}}
          .radar-card {{border: 1px solid #d0d5dd; border-radius: 8px; padding: 14px; background: #ffffff;}}
          .radar-value {{font-size: 28px; line-height: 1; font-weight: 850; color: #111827;}}
          .radar-label {{font-size: 12px; color: #667085; margin-top: 8px; line-height: 1.3;}}
          .radar-note {{font-size: 13px; color: #475467; margin-top: 12px; line-height: 1.4;}}
          .signal-list {{display: grid; gap: 8px; margin-top: 10px;}}
          .signal-row {{display: grid; grid-template-columns: 74px 1fr 54px; gap: 10px; align-items: center; font-size: 13px;}}
          .signal-name {{font-weight: 800; color: #111827;}}
          .signal-track {{height: 8px; background: #eaecf0; border-radius: 999px; overflow: hidden;}}
          .signal-bar {{height: 8px; border-radius: 999px;}}
          .signal-score {{font-variant-numeric: tabular-nums; color: #475467; text-align: right;}}
          .mini-grid {{display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px;}}
          .site-chip {{display: inline-flex; align-items: center; justify-content: center; min-width: 56px; padding: 5px 8px; border-radius: 999px; font-weight: 850; margin: 2px 4px 2px 0; font-size: 12px;}}
          .site-chip.flexible {{border: 1px solid #0f766e; background: #ccfbf1; color: #134e4a;}}
          .site-chip.brittle {{border: 1px solid #b91c1c; background: #fee2e2; color: #7f1d1d;}}
          .map-explain {{display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; margin: 12px 0;}}
          .map-step {{border: 1px solid #d0d5dd; border-radius: 8px; padding: 12px; background: #fff;}}
          .map-step b {{display: block; font-size: 13px; margin-bottom: 4px; color: #111827;}}
          .map-step span {{display: block; font-size: 12px; line-height: 1.35; color: #475467;}}
          .spot-grid {{display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 8px; margin: 10px 0 0;}}
          .spot-card {{border: 2px solid #111827; border-radius: 8px; padding: 10px; background: #ffffff;}}
          .spot-mutation {{font-weight: 850; font-size: 17px; color: #111827;}}
          .spot-decode {{font-size: 12px; color: #475467; margin-top: 2px;}}
          .spot-score {{font-size: 20px; font-weight: 850; color: #0f766e; margin-top: 6px;}}
          .plot-shell {{font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #101828; width: 100%;}}
          @media (max-width: 820px) {{.radar-grid {{grid-template-columns: repeat(2, minmax(0, 1fr));}} .mini-grid, .map-explain, .spot-grid {{grid-template-columns: 1fr;}}}}
        </style>
        <div class="radar-wrap">
          <div class="radar-kicker">Dataset: ProteinGym</div>
          <h2 style="margin: 4px 0 6px; font-size: 28px; line-height: 1.12;">Measured Spike RBD mutation landscape</h2>
          <div style="font-size: 14px; color: #475467; max-width: 900px;">{title}</div>
          <div class="radar-grid">
            <div class="radar-card"><div class="radar-value">{summary['records']:,}</div><div class="radar-label">single amino-acid substitutions</div></div>
            <div class="radar-card"><div class="radar-value">{summary['positions']}</div><div class="radar-label">RBD positions, {region}</div></div>
            <div class="radar-card"><div class="radar-value">{fit_pct}</div><div class="radar-label">above the assay fitness cutoff</div></div>
            <div class="radar-card"><div class="radar-value">{top_label}</div><div class="radar-label">highest measured binding signal</div></div>
          </div>
          <div class="radar-note">Higher DMS score means stronger measured ACE2-binding fitness in this assay.</div>
        </div>
        '''


    def render_heatmap_intro(summary):
        top_items = summary["top_individual"][:5]
        spot_cards = []
        for item in top_items:
            mutation = html.escape(item["mutant"])
            decode = html.escape(f"{item['wt']} -> {item['alt']} at {item['position']}")
            locator = html.escape(f"column {item['position']}, row {item['alt']}")
            spot_cards.append(
                f'''<div class="spot-card">
                    <div class="spot-mutation">{mutation}</div>
                    <div class="spot-decode">{decode}</div>
                    <div class="spot-decode">{locator}</div>
                    <div class="spot-score">{item['score']:.2f}</div>
                  </div>'''
            )

        return f'''
        <div class="radar-wrap">
          <div class="radar-kicker">Radar view</div>
          <h2 style="margin: 4px 0 6px; font-size: 28px; line-height: 1.12;">How the list becomes a map</h2>
          <div class="map-explain">
            <div class="map-step"><b>1. One mutation becomes one cell</b><span>Q498H means original Q at position 498 changed to H.</span></div>
            <div class="map-step"><b>2. Position sets the column</b><span>Q498H is in column 498 on the x-axis.</span></div>
            <div class="map-step"><b>3. New amino acid sets the row</b><span>Q498H is on row H; color is measured binding score.</span></div>
          </div>
          <div class="spot-grid">{''.join(spot_cards)}</div>
        </div>
        '''


    def render_heatmap_plot(records, summary):
        amino_acids = "ACDEFGHIKLMNPQRSTVWY"
        positions = list(range(summary["position_min"], summary["position_max"] + 1))
        score_by_key = {(item["position"], item["alt"]): item["score"] for item in records}
        top_items = summary["top_individual"][:5]
        top_positions = sorted({item["position"] for item in top_items})
        cell_w = 4
        cell_h = 12
        left = 42
        top = 34
        plot_w = len(positions) * cell_w
        plot_h = len(amino_acids) * cell_h
        width = left + plot_w + 34
        height = top + plot_h + 78

        guide_rects = []
        guide_labels = []
        for index, position in enumerate(top_positions):
            x = left + (position - summary["position_min"]) * cell_w
            guide_rects.append(f'<rect x="{x - 1}" y="{top - 9}" width="{cell_w + 2}" height="{plot_h + 9}" fill="#dbeafe" opacity="0.55"/>')
            label_y = 12 if index % 2 == 0 else 24
            guide_labels.append(f'<text x="{x + cell_w / 2}" y="{label_y}" font-size="9" text-anchor="middle" fill="#1d4ed8" font-weight="700">{position}</text>')
            guide_labels.append(f'<line x1="{x + cell_w / 2}" x2="{x + cell_w / 2}" y1="{label_y + 3}" y2="{top + plot_h}" stroke="#1d4ed8" stroke-width="0.7" opacity="0.75"/>')

        rects = []
        for y_index, residue in enumerate(amino_acids):
            y = top + y_index * cell_h
            rects.append(f'<text x="12" y="{y + 9}" font-size="10" fill="#475467">{residue}</text>')
            for x_index, position in enumerate(positions):
                score = score_by_key.get((position, residue))
                x = left + x_index * cell_w
                rects.append(f'<rect x="{x}" y="{y}" width="{cell_w}" height="{cell_h}" fill="{_score_to_color(score)}" stroke="#ffffff" stroke-width="0.12" />')

        outline_rects = []
        for item in top_items:
            x = left + (item["position"] - summary["position_min"]) * cell_w
            y = top + amino_acids.index(item["alt"]) * cell_h
            outline_rects.append(f'<rect x="{x - 1.5}" y="{y - 1.5}" width="{cell_w + 3}" height="{cell_h + 3}" fill="none" stroke="#ffffff" stroke-width="3.2"/>')
            outline_rects.append(f'<rect x="{x - 1.5}" y="{y - 1.5}" width="{cell_w + 3}" height="{cell_h + 3}" fill="none" stroke="#111827" stroke-width="1.8"/>')

        tick_marks = []
        for position in [331, 350, 375, 400, 425, 450, 475, 500, 525, 531]:
            x = left + (position - summary["position_min"]) * cell_w
            tick_marks.append(f'<line x1="{x}" x2="{x}" y1="{top + plot_h}" y2="{top + plot_h + 5}" stroke="#667085"/>')
            tick_marks.append(f'<text x="{x}" y="{top + plot_h + 18}" font-size="9" text-anchor="middle" fill="#667085">{position}</text>')

        legend = "".join(
            f'<rect x="{left + i * 78}" y="{height - 34}" width="24" height="10" fill="{color}"/><text x="{left + i * 78 + 29}" y="{height - 25}" font-size="10" fill="#475467">{label}</text>'
            for i, (color, label) in enumerate(
                [
                    ("#7f1d1d", "breaks binding"),
                    ("#f97316", "low"),
                    ("#facc15", "near neutral"),
                    ("#0f9f9a", "higher binding"),
                    ("#f8fafc", "wild-type"),
                ]
            )
        )

        return f'''
        <div class="plot-shell">
          <div style="font-size: 13px; color: #475467; margin: 0 0 8px;">Blue guides mark top-signal positions. Black boxes mark the exact top mutation cells.</div>
          <svg viewBox="0 0 {width} {height}" width="100%" style="display:block; max-width: 100%;" role="img" aria-label="Spike RBD mutation heatmap with highlighted top mutations">
            <rect x="0" y="0" width="{width}" height="{height}" fill="#ffffff"/>
            {''.join(guide_rects)}
            {''.join(rects)}
            {''.join(outline_rects)}
            {''.join(guide_labels)}
            <line x1="{left}" x2="{left + plot_w}" y1="{top + plot_h}" y2="{top + plot_h}" stroke="#98a2b3"/>
            {''.join(tick_marks)}
            <text x="{left + plot_w / 2}" y="{top + plot_h + 38}" font-size="11" text-anchor="middle" fill="#475467">Spike RBD position</text>
            {legend}
          </svg>
        </div>
        '''


    def render_rankings(summary):
        top_items = summary["top_individual"][:6]
        constrained = summary["constrained_positions"][:7]
        permissive = summary["permissive_positions"][:7]
        max_score = max(item["score"] for item in top_items)

        top_rows = []
        for item in top_items:
            width = max(10, item["score"] / max_score * 100)
            top_rows.append(
                f'''<div class="signal-row">
                  <div class="signal-name">{html.escape(item['mutant'])}</div>
                  <div class="signal-track"><div class="signal-bar" style="width:{width:.0f}%; background:#0f9f9a;"></div></div>
                  <div class="signal-score">{item['score']:.2f}</div>
                </div>'''
            )

        constrained_chips = "".join(
            f'<span class="site-chip brittle">{item["wt"]}{item["position"]}</span>'
            for item in constrained
        )
        permissive_chips = "".join(
            f'<span class="site-chip flexible">{item["wt"]}{item["position"]}</span>'
            for item in permissive
        )

        return f'''
        <div class="radar-wrap">
          <div class="radar-kicker">What surfaced</div>
          <h2 style="margin: 4px 0 8px; font-size: 28px; line-height: 1.12;">The landscape is uneven.</h2>
          <div style="font-size:13px; color:#475467; margin: -2px 0 12px;">Read each mutation as original amino acid, position, new amino acid: <b>Q498H</b> = Q at 498 changed to H.</div>
          <div class="mini-grid">
            <div class="radar-card">
              <h3 style="margin: 0 0 4px; font-size: 18px;">Binding-enhancing substitutions</h3>
              <p style="margin: 0 0 10px; font-size: 13px; color:#475467;">Strongest measured ACE2-binding signals.</p>
              <div class="signal-list">{''.join(top_rows)}</div>
            </div>
            <div class="radar-card">
              <h3 style="margin: 0 0 8px; font-size: 18px;">Sites with different freedom</h3>
              <p style="margin: 0 0 8px; font-size: 13px; color:#134e4a;"><b>Flexible</b> (tolerate all tested substitutions)</p>
              <div>{permissive_chips}</div>
              <p style="margin: 14px 0 8px; font-size: 13px; color:#7f1d1d;"><b>Brittle</b> (tolerate none)</p>
              <div>{constrained_chips}</div>
            </div>
          </div>
        </div>
        '''


    def render_takeaway(summary):
        return '''
        <div class="radar-wrap">
          <div style="border: 1px solid #0f766e; border-radius: 8px; padding: 18px; background: #f0fdfa;">
            <div class="radar-kicker" style="color:#0f766e;">Takeaway</div>
            <h2 style="margin: 4px 0 0; font-size: 26px; line-height: 1.16; color:#111827;">For the next outbreak, whether SARS-CoV-2, Hantavirus, or something new, mutation maps can help prioritize which variants deserve immediate experimental and surveillance attention.</h2>
          </div>
        </div>
        '''


    return (
        render_heatmap_intro,
        render_heatmap_plot,
        render_metric_cards,
        render_rankings,
        render_takeaway,
    )


@app.cell(hide_code=True)
def dataset_snapshot(
    assay_metadata,
    mo,
    mutation_summary,
    render_metric_cards,
):
    mo.Html(render_metric_cards(mutation_summary, assay_metadata))
    return


@app.cell(hide_code=True)
def mutation_map_intro(mo, mutation_summary, render_heatmap_intro):
    mo.Html(render_heatmap_intro(mutation_summary))
    return


@app.cell(hide_code=True)
def mutation_heatmap_plot(
    mo,
    mutation_rows,
    mutation_summary,
    render_heatmap_plot,
):
    mo.Html(render_heatmap_plot(mutation_rows, mutation_summary))
    return


@app.cell(hide_code=True)
def result_rankings(mo, mutation_summary, render_rankings):
    mo.Html(render_rankings(mutation_summary))
    return


@app.cell(hide_code=True)
def takeaway(mo, mutation_summary, render_takeaway):
    mo.Html(render_takeaway(mutation_summary))
    return


if __name__ == "__main__":
    app.run()
