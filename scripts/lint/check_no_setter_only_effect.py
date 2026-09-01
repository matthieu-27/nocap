"""check_no_setter_only_effect — useEffect that only calls a setter should be derived."""
import re

from _common import main

SINGLE_LINE_RE = re.compile(r'useEffect\(\s*\(\)\s*=>\s*set[A-Z]\w*\s*\(')
OPEN_BODY_RE = re.compile(r'useEffect\(\s*\(\)\s*=>\s*\{\s*$')
SETTER_CALL_RE = re.compile(r'^\s*set[A-Z]\w*\s*\([^;]*\)\s*;?\s*$')
CLOSE_RE = re.compile(r'^\s*\}\s*,\s*\[')

MESSAGE = (
    'useEffect only calls a state setter — derive the value during render '
    '(no-setter-only-effect)'
)


def check(path, lines):
    for lineno, line in enumerate(lines, 1):
        if SINGLE_LINE_RE.search(line):
            yield lineno, MESSAGE
            continue
        if OPEN_BODY_RE.search(line):
            body = lines[lineno:lineno + 2]
            if len(body) == 2 and SETTER_CALL_RE.match(body[0]) and CLOSE_RE.match(body[1]):
                yield lineno, MESSAGE


if __name__ == '__main__':
    main('check_no_setter_only_effect', check)
