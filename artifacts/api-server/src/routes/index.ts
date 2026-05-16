import { Router, type IRouter } from "express";
import healthRouter from "./health";
import outfitPreviewRouter from "./outfit-preview";

const router: IRouter = Router();

router.use(healthRouter);
router.use(outfitPreviewRouter);

export default router;
