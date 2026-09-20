from pathlib import Path

agent = Path("MarlinLocalAgent.py").read_text(encoding="utf-8")
local = Path("src/lib/localAgent.js").read_text(encoding="utf-8")
gcode = Path("src/components/tools/GCodeBrowser.jsx").read_text(encoding="utf-8")
speaker = Path("src/components/tools/SpeakerStudio.jsx").read_text(encoding="utf-8")

for needle in ["serial_connect", "serial_send", "serial_send_text", "/api/serial/send-text", "write_timeout", "reset_input_buffer"]:
    assert needle in agent, needle
assert "serialSendText" in local
for needle in ["sendFile", "Envoyer un fichier G-code", "serialSendText"]:
    assert needle in gcode, needle
for needle in ["parseMidi", "MThd", "MTrk", "sendGeneratedGcode", "M300", "No G4 delays"]:
    assert needle in speaker, needle
print("CHECK-SERIAL-MUSIC: OK")
