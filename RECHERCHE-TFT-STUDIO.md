# Recherche — Studio de personnalisation des écrans MKS

**Date de recherche :** 2 octobre 2026  
**Projet :** Marlin Flow Studio, application locale React/Vite + agent local Marlin.

## Résumé

Les écrans MKS se répartissent en deux familles à traiter séparément : les écrans MKS TFT autonomes, qui ont leur propre firmware et leurs propres ressources; et les écrans associés aux cartes MKS Robin, dont certaines interfaces sont compilées avec le firmware Marlin/LVGL. Le format de personnalisation varie donc selon le modèle et la génération.

MKS publie déjà MKS-TOOL, un outil graphique qui importe les images d'usine ou un dossier `mks_pic`, affiche les pages et les images modifiables, remplace les états d'une image, modifie les paramètres et exporte les fichiers vers carte SD. Son guide de l'application installée décrit des BMP de 78×104 pour les TFT 2.4/2.8/3.2 pouces et de 117×140 pour le TFT 3.5 pouces; d'autres emplacements ont d'autres dimensions. La version installée n'est plus maintenue et dépend de Python 2.7. La version Web existe également, mais une partie de MKS-TOOL compile Marlin à distance et envoie les résultats par e-mail. [Dépôt officiel MKS-TOOL](https://github.com/makerbase-mks/MKS-TOOL)

Marlin Flow Studio peut reprendre le parcours graphique et les formats documentés, mais le studio doit rester local et générer les fichiers sur le poste ou dans le projet actif. Il doit commencer par identifier précisément **la famille, le modèle/révision, le firmware MKS et son mode d'utilisation**.

## Ce que permet chaque famille

| Famille | Réglages ou ressources trouvés | Limite à respecter |
|---|---|---|
| MKS TFT autonome (TFT24/28/32/35/70) | MKS fournit une interface personnalisable par images de pages/états et fichiers de configuration. MKS-TOOL exporte notamment un dossier `mks_pic`; les MKS TFT se connectent à la carte mère via AUX-1 et ont leur propre firmware. | Les ressources et configurations dépendent du modèle et du firmware. Les formats d'image sont des BMP aux dimensions de chaque emplacement. La mise en page de base est définie par le firmware; les sources MKS sont nécessaires pour changer son comportement ou ajouter des fonctions. [Dépôt MKS-TFT](https://github.com/makerbase-mks/MKS-TFT) · [Dépôt matériel et procédure d'update](https://github.com/makerbase-mks/MKS-TFT-Hardware) |
| Écran MKS Robin relié à une carte Robin | MKS-TOOL annonce l'import/export de visuels/styles et de paramètres pour les cartes Robin. Certains firmwares Marlin MKS utilisent une interface LVGL avec des assets générés/téléchargés au build. | Ce n'est pas le même paquet que `mks_pic` pour un MKS TFT autonome. Les profils et exports doivent rester distincts selon carte, écran et branche Marlin. [MKS-TOOL](https://github.com/makerbase-mks/MKS-TOOL) · [Exemple de configuration PlatformIO Marlin MKS](https://github.com/makerbase-mks/Marlin-V2.X-MKS-H43/blob/main/platformio.ini) |
| Écran MKS piloté directement par Marlin (`TFT_COLOR_UI`) | Marlin propose des thèmes et polices configurables et permet d'ajouter un thème dans ses sources. Le `Display Studio` existant règle déjà les options Marlin détectées. | C'est une personnalisation de l'interface embarquée Marlin, pas l'export d'images `mks_pic` pour un écran MKS TFT autonome. Un nouveau thème demande une modification des sources et une recompilation. [Documentation LCD de Marlin](https://marlinfw.org/docs/setting/lcd.html) |
| Écrans DGUS/DWIN | Marlin fournit plusieurs variantes d’interface `DGUS_LCD_UI`; certaines nécessitent un paquet de ressources `DWIN_SET`. | Format et procédure dédiés à l’écran. Le studio Bootscreen actuel sait exporter une image RGB565 générique, mais indique déjà qu’il ne génère pas automatiquement le protocole DGUS. [Options LCD/DGUS de Marlin](https://marlinfw.org/docs/setting/lcd.html) |

## État actuel dans Marlin Flow Studio

- `DisplayStudio.jsx` gère déjà les profils matériels Marlin, résolution/pilote, interfaces `TFT_CLASSIC_UI` / `TFT_COLOR_UI` / `TFT_LVGL_UI`, langue et paramètres tactiles présents dans les fichiers chargés. Il écrit les changements dans la configuration du projet Marlin.
- `BootscreenStudio.jsx` sait produire un bootscreen et une image de statut, notamment un export RGB565 générique. Son profil DGUS précise que le protocole n’est pas généré automatiquement.
- Un nouveau studio doit se distinguer du réglage des directives Marlin : son objectif serait la **prévisualisation et la production des fichiers personnalisables du firmware de l’écran TFT**.

## Proposition de périmètre

### Première version : MKS TFT autonome

1. **Assistant MKS** : séparer MKS TFT autonome de MKS Robin intégré, puis faire choisir le modèle exact, sa révision, son firmware et la taille de l'écran.
2. **Éditeur d'images par page** : importer le dossier d'usine ou existant `mks_pic`, parcourir les pages, sélectionner un emplacement, remplacer chaque état d'image (jusqu'à trois selon MKS-TOOL) et montrer l'image à la taille réelle.
3. **Conversion encadrée** : accepter les formats d'image courants en entrée, recadrer/réduire dans l'interface, puis exporter le BMP aux dimensions et au nom attendus pour l'emplacement sélectionné. Le profil doit tenir compte des variantes de dimensions comme le logo, les vignettes de fichier et les icônes d'état.
4. **Configuration écran** : importer le fichier de configuration MKS existant, offrir des contrôles graphiques pour les options comprises, et préserver les entrées non modifiées. Le fichier MKS est distinct de `Configuration.h` de Marlin et du `config.ini` de BTT.
5. **Export local** : préparer un ZIP pour carte SD contenant `mks_pic` et le fichier de configuration approprié, avec un README qui précise le modèle et la version. Ne pas flasher automatiquement le TFT ni générer de firmware dans la première version.
6. **Validation** : modèle/révision/firmware sélectionnés, format BMP, dimensions, emplacements/états incomplets, différences non prises en charge et cohérence entre ressources et profil.

Commencer par **MKS TFT24/28/32 et TFT35**, car les dimensions d'images correspondantes sont documentées dans MKS-TOOL. Ajouter TFT70, MKS Robin et TS35 dans des profils distincts après validation de leurs fichiers d'assets et méthodes d'export. La version installée de MKS-TOOL comporte des profils Robin TFT24/28/32 et Nano TFT35, mais le paquet LVGL Robin doit rester une phase différente.

### Versions suivantes

- Ajouter TFT70, MKS TS35 et MKS Robin LVGL après avoir vérifié les formats d'assets et méthodes d'export exacts par version.
- Un éditeur libre de mise en page par glisser-déposer dépasserait le modèle documenté de MKS-TOOL, qui remplace les images de pages préétablies. Il demanderait de modifier le firmware MKS TFT et sa chaîne de compilation.

## Intégration proposée

- Nom possible : **TFT Screen Studio** ou **TFT Theme Studio**, séparé du `Display Studio` existant.
- Conserver le fonctionnement local : import de fichiers, aperçu et génération dans l’interface, export téléchargeable ; si les fichiers sont écrits dans le projet, passer uniquement par les opérations de fichiers limitées au projet actif de l’agent local.
- Définir les profils et capacités dans des données versionnées (famille MKS, modèle, version de firmware, résolution, pages, noms de fichiers, états et dimensions/formats des assets). Garder le parseur/générateur indépendant des composants React.
- Importer les images d'usine et ressources de l'utilisateur. Ne pas embarquer de thèmes ou visuels tiers sans vérifier leurs droits et versions.
- Garder la prise en charge des MKS Robin LVGL distincte : `TFT_LVGL_UI` dépend d'une branche/extension MKS, des assets et du build PlatformIO; l'option Marlin générique ne suffit pas à produire un paquet Robin prêt à flasher.
- Utiliser les fichiers sources/exemples officiels associés à une version choisie comme référence. L'export est un paquet de préparation à copier sur carte SD, pas un installateur universel.

## Références consultées

- [Marlin — options LCD et TFT](https://marlinfw.org/docs/setting/lcd.html)
- [Marlin — structure et configuration du firmware](https://marlinfw.org/docs/configuration/configuration.html)
- [MKS — MKS-TOOL, parcours de personnalisation graphique, dimensions et états d'image](https://github.com/makerbase-mks/MKS-TOOL)
- [MKS — dépôt source des écrans TFT24/28/32/35/70](https://github.com/makerbase-mks/MKS-TFT)
- [MKS — fichiers matériels, modèles et mise à jour des écrans](https://github.com/makerbase-mks/MKS-TFT-Hardware)
- [MKS — firmware TFT35 et outillage de build](https://github.com/makerbase-mks/MKS-TFT35-Firmware)
- [MKS/Marlin — exemple de dépendance LVGL/assets dans PlatformIO](https://github.com/makerbase-mks/Marlin-V2.X-MKS-H43/blob/main/platformio.ini)

## Intégration réalisée dans Marlin Flow Studio

Le **MKS TFT Studio** est maintenant accessible depuis la barre latérale et le catalogue « Studios », dans le pôle Interface. Cette première version traite les ressources graphiques des MKS TFT autonomes, sans modifier le `Display Studio` Marlin ni les écrans MKS Robin/LVGL.

- Import d'une image locale, aperçu à la résolution de sortie, cadrage « contenir » ou « remplir », couleur de fond et rotation 180°.
- Profils séparés pour les packs MKS-TOOL `mks_pic32` et `mks_pic35`, et pour le paquet fourni du MKS Robin Nano TFT35 avec `TFT_LVGL_UI`. Les packs sont intégrés comme ressources de référence au studio.
- Tailles connues par asset, dimensions personnalisées, conversion RGB565 little-endian (ordre utilisé par `image2bin` dans MKS-TOOL 1.0.8) et conservation des autres ressources lors de l'export ZIP.
- Le pack Robin fourni contient des assets à en-tête de 5 octets ainsi que des images brutes : le studio préserve l'en-tête original de l'asset remplacé et bloque l'export lorsque la longueur générée ne correspond pas au fichier de référence.
- Le ZIP produit inclut des instructions et la licence du pack, mais pas le firmware ni `mks_config.txt`. L'utilisateur doit vérifier le modèle et la révision du firmware avant mise à jour.

Le studio est purement local, ne lance pas de commande système et ne flashe pas l'écran. L'application n'intègre ni le code ni l'exécutable wxPython de MKS-TOOL : elle reprend son flux de conversion RGB565 et ses packs d'assets, puis ajoute un profil distinct pour le firmware Robin LVGL fourni. Le contrôle de compatibilité de chaque slot avec toutes les révisions de firmware MKS reste hors du périmètre actuel.
