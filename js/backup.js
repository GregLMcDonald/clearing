// Export / import and optional Google Drive backup (ported from limber).
//
// Drive is opt-in and off by default. Nothing leaves the device until the
// person pastes their own OAuth client ID in Settings: only then is Google's
// sign-in script (accounts.google.com/gsi/client) loaded, and only after they
// tap Connect does the app call the Drive API. Scope is drive.file, so the app
// sees only the one file it creates. Single writer, last write wins. The access
// token lives in memory only; localStorage keeps the public client ID, the
// backup's file id and the last sync time.

export const BACKUP_APP = "clearing";
const CLIENT_ID_KEY = "clearing.clientId";
const META_KEY = "clearing.drive.v1";
const FILE_NAME = "clearing-backup.json";
const SCOPE = "https://www.googleapis.com/auth/drive.file";
const GIS_SRC = "https://accounts.google.com/gsi/client";

// ───────── file export / import ─────────
export function downloadJSON(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Parse a backup file's text. Throws if it isn't a Clearing backup.
export function parseBackup(text) {
  const data = JSON.parse(text);
  if (!data || typeof data !== "object" || data.app !== BACKUP_APP) throw new Error("not-clearing");
  return data;
}

// ───────── Google Drive ─────────
export function getClientId() {
  try { return (localStorage.getItem(CLIENT_ID_KEY) || "").trim(); } catch (_) { return ""; }
}
export function setClientId(id) {
  try { id ? localStorage.setItem(CLIENT_ID_KEY, id) : localStorage.removeItem(CLIENT_ID_KEY); } catch (_) {}
}
export const isDriveConfigured = () => getClientId().endsWith(".apps.googleusercontent.com");

let gisPromise = null;
// Load Google Identity Services once, and only when Drive is configured.
export function loadGis() {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  if (!isDriveConfigured()) return Promise.reject(new Error("not-configured"));
  if (!gisPromise) {
    gisPromise = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = GIS_SRC;
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => { gisPromise = null; s.remove(); reject(new Error("gis-load")); };
      document.head.appendChild(s);
    });
  }
  return gisPromise;
}

// hooks: payload() → object to upload; onChange() → status changed (re-render).
export class DriveSync {
  constructor({ payload, onChange }) {
    this.payload = payload;
    this.onChange = onChange || (() => {});
    this.tokenClient = null;
    this.tokenClientId = null;
    this.accessToken = null;   // memory only
    this.connected = false;
    this.syncing = false;
    this.fileId = null;
    this.lastSynced = null;
    this.autoConnect = false;
    this.pushTimer = null;
    this.loadMeta();
  }

  loadMeta() {
    try {
      const m = JSON.parse(localStorage.getItem(META_KEY) || "null");
      if (!m) return;
      this.fileId = typeof m.fileId === "string" ? m.fileId : null;
      this.lastSynced = typeof m.lastSynced === "string" ? m.lastSynced : null;
      this.autoConnect = !!m.autoConnect;
    } catch (_) {}
  }
  saveMeta() {
    try {
      localStorage.setItem(META_KEY, JSON.stringify({ fileId: this.fileId, lastSynced: this.lastSynced, autoConnect: this.connected }));
    } catch (_) {}
  }
  set(patch) { Object.assign(this, patch); this.onChange(); }

  // Built lazily; rebuilt if a different client ID is pasted.
  ensureTokenClient() {
    const id = getClientId();
    if (!isDriveConfigured() || !window.google?.accounts?.oauth2) return null;
    if (this.tokenClient && this.tokenClientId === id) return this.tokenClient;
    this.tokenClient = google.accounts.oauth2.initTokenClient({ client_id: id, scope: SCOPE, callback: () => {} });
    this.tokenClientId = id;
    return this.tokenClient;
  }
  // prompt "" = silent if already granted, "consent" forces the dialog.
  getToken(prompt = "") {
    return new Promise((resolve, reject) => {
      const client = this.ensureTokenClient();
      if (!client) { reject(new Error("auth")); return; }
      client.callback = (resp) => {
        if (resp?.access_token) { this.accessToken = resp.access_token; resolve(resp.access_token); }
        else reject(new Error("auth"));
      };
      client.error_callback = () => reject(new Error("auth"));
      try { client.requestAccessToken({ prompt }); } catch (_) { reject(new Error("auth")); }
    });
  }
  // fetch with the token; on 401, re-request it silently once.
  async api(url, options = {}, retried = false) {
    if (!this.accessToken) await this.getToken("");
    const res = await fetch(url, { ...options, headers: { ...options.headers, Authorization: `Bearer ${this.accessToken}` } });
    if (res.status === 401) {
      if (retried) throw new Error("auth");
      this.accessToken = null;
      return this.api(url, options, true);
    }
    return res;
  }

  async resolveFileId() {
    if (this.fileId) return this.fileId;
    const q = encodeURIComponent(`name='${FILE_NAME}' and trashed=false`);
    const res = await this.api(`https://www.googleapis.com/drive/v3/files?q=${q}&spaces=drive&fields=files(id)`);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.files?.length) { this.fileId = data.files[0].id; this.saveMeta(); }
    return this.fileId;
  }
  async createFile(json) {
    const b = `clearing${Date.now().toString(36)}`;
    const body = `--${b}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({ name: FILE_NAME, mimeType: "application/json" })}\r\n` +
      `--${b}\r\nContent-Type: application/json\r\n\r\n${json}\r\n--${b}--`;
    const res = await this.api("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id",
      { method: "POST", headers: { "Content-Type": `multipart/related; boundary=${b}` }, body });
    if (!res.ok) throw new Error("create-failed");
    this.fileId = (await res.json()).id;
    this.saveMeta();
  }
  async updateFile(json) {
    const res = await this.api(`https://www.googleapis.com/upload/drive/v3/files/${this.fileId}?uploadType=media`,
      { method: "PATCH", headers: { "Content-Type": "application/json" }, body: json });
    if (res.status === 404) { this.fileId = null; this.saveMeta(); throw new Error("not-found"); }
    if (!res.ok) throw new Error("update-failed");
  }
  async fetchRemote() {
    const id = await this.resolveFileId();
    if (!id) return null;
    const res = await this.api(`https://www.googleapis.com/drive/v3/files/${id}?alt=media`);
    if (res.status === 404) { this.fileId = null; this.saveMeta(); return null; }
    if (!res.ok) return null;
    try { return await res.json(); } catch (_) { return null; }
  }

  // Upload local data. Returns true on success; never throws.
  async push() {
    if (!this.connected || this.syncing || !navigator.onLine) return false;
    this.set({ syncing: true });
    try {
      const json = JSON.stringify(this.payload());
      if (await this.resolveFileId()) {
        try { await this.updateFile(json); }
        catch (e) { if (e.message === "not-found") await this.createFile(json); else throw e; }
      } else {
        await this.createFile(json);
      }
      this.lastSynced = new Date().toISOString();
      this.saveMeta();
      return true;
    } catch (e) {
      if (e?.message === "auth") this.dropConnection();
      return false;
    } finally {
      this.set({ syncing: false });
    }
  }
  // Debounced auto-backup after local changes.
  schedule() {
    if (!this.connected || !navigator.onLine) return;
    clearTimeout(this.pushTimer);
    this.pushTimer = setTimeout(() => { this.pushTimer = null; this.push(); }, 4000);
  }

  // Remote is newer when it changed after our last sync (or we never synced).
  isRemoteNewer(remote) {
    const iso = remote?.lastModified;
    return !!iso && (!this.lastSynced || iso > this.lastSynced);
  }
  markRestored() { this.lastSynced = new Date().toISOString(); this.saveMeta(); }

  // Connect from a tap (opens Google's consent popup). Resolves with the
  // remote backup when it's newer than local data, so the app can offer to
  // restore it; otherwise pushes local data up and resolves null.
  async connect() {
    if (!this.ensureTokenClient()) throw new Error("gis-not-ready");
    this.set({ syncing: true });
    try {
      await this.getToken("");
      this.connected = true;
      this.saveMeta();
      this.set({ syncing: false });
      const remote = await this.fetchRemote();
      if (remote && this.isRemoteNewer(remote)) return remote;
      await this.push();
      return null;
    } catch (e) {
      this.connected = false;
      throw e;
    } finally {
      this.set({ syncing: false });
    }
  }
  disconnect() {
    clearTimeout(this.pushTimer);
    this.connected = false;
    this.accessToken = null;
    this.saveMeta(); // keeps fileId so reconnecting reuses the same file
    this.onChange();
  }
  dropConnection() { this.connected = false; this.accessToken = null; this.saveMeta(); this.onChange(); }

  // On load: if we were connected last time, try to get a token silently.
  async autoReconnect() {
    if (!this.autoConnect || !isDriveConfigured()) return;
    try {
      await loadGis();
      if (!this.ensureTokenClient()) return;
      await this.getToken("");
      this.set({ connected: true });
    } catch (_) {}
  }
}
