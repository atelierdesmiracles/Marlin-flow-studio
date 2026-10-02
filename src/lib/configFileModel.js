// Select the real Marlin configuration file for each directive.
// Config.h can exist as an include/wrapper in modern projects, while the actual
// machine directives (notably MOTHERBOARD) remain in Configuration.h.
const CLASSIC_FILES = ["Configuration.h", "Configuration_adv.h"];

export function writableConfigFiles(project) {
  const names = Object.keys(project?.parsedFiles || {});
  // Marlin's real editable configuration is Configuration.h / Configuration_adv.h.
  // Config.h is only a fallback for projects that genuinely have no classic headers.
  const classic = CLASSIC_FILES.filter((name) => names.includes(name));
  if (classic.length) return classic;
  return names.includes("Config.h") ? ["Config.h"] : [];
}

export function findWritableParam(project, name) {
  const names = Object.keys(project?.parsedFiles || {});

  // MOTHERBOARD is a Configuration.h directive in the Marlin configuration
  // model. Never redirect it to Config.h merely because a wrapper exists.
  if (name === "MOTHERBOARD" && names.includes("Configuration.h")) {
    return project.parsedFiles["Configuration.h"]?.parameters?.find((x) => x.name === name) || null;
  }

  for (const file of writableConfigFiles(project)) {
    const p = project?.parsedFiles?.[file]?.parameters?.find((x) => x.name === name);
    if (p) return p;
  }
  return null;
}

export function isWritableConfigParam(project, param) {
  return !!param && writableConfigFiles(project).includes(param.file);
}
