CREER LE .EXE WINDOWS
=====================

Double-cliquez sur :

    CREATE-EXE.bat

Le script :
- cree .venv-build ;
- installe PySide6, PySerial, Flask et PyInstaller ;
- installe les dependances npm ;
- construit l'interface Vite ;
- construit MarlinFlowStudio.exe avec PyInstaller ;
- embarque les composants PySide6/WebEngine ;
- place l'application dans release\MarlinFlowStudio\.

Fichier principal :
    release\MarlinFlowStudio\MarlinFlowStudio.exe

IMPORTANT
---------
Pour une application portable complete, copiez tout le dossier
release\MarlinFlowStudio\ et pas uniquement le .exe.

Le dossier contient notamment dist\, necessaire a l'interface web locale.
