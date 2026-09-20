from pathlib import Path
p=Path('src/components/tools/SpeakerStudio.jsx')
s=p.read_text()
checks=['parseMidi','readVarLen','MThd','MTrk','importMidi','exportMidi','makeMidi','accept=".mid,.midi,audio/midi,audio/x-midi"','Générer un fichier MIDI']
for x in checks:
    assert x in s, x
print('CHECK-MIDI: OK')
