"""check_require_assertion_reason — assertions need an inline reason comment."""
import re

from _common import main

ASSERTION_RE = re.compile(r'\bas\s+(?:any|unknown)\b')
REASON_RE = re.compile(r'//\s*reason:', re.IGNORECASE)


def check(path, lines):
    for lineno, line in enumerate(lines, 1):
        if ASSERTION_RE.search(line) and not REASON_RE.search(line):
            yield lineno, (
                "'as any'/'as unknown' assertion — prefer a stricter type, or add a "
                "'// reason: ...' comment (require-assertion-reason)"
            )


if __name__ == '__main__':
    main('check_require_assertion_reason', check)
