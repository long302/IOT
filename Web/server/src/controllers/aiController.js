const { aiFireDetection, isAIConfigured } = require("../config/ai");

const deviceIdPattern = /^[A-Za-z0-9_-]{1,64}$/;

function getErrorMessage(error) {
  const data = error.response?.data;
  if (typeof data === "string") return data;
  if (typeof data?.detail === "string") return data.detail;
  if (data?.detail) return JSON.stringify(data.detail);
  if (data?.message) return data.message;
  if (data) return JSON.stringify(data);
  if (error.code === "ECONNABORTED") return "The AI service did not respond in time.";
  return error.message;
}

exports.submitSensorSample = async (req, res) => {
  if (!isAIConfigured()) {
    return res.status(503).json({
      success: false,
      message: "Set AI_API_URL and AI_API_KEY in server/.env to enable fire detection.",
    });
  }

  const { device_id: deviceId, temperature, infrared } = req.body || {};
  if (typeof deviceId !== "string" || !deviceIdPattern.test(deviceId)) {
    return res.status(400).json({ success: false, message: "device_id is invalid." });
  }
  if (typeof temperature !== "number" || !Number.isFinite(temperature) || temperature < -40 || temperature > 125) {
    return res.status(400).json({ success: false, message: "temperature must be a number from -40 to 125 °C." });
  }
  if (!Number.isInteger(infrared) || (infrared !== 0 && infrared !== 1)) {
    return res.status(400).json({ success: false, message: "infrared must be 0 or 1." });
  }

  try {
    const response = await aiFireDetection.post("/api/v1/sensor-data", {
      device_id: deviceId,
      temperature,
      infrared,
    });
    return res.json(response.data);
  } catch (error) {
    return res.status(error.response?.status || 502).json({
      success: false,
      message: getErrorMessage(error),
    });
  }
};
