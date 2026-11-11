const fs = require("node:fs/promises");
const path = require("node:path");
const { thingsboard, isConfigured } = require("../config/thingsboard");
const historyRoot = path.join(__dirname, "../../data");
const legacyHistoryFile = path.join(__dirname, "../../telemetry-history.json");
const historyKeys = ["air quality", "bluzzer", "fan", "flame", "nito", "temp"];
let historyWriteQueue = Promise.resolve();

function deviceHistoryPath(deviceId) {
  return path.join(historyRoot, deviceId, "history.json");
}

async function readHistoryFile(deviceId) {
  try {
    return JSON.parse(await fs.readFile(deviceHistoryPath(deviceId), "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") {
      try {
        const oldStore = JSON.parse(await fs.readFile(legacyHistoryFile, "utf8"));
        const oldSamples = oldStore.devices?.[deviceId];
        if (Array.isArray(oldSamples)) return { deviceId, samples: oldSamples };
      } catch (legacyError) {
        if (legacyError.code !== "ENOENT") throw legacyError;
      }
      return { deviceId, samples: [] };
    }
    throw error;
  }
}

async function writeHistoryFile(deviceId, store) {
  const file = deviceHistoryPath(deviceId);
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tempFile = `${file}.tmp`;
  await fs.writeFile(tempFile, JSON.stringify(store), "utf8");
  await fs.rename(tempFile, file);
}

function saveHistorySample(deviceId, telemetry) {
  const values = {};
  for (const key of historyKeys) {
    const point = telemetry[key]?.[0];
    if (point) values[key] = { sourceTs: Number(point.ts) || null, value: point.value };
  }
  if (!Object.keys(values).length) return Promise.resolve();

  const write = async () => {
    const store = await readHistoryFile(deviceId);
    const samples = Array.isArray(store.samples) ? store.samples : [];
    samples.push({ sampledAt: Date.now(), values });
    await writeHistoryFile(deviceId, { deviceId, samples: samples.slice(-20000) });
  };
  const result = historyWriteQueue.then(write, write);
  historyWriteQueue = result.catch(() => {});
  return result;
}

exports.getTelemetry = async (req, res) => {
  if (!isConfigured()) {
    return res.status(503).json({ success: false, message: "Backend chưa được cấu hình TB_URL và TB_API_KEY." });
  }

  const { deviceId } = req.query;
  const keys = typeof req.query.keys === "string" ? req.query.keys.split(",") : [];
  const limit = Number.parseInt(req.query.limit, 10) || 24;

  if (typeof deviceId !== "string" || !/^[A-Za-z0-9_-]{1,64}$/.test(deviceId)) {
    return res.status(400).json({ success: false, message: "deviceId không hợp lệ." });
  }
  if (!keys.length || keys.length > 6 || keys.some((key) => !/^[A-Za-z][A-Za-z0-9_ ]{0,63}$/.test(key.trim()))) {
    return res.status(400).json({ success: false, message: "Danh sách telemetry keys không hợp lệ." });
  }

  try {
    const response = await thingsboard.get(
      `/api/plugins/telemetry/DEVICE/${encodeURIComponent(deviceId)}/values/timeseries`,
      { params: { keys: keys.join(","), limit: 1, orderBy: "DESC" } },
    );
    await saveHistorySample(deviceId, response.data);
    return res.json({ success: true, data: response.data });
  } catch (error) {
    const data = error.response?.data;
    const message = typeof data === "string" ? data : data?.message || (data ? JSON.stringify(data) : error.message);
    return res.status(error.response?.status || 502).json({ success: false, message });
  }
};

exports.getHistory = async (req, res) => {
  const { deviceId } = req.query;
  if (typeof deviceId !== "string" || !/^[A-Za-z0-9_-]{1,64}$/.test(deviceId)) {
    return res.status(400).json({ success: false, message: "deviceId is invalid." });
  }

  try {
    const store = await readHistoryFile(deviceId);
    const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 600, 1), 2000);
    const samples = (store.samples || []).slice(-limit);
    const history = Object.fromEntries(historyKeys.map((key) => [key, []]));
    for (const sample of samples) {
      for (const key of historyKeys) {
        const reading = sample.values?.[key];
        if (reading) history[key].push({ ts: sample.sampledAt, sourceTs: reading.sourceTs, value: reading.value });
      }
    }
    return res.json({ success: true, data: history });
  } catch (error) {
    console.error("Unable to read telemetry history:", error.message);
    return res.status(500).json({ success: false, message: "Could not read saved telemetry history." });
  }
};

exports.clearHistory = async (req, res) => {
  const { deviceId } = req.query;
  if (typeof deviceId !== "string" || !/^[A-Za-z0-9_-]{1,64}$/.test(deviceId)) {
    return res.status(400).json({ success: false, message: "deviceId is invalid." });
  }

  const clear = async () => writeHistoryFile(deviceId, { deviceId, samples: [] });
  const result = historyWriteQueue.then(clear, clear);
  historyWriteQueue = result.catch(() => {});
  try {
    await result;
    return res.json({ success: true });
  } catch (error) {
    console.error("Unable to reset telemetry history:", error.message);
    return res.status(500).json({ success: false, message: "Could not reset saved telemetry history." });
  }
};
