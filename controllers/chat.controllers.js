import { ChatGroup } from "../models/chatGroup.models.js";
import { Message } from "../models/message.models.js";
import { SubAdmin } from "../models/subAdmin.models.js";
import { User } from "../models/user.models.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/apiError.js";
import { ApiResponse } from "../utils/apiResponse.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { getPopulatedMessages, populateMessageSender } from "../utils/messageUtils.js";

// Create a new chat group
const createChatGroup = asyncHandler(async (req, res) => {
    const { name, description, type = 'private', memberIds = [] } = req.body;
    const { user } = req;

    if (!name || name.trim().length === 0) {
        throw new ApiError(400, "Group name is required");
    }

    // Determine user type and ID
    let userType, userId;
    if (user.role === 'subadmin') {
        userType = 'SubAdmin';
        userId = user.subAdminData._id;
    } else if (user.role === 'admin') {
        userType = 'User'; // Admins are stored as Users with role 'admin'
        userId = user._id;
    } else {
        userType = 'User';
        userId = user._id;
    }

    // Prepare members array with creator as admin
    const members = [{
        user: userId,
        userType: userType,
        role: 'admin'
    }];

    // Add other members if provided
    if (memberIds.length > 0) {
        for (const memberId of memberIds) {
            // Check if member is SubAdmin first
            const subAdmin = await SubAdmin.findById(memberId);
            if (subAdmin) {
                members.push({
                    user: memberId,
                    userType: 'SubAdmin',
                    role: 'member'
                });
            } else {
                // Check if it's a User (including admins)
                const userExists = await User.findById(memberId);
                if (userExists) {
                    members.push({
                        user: memberId,
                        userType: 'User',
                        role: 'member'
                    });
                }
            }
        }
    }

    const chatGroup = await ChatGroup.create({
        name: name.trim(),
        description: description?.trim(),
        type,
        members,
        createdBy: {
            user: userId,
            userType: userType
        }
    });

    // Populate the created group
    const populatedGroup = await ChatGroup.findById(chatGroup._id)
        .populate('members.user', 'name email')
        .populate('createdBy.user', 'name email');

    return res.status(201).json(
        new ApiResponse(201, populatedGroup, "Chat group created successfully")
    );
});

// Get user's chat groups
const getUserChatGroups = asyncHandler(async (req, res) => {
    const { user } = req;
    
    let userType, userId;
    if (user.role === 'subadmin') {
        userType = 'SubAdmin';
        userId = user.subAdminData._id;
    } else if (user.role === 'admin') {
        userType = 'User'; // Admins are stored as Users with role 'admin'
        userId = user._id;
    } else {
        userType = 'User';
        userId = user._id;
    }

    let chatGroups;

    if (user.role === 'admin') {
        // Admin can see all chat groups
        chatGroups = await ChatGroup.find({ isActive: true })
            .populate('members.user', 'name email')
            .populate('createdBy.user', 'name email')
            .populate('lastMessage')
            .sort({ lastActivity: -1 });
    } else {
        // SubAdmins and Users see only their groups
        chatGroups = await ChatGroup.find({
            'members.user': userId,
            'members.userType': userType,
            isActive: true
        })
        .populate('members.user', 'name email')
        .populate('createdBy.user', 'name email')
        .populate('lastMessage')
        .sort({ lastActivity: -1 });
    }

    return res.status(200).json(
        new ApiResponse(200, chatGroups, "Chat groups retrieved successfully")
    );
});

// Get messages for a specific chat group
const getChatMessages = asyncHandler(async (req, res) => {
    const { groupId } = req.params;
    const { page = 1, limit = 50 } = req.query;
    const { user } = req;

    let userType, userId;
    if (user.role === 'subadmin') {
        userType = 'SubAdmin';
        userId = user.subAdminData._id;
    } else if (user.role === 'admin') {
        userType = 'User'; // Admins are stored as Users with role 'admin'
        userId = user._id;
    } else {
        userType = 'User';
        userId = user._id;
    }

    // Check if user has access to this group (admin can access all groups)
    if (user.role !== 'admin') {
        const hasAccess = await ChatGroup.findOne({
            _id: groupId,
            'members.user': userId,
            'members.userType': userType,
            isActive: true
        });

        if (!hasAccess) {
            throw new ApiError(403, "You don't have access to this chat group");
        }
    }

    const messages = await getPopulatedMessages(groupId, page, limit);

    const totalMessages = await Message.countDocuments({
        chatGroup: groupId,
        isDeleted: false
    });

    return res.status(200).json(
        new ApiResponse(200, {
            messages,
            totalMessages,
            currentPage: parseInt(page),
            totalPages: Math.ceil(totalMessages / parseInt(limit))
        }, "Messages retrieved successfully")
    );
});

// Send a message
const sendMessage = asyncHandler(async (req, res) => {
    const { groupId } = req.params;
    const { content, messageType = 'text' } = req.body;
    const { user } = req;

    let userType, userId;
    if (user.role === 'subadmin') {
        userType = 'SubAdmin';
        userId = user.subAdminData._id;
    } else if (user.role === 'admin') {
        userType = 'User'; // Admins are stored as Users with role 'admin'
        userId = user._id;
    } else {
        userType = 'User';
        userId = user._id;
    }

    // Check if user has access to this group
    const chatGroup = await ChatGroup.findOne({
        _id: groupId,
        'members.user': userId,
        'members.userType': userType,
        isActive: true,
        isMuted: false
    });

    if (!chatGroup) {
        throw new ApiError(403, "You don't have access to this chat group or it's muted");
    }

    if (!content || content.trim().length === 0) {
        throw new ApiError(400, "Message content is required");
    }

    const message = await Message.create({
        chatGroup: groupId,
        sender: {
            user: userId,
            userType: userType
        },
        messageType,
        content: content.trim()
    });

    // Update group's last activity and last message
    await ChatGroup.findByIdAndUpdate(groupId, {
        lastMessage: message._id,
        lastActivity: new Date()
    });

    // Populate the message with proper sender information
    const populatedMessage = await populateMessageSender(message._id);

    return res.status(201).json(
        new ApiResponse(201, populatedMessage, "Message sent successfully")
    );
});

// Send message with file upload
const sendMessageWithFile = asyncHandler(async (req, res) => {
    const { groupId } = req.params;
    const { messageType = 'image' } = req.body;
    const { user } = req;

    let userType, userId;
    if (user.role === 'subadmin') {
        userType = 'SubAdmin';
        userId = user.subAdminData._id;
    } else if (user.role === 'admin') {
        userType = 'User'; // Admins are stored as Users with role 'admin'
        userId = user._id;
    } else {
        userType = 'User';
        userId = user._id;
    }

    // Check if user has access to this group
    const chatGroup = await ChatGroup.findOne({
        _id: groupId,
        'members.user': userId,
        'members.userType': userType,
        isActive: true,
        isMuted: false
    });

    if (!chatGroup) {
        throw new ApiError(403, "You don't have access to this chat group or it's muted");
    }

    if (!req.file) {
        throw new ApiError(400, "File is required");
    }

    // Upload file to cloudinary
    const fileUpload = await uploadOnCloudinary(req.file.path);
    if (!fileUpload) {
        throw new ApiError(500, "Failed to upload file");
    }

    const message = await Message.create({
        chatGroup: groupId,
        sender: {
            user: userId,
            userType: userType
        },
        messageType,
        fileUrl: fileUpload.url,
        fileName: req.file.originalname,
        fileSize: req.file.size
    });

    // Update group's last activity and last message
    await ChatGroup.findByIdAndUpdate(groupId, {
        lastMessage: message._id,
        lastActivity: new Date()
    });

    // Populate the message with proper sender information
    const populatedMessage = await populateMessageSender(message._id);

    return res.status(201).json(
        new ApiResponse(201, populatedMessage, "File message sent successfully")
    );
});

// Add members to chat group
const addMembersToGroup = asyncHandler(async (req, res) => {
    const { groupId } = req.params;
    const { memberIds } = req.body;
    const { user } = req;

    let userType, userId;
    if (user.role === 'subadmin') {
        userType = 'SubAdmin';
        userId = user.subAdminData._id;
    } else if (user.role === 'admin') {
        userType = 'User'; // Admins are stored as Users with role 'admin'
        userId = user._id;
    } else {
        userType = 'User';
        userId = user._id;
    }

    // Check if user is admin of the group
    const chatGroup = await ChatGroup.findOne({
        _id: groupId,
        $or: [
            { 'members.user': userId, 'members.userType': userType, 'members.role': 'admin' },
            { 'createdBy.user': userId, 'createdBy.userType': userType }
        ],
        isActive: true
    });

    if (!chatGroup) {
        throw new ApiError(403, "Only group admins can add members");
    }

    const newMembers = [];
    for (const memberId of memberIds) {
        // Check if already a member
        const isAlreadyMember = chatGroup.members.some(
            member => member.user.toString() === memberId.toString()
        );
        
        if (!isAlreadyMember) {
            // Determine if member is SubAdmin or User
            const subAdmin = await SubAdmin.findById(memberId);
            if (subAdmin) {
                newMembers.push({
                    user: memberId,
                    userType: 'SubAdmin',
                    role: 'member'
                });
            } else {
                const userExists = await User.findById(memberId);
                if (userExists) {
                    newMembers.push({
                        user: memberId,
                        userType: 'User',
                        role: 'member'
                    });
                }
            }
        }
    }

    if (newMembers.length > 0) {
        await ChatGroup.findByIdAndUpdate(groupId, {
            $push: { members: { $each: newMembers } },
            lastActivity: new Date()
        });

        // Create system message
        const systemMessage = await Message.create({
            chatGroup: groupId,
            sender: {
                user: userId,
                userType: userType
            },
            messageType: 'system',
            content: `${newMembers.length} member(s) added to the group`
        });

        await ChatGroup.findByIdAndUpdate(groupId, {
            lastMessage: systemMessage._id
        });
    }

    return res.status(200).json(
        new ApiResponse(200, { addedCount: newMembers.length }, "Members added successfully")
    );
});

// Remove member from chat group
const removeMemberFromGroup = asyncHandler(async (req, res) => {
    const { groupId, memberId } = req.params;
    const { user } = req;

    let userType, userId;
    if (user.role === 'subadmin') {
        userType = 'SubAdmin';
        userId = user.subAdminData._id;
    } else if (user.role === 'admin') {
        userType = 'User'; // Admins are stored as Users with role 'admin'
        userId = user._id;
    } else {
        userType = 'User';
        userId = user._id;
    }

    // Check if user is admin of the group
    const chatGroup = await ChatGroup.findOne({
        _id: groupId,
        $or: [
            { 'members.user': userId, 'members.userType': userType, 'members.role': 'admin' },
            { 'createdBy.user': userId, 'createdBy.userType': userType }
        ],
        isActive: true
    });

    if (!chatGroup) {
        throw new ApiError(403, "Only group admins can remove members");
    }

    await ChatGroup.findByIdAndUpdate(groupId, {
        $pull: { members: { user: memberId } },
        lastActivity: new Date()
    });

    // Create system message
    const systemMessage = await Message.create({
        chatGroup: groupId,
        sender: {
            user: userId,
            userType: userType
        },
        messageType: 'system',
        content: 'A member was removed from the group'
    });

    await ChatGroup.findByIdAndUpdate(groupId, {
        lastMessage: systemMessage._id
    });

    return res.status(200).json(
        new ApiResponse(200, {}, "Member removed successfully")
    );
});

// Add reaction to message
const addReaction = asyncHandler(async (req, res) => {
    const { messageId } = req.params;
    const { emoji } = req.body;
    const { user } = req;

    let userType, userId;
    if (user.role === 'subadmin') {
        userType = 'SubAdmin';
        userId = user.subAdminData._id;
    } else if (user.role === 'admin') {
        userType = 'User'; // Admins are stored as Users with role 'admin'
        userId = user._id;
    } else {
        userType = 'User';
        userId = user._id;
    }

    if (!emoji) {
        throw new ApiError(400, "Emoji is required");
    }

    const message = await Message.findById(messageId);
    if (!message) {
        throw new ApiError(404, "Message not found");
    }

    // Check if user already reacted with this emoji
    const existingReaction = message.reactions.find(
        reaction => reaction.user.toString() === userId.toString() && reaction.emoji === emoji
    );

    if (existingReaction) {
        // Remove existing reaction
        await Message.findByIdAndUpdate(messageId, {
            $pull: { reactions: { user: userId, emoji } }
        });
    } else {
        // Add new reaction
        await Message.findByIdAndUpdate(messageId, {
            $push: {
                reactions: {
                    user: userId,
                    userType: userType,
                    emoji
                }
            }
        });
    }

    const updatedMessage = await populateMessageSender(messageId);

    return res.status(200).json(
        new ApiResponse(200, updatedMessage, "Reaction updated successfully")
    );
});

// Admin-only: Delete/Mute chat group
const manageChatGroup = asyncHandler(async (req, res) => {
    const { groupId } = req.params;
    const { action, isMuted } = req.body; // action: 'delete' or 'mute'
    const { user } = req;

    if (user.role !== 'admin') {
        throw new ApiError(403, "Only admins can manage chat groups");
    }

    const chatGroup = await ChatGroup.findById(groupId);
    if (!chatGroup) {
        throw new ApiError(404, "Chat group not found");
    }

    if (action === 'delete') {
        await ChatGroup.findByIdAndUpdate(groupId, { isActive: false });
        return res.status(200).json(
            new ApiResponse(200, {}, "Chat group deleted successfully")
        );
    } else if (action === 'mute') {
        await ChatGroup.findByIdAndUpdate(groupId, { isMuted });
        return res.status(200).json(
            new ApiResponse(200, {}, `Chat group ${isMuted ? 'muted' : 'unmuted'} successfully`)
        );
    }

    throw new ApiError(400, "Invalid action specified");
});

// Get available users/subadmins for adding to groups
const getAvailableMembers = asyncHandler(async (req, res) => {
    const { user } = req;
    
    // Get all SubAdmins with populated user data
    const subAdmins = await SubAdmin.find({}).populate('user', 'name email');
    const formattedSubAdmins = subAdmins.map(subAdmin => ({
        _id: subAdmin._id,
        name: subAdmin.user?.name,
        email: subAdmin.user?.email,
        type: 'SubAdmin'
    }));

    let formattedUsers = [];
    let formattedAdmins = [];

    if (user.role === 'admin') {
        // Include regular users (non-admin users)
        const users = await User.find({ role: 'user' }, 'name email');
        formattedUsers = users.map(userDoc => ({
            _id: userDoc._id,
            name: userDoc.name,
            email: userDoc.email,
            type: 'User'
        }));

        // Include all admins (including current admin for group creation)
        const admins = await User.find({ role: 'admin' }, 'name email');
        formattedAdmins = admins.map(admin => ({
            _id: admin._id,
            name: admin.name,
            email: admin.email,
            type: 'Admin'
        }));
    }

    const availableMembers = [...formattedSubAdmins, ...formattedUsers, ...formattedAdmins];

    return res.status(200).json(
        new ApiResponse(200, availableMembers, "Available members retrieved successfully")
    );
});

export {
    createChatGroup,
    getUserChatGroups,
    getChatMessages,
    sendMessage,
    sendMessageWithFile,
    addMembersToGroup,
    removeMemberFromGroup,
    addReaction,
    manageChatGroup,
    getAvailableMembers
};
