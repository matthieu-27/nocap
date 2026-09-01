"""check_no_mock — tests must not hide real problems behind mock/patch."""
import sys

from _common import main

MARKERS = (
    "unittest.mock",
    "mock.patch",
    "@patch",
    "Mock(",
    "AsyncMock(",
    "MagicMock(",
)


def check(path, lines):
    for lineno, line in enumerate(lines, 1):
        if any(marker in line for marker in MARKERS):
            yield lineno, "mock/patch detected — test real behavior or use parametrized fixtures instead"


if __name__ == "__main__":
    main("check_no_mock", check)
