import marimo._code_mode as cm

async with cm.get_context() as ctx:
    ctx.delete_cell("pair_smoke_cell")
