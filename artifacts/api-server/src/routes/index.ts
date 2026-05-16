import { Router, type IRouter } from "express";
import healthRouter from "./health";
import outfitPreviewRouter from "./outfit-preview";
import identifyClothingRouter from "./identify-clothing";
import pairItemsRouter from "./pair-items";

const router: IRouter = Router();

router.use(healthRouter);
router.use(outfitPreviewRouter);
router.use(identifyClothingRouter);
router.use(pairItemsRouter);

export default router;
