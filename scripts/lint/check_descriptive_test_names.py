"""check_descriptive_test_names — plain-words behavior descriptions for tests."""
import re

from _common import main

TEST_CALL_RE = re.compile(r'\b(?:it|test)\s*\(\s*([\'"])(.*?)\1')
SCREAMING_RE = re.compile(r'[A-Z]{2,}')


def check(path, lines):
    for lineno, line in enumerate(lines, 1):
        for _quote, name in TEST_CALL_RE.findall(line):
            words = name.strip().split()
            if len(words) < 3 or '_' in name or SCREAMING_RE.search(name):
                yield lineno, (
                    f"test name '{name}' reads like code — describe behavior in plain words: "
                    'subject + action + expected (descriptive-test-names)'
                )


if __name__ == '__main__':
    main('check_descriptive_test_names', check)
