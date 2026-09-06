#!/bin/sh
cd "$(dirname "$0")" || exit 1
if command -v python3 >/dev/null 2>&1; then
  python3 start.py
else
  printf '\nPython 3 was not found. Open MIDI-Stage.html in Chrome, or install Python 3 for the localhost launcher.\n'
  read -r ignored
fi
