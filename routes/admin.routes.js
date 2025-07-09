import { Router } from 'express';
import { verifyJWT } from '../middlewares/auth.middleware.js';
import { 
  getAllPanSubmissionsAdmin, 
  updatePanSubmissionStatusAdmin, 
  getAdminDashboardStats 
} from '../controllers/admin.controllers.js';

const router = Router();

// All routes require JWT verification
router.use(verifyJWT);

// Get dashboard statistics
router.route("/dashboard/stats").get(getAdminDashboardStats);

// Get all PAN submissions with filters
router.route("/pan-submissions").get(getAllPanSubmissionsAdmin);

// Update PAN submission status
router.route("/pan-submissions/:id/status").put(updatePanSubmissionStatusAdmin);

export default router;
