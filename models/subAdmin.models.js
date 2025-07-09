import mongoose, { Schema } from "mongoose";

const subAdminSchema = new Schema({
    user: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: "User", 
        required: true,
        unique: true
    },
    permissions: {
        type: String,
        enum: ["view-only", "full-access"],
        default: "view-only"
    },
    assignedGroups: [{
        type: String
    }],
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    }
}, { timestamps: true });

export const SubAdmin = mongoose.model("SubAdmin", subAdminSchema); 