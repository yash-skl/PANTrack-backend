import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/apiError.js";
import { ApiResponse } from "../utils/apiResponse.js";
import { PanSubmission } from "../models/panSubmission.models.js";
import { User } from "../models/user.models.js";

// Get all PAN submissions with filtering for admin
const getAllPanSubmissionsAdmin = asyncHandler(async (req, res) => {
  // Check if user is admin
  if (req.user.role !== 'admin') {
    throw new ApiError(403, "Access denied. Admin privileges required.");
  }

  const { status, startDate, endDate, userId, page = 1, limit = 10 } = req.query;

  // Build filter object
  let filter = {};

  // Filter by status
  if (status && status !== 'all') {
    filter.status = status;
  }

  // Filter by date range
  if (startDate || endDate) {
    filter.submissionDate = {};
    if (startDate) {
      filter.submissionDate.$gte = new Date(startDate);
    }
    if (endDate) {
      filter.submissionDate.$lte = new Date(endDate);
    }
  }

  // Filter by user
  if (userId) {
    filter.user = userId;
  }

  try {
    // Calculate pagination
    const skip = (page - 1) * limit;
    
    // Get total count for pagination
    const totalSubmissions = await PanSubmission.countDocuments(filter);
    
    // Get filtered submissions
    const submissions = await PanSubmission.find(filter)
      .populate("user", "name email role")
      .sort({ submissionDate: -1 }) // Most recent first
      .skip(skip)
      .limit(parseInt(limit));

    const totalPages = Math.ceil(totalSubmissions / limit);

    res.status(200).json(new ApiResponse(200, {
      submissions,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalSubmissions,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    }, "PAN submissions fetched successfully."));

  } catch (error) {
    throw new ApiError(500, "Error fetching submissions: " + error.message);
  }
});

// Update PAN submission status (admin only)
const updatePanSubmissionStatusAdmin = asyncHandler(async (req, res) => {
  // Check if user is admin
  if (req.user.role !== 'admin') {
    throw new ApiError(403, "Access denied. Admin privileges required.");
  }

  const { id } = req.params;
  const { status, remarks } = req.body;

  const validStatus = ["pending", "reviewed", "approved", "rejected"];
  if (!validStatus.includes(status)) {
    throw new ApiError(400, "Invalid status value.");
  }

  const submission = await PanSubmission.findByIdAndUpdate(
    id,
    { 
      status,
      remarks: remarks || "",
      updatedAt: new Date()
    },
    { new: true }
  ).populate("user", "name email role");

  if (!submission) {
    throw new ApiError(404, "Submission not found.");
  }

  res.status(200).json(new ApiResponse(200, submission, "Submission status updated successfully."));
});

// Get admin dashboard statistics
const getAdminDashboardStats = asyncHandler(async (req, res) => {
  // Check if user is admin
  if (req.user.role !== 'admin') {
    throw new ApiError(403, "Access denied. Admin privileges required.");
  }

  try {
    const totalSubmissions = await PanSubmission.countDocuments();
    const pendingSubmissions = await PanSubmission.countDocuments({ status: 'pending' });
    const approvedSubmissions = await PanSubmission.countDocuments({ status: 'approved' });
    const rejectedSubmissions = await PanSubmission.countDocuments({ status: 'rejected' });
    const reviewedSubmissions = await PanSubmission.countDocuments({ status: 'reviewed' });

    // Get recent submissions (last 5)
    const recentSubmissions = await PanSubmission.find()
      .populate("user", "name email")
      .sort({ submissionDate: -1 })
      .limit(5);

    const stats = {
      totalSubmissions,
      pendingSubmissions,
      approvedSubmissions,
      rejectedSubmissions,
      reviewedSubmissions,
      recentSubmissions
    };

    res.status(200).json(new ApiResponse(200, stats, "Admin dashboard stats fetched successfully."));

  } catch (error) {
    throw new ApiError(500, "Error fetching dashboard stats: " + error.message);
  }
});

export { 
  getAllPanSubmissionsAdmin, 
  updatePanSubmissionStatusAdmin, 
  getAdminDashboardStats 
};
