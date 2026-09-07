#!/usr/bin/env python3
"""Build the self-contained offline HTML from the readable source files."""
from pathlib import Path
import re

root = Path(__file__).resolve().parent
html = (root / 'index.html').read_text()
css = (root / 'src/styles.css').read_text()
html = html.replace('<link rel="stylesheet" href="src/styles.css">', '<style>\n' + css + '\n</style>')
html = re.sub(r'<script defer src="src/[^"]+"></script>', '', html)
scripts = '\n'.join((root / 'src' / name).read_text() for name in ['core.js', 'midi.js', 'audio.js', 'input.js', 'strings.js', 'soundcheck.js', 'app.js'])
html = html.replace('</body>', '<script>\n' + scripts + '\n</script>\n</body>')
(root / 'MIDI-Stage.html').write_text(html)
print(root / 'MIDI-Stage.html')
