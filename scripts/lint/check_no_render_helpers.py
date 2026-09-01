"""check_no_render_helpers — JSX-returning functions must be components (uppercase)."""
import re

from _common import main

FUNC_RE = re.compile(r'^\s*function\s+([A-Za-z_$][\w$]*)\s*\(')
ARROW_RE = re.compile(
    r'^\s*(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>\s*[{(]?\s*<'
)
RETURN_JSX_RE = re.compile(r'return\s*<|=>\s*<')


def check(path, lines):
    for lineno, line in enumerate(lines, 1):
        arrow = ARROW_RE.search(line)
        if arrow and arrow.group(1)[0].islower():
            yield lineno, (
                f"'{arrow.group(1)}' returns JSX but is not a component — "
                'capitalize the name (no-render-helpers)'
            )
            continue
        func = FUNC_RE.match(line)
        if not func or func.group(1)[0].isupper():
            continue
        name = func.group(1)
        body_indent = len(line) - len(line.lstrip())
        for scan in range(lineno, min(lineno + 60, len(lines))):
            target = lines[scan].strip()
            if target and (len(lines[scan]) - len(lines[scan].lstrip())) <= body_indent and target != '}':
                break
            if RETURN_JSX_RE.search(lines[scan]):
                yield lineno, (
                    f"'{name}' returns JSX but is not a component — "
                    'capitalize the name (no-render-helpers)'
                )
                break


if __name__ == '__main__':
    main('check_no_render_helpers', check)
