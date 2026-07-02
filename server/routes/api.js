import { Router } from "express";
import { getCache } from "../beszel.js";

const router = Router();

router.get("/devices", (_req, res) => {
  const cache = getCache();

  if (cache.beszelStatus !== "ok") {
    return res.status(503).json({ error: "beszel_offline" });
  }

  res.json(cache.devices);
});

router.get("/health", (_req, res) => {
  const cache = getCache();

  res.json({
    status: "ok",
    beszel: cache.beszelStatus,
    deviceCount: cache.devices.length,
    lastUpdated: cache.lastUpdated,
  });
});

export default router;
