# Marlin Flow Studio v2.13.8 — Configurator / Standard Marlin Configuration

Cette version corrige la logique de sélection de la configuration :

- `Configuration.h` + `Configuration_adv.h` sont la paire standard et prioritaire.
- `Config.h` est uniquement utilisé s’il existe réellement dans le projet.
- Le configurateur n’invente plus `Config.h` pour un projet classique.
- `config.ini` reste détecté comme méta-configuration PlatformIO et n’est pas écrasé implicitement.
- L’écriture passe par l’Agent local avec SHA et sauvegarde `.bak`.
- Le statut du projet indique le fichier réellement détecté.

Référence : documentation officielle Marlin.
