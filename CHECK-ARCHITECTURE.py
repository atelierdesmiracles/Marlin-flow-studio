from pathlib import Path

root = Path(__file__).parent
sidebar = (root / "src/components/layout/Sidebar.jsx").read_text(encoding="utf-8")
home = (root / "src/pages/Home.jsx").read_text(encoding="utf-8")
commands = (root / "src/components/layout/CommandPalette.jsx").read_text(encoding="utf-8")

required_nav = ["projects", "dashboard", "config", "doctor", "diff", "history", "snapshots", "agent-build", "printer", "gcode", "code", "calculators", "docs", "bootscreen", "speaker", "vibration", "migration", "git",  "browser", "settings"]
for item in required_nav:
    assert f'id: "{item}"' in sidebar, item
    assert f'view === "{item}"' in home, item
    assert f'setView("{item}")' in commands, item

assert "NG · v2.13.9 · 100% Local" in sidebar
assert "validation" not in sidebar.lower()
assert "validation" not in commands.lower()
assert "ValidationPanel" not in home
assert 'parsedNames.includes("Config.h")' in home
assert 'setView("agent-build")' in home
assert 'view === "printer"' in home
print("ARCHITECTURE CHECK: OK")

assert "throwOnError" in (root / "src/pages/Home.jsx").read_text(encoding="utf-8")
assert "marlin-flow-settings-v1" in (root / "src/components/local/BuildCenter.jsx").read_text(encoding="utf-8")
assert "AgentBuildCenter" in home
assert 'id: "agent-build"' in sidebar
assert 'setView("agent-build")' in commands
print("CRITICAL SAVE/BUILD CHECK: OK")
