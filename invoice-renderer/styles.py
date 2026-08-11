"""Consulting Bold CSS — the one approved house style for pdf-mcp."""
from __future__ import annotations

import pathlib

FONTS_DIR = pathlib.Path(__file__).parent / "fonts"

# Theme tokens — Consulting Bold
ACCENT = "#ffb000"
INK    = "#1a1d21"
INK2   = "#0e1116"
MUTED  = "#5f6b76"
RULE   = "#e3e6ea"
ZEBRA  = "#f6f7f9"
COVER_BG = "#0e1116"


def _face(fam: str, file: str, weight: int = 400, style: str = "normal") -> str:
    uri = (FONTS_DIR / file).as_uri()
    return (
        f"@font-face{{font-family:'{fam}';font-weight:{weight};"
        f"font-style:{style};src:url('{uri}')format('truetype');}}"
    )


def get_font_faces() -> str:
    return "".join([
        _face("Inter",        "inter-400.ttf",        400),
        _face("Inter",        "inter-500.ttf",        500),
        _face("Inter",        "inter-600.ttf",        600),
        _face("Inter",        "inter-700.ttf",        700),
        _face("Archivo",      "archivo-600.ttf",      600),
        _face("Archivo",      "archivo-700.ttf",      700),
        _face("Archivo",      "archivo-800.ttf",      800),
        _face("IBM Plex Mono","ibm-plex-mono-400.ttf",400),
        _face("IBM Plex Mono","ibm-plex-mono-500.ttf",500),
    ])


def get_page_css(vendor: str, run_foot: str) -> str:
    # Gotcha 3: @page:first with margin:0 + all headers/footers suppressed.
    # Gotcha: background on @page:first paints the cover page dark.
    # Gotcha 5: h2 string-set drives @top-right section title.
    return f"""
@page {{ size:A4; margin:20mm 18mm 18mm 18mm;
  @top-left {{ content:"{vendor}"; font-family:'Archivo'; font-size:7.5pt;
    letter-spacing:.12em; color:{MUTED}; }}
  @top-right {{ content:string(doctitle); font-family:'Inter'; font-size:7.5pt; color:{MUTED}; }}
  @bottom-left {{ content:"{run_foot}"; font-family:'Inter'; font-size:7.5pt; color:{MUTED}; }}
  @bottom-right {{ content:"Page " counter(page) " of " counter(pages);
    font-family:'Inter'; font-size:7.5pt; color:{MUTED}; }}
}}
@page:first {{ margin:0; background:{COVER_BG};
  @top-left{{content:none}} @top-right{{content:none}}
  @bottom-left{{content:none}} @bottom-right{{content:none}} }}
"""


def get_cover_css() -> str:
    # Gotcha 1: height:296mm (not min-height) so absolutely-positioned .cover-foot anchors correctly.
    # Gotcha 2: no absolutely-positioned full-height (top:0;bottom:0) element — cover-foot uses bottom:16mm.
    # Gotcha 3: break-after:page on .cover; no CSS named pages.
    # Consulting Bold block variant: full-bleed dark cover via @page:first background + .cover background.
    return f"""
.cover{{ box-sizing:border-box; break-after:page; height:296mm; position:relative;
  background:{COVER_BG}; }}
.cover .cover-inner{{ padding:48mm 22mm 12mm 22mm; }}
.cover .cover-kicker{{ font-family:'Archivo'; text-transform:uppercase;
  letter-spacing:.18em; font-size:10pt; color:{ACCENT}; margin-top:40mm; font-weight:600; }}
.cover .cover-title{{ font-family:'Archivo'; font-size:34pt; line-height:1.1;
  color:#fff; margin:6px 0 4px; border:none; padding:0; font-weight:800; }}
.cover .cover-sub{{ font-family:'Inter'; font-size:13pt; color:#aeb6bf; margin-bottom:24mm; }}
.cover-meta{{ border-collapse:collapse; font-size:9.5pt; }}
.cover-meta th{{ text-align:left; padding:3px 18px 3px 0; color:#8b95a0; font-weight:500;
  font-family:'Inter'; white-space:nowrap; }}
.cover-meta td{{ padding:3px 0; color:#fff; font-weight:600; font-family:'Inter'; }}
.cover .cover-foot{{ position:absolute; bottom:16mm; left:22mm; right:22mm; font-family:'Inter';
  color:#8b95a0; white-space:nowrap; }}
.cover .cover-contact{{ font-size:8.5pt; line-height:1.3; letter-spacing:.02em; color:#aeb6bf; }}
.cover .cover-contact a{{ color:#aeb6bf; text-decoration:none; }}
.cover .cover-confidential{{ margin-top:2.5mm; font-size:7.5pt; line-height:1.2;
  letter-spacing:.04em; color:#66717d; }}
"""


def get_table_css() -> str:
    # Dark table headers — Consulting Bold style.
    return f"""
table:not(.cover-meta){{border-collapse:collapse;width:100%;margin:14px 0;font-size:9.8pt;}}
table:not(.cover-meta) th{{background:{INK2};color:#fff;text-align:left;padding:7px 10px;
  font-family:'Archivo';font-weight:600;font-size:8.6pt;letter-spacing:.02em;}}
table:not(.cover-meta) td{{border-bottom:1px solid {RULE};padding:7px 10px;vertical-align:top;}}

/* Label/value block, e.g. an invoice's bank details. Markdown cannot express a
   table with no header row, so those were emitted with an empty one -- which the
   rule above painted as a black bar across the page. These are emitted as raw
   <table class="kv"> instead, with the header cells used as row labels.
   DIVERGENCE from pdf-mcp: this block does not exist upstream. */
table.kv th{{background:none;color:{INK2};font-family:inherit;font-weight:600;
  font-size:9.8pt;letter-spacing:0;width:34%;
  border-bottom:1px solid {RULE};padding:7px 10px;vertical-align:top;}}
"""


def get_body_css() -> str:
    # Gotcha 5: h2 string-set drives the running section title in @top-right.
    return f"""
html,body{{ margin:0; padding:0; }}
html{{ font-family:'Inter'; color:{INK}; font-size:10.5pt; line-height:1.5; }}
h1,h2,h3,h4{{ font-family:'Archivo'; color:{INK2}; }}
h2{{ font-size:15pt; margin:22px 0 8px; padding-bottom:4px; border-bottom:1px solid {RULE};
  string-set:doctitle content(text); }}
h3{{ font-size:11.5pt; margin:14px 0 4px; color:{ACCENT}; }}
p{{ margin:7px 0; }}
a{{ color:{ACCENT}; }}
ul,ol{{ margin:7px 0 7px 4px; padding-left:18px; }}
li{{ margin:3px 0; }}
strong{{ color:{INK2}; }}
code{{ font-family:'IBM Plex Mono'; font-size:9pt; background:{ZEBRA};
  padding:1px 5px; border-radius:3px; border:1px solid {RULE}; }}
pre{{ font-family:'IBM Plex Mono'; font-size:8.6pt; background:{INK2}; color:#e6e6e6;
  padding:12px 14px; border-radius:6px; border-left:4px solid {ACCENT};
  white-space:pre-wrap; margin:12px 0; }}
pre code{{ background:none; border:none; color:inherit; padding:0; }}
blockquote{{ margin:12px 0; padding:10px 16px; background:{ZEBRA};
  border-left:4px solid {ACCENT}; color:{INK}; font-size:10pt; }}
blockquote p{{ margin:2px 0; }}
hr{{ border:none; border-top:1px solid {RULE}; margin:22px 0; }}
"""


def build_css(vendor: str, run_foot: str) -> str:
    return (
        get_font_faces()
        + get_page_css(vendor, run_foot)
        + get_cover_css()
        + get_table_css()
        + get_body_css()
    )
