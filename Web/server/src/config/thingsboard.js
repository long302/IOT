const axios = require("axios");

const thingsboard = axios.create({
  baseURL: process.env.TB_URL,
  headers: {
    "X-Authorization": `ApiKey ${process.env.TB_API_KEY}`,
    "Content-Type": "application/json",
  },
  timeout: 15000,
});

function isConfigured() {
  return Boolean(process.env.TB_URL && process.env.TB_API_KEY && process.env.TB_API_KEY !== "YOUR_API_KEY");
}

module.exports = { thingsboard, isConfigured };
