import React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import ThemeToggleButton from "../theme/ThemeToggleButton";
import { loadCachedData, saveCachedData } from "../copypartySync";

function ensureFoldersData(obj) {
  const o = (obj && typeof obj === "object") ? { ...obj } : {};
  if (!Array.isArray(o.folders) || o.folders.length === 0) {
    const names = [
      String(o.folder_one || "Folder One"),
      String(o.folder_two || "Folder Two"),
      String(o.folder_three || "Folder Three"),
      String(o.folder_four || "Folder Four"),
      String(o.folder_five || "Folder Five"),
      String(o.folder_six || "Folder Six"),
    ].map((s) => String(s || "").trim() || "Folder");

    o.folders = names.map((name, idx) => ({ id: `f${idx + 1}`, name }));
  } else {
    o.folders = o.folders.map((f, idx) => ({ id: String(f?.id || `f${idx + 1}`), name: String(f?.name || `Folder ${idx + 1}`) }));
  }

  for (const f of o.folders) {
    const k = `folder_${f.id}_tasks`;
    if (!Array.isArray(o[k])) o[k] = [];
  }

  const legacyNames = ["folder_one","folder_two","folder_three","folder_four","folder_five","folder_six"];
  for (let i = 0; i < legacyNames.length; i++) {
    o[legacyNames[i]] = String(o.folders[i]?.name || `Folder ${i + 1}`);
  }

  return o;
}

function ensureWaterSettings(obj) {
  const o = (obj && typeof obj === "object") ? { ...obj } : {};
  if (!o.water || typeof o.water !== "object") o.water = {};
  const v = Number(o.water.daily_goal_oz);
  if (!Number.isFinite(v) || v <= 0) o.water.daily_goal_oz = 80;
  o.water.daily_goal_oz = Math.max(1, Math.floor(Number(o.water.daily_goal_oz) || 80));
  return o;
}

export default function SettingsPage() {
  const { username, logout } = useAuth();
  const nav = useNavigate();

  const [dataObj, setDataObj] = React.useState(() => ensureWaterSettings(ensureFoldersData(loadCachedData())));
  const folders = Array.isArray(dataObj?.folders) ? dataObj.folders : [];

  const TABS = React.useMemo(() => ([
    { key: "account", label: "Account" },
    { key: "folders", label: "Folders" },
    { key: "water", label: "Water" },
  ]), []);

  const [activeTab, setActiveTab] = React.useState("account");
  const railRef = React.useRef(null);

  React.useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;
    const el = rail.querySelector(`[data-tab="${activeTab}"]`);
    if (!el) return;
    const railBox = rail.getBoundingClientRect();
    const elBox = el.getBoundingClientRect();
    const dx = (elBox.left + elBox.width / 2) - (railBox.left + railBox.width / 2);
    rail.scrollBy({ left: dx, behavior: "smooth" });
  }, [activeTab]);

  function persist(next) {
    const shaped = ensureWaterSettings(ensureFoldersData(next));
    setDataObj(shaped);
    saveCachedData(shaped);
  }

  function onLogout() { logout(); nav("/login", { replace: true }); }

  function renameFolder(folderId, nextName) {
    persist({ ...dataObj, folders: folders.map((f) => (f.id === folderId ? { ...f, name: String(nextName || "") } : f)) });
  }

  function addFolder() {
    const nextIdx = folders.length + 1;
    const id = `f${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const name = `Folder ${nextIdx}`;
    const next = { ...dataObj, folders: [...folders, { id, name }], [`folder_${id}_tasks`]: [] };
    persist(next);
  }

  function removeFolder(folderId) {
    if (folders.length <= 1) return;
    const idx = folders.findIndex((f) => f.id === folderId);
    if (idx < 0) return;
    const receiver = folders[Math.max(0, idx - 1)] || folders[0];
    if (!receiver) return;

    const fromKey = `folder_${folderId}_tasks`;
    const toKey = `folder_${receiver.id}_tasks`;

    const moved = Array.isArray(dataObj?.[fromKey]) ? dataObj[fromKey] : [];
    const existing = Array.isArray(dataObj?.[toKey]) ? dataObj[toKey] : [];

    const next = { ...dataObj };
    next[toKey] = [...existing, ...moved];
    next[fromKey] = [];
    next.folders = folders.filter((f) => f.id !== folderId);

    persist(next);
  }

  const goalOz = Number(dataObj?.water?.daily_goal_oz) || 80;

  return (
    <div className="pageWrap">
      <h1>Settings</h1>

      {/* Desktop/Tablet rail (top) */}
      <div className="settingsTabRailWrap settingsTabRailTop">
        <div className="settingsTabRail" ref={railRef}>
          {TABS.map(t => (
            <button key={t.key} type="button" data-tab={t.key} className={`settingsTabPill ${activeTab === t.key ? "isActive" : ""}`} onClick={() => setActiveTab(t.key)}>{t.label}</button>
          ))}
        </div>
        <div className="settingsTabRailFadeLeft" />
        <div className="settingsTabRailFadeRight" />
      </div>

      {/* Mobile rail (bottom, above hub) */}
      <div className="settingsTabRailWrap settingsTabRailBottom">
        <div className="settingsTabRail">
          {TABS.map(t => (
            <button key={t.key} type="button" className={`settingsTabPill ${activeTab === t.key ? "isActive" : ""}`} onClick={() => setActiveTab(t.key)}>{t.label}</button>
          ))}
        </div>
        <div className="settingsTabRailFadeLeft" />
        <div className="settingsTabRailFadeRight" />
      </div>

      <div style={{ display: "grid", gap: 14, maxWidth: 720 }}>
        {activeTab === "account" && (
          <>
            <div style={{ fontWeight: 800 }}>Currently logged in as: {username}</div>
            <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              <ThemeToggleButton />
              <button className="primaryBtn" onClick={onLogout}>Logout</button>
            </div>
          </>
        )}

        {activeTab === "folders" && (
          <>
            <div style={{ marginTop: 2, fontWeight: 900, fontSize: 16 }}>Folders</div>
            <div style={{ display: "grid", gap: 10 }}>
              {folders.map((f, i) => (
                <div key={f.id} style={{ display: "grid", gridTemplateColumns: "140px 1fr 44px", gap: 10, alignItems: "center" }}>
                  <div style={{ fontWeight: 900, opacity: 0.9 }}>{`Folder ${i + 1}:`}</div>
                  <input value={String(f.name || "")} onChange={(e) => renameFolder(f.id, e.target.value)} placeholder={`Folder ${i + 1}`} style={{ width: "100%", padding: "10px 12px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.18)", background: "rgba(255,255,255,0.06)", fontWeight: 800 }} />
                  <button type="button" onClick={() => removeFolder(f.id)} title="Remove folder" style={{ width: 44, height: 40, borderRadius: 12, border: "1px solid rgba(255,255,255,0.18)", background: "rgba(255,80,80,0.14)", fontWeight: 900 }}>−</button>
                </div>
              ))}
              <button type="button" onClick={addFolder} style={{ marginTop: 6, width: 56, height: 44, borderRadius: 14, border: "1px solid rgba(255,255,255,0.18)", background: "rgba(255,255,255,0.10)", fontWeight: 900, fontSize: 20 }} aria-label="Add folder" title="Add folder">+</button>
            </div>
          </>
        )}

        {activeTab === "water" && (
          <>
            <div style={{ marginTop: 2, fontWeight: 900, fontSize: 16 }}>Daily water goal</div>
            <div style={{ display: "grid", gridTemplateColumns: "160px 1fr", gap: 10, alignItems: "center", maxWidth: 420 }}>
              <div style={{ fontWeight: 900, opacity: 0.9 }}>Goal (oz):</div>
              <input
                value={String(goalOz)}
                inputMode="numeric"
                onChange={(e) => {
                  const n = Math.max(1, Math.floor(Number(String(e.target.value || "").replace(/[^\d]/g, "")) || 0));
                  persist({ ...dataObj, water: { ...(dataObj.water || {}), daily_goal_oz: n } });
                }}
                style={{ width: "100%", padding: "10px 12px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.18)", background: "rgba(255,255,255,0.06)", fontWeight: 800 }}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
