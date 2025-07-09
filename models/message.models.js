import mongoose from "mongoose";

const messageSchema = new mongoose.Schema({
    chatGroup: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ChatGroup',
        required: true
    },
    sender: {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            refPath: 'sender.userType',
            required: true
        },
        userType: {
            type: String,
            enum: ['User', 'SubAdmin'],
            required: true
        }
    },
    messageType: {
        type: String,
        enum: ['text', 'image', 'file', 'system'],
        default: 'text'
    },
    content: {
        type: String,
        required: function() {
            return this.messageType === 'text' || this.messageType === 'system';
        },
        maxlength: 1000
    },
    fileUrl: {
        type: String,
        required: function() {
            return this.messageType === 'image' || this.messageType === 'file';
        }
    },
    fileName: {
        type: String
    },
    fileSize: {
        type: Number
    },
    reactions: [{
        user: {
            type: mongoose.Schema.Types.ObjectId,
            refPath: 'reactions.userType'
        },
        userType: {
            type: String,
            enum: ['User', 'SubAdmin']
        },
        emoji: {
            type: String,
            required: true
        },
        createdAt: {
            type: Date,
            default: Date.now
        }
    }],
    isEdited: {
        type: Boolean,
        default: false
    },
    editedAt: {
        type: Date
    },
    isDeleted: {
        type: Boolean,
        default: false
    },
    deletedAt: {
        type: Date
    },
    readBy: [{
        user: {
            type: mongoose.Schema.Types.ObjectId,
            refPath: 'readBy.userType'
        },
        userType: {
            type: String,
            enum: ['User', 'SubAdmin']
        },
        readAt: {
            type: Date,
            default: Date.now
        }
    }]
}, {
    timestamps: true
});

// Index for efficient queries
messageSchema.index({ chatGroup: 1, createdAt: -1 });
messageSchema.index({ 'sender.user': 1 });
messageSchema.index({ messageType: 1 });
messageSchema.index({ isDeleted: 1 });

// Virtual for reaction count
messageSchema.virtual('reactionCount').get(function() {
    return this.reactions ? this.reactions.length : 0;
});

// Virtual for unique reaction types
messageSchema.virtual('reactionSummary').get(function() {
    if (!this.reactions || this.reactions.length === 0) return {};
    
    const summary = {};
    this.reactions.forEach(reaction => {
        if (summary[reaction.emoji]) {
            summary[reaction.emoji]++;
        } else {
            summary[reaction.emoji] = 1;
        }
    });
    return summary;
});

// Ensure virtual fields are serialized
messageSchema.set('toJSON', { virtuals: true });
messageSchema.set('toObject', { virtuals: true });

export const Message = mongoose.model("Message", messageSchema);
