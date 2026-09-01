"""check_import_direction — services must not import presentation modules."""
import re

from _common import main

PRESENTATION_IMPORT_RE = re.compile(
    r"^\s*(from|import)\s+([.\w-]*(presentation|api|routes|controllers|views|handlers)\b[.\w-]*)"
)


def check(path, lines):
    for lineno, line in enumerate(lines, 1):
        match = PRESENTATION_IMPORT_RE.search(line)
        if match:
            yield lineno, f"service layer imports '{match.group(2)}' — dependency direction violated"


if __name__ == "__main__":
    main("check_import_direction", check)
