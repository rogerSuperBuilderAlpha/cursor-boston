# AGENTS.md

## Notebook Authoring Rules

- Interleave explanatory markdown with code cells so the notebook is readable and presentation-ready.
- Give every cell a unique, descriptive cell name so cells are easy to reference during collaboration and demos.
- Code cells should generally be hidden to keep the notebook presentation-focused.
- **Edit notebooks only through marimo pair programming (`marimo._code_mode`)** using the repo’s marimo-pair scripts (for example `bash .agents/skills/marimo-pair/scripts/execute-code.sh --url http://localhost:<port> <<'EOF' ... EOF`). Do not edit the notebook `.py` file directly for cell changes—use code mode so the live notebook and saved app stay consistent.

## marimo Import Pattern

- Do not use `__import__("marimo").md(...)` in notebook cells.
- Use exactly one dedicated imports cell near the top of the notebook.
- That imports cell should contain all imports needed by the notebook (including `import marimo as mo`).
- Use the `mo` namespace for marimo APIs throughout the notebook (for example, `mo.md(...)` and `mo.ui.*`).
- Keep all other notebook cells free of import statements; non-import cells can contain any other code needed for the analysis.

## marimo code mode (cell shape)

- When creating or editing cells with `marimo._code_mode` (for example `create_cell` / `edit_cell` from the marimo-pair scripts), write **only the cell body**—the code that belongs **inside** the generated notebook function—not a top-level `def` that wraps the whole cell (that wrapper is marimo’s job; on disk it shows up as `@app.cell` + `def ...` in the `.py` file).
- **`def` inside the body is fine** when you need a **helper or local function** within that cell (for example `def ecdf(values): ...` used by the rest of the cell and notebook). Only avoid inventing a `def cell_name(...):` around the entire cell payload when scripting code mode.
- Treat notebook cells like the marimo editor does: statements and optional inner `def`s, final `return` / tuple return when defining outputs, and dependency names (`mo`, `Path`, `pl`, etc.) used directly; marimo wires the graph from those references.
- Still pass **`name=`** on `create_cell` / `edit_cell` so every cell stays a named, stable target; the name is not expressed as a Python `def` wrapping the cell when driving code mode.
- When scripting code mode, match **editor/body** style; do not hand-author the file-shaped `@app.cell` + outer `def` that marimo generates on save.
