// Project store: global state via React context + localStorage persistence.
import React, { createContext, useContext, useEffect, useReducer } from "react";
import { parseMarlinFile, serializeMarlinFile, toggleParameter, updateParameterValue, resetParameter } from "./marlinParser";
import { getCategoryForParam, getMeta, DEPENDENCIES, CONFLICTS } from "./marlinKnowledge";
import { DEMO_PROJECT } from "./demoData";

const STORAGE_KEY = "mcfng:state:v2";
const LEGACY_STORAGE_KEY = "mcfng:state:v1";
const MAX_SNAPSHOTS_PER_PROJECT = 30;
const SNAPSHOT_DB_NAME = "marlin-flow-studio";
const SNAPSHOT_DB_VERSION = 1;
const SNAPSHOT_STORE = "snapshots";

// Snapshots can contain complete Marlin configuration files and therefore
// exceed the browser localStorage quota. Keep them in IndexedDB instead.
function openSnapshotDB() {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) return reject(new Error("IndexedDB indisponible"));
    const req = window.indexedDB.open(SNAPSHOT_DB_NAME, SNAPSHOT_DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(SNAPSHOT_STORE)) {
        db.createObjectStore(SNAPSHOT_STORE, { keyPath: "key" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error("Impossible d'ouvrir IndexedDB"));
  });
}

async function loadSnapshotsDB() {
  const db = await openSnapshotDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SNAPSHOT_STORE, "readonly");
    const req = tx.objectStore(SNAPSHOT_STORE).getAll();
    req.onsuccess = () => {
      const snapshots = {};
      for (const row of req.result || []) snapshots[row.projectId] = row.items || [];
      db.close();
      resolve(snapshots);
    };
    req.onerror = () => { db.close(); reject(req.error); };
  });
}

async function saveSnapshotsDB(snapshots) {
  const db = await openSnapshotDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SNAPSHOT_STORE, "readwrite");
    const store = tx.objectStore(SNAPSHOT_STORE);
    store.clear();
    for (const [projectId, items] of Object.entries(snapshots || {})) {
      store.put({ key: projectId, projectId, items: (items || []).slice(0, MAX_SNAPSHOTS_PER_PROJECT) });
    }
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
    tx.onabort = () => { db.close(); reject(tx.error || new Error("Échec de sauvegarde des snapshots")); };
  });
}

function loadProjects() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.projects && parsed.projects.length) {
        // Re-parse stored projects (only raw files are persisted)
        const projects = parsed.projects.map((p) => parseProject(p));
        return { projects, currentProjectId: parsed.currentProjectId, history: parsed.history || {}, snapshots: {} };
      }
    }
  } catch (e) {
    // ignore
  }
  // Seed demo
  const seeded = seedDemo();
  return seeded;
}

function seedDemo() {
  const proj = { ...DEMO_PROJECT, id: "demo", createdDate: new Date().toISOString(), updatedDate: new Date().toISOString() };
  const parsed = parseProject(proj);
  return {
    projects: [parsed],
    currentProjectId: parsed.id,
  };
}

export function parseProject(project) {
  const files = {};
  const allParams = [];
  for (const [fileName, content] of Object.entries(project.files || {})) {
    const parsed = parseMarlinFile(content, fileName);
    // Enrich with knowledge base
    const enriched = parsed.parameters.map((p) => {
      const meta = getMeta(p.name);
      return { ...p, category: meta.category, description: meta.description, documentationUrl: null };
    });
    files[fileName] = { content, originalLines: parsed.lines, parameters: enriched };
    allParams.push(...enriched);
  }
  const activeFiles = {};
  for (const fileName of Object.keys(files)) {
    activeFiles[fileName] = project.activeFiles ? project.activeFiles[fileName] !== false : true;
  }
  return { ...project, parsedFiles: files, allParameters: allParams, activeFiles };
}

const initialState = {
  projects: [],
  currentProjectId: null,
  selectedParameterId: null,
  selectedCategory: null,
  searchQuery: "",
  filter: "all",
  history: {},
  snapshots: {},
  snapshotsHydrated: false,
};

function reducer(state, action) {
  switch (action.type) {
    case "INIT": {
      const loaded = loadProjects();
      return { ...state, ...loaded };
    }
    case "HYDRATE": {
      return { ...state, projects: action.projects, currentProjectId: action.currentProjectId };
    }
    case "HYDRATE_LOCAL_PROJECT": {
      const incoming = parseProject(action.project);
      const match = state.projects.find((p) => p.localProjectPath && p.localProjectPath === incoming.localProjectPath);
      let projects;
      let id = incoming.id;
      if (match) {
        id = match.id;
        projects = state.projects.map((p) => (p.id === match.id ? { ...p, ...incoming, id: match.id } : p));
      } else if (state.projects.length === 1 && state.projects[0]?.id === "demo") {
        id = incoming.id || `local_${Date.now()}`;
        projects = [{ ...incoming, id }];
      } else {
        id = incoming.id || `local_${Date.now()}`;
        projects = [...state.projects, { ...incoming, id }];
      }
      return { ...state, projects, currentProjectId: id, selectedParameterId: null, selectedCategory: null, searchQuery: "", filter: "all" };
    }
    case "SELECT_PROJECT": {
      return { ...state, currentProjectId: action.id, selectedParameterId: null, selectedCategory: null, searchQuery: "", filter: "all" };
    }
    case "ADD_PROJECT": {
      return { ...state, projects: [...state.projects, action.project], currentProjectId: action.project.id };
    }
    case "UPDATE_PROJECT": {
      return { ...state, projects: state.projects.map((p) => (p.id === action.project.id ? action.project : p)) };
    }
    case "DELETE_PROJECT": {
      const projects = state.projects.filter((p) => p.id !== action.id);
      const currentProjectId = state.currentProjectId === action.id ? (projects[0]?.id || null) : state.currentProjectId;
      return { ...state, projects, currentProjectId };
    }
    case "SELECT_PARAMETER": {
      return { ...state, selectedParameterId: action.id };
    }
    case "SET_CATEGORY": {
      return { ...state, selectedCategory: action.category };
    }
    case "SET_SEARCH": {
      return { ...state, searchQuery: action.query };
    }
    case "SET_FILTER": {
      return { ...state, filter: action.filter };
    }
    case "UPDATE_PARAMETER": {
      const { projectId, file, line, updater } = action;
      const projects = state.projects.map((p) => {
        if (p.id !== projectId) return p;
        const pf = p.parsedFiles[file];
        if (!pf) return p;
        const parameters = pf.parameters.map((pp) => (pp.line === line ? updater(pp) : pp));
        const newPf = { ...pf, parameters };
        const parsedFiles = { ...p.parsedFiles, [file]: newPf };
        const allParameters = Object.values(parsedFiles).flatMap((f) => f.parameters);
        return { ...p, parsedFiles, allParameters, updatedDate: new Date().toISOString() };
      });
      const entry = { timestamp: new Date().toISOString(), action: action.actionLabel, projectId, file, line };
      const history = { ...state.history, [projectId]: [entry, ...(state.history[projectId] || [])].slice(0, 100) };
      return { ...state, projects, history };
    }
    case "ADD_SNAPSHOT": {
      const snap = action.snapshot;
      const snapshots = {
        ...state.snapshots,
        [action.projectId]: [snap, ...(state.snapshots[action.projectId] || [])].slice(0, MAX_SNAPSHOTS_PER_PROJECT),
      };
      return { ...state, snapshots };
    }
    case "RESTORE_SNAPSHOT": {
      const projects = state.projects.map((p) => (p.id === action.projectId ? action.project : p));
      return { ...state, projects };
    }
    case "SET_SNAPSHOTS": {
      return { ...state, snapshots: action.snapshots, snapshotsHydrated: true };
    }
    case "RESET_ALL": {
      const projects = state.projects.map((p) => {
        if (p.id !== action.projectId) return p;
        const parsedFiles = {};
        const allParameters = [];
        for (const [fileName, pf] of Object.entries(p.parsedFiles)) {
          const parameters = pf.parameters.map((pp) => resetParameter(pp));
          parsedFiles[fileName] = { ...pf, parameters };
          allParameters.push(...parameters);
        }
        return { ...p, parsedFiles, allParameters, updatedDate: new Date().toISOString() };
      });
      return { ...state, projects };
    }
    case "SET_FILE_ACTIVE": {
      const projects = state.projects.map((p) => {
        if (p.id !== action.projectId) return p;
        return { ...p, activeFiles: { ...p.activeFiles, [action.file]: action.active }, updatedDate: new Date().toISOString() };
      });
      return { ...state, projects };
    }
    default:
      return state;
  }
}

const ProjectContext = createContext(null);

export function ProjectProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    dispatch({ type: "INIT" });
    loadSnapshotsDB()
      .then((snapshots) => dispatch({ type: "SET_SNAPSHOTS", snapshots }))
      .catch(() => {
        // Mark hydration complete even when IndexedDB is unavailable, so the
        // application does not remain stuck waiting for persistence.
        dispatch({ type: "SET_SNAPSHOTS", snapshots: {} });
      });
  }, []);

  // Persist projects. Snapshots are intentionally excluded: complete Marlin
  // files are stored separately in IndexedDB to avoid localStorage quota loss.

  useEffect(() => {
    if (state.projects.length) {
      try {
        const minimal = state.projects.map((p) => {
          const files = {};
          for (const [fileName, pf] of Object.entries(p.parsedFiles || {})) {
            files[fileName] = serializeMarlinFile(pf.parameters, pf.originalLines, fileName);
          }
          return {
            id: p.id,
            name: p.name,
            description: p.description,
            manufacturer: p.manufacturer,
            model: p.model,
            board: p.board,
            marlinVersion: p.marlinVersion,
            configVersion: p.configVersion,
            author: p.author,
            tags: p.tags,
            createdDate: p.createdDate,
            updatedDate: p.updatedDate,
            files,
            activeFiles: p.activeFiles,
            localHashes: p.localHashes || {},
            localProjectPath: p.localProjectPath || "",
          };
        });
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ projects: minimal, currentProjectId: state.currentProjectId, history: state.history }));
      } catch (e) {
        // storage full - ignore
      }
    }
  }, [state.projects, state.currentProjectId, state.history]);

  // Persist snapshots independently in IndexedDB. This survives application
  // restarts and does not compete with the small localStorage quota.
  useEffect(() => {
    if (!state.snapshotsHydrated) return;
    if (!state.projects.length && !Object.keys(state.snapshots).length) return;
    saveSnapshotsDB(state.snapshots).catch(() => {
      // Do not break configuration editing if persistent storage is unavailable.
    });
  }, [state.snapshots]);

  const value = {
    state,
    dispatch,
    // helpers
    currentProject: state.projects.find((p) => p.id === state.currentProjectId) || null,
    selectProject: (id) => dispatch({ type: "SELECT_PROJECT", id }),
    selectParameter: (id) => dispatch({ type: "SELECT_PARAMETER", id }),
    setCategory: (c) => dispatch({ type: "SET_CATEGORY", category: c }),
    setSearch: (q) => dispatch({ type: "SET_SEARCH", query: q }),
    setFilter: (f) => dispatch({ type: "SET_FILTER", filter: f }),
    toggleParam: (projectId, file, param) =>
      dispatch({ type: "UPDATE_PARAMETER", projectId, file, line: param.line, updater: toggleParameter, actionLabel: `Toggle ${param.name}` }),
    updateValue: (projectId, file, param, newValue) =>
      dispatch({ type: "UPDATE_PARAMETER", projectId, file, line: param.line, updater: (p) => updateParameterValue(p, newValue), actionLabel: `Change ${param.name}` }),
    resetParam: (projectId, file, param) =>
      dispatch({ type: "UPDATE_PARAMETER", projectId, file, line: param.line, updater: resetParameter, actionLabel: `Reset ${param.name}` }),
    resetAll: (projectId) => dispatch({ type: "RESET_ALL", projectId }),
    toggleFileActive: (projectId, file, active) => dispatch({ type: "SET_FILE_ACTIVE", projectId, file, active }),
    addProject: (project) => {
      const parsed = parseProject(project);
      dispatch({ type: "ADD_PROJECT", project: parsed });
    },
    updateProject: (project) => dispatch({ type: "UPDATE_PROJECT", project }),
    deleteProject: (id) => dispatch({ type: "DELETE_PROJECT", id }),
    takeSnapshot: (projectId, name) => {
      const p = state.projects.find((x) => x.id === projectId);
      if (!p) return;
      const files = {};
      for (const [fileName, pf] of Object.entries(p.parsedFiles || {})) {
        files[fileName] = serializeMarlinFile(pf.parameters, pf.originalLines, fileName);
      }
      const snap = {
        id: `snap_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        version: 3,
        projectId,
        name,
        timestamp: new Date().toISOString(),
        files,
        activeFiles: { ...(p.activeFiles || {}) },
        parameters: JSON.parse(JSON.stringify(p.allParameters || [])),
      };
      dispatch({ type: "ADD_SNAPSHOT", projectId, snapshot: snap });
    },
    restoreSnapshot: (projectId, snapshotId) => {
      const p = state.projects.find((x) => x.id === projectId);
      const snap = (state.snapshots[projectId] || []).find((s) => s.id === snapshotId);
      if (!p || !snap) return false;

      // v2 snapshots store the complete serialized configuration files.
      // This is much safer than restoring only parameter objects because line
      // numbers and parser ids can change when Marlin files are edited.
      if (snap.files && Object.keys(snap.files).length) {
        const restored = parseProject({
          ...p,
          files: { ...snap.files },
          activeFiles: snap.activeFiles || p.activeFiles,
          updatedDate: new Date().toISOString(),
        });
        dispatch({ type: "RESTORE_SNAPSHOT", projectId, project: restored });
        return true;
      }

      // Backward compatibility with v1 snapshots.
      const parsedFiles = {};
      const allParameters = [];
      for (const [fileName, pf] of Object.entries(p.parsedFiles)) {
        const parameters = pf.parameters.map((pp) => {
          const restored = snap.parameters?.find((sp) => sp.id === pp.id);
          return restored ? { ...restored } : pp;
        });
        parsedFiles[fileName] = { ...pf, parameters };
        allParameters.push(...parameters);
      }
      dispatch({ type: "RESTORE_SNAPSHOT", projectId, project: { ...p, parsedFiles, allParameters, updatedDate: new Date().toISOString() } });
      return true;
    },
    deleteSnapshot: (projectId, snapshotId) => {
      const snapshots = {
        ...state.snapshots,
        [projectId]: (state.snapshots[projectId] || []).filter((s) => s.id !== snapshotId),
      };
      dispatch({ type: "SET_SNAPSHOTS", snapshots });
    },
    exportFile: (projectId, fileName) => {
      const p = state.projects.find((x) => x.id === projectId);
      if (!p) return "";
      const pf = p.parsedFiles[fileName];
      if (!pf) return "";
      return serializeMarlinFile(pf.parameters, pf.originalLines, fileName);
    },
  };

  return React.createElement(ProjectContext.Provider, { value }, children);
}

export function useProject() {
  const ctx = useContext(ProjectContext);
  if (!ctx) throw new Error("useProject must be used within ProjectProvider");
  return ctx;
}

// Validation engine
export function validateProject(project) {
  const warnings = [];
  const errors = [];
  const params = project.allParameters;
  const enabled = (name) => params.some((p) => p.name === name && p.enabled);

  // Dependencies
  for (const p of params) {
    if (!p.enabled) continue;
    const deps = DEPENDENCIES[p.name];
    if (deps) {
      for (const d of deps) {
        if (!enabled(d)) {
          warnings.push({ level: "WARNING", param: p.name, message: `${p.name} nécessite ${d}, qui est désactivé.` });
        }
      }
    }
  }
  // Conflicts
  for (const c of CONFLICTS) {
    const active = c.group.filter(enabled);
    if (active.length > 1) {
      errors.push({ level: "ERROR", param: active.join(", "), message: c.message });
    }
  }
  // EEPROM without compatible board
  if (enabled("EEPROM_SETTINGS") && project.board && /RAMPS|GEN6|GEN7/i.test(project.board)) {
    warnings.push({ level: "WARNING", param: "EEPROM_SETTINGS", message: "EEPROM activée mais la carte peut ne pas supporter l'EEPROM." });
  }
  // Thermal protection off
  if (!enabled("THERMAL_PROTECTION_HOTENDS")) {
    warnings.push({ level: "WARNING", param: "THERMAL_PROTECTION_HOTENDS", message: "Protection thermique hotend désactivée — dangereux." });
  }
  return { warnings, errors };
}

export function computeDiff(project) {
  const diffs = [];
  for (const p of project.allParameters) {
    if (p.modified) {
      diffs.push({
        name: p.name,
        file: p.file,
        line: p.line,
        before: p.originalRawText.trim(),
        after: p.rawText.trim(),
        type: p.enabled !== (p.originalRawText.match(/^\s*\/\//) ? false : true) ? "toggle" : "value",
      });
    }
  }
  return diffs;
}