#!/usr/bin/env python3
"""Build and test MIDI Stage. Python 3 + Node; --browser also needs Playwright.
This runner never acquires real hardware; browser suites use simulated inputs.
"""
from pathlib import Path
import argparse
import os
import shutil
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]

def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--browser', action='store_true', help='Also run all Chromium integration suites.')
    parser.add_argument('--storage', action='store_true', help='Also verify real file-origin browser persistence (requires permitted file navigation).')
    args = parser.parse_args()
    node = shutil.which('node')
    if node is None:
        parser.error('Node.js is required for the unit tests.')
    commands = [[sys.executable, 'build.py'], [node, '--test', *[str(p.relative_to(ROOT)) for p in sorted((ROOT/'tests').glob('*.test.cjs'))]]]
    if args.browser or args.storage:
        try:
            import playwright.sync_api  # noqa: F401
        except ImportError:
            parser.error('Install requirements-dev.txt and run python -m playwright install chromium first.')
        commands += [[sys.executable, 'tests/'+name] for name in ['browser.test.py','edge.test.py','soundcheck.browser.py','strings.browser.py','workshop.browser.py','smart-import.browser.py']]
    if args.storage:
        commands.append([sys.executable, 'tests/workshop-storage.browser.py'])
    try:
        for command in commands:
            print('\nRUN', ' '.join(command), flush=True)
            subprocess.run(command, cwd=ROOT, env=os.environ.copy(), check=True, timeout=180)
    except (subprocess.CalledProcessError, subprocess.TimeoutExpired) as error:
        print(f'Test run failed: {error}', file=sys.stderr)
        return 1
    return 0

if __name__ == '__main__':
    raise SystemExit(main())
