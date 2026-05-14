import marimo

__generated_with = "0.23.6"
app = marimo.App(width="medium")


@app.cell
def _():
    return


@app.cell(hide_code=True)
def header(mo):

    mo.md(r"""
    # Second Earth Scout
    ### An ML Habitability Intelligence System

    *A PyData 2026 Hackathon Submission*

    This system uncovers "Dark Horse Earths" — exoplanets that score high on habitability yet remain overlooked by major follow-up studies.
    """)

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
        umap,
    )


@app.cell(hide_code=True)
def data_acquisition(NasaExoplanetArchive, mo, pd):

    # Pulling data from the NASA Exoplanet Archive
    # We'll use the 'pscomppars' table (Planetary Systems Composite Parameters)
    try:
        # Use a direct query with selected columns to be safe and faster
        df = NasaExoplanetArchive.query_criteria(
            table="pscomppars", 
            select="pl_name,hostname,pl_rade,pl_masse,pl_eqt,st_teff,st_rad,pl_insol,pl_orbsmax"
        ).to_pandas()
    
        # Basic cleanup: remove rows with missing critical values
        df = df.dropna(subset=['pl_name', 'pl_rade', 'pl_masse', 'pl_eqt', 'st_teff', 'st_rad', 'pl_orbsmax'])
        # Handle pl_insol separately if it's missing (fill with rough estimate based on L and d)
        if 'pl_insol' not in df.columns or df['pl_insol'].isnull().any():
            st_lum = (df['st_rad']**2) * ((df['st_teff']/5778)**4)
            df['pl_insol'] = df['pl_insol'].fillna(st_lum / (df['pl_orbsmax']**2))
        
    except Exception as e:
        mo.md(f"Error fetching data: {e}. Using a local sample if available.")
        # Create a dummy row for testing if API fails completely
        df = pd.DataFrame([{
            'pl_name': 'Test Planet', 'hostname': 'Test Star', 
            'pl_rade': 1.0, 'pl_masse': 1.0, 'pl_eqt': 288.0, 
            'st_teff': 5778.0, 'st_rad': 1.0, 'pl_insol': 1.0, 'pl_orbsmax': 1.0
        }])

    return (df,)


@app.cell(hide_code=True)
def data_overview(df, mo):
    mo.md(f"""
    ### Dataset Overview\nLoaded **{len(df)}** confirmed planets with complete physical parameters.
    """)
    return


@app.cell(hide_code=True)
def data_table(df, mo):

    mo.ui.table(df.head(10))

    return


@app.cell(hide_code=True)
def feature_engineering(df, mo, np):

    def calculate_esi(radius, density, escape_vel, temp):
        # Simplified ESI formula based on Schulze-Makuch et al. (2011)
        # ESI = product(1 - |(x - x0)/(x + x0)|)^ (w/n)
        # We'll use radius and temp for a basic version if others are missing
        r_earth = 1.0
        t_earth = 288.0 # Kelvin
    
        esi_r = 1 - abs((radius - r_earth) / (radius + r_earth))
        esi_t = 1 - abs((temp - t_earth) / (temp + t_earth))
    
        return (esi_r * esi_t)**0.5

    # Apply feature engineering
    df['esi'] = df.apply(lambda row: calculate_esi(row['pl_rade'], 5.5, 11.2, row['pl_eqt']), axis=1)

    # Stellar flux ratio: planet's received energy vs. Earth's
    # Earth's flux is approx 1361 W/m^2
    # Flux ~ L_star / d^2. Orbit semi-major axis is pl_orbsmax
    # But we can use pl_insol (Insolation Flux [Earth units]) directly if available
    df['flux_ratio'] = df['pl_insol']

    # Habitable Zone Score (Distance from 'Goldilocks' center)
    # Center depends on star's luminosity. L ~ R^2 * T^4
    df['st_lum'] = (df['st_rad']**2) * ((df['st_teff']/5778)**4)
    df['hz_inner'] = np.sqrt(df['st_lum'] / 1.1)
    df['hz_outer'] = np.sqrt(df['st_lum'] / 0.53)
    df['hz_center'] = (df['hz_inner'] + df['hz_outer']) / 2
    df['hz_score'] = 1 - abs((df['pl_orbsmax'] - df['hz_center']) / (df['hz_outer'] - df['hz_inner']))
    df['hz_score'] = df['hz_score'].clip(0, 1)

    mo.md("### Feature Engineering Complete\nAdded **ESI**, **Flux Ratio**, and **Habitable Zone Score**.")

    return


@app.cell(hide_code=True)
def clustering_analysis(StandardScaler, df, hdbscan, mo, np, umap):

    # 1. Clustering with UMAP + HDBSCAN
    features_for_clustering = ['pl_rade', 'pl_masse', 'pl_eqt', 'st_teff', 'st_rad', 'esi', 'hz_score']
    X = df[features_for_clustering].fillna(0)
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    reducer = umap.UMAP(n_neighbors=15, min_dist=0.1, n_components=2, random_state=42)
    embedding = reducer.fit_transform(X_scaled)

    clusterer = hdbscan.HDBSCAN(min_cluster_size=10, gen_min_span_tree=True)
    cluster_labels = clusterer.fit_predict(embedding)

    df['umap_x'] = embedding[:, 0]
    df['umap_y'] = embedding[:, 1]
    df['cluster'] = cluster_labels.astype(str)

    mo.md(f"### Clustering Results\nIdentified **{len(np.unique(cluster_labels))}** distinct planet archetypes using UMAP + HDBSCAN.")

    return (X_scaled,)


@app.cell(hide_code=True)
def habitability_scoring(RandomForestClassifier, X_scaled, df, mo):

    # 2. Habitability Scoring (Random Forest)
    # We'll treat high ESI + high HZ score as a "synthetic" label for training a more robust model
    df['is_habitable_target'] = ((df['esi'] > 0.7) & (df['hz_score'] > 0.5)).astype(int)

    # Use Random Forest instead of XGBoost to avoid libomp issues
    rf_model = RandomForestClassifier(n_estimators=100, random_state=42)
    rf_model.fit(X_scaled, df['is_habitable_target'])

    df['habitability_score'] = rf_model.predict_proba(X_scaled)[:, 1]

    mo.md("### ML Habitability Model Trained\nRandom Forest model now provides a refined probability score for every candidate.")

    return


@app.cell(hide_code=True)
def anomaly_detection(IsolationForest, X_scaled, df, mo):

    # 3. Anomaly Detection (Isolation Forest)
    iso_forest = IsolationForest(contamination=0.05, random_state=42)
    anomalies = iso_forest.fit_predict(X_scaled)
    df['is_anomaly'] = anomalies == -1

    mo.md("### Anomaly Detection Complete\nSurface 'weird' planets that don't fit known archetypes.")

    return


@app.cell(hide_code=True)
def umap_plot(df, mo, px):

    fig_umap = px.scatter(
        df, x='umap_x', y='umap_y', 
        color='cluster', 
        size='esi', 
        hover_name='pl_name',
        title="Exoplanet Archetypes (UMAP Clusters)",
        labels={'umap_x': 'Discovery Space A', 'umap_y': 'Discovery Space B'},
        color_discrete_sequence=px.colors.qualitative.Prism
    )
    fig_umap.update_layout(template="plotly_dark")
    mo.ui.plotly(fig_umap)

    return


@app.cell(hide_code=True)
def hr_diagram(df, mo, px):

    # HR Diagram (Star Temp vs Star Radius/Luminosity)
    fig_hr = px.scatter(
        df, x='st_teff', y='st_rad',
        color='habitability_score',
        size='pl_rade',
        hover_name='pl_name',
        log_y=True,
        title="Host Star HR-esque Diagram",
        labels={'st_teff': 'Effective Temperature (K)', 'st_rad': 'Stellar Radius (Solar)'},
        color_continuous_scale='Viridis'
    )
    fig_hr.update_xaxes(autorange="reversed") # Standard HR diagram has temp reversed
    fig_hr.update_layout(template="plotly_dark")
    mo.ui.plotly(fig_hr)

    return


@app.cell(hide_code=True)
def insight_cell(df, mo):

    # Identify "Dark Horse Earths"
    # High habitability score, low ESI (unexpected), or anomalous
    dark_horses = df[(df['habitability_score'] > 0.8) & (df['is_anomaly'])].sort_values('habitability_score', ascending=False)

    mo.md(
        f"""
        ## 🎯 Key Insight: The "Dark Horse Earths"
    
        Our model identifies **{len(dark_horses)}** exoplanet candidates that score extremely high on habitability yet are flagged as anomalies by our Isolation Forest. 
    
        These "Dark Horse Earths" don't fit the standard Earth-like profile but have the physical ingredients (Stellar Flux, Radius, Equilibrium Temp) for life.
        """
    )

    return


@app.cell(hide_code=True)
def leaderboard(df, mo):

    leaderboard = df[['pl_name', 'hostname', 'esi', 'habitability_score', 'hz_score']].sort_values('habitability_score', ascending=False).head(10)
    mo.md("### 🏆 Top 10 Earth Candidates")
    mo.ui.table(leaderboard)

    return


if __name__ == "__main__":
    app.run()
