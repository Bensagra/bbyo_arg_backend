// router.js
import { Router } from "express";
import * as activityControllers from "./controllers/activityControllers.js";
import * as proposalControllers from "./controllers/proposalsControllers.js"; // <-- fix typo
import * as userController from "./controllers/userController.js";

const router = Router();

/* ---------------- HEALTH ---------------- */
router.get(["/health", "/api/health"], (req, res) => {
  res.status(200).json({ ok: true });
});

/* ---------------- USERS ---------------- */
// EN
router.post("/api/users", userController.createUser);
router.get("/api/users/:dni", userController.getUser);
// ES (legacy)
router.post("/user", userController.createUser);
router.get("/user/:dni", userController.getUser);

/* ---------------- TEMATICAS / PROPOSALS ---------------- */
// EN
router.get("/api/tematicas", proposalControllers.listTematicas);
router.post("/api/tematicas", proposalControllers.createTematica);
// ES (legacy)
router.get("/propuestas", proposalControllers.listTematicas);
router.post("/propuestas", proposalControllers.createTematica);

/* ---------------- ACTIVITIES ---------------- */
// EN (verbs estándar)
router.post("/api/activities", activityControllers.createActivity);   // crear
router.get("/api/activities", activityControllers.listActivities);    // listar
router.put("/api/activities/:id", activityControllers.updateActivity);// upsert vínculos
router.patch("/api/activities/:id", activityControllers.patchActivity);// estado/notas

// ES (legacy, mismo handler, SIN redirigir para evitar 308)
router.post("/actividades", activityControllers.createActivity);
router.get("/actividades", activityControllers.listActivities);
router.put("/actividades/:id", activityControllers.updateActivity);
router.patch("/actividades/:id", activityControllers.patchActivity);

export default router;