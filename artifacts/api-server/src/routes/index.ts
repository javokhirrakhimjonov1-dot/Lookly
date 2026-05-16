import { Router, type IRouter } from "express";
import healthRouter from "./health";
import outfitPreviewRouter from "./outfit-preview";
import identifyClothingRouter from "./identify-clothing";
import pairItemsRouter from "./pair-items";
import removeBgRouter from "./remove-bg";

const router: IRouter = Router();

router.use(healthRouter);
router.use(outfitPreviewRouter);
router.use(identifyClothingRouter);
router.use(pairItemsRouter);
router.use(removeBgRouter);

export default router;
