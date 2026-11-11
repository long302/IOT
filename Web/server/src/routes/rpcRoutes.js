const express = require("express");
const rpcController = require("../controllers/rpcController");

const router = express.Router();
router.post("/send", rpcController.sendRpc);

module.exports = router;
