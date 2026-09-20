from pathlib import Path
p=Path(__file__).parent
src=(p/'src/components/tools/SpeakerStudio.jsx').read_text()
assert 'M300 S' in src
assert 'STARTUP_TUNE' in src
assert 'SPEAKER' in src
assert 'serialSend' in src
side=(p/'src/components/layout/Sidebar.jsx').read_text()
assert 'speaker' in side and 'Music2' in side
home=(p/'src/pages/Home.jsx').read_text()
assert 'SpeakerStudio' in home and 'view === "speaker"' in home
print('CHECK-SPEAKER OK')
