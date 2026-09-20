# Marlin Flow Studio — intégration locale approfondie

Cette version transforme la base fournie en environnement local complet pour Marlin/PlatformIO, sans dépendance cloud.

## Architecture

```text
Marlin Flow Studio Desktop (PySide6)
├── Studio React local en localhost
│   ├── Configurateur Marlin
│   ├── Éditeur Configuration.h / Configuration_adv.h
│   ├── Diff / validation / snapshots / historique
│   ├── Assistant de configuration
│   ├── G-code / console série
│   └── panneau Agent local
│
├── Navigateur Qt WebEngine
│   ├── GitHub
│   ├── Marlin
│   ├── PlatformIO
│
└── MarlinLocalAgent.py
    ├── PlatformIO Core
    ├── Git
    ├── système de fichiers projet
    ├── détection Marlin
    ├── synchronisation des fichiers de configuration
    └── ports série / G-code
```

## Agent local

L'agent écoute uniquement sur `127.0.0.1:38765`.

Le jeton est généré localement dans `.marlin-agent/token` et n'est pas intégré à l'application distribuée. Les appels autres que `/api/ping` utilisent `X-Marlin-Agent-Token`.

Aucune API d'exécution de shell arbitraire n'est exposée. Les actions sont limitées aux opérations prévues : PlatformIO, Git Pull fast-forward only, lecture/écriture de fichiers du projet et série.

## Synchronisation Marlin

Le Studio peut :

- charger `Configuration.h` depuis le projet local ;
- charger `Configuration_adv.h` ;
- modifier les paramètres dans le configurateur ;
- sérialiser les modifications vers les fichiers réels ;
- éditer directement les fichiers dans l'éditeur de code ;
- créer une sauvegarde `.bak` avant écriture ;
- utiliser SHA-256 pour éviter d'écraser silencieusement un fichier modifié entre-temps.

## PlatformIO

PlatformIO Core est installé dans `.platformio-venv` afin d'éviter de modifier l'installation Python système.

Actions disponibles :

- Installer PlatformIO Core
- Build
- Clean
- Upload
- Build + Upload
- Stop
- sélection de l'environnement `[env:...]`
- suivi des logs
- détection des artefacts `firmware.bin`, `firmware.hex`, `firmware.elf` et `firmware.uf2` dans `.pio/build`.

Le bouton Build de l'interface lance donc une vraie compilation PlatformIO via l'agent local.

## Projet local

Le dossier contenant `platformio.ini` est sélectionnable depuis le desktop ou depuis le panneau Agent local. Le chemin est conservé dans `.marlin-agent/state.json`.

L'agent détecte également :

- la version Marlin via `Version.h` ;
- `MOTHERBOARD` dans la configuration ;
- les environnements PlatformIO ;
- l'état Git et le commit courant.

## Série / imprimante

Avec `pyserial`, le Studio peut détecter les ports, choisir le débit, se connecter à l'imprimante et envoyer du G-code depuis l'interface ou la console.

Exemples : `M115`, `M105`, `G28`, `M503`.

## Navigateur intégré

Le desktop utilise Qt WebEngine pour fournir un véritable moteur web intégré avec profil persistant et téléchargement local. Le composant React de secours utilise un iframe pour le Studio web ; les sites qui bloquent les iframes restent accessibles dans l'onglet navigateur desktop.

## Démarrage Linux / CachyOS

```bash
cd marlin-flow-studio
chmod +x START-LINUX.sh BUILD-LINUX.sh
./START-LINUX.sh
```

Le premier lancement installe les dépendances Python et Node puis construit le Studio.

## Démarrage Windows

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\START-WINDOWS.bat
```

## Build desktop

Linux :

```bash
./BUILD-LINUX.sh
```

Windows :

```powershell
.\BUILD-WINDOWS.bat
```

Le résultat est placé dans `release/MarlinFlowStudio/` en mode `onedir`.

## Limite de vérification de cet export

La syntaxe Python et les scripts shell ont été contrôlés. L'environnement d'exécution utilisé pour préparer l'archive ne disposait pas d'une installation `node_modules` complète et le build Vite n'a donc pas pu être finalisé ici. Les scripts de démarrage effectuent l'installation sur la machine cible avant `npm run build`.

## Pré-requis desktop

Le lanceur local utilise **PySide6 + Qt WebEngine** pour intégrer le navigateur Chromium. Les scripts de démarrage installent maintenant PySide6 dans le même `.venv` que Flask et pyserial. Avec Python 3.14, PySide6 6.11.x ou plus récent est requis.

Avec un ancien `.venv`, relance simplement `./START-LINUX.sh` : `pip install -r requirements-local.txt` complète automatiquement les dépendances manquantes.



## Diagnostic Local Agent

Depuis la racine du projet :

```bash
source .venv/bin/activate
python CHECK-AGENT.py
```

Le diagnostic vérifie le port `127.0.0.1:38765`, le token local et l'accès authentifié à l'API.


## Démarrage local 1.4

Au lancement, l'assistant local vérifie PlatformIO et Git. Il permet d'installer PlatformIO, d'ouvrir le gestionnaire de paquets système pour installer Git, de reprendre le projet courant, d'ouvrir un projet existant ou de créer un nouveau projet Marlin.

La création récupère dynamiquement la dernière release stable officielle de Marlin depuis l'API GitHub. Git est utilisé pour cloner le tag lorsqu'il est présent ; sinon l'archive source officielle est utilisée. Le projet devient immédiatement le projet actif du Local Agent et toute l'interface du studio est rechargée depuis les fichiers du disque.

Les fichiers `Configuration.h` et `Configuration_adv.h` sont recherchés à la racine du projet ou dans `Marlin/`, afin de correspondre à la structure standard de Marlin.
## Firmware compilé et carte mémoire

Le studio recherche les artefacts firmware dans tous les dossiers `.pio/build` du projet, y compris les projets Marlin imbriqués. Les formats pris en charge sont `.bin`, `.hex`, `.uf2`, `.elf` et `.img`.

Cliquer sur un firmware ouvre sa fiche et permet de sélectionner une carte mémoire amovible détectée par le système, de modifier le nom de fichier et de l'enregistrer sur la carte. Sous Linux, la détection s'appuie sur `lsblk` et les points de montage usuels ; sous Windows, les volumes amovibles sont détectés via l'API système ; sous macOS, les volumes de `/Volumes` sont proposés.



## Autorisation automatique du port série

Lors d'une connexion à `/dev/ttyUSB*`, `/dev/ttyACM*`, `/dev/ttyS*` ou à un lien `/dev/serial/by-id/...`, l'Agent tente d'abord l'ouverture normale. Si Linux renvoie `Permission denied`, il demande automatiquement une élévation via **Polkit (`pkexec`)** et applique temporairement `chown UID:GID` + `chmod 660` au périphérique sélectionné, puis réessaie l'ouverture. Un fallback `sudo` est utilisé si Polkit n'est pas disponible.

La commande d'élévation est strictement limitée au périphérique série sélectionné ; aucun shell arbitraire n'est exposé par l'API.
