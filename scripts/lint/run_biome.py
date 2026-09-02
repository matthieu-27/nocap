"""run_biome — invoke the local biome binary regardless of the hook's cwd.

Pre-commit on Windows only resolves an entry's first token from PATH, so the
hook calls this wrapper via `uv run python` and we build absolute paths here.
"""
import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BIN = ROOT / 'node_modules' / '.bin' / ('biome.exe' if os.name == 'nt' else 'biome')


def main() -> int:
    command = [str(BIN), 'check', '--fix', '--error-on-warnings', *sys.argv[1:]]
    return subprocess.run(command, cwd=ROOT, check=False).returncode


if __name__ == '__main__':
    sys.exit(main())
