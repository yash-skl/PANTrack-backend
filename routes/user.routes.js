import { Router } from 'express';
import { verifyJWT } from '../middlewares/auth.middleware.js';
import { upload } from "../middlewares/multer.middleware.js";
import { getAllUsers, loginUser, logoutUser, registerUser, getUserById } from '../controllers/user.controllers.js';

const router = Router();

router.route("/").get(verifyJWT, getAllUsers);
router.route("/register").post(upload.single("file"), registerUser);
router.route("/login").post(loginUser);
router.route("/get/:id").get(verifyJWT, getUserById);
router.route("/logout").get(logoutUser);

export default router;
