import { Router, type IRouter } from "express";
import healthRouter from "./health";
import checkoutRouter from "./checkout";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/checkout", checkoutRouter);

export default router;
