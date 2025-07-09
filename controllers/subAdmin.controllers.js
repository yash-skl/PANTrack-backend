import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/apiError.js";
import { ApiResponse } from "../utils/apiResponse.js";
import { User } from "../models/user.models.js";
import { SubAdmin } from "../models/subAdmin.models.js";

// Create SubAdmin
const createSubAdmin = asyncHandler(async (req, res) => {
    try {
        console.log("Creating subadmin...");
        console.log("Request user:", req.user);
        console.log("Request body:", req.body);
        
        // Check if user is admin
        if (!req.user || req.user.role !== 'admin') {
            throw new ApiError(403, "Only admins can create subadmins");
        }
        
        const { name, email, password, permissions, assignedGroups } = req.body;
        
        if (!name || !email || !password || !permissions) {
            throw new ApiError(400, "All fields are required");
        }

        // Check if user with email already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            throw new ApiError(409, "User with this email already exists");
        }

        // Create user with subadmin role
        const user = await User.create({
            name,
            email,
            password,
            role: "subadmin"
        });

        console.log("User created:", user._id);

        // Create subadmin profile
        const subAdmin = await SubAdmin.create({
            user: user._id,
            permissions,
            assignedGroups: assignedGroups || [],
            createdBy: req.user._id
        });

        console.log("SubAdmin created:", subAdmin._id);



        const createdSubAdmin = await SubAdmin.findById(subAdmin._id)
            .populate("user", "name email createdAt")
            .populate("createdBy", "name email");

        return res.status(201).json(
            new ApiResponse(201, createdSubAdmin, "SubAdmin created successfully")
        );
    } catch (error) {
        console.error("Error in createSubAdmin:", error);
        throw new ApiError(500, "Error creating subadmin: " + error.message);
    }
});

// Get All SubAdmins
const getAllSubAdmins = asyncHandler(async (req, res) => {
    try {
        console.log("Fetching subadmins...");
        console.log("Request user:", req.user);
        
        // Check if user is admin
        if (!req.user || req.user.role !== 'admin') {
            throw new ApiError(403, "Only admins can view subadmins");
        }
        
        const subAdmins = await SubAdmin.find({})
            .populate("user", "name email createdAt")
            .populate("createdBy", "name email")
            .sort({ createdAt: -1 });

        console.log("Found subadmins:", subAdmins.length);

        return res.status(200).json(
            new ApiResponse(200, subAdmins, "SubAdmins retrieved successfully")
        );
    } catch (error) {
        console.error("Error in getAllSubAdmins:", error);
        throw new ApiError(500, "Error fetching subadmins: " + error.message);
    }
});

// Get SubAdmin by ID
const getSubAdminById = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const subAdmin = await SubAdmin.findById(id)
        .populate("user", "name email createdAt")
        .populate("createdBy", "name email");

    if (!subAdmin) {
        throw new ApiError(404, "SubAdmin not found");
    }

    return res.status(200).json(
        new ApiResponse(200, subAdmin, "SubAdmin retrieved successfully")
    );
});

// Update SubAdmin
const updateSubAdmin = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { name, permissions, assignedGroups } = req.body;

    const subAdmin = await SubAdmin.findById(id).populate("user");
    if (!subAdmin) {
        throw new ApiError(404, "SubAdmin not found");
    }

    // Update user details if name is provided
    if (name) {
        await User.findByIdAndUpdate(subAdmin.user._id, { name });
    }

    // Update subadmin details
    const updateData = {};
    if (permissions) updateData.permissions = permissions;
    if (assignedGroups) updateData.assignedGroups = assignedGroups;

    const updatedSubAdmin = await SubAdmin.findByIdAndUpdate(
        id,
        updateData,
        { new: true }
    ).populate("user", "name email").populate("createdBy", "name email");

    return res.status(200).json(
        new ApiResponse(200, updatedSubAdmin, "SubAdmin updated successfully")
    );
});

// Delete SubAdmin 
const deleteSubAdmin = asyncHandler(async (req, res) => {
    try {
        const { id } = req.params;

        // Check if user is admin
        if (!req.user || req.user.role !== 'admin') {
            throw new ApiError(403, "Only admins can delete subadmins");
        }

        const subAdmin = await SubAdmin.findById(id).populate("user");
        if (!subAdmin) {
            throw new ApiError(404, "SubAdmin not found");
        }

      
        if (!subAdmin.user) {
            // If user is already deleted, just remove the SubAdmin record
            await SubAdmin.findByIdAndDelete(id);
            console.log(`SubAdmin record ${id} cleaned up (user was already deleted)`);
            return res.status(200).json(
                new ApiResponse(200, {}, "SubAdmin record cleaned up (user was already deleted)")
            );
        }

        const subAdminUserName = subAdmin.user.name;
        const subAdminUserId = subAdmin.user._id;

      
        await SubAdmin.findByIdAndDelete(id);

       
        await User.findByIdAndDelete(subAdminUserId);

        console.log(`SubAdmin ${subAdminUserName} and associated user account permanently deleted`);

        return res.status(200).json(
            new ApiResponse(200, {}, "SubAdmin and user account permanently deleted from database")
        );
    } catch (error) {
        console.error("Error in deleteSubAdmin:", error);
        throw new ApiError(500, "Error deleting subadmin: " + error.message);
    }
});







// Login SubAdmin
const loginSubAdmin = asyncHandler(async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email) {
            throw new ApiError(400, "Email is required.");
        }

        const user = await User.findOne({ email });

        if (!user) {
            throw new ApiError(404, "SubAdmin does not exist.");
        }

        const isPasswordValid = await user.isPasswordCorrect(password);
        if (!isPasswordValid) {
            throw new ApiError(401, "Invalid SubAdmin Credentials.");
        }

        // Check if user is actually a subadmin
        const subAdmin = await SubAdmin.findOne({ user: user._id })
            .populate("user", "name email")
            .populate("createdBy", "name email");

        if (!subAdmin) {
            throw new ApiError(400, "User is not a subadmin.");
        }

        const generateAccessAndRefreshToken = async (userId) => {
            try {
                const user = await User.findById(userId);
                const accessToken = user.generateAccessToken();
                const refreshToken = user.generateRefreshToken();

                user.refreshToken = refreshToken;
                await user.save({ validateBeforeSave: false });

                return { accessToken, refreshToken };
            } catch (error) {
                throw new ApiError(500, "Something went wrong while generating tokens");
            }
        };

        const { accessToken, refreshToken } = await generateAccessAndRefreshToken(user._id);

        const loggedInUser = await User.findById(user._id).select("-password -refreshToken");

        const cookieOptions = {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "None",
            expires: new Date(Date.now() + 24 * 60 * 60 * 1000)
        };

        res.cookie("accessToken", accessToken, cookieOptions);
        res.cookie("refreshToken", refreshToken, cookieOptions);

        return res.status(200).json({
            success: true,
            user: {
                ...loggedInUser.toObject(),
                role: 'subadmin',
                subAdminData: {
                    permissions: subAdmin.permissions,
                    assignedGroups: subAdmin.assignedGroups
                }
            },
            accessToken,
            refreshToken,
            message: `SubAdmin logged in successfully, welcome ${user.name}`,
        });

    } catch (error) {
        return res
            .status(error.statusCode || 500)
            .json(new ApiError(error.statusCode || 500, error.message));
    }
});

export {
    createSubAdmin,
    getAllSubAdmins,
    getSubAdminById,
    updateSubAdmin,
    deleteSubAdmin,
    loginSubAdmin
}; 