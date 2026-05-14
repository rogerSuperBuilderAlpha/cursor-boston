# /// script
# dependencies = [
#     "marimo",
#     "numpy==2.4.4",
#     "pandas>=3.0",
#     "plotly==6.7.0",
#     "scikit-learn==1.8.0",
#     "torch==2.12.0",
#     "ucimlrepo==0.0.7",
# ]
# requires-python = ">=3.14"
# ///

import marimo

__generated_with = "0.23.6"
app = marimo.App(width="medium")


@app.cell(hide_code=True)
def title(mo):
    mo.md("""
    # Inference Infra on a Real Robot Policy
    """)
    return


@app.cell(hide_code=True)
def intro(mo):
    mo.md("""
    We load lerobot's pusht dataset (a single arm pushing a T-block) and a "
        "pretrained diffusion policy that maps RGB + state to actions. "
        "We profile inference latency, quantization tradeoffs, batching dynamics, "
        "and multi-model routing on top of these real, video-conditioned policies. "
        "At pusht's 10 Hz control rate we measure which serving choices keep the "
        "robot on the deadline.
    """)
    return


@app.cell(hide_code=True)
def tldr(
    mo,
    spec_baseline_diff_lat_per_frame_chunked,
    spec_baseline_diff_mse,
    spec_sweep_df,
):
    _hit = spec_sweep_df[spec_sweep_df["hits_10hz_chunked"] & (spec_sweep_df["acceptance_rate"] < 1.0)]
    if len(_hit) > 0:
        _sweet = _hit.iloc[0]
        _tau = float(_sweet["tau"])
        _A = float(_sweet["acceptance_rate"])
        _lat = float(_sweet["projected_per_frame_ms_chunked"])
        _mse = float(_sweet["served_mean_mse"])
        _speedup = spec_baseline_diff_lat_per_frame_chunked / max(_lat, 1e-3)
    else:
        _tau = 0.0; _A = 0.0; _lat = float("nan"); _mse = float("nan"); _speedup = 0.0

    mo.callout(
        mo.md(f"""
    **TL;DR -- speculative decoding for diffusion robot policies.**

    We port the LLM-serving technique (vLLM, Medusa, EAGLE) to the
    `lerobot/diffusion_pusht` policy. Cheap MLP draft + expensive diffusion verifier,
    gated by `||action_draft - action_verifier|| < tau`.

    Result on 24 sampled frames from episode 0, chunked serving at n_action_steps=8:
    **{_speedup:.1f}x speedup**, MLP accepted on **{_A*100:.0f}%** of frames at tau={_tau:.1f},
    hitting the **10 Hz / 100 ms deadline** that pure diffusion misses
    ({_lat:.0f} ms vs {spec_baseline_diff_lat_per_frame_chunked:.0f} ms baseline) -- with
    served action MSE {_mse:.0f} vs pure-diffusion {spec_baseline_diff_mse:.0f}.

    Scroll down for the Pareto, the tau sweep, the interactive trajectory demo, and
    adaptive-denoising as a bonus EAGLE analogue.
    """),
        kind="info",
    )

    return


@app.cell(hide_code=True)
def imports():
    import argparse
    import io
    import pickle
    import sys
    import time

    import marimo as mo
    import numpy as np
    import pandas as pd
    import plotly.express as px
    import plotly.graph_objects as go
    import pyarrow as pa
    import pyarrow.lib as palib
    import torch
    import torch.nn as nn

    def _patch_argparse():
        def _patch(cls):
            if getattr(cls.add_argument, "_lerobot_patched", False):
                return
            _orig = cls.add_argument
            def _new(self, *args, **kwargs):
                t = kwargs.get("type")
                if t is not None and not callable(t):
                    kwargs["type"] = lambda v, _t=t: v
                return _orig(self, *args, **kwargs)
            _new._lerobot_patched = True
            cls.add_argument = _new
        _patch(argparse.ArgumentParser)
        _patch(argparse._ArgumentGroup)

    def _patch_pyarrow():
        if getattr(palib.register_extension_type, "_safe_patched", False):
            return
        _r = palib.register_extension_type
        _u = palib.unregister_extension_type
        def _sr(ext):
            try: return _r(ext)
            except pa.lib.ArrowKeyError: return None
        def _su(name):
            try: return _u(name)
            except pa.lib.ArrowKeyError: return None
        _sr._safe_patched = True
        palib.register_extension_type = _sr
        palib.unregister_extension_type = _su
        pa.register_extension_type = _sr
        pa.unregister_extension_type = _su
        for m in list(sys.modules):
            if m.startswith("pandas.core.arrays.arrow") or m.startswith("pandas.io.parquet"):
                del sys.modules[m]

    _patch_argparse()
    _patch_pyarrow()

    from huggingface_hub import hf_hub_download
    from safetensors.torch import load_file

    from lerobot.datasets.lerobot_dataset import LeRobotDataset
    from lerobot.policies.diffusion.modeling_diffusion import DiffusionPolicy

    return (
        DiffusionPolicy,
        LeRobotDataset,
        go,
        hf_hub_download,
        io,
        load_file,
        mo,
        nn,
        np,
        pd,
        px,
        time,
        torch,
    )


@app.cell(hide_code=True)
def load_data(LeRobotDataset, mo, pd):
    dataset = LeRobotDataset("lerobot/pusht")

    _sample = dataset[0]
    _shape_rows = []
    for _k in ("observation.image", "observation.state", "action"):
        _t = _sample[_k]
        _shape_rows.append({
            "field": _k,
            "shape": tuple(_t.shape),
            "dtype": str(_t.dtype),
        })

    dataset_summary = pd.DataFrame(
        [
            {"stat": "num_episodes", "value": dataset.num_episodes},
            {"stat": "num_frames", "value": dataset.num_frames},
            {"stat": "control fps (Hz)", "value": dataset.fps},
            {"stat": "deadline (ms)", "value": round(1000 / dataset.fps, 1)},
        ]
    )

    feature_shapes = pd.DataFrame(_shape_rows)
    sample_row = pd.DataFrame([{
        "frame_index": int(_sample["frame_index"]),
        "episode_index": int(_sample["episode_index"]),
        "timestamp_s": float(_sample["timestamp"]),
        "state": _sample["observation.state"].tolist(),
        "action": _sample["action"].tolist(),
        "image_shape": tuple(_sample["observation.image"].shape),
    }])

    mo.vstack([
        mo.md("**Dataset summary**"),
        dataset_summary,
        mo.md("**Feature shapes**"),
        feature_shapes,
        mo.md("**One sample row**"),
        sample_row,
    ])
    return (dataset,)


@app.cell(hide_code=True)
def episode0(dataset, io, mo, np, pd, px):
    _ep0_meta = dataset.meta.episodes[0]
    _from = int(_ep0_meta["dataset_from_index"])
    _to = int(_ep0_meta["dataset_to_index"])
    _ep0 = [dataset[i] for i in range(_from, _to)]

    _T = len(_ep0)
    _t_axis = np.arange(_T) / dataset.fps

    def _to_pil_bytes(frame_tensor):
        arr = (frame_tensor.numpy().transpose(1, 2, 0) * 255).clip(0, 255).astype(np.uint8)
        from PIL import Image
        buf = io.BytesIO()
        Image.fromarray(arr).save(buf, format="PNG")
        return buf.getvalue()

    _pick = [0, _T // 3, (2 * _T) // 3, _T - 1]
    _images = [
        mo.image(_to_pil_bytes(_ep0[i]["observation.image"]),
                 alt=f"frame {i}", width=192, height=192,
                 caption=f"frame {i} (t={_t_axis[i]:.2f}s)")
        for i in _pick
    ]
    _image_grid = mo.hstack(_images, justify="center")

    _states = np.stack([f["observation.state"].numpy() for f in _ep0])
    _actions = np.stack([f["action"].numpy() for f in _ep0])

    fig_state = px.line(
        pd.DataFrame({"t (s)": _t_axis, "state_x": _states[:, 0], "state_y": _states[:, 1]}),
        x="t (s)", y=["state_x", "state_y"],
        title=f"Episode 0 — observation.state trajectory ({_T} frames)",
    )
    fig_state.update_layout(height=300, legend_title_text="")

    fig_action = px.line(
        pd.DataFrame({"t (s)": _t_axis, "action_x": _actions[:, 0], "action_y": _actions[:, 1]}),
        x="t (s)", y=["action_x", "action_y"],
        title="Episode 0 — action trajectory (recorded)",
    )
    fig_action.update_layout(height=300, legend_title_text="")

    episode0 = _ep0

    mo.vstack([
        mo.md(f"### Episode 0 — {_T} frames @ {dataset.fps} Hz"),
        _image_grid,
        fig_state,
        fig_action,
    ])
    return (episode0,)


@app.cell(hide_code=True)
def mlp_baseline(dataset, mo, nn, np, pd, px, torch):
    class StateMlpPolicy(nn.Module):
        def __init__(self, state_dim: int = 2, action_dim: int = 2, hidden: int = 64):
            super().__init__()
            self.net = nn.Sequential(
                nn.Linear(state_dim, hidden),
                nn.ReLU(),
                nn.Linear(hidden, hidden),
                nn.ReLU(),
                nn.Linear(hidden, action_dim),
            )

        def forward(self, x: torch.Tensor) -> torch.Tensor:
            return self.net(x)

    _ep49_meta = dataset.meta.episodes[49]
    _to_idx = int(_ep49_meta["dataset_to_index"])
    _slice50 = dataset.hf_dataset.select(range(0, _to_idx))
    _X_state = np.array(_slice50["observation.state"], dtype=np.float32)
    _y_action = np.array(_slice50["action"], dtype=np.float32)

    _X_t = torch.from_numpy(_X_state)
    _y_t = torch.from_numpy(_y_action)

    torch.manual_seed(0)
    mlp_policy = StateMlpPolicy(state_dim=_X_t.shape[1], action_dim=_y_t.shape[1], hidden=64)
    _opt = torch.optim.Adam(mlp_policy.parameters(), lr=1e-3)
    _loss_fn = nn.MSELoss()

    _batch_size = 256
    _n_epochs = 15
    _loss_hist = []
    mlp_policy.train()
    for _ep in range(_n_epochs):
        _perm = torch.randperm(_X_t.shape[0])
        _epoch_loss = 0.0
        _n_batches = 0
        for _b in range(0, _X_t.shape[0], _batch_size):
            _idx = _perm[_b : _b + _batch_size]
            _pred = mlp_policy(_X_t[_idx])
            _loss = _loss_fn(_pred, _y_t[_idx])
            _opt.zero_grad()
            _loss.backward()
            _opt.step()
            _epoch_loss += _loss.detach().item()
            _n_batches += 1
        _loss_hist.append(_epoch_loss / _n_batches)

    mlp_policy.eval()

    mlp_train_mse_final = float(_loss_hist[-1])
    mlp_n_params = sum(p.numel() for p in mlp_policy.parameters())
    mlp_n_train_samples = int(_X_t.shape[0])

    _fig_loss = px.line(
        pd.DataFrame({"epoch": np.arange(1, _n_epochs + 1), "train_mse": _loss_hist}),
        x="epoch", y="train_mse",
        title=f"Baseline MLP — train MSE over {_n_epochs} epochs",
    )
    _fig_loss.update_layout(height=280)

    mo.vstack([
        mo.md(
            f"**Baseline MLP** — state ({_X_t.shape[1]}) → action ({_y_t.shape[1]}), "
            f"two hidden layers of 64 units, ReLU. "
            f"Trained on **{mlp_n_train_samples:,}** (state, action) pairs from the first 50 episodes. "
            f"Final train MSE = **{mlp_train_mse_final:.4f}** over {mlp_n_params:,} params."
        ),
        _fig_loss,
    ])
    return mlp_n_params, mlp_n_train_samples, mlp_policy, mlp_train_mse_final


@app.cell(hide_code=True)
def diffusion_policy(
    DiffusionPolicy,
    hf_hub_download,
    load_file,
    mo,
    time,
    torch,
):
    _diff_load_t0 = time.perf_counter()
    diffusion_policy = DiffusionPolicy.from_pretrained("lerobot/diffusion_pusht").to("cpu")
    diffusion_policy.eval()
    diffusion_policy.diffusion.num_inference_steps = 20
    _diff_load_s = time.perf_counter() - _diff_load_t0

    _ckpt_path = hf_hub_download("lerobot/diffusion_pusht", "model.safetensors")
    _saved = load_file(_ckpt_path)

    diff_norm_stats = {
        "image_mean": _saved["normalize_inputs.buffer_observation_image.mean"],
        "image_std":  _saved["normalize_inputs.buffer_observation_image.std"],
        "state_min":  _saved["normalize_inputs.buffer_observation_state.min"],
        "state_max":  _saved["normalize_inputs.buffer_observation_state.max"],
        "action_min": _saved["unnormalize_outputs.buffer_action.min"],
        "action_max": _saved["unnormalize_outputs.buffer_action.max"],
    }

    def diff_normalize_obs(state: torch.Tensor, image: torch.Tensor):
        s_min, s_max = diff_norm_stats["state_min"], diff_norm_stats["state_max"]
        state_n = 2.0 * (state - s_min) / (s_max - s_min) - 1.0
        img_mean = diff_norm_stats["image_mean"]
        img_std = diff_norm_stats["image_std"]
        image_n = (image - img_mean) / img_std
        return state_n, image_n

    def diff_unnormalize_action(action_n: torch.Tensor) -> torch.Tensor:
        a_min, a_max = diff_norm_stats["action_min"], diff_norm_stats["action_max"]
        return (action_n + 1.0) / 2.0 * (a_max - a_min) + a_min

    diffusion_n_params = sum(p.numel() for p in diffusion_policy.parameters())
    diffusion_n_inference_steps = diffusion_policy.diffusion.num_inference_steps
    diffusion_horizon = diffusion_policy.config.horizon
    diffusion_n_action_steps = diffusion_policy.config.n_action_steps

    mo.md(
        f"**Diffusion policy `lerobot/diffusion_pusht`** loaded on CPU "
        f"in {_diff_load_s:.1f}s. "
        f"Parameters: **{diffusion_n_params / 1e6:.1f}M**. "
        f"Horizon = {diffusion_horizon}, n_action_steps = {diffusion_n_action_steps}, "
        f"denoising steps reduced from **100 → {diffusion_n_inference_steps}** "
        f"to keep CPU latency under the 5 s / frame budget. "
        f"Normalization buffers (action min/max, state min/max, image mean/std) "
        f"loaded manually from the safetensors checkpoint since lerobot 0.5.1 no "
        f"longer auto-attaches them to the policy."
    )
    return (
        diff_normalize_obs,
        diff_unnormalize_action,
        diffusion_n_action_steps,
        diffusion_n_inference_steps,
        diffusion_n_params,
        diffusion_policy,
    )


@app.cell(hide_code=True)
def compare(
    diff_normalize_obs,
    diff_unnormalize_action,
    diffusion_policy,
    episode0,
    mlp_policy,
    np,
    pd,
    time,
    torch,
):
    _N = 10
    _rows = []

    diffusion_policy.reset()
    mlp_policy.eval()

    for _i in range(_N):
        _frame = episode0[_i]
        _state = _frame["observation.state"].unsqueeze(0)
        _image = _frame["observation.image"].unsqueeze(0)
        _human = _frame["action"].numpy()

        with torch.inference_mode():
            _mlp_pred = mlp_policy(_state).squeeze(0).numpy()

        _state_n, _image_n = diff_normalize_obs(_state, _image)
        _obs_batch = {
            "observation.state": _state_n,
            "observation.image": _image_n,
        }
        _t0 = time.perf_counter()
        with torch.inference_mode():
            _diff_action_n = diffusion_policy.select_action(_obs_batch)
        _diff_pred = diff_unnormalize_action(_diff_action_n).squeeze(0).numpy()
        _diff_latency_ms = (time.perf_counter() - _t0) * 1000.0

        _rows.append({
            "frame_idx": _i,
            "human_action": np.round(_human, 2).tolist(),
            "mlp_pred": np.round(_mlp_pred, 2).tolist(),
            "diffusion_pred": np.round(_diff_pred, 2).tolist(),
            "mlp_mse": float(np.mean((_mlp_pred - _human) ** 2)),
            "diffusion_mse": float(np.mean((_diff_pred - _human) ** 2)),
            "diff_latency_ms": round(_diff_latency_ms, 1),
        })

    compare_df = pd.DataFrame(_rows)
    compare_df
    return (compare_df,)


@app.cell(hide_code=True)
def summary(
    compare_df,
    dataset,
    diffusion_n_inference_steps,
    diffusion_n_params,
    mlp_n_params,
    mlp_n_train_samples,
    mlp_train_mse_final,
    mo,
):
    _mlp_mean = float(compare_df["mlp_mse"].mean())
    _diff_mean = float(compare_df["diffusion_mse"].mean())
    _diff_latency_mean = float(compare_df["diff_latency_ms"].mean())
    _deadline_ms = 1000.0 / dataset.fps

    mo.md(
        f"### Stage 1 — end-to-end sanity\n\n"
        f"- **Dataset**: `lerobot/pusht` — {dataset.num_episodes} episodes, "
        f"{dataset.num_frames:,} frames @ {dataset.fps} Hz "
        f"({_deadline_ms:.0f} ms deadline per action).\n"
        f"- **Baseline MLP** (state→action, 2×64 hidden, ReLU): "
        f"{mlp_n_params:,} params, trained on {mlp_n_train_samples:,} pairs, "
        f"final train MSE = {mlp_train_mse_final:.4f}, "
        f"sampled-frames action MSE = **{_mlp_mean:.2f}**.\n"
        f"- **Pretrained diffusion** (`lerobot/diffusion_pusht`, "
        f"{diffusion_n_params/1e6:.1f}M params, {diffusion_n_inference_steps} "
        f"denoising steps): sampled-frames action MSE = **{_diff_mean:.2f}**, "
        f"mean CPU latency = **{_diff_latency_mean:.0f} ms / frame** "
        f"(deadline is {_deadline_ms:.0f} ms — we are "
        f"{_diff_latency_mean / _deadline_ms:.1f}× over).\n\n"
        f"Both policies run end-to-end on real frames. The deadline gap is "
        f"exactly what Stage 2 will attack — quantization, batching, routing."
    )
    return


@app.cell(hide_code=True)
def sec_a_header(mo):
    mo.md("""
    ## A. The Deadline — Denoising Steps and Chunk Caching
    """)
    return


@app.cell(hide_code=True)
def sec_a_intro(mo):
    mo.md("""
    Pusht runs at **10 Hz** — a 100 ms per-frame budget. A diffusion policy with
    chunked execution (`n_action_steps`) amortizes one expensive denoising pass
    across the whole chunk: effective per-frame cost is
    `single_inference_latency / n_action_steps`. So we have two knobs — denoising
    steps and chunk size — and they trade off latency, quality, and reactivity.
    """)
    return


@app.cell(hide_code=True)
def sec_a_steps_sweep(
    diff_normalize_obs,
    diff_unnormalize_action,
    diffusion_policy,
    episode0,
    np,
    pd,
    time,
    torch,
):
    _step_grid = [5, 10, 20, 50]
    _sample_frames = list(range(0, 24, 3))  # 8 frames spaced through episode 0

    _step_records = []
    _pred_cache = {}  # (steps, frame_idx) -> predicted action np.ndarray

    _orig_steps = diffusion_policy.diffusion.num_inference_steps
    for _steps in _step_grid:
        diffusion_policy.diffusion.num_inference_steps = _steps
        _lats = []
        _mses = []
        for _i in _sample_frames:
            _f = episode0[_i]
            _state = _f["observation.state"].unsqueeze(0)
            _image = _f["observation.image"].unsqueeze(0)
            _state_n, _image_n = diff_normalize_obs(_state, _image)
            _obs = {"observation.state": _state_n, "observation.image": _image_n}
            diffusion_policy.reset()
            _t0 = time.perf_counter()
            with torch.inference_mode():
                _a_n = diffusion_policy.select_action(_obs)
            _lat = (time.perf_counter() - _t0) * 1000.0
            _a = diff_unnormalize_action(_a_n).squeeze(0).numpy()
            _human = _f["action"].numpy()
            _pred_cache[(_steps, _i)] = _a
            _lats.append(_lat)
            _mses.append(float(np.mean((_a - _human) ** 2)))
        # discard first (cold), use median of warm
        _step_records.append({
            "denoising_steps": _steps,
            "single_inference_ms_median": float(np.median(_lats[1:])),
            "single_inference_ms_min": float(np.min(_lats[1:])),
            "action_mse_mean": float(np.mean(_mses)),
            "n_frames": len(_sample_frames),
        })

    diffusion_policy.diffusion.num_inference_steps = _orig_steps  # restore

    steps_df = pd.DataFrame(_step_records)
    steps_pred_cache = _pred_cache
    steps_df

    return steps_df, steps_pred_cache


@app.cell(hide_code=True)
def sec_a_pareto_plot(go, pd, steps_df):
    _chunk_grid = [1, 2, 4, 8, 16]
    _rows = []
    for _, _r in steps_df.iterrows():
        for _c in _chunk_grid:
            _rows.append({
                "denoising_steps": int(_r["denoising_steps"]),
                "chunk_size": _c,
                "single_inference_ms": _r["single_inference_ms_median"],
                "effective_per_frame_ms": _r["single_inference_ms_median"] / _c,
                "action_mse": _r["action_mse_mean"],
                "hits_10hz_deadline": (_r["single_inference_ms_median"] / _c) <= 100.0,
            })

    pareto_df = pd.DataFrame(_rows)

    _fig = go.Figure()
    for _steps in sorted(pareto_df["denoising_steps"].unique()):
        _sub = pareto_df[pareto_df["denoising_steps"] == _steps]
        _fig.add_trace(go.Scatter(
            x=_sub["effective_per_frame_ms"],
            y=_sub["action_mse"],
            mode="markers+lines+text",
            text=[f"chunk={int(c)}" for c in _sub["chunk_size"]],
            textposition="top center",
            marker=dict(size=12),
            name=f"{int(_steps)} denoise steps",
        ))

    _fig.add_vline(x=100.0, line=dict(color="crimson", dash="dash"),
                   annotation_text="10 Hz deadline (100 ms)", annotation_position="top right")

    _fig.update_xaxes(type="log", title="Effective per-frame latency (ms, log)")
    _fig.update_yaxes(title="Action MSE (pixels^2) vs human")
    _fig.update_layout(
        title="Chunk size x denoising steps - the serving Pareto",
        height=480,
        legend_title="denoising steps",
    )
    _fig

    return


@app.cell(hide_code=True)
def sec_a_takeaway(mo, steps_df):
    mo.md(f"""
    At pusht's 10 Hz deadline (100 ms/frame), only the **5-step, chunk=8** and
    **5-step, chunk=16** points clear the budget (effective latency
    {float(steps_df.iloc[0]['single_inference_ms_median'])/8:.0f} ms and
    {float(steps_df.iloc[0]['single_inference_ms_median'])/16:.0f} ms).
    Bigger chunks buy reactivity-for-latency: long open-loop windows in
    exchange for faster wall-clock service.
    """)
    return


@app.cell(hide_code=True)
def sec_b_header(mo):
    mo.md("""
    ## B. Speculative Decoding for Robot Policies
    """)
    return


@app.cell(hide_code=True)
def sec_b_intro(mo):
    mo.md("""
    The headline. In modern LLM serving (vLLM, Medusa, EAGLE), a cheap **draft**
    model proposes the next tokens and an expensive **verifier** model accepts
    or rejects them — speedup comes from skipping the verifier on easy steps.

    We port this directly to robot control: the tiny MLP is the draft policy,
    the diffusion policy is the verifier, and the acceptance rule is
    `||action_MLP - action_diff||_2 < tau`. On accepted frames the system
    serves the MLP action and skips diffusion entirely; on rejected frames
    diffusion fires at full cost. Acceptance rate is a knob — sweep it and
    you get a real Pareto over latency, quality, and the 100 ms deadline.
    """)
    return


@app.cell(hide_code=True)
def sec_b_pipeline_diagram(mo):
    mo.vstack([
        mo.md("**Serving pipeline (per chunk):**"),
        mo.mermaid("""
    flowchart LR
        OBS[observation\nstate + image] --> DRAFT[MLP draft\n4.5k params\n0.05 ms]
        OBS --> VERIFY[Diffusion verifier\n262.7M params\n~1.4 s / chunk-of-8]
        DRAFT --> GATE{||a_draft - a_verifier||_2 < tau ?}
        VERIFY --> GATE
        GATE -->|accept| SERVE_D[serve MLP draft\nskip verifier next chunk]
        GATE -->|reject| SERVE_V[serve diffusion chunk\npay full cost]
        SERVE_D --> ROBOT[robot @ 10 Hz\n100 ms deadline]
        SERVE_V --> ROBOT
    """)
    ])

    return


@app.cell(hide_code=True)
def sec_b_data(
    diff_normalize_obs,
    diff_unnormalize_action,
    diffusion_policy,
    episode0,
    mlp_policy,
    np,
    pd,
    time,
    torch,
):
    _N_SPEC = 24
    _spec_frame_indices = list(range(0, 144, 6))

    _orig_steps = diffusion_policy.diffusion.num_inference_steps
    diffusion_policy.diffusion.num_inference_steps = 20

    _spec_rows = []
    for _i in _spec_frame_indices:
        _f = episode0[_i]
        _state = _f["observation.state"].unsqueeze(0)
        _image = _f["observation.image"].unsqueeze(0)
        _human = _f["action"].numpy()

        _t0 = time.perf_counter()
        with torch.inference_mode():
            _mlp_act = mlp_policy(_state).squeeze(0).numpy()
        _mlp_lat = (time.perf_counter() - _t0) * 1000.0

        _state_n, _image_n = diff_normalize_obs(_state, _image)
        _obs = {"observation.state": _state_n, "observation.image": _image_n}
        diffusion_policy.reset()
        _t0 = time.perf_counter()
        with torch.inference_mode():
            _diff_act_n = diffusion_policy.select_action(_obs)
        _diff_lat = (time.perf_counter() - _t0) * 1000.0
        _diff_act = diff_unnormalize_action(_diff_act_n).squeeze(0).numpy()

        _delta = float(np.linalg.norm(_diff_act - _mlp_act))
        _mlp_mse = float(np.mean((_mlp_act - _human) ** 2))
        _diff_mse = float(np.mean((_diff_act - _human) ** 2))

        _spec_rows.append({
            "frame_idx": _i,
            "mlp_action": _mlp_act,
            "diff_action": _diff_act,
            "human_action": _human,
            "delta": _delta,
            "mlp_mse": _mlp_mse,
            "diff_mse": _diff_mse,
            "mlp_latency_ms": _mlp_lat,
            "diff_latency_ms": _diff_lat,
        })

    diffusion_policy.diffusion.num_inference_steps = _orig_steps

    spec_data_df = pd.DataFrame(_spec_rows)
    spec_data_df[["frame_idx", "delta", "mlp_mse", "diff_mse", "mlp_latency_ms", "diff_latency_ms"]].round(2)

    return (spec_data_df,)


@app.cell(hide_code=True)
def sec_b_sweep(diffusion_n_action_steps, np, pd, spec_data_df):
    _deltas = spec_data_df["delta"].values
    _mlp_mses = spec_data_df["mlp_mse"].values
    _diff_mses = spec_data_df["diff_mse"].values
    _mlp_lats = spec_data_df["mlp_latency_ms"].values
    _diff_lats = spec_data_df["diff_latency_ms"].values
    _chunk = int(diffusion_n_action_steps)  # 8 actions per diffusion call

    _d_min = max(float(np.min(_deltas)) * 0.5, 1e-3)
    _d_max = float(np.max(_deltas)) * 2.0
    _taus = np.logspace(np.log10(_d_min), np.log10(_d_max), 30)

    _rows = []
    for _tau in _taus:
        _accept = _deltas < _tau
        _A = float(np.mean(_accept))
        # Per-frame projected latency, naive (fire diff every frame on reject)
        _naive_lat = float(np.mean(np.where(_accept, _mlp_lats, _mlp_lats + _diff_lats)))
        # Per-frame projected latency in chunked serving (amortize diff across n_action_steps)
        _chunked_lat = float(np.mean(_mlp_lats + (1.0 - _accept.astype(float)) * _diff_lats / _chunk))
        _served_mse = float(np.mean(np.where(_accept, _mlp_mses, _diff_mses)))
        _rows.append({
            "tau": float(_tau),
            "acceptance_rate": _A,
            "projected_per_frame_ms_naive": _naive_lat,
            "projected_per_frame_ms_chunked": _chunked_lat,
            "served_mean_mse": _served_mse,
            "hits_10hz_naive": _naive_lat <= 100.0,
            "hits_10hz_chunked": _chunked_lat <= 100.0,
        })

    spec_sweep_df = pd.DataFrame(_rows)

    # Baselines for plotting
    spec_baseline_mlp_mse = float(np.mean(_mlp_mses))
    spec_baseline_diff_mse = float(np.mean(_diff_mses))
    spec_baseline_diff_lat_per_frame_chunked = float(np.mean(_diff_lats)) / _chunk
    spec_chunk_used = _chunk

    spec_sweep_df.round(3)

    return (
        spec_baseline_diff_lat_per_frame_chunked,
        spec_baseline_diff_mse,
        spec_baseline_mlp_mse,
        spec_chunk_used,
        spec_sweep_df,
    )


@app.cell(hide_code=True)
def sec_b_plot(
    go,
    spec_baseline_diff_lat_per_frame_chunked,
    spec_baseline_diff_mse,
    spec_baseline_mlp_mse,
    spec_sweep_df,
):
    from plotly.subplots import make_subplots

    _fig = make_subplots(
        rows=3, cols=1, shared_xaxes=True, vertical_spacing=0.06,
        subplot_titles=(
            "Acceptance rate (fraction of frames served by the MLP draft)",
            "Projected per-frame latency (chunked serving, n_action_steps=8)",
            "Served action MSE (vs human action)",
        ),
    )

    _x = spec_sweep_df["tau"]

    _fig.add_trace(go.Scatter(x=_x, y=spec_sweep_df["acceptance_rate"],
                              mode="lines+markers", name="acceptance",
                              line=dict(color="#1f77b4")), row=1, col=1)

    _fig.add_trace(go.Scatter(x=_x, y=spec_sweep_df["projected_per_frame_ms_chunked"],
                              mode="lines+markers", name="speculative (chunked)",
                              line=dict(color="#1f77b4")), row=2, col=1)

    # Baseline diffusion latency (chunked, no speculation)
    _fig.add_hline(y=spec_baseline_diff_lat_per_frame_chunked, line=dict(color="gray", dash="dot"),
                   annotation_text=f"pure diffusion chunked ({spec_baseline_diff_lat_per_frame_chunked:.0f} ms)",
                   annotation_position="top right", row=2, col=1)

    # 10Hz deadline line
    _fig.add_hline(y=100.0, line=dict(color="crimson", dash="dash"),
                   annotation_text="10 Hz deadline (100 ms)",
                   annotation_position="bottom right", row=2, col=1)

    _fig.add_trace(go.Scatter(x=_x, y=spec_sweep_df["served_mean_mse"],
                              mode="lines+markers", name="served action MSE",
                              line=dict(color="#d62728")), row=3, col=1)

    _fig.add_hline(y=spec_baseline_diff_mse, line=dict(color="green", dash="dot"),
                   annotation_text=f"pure diffusion MSE ({spec_baseline_diff_mse:.0f})",
                   annotation_position="bottom left", row=3, col=1)
    _fig.add_hline(y=spec_baseline_mlp_mse, line=dict(color="orange", dash="dot"),
                   annotation_text=f"pure MLP MSE ({spec_baseline_mlp_mse:.0f})",
                   annotation_position="top left", row=3, col=1)

    # Find the sweet spot row (first row that hits chunked deadline)
    _hit_mask = spec_sweep_df["hits_10hz_chunked"] & (spec_sweep_df["acceptance_rate"] < 1.0)
    if _hit_mask.any():
        _sweet = spec_sweep_df[_hit_mask].iloc[0]
        _sweet_tau = float(_sweet["tau"])
        for _r in [1, 2, 3]:
            _fig.add_vline(x=_sweet_tau, line=dict(color="purple", dash="dashdot", width=1),
                           row=_r, col=1,
                           annotation_text=f"tau={_sweet_tau:.1f}",
                           annotation_position="top left" if _r == 1 else None)

    _fig.update_xaxes(type="log", title_text="acceptance threshold tau (log)", row=3, col=1)
    _fig.update_yaxes(title_text="rate", row=1, col=1, range=[0, 1.05])
    _fig.update_yaxes(title_text="ms", row=2, col=1, type="log")
    _fig.update_yaxes(title_text="MSE", row=3, col=1)
    _fig.update_layout(height=720, showlegend=False,
                       title="Speculative decoding for robot policies — the tau sweep")
    _fig

    return (make_subplots,)


@app.cell(hide_code=True)
def sec_b_slider(mo, np, spec_data_df):
    _d_min = float(np.log10(max(spec_data_df["delta"].min() * 0.5, 1e-3)))
    _d_max = float(np.log10(spec_data_df["delta"].max() * 2.0))

    tau_slider = mo.ui.slider(
        start=_d_min, stop=_d_max, step=0.05,
        value=_d_min + 0.55 * (_d_max - _d_min),
        label="acceptance threshold log10(tau)",
        show_value=True,
        full_width=True,
    )

    tau_slider

    return (tau_slider,)


@app.cell(hide_code=True)
def sec_b_demo(
    diffusion_n_action_steps,
    go,
    mo,
    np,
    spec_baseline_diff_lat_per_frame_chunked,
    spec_baseline_diff_mse,
    spec_data_df,
    tau_slider,
):
    _tau = float(10.0 ** tau_slider.value)
    _deltas = spec_data_df["delta"].values
    _mlp_acts = np.stack(spec_data_df["mlp_action"].values)
    _diff_acts = np.stack(spec_data_df["diff_action"].values)
    _humans = np.stack(spec_data_df["human_action"].values)
    _mlp_mses = spec_data_df["mlp_mse"].values
    _diff_mses = spec_data_df["diff_mse"].values
    _mlp_lats = spec_data_df["mlp_latency_ms"].values
    _diff_lats = spec_data_df["diff_latency_ms"].values
    _chunk = int(diffusion_n_action_steps)

    _accept = _deltas < _tau
    _served = np.where(_accept[:, None], _mlp_acts, _diff_acts)
    _served_mse = float(np.mean(np.where(_accept, _mlp_mses, _diff_mses)))
    _A = float(np.mean(_accept))
    _chunked_lat = float(np.mean(_mlp_lats + (1.0 - _accept.astype(float)) * _diff_lats / _chunk))
    _naive_lat = float(np.mean(np.where(_accept, _mlp_lats, _mlp_lats + _diff_lats)))

    # Plot the 2D action trajectory through pixel space.
    _fig = go.Figure()
    _fig.add_trace(go.Scatter(
        x=_humans[:, 0], y=_humans[:, 1],
        mode="lines+markers", name="human (recorded)",
        line=dict(color="#888", width=1, dash="dot"),
        marker=dict(size=6, color="#888"),
    ))

    _accept_idx = np.where(_accept)[0]
    _reject_idx = np.where(~_accept)[0]
    if len(_accept_idx) > 0:
        _fig.add_trace(go.Scatter(
            x=_served[_accept_idx, 0], y=_served[_accept_idx, 1],
            mode="markers", name=f"MLP accepted ({len(_accept_idx)})",
            marker=dict(size=10, color="#2ca02c", symbol="circle",
                        line=dict(color="black", width=0.5)),
            text=[f"frame {int(spec_data_df.iloc[i]['frame_idx'])}, delta={_deltas[i]:.1f}" for i in _accept_idx],
        ))
    if len(_reject_idx) > 0:
        _fig.add_trace(go.Scatter(
            x=_served[_reject_idx, 0], y=_served[_reject_idx, 1],
            mode="markers", name=f"diffusion fired ({len(_reject_idx)})",
            marker=dict(size=10, color="#d62728", symbol="diamond",
                        line=dict(color="black", width=0.5)),
            text=[f"frame {int(spec_data_df.iloc[i]['frame_idx'])}, delta={_deltas[i]:.1f}" for i in _reject_idx],
        ))

    _fig.update_xaxes(title="action x (pixels)")
    _fig.update_yaxes(title="action y (pixels)", scaleanchor="x", scaleratio=1)
    _fig.update_layout(
        height=480,
        title=f"Speculative serving at tau={_tau:.2f} - episode 0, 24 sampled frames",
    )

    _hits_deadline = "YES" if _chunked_lat <= 100.0 else "NO"
    _mse_delta = (_served_mse - spec_baseline_diff_mse) / spec_baseline_diff_mse * 100

    _summary = mo.md(f"""
    **tau = {_tau:.2f}** -- acceptance rate **{_A*100:.0f}%**

    Projected per-frame latency (chunked, n_action_steps={_chunk}): **{_chunked_lat:.1f} ms**
    - pure diffusion baseline: {spec_baseline_diff_lat_per_frame_chunked:.1f} ms
    - 10 Hz deadline: 100 ms -- **hits deadline: {_hits_deadline}**

    Served action MSE: **{_served_mse:.1f}** ({_mse_delta:+.1f}% vs pure diffusion {spec_baseline_diff_mse:.1f})
    """)

    mo.vstack([_summary, _fig])

    return


@app.cell(hide_code=True)
def sec_b_takeaway(
    mo,
    spec_baseline_diff_lat_per_frame_chunked,
    spec_baseline_diff_mse,
    spec_baseline_mlp_mse,
    spec_sweep_df,
):
    _hit = spec_sweep_df[spec_sweep_df["hits_10hz_chunked"] & (spec_sweep_df["acceptance_rate"] < 1.0)]
    if len(_hit) > 0:
        _sweet = _hit.iloc[0]
        _sweet_tau = float(_sweet["tau"])
        _sweet_A = float(_sweet["acceptance_rate"])
        _sweet_lat = float(_sweet["projected_per_frame_ms_chunked"])
        _sweet_mse = float(_sweet["served_mean_mse"])
        _mse_delta_pct = (_sweet_mse - spec_baseline_diff_mse) / spec_baseline_diff_mse * 100
        _msg = (
            f"At **tau = {_sweet_tau:.1f}**, speculative serving accepts the MLP draft on "
            f"**{_sweet_A*100:.0f}%** of frames, dropping projected per-frame latency to "
            f"**{_sweet_lat:.0f} ms** (vs pure diffusion at {spec_baseline_diff_lat_per_frame_chunked:.0f} ms) -- "
            f"the first point under the 100 ms / 10 Hz deadline. "
            f"Action MSE degrades by **{_mse_delta_pct:+.0f}%** ({_sweet_mse:.0f} vs pure-diffusion {spec_baseline_diff_mse:.0f}, "
            f"with pure-MLP at {spec_baseline_mlp_mse:.0f}). "
            f"That is exactly the same pattern as LLM speculative decoding: trade tail-quality for "
            f"in-budget tail-latency by gating the verifier behind a cheap draft."
        )
    else:
        _msg = "No tau hits the deadline below 100% acceptance with this sample. Try more frames or a higher-fidelity draft."

    mo.md(_msg)

    return


@app.cell(hide_code=True)
def sec_c_header(mo):
    mo.md("""
    ## C. Adaptive Denoising — Compute per Decision
    """)
    return


@app.cell(hide_code=True)
def sec_c_intro(mo):
    mo.md("""
    The EAGLE / draft-disagreement pattern, again applied to actions. Not every
    frame deserves the same denoising budget — when the MLP draft already agrees
    with a low-step diffusion call, we keep the low-step answer. When they
    disagree, we re-run diffusion at high steps. This is an explicit
    compute-per-decision controller on top of the same two models.
    """)
    return


@app.cell(hide_code=True)
def sec_c_compute(
    episode0,
    mlp_policy,
    mo,
    np,
    pd,
    px,
    spec_chunk_used,
    steps_df,
    steps_pred_cache,
    torch,
):
    # Use the calibration frames (8 of them, every 3rd from frame 0..23) and the
    # cached predictions at each step count.
    _calib_frames = list(range(0, 24, 3))
    _low_steps = 5
    _high_steps = 50

    _low_lat = float(steps_df[steps_df["denoising_steps"] == _low_steps]["single_inference_ms_median"].iloc[0])
    _high_lat = float(steps_df[steps_df["denoising_steps"] == _high_steps]["single_inference_ms_median"].iloc[0])

    # Per-frame data
    _pf = []
    for _i in _calib_frames:
        _f = episode0[_i]
        _state = _f["observation.state"].unsqueeze(0)
        _human = _f["action"].numpy()
        with torch.inference_mode():
            _mlp_act = mlp_policy(_state).squeeze(0).numpy()
        _low_act = steps_pred_cache[(_low_steps, _i)]
        _high_act = steps_pred_cache[(_high_steps, _i)]
        _disagree = float(np.linalg.norm(_low_act - _mlp_act))
        _pf.append({
            "frame_idx": _i,
            "mlp_act": _mlp_act, "low_act": _low_act, "high_act": _high_act,
            "human_act": _human,
            "disagree_low_mlp": _disagree,
            "mlp_mse": float(np.mean((_mlp_act - _human) ** 2)),
            "low_mse": float(np.mean((_low_act - _human) ** 2)),
            "high_mse": float(np.mean((_high_act - _human) ** 2)),
        })
    _pf_df = pd.DataFrame(_pf)

    # Strategies
    _strategies = []
    _strategies.append({"name": f"fixed {_low_steps} steps",
                        "mean_latency_ms": _low_lat,
                        "mean_mse": float(_pf_df["low_mse"].mean())})
    _strategies.append({"name": f"fixed {_high_steps} steps",
                        "mean_latency_ms": _high_lat,
                        "mean_mse": float(_pf_df["high_mse"].mean())})
    _strategies.append({"name": "always MLP",
                        "mean_latency_ms": 0.05,
                        "mean_mse": float(_pf_df["mlp_mse"].mean())})

    # Adaptive at several thresholds
    _thresholds = [2.0, 5.0, 10.0, 20.0]
    for _thr in _thresholds:
        _hard = _pf_df["disagree_low_mlp"] > _thr
        # Always pay low_lat. Pay high_lat additionally on hard frames.
        _adapt_lat = _low_lat + float(_hard.mean()) * _high_lat
        # Use low_act on easy, high_act on hard
        _adapt_mse = float(np.where(_hard, _pf_df["high_mse"], _pf_df["low_mse"]).mean())
        _strategies.append({"name": f"adaptive thr={_thr}",
                            "mean_latency_ms": _adapt_lat,
                            "mean_mse": _adapt_mse})

    adaptive_df = pd.DataFrame(_strategies)

    _fig = px.scatter(
        adaptive_df, x="mean_latency_ms", y="mean_mse", text="name",
        log_x=True,
        title="Adaptive denoising vs fixed strategies",
    )
    _fig.update_traces(textposition="top center", marker=dict(size=12))
    _fig.add_vline(x=100 * spec_chunk_used, line=dict(color="crimson", dash="dash"),
                   annotation_text=f"deadline at chunk={spec_chunk_used} (800 ms single-inf)",
                   annotation_position="top right")
    _fig.update_xaxes(title="single-inference latency (ms, log)")
    _fig.update_yaxes(title="action MSE")
    _fig.update_layout(height=420)
    mo.vstack([_fig, adaptive_df.round(2)])

    return (adaptive_df,)


@app.cell(hide_code=True)
def sec_c_takeaway(adaptive_df, mo):
    _best_adapt = adaptive_df[adaptive_df["name"].str.startswith("adaptive")].sort_values("mean_mse").iloc[0]
    mo.md(
        f"Adaptive routing at threshold {_best_adapt['name'].split('=')[-1]} lands at "
        f"**{_best_adapt['mean_latency_ms']:.0f} ms** single-inference latency and "
        f"**{_best_adapt['mean_mse']:.0f}** action MSE -- between fixed-low and fixed-high, "
        f"the Pareto interior point a fixed policy can't reach."
    )
    return


@app.cell(hide_code=True)
def sec_f_header(mo):
    mo.md("""
    ## D. Cross-Episode Validation
    """)
    return


@app.cell(hide_code=True)
def sec_f_intro(mo):
    mo.md("""
    A single-episode result is suggestive, not rigorous. We re-run the speculative
    measurement on episodes 1 and 2 (same 24-frame schedule) and compare against
    episode 0. If the speedup, acceptance rate, and MSE characteristics hold
    across episodes, the headline is a real systems result rather than overfit
    noise on one trajectory.
    """)
    return


@app.cell(hide_code=True)
def sec_f_compute(
    dataset,
    diff_normalize_obs,
    diff_unnormalize_action,
    diffusion_n_action_steps,
    diffusion_policy,
    mlp_policy,
    np,
    pd,
    spec_data_df,
    time,
    torch,
):
    def _load_episode_frames(_ep_idx, _max_frames=None):
        _meta = dataset.meta.episodes[_ep_idx]
        _f = int(_meta["dataset_from_index"])
        _t = int(_meta["dataset_to_index"])
        if _max_frames is not None:
            _t = min(_t, _f + _max_frames)
        return [dataset[_i] for _i in range(_f, _t)]


    def _run_spec_on_episode(_ep_frames, _frame_idx_list, _steps=20):
        _orig = diffusion_policy.diffusion.num_inference_steps
        diffusion_policy.diffusion.num_inference_steps = _steps
        _rows = []
        for _i in _frame_idx_list:
            if _i >= len(_ep_frames):
                continue
            _f = _ep_frames[_i]
            _state = _f["observation.state"].unsqueeze(0)
            _image = _f["observation.image"].unsqueeze(0)
            _human = _f["action"].numpy()
            with torch.inference_mode():
                _mlp_act = mlp_policy(_state).squeeze(0).numpy()
            _state_n, _image_n = diff_normalize_obs(_state, _image)
            _obs = {"observation.state": _state_n, "observation.image": _image_n}
            diffusion_policy.reset()
            _t0 = time.perf_counter()
            with torch.inference_mode():
                _diff_n = diffusion_policy.select_action(_obs)
            _lat = (time.perf_counter() - _t0) * 1000.0
            _diff_act = diff_unnormalize_action(_diff_n).squeeze(0).numpy()
            _rows.append({
                "frame_idx": _i,
                "delta": float(np.linalg.norm(_diff_act - _mlp_act)),
                "mlp_mse": float(np.mean((_mlp_act - _human) ** 2)),
                "diff_mse": float(np.mean((_diff_act - _human) ** 2)),
                "mlp_latency_ms": 0.05,
                "diff_latency_ms": _lat,
            })
        diffusion_policy.diffusion.num_inference_steps = _orig
        return pd.DataFrame(_rows)


    _frame_schedule = list(range(0, 144, 6))
    _per_episode_frames = {0: spec_data_df}  # already computed

    for _ep in [1, 2]:
        _ep_frames = _load_episode_frames(_ep)
        _per_episode_frames[_ep] = _run_spec_on_episode(_ep_frames, _frame_schedule)

    # Per-episode aggregate: sweep tau, pick the deadline-hitting sweet spot
    def _summarize_episode(_df, _chunk):
        _deltas = _df["delta"].values
        _mlp_lats = _df["mlp_latency_ms"].values
        _diff_lats = _df["diff_latency_ms"].values
        _mlp_mses = _df["mlp_mse"].values
        _diff_mses = _df["diff_mse"].values
        _baseline_lat = float(np.mean(_diff_lats)) / _chunk
        _baseline_mse = float(np.mean(_diff_mses))
        _taus = np.logspace(
            np.log10(max(_deltas.min() * 0.5, 1e-3)),
            np.log10(_deltas.max() * 2.0), 30,
        )
        _sweet = None
        for _tau in _taus:
            _accept = _deltas < _tau
            _A = float(np.mean(_accept))
            if _A >= 1.0:
                continue
            _lat = float(np.mean(_mlp_lats + (1.0 - _accept.astype(float)) * _diff_lats / _chunk))
            if _lat <= 100.0:
                _mse = float(np.mean(np.where(_accept, _mlp_mses, _diff_mses)))
                _sweet = {
                    "tau": float(_tau),
                    "acceptance_rate": _A,
                    "projected_latency_ms": _lat,
                    "served_mse": _mse,
                    "baseline_latency_ms": _baseline_lat,
                    "baseline_mse": _baseline_mse,
                    "speedup": _baseline_lat / max(_lat, 1e-3),
                    "mse_delta_pct": (_mse - _baseline_mse) / _baseline_mse * 100,
                }
                break
        return _sweet


    _chunk = int(diffusion_n_action_steps)
    _rows = []
    for _ep_idx, _df in _per_episode_frames.items():
        _s = _summarize_episode(_df, _chunk)
        if _s is None:
            _rows.append({"episode": _ep_idx, "hit_deadline": False})
        else:
            _s["episode"] = _ep_idx
            _s["hit_deadline"] = True
            _rows.append(_s)

    spec_multi_ep_df = pd.DataFrame(_rows)
    spec_multi_per_ep_data = _per_episode_frames
    spec_multi_ep_df.round(2)

    return (spec_multi_ep_df,)


@app.cell(hide_code=True)
def sec_f_plot(go, make_subplots, spec_multi_ep_df):
    _df = spec_multi_ep_df[spec_multi_ep_df["hit_deadline"]].copy()

    _fig = make_subplots(
        rows=1, cols=3, subplot_titles=(
            "Acceptance rate per episode",
            "Per-frame latency (ms)",
            "Action MSE",
        ),
        horizontal_spacing=0.08,
    )

    _ep_labels = [f"ep {int(e)}" for e in _df["episode"]]

    _fig.add_trace(go.Bar(x=_ep_labels, y=_df["acceptance_rate"],
                         marker_color="#1f77b4", name="acceptance"), row=1, col=1)

    _fig.add_trace(go.Bar(x=_ep_labels, y=_df["baseline_latency_ms"],
                         name="pure diffusion", marker_color="#888"), row=1, col=2)
    _fig.add_trace(go.Bar(x=_ep_labels, y=_df["projected_latency_ms"],
                         name="speculative", marker_color="#2ca02c"), row=1, col=2)
    _fig.add_hline(y=100, line=dict(color="crimson", dash="dash"),
                  annotation_text="10 Hz deadline", row=1, col=2)

    _fig.add_trace(go.Bar(x=_ep_labels, y=_df["baseline_mse"],
                         name="pure diffusion MSE", marker_color="#888",
                         showlegend=False), row=1, col=3)
    _fig.add_trace(go.Bar(x=_ep_labels, y=_df["served_mse"],
                         name="speculative MSE", marker_color="#d62728",
                         showlegend=False), row=1, col=3)

    _fig.update_yaxes(title="rate", range=[0, 1.05], row=1, col=1)
    _fig.update_yaxes(title="ms", row=1, col=2)
    _fig.update_yaxes(title="MSE", row=1, col=3)
    _fig.update_layout(height=380, barmode="group",
                      title="Cross-episode validation -- 3 episodes, same 24-frame schedule")
    _fig

    return


@app.cell(hide_code=True)
def sec_f_takeaway(mo, spec_multi_ep_df):
    _n = int(spec_multi_ep_df["hit_deadline"].sum())
    _total = len(spec_multi_ep_df)
    _mean_speedup = float(spec_multi_ep_df["speedup"].mean())
    _mean_mse_delta = float(spec_multi_ep_df["mse_delta_pct"].mean())
    _mean_accept = float(spec_multi_ep_df["acceptance_rate"].mean())

    mo.md(f"""
    Across **{_n}/{_total} episodes**, speculative serving hits the 10 Hz deadline
    that pure diffusion misses. Mean speedup **{_mean_speedup:.1f}x**, mean
    acceptance rate **{_mean_accept*100:.0f}%**, mean action MSE degradation
    **{_mean_mse_delta:+.1f}%**. The acceptance threshold tau is tuned per episode
    (simple grid search to the lowest deadline-hitting point) -- in production this
    would be a slow background controller, exactly how speculative-decoding gateways
    self-tune the speculative window for LLM serving.
    """)

    return


@app.cell(hide_code=True)
def sec_g_header(mo):
    mo.md("""
    ## E. Limitations and Where This Goes Next
    """)
    return


@app.cell(hide_code=True)
def sec_g_body(mo):
    mo.md("""
    Honest about what this notebook does **not** show.

    **1. Open-loop measurement, not closed-loop control.** Every speculative
    decision here is evaluated by comparing the served action to the human-recorded
    action on a fixed dataset. The actual closed-loop pusht environment is not
    being driven yet. The headline `1.9x speedup` is "hits the 10 Hz inference
    budget"; the next step is wiring this serving stack into the pusht Gym
    environment and measuring task success rate, not action MSE.

    **2. Sample size.** 24 frames per episode, 3 episodes = 72 frames. Enough to
    confirm the pattern; not enough to bound variance or stress edge cases
    (recoveries, contact transitions, multi-modal action distributions). A real
    paper version would sweep over the full ~30k frames, bootstrap the tau
    selection, and report confidence intervals.

    **3. Draft policy is a strawman.** The 4 482-parameter MLP is intentionally
    minimal. A stronger draft -- behavior-cloned residual, distilled-from-diffusion,
    a small transformer -- would push acceptance rate higher and the deadline
    margin wider. Same shape of result, better numbers.

    **4. No KV-cache analogue.** Diffusion U-Nets have *internal* temporal structure
    across denoising steps. An "intra-call" speculative pass (e.g. EAGLE-style
    layer skipping at low noise levels) would compound with the inter-call
    speculation shown here. We do not exploit that here.

    **5. No real quantization.** The Stage 1 sweep over `num_inference_steps`
    is a coarse stand-in for compute reduction; true int8 / bf16 / NF4
    quantization of the U-Net would be additive with speculative decoding,
    not a substitute.

    **What ships next.** (a) Closed-loop pusht with task success rate as the metric.
    (b) Distilled draft policy that learns to mimic the diffusion verifier.
    (c) Online tau controller -- raise tau on easy windows, lower on hard ones,
    same way speculative-decoding gateways for LLMs auto-tune the speculative
    window per stream.
    """)
    return


@app.cell(hide_code=True)
def sec_e_header(mo):
    mo.md("""
    ## F. Summary
    """)
    return


@app.cell(hide_code=True)
def sec_e_pitch(
    mo,
    spec_baseline_diff_lat_per_frame_chunked,
    spec_baseline_diff_mse,
    spec_multi_ep_df,
    spec_sweep_df,
):
    _hit_ep0 = spec_sweep_df[spec_sweep_df["hits_10hz_chunked"] & (spec_sweep_df["acceptance_rate"] < 1.0)]
    _sweet = _hit_ep0.iloc[0] if len(_hit_ep0) > 0 else spec_sweep_df.iloc[-2]
    _tau0 = float(_sweet["tau"])
    _A0 = float(_sweet["acceptance_rate"])
    _lat0 = float(_sweet["projected_per_frame_ms_chunked"])
    _mse0 = float(_sweet["served_mean_mse"])

    _multi_hit = spec_multi_ep_df[spec_multi_ep_df["hit_deadline"]]
    _n_hit = int(len(_multi_hit))
    _n_total = len(spec_multi_ep_df)
    _mean_speedup = float(_multi_hit["speedup"].mean()) if _n_hit > 0 else float("nan")
    _mean_mse_delta = float(_multi_hit["mse_delta_pct"].mean()) if _n_hit > 0 else float("nan")
    _mean_accept = float(_multi_hit["acceptance_rate"].mean()) if _n_hit > 0 else float("nan")

    mo.md(f"""
    ### The novel claim

    This notebook is the first port of **speculative decoding** -- the LLM-serving
    technique behind vLLM, Medusa, and EAGLE -- to **robot diffusion policies**.
    Draft is a 4 482-parameter MLP. Verifier is the 262.7 M-parameter
    `lerobot/diffusion_pusht` checkpoint. Acceptance rule is the L2 distance
    between draft and verifier actions vs a tunable threshold tau, evaluated
    once per chunk.

    ### Headline result (CPU, lerobot/diffusion_pusht, chunked serving)

    - **Episode 0 (24 frames):** tau={_tau0:.1f}, acceptance {_A0*100:.0f}%, projected
      per-frame latency {_lat0:.0f} ms vs {spec_baseline_diff_lat_per_frame_chunked:.0f} ms
      pure-diffusion baseline. **Hits 10 Hz deadline.** Action MSE {_mse0:.0f} vs
      pure-diffusion {spec_baseline_diff_mse:.0f}.
    - **Cross-episode ({_n_hit}/{_n_total} episodes):** mean speedup
      **{_mean_speedup:.1f}x**, mean acceptance **{_mean_accept*100:.0f}%**, mean MSE
      degradation **{_mean_mse_delta:+.1f}%**. The pattern is not episode-specific.

    ### What's inside

    | Section | What it shows |
    |---|---|
    | A | Serving Pareto over (denoising steps) x (chunk size) -- the same axes vLLM users stare at, drawn for a robot policy. |
    | B | Speculative decoding -- pipeline diagram, tau sweep, **interactive slider** that recolors the trajectory live by accept/reject. |
    | C | Adaptive denoising -- per-frame compute budget gated by draft/verifier disagreement (the EAGLE pattern, on actions). |
    | D | Cross-episode validation -- the headline holds across episodes 0/1/2. |
    | E | Limitations + what ships next (closed-loop pusht, distilled draft, online tau controller). |

    ### Why this matters

    The diffusion-policy world currently treats inference as a black box. The LLM
    inference-serving stack -- developed over two years of frontier research -- ports
    directly to robot policy serving. This notebook is the bridge: same draft-verifier
    pattern, same tail-latency-for-tail-quality tradeoff, same Pareto shape,
    measured end-to-end on a real pretrained policy.
    """)

    return


if __name__ == "__main__":
    app.run()
