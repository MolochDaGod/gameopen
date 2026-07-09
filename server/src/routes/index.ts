import { Router } from "express";
import health from "./health.js";
import effects from "./effects.js";
import characters from "./characters.js";
import assets from "./assets.js";
import fleet from "./fleet.js";

const router = Router();

router.use(health);
router.use(effects);
router.use(assets);
router.use(fleet);
router.use("/characters", characters);

export default router;
