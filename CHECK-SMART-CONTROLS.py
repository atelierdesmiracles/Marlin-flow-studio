from pathlib import Path
import tempfile
import shutil
import sys

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))
import MarlinLocalAgent as agent


def main():
    frontend = (ROOT / "src/components/config/ParameterEditor.jsx").read_text(encoding="utf-8")
    local_agent = (ROOT / "src/lib/localAgent.js").read_text(encoding="utf-8")
    assert 'configurationOptions' in local_agent
    for needle in ('name === "MOTHERBOARD"', '/^TEMP_SENSOR(?:_|$)/.test(name)', '<select', 'ensureCurrentOption'):
        assert needle in frontend, needle

    tmp = Path(tempfile.mkdtemp(prefix="mfs-smart-controls-"))
    old_project = agent.STATE.project_dir
    try:
        (tmp / "Marlin/src/core").mkdir(parents=True)
        (tmp / "Marlin/src/module/thermistor").mkdir(parents=True)
        (tmp / "Marlin/src/core/boards.h").write_text(
            '#define BOARD_TEST_ALPHA 7000 // Test Alpha\n'
            '#define BOARD_MKS_ROBIN_NANO_V1_3_F4 5239 // MKS Robin Nano V1.3\n',
            encoding="utf-8",
        )
        (tmp / "Marlin/src/module/thermistor/thermistortables.h").write_text(
            '// test table\n#if THERMISTOR_ID == 42\n#endif\n', encoding="utf-8"
        )
        agent.STATE.project_dir = tmp
        options = agent.configuration_options()
        boards = {item["value"] for item in options["boards"]}
        sensors = {item["value"] for item in options["temperature_sensors"]}
        assert "BOARD_TEST_ALPHA" in boards
        assert "BOARD_MKS_ROBIN_NANO_V1_3_F4" in boards
        assert 42 in sensors
        print("SMART CONTROLS CHECK: OK")
        print(f"Board options detected: {len(options['boards'])}")
        print(f"Temperature options available: {len(options['temperature_sensors'])}")
    finally:
        agent.STATE.project_dir = old_project
        shutil.rmtree(tmp, ignore_errors=True)


if __name__ == "__main__":
    main()
