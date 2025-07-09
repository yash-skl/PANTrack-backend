import { Router } from "express";
import {
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
} from "../controllers/chat.controllers.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { upload } from "../middlewares/multer.middleware.js";

const router = Router();

// Apply authentication middleware to all routes
router.use(verifyJWT);

// Chat group management routes
router.route("/groups").post(createChatGroup).get(getUserChatGroups);
router.route("/groups/:groupId/messages").get(getChatMessages);
router.route("/groups/:groupId/messages").post(sendMessage);
router.route("/groups/:groupId/messages/file").post(upload.single("file"), sendMessageWithFile);

// Group member management
router.route("/groups/:groupId/members").post(addMembersToGroup);
router.route("/groups/:groupId/members/:memberId").delete(removeMemberFromGroup);

// Message interactions
router.route("/messages/:messageId/reactions").post(addReaction);

// Admin management routes
router.route("/groups/:groupId/manage").patch(manageChatGroup);

// Utility routes
router.route("/members/available").get(getAvailableMembers);

export default router;
