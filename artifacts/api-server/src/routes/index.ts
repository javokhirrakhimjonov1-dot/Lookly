import { Router, type IRouter } from "express";
import healthRouter from "./health";
import outfitPreviewRouter from "./outfit-preview";
import identifyClothingRouter from "./identify-clothing";
import compareClothingRouter from "./compare-clothing";
import pairItemsRouter from "./pair-items";
import removeBgRouter from "./remove-bg";
import suggestOutfitsRouter from "./suggest-outfits";
import itemsRouter from "./items";
import { rateLimit, requireAuthenticatedUser } from "../middleware/auth";

const router: IRouter = Router();

router.use(healthRouter);
router.use(requireAuthenticatedUser);
// One 15-photo wardrobe batch can make one identification request per photo
// plus a product-image request for each selected piece. Allow the whole batch
// to complete while still protecting the Gemini and image-processing routes.
router.use(rateLimit(60, 15 * 60 * 1000));
router.use(outfitPreviewRouter);
router.use(identifyClothingRouter);
router.use(compareClothingRouter);
router.use(pairItemsRouter);
router.use(removeBgRouter);
router.use(suggestOutfitsRouter);
router.use(itemsRouter);

export default router;
