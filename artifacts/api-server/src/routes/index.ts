import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import projectsRouter from "./projects";
import imagesRouter from "./images";
import adsRouter from "./ads";
import usageRouter from "./usage";
import subscriptionsRouter from "./subscriptions";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(projectsRouter);
router.use(imagesRouter);
router.use(adsRouter);
router.use(usageRouter);
router.use(subscriptionsRouter);

export default router;
