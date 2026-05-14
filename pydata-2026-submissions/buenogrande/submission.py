# /// script
# dependencies = ["marimo"]
# requires-python = ">=3.10"
# ///

import marimo

__generated_with = "0.23.6"
app = marimo.App(width="medium")


@app.cell
def imports():
    import marimo as mo

    return (mo,)


@app.cell(hide_code=True)
def hello_markdown(mo):
    mo.md("""
    Hello!

    I'm happy to be in this hackathon
    """)
    return


if __name__ == "__main__":
    app.run()
