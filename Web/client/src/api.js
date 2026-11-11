import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "",
  timeout: 18000,
  headers: { "Content-Type": "application/json" },
});

export async function getHealth() {
  const { data } = await api.get("/api/health");
  return data;
}

export async function getTelemetry(deviceId) {
  const { data } = await api.get("/api/device/telemetry", {
    params: { deviceId, keys: "air quality,bluzzer,fan,flame,nito,temp", limit: 1 },
  });
  return data.data;
}

export async function getHistory(deviceId) {
  const { data } = await api.get("/api/device/history", { params: { deviceId, limit: 600 } });
  return data.data;
}

export async function clearHistory(deviceId) {
  const { data } = await api.delete("/api/device/history", { params: { deviceId } });
  return data;
}

export async function submitFireDetectionSample(sample) {
  const { data } = await api.post("/api/ai/sensor-data", sample, { timeout: 65000 });
  return data;
}

export async function sendActuatorCommand(deviceId, method, state) {
  const { data } = await api.post("/api/rpc/send", {
    deviceId,
    method,
    params: state,
  });
  return data;
}
