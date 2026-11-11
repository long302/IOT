const express = require("express");
const deviceController = require("../controllers/deviceController");

const router = express.Router();
router.get("/telemetry", deviceController.getTelemetry);
router.get("/history", deviceController.getHistory);
router.delete("/history", deviceController.clearHistory);

module.exports = router;
