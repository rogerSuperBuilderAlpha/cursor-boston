"""POST Python to a running marimo kernel (/api/kernel/execute) without bash/jq.

Usage:
  python scripts/pair_execute.py --url http://127.0.0.1:2718 -c "1+1"
  python scripts/pair_execute.py --url http://127.0.0.1:2718 < path/to/code.py

Env:
  MARIMO_TOKEN — optional Bearer token if the server requires auth.
"""

from __future__ import annotations

import argparse
import json
import sys
import urllib.error
import urllib.request
from typing import Any


def _parse_sse(body: str) -> tuple[bool, str]:
    """Return (ok, message) from an SSE text/event-stream body."""
    current_event = ""
    for raw in body.splitlines():
        line = raw.rstrip("\r")
        if line.startswith("event:"):
            current_event = line[len("event:") :].strip()
        elif line.startswith("data:"):
            payload = line[len("data:") :].strip()
            if current_event == "done":
                try:
                    data = json.loads(payload)
                except json.JSONDecodeError:
                    return False, payload
                if data.get("success") is False:
                    err = data.get("error") or {}
                    return False, str(err.get("msg", err))
                out = data.get("output") or {}
                return True, str(out.get("data", ""))
    return False, "no done event in response"


def get_session_id(base: str, token: str | None) -> str:
    req = urllib.request.Request(
        f"{base.rstrip('/')}/api/sessions",
        headers=_auth_headers(token),
        method="GET",
    )
    with urllib.request.urlopen(req, timeout=30) as r:
        sessions: dict[str, Any] = json.load(r)
    if not sessions:
        raise RuntimeError("No sessions — open the notebook in the browser.")
    if len(sessions) > 1:
        keys = ", ".join(sessions.keys())
        raise RuntimeError(f"Multiple sessions ({keys}); pass --session explicitly.")
    return next(iter(sessions.keys()))


def _auth_headers(token: str | None) -> dict[str, str]:
    h: dict[str, str] = {}
    if token:
        h["Authorization"] = f"Bearer {token}"
    return h


def execute_code(base: str, session_id: str, code: str, token: str | None) -> tuple[bool, str]:
    data = json.dumps({"code": code}).encode("utf-8")
    req = urllib.request.Request(
        f"{base.rstrip('/')}/api/kernel/execute",
        data=data,
        method="POST",
        headers={
            "Content-Type": "application/json",
            "Marimo-Session-Id": session_id,
            **_auth_headers(token),
        },
    )
    with urllib.request.urlopen(req, timeout=120) as r:
        raw = r.read().decode("utf-8", errors="replace")
    return _parse_sse(raw)


def main() -> int:
    p = argparse.ArgumentParser(description="Execute code in marimo scratchpad (code mode API).")
    p.add_argument("--url", default="http://127.0.0.1:2718", help="Marimo server base URL")
    p.add_argument("--session", default=None, help="Marimo-Session-Id (default: auto from /api/sessions)")
    p.add_argument("-c", metavar="CODE", help="Inline Python code")
    p.add_argument("file", nargs="?", help="Path to a .py file with code to execute")
    args = p.parse_args()

    token = __import__("os").environ.get("MARIMO_TOKEN")
    code = args.c
    if code is None and args.file:
        with open(args.file, encoding="utf-8") as f:
            code = f.read()
    if code is None and not sys.stdin.isatty():
        code = sys.stdin.read()
    if not code:
        p.print_help()
        return 2

    base = args.url.rstrip("/")
    try:
        sid = args.session or get_session_id(base, token)
        ok, msg = execute_code(base, sid, code, token)
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        print(f"HTTP {e.code}: {body}", file=sys.stderr)
        return 1
    except Exception as e:
        print(str(e), file=sys.stderr)
        return 1

    if msg:
        print(msg)
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
