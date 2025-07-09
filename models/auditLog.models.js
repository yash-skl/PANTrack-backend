import mongoose, { Schema } from "mongoose";

const auditLogSchema = new Schema({
    subAdmin: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    action: {
        type: String,
        enum: ["view", "edit", "approve", "reject", "login", "logout"],
        required: true
    },
    targetUser: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    },
    targetSubmission: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "PanSubmission"
    },
    description: {
        type: String,
        required: true
    },
    ipAddress: {
        type: String
    },
    timestamp: {
        type: Date,
        default: Date.now
    }
}, { timestamps: true });

export const AuditLog = mongoose.model("AuditLog", auditLogSchema); 