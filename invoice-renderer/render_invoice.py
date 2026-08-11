#!/usr/bin/env python3
"""Render an invoice to PDF in the Consulting Bold house style.

Reads a JSON job on stdin and writes a PDF to the requested path:

    {"markdown": "...", "output_path": "/tmp/x.pdf",
     "meta": {"title": "Invoice OC-2026-001", "client": "Lance"}}

Prints a JSON result on stdout. Exit code 0 means the PDF was written.

The style modules here are a VENDORED COPY of pdf-mcp
(/mnt/hrolbot-ssd/projects/pdf-mcp/pdf_mcp). The app runs in a .NET container that
cannot call the MCP, and the point is that a generated invoice looks identical to
the ones already sent by hand. If the house style changes in pdf-mcp, mirror it
here -- styles.py and render.py are the two files to copy.
"""
import json
import sys

from render import render_document


def main() -> int:
    try:
        job = json.load(sys.stdin)
    except json.JSONDecodeError as exc:
        print(json.dumps({"error": f"bad job json: {exc}"}), file=sys.stderr)
        return 2

    for required in ("markdown", "output_path"):
        if not job.get(required):
            print(json.dumps({"error": f"missing {required}"}), file=sys.stderr)
            return 2

    meta = job.get("meta") or {}
    meta.setdefault("title", "Invoice")
    meta.setdefault("client", "")

    try:
        result = render_document(
            markdown=job["markdown"],
            doc_type="invoice",
            meta=meta,
            output_path=job["output_path"],
        )
    except Exception as exc:  # surfaced to the API log, which falls back to markdown
        print(json.dumps({"error": str(exc)}), file=sys.stderr)
        return 1

    print(json.dumps(result))
    return 0


if __name__ == "__main__":
    sys.exit(main())
