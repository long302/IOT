const axios = require("axios");

const aiFireDetection = axios.create({
  baseURL: process.env.AI_API_URL,
  timeout: 60000,
  headers: {
    "X-API-Key": process.env.AI_API_KEY,
    "Content-Type": "application/json",
  },
});

function isAIConfigured() {
  return Boolean(
    process.env.AI_API_URL
    && process.env.AI_API_KEY
    && process.env.AI_API_KEY !== "YOUR_API_KEY",
  );
}

module.exports = { aiFireDetection, isAIConfigured };
