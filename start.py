#!/usr/bin/env python3
"""Serve MIDI Stage only on this computer. Requires Python 3; no packages."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import argparse
import sys
import threading
import webbrowser


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--port', type=int, default=8765)
    parser.add_argument('--no-browser', action='store_true')
    args = parser.parse_args()
    if not 1024 <= args.port <= 65535:
        parser.error('Choose a port between 1024 and 65535.')
    directory = str(Path(__file__).resolve().parent)
    handler = partial(SimpleHTTPRequestHandler, directory=directory)
    try:
        server = ThreadingHTTPServer(('127.0.0.1', args.port), handler)
    except OSError as exc:
        print(f'Could not start MIDI Stage: {exc}\nTry: python start.py --port 8766', file=sys.stderr)
        raise SystemExit(1)
    url = f'http://localhost:{args.port}'
    print(f'\nMIDI Stage is running at {url}\nOpen that address in desktop Chrome.\nPress Ctrl+C to stop. Nothing is uploaded.\n')
    if not args.no_browser:
        threading.Timer(0.5, lambda: webbrowser.open(url)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print('\nMIDI Stage stopped.')
    finally:
        server.server_close()


if __name__ == '__main__':
    main()
