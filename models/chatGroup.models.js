import mongoose from "mongoose";

const chatGroupSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
        maxlength: 50
    },
    description: {
        type: String,
        trim: true,
        maxlength: 200
    },
    type: {
        type: String,
        enum: ['default', 'private', 'admin'],
        default: 'private'
    },
    members: [{
        user: {
            type: mongoose.Schema.Types.ObjectId,
            refPath: 'members.userType',
            required: true
        },
        userType: {
            type: String,
            enum: ['User', 'SubAdmin'],
            required: true
        },
        role: {
            type: String,
            enum: ['member', 'admin'],
            default: 'member'
        },
        joinedAt: {
            type: Date,
            default: Date.now
        }
    }],
    createdBy: {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            refPath: 'createdBy.userType',
            required: true
        },
        userType: {
            type: String,
            enum: ['User', 'SubAdmin'],
            required: true
        }
    },
    isActive: {
        type: Boolean,
        default: true
    },
    isMuted: {
        type: Boolean,
        default: false
    },
    lastMessage: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Message'
    },
    lastActivity: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Index for efficient queries
chatGroupSchema.index({ type: 1, isActive: 1 });
chatGroupSchema.index({ 'members.user': 1 });
chatGroupSchema.index({ lastActivity: -1 });

// Virtual for message count
chatGroupSchema.virtual('messageCount', {
    ref: 'Message',
    localField: '_id',
    foreignField: 'chatGroup',
    count: true
});

// Ensure virtual fields are serialized
chatGroupSchema.set('toJSON', { virtuals: true });
chatGroupSchema.set('toObject', { virtuals: true });

export const ChatGroup = mongoose.model("ChatGroup", chatGroupSchema);
