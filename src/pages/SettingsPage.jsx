import React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import ThemeToggleButton from "../theme/ThemeToggleButton";
import ColorPicker from "../components/ColorPicker";
import { loadCachedData, saveCachedData } from "../copypartySync";

const DAYS = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
const REST_KEYS = ["short","half","full"];

function ensureSpoonsSettings(obj) {
  const o = (obj && typeof obj === "object") ? { ...obj } : {};
  if (!Number.isFinite(Number(o.spoons))) o.spoons = 0;
  if (!o.daily_spoons || typeof o.daily_spoons !== "object") o.daily_spoons = {};
  for (const d of DAYS) { if (!Number.isFinite(Number(o.daily_spoons[d]))) o.daily_spoons[d] = 0; o.daily_spoons[d] = Math.max(0, Math.floor(Number(o.daily_spoons[d]) || 0)); }
  if (!o.rest_spoons || typeof o.rest_spoons !== "object") o.rest_spoons = { short: 1, half: 2, full: 3 };
  for (const k of REST_KEYS) { if (!Number.isFinite(Number(o.rest_spoons[k]))) o.rest_spoons[k] = (k === "short" ? 1 : (k === "half" ? 2 : 3)); o.rest_spoons[k] = Math.max(0, Math.floor(Number(o.rest_spoons[k]) || 0)); }
  const tps = Number(o.time_per_spoon);
  if (!Number.isFinite(tps) || tps <= 0) o.time_per_spoon = 10;
  o.time_per_spoon = Math.max(1, Math.floor(Number(o.time_per_spoon) || 10));
  if (typeof o.spoons_debt_toggle !== "boolean") o.spoons_debt_toggle = false;
  if (typeof o.spoons_debt_consequences_toggle !== "boolean") o.spoons_debt_consequences_toggle = false;
  return o;
}

function ensureFoldersData(obj) {
  const o = (obj && typeof obj === "object") ? { ...obj } : {};
  if (!Array.isArray(o.folders) || o.folders.length === 0) {
    const names = [String(o.folder_one || "Folder One"),String(o.folder_two || "Folder Two"),String(o.folder_three || "Folder Three"),String(o.folder_four || "Folder Four"),String(o.folder_five || "Folder Five"),String(o.folder_six || "Folder Six")].map((s) => String(s || "").trim() || "Folder");
    o.folders = names.map((name, idx) => ({ id: `f${idx + 1}`, name, color: "" }));
  } else {
    o.folders = o.folders.map((f, idx) => ({ id: String(f?.id || `f${idx + 1}`), name: String(f?.name || `Folder ${idx + 1}`), color: String(f?.color || "").trim() }));
  }

  for (const f of o.folders) {
    const k = `folder_${f.id}_tasks`;
    if (!Array.isArray(o[k])) o[k] = [];
  }

  const legacyNames = ["folder_one","folder_two","folder_three","folder_four","folder_five","folder_six"];
  for (let i = 0; i < legacyNames.length; i++) { o[legacyNames[i]] = String(o.folders[i]?.name || `Folder ${i + 1}`); }

  if (!o.folder_days_ahead || typeof o.folder_days_ahead !== "object") o.folder_days_ahead = {};
  const legacyDays = (o.folder_days_ahead && typeof o.folder_days_ahead === "object") ? o.folder_days_ahead : {};
  for (let i = 0; i < o.folders.length; i++) {
    const f = o.folders[i];
    const cur = Number(o.folder_days_ahead[f.id]);
    if (Number.isFinite(cur) && cur >= 0) continue;
    const legacyKey = legacyNames[i];
    const legacyVal = Number(legacyDays?.[legacyKey]);
    if (Number.isFinite(legacyVal) && legacyVal >= 0) o.folder_days_ahead[f.id] = Math.floor(legacyVal);
    else o.folder_days_ahead[f.id] = 7;
  }

  for (const k of Object.keys(o.folder_days_ahead)) { if (!o.folders.some((f) => String(f.id) === String(k))) delete o.folder_days_ahead[k]; }

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

  const [dataObj, setDataObj] = React.useState(() => ensureWaterSettings(ensureFoldersData(ensureSpoonsSettings(loadCachedData()))));
  const folders = Array.isArray(dataObj?.folders) ? dataObj.folders : [];

  const [folderDrafts, setFolderDrafts] = React.useState(() => { const m = {}; for (const f of folders) m[f.id] = String(f?.name || ""); return m; });
  const [folderColorDrafts, setFolderColorDrafts] = React.useState(() => { const m = {}; for (const f of folders) m[f.id] = String(f?.color || "").trim(); return m; });
  const [folderDaysDrafts, setFolderDaysDrafts] = React.useState(() => { const m = {}; for (const f of folders) m[f.id] = String(Math.max(0, Math.floor(Number(dataObj?.folder_days_ahead?.[f.id]) || 7))); return m; });

  const [waterGoalDraft, setWaterGoalDraft] = React.useState(() => String(Number(dataObj?.water?.daily_goal_oz) || 80));

  const [dailyDrafts, setDailyDrafts] = React.useState(() => { const m = {}; for (const d of DAYS) m[d] = String(Math.max(0, Math.floor(Number(dataObj?.daily_spoons?.[d]) || 0))); return m; });
  const [restDrafts, setRestDrafts] = React.useState(() => ({ short: String(Math.floor(Number(dataObj?.rest_spoons?.short) || 1)), half: String(Math.floor(Number(dataObj?.rest_spoons?.half) || 2)), full: String(Math.floor(Number(dataObj?.rest_spoons?.full) || 3)) }));
  const [tpsDraft, setTpsDraft] = React.useState(() => String(Math.max(1, Math.floor(Number(dataObj?.time_per_spoon) || 10))));

  const [showDaysInfo, setShowDaysInfo] = React.useState(false);

  React.useEffect(() => {
    setFolderDrafts((prev) => {
      const next = { ...prev };
      for (const f of folders) { if (!(f.id in next)) next[f.id] = String(f?.name || ""); }
      for (const k of Object.keys(next)) { if (!folders.some((f) => f.id === k)) delete next[k]; }
      return next;
    });

    setFolderColorDrafts((prev) => {
      const next = { ...prev };
      for (const f of folders) { if (!(f.id in next)) next[f.id] = String(f?.color || "").trim(); }
      for (const k of Object.keys(next)) { if (!folders.some((f) => f.id === k)) delete next[k]; }
      return next;
    });

    setFolderDaysDrafts((prev) => {
      const next = { ...prev };
      for (const f of folders) { if (!(f.id in next)) next[f.id] = String(Math.max(0, Math.floor(Number(dataObj?.folder_days_ahead?.[f.id]) || 7))); }
      for (const k of Object.keys(next)) { if (!folders.some((f) => f.id === k)) delete next[k]; }
      return next;
    });
  }, [folders, dataObj?.folder_days_ahead]);

  React.useEffect(() => { setWaterGoalDraft(String(Number(dataObj?.water?.daily_goal_oz) || 80)); }, [dataObj?.water?.daily_goal_oz]);
  React.useEffect(() => { setDailyDrafts(() => { const m = {}; for (const d of DAYS) m[d] = String(Math.max(0, Math.floor(Number(dataObj?.daily_spoons?.[d]) || 0))); return m; }); }, [dataObj?.daily_spoons]);
  React.useEffect(() => { setRestDrafts({ short: String(Math.floor(Number(dataObj?.rest_spoons?.short) || 1)), half: String(Math.floor(Number(dataObj?.rest_spoons?.half) || 2)), full: String(Math.floor(Number(dataObj?.rest_spoons?.full) || 3)) }); }, [dataObj?.rest_spoons]);
  React.useEffect(() => { setTpsDraft(String(Math.max(1, Math.floor(Number(dataObj?.time_per_spoon) || 10)))); }, [dataObj?.time_per_spoon]);

  const TABS = React.useMemo(() => ([
    { key: "account", label: "Account" },
    { key: "spoons", label: "Spoons" },
    { key: "folders", label: "Folders" },
    { key: "water", label: "Water" },
    { key: "extensions", label: "Extensions" },
  ]), []);

  const [activeTab, setActiveTab] = React.useState("account");
  const [openColorFor, setOpenColorFor] = React.useState("");

  React.useEffect(() => { if (activeTab !== "folders") setOpenColorFor(""); }, [activeTab]);

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
    const shaped = ensureWaterSettings(ensureFoldersData(ensureSpoonsSettings(next)));
    setDataObj(shaped);
    saveCachedData(shaped);
  }

  function onLogout() { logout(); nav("/login", { replace: true }); }

  function renameFolder(folderId, nextName) { persist({ ...dataObj, folders: folders.map((f) => (f.id === folderId ? { ...f, name: String(nextName || "") } : f)) }); }
  function setFolderColor(folderId, nextColor) { persist({ ...dataObj, folders: folders.map((f) => (f.id === folderId ? { ...f, color: String(nextColor || "").trim() } : f)) }); }
  function setFolderDaysAhead(folderId, days) { persist({ ...dataObj, folder_days_ahead: { ...(dataObj.folder_days_ahead || {}), [String(folderId)]: Math.max(0, Math.floor(Number(days) || 0)) } }); }

  function addFolder() {
    const nextIdx = folders.length + 1;
    const id = `f${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const name = `Folder ${nextIdx}`;
    const next = { ...dataObj, folders: [...folders, { id, name, color: "" }], folder_days_ahead: { ...(dataObj.folder_days_ahead || {}), [id]: 7 }, [`folder_${id}_tasks`]: [] };
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
    next.folder_days_ahead = { ...(next.folder_days_ahead || {}) };
    delete next.folder_days_ahead[String(folderId)];

    persist(next);
  }

  function setDailySpoons(day, n) { persist({ ...dataObj, daily_spoons: { ...(dataObj.daily_spoons || {}), [day]: Math.max(0, Math.floor(Number(n) || 0)) } }); }
  function setRestSpoons(kind, n) { persist({ ...dataObj, rest_spoons: { ...(dataObj.rest_spoons || {}), [kind]: Math.max(0, Math.floor(Number(n) || 0)) } }); }
  function setTimePerSpoon(n) { persist({ ...dataObj, time_per_spoon: Math.max(1, Math.floor(Number(n) || 1)) }); }
  function toggleDebt() { persist({ ...dataObj, spoons_debt_toggle: !Boolean(dataObj?.spoons_debt_toggle) }); }
  function toggleDebtConsequences() { persist({ ...dataObj, spoons_debt_consequences_toggle: !Boolean(dataObj?.spoons_debt_consequences_toggle) }); }

  return (
    <div className="pageWrap">
      <h1>Settings</h1>

      <div className="settingsTabRailWrap settingsTabRailTop">
        <div className="settingsTabRail" ref={railRef}>
          {TABS.map((t) => (<button key={t.key} type="button" data-tab={t.key} className={`settingsTabPill ${activeTab === t.key ? "isActive" : ""}`} onClick={() => setActiveTab(t.key)}>{t.label}</button>))}
        </div>
      </div>

      <div className="settingsTabRailWrap settingsTabRailBottom">
        <div className="settingsTabRail">
          {TABS.map((t) => (<button key={t.key} type="button" className={`settingsTabPill ${activeTab === t.key ? "isActive" : ""}`} onClick={() => setActiveTab(t.key)}>{t.label}</button>))}
        </div>
      </div>

      <div style={{ display: "grid", gap: 14, maxWidth: 820 }}>
        {activeTab === "account" && (
          <>
            <div style={{ fontWeight: 800 }}>Currently logged in as: {username}</div>
            <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              <ThemeToggleButton />
              <button className="primaryBtn" onClick={onLogout}>Logout</button>
            </div>
          </>
        )}

        {activeTab === "spoons" && (
          <>
            <div style={{ marginTop: 2, fontWeight: 900, fontSize: 16 }}>Spoons</div>

            <div style={{ padding: "12px 12px", borderRadius: 14, border: "1px solid rgba(255,255,255,0.14)", background: "rgba(0,0,0,0.10)" }}>
              <div style={{ fontWeight: 900, marginBottom: 6 }}>Daily wake-up spoons</div>
              <div style={{ opacity: 0.8, fontWeight: 700, marginBottom: 10 }}>Spoons reset to these values when the day changes (midnight or next app open).</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(64px, 1fr))", gap: 10 }}>
                {DAYS.map((d) => (
                  <div key={d} style={{ display: "grid", gap: 6 }}>
                    <div style={{ fontWeight: 900, opacity: 0.9 }}>{d}</div>
                    <input
                      value={String(dailyDrafts?.[d] ?? "")}
                      inputMode="numeric"
                      onChange={(e) => { const digits = String(e.target.value || "").replace(/[^\d]/g, ""); setDailyDrafts((p) => ({ ...p, [d]: digits })); }}
                      onBlur={() => { const digits = String(dailyDrafts?.[d] ?? "").replace(/[^\d]/g, ""); const n = digits === "" ? 0 : Math.max(0, Math.floor(Number(digits) || 0)); setDailyDrafts((p) => ({ ...p, [d]: String(n) })); setDailySpoons(d, n); }}
                      onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
                      style={{ width: "100%", padding: "10px 10px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.18)", background: "rgba(255,255,255,0.06)", fontWeight: 800 }}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div style={{ padding: "12px 12px", borderRadius: 14, border: "1px solid rgba(255,255,255,0.14)", background: "rgba(0,0,0,0.10)" }}>
              <div style={{ fontWeight: 900, marginBottom: 6 }}>Rest spoons</div>
              <div style={{ opacity: 0.8, fontWeight: 700, marginBottom: 10 }}>How many spoons you gain from each rest button.</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(140px, 1fr))", gap: 10 }}>
                {REST_KEYS.map((k) => (
                  <div key={k} style={{ display: "grid", gap: 6 }}>
                    <div style={{ fontWeight: 900, opacity: 0.9 }}>{k === "short" ? "Short rest" : (k === "half" ? "Half rest" : "Full rest")}</div>
                    <input
                      value={String(restDrafts?.[k] ?? "")}
                      inputMode="numeric"
                      onChange={(e) => { const digits = String(e.target.value || "").replace(/[^\d]/g, ""); setRestDrafts((p) => ({ ...p, [k]: digits })); }}
                      onBlur={() => { const digits = String(restDrafts?.[k] ?? "").replace(/[^\d]/g, ""); const n = digits === "" ? (k === "short" ? 1 : (k === "half" ? 2 : 3)) : Math.max(0, Math.floor(Number(digits) || 0)); setRestDrafts((p) => ({ ...p, [k]: String(n) })); setRestSpoons(k, n); }}
                      onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
                      style={{ width: "100%", padding: "10px 12px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.18)", background: "rgba(255,255,255,0.06)", fontWeight: 800 }}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div style={{ padding: "12px 12px", borderRadius: 14, border: "1px solid rgba(255,255,255,0.14)", background: "rgba(0,0,0,0.10)" }}>
              <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 10, alignItems: "center", maxWidth: 520 }}>
                <div>
                  <div style={{ fontWeight: 900 }}>Time per spoon</div>
                  <div style={{ opacity: 0.8, fontWeight: 700 }}>Minutes per spoon (timers)</div>
                </div>
                <input
                  value={String(tpsDraft)}
                  inputMode="numeric"
                  onChange={(e) => { const digits = String(e.target.value || "").replace(/[^\d]/g, ""); setTpsDraft(digits); }}
                  onBlur={() => { const digits = String(tpsDraft || "").replace(/[^\d]/g, ""); const n = digits === "" ? 10 : Math.max(1, Math.floor(Number(digits) || 10)); setTpsDraft(String(n)); setTimePerSpoon(n); }}
                  onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.18)", background: "rgba(255,255,255,0.06)", fontWeight: 800 }}
                />
              </div>
            </div>

            <div style={{ padding: "12px 12px", borderRadius: 14, border: "1px solid rgba(255,255,255,0.14)", background: "rgba(0,0,0,0.10)", display: "grid", gap: 10 }}>
              <button type="button" onClick={toggleDebt} className="primaryBtn" style={{ justifySelf: "start" }}>{Boolean(dataObj?.spoons_debt_toggle) ? "Disable spoons debt" : "Enable spoons debt"}</button>
              <div style={{ opacity: 0.8, fontWeight: 700 }}>Allows your spoons to go negative.</div>
              <button type="button" onClick={toggleDebtConsequences} className="primaryBtn" style={{ justifySelf: "start" }}>{Boolean(dataObj?.spoons_debt_consequences_toggle) ? "Disable spoons debt consequences" : "Enable spoons debt consequences"}</button>
              <div style={{ opacity: 0.8, fontWeight: 700 }}>If enabled: negative spoons roll into the next day when reset happens.</div>
            </div>
          </>
        )}

        {activeTab === "folders" && (
          <>
            <div style={{ marginTop: 2, fontWeight: 900, fontSize: 16 }}>Folders</div>
            <div style={{ display: "grid", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 900, opacity: 0.9 }}>
              <div>Days</div>
              <button
                type="button"
                onClick={() => setShowDaysInfo((v) => !v)}
                aria-label="Days info"
                title="Info"
                style={{ width: 22, height: 22, borderRadius: 999, border: "1px solid rgba(255,255,255,0.22)", background: "rgba(0,0,0,0.14)", color: "rgba(255,255,255,0.92)", fontWeight: 1000, cursor: "pointer", display: "grid", placeItems: "center", padding: 0, lineHeight: 1 }}
              >
                i
              </button>
              {showDaysInfo ? (
                <div style={{ marginLeft: 6, padding: "6px 10px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.14)", background: "rgba(0,0,0,0.18)", fontWeight: 800, fontSize: 12, opacity: 0.95 }}>
                  Summary days ahead (per folder)
                </div>
              ) : null}
            </div>
              {folders.map((f, i) => {
                const curColor = String((folderColorDrafts?.[f.id] ?? String(f?.color || "").trim()) || "#303C1F");
                const isOpen = openColorFor === String(f.id);
                return (
                  <div key={f.id} style={{ display: "grid", gridTemplateColumns: "auto 34px 68px 1fr 44px", gap: 10, alignItems: "start" }}>
                    <div style={{ fontWeight: 900, opacity: 0.9, paddingTop: 10, whiteSpace: "nowrap" }}>{`Folder ${i + 1}:`}</div>

                    <button type="button" onClick={() => setOpenColorFor((v) => (v === String(f.id) ? "" : String(f.id)))} aria-label="Pick folder color" title="Pick folder color" style={{ width: 34, height: 34, marginTop: 6, borderRadius: 10, border: "1px solid rgba(255,255,255,0.22)", background: curColor, boxShadow: "inset 0 0 0 2px rgba(0,0,0,0.22)", cursor: "pointer" }} />

                  <div style={{ display: "grid", gap: 6, paddingTop: 6 }}>
                    <input
                      value={String(folderDaysDrafts?.[f.id] ?? "")}
                      inputMode="numeric"
                      onChange={(e) => { const digits = String(e.target.value || "").replace(/[^\d]/g, ""); setFolderDaysDrafts((p) => ({ ...p, [f.id]: digits })); }}
                      onBlur={() => { const digits = String(folderDaysDrafts?.[f.id] ?? "").replace(/[^\d]/g, ""); const n = digits === "" ? 7 : Math.max(0, Math.floor(Number(digits) || 0)); setFolderDaysDrafts((p) => ({ ...p, [f.id]: String(n) })); setFolderDaysAhead(f.id, n); }}
                      onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
                      style={{ width: 56, padding: "10px 10px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.18)", background: "rgba(255,255,255,0.06)", fontWeight: 800, textAlign: "center" }}
                    />
                  </div>

                    <div style={{ display: "grid", gap: 10 }}>
                      <input
                        value={String(folderDrafts?.[f.id] ?? "")}
                        onChange={(e) => { const v = e.target.value; setFolderDrafts((prev) => ({ ...prev, [f.id]: v })); }}
                        onBlur={() => {
                          const raw = String(folderDrafts?.[f.id] ?? "");
                          const trimmed = raw.trim();
                          const finalName = trimmed === "" ? `Folder ${i + 1}` : raw;
                          if (finalName !== String(f.name || "")) renameFolder(f.id, finalName);
                          if (trimmed === "") setFolderDrafts((prev) => ({ ...prev, [f.id]: `Folder ${i + 1}` }));
                        }}
                        onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
                        placeholder={`Folder ${i + 1}`}
                        style={{ width: "100%", padding: "10px 12px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.18)", background: "rgba(255,255,255,0.06)", fontWeight: 800, marginTop: 6 }}
                      />

                      {isOpen ? (
                        <div style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.14)", background: "rgba(0,0,0,0.10)" }}>
                          <ColorPicker label="Folder Color" value={curColor} onChange={(c) => { const next = String(c || "").trim(); setFolderColorDrafts((prev) => ({ ...prev, [f.id]: next })); setFolderColor(f.id, next); }} presets={["#303C1F","#2E86FF","#00C2A8","#27AE60","#F2C94C","#F2994A","#EB5757","#9B51E0","#56CCF2","#D7B45A","#FFFFFF"]} />
                        </div>
                      ) : null}
                    </div>

                    <button type="button" onClick={() => removeFolder(f.id)} title="Remove folder" style={{ width: 44, height: 40, borderRadius: 12, border: "1px solid rgba(255,255,255,0.18)", background: "rgba(255,80,80,0.14)", fontWeight: 900, marginTop: 6 }}>−</button>
                  </div>
                );
              })}
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
                value={String(waterGoalDraft)}
                inputMode="numeric"
                onChange={(e) => { setWaterGoalDraft(e.target.value); }}
                onBlur={() => { const digits = String(waterGoalDraft || "").replace(/[^\d]/g, ""); const n = digits === "" ? 80 : Math.max(1, Math.floor(Number(digits) || 0)); setWaterGoalDraft(String(n)); persist({ ...dataObj, water: { ...(dataObj.water || {}), daily_goal_oz: n } }); }}
                onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
                style={{ width: "100%", padding: "10px 12px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.18)", background: "rgba(255,255,255,0.06)", fontWeight: 800 }}
              />
            </div>
          </>
        )}

        {activeTab === "extensions" && (
          <>
            <div style={{ marginTop: 2, fontWeight: 900, fontSize: 16 }}>Extensions</div>
            <div style={{ opacity: 0.8, fontWeight: 700 }}>Buttons only for now (no functionality yet).</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(180px, 1fr))", gap: 12, maxWidth: 520 }}>
              <button type="button" className="primaryBtn" disabled style={{ opacity: 0.6 }}>Social</button>
              <button type="button" className="primaryBtn" disabled style={{ opacity: 0.6 }}>Water</button>
              <button type="button" className="primaryBtn" disabled style={{ opacity: 0.6 }}>Forks</button>
              <button type="button" className="primaryBtn" disabled style={{ opacity: 0.6 }}>Knives</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
