import marimo._code_mode as cm

async with cm.get_context() as ctx:
    cid = ctx.create_cell(
        "import marimo as mo\n\nmo.md('_Pair smoke: `create_cell` + `run_cell` via kernel execute._')",
        name="pair_smoke_cell",
        hide_code=True,
    )
    ctx.run_cell(cid)
