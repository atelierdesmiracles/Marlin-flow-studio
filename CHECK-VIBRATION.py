from pathlib import Path
p=Path('src/components/tools/VibrationStudio.jsx')
s=p.read_text()
checks=['M593','M493','INPUT_SHAPING_X','SHAPING_FREQ_X','FT_MOTION','FTM_DEFAULT_SHAPER_' ,'Ringing Tower','Accéléromètre CSV', 'Accelerometer Studio', 'fftSpectrum', 'FTM_SHAPING_V_TOL_' ]
for x in checks: assert x in s, x
h=Path('src/pages/Home.jsx').read_text(); assert 'VibrationStudio' in h and 'view === "vibration"' in h
sb=Path('src/components/layout/Sidebar.jsx').read_text(); assert 'id: "vibration"' in sb and 'Activity' in sb
print('CHECK-VIBRATION: OK')
