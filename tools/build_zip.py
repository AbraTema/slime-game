"""Build the Yandex Games upload: dist/slime-game-yandex.zip with index.html at the root.
Run: python3 tools/build_zip.py
"""
import os
import zipfile

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
DIST = os.path.join(ROOT, "dist")
os.makedirs(DIST, exist_ok=True)
out = os.path.join(DIST, "slime-game-yandex.zip")

with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as z:
    z.write(os.path.join(ROOT, "index.html"), "index.html")
    for folder in ("lib", "src"):
        for base, _, files in os.walk(os.path.join(ROOT, folder)):
            for f in files:
                full = os.path.join(base, f)
                z.write(full, os.path.relpath(full, ROOT))
print(out, f"{os.path.getsize(out) / 1024:.0f} KB")
