import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Activity, AlertTriangle, Bell, Check, ChevronRight, Clock3, Droplets, Flame, Gauge, House, Leaf, LoaderCircle, RefreshCw, Settings, Shield, Thermometer, Volume2, Wind, X, Zap } from "lucide-react";
import { clearHistory, getHealth, getHistory, getTelemetry, sendActuatorCommand, submitFireDetectionSample } from "./api";

const DEVICE_KEY = "orbit-device-id";
const NOTIFICATIONS_KEY = "orbit-notifications";
const MODE_KEY = "orbit-cooking-mode";
const THRESHOLD_KEY = "orbit-gas-threshold";
const DIRECTION_KEY = "orbit-gas-direction";
const FAN_ACTION_KEY = "orbit-cooking-fan-action";
const BUZZER_ACTION_KEY = "orbit-cooking-buzzer-action";
const NITO_MANUAL_KEY = "orbit-nito-manual-control";
const AI_SAMPLE_KEY = "orbit-ai-last-sample:";
const AI_STATUS_KEY = "orbit-ai-status:";
const AI_ACK_KEY = "orbit-ai-alert-ack:";
const GAS_FAN_AUTO_KEY = "orbit-gas-fan-auto-on:";
const AI_AUTO_KEY = "orbit-ai-auto-on:";
const telemetryKeys = ["air quality", "bluzzer", "fan", "flame", "nito", "temp"];
const formatClock = (value) => new Intl.DateTimeFormat("en-US", { hour: "2-digit", minute: "2-digit" }).format(value);
const formatDateTime = (value) => new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(value);
const asBoolean = (value) => value === true || value === 1 || ["true", "1"].includes(String(value).toLowerCase());
const latest = (series) => series?.length ? series.at(-1) : null;
const graphNumber = (value) => typeof value === "boolean" || ["true", "false"].includes(String(value).toLowerCase()) ? (asBoolean(value) ? 1 : 0) : Number(value);
const classifyAiStatus = (response) => {
  const riskLevel = String(response?.risk_level || "").toUpperCase();
  const status = String(response?.status || "").toUpperCase();
  const byRiskLevel = { UNKNOWN: "UNKNOWN", LOW: "LOW", MEDIUM: "MEDIUM", HIGH: "HIGH" }[riskLevel];
  const byStatus = { COLLECTING: "UNKNOWN", NORMAL: "LOW", ANOMALY: "MEDIUM", FLAME_SIGNAL: "HIGH" }[status];
  return byRiskLevel || byStatus || "";
};
const readAiStatus = (id) => {
  try { return JSON.parse(localStorage.getItem(`${AI_STATUS_KEY}${id}`) || "null"); } catch { return null; }
};
const readGasFanAutoState = (id) => {
  try { return localStorage.getItem(`${GAS_FAN_AUTO_KEY}${id}`) === "true"; } catch { return false; }
};
const writeGasFanAutoState = (id, enabled) => {
  try {
    if (enabled) localStorage.setItem(`${GAS_FAN_AUTO_KEY}${id}`, "true");
    else localStorage.removeItem(`${GAS_FAN_AUTO_KEY}${id}`);
  } catch { /* Keep the automation state in memory if browser storage is unavailable. */ }
};
const readAiAutoState = (id, actuator) => {
  try { return localStorage.getItem(`${AI_AUTO_KEY}${id}:${actuator}`) === "true"; } catch { return false; }
};
const writeAiAutoState = (id, actuator, enabled) => {
  try {
    if (enabled) localStorage.setItem(`${AI_AUTO_KEY}${id}:${actuator}`, "true");
    else localStorage.removeItem(`${AI_AUTO_KEY}${id}:${actuator}`);
  } catch { /* Keep the automation state in memory if browser storage is unavailable. */ }
};

function MetricCard({ title, value, unit, icon: Icon, tone, detail }) {
  return <article className="metric-card"><div className={`metric-icon ${tone}`}><Icon size={18} /></div><p>{title}</p><div className="metric-value">{value}<small>{unit}</small></div><span className="metric-detail">{detail}</span></article>;
}

function SensorChart({ title, unit, points, color = "green", empty }) {
  const width = 720;
  const height = 210;
  const pad = { left: 40, right: 12, top: 12, bottom: 27 };
  const vals = points.map((p) => Number(p.value)).filter(Number.isFinite);
  const low = vals.length ? Math.min(...vals) : 0;
  const high = vals.length ? Math.max(...vals) : 1;
  const span = Math.max(high - low, 1);
  const coords = points.map((p, i) => ({ x: pad.left + (points.length < 2 ? 0 : i / (points.length - 1) * (width - pad.left - pad.right)), y: pad.top + (1 - (Number(p.value) - low) / span) * (height - pad.top - pad.bottom), ...p }));
  const path = coords.map((p, i) => `${i ? "L" : "M"} ${p.x} ${p.y}`).join(" ");
  const area = coords.length ? `${path} L ${coords.at(-1).x} ${height - pad.bottom} L ${coords[0].x} ${height - pad.bottom} Z` : "";
  return <article className="chart-card"><div className="chart-card-head"><div><span className="section-overline">SENSOR HISTORY</span><h3>{title}</h3></div><span className="chart-unit">{unit || "Latest values"}</span></div>{coords.length ? <div className="chart-frame"><div className="chart-y"><span>{high.toFixed(high % 1 ? 1 : 0)}</span><span>{((high + low) / 2).toFixed((high + low) % 1 ? 1 : 0)}</span><span>{low.toFixed(low % 1 ? 1 : 0)}</span></div><svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" role="img" aria-label={`${title} history chart`}><defs><linearGradient id={`fill-${title.replaceAll(" ", "-")}`} x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor={color === "blue" ? "#54a9d5" : "#65c6a0"} stopOpacity=".2"/><stop offset="100%" stopColor={color === "blue" ? "#54a9d5" : "#65c6a0"} stopOpacity="0"/></linearGradient></defs>{[0,1,2,3].map((n)=><line key={n} x1={pad.left} x2={width-pad.right} y1={pad.top+n*(height-pad.top-pad.bottom)/3} y2={pad.top+n*(height-pad.top-pad.bottom)/3} className="chart-grid"/>)}<path d={area} fill={`url(#fill-${title.replaceAll(" ", "-")})`}/><path d={path} className={`chart-line ${color}`}/>{coords.map((p,i)=><circle key={`${p.ts}-${i}`} cx={p.x} cy={p.y} r={i===coords.length-1?3.8:2} className={`chart-point ${color}`}><title>{`${new Date(p.ts).toLocaleString()}: ${p.value}${unit}`}</title></circle>)}</svg><div className="chart-x"><span>{formatClock(new Date(coords[0].ts))}</span><span>{formatClock(new Date(coords[Math.floor(coords.length/2)].ts))}</span><span>{formatClock(new Date(coords.at(-1).ts))}</span></div></div> : <div className="chart-empty"><Activity size={20}/><span>{empty || "No history available for this device yet."}</span></div>}</article>;
}

function ControlRow({ title, icon: Icon, value, busy, disabled = false, disabledMessage = "Manual control is inactive in Settings", onToggle }) {
  return <div className="control-row"><div className="control-icon"><Icon size={18}/></div><div className="control-copy"><b>{title}</b><span>{disabled ? disabledMessage : "Sends an on/off command to the device"}</span></div><button className={`switch ${value ? "active" : ""} ${busy ? "busy" : ""}`} onClick={onToggle} disabled={busy || disabled} role="switch" aria-checked={Boolean(value)} aria-label={`Toggle ${title}`} title={disabled ? disabledMessage : undefined}>{busy ? <LoaderCircle className="spin" size={15}/> : <span/>}</button></div>;
}

export default function App() {
  const [page, setPage] = useState("Home");
  const [deviceId, setDeviceId] = useState(() => localStorage.getItem(DEVICE_KEY) || "");
  const [deviceDraft, setDeviceDraft] = useState(() => localStorage.getItem(DEVICE_KEY) || "");
  const [telemetry, setTelemetry] = useState({});
  const [history, setHistory] = useState({});
  const [connected, setConnected] = useState(false);
  const [connectionError, setConnectionError] = useState("");
  const [loading, setLoading] = useState(false);
  const [health, setHealth] = useState(false);
  const [aiStatus, setAiStatus] = useState(() => readAiStatus(deviceId));
  const [aiError, setAiError] = useState("");
  const [aiAcknowledgedCategory, setAiAcknowledgedCategory] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);
  const [cookingMode, setCookingMode] = useState(() => localStorage.getItem(MODE_KEY) === "true");
  const [gasThreshold, setGasThreshold] = useState(() => localStorage.getItem(THRESHOLD_KEY) || "");
  const [gasThresholdDraft, setGasThresholdDraft] = useState(() => localStorage.getItem(THRESHOLD_KEY) || "");
  const [gasDirection, setGasDirection] = useState(() => localStorage.getItem(DIRECTION_KEY) || "above");
  const [gasDirectionDraft, setGasDirectionDraft] = useState(() => localStorage.getItem(DIRECTION_KEY) || "above");
  const [fanCookingAction, setFanCookingAction] = useState(() => localStorage.getItem(FAN_ACTION_KEY) || "on");
  const [buzzerCookingAction, setBuzzerCookingAction] = useState(() => localStorage.getItem(BUZZER_ACTION_KEY) || "off");
  const [nitoManualEnabled, setNitoManualEnabled] = useState(() => localStorage.getItem(NITO_MANUAL_KEY) !== "false");
  const [notifications, setNotifications] = useState(() => { try { return JSON.parse(localStorage.getItem(NOTIFICATIONS_KEY) || "[]"); } catch { return []; } });
  const [rpcBusy, setRpcBusy] = useState("");
  const [message, setMessage] = useState(null);
  const cookingModeRef = useRef(cookingMode);
  const automationLatch = useRef("");
  const cookingCommandLastAt = useRef({});
  const gasFanLatch = useRef("");
  const gasFanAutoOn = useRef({});
  const gasDetectedRef = useRef(false);
  const nitoModeLatch = useRef("");
  const previousDetection = useRef("");
  const requestInFlight = useRef(new Set());
  const aiRequestsInFlight = useRef(new Set());
  const aiActionState = useRef({});
  const aiCommandLatch = useRef({});
  const aiFanCommandLatch = useRef({});
  const aiAutoOn = useRef({});
  const aiNormalLatch = useRef({});
  const activeDeviceRef = useRef(deviceId);
  const telemetryDeviceRef = useRef("");
  const lastDeviceLog = useRef("");
  const reportDeviceWrong = useCallback((detail) => {
    setConnectionError(detail);
    if (lastDeviceLog.current !== detail) {
      console.warn(detail);
      lastDeviceLog.current = detail;
    }
  }, []);

  const loadDashboard = useCallback(async (id = deviceId) => {
    if (!id) { telemetryDeviceRef.current = ""; setTelemetry({}); setHistory({}); setConnected(false); setConnectionError(""); return; }
    if (requestInFlight.current.has(id)) return;
    requestInFlight.current.add(id);
    setLoading(true);
    try {
      const values = await getTelemetry(id);
      const samples = Object.values(values || {}).flat().filter((point) => Number.isFinite(Number(point.ts)));
      const newestTs = samples.length ? Math.max(...samples.map((point) => Number(point.ts))) : null;
      if (activeDeviceRef.current === id) {
        telemetryDeviceRef.current = id;
        setTelemetry(values || {});
        setLastUpdated(newestTs ? new Date(newestTs) : null);
        if (!newestTs) {
          setConnected(false);
          reportDeviceWrong("Device wrong: no telemetry received.");
        } else if (Date.now() - newestTs > 15000) {
          setConnected(false);
          reportDeviceWrong(`Device wrong: last telemetry was ${formatDateTime(new Date(newestTs))}.`);
        } else {
          setConnected(true);
          setConnectionError("");
          lastDeviceLog.current = "";
        }
      }
    } catch (error) {
      const detail = error.response?.data?.message || error.message || "telemetry request failed";
      if (activeDeviceRef.current === id) {
        setConnected(false);
        reportDeviceWrong(`Device wrong: ${detail}`);
      }
    }
    try {
      const saved = await getHistory(id);
      if (activeDeviceRef.current === id) setHistory(saved || {});
    } catch {
      // Keep the last saved chart history without showing a request error banner.
    } finally {
      requestInFlight.current.delete(id);
      if (activeDeviceRef.current === id) setLoading(false);
    }
  }, [deviceId, reportDeviceWrong]);

  useEffect(() => { getHealth().then((data) => setHealth(Boolean(data.success))).catch(() => setHealth(false)); }, []);
  useEffect(() => {
    activeDeviceRef.current = deviceId;
    telemetryDeviceRef.current = "";
    setTelemetry({});
    setHistory({});
    setConnected(false);
    setConnectionError("");
    setLastUpdated(null);
    const savedAiStatus = readAiStatus(deviceId);
    setAiStatus(savedAiStatus);
    setAiError("");
    const savedAiCategory = classifyAiStatus(savedAiStatus);
    aiActionState.current[deviceId] = savedAiCategory;
    aiCommandLatch.current[deviceId] = ["MEDIUM", "HIGH"].includes(savedAiCategory) ? savedAiCategory : "";
    automationLatch.current = "";
    gasFanLatch.current = "";
    previousDetection.current = "";
    lastDeviceLog.current = "";
    if (!deviceId) return undefined;
    loadDashboard(deviceId);
    const timer = window.setInterval(() => loadDashboard(deviceId), 5000);
    return () => window.clearInterval(timer);
  }, [deviceId, loadDashboard]);

  const airPoint = latest(telemetry["air quality"]);
  const buzzerPoint = latest(telemetry.bluzzer);
  const fanPoint = latest(telemetry.fan);
  const nitoPoint = latest(telemetry.nito);
  const flamePoint = latest(telemetry.flame);
  const tempPoint = latest(telemetry.temp);
  const gasValue = airPoint ? Number(airPoint.value) : null;
  const gasLimit = gasThreshold === "" ? null : Number(gasThreshold);
  const gasDetected = gasValue !== null && gasLimit !== null && (gasDirection === "above" ? gasValue >= gasLimit : gasValue <= gasLimit);
  gasDetectedRef.current = gasDetected;
  const flameDetected = flamePoint ? asBoolean(flamePoint.value) : false;
  const fanReportedOn = fanPoint ? asBoolean(fanPoint.value) : false;
  const aiCategory = classifyAiStatus(aiStatus);
  const aiFireDetected = aiCategory === "MEDIUM" || aiCategory === "HIGH";
  const aiAcknowledged = aiFireDetected && aiAcknowledgedCategory === aiCategory;
  const aiNeedsAcknowledgement = aiFireDetected && !aiAcknowledged;
  const alarmDetected = gasDetected || aiFireDetected;
  const chartData = useMemo(() => Object.fromEntries(telemetryKeys.map((key) => [key, (history[key] || []).map((p) => ({ ts: Number(p.ts), value: graphNumber(p.value) })).filter((p) => Number.isFinite(p.ts) && Number.isFinite(p.value))])), [history]);

  const addNotification = useCallback((title, detail, type = "info") => {
    setNotifications((current) => {
      const next = [{ id: `${Date.now()}-${Math.random()}`, title, detail, type, time: Date.now(), read: false }, ...current].slice(0, 100);
      localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  useEffect(() => {
    const storageKey = `${AI_ACK_KEY}${deviceId}`;
    if (!deviceId || !aiFireDetected) {
      setAiAcknowledgedCategory("");
      try { localStorage.removeItem(storageKey); } catch { /* Storage is optional. */ }
      return;
    }
    try { setAiAcknowledgedCategory(localStorage.getItem(storageKey) === aiCategory ? aiCategory : ""); } catch { setAiAcknowledgedCategory(""); }
  }, [deviceId, aiCategory, aiFireDetected]);

  useEffect(() => {
    if (!connected || !deviceId) return;
    const signature = String(gasDetected);
    if (signature !== previousDetection.current) {
      if (gasDetected) addNotification("Gas threshold reached", `Air quality is ${gasValue}; configured threshold is ${gasLimit}.`, "warning");
      if (!gasDetected && previousDetection.current === "true") addNotification("Air quality returned to normal", "The reading is below the configured threshold.", "success");
      previousDetection.current = signature;
    }
  }, [connected, deviceId, gasDetected, gasValue, gasLimit, addNotification]);

  const sendCommand = useCallback(async (method, state, source = "manual") => {
    if (!deviceId) { setPage("Settings"); setMessage({ type: "error", text: "Add a Device ID in Settings before sending commands." }); return false; }
    if (cookingModeRef.current && (source === "ai" || source === "ai-normal")) return false;
    setRpcBusy(method);
    setMessage(null);
    try {
      await sendActuatorCommand(deviceId, method, state);
      const controlName = { setFan: "Ventilation fan", setBuzzer: "Buzzer", setNito: "Nito Valve" }[method] || method;
      setMessage({ type: "success", text: `${controlName} ${state ? "on" : "off"} command sent.` });
      if (method === "setFan" && source !== "gas-threshold") {
        gasFanAutoOn.current[deviceId] = false;
        writeGasFanAutoState(deviceId, false);
        gasFanLatch.current = "";
      }
      if ((method === "setBuzzer" || method === "setNito") && source !== "ai" && source !== "ai-normal") {
        const actuator = method === "setBuzzer" ? "buzzer" : "nito";
        aiAutoOn.current[`${deviceId}:${actuator}`] = false;
        writeAiAutoState(deviceId, actuator, false);
        aiNormalLatch.current[deviceId] = "";
      }
      if (source === "manual") addNotification("Command sent", `${controlName} ${state ? "on" : "off"} command sent.`, "success");
      window.setTimeout(() => loadDashboard(deviceId), 900);
      return true;
    } catch (error) {
      const status = error.response?.status;
      const detail = status === 504 ? "The device could not receive the command. Check that it is online and connected to ThingsBoard." : error.response?.data?.message || (status ? `Command failed (HTTP ${status}).` : "Could not reach the command API.");
      setMessage({ type: "error", text: detail });
      return false;
    } finally { setRpcBusy(""); }
  }, [deviceId, addNotification, loadDashboard]);

  useEffect(() => {
    if (!connected || !deviceId || telemetryDeviceRef.current !== deviceId || !tempPoint || !flamePoint) return;

    const temperature = Number(tempPoint.value);
    const temperatureTs = Number(tempPoint.ts);
    const infraredTs = Number(flamePoint.ts);
    if (!Number.isFinite(temperature) || temperature < -40 || temperature > 125) return;
    if (!Number.isFinite(temperatureTs) || !Number.isFinite(infraredTs)) return;
    if (Date.now() - temperatureTs > 15000 || Date.now() - infraredTs > 15000) return;

    const sampleKey = `${temperatureTs}:${infraredTs}`;
    const storageKey = `${AI_SAMPLE_KEY}${deviceId}`;
    let lastSampleKey = "";
    try { lastSampleKey = localStorage.getItem(storageKey) || ""; } catch { /* Browser storage may be unavailable. */ }
    if (lastSampleKey === sampleKey || aiRequestsInFlight.current.has(deviceId)) return;

    aiRequestsInFlight.current.add(deviceId);
    try { localStorage.setItem(storageKey, sampleKey); } catch { /* The in-memory lock still prevents duplicate requests. */ }

    void (async () => {
      try {
        const result = await submitFireDetectionSample({
          device_id: deviceId,
          temperature,
          infrared: asBoolean(flamePoint.value) ? 1 : 0,
        });
        if (activeDeviceRef.current !== deviceId) return;

        setAiStatus(result);
        try { localStorage.setItem(`${AI_STATUS_KEY}${deviceId}`, JSON.stringify(result)); } catch { /* Keep the current result in memory if browser storage is unavailable. */ }
        setAiError("");
        const category = classifyAiStatus(result);
        const previousCategory = aiActionState.current[deviceId] || "";
        aiActionState.current[deviceId] = category;

        if (category !== "MEDIUM" && category !== "HIGH") return;

        if (previousCategory !== category) {
          aiCommandLatch.current[deviceId] = "";
          if (category === "MEDIUM") addNotification("Fire risk", "There is a risk of fire.", "warning");
          if (category === "HIGH") {
            const detail = cookingMode
              ? "Cooking mode is managing the fan and buzzer. The Nito Valve stays closed."
              : "Fan and buzzer turned on. Nito Valve opening requested.";
            addNotification("Fire detected", detail, "warning");
          }
        }
      } catch (error) {
        if (activeDeviceRef.current === deviceId) {
          setAiError(error.response?.data?.message || error.response?.data?.detail || error.message || "Could not reach the AI service.");
        }
      } finally {
        aiRequestsInFlight.current.delete(deviceId);
      }
    })();
  }, [connected, deviceId, tempPoint, flamePoint, cookingMode, addNotification]);

  useEffect(() => {
    if (!connected || !deviceId || telemetryDeviceRef.current !== deviceId) {
      aiCommandLatch.current[deviceId] = "";
      return;
    }
    if (cookingMode || !["MEDIUM", "HIGH"].includes(aiCategory)) {
      aiCommandLatch.current[deviceId] = "";
      return;
    }

    if (buzzerPoint && asBoolean(buzzerPoint.value)) {
      aiCommandLatch.current[deviceId] = aiCategory;
      return;
    }

    if (aiCommandLatch.current[deviceId] === aiCategory) return;
    aiCommandLatch.current[deviceId] = aiCategory;
    void sendCommand("setBuzzer", true, "ai").then((sent) => {
      if (sent) {
        aiAutoOn.current[`${deviceId}:buzzer`] = true;
        writeAiAutoState(deviceId, "buzzer", true);
      } else if (aiCommandLatch.current[deviceId] === aiCategory) {
        aiCommandLatch.current[deviceId] = "";
      }
    });
  }, [connected, deviceId, cookingMode, aiCategory, buzzerPoint, sendCommand]);

  useEffect(() => {
    if (!connected || !deviceId || telemetryDeviceRef.current !== deviceId) {
      aiFanCommandLatch.current[deviceId] = "";
      return;
    }
    if (cookingMode || aiCategory !== "HIGH") {
      aiFanCommandLatch.current[deviceId] = "";
      return;
    }
    if (fanReportedOn) {
      aiFanCommandLatch.current[deviceId] = "HIGH";
      return;
    }
    if (aiFanCommandLatch.current[deviceId] === "HIGH") return;

    aiFanCommandLatch.current[deviceId] = "HIGH";
    void sendCommand("setFan", true, "ai").then((sent) => {
      if (!sent && aiFanCommandLatch.current[deviceId] === "HIGH") aiFanCommandLatch.current[deviceId] = "";
    });
  }, [connected, deviceId, cookingMode, aiCategory, fanReportedOn, sendCommand]);

  useEffect(() => {
    if (!connected || !deviceId || telemetryDeviceRef.current !== deviceId) { nitoModeLatch.current = ""; return; }

    const openForAi = aiCategory === "HIGH" && !cookingMode && !aiAcknowledged;
    if (!cookingMode && !openForAi) { nitoModeLatch.current = ""; return; }

    const desiredOpen = openForAi;
    const reportedOpen = nitoPoint ? asBoolean(nitoPoint.value) : null;
    if (reportedOpen === desiredOpen) { nitoModeLatch.current = ""; return; }

    const latch = `${deviceId}:${desiredOpen}`;
    if (nitoModeLatch.current === latch) return;
    nitoModeLatch.current = latch;
    void sendCommand("setNito", desiredOpen, desiredOpen ? "ai" : "automation").then((sent) => {
      if (sent && desiredOpen) {
        aiAutoOn.current[`${deviceId}:nito`] = true;
        writeAiAutoState(deviceId, "nito", true);
      }
      if (!sent && nitoModeLatch.current === latch) nitoModeLatch.current = "";
    });
  }, [connected, deviceId, cookingMode, aiCategory, aiAcknowledged, nitoPoint, sendCommand]);

  useEffect(() => {
    if (!connected || !deviceId || telemetryDeviceRef.current !== deviceId) { aiNormalLatch.current[deviceId] = ""; return; }
    if (cookingMode || aiCategory !== "LOW") { aiNormalLatch.current[deviceId] = ""; return; }

    const candidates = [
      { actuator: "buzzer", method: "setBuzzer", reported: buzzerPoint ? asBoolean(buzzerPoint.value) : null },
      { actuator: "nito", method: "setNito", reported: nitoPoint ? asBoolean(nitoPoint.value) : null },
    ];
    const toTurnOff = candidates.filter(({ actuator, reported }) => {
      const key = `${deviceId}:${actuator}`;
      const autoTurnedOn = aiAutoOn.current[key] ?? readAiAutoState(deviceId, actuator);
      aiAutoOn.current[key] = autoTurnedOn;
      if (autoTurnedOn && reported === false) {
        aiAutoOn.current[key] = false;
        writeAiAutoState(deviceId, actuator, false);
        return false;
      }
      return autoTurnedOn;
    });

    if (!toTurnOff.length) { aiNormalLatch.current[deviceId] = ""; return; }
    const latch = `${deviceId}:normal:${toTurnOff.map(({ actuator }) => actuator).join(",")}`;
    if (aiNormalLatch.current[deviceId] === latch) return;
    aiNormalLatch.current[deviceId] = latch;
    void (async () => {
      for (const { actuator, method } of toTurnOff) {
        const sent = await sendCommand(method, false, "ai-normal");
        if (!sent) {
          aiNormalLatch.current[deviceId] = "";
          return;
        }
        aiAutoOn.current[`${deviceId}:${actuator}`] = false;
        writeAiAutoState(deviceId, actuator, false);
      }
    })();
  }, [connected, deviceId, cookingMode, aiCategory, buzzerPoint, nitoPoint, sendCommand]);

  useEffect(() => {
    if (!connected || !deviceId || telemetryDeviceRef.current !== deviceId) { gasFanLatch.current = ""; return; }
    if (cookingMode && alarmDetected) { gasFanLatch.current = ""; return; }

    const autoTurnedOn = gasFanAutoOn.current[deviceId] ?? readGasFanAutoState(deviceId);
    gasFanAutoOn.current[deviceId] = autoTurnedOn;

    if (gasDetected) {
      if (fanReportedOn) { gasFanLatch.current = ""; return; }
      const latch = `${deviceId}:gas-on`;
      if (gasFanLatch.current === latch) return;
      gasFanLatch.current = latch;
      void sendCommand("setFan", true, "gas-threshold").then((sent) => {
        if (sent) {
          gasFanAutoOn.current[deviceId] = true;
          writeGasFanAutoState(deviceId, true);
          if (!gasDetectedRef.current) gasFanLatch.current = "";
        } else if (gasFanLatch.current === latch) gasFanLatch.current = "";
      });
      return;
    }

    if (!autoTurnedOn) { gasFanLatch.current = ""; return; }
    if (aiCategory === "HIGH" || (cookingMode && aiFireDetected)) { gasFanLatch.current = ""; return; }
    if (!fanReportedOn) {
      gasFanAutoOn.current[deviceId] = false;
      writeGasFanAutoState(deviceId, false);
      gasFanLatch.current = "";
      return;
    }

    const latch = `${deviceId}:gas-off`;
    if (gasFanLatch.current === latch) return;
    gasFanLatch.current = latch;
    void sendCommand("setFan", false, "gas-threshold").then((sent) => {
      if (sent) {
        if (!gasDetectedRef.current) {
          gasFanAutoOn.current[deviceId] = false;
          writeGasFanAutoState(deviceId, false);
        }
        gasFanLatch.current = "";
      } else if (gasFanLatch.current === latch) gasFanLatch.current = "";
    });
  }, [connected, deviceId, gasDetected, aiCategory, aiFireDetected, cookingMode, fanReportedOn, fanPoint, sendCommand]);

  useEffect(() => {
    localStorage.setItem(MODE_KEY, String(cookingMode));
    if (!cookingMode || !connected || !deviceId || !alarmDetected) { automationLatch.current = ""; return; }
    const latch = `${deviceId}:${gasDetected}:${aiCategory}:${fanCookingAction}:${buzzerCookingAction}`;
    const shouldNotify = automationLatch.current !== latch;
    if (shouldNotify) automationLatch.current = latch;

    const enforceOutput = (method, action, reported) => {
      if (action === "unchanged") return;
      const desired = action === "on";
      const key = `${deviceId}:${method}`;
      if (reported === desired) {
        delete cookingCommandLastAt.current[key];
        return;
      }
      const lastSentAt = cookingCommandLastAt.current[key] || 0;
      if (Date.now() - lastSentAt < 3000) return;
      cookingCommandLastAt.current[key] = Date.now();
      void sendCommand(method, desired, "automation").then((sent) => {
        if (!sent) {
          delete cookingCommandLastAt.current[key];
        } else if (method === "setFan" && desired && gasDetected && reported !== true) {
          gasFanAutoOn.current[deviceId] = true;
          writeGasFanAutoState(deviceId, true);
        }
      });
    };

    enforceOutput("setFan", fanCookingAction, fanPoint ? asBoolean(fanPoint.value) : null);
    enforceOutput("setBuzzer", buzzerCookingAction, buzzerPoint ? asBoolean(buzzerPoint.value) : null);

    if (shouldNotify) {
      const alertType = aiFireDetected && gasDetected ? "AI fire and gas alert" : aiFireDetected ? "AI fire alert" : "Gas alert";
      addNotification("Cooking mode automation", `${alertType}. Fan: ${fanCookingAction}; buzzer: ${buzzerCookingAction}.`, "warning");
    }
  }, [cookingMode, connected, deviceId, alarmDetected, aiFireDetected, aiCategory, gasDetected, fanCookingAction, buzzerCookingAction, fanPoint, buzzerPoint, sendCommand, addNotification]);

  const acknowledgeAiAlert = () => {
    if (!deviceId || !aiFireDetected) return;
    try { localStorage.setItem(`${AI_ACK_KEY}${deviceId}`, aiCategory); } catch { /* Keep the acknowledgement in memory. */ }
    setAiAcknowledgedCategory(aiCategory);
    addNotification("Alert acknowledged", "Remote device controls are enabled.", "info");
  };

  const saveSettings = () => {
    const id = deviceDraft.trim();
    if (!id) { localStorage.removeItem(DEVICE_KEY); setDeviceId(""); setTelemetry({}); setPage("Home"); return; }
    localStorage.setItem(DEVICE_KEY, id);
    setDeviceId(id);
    setPage("Home");
    setMessage({ type: "success", text: "Settings saved." });
  };

  const updateCookingMode = () => {
    const next = !cookingMode;
    cookingModeRef.current = next;
    setCookingMode(next);
    addNotification(next ? "Cooking mode enabled" : "Cooking mode disabled", next ? "Cooking mode now controls the fan and buzzer; the Nito Valve stays closed." : "AI and gas threshold rules now control automatic outputs.", "info");
  };

  const resetHistory = async () => {
    if (!deviceId || !window.confirm("Clear saved chart history for this device?")) return;
    try {
      await clearHistory(deviceId);
      setHistory(Object.fromEntries(telemetryKeys.map((key) => [key, []])));
      setMessage({ type: "success", text: "Chart history cleared." });
    } catch {
      // Keep the dashboard quiet when a request fails.
    }
  };

  const metricTime = (point) => point ? `Updated ${formatClock(new Date(Number(point.ts)))}` : "No telemetry yet";
  const airText = airPoint && Number.isFinite(gasValue) ? String(gasValue) : "—";
  const tempText = tempPoint && Number.isFinite(Number(tempPoint.value)) ? Number(tempPoint.value).toFixed(2) : "—";
  const fanOn = fanReportedOn;
  const buzzerOn = buzzerPoint ? asBoolean(buzzerPoint.value) : false;
  const nitoValveOpen = nitoPoint ? asBoolean(nitoPoint.value) : false;
  const aiTitle = aiCategory === "UNKNOWN" ? "Collecting samples"
    : aiCategory === "LOW" ? "Normal"
      : aiCategory === "MEDIUM" ? "Fire risk detected"
        : aiCategory === "HIGH" ? "Fire detected" : "Waiting for sensor data";
  const aiDetail = aiError || (aiCategory === "UNKNOWN"
    ? "At least 10 sensor samples are required before detection."
    : aiCategory === "LOW" ? "No fire risk detected."
      : aiCategory === "MEDIUM" ? "The AI detected a possible fire risk."
        : aiCategory === "HIGH" ? "The AI detected a flame signal."
          : "AI analysis starts when temperature and infrared readings are available.");
  const nav = [{ name: "Home", icon: House }, { name: "Diagram", icon: Activity }, { name: "Notifications", icon: Bell }, { name: "Settings", icon: Settings }];

  return <div className="app-shell">
    <header className="topbar"><a className="brand" href="#home" onClick={() => setPage("Home")}><span className="brand-symbol"><Leaf size={18}/></span><span>BETTER<span className="brand-light"> LIFE</span></span></a><nav className="top-nav">{nav.map(({ name, icon: Icon }) => <button key={name} className={`nav-item ${page === name ? "selected" : ""}`} onClick={() => setPage(name)}><Icon size={16}/>{name}{name === "Notifications" && notifications.some((item) => !item.read) && <i className="nav-unread"/>}</button>)}</nav><div className="topbar-right"><span className={`connection-dot ${connected ? "live" : connectionError ? "wrong" : ""}`}/><span className={`connection-text ${connectionError ? "wrong" : ""}`} title={connectionError}>{connected ? "DEVICE CONNECTED" : connectionError ? "DEVICE WRONG" : "NOT CONNECTED"}</span><button className="refresh-button" onClick={() => loadDashboard()} disabled={loading} aria-label="Refresh telemetry"><RefreshCw size={15} className={loading ? "spin" : ""}/></button></div></header>

    <main className="page-wrap">
      <div className="page-title-row"><div><div className="eyebrow"><span className="eyebrow-bar"/>{page === "Home" ? "DEVICE OVERVIEW" : page.toUpperCase()}</div><h1>{page === "Home" ? "Home" : page}</h1><p>{page === "Home" ? "Live environment readings and device controls." : page === "Diagram" ? "Historical sensor readings from ThingsBoard." : page === "Notifications" ? "Recent sensor alerts and command history." : "Configure your ThingsBoard device and cooking mode."}</p></div><div className="title-meta"><span className="device-name"><span className="device-led"/>{deviceId ? `Device ${deviceId.slice(0, 8)}…${deviceId.slice(-4)}` : "No device selected"}</span><span className="updated-label"><Clock3 size={13}/>{lastUpdated ? `Updated ${formatClock(lastUpdated)}` : "Waiting for data"}</span></div></div>

      {message && message.type !== "error" && <div className={`global-message ${message.type}`}><span>{message.type === "success" ? <Check size={15}/> : <AlertTriangle size={15}/>}</span><p>{message.text}</p><button onClick={() => setMessage(null)} aria-label="Dismiss"><X size={14}/></button></div>}

      {page === "Home" && <>
        <section className="metric-grid">
          <MetricCard title="Air quality · toxic gas" value={airText} unit=" ADC" icon={Gauge} tone="blue" detail={airPoint ? metricTime(airPoint) : "No telemetry · air quality"}/>
          <MetricCard title="Temperature" value={tempText} unit=" °C" icon={Thermometer} tone="green" detail={metricTime(tempPoint)}/>
          <MetricCard title="Flame sensor" value={flamePoint ? (flameDetected ? "Detected" : "Clear") : "—"} unit="" icon={Flame} tone={flameDetected ? "amber" : "green"} detail={metricTime(flamePoint)}/>
          <MetricCard title="Fan" value={fanPoint ? (fanOn ? "On" : "Off") : "—"} unit="" icon={Wind} tone="blue" detail={metricTime(fanPoint)}/>
          <MetricCard title="Buzzer" value={buzzerPoint ? (buzzerOn ? "On" : "Off") : "—"} unit="" icon={Volume2} tone="green" detail={metricTime(buzzerPoint)}/>
          <MetricCard title="Nito Valve" value={nitoPoint ? (nitoValveOpen ? "Open" : "Closed") : "—"} unit="" icon={Droplets} tone="blue" detail={metricTime(nitoPoint)}/>
        </section>
        <section className={`panel ai-status-panel ai-${aiCategory ? aiCategory.toLowerCase() : "waiting"}`} aria-live="polite">
          <div className="ai-status-icon"><Shield size={17}/></div>
          <div className="ai-status-copy"><span className="section-overline">AI FIRE DETECTION</span><h2>{aiTitle}</h2><p>{aiDetail}</p></div>
          <div className="ai-status-meta"><b>{aiStatus ? `${aiStatus.risk_level} · ${aiStatus.status}` : "No result yet"}</b><span>{aiStatus?.online ? "Device online" : aiStatus ? "Device offline" : "Waiting for readings"}</span></div>
        </section>
        {aiNeedsAcknowledgement && <div className="ai-ack-row"><span>Confirm the alert to enable manual device controls.</span><button className="primary-button ai-ack-button" onClick={acknowledgeAiAlert}><Check size={14}/>Confirm alert and enable controls</button></div>}
        {aiAcknowledged && aiFireDetected && <div className="ai-acknowledged"><Check size={14}/>Alert acknowledged. Remote controls are enabled.</div>}
        <section className="home-grid"><article className="panel controls-panel"><div className="panel-heading"><div><span className="section-overline">DEVICE CONTROL</span><h2>Actuators</h2><p>Commands are sent to the device through ThingsBoard.</p></div><span className="rpc-badge"><Zap size={13}/>REMOTE CONTROL</span></div><ControlRow title="Ventilation fan" icon={Wind} value={fanOn} busy={rpcBusy === "setFan"} disabled={aiNeedsAcknowledgement || (cookingMode && alarmDetected)} disabledMessage={cookingMode && alarmDetected ? "Cooking mode is controlling this output" : "Confirm the AI alert to enable controls"} onToggle={() => sendCommand("setFan", !fanOn)}/><ControlRow title="Buzzer" icon={Volume2} value={buzzerOn} busy={rpcBusy === "setBuzzer"} disabled={aiNeedsAcknowledgement || (cookingMode && alarmDetected)} disabledMessage={cookingMode && alarmDetected ? "Cooking mode is controlling this output" : "Confirm the AI alert to enable controls"} onToggle={() => sendCommand("setBuzzer", !buzzerOn)}/><ControlRow title="Nito Valve" icon={Droplets} value={nitoValveOpen} busy={rpcBusy === "setNito"} disabled={!nitoManualEnabled || aiNeedsAcknowledgement || cookingMode} disabledMessage={aiNeedsAcknowledgement ? "Confirm the AI alert to enable controls" : cookingMode ? "Nito Valve stays closed while Cooking mode is on" : "Manual control is inactive in Settings"} onToggle={() => sendCommand("setNito", !nitoValveOpen)}/><p className="control-footnote">When Cooking mode is on during an alert, it enforces the selected fan and buzzer actions. When off, AI controls the fire response. A flame signal also opens the Nito Valve.</p></article>
          <article className={`panel cooking-panel ${cookingMode ? "mode-on" : ""}`}><div className="panel-heading"><div><span className="section-overline">AUTOMATION</span><h2>Cooking mode</h2></div><button className={`switch ${cookingMode ? "active" : ""}`} onClick={updateCookingMode} role="switch" aria-checked={cookingMode} aria-label="Toggle cooking mode"><span/></button></div><p className="mode-copy">Cooking mode enforces your fan and buzzer settings for any active gas or AI alert. It takes priority over other automatic controls. Nito Valve stays closed while Cooking mode is on.</p><div className="automation-actions"><label>Fan action · alerts<select className="cooking-select" value={fanCookingAction} onChange={(event) => { setFanCookingAction(event.target.value); localStorage.setItem(FAN_ACTION_KEY, event.target.value); }}><option value="on">Turn on</option><option value="off">Turn off</option><option value="unchanged">Leave unchanged</option></select></label><label>Buzzer action · alerts<select className="cooking-select" value={buzzerCookingAction} onChange={(event) => { setBuzzerCookingAction(event.target.value); localStorage.setItem(BUZZER_ACTION_KEY, event.target.value); }}><option value="on">Turn on</option><option value="off">Turn off</option><option value="unchanged">Leave unchanged</option></select></label></div><div className="mode-status"><span className={alarmDetected ? "alert" : ""}/>{alarmDetected ? "Alert condition detected" : cookingMode ? "Monitoring sensor conditions" : "Automation is paused"}</div></article></section>
        <section className="panel recent-panel"><div className="panel-heading"><div><span className="section-overline">RECENT ACTIVITY</span><h2>Latest readings</h2></div><button className="text-link" onClick={() => setPage("Diagram")}>View diagrams <ChevronRight size={14}/></button></div><div className="reading-list">{telemetryKeys.map((key) => { const point = latest(telemetry[key]); return <div className="reading-row" key={key}><span className="reading-key">{key}</span><b>{point ? point.value : "—"}{key === "temp" ? " °C" : ""}</b><span>{point ? formatDateTime(new Date(Number(point.ts))) : "No data"}</span></div>; })}</div></section>
      </>}

      {page === "Diagram" && <><div className="diagram-toolbar"><span>Saved history for this device</span><button className="reset-history-button" onClick={resetHistory}><RefreshCw size={13}/>Reset history</button></div><section className="diagram-grid">{[
        ["air quality", "ADC value", "blue"], ["temp", "°C", "green"], ["flame", "boolean", "blue"],
      ].map(([key, unit, color]) => <SensorChart key={key} title={key === "air quality" ? "Air quality · toxic gas" : key === "temp" ? "Temperature" : "Flame sensor"} unit={unit} points={chartData[key] || []} color={color} empty={`No ${key} samples are available yet.`}/> )}</section></>}

      {page === "Notifications" && <section className="panel notifications-panel"><div className="panel-heading"><div><span className="section-overline">LOCAL HISTORY</span><h2>Notifications</h2><p>Stored in this browser on this device.</p></div>{notifications.length > 0 && <button className="clear-button" onClick={() => { setNotifications([]); localStorage.removeItem(NOTIFICATIONS_KEY); }}>Clear history</button>}</div>{notifications.length ? <div className="notification-list">{notifications.map((item) => <article className="notification-row" key={item.id}><span className={`notification-icon ${item.type}`}>{item.type === "warning" ? <AlertTriangle size={16}/> : item.type === "success" ? <Check size={16}/> : <Bell size={16}/>}</span><div><b>{item.title}</b><p>{item.detail}</p><time>{formatDateTime(new Date(item.time))}</time></div><span className={`notification-state ${item.type}`}/></article>)}</div> : <div className="empty-state"><Bell size={22}/><b>No notifications yet</b><span>Sensor alerts and command activity will appear here.</span></div>}</section>}

      {page === "Settings" && <section className="settings-grid"><article className="panel settings-panel"><div className="panel-heading"><div><span className="section-overline">THINGSBOARD</span><h2>Device connection</h2><p>Choose the device this dashboard reads and controls.</p></div><span className="settings-icon"><Settings size={18}/></span></div><label className="field-label" htmlFor="device-id">Device ID</label><input id="device-id" className="text-input" value={deviceDraft} onChange={(event) => setDeviceDraft(event.target.value)} placeholder="Paste the ThingsBoard device UUID"/><p className="field-help">Find it in ThingsBoard → Devices → select your device → Details. The ID is stored in this browser.</p><div className="security-note"><Shield size={16}/><span>The ThingsBoard API key stays on the Node.js server.</span></div><div className="control-row nito-setting-row"><div className="control-icon"><Droplets size={18}/></div><div className="control-copy"><b>Nito Valve manual control</b><span>{nitoManualEnabled ? "Active · Home toggle is enabled" : "Inactive · Home toggle is locked"}</span></div><button className={`switch ${nitoManualEnabled ? "active" : ""}`} onClick={() => { const next = !nitoManualEnabled; setNitoManualEnabled(next); localStorage.setItem(NITO_MANUAL_KEY, String(next)); }} role="switch" aria-checked={nitoManualEnabled} aria-label="Toggle Nito Valve manual control"><span/></button></div><div className="settings-actions"><button className="secondary-button" onClick={() => setDeviceDraft(deviceId)}>Reset</button><button className="primary-button" onClick={saveSettings}><Check size={15}/>Save settings</button></div></article>
        <article className="panel settings-panel"><div className="panel-heading"><div><span className="section-overline">COOKING MODE</span><h2>Gas alert threshold</h2><p>Set how the raw air quality ADC value is classified.</p></div><span className="settings-icon green"><Gauge size={18}/></span></div><label className="field-label" htmlFor="gas-threshold">Threshold (ADC)</label><input id="gas-threshold" className="text-input" type="number" min="0" max="4095" value={gasThresholdDraft} onChange={(event) => setGasThresholdDraft(event.target.value)} placeholder="Set after sensor calibration"/><p className="field-help">Current reading: {airText}. Calibrate in clean air and near the target gas before choosing a threshold.</p><label className="field-label" htmlFor="gas-direction">Gas is detected when</label><select id="gas-direction" className="text-input" value={gasDirectionDraft} onChange={(event) => setGasDirectionDraft(event.target.value)}><option value="above">Reading is at or above threshold</option><option value="below">Reading is at or below threshold</option></select><p className="field-help">Cooking mode uses this threshold together with the flame sensor.</p><div className="settings-actions"><button className="secondary-button" onClick={() => { setGasThresholdDraft(""); setGasDirectionDraft("above"); }}>Reset</button><button className="primary-button" onClick={() => { setGasThreshold(gasThresholdDraft); setGasDirection(gasDirectionDraft); localStorage.setItem(THRESHOLD_KEY, gasThresholdDraft); localStorage.setItem(DIRECTION_KEY, gasDirectionDraft); setPage("Home"); setMessage({ type: "success", text: "Gas threshold saved." }); }}><Check size={15}/>Save threshold</button></div></article></section>}

      <footer className="page-footer"><span><span className={`footer-dot ${health ? "" : "down"}`}/>{health ? "Backend online" : "Backend unavailable"}</span><span>Auto-refresh every 5 seconds <span className="footer-separator">·</span> {deviceId ? `Device ${deviceId.slice(0, 8)}…` : "Set a Device ID in Settings"}</span></footer>
    </main>
  </div>;
}


