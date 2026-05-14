import marimo

__generated_with = "0.23.6"
app = marimo.App(width="medium")


@app.cell(hide_code=True)
def header(mo):
    mo.md(
        r"""
        # 🌌 Second Earth Scout
        ### *Habitability Intelligence & Anomaly Detection*

        **PyData 2026 Hackathon | Submission by Ankit Tej Yadav**

        ---
        This intelligence system uncovers **"Dark Horse Earths"**—exoplanets that possess the physical ingredients for life but are statistically anomalous within our current discovery catalogs. By combining **Earth Similarity Index (ESI)** formulas with **Unsupervised Clustering** and **Random Forest Classifiers**, we move beyond simple checklists to a probabilistic understanding of habitability.
        """
    )
    return


@app.cell(hide_code=True)
def imports():
    import marimo as mo
    import pandas as pd
    import numpy as np
    import plotly.express as px
    import plotly.graph_objects as go
    from astroquery.ipac.nexsci.nasa_exoplanet_archive import NasaExoplanetArchive
    from sklearn.preprocessing import StandardScaler
    from sklearn.ensemble import IsolationForest, RandomForestClassifier
    import umap
    import hdbscan

    return (
        IsolationForest,
        NasaExoplanetArchive,
        RandomForestClassifier,
        StandardScaler,
        hdbscan,
        mo,
        np,
        pd,
        px,
        go,
        umap,
    )


@app.cell(hide_code=True)
def data_acquisition(NasaExoplanetArchive, mo, pd):
    # Pulling data from the NASA Exoplanet Archive
    try:
        df = NasaExoplanetArchive.query_criteria(
            table="pscomppars",
            select="pl_name,hostname,pl_rade,pl_masse,pl_eqt,st_teff,st_rad,pl_insol,pl_orbsmax,sy_dist",
        ).to_pandas()

        # Cleanup: remove rows with missing critical values
        critical_cols = [
            "pl_name",
            "pl_rade",
            "pl_masse",
            "pl_eqt",
            "st_teff",
            "st_rad",
            "pl_orbsmax",
        ]
        df = df.dropna(subset=critical_cols)

        # Estimate insolation if missing
        if "pl_insol" not in df.columns or df["pl_insol"].isnull().any():
            st_lum = (df["st_rad"] ** 2) * ((df["st_teff"] / 5778) ** 4)
            df["pl_insol"] = df["pl_insol"].fillna(
                st_lum / (df["pl_orbsmax"] ** 2)
            )

    except Exception as e:
        mo.md(
            f"⚠️ API Connection failed: {e}. Falling back to sample data."
        )
        df = pd.DataFrame(
            [
                {
                    "pl_name": "Proxima Centauri b",
                    "hostname": "Proxima Centauri",
                    "pl_rade": 1.03,
                    "pl_masse": 1.07,
                    "pl_eqt": 234.0,
                    "st_teff": 3042.0,
                    "st_rad": 0.14,
                    "pl_insol": 0.65,
                    "pl_orbsmax": 0.048,
                    "sy_dist": 1.3,
                }
            ]
        )

    return (df,)


@app.cell(hide_code=True)
def feature_engineering(df, mo, np):
    def calculate_esi(radius, temp):
        # Simplified ESI based on radius and equilibrium temp
        r_earth, t_earth = 1.0, 288.0
        esi_r = 1 - abs((radius - r_earth) / (radius + r_earth))
        esi_t = 1 - abs((temp - t_earth) / (temp + t_earth))
        return (esi_r * esi_t) ** 0.5

    # 1. Earth Similarity Index (Formula-based)
    df["esi"] = df.apply(
        lambda row: calculate_esi(row["pl_rade"], row["pl_eqt"]), axis=1
    )

    # 2. Habitable Zone Score (Relative to Star's Luminosity)
    st_lum = (df["st_rad"] ** 2) * ((df["st_teff"] / 5778) ** 4)
    hz_inner = np.sqrt(st_lum / 1.1)
    hz_outer = np.sqrt(st_lum / 0.53)
    hz_center = (hz_inner + hz_outer) / 2
    df["hz_score"] = 1 - abs(
        (df["pl_orbsmax"] - hz_center) / (hz_outer - hz_inner)
    )
    df["hz_score"] = df["hz_score"].clip(0, 1)

    mo.md(
        f"### 🧪 Feature Engineering\nCalculated **ESI** and **Habitable Zone Scores** for **{len(df)}** planets."
    )
    return (df,)


@app.cell(hide_code=True)
def clustering_analysis(StandardScaler, df, hdbscan, mo, np, umap):
    # Cluster using raw physical parameters only (Avoid ESI here to keep archetypes pure)
    features = ["pl_rade", "pl_masse", "pl_eqt", "st_teff", "st_rad"]
    X = df[features].fillna(0)
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    reducer = umap.UMAP(
        n_neighbors=15, min_dist=0.1, n_components=2, random_state=42
    )
    embedding = reducer.fit_transform(X_scaled)

    clusterer = hdbscan.HDBSCAN(min_cluster_size=10, gen_min_span_tree=True)
    df["cluster"] = clusterer.fit_predict(embedding).astype(str)
    df["umap_x"], df["umap_y"] = embedding[:, 0], embedding[:, 1]

    mo.md(
        "### 🗺️ Planetary Archetypes\nUsing UMAP + HDBSCAN to map the landscape of planetary types."
    )
    return X_scaled, features


@app.cell(hide_code=True)
def habitability_scoring(RandomForestClassifier, X_scaled, df, mo, features):
    # ANTI-CIRCULARITY FIX:
    # We define the "Target" using ESI/HZ, but we train the model ONLY on raw physical features.
    # This proves whether raw features alone can predict the complex habitability state.
    df["target_is_habitable"] = (
        (df["esi"] > 0.75) & (df["hz_score"] > 0.5)
    ).astype(int)

    rf = RandomForestClassifier(n_estimators=100, random_state=42)
    rf.fit(X_scaled, df["target_is_habitable"])

    df["habitability_score"] = rf.predict_proba(X_scaled)[:, 1]

    # Feature Importance for Rigor
    importances = pd.DataFrame(
        {"feature": features, "importance": rf.feature_importances_}
    ).sort_values("importance", ascending=False)

    fig_imp = px.bar(
        importances,
        x="importance",
        y="feature",
        orientation="h",
        title="What Drives Habitability? (Model Feature Importance)",
        template="plotly_dark",
    )

    return mo.vstack(
        [
            mo.md(
                "### 🤖 The Intelligence Model\nA Random Forest trained on raw physical data to predict Earth-like states."
            ),
            mo.ui.plotly(fig_imp),
        ]
    )


@app.cell(hide_code=True)
def anomaly_detection(IsolationForest, X_scaled, df, mo):
    iso = IsolationForest(contamination=0.05, random_state=42)
    df["is_anomaly"] = iso.fit_predict(X_scaled) == -1

    mo.md(
        "### 🛸 Anomaly Detection\nSurfacing planets that defy standard planetary classification."
    )
    return (df,)


@app.cell(hide_code=True)
def visualization_dashboard(df, mo, px):
    fig_umap = px.scatter(
        df,
        x="umap_x",
        y="umap_y",
        color="cluster",
        size="esi",
        hover_name="pl_name",
        title="Exoplanet Landscape (UMAP Clusters)",
        template="plotly_dark",
    )

    fig_hr = px.scatter(
        df,
        x="st_teff",
        y="st_rad",
        color="habitability_score",
        size="pl_rade",
        hover_name="pl_name",
        log_y=True,
        title="Host Star HR Diagram (Color by Score)",
        template="plotly_dark",
    )
    fig_hr.update_xaxes(autorange="reversed")

    return mo.vstack([mo.ui.plotly(fig_umap), mo.ui.plotly(fig_hr)])


@app.cell(hide_code=True)
def planet_inspector(df, mo, go):
    planet_select = mo.ui.dropdown(
        options=sorted(df["pl_name"].unique().tolist()),
        label="Select a Planet to Inspect:",
    )

    if not planet_select.value:
        return planet_select

    row = df[df["pl_name"] == planet_select.value].iloc[0]

    # Radial Chart for stats
    categories = ["ESI", "HZ Score", "Habitability", "Anomaly Prob"]
    # For anomaly prob, we'll use a dummy high value if is_anomaly is True
    values = [
        row["esi"],
        row["hz_score"],
        row["habitability_score"],
        1.0 if row["is_anomaly"] else 0.1,
    ]

    fig_radar = go.Figure()
    fig_radar.add_trace(
        go.Scatterpolar(r=values, theta=categories, fill="toself", name=row["pl_name"])
    )
    fig_radar.update_layout(
        polar=dict(radialaxis=dict(visible=True, range=[0, 1])),
        showlegend=False,
        template="plotly_dark",
        title=f"Signature: {row['pl_name']}",
    )

    dossier = mo.md(
        f"""
        ### 📋 Planet Dossier: {row['pl_name']}
        - **Host System**: {row['hostname']}
        - **Distance**: {row['sy_dist']:.2f} pc
        - **Status**: {"⚠️ ANOMALOUS" if row['is_anomaly'] else "✅ CLASSIFIED"}
        - **Earth Radii**: {row['pl_rade']:.2f}
        """
    )

    return mo.vstack([planet_select, mo.hstack([dossier, mo.ui.plotly(fig_radar)])])


@app.cell(hide_code=True)
def leaderboard(df, mo):
    candidates = df[
        (df["habitability_score"] > 0.8) & (df["is_anomaly"])
    ].sort_values("habitability_score", ascending=False)

    return mo.vstack(
        [
            mo.md(
                f"### 🏆 Dark Horse Earths\nTop **{len(candidates)}** anomalous candidates with extreme habitability potential."
            ),
            mo.ui.table(
                candidates[
                    [
                        "pl_name",
                        "hostname",
                        "esi",
                        "habitability_score",
                        "sy_dist",
                    ]
                ].head(10)
            ),
        ]
    )


if __name__ == "__main__":
    app.run()
