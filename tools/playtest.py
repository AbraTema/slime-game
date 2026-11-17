"""Scripted gameplay checks for both levels in headless Chrome. Run: python3 tools/playtest.py"""
import os
import sys
import time

sys.path.insert(0, os.path.dirname(__file__))
from smoke import serve, OUT  # noqa: E402
from playwright.sync_api import sync_playwright  # noqa: E402

G = "window.__game.scene.getScene('Game')"
T = 16


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
        pg.keyboard.press("Enter")          # title -> level select
        time.sleep(1.0)
        ok("level select opens", pg.evaluate("() => window.__game.scene.isActive('LevelSelect')"))
        pg.keyboard.press("Enter")          # start level 1
        time.sleep(1.4)
        ev = pg.evaluate
        ok("level 1 started", ev(f"() => {G}.level.name") == "ПОДЗЕМЕЛЬЕ")

        def tp(x, y):
            ev(f"() => {{ const k = {G}.knight; k.body.reset({x}, {y}); k.body.setVelocity(0,0); k.invuln = 0; }}")

        # ---------------- level 1
        e0 = ev(f"() => {{ const e = {G}.enemies[0]; e.speed = 0; return [e.x, e.y]; }}")
        n0 = ev(f"() => {G}.enemies.length")
        tp(e0[0] - 12, e0[1])
        ev(f"() => {{ {G}.knight.facing = 1; }}")
        time.sleep(0.25)
        pg.keyboard.press("x")
        time.sleep(0.5)
        ok("L1: sword kills slime", ev(f"() => {G}.enemies.length") == n0 - 1)
        time.sleep(0.8)
        lx = ev(f"() => {{ const l = {G}.loot.getChildren().find(i => !i.lootId); return l ? [l.x, l.y] : null; }}")
        if lx:
            tp(lx[0], lx[1] + 3)
            time.sleep(0.4)
        ok("L1: crystal collected", ev("() => window.__state.crystals") >= 1)

        ev("() => window.__setRoom(1, 0)")
        time.sleep(1.4)
        ok("L1: flag at room start", ev("() => window.__state.checkpoint.room") == 1)
        ev(f"() => {G}.enemies.forEach(e => e.destroy())")   # isolate the pit check from slimes
        h0 = ev("() => window.__state.hearts")
        tp(16 * T + 8, 10 * T)
        time.sleep(0.3)
        tp(19 * T + 8, 7 * T)
        time.sleep(1.4)
        ok("L1: pit costs a heart, back on ground", ev("() => window.__state.hearts") == h0 - 1 and ev(f"() => {G}.knight.y") <= 10 * T,
           f"{h0}->{ev('() => window.__state.hearts')}")
        # ride the raft
        rx = ev(f"() => {{ const m = {G}.movers.getChildren().find(m => m.axis === 'x'); return [m.x, m.y]; }}")
        tp(rx[0], rx[1] - 6)
        time.sleep(0.2)
        x1 = ev(f"() => {G}.knight.x")
        mx1 = ev(f"() => {G}.movers.getChildren().find(m => m.axis === 'x').x")
        time.sleep(1.0)
        x2 = ev(f"() => {G}.knight.x")
        mx2 = ev(f"() => {G}.movers.getChildren().find(m => m.axis === 'x').x")
        ok("L1: knight rides the raft", abs((x2 - x1) - (mx2 - mx1)) < 6 and abs(mx2 - mx1) > 10, f"knight {x2 - x1:.0f} raft {mx2 - mx1:.0f}")
        # door to boss room
        w = ev(f"() => {G}.W")
        tp(w - 30, 10 * T)
        pg.keyboard.down("ArrowRight"); time.sleep(0.7); pg.keyboard.up("ArrowRight")
        time.sleep(1.3)
        ok("L1: door leads to throne hall", ev(f"() => {G}.roomIndex") == 2)
        tp(7 * T, 10 * T)
        ev(f"() => {{ {G}.knight.invuln = 99; }}")   # boss is tested elsewhere; keep the knight alive here
        time.sleep(1.5)
        ok("L1: boss wakes", ev(f"() => {G}.king && {G}.king.state") not in (None, "sleep"))
        pg.screenshot(path=f"{OUT}/p_boss.png")
        for _ in range(7):
            ev(f"() => {{ const k = {G}.king; if (k && k.active) {{ k.invuln = 0; k.hit(1); }} }}")
            time.sleep(0.05)
        time.sleep(2.0)
        ok("L1: chest spawned", ev(f"() => !!{G}.chest"),
           ev(f"() => JSON.stringify([{G}.roomIndex, {G}.king && {G}.king.hp, {G}.king && {G}.king.state, window.__state.bossDefeated, {G}.knight.dead])"))
        if not ev(f"() => !!{G}.chest"):
            for n, pa, info in results: print(("PASS " if pa else "FAIL ") + n, info)
            sys.exit(1)
        ev(f"() => {{ const c = {G}.chest; {G}.knight.body.reset(c.x, c.y); }}")
        time.sleep(2.0)
        ok("L1: victory screen", ev("() => window.__game.scene.isActive('Victory')"))
        ok("L1: stars saved", ev("() => (JSON.parse(localStorage.getItem('slime_stars_v1')||'{}')[0]||0) >= 1"))
        pg.screenshot(path=f"{OUT}/p_victory1.png")
        pg.keyboard.press("Enter")          # -> next level
        time.sleep(1.6)

        # ---------------- level 2
        ok("L2: 'next' starts the tower", ev(f"() => {G}.level.name") == "БАШНЯ")
        ok("L2: slimes are guards", ev(f"() => {G}.enemies.filter(e => e.guard).length") >= 6)
        # guard deflects an airborne swing and knocks the knight back
        g = ev(f"() => {{ const e = {G}.enemies.find(e => e.kind === 'green' && e.guard); e.speed = 0; return [e.x, e.y]; }}")
        h0 = ev("() => window.__state.hearts")
        n0 = ev(f"() => {G}.enemies.length")
        tp(g[0] - 10, g[1] - 14)
        ev(f"() => {{ {G}.knight.facing = 1; {G}.knight.body.setVelocity(0, -60); }}")
        ev(f"() => {G}.knight.attacks.sword.start()")
        time.sleep(0.35)
        ok("L2: airborne hit is deflected", ev(f"() => {G}.enemies.length") == n0)
        ok("L2: deflect costs a heart", ev("() => window.__state.hearts") == h0 - 1)
        time.sleep(1.5)
        # standing on the platform, the hit lands
        ev("() => { window.__state.hearts = 3; }")
        side = ev(f"""() => {{ const s = {G}; const e = s.enemies.find(e => e.kind === 'green' && e.guard);
            e.speed = 0; e.guard = true; e.body.setVelocity(0,0);
            const d = s.isSolidAt(e.x - 11, e.y + 2) ? -1 : 1;
            const k = s.knight; k.body.reset(e.x + d * 11, e.y); k.body.setVelocity(0,0); k.facing = -d; k.invuln = 2;
            s.enemies.forEach(o => {{ if (o !== e) o.body && o.body.setVelocity(0,0); }});
            return d; }}""")
        time.sleep(0.3)
        ev(f"() => {G}.knight.attacks.sword.start()")
        time.sleep(0.4)
        ok("L2: grounded hit kills the guard", ev(f"() => {G}.enemies.length") == n0 - 1)
        # fireball knocks the knight off a ledge
        ev("() => { window.__state.hearts = 3; }")
        tp(3 * T + 8, 30 * T)
        time.sleep(0.5)
        ky = ev(f"() => {G}.knight.y")
        ev(f"() => {{ const s = {G}; s.knight.invuln = 0; s.spawnFireball(8 * 16, s.knight.y - 5, -1); }}")
        time.sleep(1.6)
        ok("L2: fireball takes a heart", ev("() => window.__state.hearts") == 2)
        ok("L2: fireball knocks off the ledge", ev(f"() => {G}.knight.y") > ky + 8, f"y {ky}->{ev(f'() => {G}.knight.y'):.0f}")
        pg.screenshot(path=f"{OUT}/p_l2_fire.png")
        # fire slimes shoot on their own
        time.sleep(0.5)
        ev("() => { window.__state.hearts = 3; }")
        c0 = ev(f"() => {G}.fireballCount || 0")
        tp(6 * T, 13 * T)
        ev(f"() => {{ {G}.knight.invuln = 99; }}")
        time.sleep(4.0)
        ok("L2: fire slimes fire on their own", ev(f"() => {G}.fireballCount || 0") > c0)
        ev(f"() => {{ {G}.knight.invuln = 0; }}")
        # elevator lifts (knight follows it)
        ev("() => { window.__state.hearts = 3; }")
        ey = ev(f"() => {{ const m = {G}.movers.getChildren().find(m => m.axis === 'y'); return [m.x, m.y]; }}")
        tp(ey[0], ey[1] - 6)
        ev(f"() => {{ {G}.knight.invuln = 99; }}")
        time.sleep(0.3)
        y1, m1 = ev(f"() => [{G}.knight.y, {G}.movers.getChildren().find(m => m.axis === 'y').y]")
        time.sleep(1.0)
        y2, m2 = ev(f"() => [{G}.knight.y, {G}.movers.getChildren().find(m => m.axis === 'y').y]")
        ok("L2: elevator carries the knight", abs((y2 - y1) - (m2 - m1)) < 6, f"knight {y2 - y1:.0f} lift {m2 - m1:.0f}")
        # exit door at the top -> victory
        ev("() => { window.__state.hearts = 3; }")
        d = ev(f"() => [{G}.exitDoor.x, {G}.exitDoor.y]")
        tp(d[0] - 20, d[1] - 2)
        ev(f"() => {{ {G}.knight.invuln = 99; }}"); pg.keyboard.down("ArrowRight"); time.sleep(0.8); pg.keyboard.up("ArrowRight")
        time.sleep(1.5)
        ok("L2: top door finishes the level", ev("() => window.__game.scene.isActive('Victory')"))
        pg.screenshot(path=f"{OUT}/p_victory2.png")
        pg.keyboard.press("Escape")
        time.sleep(1.0)
        ok("L2: menu returns to level select", ev("() => window.__game.scene.isActive('LevelSelect')"))
        pg.screenshot(path=f"{OUT}/p_levels_after.png")
        b.close()
    httpd.shutdown()
    for name, passed, info in results:
        print(("PASS " if passed else "FAIL ") + name, info)
    print("page errors:", errors or "none")
    sys.exit(0 if all(r[1] for r in results) and not errors else 1)


if __name__ == "__main__":
    main()
