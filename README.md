# Marlin Flow Studio — Local

Marlin Flow Studio is a desktop-first, local-only configurator for Marlin firmware and PlatformIO.

## Startup workflow

At launch, the desktop assistant checks PlatformIO and Git, then offers to install the missing tools, create a new Marlin project, resume the current project, or open an existing project.

When creating a project, the application queries the official Marlin GitHub Releases API for the latest stable release. Git is used to clone the release tag when available; otherwise the official source archive is downloaded. The selected directory becomes the active local project automatically.

## Local components

- Marlin configurator
- Configuration.h / Configuration_adv.h editor
- PlatformIO build / clean / upload
- Git status / fast-forward pull
- Serial / G-code console
- Local project explorer and code editor
- Embedded Chromium browser for documentation
- Local snapshots, diffs and Marlin Doctor
- Local Agent on `127.0.0.1:38765`

## Install / run

Linux:

```bash
./START-LINUX.sh
```

Windows:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\START-WINDOWS.bat
```


## Firmware et carte mémoire

Après un BUILD, le studio recherche automatiquement les fichiers firmware dans tous les `.pio/build` du projet. Cliquez sur un firmware pour ouvrir la boîte de dialogue d'enregistrement. Les cartes mémoire amovibles montées et accessibles en écriture sont détectées localement ; le firmware peut être copié à leur racine sous le nom choisi (par défaut `firmware.bin`).


## Doctor 1.9.2
Marlin Doctor utilise désormais un timeout long dédié au diagnostic, un ping borné et un contrôle Git borné pour éviter les erreurs « signal is aborted without reason ».

## Bootscreen Studio

Marlin Flow Studio 2.1 ajoute **Bootscreen Studio** dans le menu Outils. Il propose des profils LCD monochrome 128×64, LCD caractère, TFT RGB565 480×272 / 480×320 / 800×480, DGUS/MKS 480×272 et une résolution personnalisée. Les profils monochromes produisent un `_Bootscreen.h` avec les options Marlin de largeur/hauteur, inversion et timeout. Les profils couleur produisent un tableau RGB565 générique destiné au pilote d'affichage correspondant.


## Speaker Studio (v2.2.0)

Le Speaker Studio permet de composer une séquence de notes et silences, de la prévisualiser, de générer du G-code `M300`, d'exporter une directive `STARTUP_TUNE`, de l'envoyer au speaker de l'imprimante et d'enregistrer `SPEAKER` + `STARTUP_TUNE` dans `Config.h` ou `Configuration.h`. Marlin documente `M300 S<Hz> P<ms>` pour jouer une tonalité et `STARTUP_TUNE` comme une séquence de paires fréquence/durée.

## Vibration Studio v2.8.0

Local studio for Marlin vibration / ringing tuning. Supports M593 ZV Input Shaping, M493 Fixed-Time Motion shaper setup, frequency-sweep and ringing-tower G-code generation, and basic dominant-frequency analysis from a user-provided accelerometer CSV. It does not claim direct accelerometer acquisition from Marlin; hardware acquisition remains external unless a dedicated connector/agent driver is added.


## v2.9.0 — Accelerometer Studio

Vibration Studio now includes CSV import, FFT spectrum analysis (up to 200 Hz), multi-axis X/Y/Z detection, dominant resonance peaks, automatic application of detected frequencies, JSON analysis export, and FTM vibration tolerance editing. The tool remains local and does not claim direct accelerometer hardware control through Marlin.


## Speaker Event Sounds v2.11.0
Le Speaker Studio associe des mélodies aux événements démarrage, début d’impression, erreur, fin d’impression et extinction logicielle. Le démarrage utilise STARTUP_TUNE ; les autres événements produisent des snippets G-code / pack d’intégration.


## Vibration Studio 2.12.0
Le studio peut lire et synchroniser le profil Input Shaping / FTM dans Configuration.h et Configuration_adv.h, avec SHA de protection et détection des fichiers absents.

## v2.13.9 — Configuration Smart Controls

L’onglet Configuration utilise maintenant des contrôles adaptés au type de paramètre. Les choix finis sont présentés en menus déroulants, notamment `MOTHERBOARD`, les `TEMP_SENSOR_*`, `LCD_LANGUAGE`, les ports série, le nombre d’extrudeurs, les drivers et les microsteps.

Pour `MOTHERBOARD`, l’Agent local lit les identifiants `BOARD_*` du `Marlin/src/core/boards.h` (avec prise en charge du layout `src/core/boards.h`). Les valeurs `TEMP_SENSOR_*` disposent d’une liste lisible et sont complétées par les tables détectées dans le projet. La valeur actuelle est toujours conservée dans la liste si elle n’est pas reconnue.

La sélection reste locale et modifie la vraie configuration chargée par le projet ; elle ne crée pas de `Config.h` artificiel.

## Création du .EXE Windows

Pour créer l'application Windows :

```text
CREATE-EXE.bat
```

Le résultat est généré dans :

```text
release\\MarlinFlowStudio\\MarlinFlowStudio.exe
```

Copier tout le dossier `release\\MarlinFlowStudio\\` pour conserver l'application portable complète, notamment le dossier `dist`.
## v2.13.9 — Architecture complète

La version locale regroupe maintenant les flux principaux dans des sections dédiées : Accueil/Projets, Dashboard, Configuration, Marlin Doctor, Comparateur, Historique, Snapshots, Agent & Build, Console imprimante, G-code, Éditeur de code, Calculateurs, Documentation, Bootscreen Studio, Speaker Studio, Vibration Studio, Import/Migration, Git, Agent local, Navigateur et Paramètres.

Le Agent & Build utilise l'Agent local réel pour Build/Clean/Upload/Build+Upload, suit les logs PlatformIO, détecte les artefacts firmware et ouvre l'outil de copie vers les supports amovibles. Avant les opérations critiques, un snapshot peut être créé et la configuration modifiée peut être enregistrée sur le projet local.

La console imprimante sépare désormais explicitement la liaison série de l'explorateur G-code. L'Accueil/Projets permet de sélectionner un dossier PlatformIO existant ou de créer un nouveau projet Marlin via l'Agent local.



## Git intégré
La section Git est dédiée au dépôt officiel MarlinFirmware/Marlin (`https://github.com/MarlinFirmware/Marlin`). Elle affiche le dépôt local, la branche, le commit, le remote, les modifications locales et propose un `git pull --ff-only`.

Le dépôt officiel utilise actuellement `bugfix-2.1.x` comme branche par défaut pour le dépôt source. Les versions publiées sont consultables dans les Releases de Marlin.

## Marlin official repositories

Marlin Flow Studio uses two official Marlin repositories for its Git workflows:

- Firmware: https://github.com/MarlinFirmware/Marlin
- Pre-tested configurations: https://github.com/MarlinFirmware/Configurations

The Git panel can browse the `config/examples` tree by branch, preview configuration files, and import only files compatible with the authoritative configuration file used by the current local project. A local snapshot is created before an import. Marlin Doctor remains the recommended post-import check before Build.
