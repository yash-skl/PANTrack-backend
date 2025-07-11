import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import { User } from "./models/user.models.js";
import { SubAdmin } from "./models/subAdmin.models.js";
import { ChatGroup } from "./models/chatGroup.models.js";
import { Message } from "./models/message.models.js";
import { ALLOWED_ORIGINS } from "./constants.js";

const setupSocketIO = (server) => {
    const io = new Server(server, {
        cors: {
            origin: ALLOWED_ORIGINS,
            credentials: true,
            methods: ["GET", "POST"]
        }
    });

    // Socket authentication middleware
    io.use(async (socket, next) => {
        try {
            const token = socket.handshake.auth.token;
            if (!token) {
                throw new Error("Authentication token required");
            }

            const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
            
            // Get user data based on role
            let user = await User.findById(decodedToken._id).select("-password -refreshToken");
            if (!user) {
                throw new Error("User not found");
            }

            // If user is a subadmin, get the SubAdmin data
            if (user.role === 'subadmin') {
                const subAdmin = await SubAdmin.findOne({ user: user._id });
                if (!subAdmin) {
                    throw new Error("SubAdmin profile not found");
                }
                user = {
                    ...user.toObject(),
                    role: 'subadmin',
                    subAdminData: subAdmin
                };
            }

            socket.user = user;
            next();
        } catch (error) {
            console.error("Socket authentication error:", error.message);
            next(new Error("Authentication failed"));
        }
    });

    // Store connected users
    const connectedUsers = new Map();

    io.on("connection", (socket) => {
        console.log(`User connected: ${socket.user._id} (${socket.user.role})`);
        
        // Store user socket mapping
        const userKey = `${socket.user._id}_${socket.user.role}`;
        connectedUsers.set(userKey, socket.id);

        // Join user to their chat groups
        socket.on("join_groups", async () => {
            try {
                let userType, userId;
                if (socket.user.role === 'subadmin') {
                    userType = 'SubAdmin';
                    userId = socket.user.subAdminData._id;
                } else if (socket.user.role === 'admin') {
                    userType = 'User'; // Admins are stored as Users with role 'admin'
                    userId = socket.user._id;
                } else {
                    userType = 'User';
                    userId = socket.user._id;
                }

                let chatGroups;
                if (socket.user.role === 'admin') {
                    // Admin can join all active groups
                    chatGroups = await ChatGroup.find({ isActive: true });
                } else {
                    // Get user's chat groups
                    chatGroups = await ChatGroup.find({
                        'members.user': userId,
                        'members.userType': userType,
                        isActive: true
                    });
                }

                chatGroups.forEach(group => {
                    socket.join(group._id.toString());
                });

                socket.emit("groups_joined", { count: chatGroups.length });
            } catch (error) {
                console.error("Error joining groups:", error);
                socket.emit("error", { message: "Failed to join chat groups" });
            }
        });

        // Handle sending messages
        socket.on("send_message", async (data) => {
            try {
                const { groupId, content, messageType = 'text' } = data;
                
                let userType, userId;
                if (socket.user.role === 'subadmin') {
                    userType = 'SubAdmin';
                    userId = socket.user.subAdminData._id;
                } else if (socket.user.role === 'admin') {
                    userType = 'User'; // Admins are stored as Users with role 'admin'
                    userId = socket.user._id;
                } else {
                    userType = 'User';
                    userId = socket.user._id;
                }

                // Verify user has access to the group
                const chatGroup = await ChatGroup.findOne({
                    _id: groupId,
                    'members.user': userId,
                    'members.userType': userType,
                    isActive: true,
                    isMuted: false
                });

                if (!chatGroup) {
                    socket.emit("error", { message: "Access denied or group is muted" });
                    return;
                }

                // Create message
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

                // Populate the message
                const populatedMessage = await Message.findById(message._id)
                    .populate('sender.user', 'name email');

                // Emit to all users in the group
                io.to(groupId).emit("new_message", populatedMessage);

            } catch (error) {
                console.error("Error sending message:", error);
                socket.emit("error", { message: "Failed to send message" });
            }
        });

        // Handle message reactions
        socket.on("add_reaction", async (data) => {
            try {
                const { messageId, emoji } = data;
                
                let userType, userId;
                if (socket.user.role === 'subadmin') {
                    userType = 'SubAdmin';
                    userId = socket.user.subAdminData._id;
                } else if (socket.user.role === 'admin') {
                    userType = 'User'; // Admins are stored as Users with role 'admin'
                    userId = socket.user._id;
                } else {
                    userType = 'User';
                    userId = socket.user._id;
                }

                const message = await Message.findById(messageId);
                if (!message) {
                    socket.emit("error", { message: "Message not found" });
                    return;
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

                const updatedMessage = await Message.findById(messageId)
                    .populate('sender.user', 'name email');

                // Emit to all users in the group
                io.to(message.chatGroup.toString()).emit("message_updated", updatedMessage);

            } catch (error) {
                console.error("Error updating reaction:", error);
                socket.emit("error", { message: "Failed to update reaction" });
            }
        });

        // Handle typing indicators
        socket.on("typing_start", (data) => {
            const { groupId } = data;
            socket.to(groupId).emit("user_typing", {
                userId: socket.user._id,
                userName: socket.user.name || socket.user.subAdminData?.name,
                isTyping: true
            });
        });

        socket.on("typing_stop", (data) => {
            const { groupId } = data;
            socket.to(groupId).emit("user_typing", {
                userId: socket.user._id,
                userName: socket.user.name || socket.user.subAdminData?.name,
                isTyping: false
            });
        });

        // Handle joining specific group
        socket.on("join_group", (data) => {
            const { groupId } = data;
            socket.join(groupId);
            socket.emit("joined_group", { groupId });
        });

        // Handle leaving specific group
        socket.on("leave_group", (data) => {
            const { groupId } = data;
            socket.leave(groupId);
            socket.emit("left_group", { groupId });
        });

        // Handle group updates (new member added, etc.)
        socket.on("group_updated", (data) => {
            const { groupId, updateType, message } = data;
            io.to(groupId).emit("group_update", {
                groupId,
                updateType,
                message,
                timestamp: new Date()
            });
        });

        // Handle disconnect
        socket.on("disconnect", () => {
            console.log(`User disconnected: ${socket.user._id} (${socket.user.role})`);
            const userKey = `${socket.user._id}_${socket.user.role}`;
            connectedUsers.delete(userKey);
        });
    });

    // Function to send notification to specific user
    const sendToUser = (userId, userType, event, data) => {
        const userKey = `${userId}_${userType.toLowerCase()}`;
        const socketId = connectedUsers.get(userKey);
        if (socketId) {
            io.to(socketId).emit(event, data);
        }
    };

    // Function to send to all users in a group
    const sendToGroup = (groupId, event, data) => {
        io.to(groupId).emit(event, data);
    };

    // Expose functions for use in controllers
    io.sendToUser = sendToUser;
    io.sendToGroup = sendToGroup;

    return io;
};

export default setupSocketIO;
