# /// script
# dependencies = [
#   "marimo",
#   "matplotlib",
#   "numpy",
#   "pandas",
#   "scikit-learn",
# ]
# requires-python = ">=3.10"
# ///

import marimo

__generated_with = "0.23.6"
app = marimo.App(width="medium")


@app.cell(hide_code=True)
def imports():
    import marimo as mo
    import matplotlib.pyplot as plt
    import numpy as np
    import pandas as pd
    from sklearn.cluster import KMeans
    from sklearn.decomposition import PCA
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.metrics import silhouette_score
    from sklearn.metrics.pairwise import cosine_similarity

    return (
        KMeans,
        PCA,
        TfidfVectorizer,
        cosine_similarity,
        mo,
        np,
        pd,
        plt,
        silhouette_score,
    )


@app.cell(hide_code=True)
def title_card(mo):
    mo.Html(
        """
        <style>
        .hero {font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;}
        .kicker {font-size: 12px; letter-spacing: .1em; text-transform: uppercase; color: #9a3412; font-weight: 800;}
        .question {font-size: 44px; line-height: 1.03; margin: 8px 0 12px; font-weight: 850; color: #111827; max-width: 980px;}
        .sub {font-size: 17px; line-height: 1.45; color: #475467; max-width: 920px; margin: 0;}
        .chips {display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; margin-top: 18px;}
        .chip {border: 1px solid #fed7aa; border-radius: 10px; padding: 12px 14px; background: #fff7ed;}
        .chip b {display:block; font-size: 13px; color:#111827; margin-bottom: 4px;}
        .chip span {display:block; font-size: 13px; color:#475467; line-height:1.34;}
        @media (max-width: 850px) {.question {font-size: 34px;} .chips {grid-template-columns: 1fr;}}
        </style>
        <div class="hero">
          <div class="kicker">Cartography of 24 minds</div>
          <div class="question">Can a council of historical thinking styles be mapped like data?</div>
          <p class="sub">
            This notebook treats 24 Pantheon persona prompts as a tiny text corpus.
            It asks a practical data-science question: which intellectual styles are
            near one another, which are distinctive, and what clusters emerge before
            any model is asked to speak?
          </p>
          <div class="chips">
            <div class="chip"><b>Input</b><span>24 embedded persona documents.</span></div>
            <div class="chip"><b>Vectorize</b><span>TF-IDF over unigrams and bigrams.</span></div>
            <div class="chip"><b>Map</b><span>PCA projection + cosine neighbors.</span></div>
            <div class="chip"><b>Cluster</b><span>KMeans groups + silhouette check.</span></div>
          </div>
        </div>
        """
    )
    return


@app.cell
def corpus(pd):
    minds = [
        {
            "id": "einstein",
            "name": "Albert Einstein",
            "title": "The Architect of Spacetime",
            "era": "1879-1955",
            "domains": "physics relativity unification thought-experiment",
            "text": """
            picture thinking simple postulates invariance spacetime relativity photon elevator clocks moving train
            thought experiment physical scene frame measurement invariant transformation Maxwell Lorentz Mach Spinoza
            distrust ugly mathematical apparatus seek simple explanations geometric story cosmic religious feeling
            quantum probability discomfort unification symmetry observe cosmos electron child derivation
            """,
        },
        {
            "id": "godel",
            "name": "Kurt Godel",
            "title": "The Logician of Limits",
            "era": "1906-1978",
            "domains": "logic foundations metamathematics platonism",
            "text": """
            formal systems object language metalanguage axioms proof incompleteness consistency arithmetic
            self reference diagonalization fixed points undecidability foundations Platonism mathematical realism
            true statements proof cannot reach rigorous exactness Leibniz Cantor Frege Husserl limits framework
            computation artificial intelligence what system cannot see about itself
            """,
        },
        {
            "id": "feynman",
            "name": "Richard Feynman",
            "title": "The Magician of First Principles",
            "era": "1918-1988",
            "domains": "physics quantum pedagogy computation",
            "text": """
            first principles playful skepticism concrete physical pictures diagrams calculation honesty experiment
            toy model solve simplest version generalize independent check do not fool yourself path integrals
            sum over possible paths authority jargon distrust explain simply draw particle amplitude bug story
            Wheeler Dirac beauty Tuesday experiment
            """,
        },
        {
            "id": "tesla",
            "name": "Nikola Tesla",
            "title": "The Resonator",
            "era": "1856-1943",
            "domains": "electromagnetism engineering invention resonance",
            "text": """
            vivid mental prototyping rotating fields resonance alternating current wireless transmission machine
            visualize device humming oscillation natural frequency energy economy least matter most work
            invention century field fixed points standing waves Faraday vibration frequency visualization assignment
            """,
        },
        {
            "id": "turing",
            "name": "Alan Turing",
            "title": "The Founder of Machines",
            "era": "1912-1954",
            "domains": "computation logic cryptography morphogenesis",
            "text": """
            computability operational precision machine procedure effective procedure diagonalization cryptanalysis
            adversary imitation intelligence test morphogenesis biology computes substrate limits Church Hilbert
            codebreaking running well posed question operational test algorithm proves no machine exists
            """,
        },
        {
            "id": "ramanujan",
            "name": "Srinivasa Ramanujan",
            "title": "The Voice of Namagiri",
            "era": "1887-1920",
            "domains": "number theory infinite series intuition modular forms",
            "text": """
            formulae identities conjectures infinite series modular intuition numerical pattern recognition
            compute examples constants pi e golden ratio Euler Hardy proof verification devotional humility
            mathematics prayer intuition leap hidden symmetries transformation fresh conjecture
            """,
        },
        {
            "id": "vonneumann",
            "name": "John von Neumann",
            "title": "The Universal Mathematician",
            "era": "1903-1957",
            "domains": "computing game theory quantum automata economics",
            "text": """
            rapid abstraction formal structure spaces operators payoffs quantum mechanics computing architecture
            economics weather automata games cross pollinate decision uncertainty dynamical systems numerical experiment
            architecture machine prototype speed thought Hilbert Godel Ulam compute
            """,
        },
        {
            "id": "newton",
            "name": "Isaac Newton",
            "title": "The Geometer of Force",
            "era": "1643-1727",
            "domains": "mechanics calculus optics alchemy",
            "text": """
            geometry mechanics optics force calculus derive consequences observation laws heavens figure experiment
            decompose forces mathematical machinery orbits hypotheses testable consequences shoulders giants
            austere reasoning publication alchemy theological seriousness
            """,
        },
        {
            "id": "davinci",
            "name": "Leonardo da Vinci",
            "title": "The Universal Eye",
            "era": "1452-1519",
            "domains": "anatomy engineering art fluid dynamics flight",
            "text": """
            observation drawing sketch analysis anatomy machines water flight optics art engineering nature pattern
            cross pollinate sculpture hydrodynamics heart birds gears margins questions see first universal connection
            visual thinking restless curiosity
            """,
        },
        {
            "id": "curie",
            "name": "Marie Curie",
            "title": "The Patient Experimentalist",
            "era": "1867-1934",
            "domains": "radioactivity chemistry physics experimentation",
            "text": """
            calibrated measurement chemical separation signal isolation radioactivity pitchblende apparatus controls
            meticulous logs patience repeated separation laboratory experiment vary hold fixed daughters rigor
            discovery controlled experiment signal noise chemistry physics
            """,
        },
        {
            "id": "bohr",
            "name": "Niels Bohr",
            "title": "The Complementarian",
            "era": "1885-1962",
            "domains": "quantum complementarity philosophy",
            "text": """
            complementarity careful language experimental arrangement wave particle position momentum measurement
            apparent opposition truth clarity quantum knowledge wavefunction phenomenon middle extremes Einstein rivalry
            complementary pair underweighted truth
            """,
        },
        {
            "id": "dirac",
            "name": "Paul Dirac",
            "title": "The Believer in Beauty",
            "era": "1902-1984",
            "domains": "quantum relativity mathematical beauty",
            "text": """
            spare exactness mathematical beauty dimensional analysis symmetry compact equation units relativistic quantum
            positron negative energy Hamilton Riemann Maxwell minimal speech mathematics telescope formal relation
            experiment follows elegant equations
            """,
        },
        {
            "id": "poincare",
            "name": "Henri Poincare",
            "title": "The Geometer of Dynamics",
            "era": "1854-1912",
            "domains": "topology dynamical systems philosophy intuition",
            "text": """
            qualitative dynamics topology convention intuition proof phase portrait fixed points limit cycles stability
            bifurcation chaos three body problem initial conditions coordinates topology truth Klein Riemann
            closed form solution not enough
            """,
        },
        {
            "id": "riemann",
            "name": "Bernhard Riemann",
            "title": "The Sculptor of Curved Space",
            "era": "1826-1866",
            "domains": "geometry complex analysis manifolds",
            "text": """
            manifolds intrinsic geometry curved space metric structure complex plane foundational questions geometry
            Euclidean assumptions real plane complex variables foundations hypotheses zeta analytic continuation
            natural manifold problem lives
            """,
        },
        {
            "id": "lovelace",
            "name": "Ada Lovelace",
            "title": "The First Programmer",
            "era": "1815-1852",
            "domains": "algorithm computation music imagination",
            "text": """
            algorithm executable patterns analytical engine symbolic manipulation music machinery Jacquard loom
            procedure repeats varies branches machine can cannot originate poetical mechanical numbered operations
            imagination discovering faculty computation
            """,
        },
        {
            "id": "darwin",
            "name": "Charles Darwin",
            "title": "The Patient Observer",
            "era": "1809-1882",
            "domains": "evolution biology observation slow thinking",
            "text": """
            slow observation variation selection descent modification heredity differential success barnacles catalog
            collect deep time evolution replicates filtered objections steelman publish organism long watching biology
            patience natural selection
            """,
        },
        {
            "id": "maxwell",
            "name": "James Clerk Maxwell",
            "title": "The Unifier of Fields",
            "era": "1831-1879",
            "domains": "electromagnetism statistical mechanics unification",
            "text": """
            field thinking unification electricity magnetism light equations mechanical analogy scaffolding statistical reasoning
            Faraday generous synthesis dynamics complete theory one field distinct phenomena equations stand
            electromagnetic disturbance
            """,
        },
        {
            "id": "hopper",
            "name": "Grace Hopper",
            "title": "The Compiler",
            "era": "1906-1992",
            "domains": "software compilers systems naval discipline",
            "text": """
            compiler programming languages automation toil systems naval practicality nanoseconds inches wire latency tangible
            permission forgiveness computing legible people tool erases manual translation always done this way
            software measurement
            """,
        },
        {
            "id": "schrodinger",
            "name": "Erwin Schrodinger",
            "title": "The Wavefunction Whisperer",
            "era": "1887-1961",
            "domains": "quantum biology philosophy",
            "text": """
            wave mechanics continuity collapse mystery thought experiment cat biology life heredity information negentropy
            physics philosophical restlessness continuous wave descriptions conceptual seams colleagues hate cannot dismiss
            """,
        },
        {
            "id": "pasteur",
            "name": "Louis Pasteur",
            "title": "The Founder of Microbiology",
            "era": "1822-1895",
            "domains": "microbiology vaccines germ theory fermentation stereochemistry",
            "text": """
            experimental control germ theory vaccines fermentation stereochemistry swan neck flask spontaneous generation
            isolate culture attenuate pathogen virulence immune system optical activity chirality prepared chance
            Koch postulates negative control microbiology
            """,
        },
        {
            "id": "mcclintock",
            "name": "Barbara McClintock",
            "title": "The Cytogeneticist of Mobile Genes",
            "era": "1902-1992",
            "domains": "genetics cytogenetics transposable elements plant biology regulation",
            "text": """
            cytogenetics maize chromosomes transposable elements mobile genes controlling elements Ac Ds organism feeling
            kernel pigmentation variegated phenotype genome dynamic regulation stress rearrangement microscopy crosses
            watch organism visible signature
            """,
        },
        {
            "id": "cajal",
            "name": "Santiago Ramon y Cajal",
            "title": "The Draughtsman of the Brain",
            "era": "1852-1934",
            "domains": "neuroscience histology neuron doctrine observation",
            "text": """
            neuron doctrine histology drawing brain Golgi stain microscopy nervous tissue discrete cellular units
            dynamic polarization dendrite soma axon synapse growth cone morphology specimen observation draw structure
            neuroscience
            """,
        },
        {
            "id": "franklin",
            "name": "Rosalind Franklin",
            "title": "The Crystallographer of the Helix",
            "era": "1920-1958",
            "domains": "x ray crystallography structural biology virology physical chemistry",
            "text": """
            x ray fiber diffraction crystallography DNA A form B form hydration control Photo 51 layer lines
            molecular geometry primary data diffraction photograph helical parameters modeling after data structural biology
            measurement parameter control
            """,
        },
        {
            "id": "snow",
            "name": "John Snow",
            "title": "The Founder of Epidemiology",
            "era": "1813-1858",
            "domains": "epidemiology public health anesthesia medical statistics",
            "text": """
            epidemiology cholera map cases Broad Street pump exposure comparison natural experiment public health
            waterborne disease miasma reject outliers negative cases intervention remove handle population statistics
            geography mechanism
            """,
        },
        {
            "id": "pauling",
            "name": "Linus Pauling",
            "title": "The Architect of the Chemical Bond",
            "era": "1901-1994",
            "domains": "chemistry quantum chemistry structural biology molecular medicine",
            "text": """
            chemical bond quantum chemistry resonance electronegativity hybridization structure function alpha helix
            beta sheet proteins molecular disease sickle cell spectroscopy diffraction bond lengths angles model
            structural biology cross disciplines
            """,
        },
    ]

    df = pd.DataFrame(minds)
    df["document"] = df["title"] + " " + df["domains"] + " " + df["text"]
    return df, minds


@app.cell(hide_code=True)
def corpus_summary(df, mo):
    mo.md(
        f"""
        ## Dataset

        The corpus contains **{len(df)} persona documents**, one per Pantheon mind.
        Each row combines a title, domain labels, and a compact prompt summary
        distilled from the local `minds.rs` registry.

        This is not a benchmark and not a claim about the historical people.
        It is an exploratory map of the **designed prompt space**: the words used
        to make each simulated reasoning style distinct.
        """
    )
    return


@app.cell
def vectorize(TfidfVectorizer, df):
    vectorizer = TfidfVectorizer(
        stop_words="english",
        ngram_range=(1, 2),
        max_features=650,
        min_df=1,
        norm="l2",
    )
    X = vectorizer.fit_transform(df["document"])
    feature_names = vectorizer.get_feature_names_out()
    return X, feature_names, vectorizer


@app.cell
def model(KMeans, PCA, X, cosine_similarity, df, silhouette_score):
    k = 5
    km = KMeans(n_clusters=k, random_state=42, n_init=20)
    labels = km.fit_predict(X)
    similarity = cosine_similarity(X)
    coords = PCA(n_components=2, random_state=42).fit_transform(X.toarray())

    scored = df.copy()
    scored["cluster"] = labels
    scored["x"] = coords[:, 0]
    scored["y"] = coords[:, 1]
    silhouette = float(silhouette_score(X, labels, metric="cosine"))
    return coords, k, km, labels, scored, silhouette, similarity


@app.cell(hide_code=True)
def method_note(mo, silhouette):
    mo.md(
        f"""
        ## Method

        I used TF-IDF because the corpus is small and transparent. It lets us inspect
        which words drive each placement without hiding the result behind a black box.

        The KMeans silhouette score is **{silhouette:.3f}** using cosine distance.
        With only 24 designed documents, the point is not a perfect clustering score;
        the useful output is a readable map, nearest-neighbor table, and distinctive
        vocabulary for each persona.
        """
    )
    return


@app.cell
def cluster_table(pd, scored):
    cluster_table = (
        scored.sort_values(["cluster", "name"])
        .groupby("cluster")
        .agg(
            minds=("name", lambda names: ", ".join(names)),
            domains=("domains", lambda values: " | ".join(values)),
        )
        .reset_index()
    )
    cluster_table
    return cluster_table


@app.cell(hide_code=True)
def cluster_table_view(cluster_table, mo):
    mo.md("## Cluster memberships")
    return


@app.cell
def nearest_neighbors(df, pd, similarity):
    rows = []
    names = df["name"].tolist()
    for i, name in enumerate(names):
        order = similarity[i].argsort()[::-1]
        nearest = [j for j in order if j != i][:3]
        rows.append(
            {
                "mind": name,
                "nearest_1": names[nearest[0]],
                "sim_1": round(float(similarity[i, nearest[0]]), 3),
                "nearest_2": names[nearest[1]],
                "sim_2": round(float(similarity[i, nearest[1]]), 3),
                "nearest_3": names[nearest[2]],
                "sim_3": round(float(similarity[i, nearest[2]]), 3),
            }
        )

    neighbors = pd.DataFrame(rows)
    neighbors
    return neighbors


@app.cell(hide_code=True)
def neighbors_note(mo):
    mo.md(
        """
        ## Nearest neighbors

        Cosine similarity surfaces which prompt designs share vocabulary.
        The more interesting cases are not the obvious pairs alone, but the
        bridge figures: for example, computation connects Turing, Lovelace,
        von Neumann, and Hopper, while structural biology pulls Franklin and
        Pauling toward chemistry rather than generic biology.
        """
    )
    return


@app.cell
def plot_map(plt, scored):
    fig, ax = plt.subplots(figsize=(10, 7))
    scatter = ax.scatter(
        scored["x"],
        scored["y"],
        c=scored["cluster"],
        cmap="tab10",
        s=110,
        alpha=0.9,
        edgecolor="white",
        linewidth=1.0,
    )

    for _, row in scored.iterrows():
        ax.annotate(
            row["name"].split()[-1],
            (row["x"], row["y"]),
            xytext=(6, 5),
            textcoords="offset points",
            fontsize=9,
        )

    ax.set_title("PCA map of TF-IDF persona vectors", fontsize=16, pad=14)
    ax.set_xlabel("PC1")
    ax.set_ylabel("PC2")
    ax.grid(True, alpha=0.22)
    legend = ax.legend(*scatter.legend_elements(), title="Cluster", loc="best")
    ax.add_artist(legend)
    fig.tight_layout()
    fig
    return ax, fig, scatter


@app.cell
def distinctive_terms(X, df, feature_names, pd):
    rows = []
    dense = X.toarray()
    for i, row in df.iterrows():
        weights = dense[i]
        top_idx = weights.argsort()[::-1][:8]
        rows.append(
            {
                "mind": row["name"],
                "distinctive_terms": ", ".join(feature_names[j] for j in top_idx),
            }
        )

    term_table = pd.DataFrame(rows)
    term_table
    return dense, rows, term_table


@app.cell(hide_code=True)
def interpretation(mo):
    mo.md(
        """
        ## What I would use this for

        1. **Prompt QA**: if two supposedly distinct minds sit on top of each other,
           their system prompts may be too similar.
        2. **Council design**: a good multi-agent council should not only contain
           famous names; it should cover complementary reasoning modes.
        3. **Routing**: a user question can be embedded with the same vocabulary
           and routed toward the nearest styles before the expensive LLM call.

        The result is a small but useful pattern: the corpus naturally separates
        into formal-mathematical, physical-experimental, biological-medical,
        computational-systems, and observational-visual modes.
        """
    )
    return


@app.cell
def simple_router(TfidfVectorizer, cosine_similarity, df, pd, vectorizer, X):
    sample_questions = [
        "How should I test whether this disease outbreak is waterborne?",
        "Can this algorithm ever know its own limits?",
        "What experiment would isolate the hidden signal from noisy measurements?",
        "How do I automate this repetitive programming task?",
        "What geometry does this problem naturally live on?",
    ]

    q_vectors = vectorizer.transform(sample_questions)
    sims = cosine_similarity(q_vectors, X)
    route_rows = []
    for q_i, question in enumerate(sample_questions):
        best = sims[q_i].argsort()[::-1][:3]
        route_rows.append(
            {
                "question": question,
                "top_route": df.iloc[best[0]]["name"],
                "runner_up": df.iloc[best[1]]["name"],
                "third": df.iloc[best[2]]["name"],
            }
        )

    routing_demo = pd.DataFrame(route_rows)
    routing_demo
    return q_vectors, route_rows, routing_demo, sample_questions, sims


@app.cell(hide_code=True)
def closing(mo):
    mo.md(
        """
        ## Bottom line

        This notebook turns a qualitative artifact -- prompt design -- into a
        inspectable data object. The map is not "the truth" about Einstein,
        Godel, or Hopper. It is a diagnostic for whether a synthetic council
        has enough diversity in its written instructions to justify being called
        a council in the first place.
        """
    )
    return


if __name__ == "__main__":
    app.run()
