"""check_test_names — names must spell actor_action_effect."""
import re

from _common import main

TEST_DEF_RE = re.compile(r"^\s*def\s+(test_\w+)\(")


def check(path, lines):
    for lineno, line in enumerate(lines, 1):
        match = TEST_DEF_RE.search(line)
        if not match:
            continue
        segments = [segment for segment in match.group(1).split("_")[1:] if segment]
        if len(segments) < 3:
            yield lineno, (
                f"'{match.group(1)}' — spell out actor_action_effect (got {len(segments)} part(s))"
            )


if __name__ == "__main__":
    main("check_test_names", check)
