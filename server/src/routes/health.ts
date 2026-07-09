import { Router } from "express";

const router = Router();

router.get("/healthz", (_req, res) => {
  res.json({
    status: "ok",
    service: "gameopen-api",
    time: new Date().toISOString(),
  });
});

router.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "gameopen-api" });
});

export default router;
