import mongoose, { Schema } from "mongoose";

const panSubmissionSchema = new Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  fullName: { type: String, required: true },
  panNumber: { type: String, required: true },
  aadhaarNumber: { type: String, required: true },
  dateOfBirth: { type: Date, required: true },
  mobileNumber: { type: String, required: true },
  address: { type: String, required: true },
  aadhaarFrontImage: { type: String, required: true },
  aadhaarBackImage: { type: String, required: true },
  panCardImage: { type: String, required: true },
  status: { type: String, enum: ["pending", "reviewed", "approved", "rejected"], default: "pending" },
  submissionDate: { type: Date, default: Date.now }
}, { timestamps: true });

export const PanSubmission = mongoose.model("PanSubmission", panSubmissionSchema);
