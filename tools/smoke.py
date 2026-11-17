"""Smoke test: serve the game, play a bit in headless Chrome, save screenshots, report console errors.
Run: python3 tools/smoke.py [outdir]
"""
import http.server
import os
import socketserver
import sys
import threading
import time

from playwright.sync_api import sync_playwright

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
OUT = sys.argv[1] if len(sys.argv) > 1 else "/tmp/slime_shots"
os.makedirs(OUT, exist_ok=True)


class Quiet(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=ROOT, **k)

    def log_message(self, *a):
        pass


def serve():
    socketserver.TCPServer.allow_reuse_address = True
    httpd = socketserver.TCPServer(("127.0.0.1", 8765), Quiet)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd


def main():
    httpd = serve()
    errors = []
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--autoplay-policy=no-user-gesture-required"])
        pg = b.new_page(viewport={"width": 1280, "height": 720})
        pg.on("console", lambda m: errors.append(f"{m.type}: {m.text}") if m.type in ("error", "warning") else None)
        pg.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))
        pg.goto("http://127.0.0.1:8765/index.html")
        time.sleep(2.0)
        pg.screenshot(path=f"{OUT}/01_title.png")
        pg.keyboard.press("Enter")
        time.sleep(1.5)
        pg.screenshot(path=f"{OUT}/02_room1_start.png")

        def hold(key, secs):
            pg.keyboard.down(key)
            time.sleep(secs)
            pg.keyboard.up(key)

        hold("ArrowRight", 1.2)
        pg.keyboard.press("x")
        time.sleep(0.08)
        pg.screenshot(path=f"{OUT}/03_attack.png")
        state = lambda: pg.evaluate("""() => { const g = window.__game; const s = g.scene.getScene('Game');
            return { room: s.roomIndex, x: Math.round(s.knight.x), y: Math.round(s.knight.y), enemies: s.enemies.length,
                     hearts: window.__state?.hearts }; }""")
        print("after attack", state())
        # teleport through rooms to check each one renders
        for r in range(3):
            pg.evaluate(f"""() => {{ const g = window.__game; const s = g.scene.getScene('Game');
                window.__setRoom({r}); }}""")
            time.sleep(1.6)
            pg.screenshot(path=f"{OUT}/1{r}_room{r + 1}.png")
            print("room", r, state())
        # boss fight wake
        pg.evaluate("() => { const s = window.__game.scene.getScene('Game'); s.knight.x = 9*16; s.knight.body.reset(9*16, 112); }")
        time.sleep(3.0)
        pg.screenshot(path=f"{OUT}/20_boss.png")
        print("boss", state())
        b.close()
    httpd.shutdown()
    print("ERRORS:" if errors else "no console errors")
    for e in errors:
        print("  ", e)


if __name__ == "__main__":
    main()
