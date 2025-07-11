import { Message } from "../models/message.models.js";
import { User } from "../models/user.models.js";
import { SubAdmin } from "../models/subAdmin.models.js";

/**
 * Populate message with proper sender information
 * Handles both User and SubAdmin sender types correctly
 */
export const populateMessageSender = async (messageId) => {
    const message = await Message.findById(messageId).lean();
    if (!message) return null;

    // Populate sender based on userType
    if (message.sender.userType === 'SubAdmin') {
        // For SubAdmin, get the SubAdmin document and populate its user reference
        const subAdmin = await SubAdmin.findById(message.sender.user).populate('user', 'name email').lean();
        if (subAdmin && subAdmin.user) {
            message.sender.user = {
                _id: subAdmin._id,
                name: subAdmin.user.name,
                email: subAdmin.user.email
            };
        }
    } else {
        // For User, populate directly
        const user = await User.findById(message.sender.user, 'name email').lean();
        if (user) {
            message.sender.user = user;
        }
    }

    return message;
};

/**
 * Populate multiple messages with proper sender information
 */
export const populateMessagesSender = async (messages) => {
    const populatedMessages = await Promise.all(
        messages.map(async (message) => {
            const messageObj = message.toObject ? message.toObject() : message;
            
            // Populate sender based on userType
            if (messageObj.sender.userType === 'SubAdmin') {
                const subAdmin = await SubAdmin.findById(messageObj.sender.user).populate('user', 'name email').lean();
                if (subAdmin && subAdmin.user) {
                    messageObj.sender.user = {
                        _id: subAdmin._id,
                        name: subAdmin.user.name,
                        email: subAdmin.user.email
                    };
                }
            } else {
                const user = await User.findById(messageObj.sender.user, 'name email').lean();
                if (user) {
                    messageObj.sender.user = user;
                }
            }

            return messageObj;
        })
    );

    return populatedMessages;
};

/**
 * Get messages for a chat group with proper sender population
 */
export const getPopulatedMessages = async (chatGroupId, page = 1, limit = 50) => {
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const messages = await Message.find({
        chatGroup: chatGroupId,
        isDeleted: false
    })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit))
    .lean();

    const populatedMessages = await populateMessagesSender(messages);
    
    return populatedMessages.reverse(); // Reverse to show oldest first
}; 