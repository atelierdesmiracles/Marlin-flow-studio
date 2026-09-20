# Marlin Flow Studio v2.13.7 — Configurator Fix

## Corrections

- The configurator now loads `Config.h` in addition to `Configuration.h` and `Configuration_adv.h`.
- When `Config.h` exists, it is treated as the authoritative configuration target for Marlin 2.1.3+.
- The Configurator has an explicit **Apply to project** action that writes the real configuration file(s) to the selected local Marlin project.
- Legacy mode writes `Configuration.h` and `Configuration_adv.h` together.
- Configuration writes use SHA-256 optimistic locking to prevent overwriting external changes.
- Multi-file writes use a transaction-like operation with `.bak` backups and rollback on failure.
- The Local Agent prefers the canonical `<project>/Marlin/` configuration directory when both wrapper and canonical files exist.
- Reload from disk now includes `Config.h`.
- The configuration file tree now displays `Config.h`.

## Important

Marlin documentation states that `Config.h` (2.1.3+) replaces `Configuration.h` and `Configuration_adv.h`; when `Config.h` is present, the legacy headers are ignored. `config.ini` is also processed at build time by Marlin's PlatformIO script and can override/apply configuration settings. The studio therefore avoids writing the ignored legacy pair when `Config.h` is present.
