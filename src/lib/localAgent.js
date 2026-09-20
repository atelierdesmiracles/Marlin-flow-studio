const DEFAULT_URL = "http://127.0.0.1:38765";
const TOKEN_KEY = "marlin_agent_token";
const URL_KEY = "marlin_agent_url";

export function getAgentUrl() {
  if (typeof window === "undefined") return DEFAULT_URL;
  return (window.localStorage.getItem(URL_KEY) || DEFAULT_URL).replace(/\/$/, "");
}

export function setAgentUrl(url) {
  if (typeof window === "undefined") return;
  const value = String(url || DEFAULT_URL).trim().replace(/\/$/, "");
  window.localStorage.setItem(URL_KEY, value || DEFAULT_URL);
}

export function getAgentToken() {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(TOKEN_KEY) || "";
}

export function setAgentToken(token) {
  if (typeof window === "undefined") return;
  if (token) window.localStorage.setItem(TOKEN_KEY, String(token));
  else window.localStorage.removeItem(TOKEN_KEY);
}

async function request(path, options = {}) {
  const headers = new Headers(options.headers || {});
  const token = getAgentToken();
  if (token) headers.set("X-Marlin-Agent-Token", token);
  if (options.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeout ?? 15000);
  let response;
  try {
    response = await fetch(`${getAgentUrl()}${path}`, { ...options, headers, signal: controller.signal, cache: "no-store" });
  } finally {
    clearTimeout(timeout);
  }

  let data;
  try {
    data = await response.json();
  } catch {
    data = { success: false, error: await response.text() };
  }

  if (!response.ok) {
    const error = new Error(data?.error || `Agent HTTP ${response.status}`);
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}

export async function pingAgent() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4000);
  try {
    const response = await fetch(`${getAgentUrl()}/api/ping`, { cache: "no-store", signal: controller.signal });
    if (!response.ok) throw new Error(`Agent HTTP ${response.status}`);
    return response.json();
  } catch (e) {
    if (e?.name === "AbortError") throw new Error("L’Agent local ne répond pas sur 127.0.0.1:38765.");
    throw e;
  } finally {
    clearTimeout(timeout);
  }
}

export const agentApi = {
  status: () => request("/api/status"),
  info: () => request("/api/info"),
  systemTools: () => request("/api/system/tools"),
  project: () => request("/api/project", { timeout: 20000 }),
  selectProject: (path) => request("/api/project/select", { method: "POST", timeout: 20000, body: JSON.stringify({ path }) }),
  latestMarlin: () => request("/api/marlin/latest"),
  createMarlinProject: (destination, name, tag) => request("/api/project/create", { method: "POST", timeout: 10 * 60 * 1000, body: JSON.stringify({ destination, name, tag }) }),
  environments: () => request("/api/environments"),
  doctor: () => request("/api/doctor", { timeout: 90000 }),
  selectEnvironment: (environment) => request("/api/environments/select", { method: "POST", body: JSON.stringify({ environment }) }),
  buildArtifacts: () => request("/api/build/artifacts"),
  removableStorage: () => request("/api/storage/removable"),
  saveArtifactToRemovable: (path, mount, filename, overwrite = false) => request("/api/build/artifact/save", { method: "POST", body: JSON.stringify({ path, mount, filename, overwrite }) }),
  marlinInfo: () => request("/api/marlin/info"),
  logs: (limit = 300, since = 0) => request(`/api/logs?limit=${encodeURIComponent(limit)}&since=${encodeURIComponent(since)}`),
  installPlatformIO: () => request("/api/platformio/install", { method: "POST" }),
  build: (environment, uploadPort) => request("/api/build", { method: "POST", body: JSON.stringify({ environment, upload_port: uploadPort }) }),
  clean: (environment) => request("/api/clean", { method: "POST", body: JSON.stringify({ environment }) }),
  upload: (environment, uploadPort) => request("/api/upload", { method: "POST", body: JSON.stringify({ environment, upload_port: uploadPort }) }),
  buildUpload: (environment, uploadPort) => request("/api/build-upload", { method: "POST", body: JSON.stringify({ environment, upload_port: uploadPort }) }),
  stop: () => request("/api/process/stop", { method: "POST" }),
  readConfiguration: (file = "Configuration.h") => request(`/api/configuration?file=${encodeURIComponent(file)}`),
  writeConfiguration: (file, content, expected_sha256) => request("/api/configuration/write", { method: "POST", body: JSON.stringify({ file, content, expected_sha256 }) }),
  migrateConfiguration: (files, dry_run = false) => request("/api/configuration/migrate", { method: "POST", timeout: 120000, body: JSON.stringify({ files, dry_run }) }),
  listFiles: () => request("/api/files"),
  readFile: (path) => request(`/api/file?path=${encodeURIComponent(path)}`),
  writeFile: (path, content, expected_sha256, backup = true) => request("/api/file/write", { method: "POST", body: JSON.stringify({ path, content, expected_sha256, backup }) }),
  gitStatus: () => request("/api/git/status"),
  gitPull: () => request("/api/git/pull", { method: "POST" }),
  ports: () => request("/api/serial/ports"),
  serialAuthorize: (port) => request("/api/serial/authorize", { method: "POST", body: JSON.stringify({ port }), timeout: 70000 }),
  serialConnect: (port, baudrate = 115200) => request("/api/serial/connect", { method: "POST", body: JSON.stringify({ port, baudrate }) }),
  serialDisconnect: () => request("/api/serial/disconnect", { method: "POST" }),
  serialSend: (command) => request("/api/serial/send", { method: "POST", body: JSON.stringify({ command }), timeout: 10000 }),
  serialSendText: (text, line_delay_ms = 15) => request("/api/serial/send-text", { method: "POST", body: JSON.stringify({ text, line_delay_ms }), timeout: 120000 }),
};
