"""check_app_logger — use the instrumented app logger, not stdlib logging or print."""
import re

from _common import main

GENERIC_IMPORT_RE = re.compile(r"^\s*(import logging\b|from logging import)")
GET_LOGGER_RE = re.compile(r"logging\.getLogger\(")
# Lines importing through the instrumented entrypoint are the sanctioned path.
ALLOWED = ("app.logger", "app.logging", "src.logger", "src.logging", "get_logger")


def check(path, lines):
    for lineno, line in enumerate(lines, 1):
        if any(allowed in line for allowed in ALLOWED):
            continue
        if GENERIC_IMPORT_RE.search(line) or GET_LOGGER_RE.search(line):
            yield lineno, "generic logging import — use the instrumented app logger"
        if "print(" in line:
            yield lineno, "print() call — use the instrumented app logger"


if __name__ == "__main__":
    main("check_app_logger", check)
