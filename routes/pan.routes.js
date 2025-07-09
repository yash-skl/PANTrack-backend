import { Router } from 'express';
import { verifyJWT } from "../middlewares/auth.middleware.js"; // Protect routes
import { createPanSubmission, getAllPanSubmissions, getPanSubmissionById, updatePanSubmissionStatus } from "../controllers/pan.controllers.js";
import { upload } from "../middlewares/multer.middleware.js";  

const router = Router();

// Multer handler ➔ Only the field names and file limits
const uploadPanDocuments = upload.fields([
    { name: 'aadhaarFront', maxCount: 1 },
    { name: 'aadhaarBack', maxCount: 1 },
    { name: 'panCard', maxCount: 1 },
  ]);

// Create submission 
router.route("/submit").post(verifyJWT, uploadPanDocuments, createPanSubmission);


// Get all submissions (admin/subadmin)
router.route("/").get(verifyJWT, getAllPanSubmissions);

// Get single submission by ID
router.route("/get/:id").get(verifyJWT, getPanSubmissionById);

// Update submission status
router.route("/update/:id").put(verifyJWT, updatePanSubmissionStatus);

export default router;
