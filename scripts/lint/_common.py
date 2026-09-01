"""Shared runner for the local lint checks (stdlib only, no deps)."""
import sys
from pathlib import Path


def iter_violations(files, check):
    """Run check(path, lines) over each file, yield 'file:line: message' strings."""
    violations = []
    for name in files:
        path = Path(name)
        if not path.is_file():
            continue
        lines = path.read_text(encoding="utf-8", errors="replace").splitlines()
        violations.extend(f"{name}:{lineno}: {message}" for lineno, message in check(path, lines))
    return violations


def report(rule, violations):
    if violations:
        print(f"[{rule}] {len(violations)} violation(s):")
        for violation in violations:
            print(f"  {violation}")
    return 1 if violations else 0


def main(rule, check):
    sys.exit(report(rule, iter_violations(sys.argv[1:], check)))
