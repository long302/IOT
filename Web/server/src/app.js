require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { isConfigured } = require("./config/thingsboard");

const app = express();
const allowedOrigins = (process.env.CORS_ORIGIN || "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const localDevelopmentHosts = new Set(["localhost", "127.0.0.1", "[::1]"]);

function isAllowedOrigin(origin) {
  if (!origin || allowedOrigins.includes(origin)) return true;
  if (process.env.NODE_ENV === "production") return false;

  try {
    const parsedOrigin = new URL(origin);
    return ["http:", "https:"].includes(parsedOrigin.protocol)
      && localDevelopmentHosts.has(parsedOrigin.hostname);
  } catch {
    return false;
  }
}

app.disable("x-powered-by");
app.use(cors({
  origin(origin, callback) {
    if (isAllowedOrigin(origin)) return callback(null, true);
    return callback(new Error("Origin is not allowed by CORS."));
  },
}));
app.use(express.json({ limit: "32kb" }));

app.get("/api/health", (_req, res) => {
  res.json({ success: true, thingsboardConfigured: isConfigured() });
});
app.use("/api/rpc", require("./routes/rpcRoutes"));
app.use("/api/device", require("./routes/deviceRoutes"));
app.use("/api/ai", require("./routes/aiRoutes"));

app.use((error, _req, res, _next) => {
  if (error instanceof SyntaxError && error.status === 400 && "body" in error) {
    return res.status(400).json({ success: false, message: "JSON request không hợp lệ." });
  }
  if (error.message === "Origin is not allowed by CORS.") {
    return res.status(403).json({ success: false, message: "Origin không được phép. Thêm địa chỉ frontend vào CORS_ORIGIN trong server/.env." });
  }
  return res.status(500).json({ success: false, message: "Lỗi máy chủ." });
});

const port = Number(process.env.PORT) || 3001;
app.listen(port, "0.0.0.0", () => {
  console.log(`Server running on port ${port}`);
});
