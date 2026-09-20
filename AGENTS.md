# Marlin Flow Studio — Agent Guidelines

This repository is a local-only Marlin / PlatformIO application. Do not add cloud authentication or remote application backends to the desktop workflow.

## Local architecture

- React/Vite provides the configurator UI.
- `MarlinLocalAgent.py` exposes a localhost-only authenticated API.
- `desktop/MarlinFlowDesktop.py` hosts the React studio and the integrated browser.
- PlatformIO runs through the local agent in its private virtual environment.
- Projects are selected or created on the local filesystem.

## Safety

Never expose arbitrary shell execution through the Local Agent API. Keep the agent bound to `127.0.0.1` and keep all file operations scoped to the active project.
