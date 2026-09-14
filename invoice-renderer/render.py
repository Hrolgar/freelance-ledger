"""Markdown + metadata → HTML → WeasyPrint PDF (Consulting Bold)."""
from __future__ import annotations

import html as html_lib

import markdown as md_lib
from pypdf import PdfReader
from styles import build_css  # flat layout here, not a package (was: from .styles)
from weasyprint import HTML, default_url_fetcher


def _offline_url_fetcher(url: str, timeout: int = 10, ssl_context=None):
    """Serve local files only; never reach the network.

    Invoice text can contain markdown, which permits raw HTML, and some of it is
    copied in from client correspondence. Without this, an <img> pointing at a
    remote host would be fetched by the server the moment an invoice is rendered.
    The fonts are loaded as file:// URIs, so those still resolve.
    """
    if url.startswith(("file:", "data:")):
        return default_url_fetcher(url, timeout=timeout, ssl_context=ssl_context)
    raise ValueError(f"refusing to fetch remote resource while rendering: {url}")


CONTACT_EMAIL = "helgi@skjortnes.dev"
PORTFOLIO_URL = "hrolgar.com"
LINKEDIN_URL = "https://www.linkedin.com/in/helgi-skaftason-skjortnes-65aba499/"

DOC_TYPES: dict[str, str] = {
    "sow":      "Statement of Work",
    "scope":    "Scope Agreement",
    "handover": "Handover Document",
    "manual":   "User Manual",
    "warranty": "Warranty",
    "runbook":  "Admin Runbook",
    "install":  "Installation Guide",
    "spec":     "Technical Specification",
    "report":   "Status Report",
    # Added here (absent from pdf-mcp at the time of vendoring): without it an
    # invoice had to be rendered as "report" and the cover read STATUS REPORT.
    "invoice":  "Invoice",
    "faktura":  "Faktura",
}


def _cover_html(doc_label: str, title: str, subtitle: str | None, rows: list) -> str:
    kicker = html_lib.escape(doc_label.upper())
    title_esc = html_lib.escape(title)
    meta_rows = "".join(
        f"<tr><th>{html_lib.escape(str(k))}</th><td>{html_lib.escape(str(v))}</td></tr>"
        for k, v in rows
    )
    inner = (
        f'<div class="cover-kicker">{kicker}</div>'
        f'<h1 class="cover-title">{title_esc}</h1>'
    )
    if subtitle:
        inner += f'<div class="cover-sub">{html_lib.escape(subtitle)}</div>'
    inner += f'<table class="cover-meta">{meta_rows}</table>'
    contact_items = (
        f'<a href="mailto:{CONTACT_EMAIL}">{html_lib.escape(CONTACT_EMAIL)}</a>',
        f'<a href="https://{PORTFOLIO_URL}">{html_lib.escape(PORTFOLIO_URL)}</a>',
        f'<a href="{html_lib.escape(LINKEDIN_URL, quote=True)}">LinkedIn</a>',
    )
    foot = (
        '<div class="cover-foot">'
        f'<div class="cover-contact">{" · ".join(contact_items)}</div>'
        '<div class="cover-confidential">Confidential</div>'
        '</div>'
    )
    return f'<section class="cover"><div class="cover-inner">{inner}</div>{foot}</section>'


def render_document(
    markdown: str,
    doc_type: str,
    meta: dict,
    output_path: str,
) -> dict:
    """Render a Markdown document to PDF using the Consulting Bold house style.

    Returns {"path": str, "pages": int}.
    """
    if doc_type not in DOC_TYPES:
        valid = ", ".join(DOC_TYPES)
        raise ValueError(f"Unknown doc_type {doc_type!r}. Valid: {valid}")

    doc_label = DOC_TYPES[doc_type]
    for required in ("title", "client"):
        if not meta.get(required):
            raise ValueError(f"meta is missing required field {required!r}")
    title = meta["title"]
    client = meta["client"]
    subtitle = meta.get("subtitle")
    vendor = meta.get("vendor", "Helgi Skjortnes")
    client_label = meta.get("client_label") or "Client"
    vendor_label = meta.get("vendor_label") or "Vendor"
    # Client + Vendor always lead the cover meta; any caller-supplied rows follow.
    rows: list = [(client_label, client), (vendor_label, vendor)] + list(meta.get("rows") or [])

    body_html = md_lib.markdown(
        markdown,
        extensions=["tables", "fenced_code", "sane_lists"],
    )
    cover_html = _cover_html(doc_label, title, subtitle, rows)
    run_foot = f"{doc_label} · {client}"
    css = build_css(vendor, run_foot)

    full_html = (
        f'<!doctype html><html><head><meta charset="utf-8">'
        f'<style>{css}</style></head>'
        f'<body>{cover_html}<main>{body_html}</main></body></html>'
    )

    HTML(string=full_html, url_fetcher=_offline_url_fetcher).write_pdf(output_path)

    reader = PdfReader(output_path)
    pages = len(reader.pages)

    return {"path": output_path, "pages": pages}
