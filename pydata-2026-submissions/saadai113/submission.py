# /// script
# dependencies = [
#   "marimo>=0.23",
#   "polars",
#   "numpy",
#   "scikit-learn",
#   "datasets",
# ]
# requires-python = ">=3.11"
# ///

import marimo

__generated_with = "0.23.6"
app = marimo.App(width="medium")


@app.cell(hide_code=True)
def imports():
    class Lib:
        pass

    L = Lib()
    import marimo as mo
    import polars as pl
    import numpy as np
    from io import StringIO
    from urllib.request import urlopen

    from sklearn.model_selection import train_test_split
    from sklearn.preprocessing import LabelEncoder, StandardScaler
    from sklearn.linear_model import LogisticRegression
    from sklearn.neural_network import MLPClassifier
    from sklearn.metrics import accuracy_score
    from datasets import load_dataset

    L.mo = mo
    L.pl = pl
    L.np = np
    L.StringIO = StringIO
    L.urlopen = urlopen
    L.train_test_split = train_test_split
    L.LabelEncoder = LabelEncoder
    L.StandardScaler = StandardScaler
    L.LogisticRegression = LogisticRegression
    L.MLPClassifier = MLPClassifier
    L.accuracy_score = accuracy_score
    L.load_dataset = load_dataset
    return L


@app.cell(hide_code=True)
def narrative_md(L):
    return L.mo.md(
        r"""
## From UCI wall-following to LeRobot-shaped episodes

This notebook connects a **classic tabular navigation** dataset (ultrasound
simplified distances + discrete steering labels) with the **modern LeRobot**
ecosystem on Hugging Face (episode-based imitation data, often with video).

- **UCI:** [Wall-Following Robot Navigation](https://archive.ics.uci.edu/ml/datasets/Wall+Following+Robot+Navigation+Data) — file `sensor_readings_4.data` (four sector minima + class).
- **LeRobot:** [huggingface.co/lerobot](https://huggingface.co/lerobot) — we stream **one row** from `lerobot/libero` to inspect schema (no GPU).

We compare **logistic regression vs a small MLP** on static features, then add **lagged** observations to mimic short-term memory—the original dataset motivation is that wall-following is not well solved by purely linear decision surfaces without history.
"""
    )


@app.cell(hide_code=True)
def uci_load(L):
    url = "https://archive.ics.uci.edu/ml/machine-learning-databases/00194/sensor_readings_4.data"
    text = L.urlopen(url, timeout=120).read().decode("utf-8")
    df = L.pl.read_csv(L.StringIO(text), has_header=False)
    names = ["sd_front", "sd_left", "sd_right", "sd_back", "label"]
    old = list(df.columns)
    df = df.rename(dict(zip(old, names)))
    return df


@app.cell(hide_code=True)
def uci_eda(L, df):
    counts = df.group_by("label").len().sort("label")
    lines = [
        f"- **{row['label']}**: {row['len']} rows"
        for row in counts.iter_rows(named=True)
    ]
    block = L.mo.md(
        "### Class frequencies\n\n" + "\n".join(lines) + f"\n\n_Total rows: {len(df)}_"
    )
    return block


@app.cell(hide_code=True)
def baseline_models(L, df):
    feat_cols = ["sd_front", "sd_left", "sd_right", "sd_back"]
    X = df.select(feat_cols).to_numpy().astype(float)
    le = L.LabelEncoder()
    y = le.fit_transform(df["label"].to_list())

    X_train, X_test, y_train, y_test = L.train_test_split(
        X, y, test_size=0.25, random_state=42, stratify=y
    )
    scaler = L.StandardScaler()
    X_train_s = scaler.fit_transform(X_train)
    X_test_s = scaler.transform(X_test)

    log_reg = L.LogisticRegression(max_iter=5000, random_state=42)
    log_reg.fit(X_train_s, y_train)
    acc_lr = L.accuracy_score(y_test, log_reg.predict(X_test_s))

    mlp = L.MLPClassifier(
        hidden_layer_sizes=(48, 24),
        max_iter=800,
        random_state=42,
        early_stopping=True,
    )
    mlp.fit(X_train_s, y_train)
    acc_mlp = L.accuracy_score(y_test, mlp.predict(X_test_s))

    static_models_md = L.mo.md(
        "### Static observations (no history)\n\n"
        f"- **Logistic regression** test accuracy: **{acc_lr:.3f}**\n"
        f"- **MLP 48→24** test accuracy: **{acc_mlp:.3f}**\n\n"
        "_Same four simplified-distance features as in the UCI 4-sensor file._"
    )
    return static_models_md


@app.cell(hide_code=True)
def lag_features_or_mlp(L, df):
    feat_cols = ["sd_front", "sd_left", "sd_right", "sd_back"]
    lag_exprs = []
    for c in feat_cols:
        for k in (1, 2, 3):
            lag_exprs.append(L.pl.col(c).shift(k).alias(f"{c}_lag{k}"))
    df_lag = df.with_columns(lag_exprs).drop_nulls()
    le = L.LabelEncoder()
    yl = le.fit_transform(df_lag["label"].to_list())
    Xl = df_lag.select([c for c in df_lag.columns if c != "label"]).to_numpy().astype(float)
    Xl_train, Xl_test, yl_train, yl_test = L.train_test_split(
        Xl, yl, test_size=0.25, random_state=42, stratify=yl
    )
    sc_lag = L.StandardScaler()
    Xl_train_s = sc_lag.fit_transform(Xl_train)
    Xl_test_s = sc_lag.transform(Xl_test)
    mlp_lag = L.MLPClassifier(
        hidden_layer_sizes=(64, 32),
        max_iter=900,
        random_state=43,
        early_stopping=True,
    )
    mlp_lag.fit(Xl_train_s, yl_train)
    acc_lag = L.accuracy_score(yl_test, mlp_lag.predict(Xl_test_s))

    lag_md = L.mo.md(
        "### Lagged observations (memory sketch)\n\n"
        f"- **MLP 64→32** on distances plus **lags 1–3**: **{acc_lag:.3f}** test accuracy\n\n"
        "_Stacking past readings mimics giving a classifier short-term memory; "
        "LeRobot episodes encode full trajectories natively instead._"
    )
    return lag_md


@app.cell(hide_code=True)
def lerobot_schema_peek(L):
    try:
        ds = L.load_dataset("lerobot/libero", split="train", streaming=True)
        row = next(iter(ds))
        keys = list(row.keys())
        preview = keys[:28]
        lines = [f"- `{k}`" for k in preview]
        extra = "" if len(keys) <= 28 else f"\n\n_…and {len(keys) - 28} more keys_"
        body = (
            "### LeRobot `lerobot/libero` (first streamed row)\n\n"
            + "\n".join(lines)
            + extra
            + "\n\n_Contrast with UCI: multimodal keys (e.g. images, state, actions) vs four floats + label._"
        )
        return L.mo.md(body)
    except Exception as e:
        return L.mo.md(
            "### LeRobot schema peek (skipped)\n\n"
            f"Could not stream `lerobot/libero` (offline or missing deps).\n\n`{type(e).__name__}: {e}`"
        )


@app.cell(hide_code=True)
def episode_shape_demo(L, df):
    slim = (
        df.with_row_index("frame_index")
        .with_columns(L.pl.lit(0).alias("episode_index"))
        .select(["episode_index", "frame_index", "sd_front", "sd_left", "label"])
        .head(8)
    )
    rows = [dict(zip(slim.columns, r)) for r in slim.iter_rows()]
    lines = ["| " + " | ".join(slim.columns) + " |", "| " + " | ".join(["---"] * len(slim.columns)) + " |"]
    for r in rows:
        lines.append("| " + " | ".join(str(r[c]) for c in slim.columns) + " |")
    tbl = "\n".join(lines)
    out = L.mo.md(
        "### UCI rows as imitation-style episodes (sketch)\n\n"
        "We add `episode_index` and `frame_index` so each row looks closer to a LeRobot timestep "
        "(single-room wall-following ⇒ one synthetic episode id `0`).\n\n"
        + tbl
    )
    return out


if __name__ == "__main__":
    app.run()
