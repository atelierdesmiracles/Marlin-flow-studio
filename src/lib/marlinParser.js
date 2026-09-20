// Marlin C++ configuration parser
// Robust, tolerant, preserves original structure. Parses #define / //#define / #undef
// and preprocessor conditionals. Never destroys comments or formatting.

const MACRO_LINE = /^\s*(\/\/)?\s*#(define|undef)\s+([A-Za-z0-9_]+)(.*)$/;
const COND_LINE = /^\s*#(if|ifdef|ifndef|else|elif|endif)\b(.*)$/;

function detectType(rawValue) {
  const v = rawValue.trim();
  if (v === "") return "flag";
  if (v.startsWith('"') || v.startsWith("'")) return "string";
  if (/^[-+]?\.?\d+(\.\d+)?$/.test(v)) return v.includes(".") ? "float" : "number";
  if (v.startsWith("{") && v.endsWith("}")) return "array";
  if (v === "true" || v === "false") return "bool";
  return "expr";
}

function parseValue(raw) {
  const v = raw.trim();
  if (v === "") return { type: "flag", value: true, rawValue: "" };
  const type = detectType(v);
  let value = v;
  if (type === "string") value = v.replace(/^"|"$/g, "");
  else if (type === "number") value = Number(v);
  else if (type === "float") value = parseFloat(v);
  else if (type === "bool") value = v === "true";
  else if (type === "array") {
    value = v
      .slice(1, -1)
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }
  return { type, value, rawValue: v };
}

/**
 * Parse a Marlin configuration file text into structured parameters + lines.
 * Returns { parameters, lines, version }
 */
export function parseMarlinFile(text, fileName = "Configuration.h") {
  const lines = text.split(/\r?\n/);
  const parameters = [];
  const stack = []; // conditional stack: { active: bool, parentActive }
  let section = "General";
  let sectionLine = 0;

  // Track conditional nesting to compute "active" state
  const condStack = []; // each: { taken: bool, active: bool, depth }

  function currentlyActive() {
    if (condStack.length === 0) return true;
    return condStack[condStack.length - 1].active;
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const raw = line;

    // Section detection via comment banners like // ===== MOTION =====
    const banner = raw.match(/^\s*\/\/\s*={3,}\s*(.+?)\s*={3,}/);
    if (banner) {
      section = banner[1].trim().toUpperCase();
      sectionLine = i;
    }

    // Preprocessor conditionals
    const cond = raw.match(COND_LINE);
    if (cond) {
      const directive = cond[1];
      const expr = cond[2].trim();
      if (directive === "if" || directive === "ifdef" || directive === "ifndef") {
        const parentActive = currentlyActive();
        // Evaluate simple presence: for ifdef/ifndef check macro defined-ness using known params so far
        let branchTrue = true;
        if (directive === "ifdef") {
          branchTrue = parameters.some((p) => p.name === expr && p.enabled);
        } else if (directive === "ifndef") {
          branchTrue = !parameters.some((p) => p.name === expr && p.enabled);
        } else {
          // #if - try simple evaluation
          branchTrue = evalSimpleIf(expr, parameters);
        }
        condStack.push({ taken: branchTrue, active: parentActive && branchTrue, expr, directive });
        continue;
      }
      if (directive === "elif") {
        const top = condStack[condStack.length - 1];
        if (top) {
          if (top.taken) {
            top.active = false;
          } else {
            const parentActive = condStack.length > 1 ? condStack[condStack.length - 2].active : true;
            const branchTrue = evalSimpleIf(expr, parameters);
            top.taken = top.taken || branchTrue;
            top.active = parentActive && branchTrue;
          }
        }
        continue;
      }
      if (directive === "else") {
        const top = condStack[condStack.length - 1];
        if (top) {
          const parentActive = condStack.length > 1 ? condStack[condStack.length - 2].active : true;
          if (top.taken) {
            top.active = false;
          } else {
            top.taken = true;
            top.active = parentActive;
          }
        }
        continue;
      }
      if (directive === "endif") {
        condStack.pop();
        continue;
      }
    }

    // Macro definitions
    const m = raw.match(MACRO_LINE);
    if (m) {
      const commented = !!m[1];
      const directive = m[2];
      const name = m[3];
      let rest = m[4] || "";
      // Extract trailing comment
      let inlineComment = "";
      const cmtIdx = rest.indexOf("//");
      if (cmtIdx >= 0) {
        inlineComment = rest.slice(cmtIdx + 2).trim();
        rest = rest.slice(0, cmtIdx);
      }
      rest = rest.trim();

      if (directive === "undef") {
        parameters.push({
          id: `${fileName}:${i}`,
          name,
          file: fileName,
          line: i,
          section,
          directive: "undef",
          type: "undef",
          value: null,
          rawValue: "",
          enabled: false,
          commented: false,
          inlineComment,
          rawText: raw,
          originalRawText: raw,
          modified: false,
          active: currentlyActive(),
        });
        continue;
      }

      const { type, value, rawValue } = parseValue(rest);
      parameters.push({
        id: `${fileName}:${i}`,
        name,
        file: fileName,
        line: i,
        section,
        directive: "define",
        type,
        value,
        rawValue,
        defaultValue: value,
        defaultRawValue: rawValue,
        enabled: !commented && currentlyActive(),
        commented,
        inlineComment,
        rawText: raw,
        originalRawText: raw,
        modified: false,
        active: currentlyActive(),
      });
      continue;
    }
  }

  return { parameters, lines, fileName };
}

function evalSimpleIf(expr, parameters) {
  // Very small evaluator: defined(X), !defined(X), X, comparisons
  const defined = (n) => parameters.some((p) => p.name === n && p.enabled);
  let e = expr.replace(/defined\s*\(\s*([A-Za-z0-9_]+)\s*\)/g, (_, n) => (defined(n) ? "true" : "false"));
  e = e.replace(/&&/g, "&&").replace(/\|\|/g, "||");
  // Replace bare macro names with their numeric value or true/false
  e = e.replace(/[A-Za-z_][A-Za-z0-9_]*/g, (name) => {
    if (name === "true" || name === "false") return name;
    const p = parameters.find((pp) => pp.name === name);
    if (!p) return "false";
    if (typeof p.value === "number") return String(p.value);
    return p.enabled ? "true" : "false";
  });
  try {
    // eslint-disable-next-line no-new-func
    return !!Function(`"use strict"; return (${e || "false"});`)();
  } catch {
    return true; // be permissive on unknown expressions
  }
}

/**
 * Serialize parameters back into a file text, preserving original lines.
 * Only lines whose parameter was modified are rewritten; everything else stays verbatim.
 */
export function serializeMarlinFile(parameters, originalLines, fileName) {
  const out = [...originalLines];
  for (const p of parameters) {
    if (p.file !== fileName) continue;
    if (!p.modified) continue;
    out[p.line] = renderLine(p);
  }
  return out.join("\n");
}

export function renderLine(p) {
  const prefix = p.commented ? "//" : "";
  if (p.directive === "undef") return `${prefix}#undef ${p.name}`;
  let val = "";
  if (p.type === "flag") val = "";
  else if (p.type === "string") val = ` "${p.value}"`;
  else if (p.type === "array") val = ` { ${p.value.join(", ")} }`;
  else val = ` ${p.rawValue && typeof p.rawValue === "string" ? p.rawValue : p.value}`;
  const cmt = p.inlineComment ? ` // ${p.inlineComment}` : "";
  return `${prefix}#define ${p.name}${val}${cmt}`;
}

/**
 * Toggle a parameter's enabled state (comment/uncomment), preserving structure.
 */
export function toggleParameter(p) {
  const updated = { ...p, enabled: !p.enabled, commented: !p.enabled, modified: true, lastModified: new Date().toISOString() };
  updated.rawText = renderLine(updated);
  return updated;
}

export function updateParameterValue(p, newValue) {
  const updated = { ...p, value: newValue, modified: true, lastModified: new Date().toISOString() };
  if (updated.type === "string") updated.rawValue = `"${newValue}"`;
  else if (updated.type === "array") updated.rawValue = `{ ${newValue.join(", ")} }`;
  else updated.rawValue = String(newValue);
  updated.rawText = renderLine(updated);
  return updated;
}

export function resetParameter(p) {
  return {
    ...p,
    value: p.defaultValue,
    rawValue: p.defaultRawValue,
    enabled: !p.commented && p.active,
    modified: false,
    rawText: p.originalRawText,
    lastModified: new Date().toISOString(),
  };
}