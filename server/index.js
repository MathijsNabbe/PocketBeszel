import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import config from "./config.js";
import { refreshCache } from "./beszel.js";
import apiRouter from "./routes/api.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "..", "public");

const app = express();

app.use(express.json());
app.use("/api", apiRouter);
app.use(express.static(publicDir));

app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api")) {
    return next();
  }
  res.sendFile(path.join(publicDir, "index.html"));
});

let refreshTimer = null;

function startRefreshLoop() {
  refreshCache().catch((error) => {
    console.error("Initial cache refresh failed:", error.message);
  });

  refreshTimer = setInterval(() => {
    refreshCache().catch((error) => {
      console.error("Cache refresh failed:", error.message);
    });
  }, config.refreshInterval);
}

function stopRefreshLoop() {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
}

const server = app.listen(config.port, () => {
  console.log(`Beszel Dashboard running on port ${config.port}`);
  startRefreshLoop();
});

function shutdown() {
  console.log("Shutting down...");
  stopRefreshLoop();
  server.close(() => process.exit(0));
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
