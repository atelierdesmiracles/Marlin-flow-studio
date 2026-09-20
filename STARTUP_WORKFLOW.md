# Marlin Flow Studio — démarrage local

Au lancement, l'application ouvre l'assistant local.

## Outils

**PlatformIO Core**

Le bouton `Installer` crée l'environnement `.platformio-venv` utilisé par le Local Agent et installe PlatformIO Core à l'intérieur. L'installation ne modifie pas le Python système.

**Git**

Sous CachyOS / Arch, l'assistant propose `sudo pacman -S --needed git`. Sous Debian/Ubuntu il propose `sudo apt-get install -y git`, sous Fedora `sudo dnf install -y git`, et sous Windows `winget install Git.Git`.

## Nouveau projet

1. Choisir un dossier parent.
2. Donner un nom au projet.
3. L'assistant récupère la dernière **release stable** officielle de Marlin depuis GitHub.
4. Si Git est disponible, le tag est cloné avec `git clone --depth 1 --branch <tag>`.
5. Sinon, l'archive source officielle GitHub est téléchargée et extraite.
6. Le nouveau dossier devient immédiatement le projet actif du Local Agent.
7. Le studio est rechargé et toutes ses vues se resynchronisent avec les fichiers locaux.

## Projet existant

Le bouton `Ouvrir un projet déjà créé` attend un dossier contenant `platformio.ini`. Le dossier sélectionné est utilisé directement, sans copie des sources.

## Fichiers Marlin

La recherche de `Configuration.h` et `Configuration_adv.h` accepte :

- `<projet>/Configuration.h`
- `<projet>/Configuration_adv.h`
- `<projet>/Marlin/Configuration.h`
- `<projet>/Marlin/Configuration_adv.h`

Cette dernière forme correspond à la structure standard du dépôt Marlin.

## Actualisation du studio

Après une création ou une ouverture :

- `platformio.ini` est relu ;
- les environnements PlatformIO sont actualisés ;
- `Version.h` est analysé ;
- `MOTHERBOARD` est détecté ;
- les deux fichiers de configuration sont relus ;
- l'état Git est actualisé ;
- le chemin du projet est mémorisé dans `.marlin-agent/state.json` ;
- l'interface React est réhydratée à partir des données locales.
