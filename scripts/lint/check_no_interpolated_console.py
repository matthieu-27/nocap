"""check_no_interpolated_console — no interpolated templates in console calls."""
import re

from _common import main

CALL_RE = re.compile(r'console\.\w+\s*\(')
TMPL_RE = re.compile(r'`[^`]*\$\{')
COMMENT_RE = re.compile(r'^\s*//')


def check(path, lines):
    for lineno, line in enumerate(lines, 1):
        if COMMENT_RE.match(line):
            continue
        if CALL_RE.search(line) and TMPL_RE.search(line):
            yield lineno, (
                'console call with interpolated template — use structured logging: '
                "logger.info('message', { fields }) (no-interpolated-console)"
            )


if __name__ == '__main__':
    main('check_no_interpolated_console', check)
