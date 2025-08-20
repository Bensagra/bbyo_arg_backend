import { Router } from "express";
import * as activityControllers from "./controllers/activityControllers.js";
import * as proposalControllers from "./controllers/proposalsControllers.js"; // <-- ojo: proposals
import * as userController from "./controllers/userController.js";
import { createTematica, listTematicas } from "./controllers/proporsalsControllers.js";

const router = Router();

/* Health */
router.get(["/health", "/api/health"], (_, res) => res.status(200).json({ ok: true }));

/* USERS */
// EN
router.post("/api/users", userController.createUser);
router.get("/api/users/:dni", userController.getUser);
// ES (legacy)
router.post("/user", userController.createUser);
router.get("/user/:dni", userController.getUser);

/* TEMATICAS / PROPOSALS */
// EN
router.get("/api/tematicas", listTematicas);
router.post("/api/tematicas", createTematica);
// ES (legacy)
router.get("/propuestas", listTematicas);
router.post("/propuestas", createTematica);

/* ACTIVITIES */
// EN
router.post("/api/activities", activityControllers.createActivity);
router.get("/api/activities", activityControllers.listActivities);
router.put("/api/activities/:id", activityControllers.updateActivity);
router.patch("/api/activities/:id", activityControllers.patchActivity);

// ES (legacy)
router.post("/actividades", activityControllers.createActivity);
router.get("/actividades", activityControllers.listActivities);
router.put("/actividades/:id", activityControllers.updateActivity);
router.patch("/actividades/:id", activityControllers.patchActivity);

export default router;