#!/usr/bin/env python3
from pathlib import Path
import shutil
import tempfile
import MarlinLocalAgent as agent

def main():
    root = Path(tempfile.mkdtemp(prefix="mfs-ini-check-"))
    old = agent.STATE.project_dir
    try:
        (root / "ini").mkdir()
        (root / "platformio.ini").write_text(
            "[platformio]\n"
            "default_envs = env_b\n"
            "extra_configs = ini/*.ini\n",
            encoding="utf-8",
        )
        (root / "ini" / "stm32f4.ini").write_text(
            "[common_stm32]\n"
            "platform = ststm32@~12.1\n"
            "framework = arduino\n\n"
            "[env:env_a]\n"
            "extends = common_stm32\n"
            "board = BOARD_A\n\n"
            "[env:env_b]\n"
            "extends = common_stm32\n"
            "board = BOARD_B\n"
            "upload_protocol = jlink\n",
            encoding="utf-8",
        )
        agent.STATE.project_dir = root
        info = agent.read_ini()
        assert info["development_environment_mode"] == "marlin-ini"
        assert info["development_environment_source_relative"] == "ini"
        assert info["environments"] == ["env_a", "env_b"]
        assert info["selected_environment"] == "env_b"
        target = next(x for x in info["environment_details"] if x["name"] == "env_b")
        assert target["source"] == "ini/stm32f4.ini"
        assert target["board"] == "BOARD_B"
        assert target["platform"] == "ststm32@~12.1"
        assert target["upload_protocol"] == "jlink"
        result = agent.set_default_env("env_a")
        assert result["selected_environment"] == "env_a"
        assert "default_envs = env_a" in (root / "platformio.ini").read_text(encoding="utf-8")
        print("PLATFORMIO_INI_TEST: OK")
    finally:
        agent.STATE.project_dir = old
        shutil.rmtree(root, ignore_errors=True)

if __name__ == "__main__":
    main()
