import { Router, type IRouter } from "express";
import healthRouter from "./health";
import postsRouter from "./posts";
import openaiRouter from "./openai";
import blocksRouter from "./blocks";

const router: IRouter = Router();

router.use(healthRouter);
router.use(postsRouter);
router.use(openaiRouter);
router.use(blocksRouter);

export default router;
