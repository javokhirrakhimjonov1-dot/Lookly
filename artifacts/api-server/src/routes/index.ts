import { Router, type IRouter } from "express";
import healthRouter from "./health";
import outfitPreviewRouter from "./outfit-preview";
import identifyClothingRouter from "./identify-clothing";

const router: IRouter = Router();

router.use(healthRouter);
router.use(outfitPreviewRouter);
router.use(identifyClothingRouter);

export default router;
