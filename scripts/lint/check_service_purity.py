"""check_service_purity — no presentation code in the service layer."""
import re

from _common import main

PRESENTATION_IMPORT_RE = re.compile(r"^\s*(from|import)\s+(flask|jinja2|starlette\.templates)\b")
MARKERS = (
    "print(",
    "HTMLResponse",
    "JSONResponse",
    "RedirectResponse",
    "render_template",
    "TemplateResponse",
    ".html",
)


def check(path, lines):
    for lineno, line in enumerate(lines, 1):
        if PRESENTATION_IMPORT_RE.search(line):
            yield lineno, "presentation framework import in service layer — move to presentation"
            continue
        for marker in MARKERS:
            if marker in line:
                yield lineno, f"presentation marker '{marker}' in service layer"
                break


if __name__ == "__main__":
    main("check_service_purity", check)
