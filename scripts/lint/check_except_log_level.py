"""check_except_log_level — except blocks must log at warning or above."""
import re

from _common import main

EXCEPT_RE = re.compile(r"^\s*except\b")
BAD_LOG_RE = re.compile(r"\blog(ger|ging)?\.(debug|info)\b|\blogger\.(debug|info)\b|\bprint\(")


def check(path, lines):
    in_except = False
    except_indent = 0
    for lineno, line in enumerate(lines, 1):
        stripped = line.rstrip()
        if not stripped:
            continue
        indent = len(stripped) - len(stripped.lstrip())
        if in_except and indent <= except_indent and not EXCEPT_RE.match(stripped):
            in_except = False
        if EXCEPT_RE.match(stripped):
            in_except = True
            except_indent = indent
            continue
        if in_except and BAD_LOG_RE.search(stripped):
            yield lineno, "except block logs at debug/info or uses print — use warning/error/exception"


if __name__ == "__main__":
    main("check_except_log_level", check)
