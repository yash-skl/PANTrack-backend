import { Router } from "express";
import { 
    createSubAdmin,
    getAllSubAdmins,
    getSubAdminById,
    updateSubAdmin,
    deleteSubAdmin,
    loginSubAdmin
} from "../controllers/subAdmin.controllers.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

// SubAdmin login route (no auth required)
router.route("/login").post(loginSubAdmin);

// Admin-only routes for managing subadmins (Basic CRUD operations)
router.route("/create").post(verifyJWT, createSubAdmin);
router.route("/").get(verifyJWT, getAllSubAdmins);
router.route("/:id").get(verifyJWT, getSubAdminById);
router.route("/:id").put(verifyJWT, updateSubAdmin);
router.route("/:id").delete(verifyJWT, deleteSubAdmin);

export default router; 