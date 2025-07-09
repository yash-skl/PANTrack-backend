import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/apiError.js";
import { ApiResponse } from "../utils/apiResponse.js";
import { PanSubmission } from "../models/panSubmission.models.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";

// Create 
const createPanSubmission = asyncHandler(async (req, res) => {
  const {
    fullName,
    panNumber,
    aadhaarNumber,
    dateOfBirth,
    mobileNumber,
    address
  } = req.body;

  // Validate required fields
  if (
    !fullName ||
    !panNumber ||
    !aadhaarNumber ||
    !dateOfBirth ||
    !mobileNumber ||
    !address
  ) {
    throw new ApiError(400, "All fields are required.");
  }

  // Validate file uploads
  if (!req.files || !req.files.aadhaarFront || !req.files.aadhaarBack || !req.files.panCard) {
    throw new ApiError(400, "All required documents must be uploaded.");
  }

  // Upload documents to Cloudinary
  const aadhaarFrontResult = await uploadOnCloudinary(req.files.aadhaarFront[0].path);
  const aadhaarBackResult = await uploadOnCloudinary(req.files.aadhaarBack[0].path);
  const panCardResult = await uploadOnCloudinary(req.files.panCard[0].path);

  // Save submission in DB
  const panSubmission = await PanSubmission.create({
    user: req.user._id,
    fullName,
    panNumber,
    aadhaarNumber,
    dateOfBirth,
    mobileNumber,
    address,
    aadhaarFrontImage: aadhaarFrontResult.secure_url,
    aadhaarBackImage: aadhaarBackResult.secure_url,
    panCardImage: panCardResult.secure_url,
    status: "pending"
  });

  res.status(201).json(new ApiResponse(201, panSubmission, "PAN submission created successfully."));
});


// Get all PAN Submissions 
const getAllPanSubmissions = asyncHandler(async (req, res) => {
  const submissions = await PanSubmission.find().populate("user", "name email role");

  res.status(200).json(new ApiResponse(200, submissions, "All PAN submissions fetched successfully."));
});


// Get PAN Submission by ID
const getPanSubmissionById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const submission = await PanSubmission.findById(id).populate("user", "name email role");

  if (!submission) {
    throw new ApiError(404, "Submission not found.");
  }

  res.status(200).json(new ApiResponse(200, submission, "PAN submission fetched successfully."));
});


// Update Status
const updatePanSubmissionStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  const validStatus = ["pending", "reviewed", "approved", "rejected"];
  if (!validStatus.includes(status)) {
    throw new ApiError(400, "Invalid status value.");
  }

  const submission = await PanSubmission.findByIdAndUpdate(
    id,
    { status },
    { new: true }
  );

  if (!submission) {
    throw new ApiError(404, "Submission not found.");
  }

  res.status(200).json(new ApiResponse(200, submission, "Submission status updated."));
});


export { createPanSubmission, getAllPanSubmissions, getPanSubmissionById, updatePanSubmissionStatus };