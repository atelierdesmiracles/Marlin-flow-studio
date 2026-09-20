# Marlin Flow Studio v2.13.9 — Configuration Smart Controls

## Nouveautés

- `MOTHERBOARD` devient un menu déroulant alimenté par `boards.h` du projet Marlin local.
- Tous les `TEMP_SENSOR_*` sont proposés en menu déroulant avec valeurs lisibles.
- `LCD_LANGUAGE`, `SERIAL_PORT*`, `EXTRUDERS`, `*_DRIVER_TYPE` et `*_MICROSTEPS` utilisent aussi des choix finis.
- Si la valeur existante n'est pas reconnue, elle est ajoutée temporairement en tête du menu afin d'éviter toute perte de configuration.
- La liste peut être relue sans redémarrer l'application.
- La source détectée (`boards.h`, `thermistortables.h`, etc.) est affichée dans l'éditeur.
- Les écritures restent effectuées dans les vrais fichiers de configuration du projet local.

## Architecture

Le Local Agent expose `/api/configuration/options` et limite la recherche des sources au projet sélectionné. Aucune exécution de shell arbitraire n'est ajoutée.
