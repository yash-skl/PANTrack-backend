import { asyncHandler } from "../utils/asyncHandler.js";
import { User } from "../models/user.models.js";
import { SubAdmin } from "../models/subAdmin.models.js";
import jwt from 'jsonwebtoken';

export const verifyJWT = asyncHandler(async (req, res, next) => {
    console.log("Cookies received:", req.cookies);  
    console.log("Authorization Header:", req.header("Authorization"));  

    const token = req.cookies?.accessToken || req.header("Authorization")?.replace("Bearer ", "");

    console.log("Extracted Token:", token);  

    if (!token) {
        return res.status(401).json({ message: "Unauthorized Request - No token provided" });
    }

    try {
        const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
        const user = await User.findById(decodedToken._id).select("-password -refreshToken");

        if (!user) {
            return res.status(401).json({ message: "Invalid Access Token" });
        }

        // If user is a subadmin, get the SubAdmin data
        if (user.role === 'subadmin') {
            const subAdmin = await SubAdmin.findOne({ user: user._id });
            if (subAdmin) {
                user.subAdminData = subAdmin;
            }
        }

        req.user = user;
        next();
    } catch (error) {
        console.error("JWT Verification Failed:", error.message);
        return res.status(401).json({ message: "Invalid Access Token" });
    }
});
