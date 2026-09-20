from pathlib import Path
p=Path('src/pages/Home.jsx')
s=p.read_text()
checks={
 'Config.h read':'readConfiguration("Config.h")' in s,
 'Config.h write':'"Config.h"' in s and 'filesToWrite' in s,
 'Apply button':'Appliquer au projet' in s,
 'canonical save selection':'parsedNames.includes("Config.h")' in s,
 'reload Config.h':'nextFiles["Config.h"]' in s,
}
for k,v in checks.items(): print(('OK' if v else 'FAIL'), k)
assert all(checks.values())
