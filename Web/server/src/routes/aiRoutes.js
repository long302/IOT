const express = require("express");
const aiController = require("../controllers/aiController");

const router = express.Router();
router.post("/sensor-data", aiController.submitSensorSample);

module.exports = router;
