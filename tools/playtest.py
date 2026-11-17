"""Scripted gameplay checks in headless Chrome. Run: python3 tools/playtest.py"""
import os
import sys
import time

sys.path.insert(0, os.path.dirname(__file__))
from smoke import serve, OUT  # noqa: E402
from playwright.sync_api import sync_playwright  # noqa: E402

G = "window.__game.scene.getScene('Game')"


def main():
    httpd = serve()
    errors, results = [], []
    ok = lambda name, cond, info="": results.append((name, bool(cond), info))
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path="/usr/bin/google-chrome")
        pg = b.new_page(viewport={"width": 1280, "height": 720})
        pg.on("pageerror", lambda e: errors.append(str(e)))
        pg.goto("http://127.0.0.1:8765/index.html")
        time.sleep(1.5)
        pg.keyboard.press("Enter")
        time.sleep(1.2)
        ev = pg.evaluate
        tp = lambda x, y=112: ev(f"() => {{ const k = {G}.knight; k.body.reset({x}, {y}); k.body.setVelocity(0,0); }}")

        # 1. kill the first green slime with the sword
        sx = ev(f"() => {G}.enemies[0].x")
        n0 = ev(f"() => {G}.enemies.length")
        tp(sx - 16)
        ev(f"() => {{ {G}.knight.facing = 1; {G}.enemies[0].body.setVelocity(0,0); {G}.enemies[0].speed = 0; }}")
        time.sleep(0.2)
        pg.keyboard.press("x")
        time.sleep(0.5)
        n1 = ev(f"() => {G}.enemies.length")
        ok("sword kills slime", n1 == n0 - 1, f"{n0}->{n1}")
        pg.screenshot(path=f"{OUT}/p1_kill.png")
        # 2. collect the dropped crystal
        time.sleep(0.8)
        lx = ev(f"() => {{ const l = {G}.loot.getChildren().find(i => !i.lootId); return l ? l.x : null; }}")
        if lx is not None:
            tp(lx)
            time.sleep(0.4)
        ok("crystal collected", ev("() => window.__state.crystals") >= 1, ev("() => window.__state.crystals"))

        # 3. exit door -> room 2
        w = ev(f"() => {G}.W")
        tp(w - 40)
        time.sleep(0.2)
        pg.keyboard.down("ArrowRight"); time.sleep(0.8); pg.keyboard.up("ArrowRight")
        time.sleep(1.2)
        ok("door leads to room 2", ev(f"() => {G}.roomIndex") == 1)
        ok("flag checkpoint set", ev("() => window.__state.checkpoint.room") == 1, ev("() => JSON.stringify(window.__state.checkpoint)"))

        # 4. pit costs one heart and returns you
        h0 = ev("() => window.__state.hearts")
        tp(21 * 16 + 8)
        time.sleep(0.3)
        tp(23 * 16 + 8, 100)
        time.sleep(1.2)
        h1 = ev("() => window.__state.hearts")
        ky = ev(f"() => {G}.knight.y")
        ok("pit: -1 heart and back on ground", h1 == h0 - 1 and ky <= 112, f"hearts {h0}->{h1}, y={ky}")

        # 5. purple splits into two minis
        ev(f"() => {{ const s = {G}; const v = s.enemies.find(e => e.kind === 'purple'); window.__v = v; }}")
        before = ev(f"() => {G}.enemies.filter(e => e.kind === 'mini').length")
        ev("() => window.__v.hit(1)")
        time.sleep(0.2)
        after = ev(f"() => {G}.enemies.filter(e => e.kind === 'mini').length")
        ok("purple splits into 2 minis", after == before + 2, f"{before}->{after}")

        # 6. death -> respawn at checkpoint with full hearts, defeated slimes stay dead
        defeated = ev("() => window.__state.defeated.size")
        ev("() => { window.__state.hearts = 1; }")
        ev(f"() => {{ const k = {G}.knight; k.invuln = 0; k.hurt(k.x + 5); }}")
        time.sleep(2.6)
        ok("respawn with full hearts", ev("() => window.__state.hearts") == 3)
        ok("respawn in checkpoint room", ev(f"() => {G}.roomIndex") == 1)
        ok("defeated slimes persist", ev("() => window.__state.defeated.size") == defeated)

        # 7. boss fight -> chest -> victory
        ev("() => window.__setRoom(2)")
        time.sleep(1.2)
        tp(9 * 16)
        time.sleep(2.2)
        pg.screenshot(path=f"{OUT}/p7_boss.png")
        ok("boss woke up", ev(f"() => {G}.king.state") != "sleep")
        for _ in range(7):
            ev(f"() => {{ const k = {G}.king; if (k && k.active) {{ k.invuln = 0; k.hit(1); }} }}")
            time.sleep(0.05)
        time.sleep(2.0)
        ok("chest spawned", ev(f"() => !!{G}.chest"))
        ev(f"() => {{ const c = {G}.chest; {G}.knight.body.reset(c.x, 112); }}")
        time.sleep(2.0)
        ok("victory screen", ev("() => window.__game.scene.isActive('Victory')"))
        pg.screenshot(path=f"{OUT}/p8_victory.png")
        b.close()
    httpd.shutdown()
    for name, passed, info in results:
        print(("PASS " if passed else "FAIL ") + name, info)
    print("page errors:", errors or "none")
    sys.exit(0 if all(r[1] for r in results) and not errors else 1)


if __name__ == "__main__":
    main()
