"""check_no_factories — parametrized fixtures over factory helpers in tests."""
import re

from _common import main

FACTORY_IMPORT_RE = re.compile(r"^\s*(import|from)\s+factory\b")
FACTORY_CLASS_RE = re.compile(r"^\s*class\s+\w*Factory\b")
FACTORY_DEF_RE = re.compile(r"^\s*def\s+\w*factory\w*\s*\(", re.IGNORECASE)
FACTORY_CALL_RE = re.compile(r"\b\w*[Ff]actory\w*\.(build|create)\(")


def check(path, lines):
    for lineno, line in enumerate(lines, 1):
        if FACTORY_IMPORT_RE.search(line) or FACTORY_CLASS_RE.search(line):
            yield lineno, "factory_boy/factory class — use @pytest.mark.parametrize fixtures instead"
        elif FACTORY_DEF_RE.search(line) or FACTORY_CALL_RE.search(line):
            yield lineno, "test factory helper — parametrize fixtures instead"


if __name__ == "__main__":
    main("check_no_factories", check)
