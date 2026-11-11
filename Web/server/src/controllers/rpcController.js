const { thingsboard, isConfigured } = require("../config/thingsboard");

function getErrorMessage(error) {
  const data = error.response?.data;
  if (typeof data === "string") return data;
  if (data?.message) return data.message;
  if (data) return JSON.stringify(data);
  return error.code === "ECONNABORTED" ? "ThingsBoard không phản hồi trong thời gian chờ." : error.message;
}

exports.sendRpc = async (req, res) => {
  if (!isConfigured()) {
    return res.status(503).json({ success: false, message: "Backend chưa được cấu hình TB_URL và TB_API_KEY." });
  }

  const { deviceId, method, params } = req.body || {};
  if (typeof deviceId !== "string" || !/^[A-Za-z0-9_-]{1,64}$/.test(deviceId)) {
    return res.status(400).json({ success: false, message: "deviceId không hợp lệ." });
  }
  if (typeof method !== "string" || !/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(method)) {
    return res.status(400).json({ success: false, message: "method không hợp lệ." });
  }
  if (params === undefined) {
    return res.status(400).json({ success: false, message: "Thiếu giá trị điều khiển." });
  }

  try {
    await thingsboard.post(`/api/rpc/oneway/${encodeURIComponent(deviceId)}`, {
      method,
      params,
    });

    return res.json({ success: true, message: "ThingsBoard đã gửi lệnh đến thiết bị." });
  } catch (error) {
    return res.status(error.response?.status || 502).json({ success: false, message: getErrorMessage(error) });
  }
};
