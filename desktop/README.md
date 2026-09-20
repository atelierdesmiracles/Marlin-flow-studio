# Marlin Flow Studio — Desktop local

Le desktop est le lanceur local de Marlin Flow Studio.

## Fonctionnement

1. Le desktop démarre `MarlinLocalAgent.py` sur `127.0.0.1:38765`.
2. Il sert le dossier `dist/` sur un port HTTP local.
3. L'onglet **Studio local** ouvre le configurateur React.
4. Le token du Local Agent est injecté automatiquement dans le `localStorage` du Studio.
5. L'onglet **Navigateur** utilise QtWebEngine (Chromium) et peut visiter des sites externes même lorsqu'ils refusent l'affichage dans un iframe.
6. Aucun service cloud n'est requis pour le studio : les projets et les opérations restent sur le PC.

## Linux / CachyOS

```bash
cd marlin-flow-studio
python3 -m venv .venv-desktop
source .venv-desktop/bin/activate
python -m pip install -U pip
python -m pip install -r desktop/requirements-desktop.txt
npm install
npm run build
python desktop/MarlinFlowDesktop.py
```

## Windows PowerShell

```powershell
cd marlin-flow-studio
py -3 -m venv .venv-desktop
.\.venv-desktop\Scripts\Activate.ps1
python -m pip install -U pip
python -m pip install -r desktop\requirements-desktop.txt
npm install
npm run build
python desktop\MarlinFlowDesktop.py
```

Le projet local doit contenir un `platformio.ini`. Depuis l'onglet Agent local ou le configurateur, choisissez ensuite le dossier du projet.

## Générer une version portable

Linux :
```bash
./BUILD-LINUX.sh
```

Windows :
```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\BUILD-WINDOWS.ps1
```

Le résultat est une version **onedir** : l'exécutable et ses ressources locales restent dans le même dossier, ce qui permet au Local Agent de trouver `platformio.ini` et `dist/` au même emplacement.
