"""check_no_swallowed_errors — empty catch blocks must re-raise or log."""
from _common import main


def _body_text(lines, open_line, open_col):
    """Collect the text between the braces of a block starting at lines[open_line][open_col]."""
    depth = 0
    parts = []
    for i in range(open_line, len(lines)):
        start = open_col if i == open_line else 0
        for col in range(start, len(lines[i])):
            ch = lines[i][col]
            if ch == '{':
                depth += 1
                if depth == 1:
                    continue
            elif ch == '}':
                depth -= 1
                if depth == 0:
                    return ''.join(parts)
            if depth >= 1:
                parts.append(ch)
        parts.append('\n')
    return None


def _has_code(body):
    for raw in body.splitlines():
        if raw.split('//')[0].strip():
            return True
    return False


def check(path, lines):
    for lineno, line in enumerate(lines):
        if 'catch' not in line.split('//')[0]:
            continue
        brace = line.find('{', line.find('catch'))
        scan = lineno
        while brace == -1 and scan < len(lines):
            brace = lines[scan].find('{')
            if brace == -1:
                scan += 1
        if brace == -1:
            continue
        body = _body_text(lines, scan, brace)
        if body is not None and not _has_code(body):
            yield scan + 1, 'empty catch swallows the error — re-throw or log it (no-swallowed-errors)'


if __name__ == '__main__':
    main('check_no_swallowed_errors', check)
