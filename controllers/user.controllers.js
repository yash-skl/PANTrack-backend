import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/apiError.js";
import { User } from "../models/user.models.js";
import { ApiResponse } from "../utils/apiResponse.js";
import jwt from "jsonwebtoken";
import { uploadOnCloudinary } from "../utils/cloudinary.js";


const generateAccessAndRefreshToken = async (userId) => {
  try {
    const user = await User.findById(userId);
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    return { accessToken, refreshToken };
  } catch (error) {
    throw new ApiError(
      500,
      "Something went wrong while registering Access and RefreshToken"
    );
  }
};

// Register User
const registerUser = asyncHandler(async (req, res) => {
  const { name, email, password, role } = req.body;


  // Check if any fields are missing or empty
  if (
    [name, email, password, role].some(
      (field) => !field || field.trim() === ""
    )
  ) {
    throw new ApiError(400, "All fields are required");
  }

  // Email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new ApiError(400, "Invalid email format");
  }

  // Check if user already exists by email or phone number
  const existedUser = await User.findOne({
    email,
  });

  if (existedUser) {
    throw new ApiError(
      409,
      "User with this email already exists."
    );
  }

  let profilePhotoLocalPath;
  if (req.file) {
    profilePhotoLocalPath = req.file.path;
  }

  let profilePhoto = null;
  if (profilePhotoLocalPath) {
    profilePhoto = await uploadOnCloudinary(profilePhotoLocalPath);
  }

  // Create new user
  const user = await User.create({
    name,
    email,
    role,
    password,
    profile: {
      profilePhoto: profilePhoto?.url || "",
    },
  });

  // Exclude password and refreshToken from the response
  const createdUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  if (!createdUser) {
    throw new ApiError(500, "Something went wrong while registering the user");
  }


  res
    .status(201)
    .json({ success: true, message: "User registered successfully." });

});


// Login User
const loginUser = asyncHandler(async (req, res) => {
  try {
    const { email, password, role } = req.body;

    if (!email) {
      throw new ApiError(400, "Email is required.");
    }

    const user = await User.findOne({ email });

    if (!user) {
      throw new ApiError(404, "User does not exist.");
    }

    const isPasswordValid = await user.isPasswordCorrect(password);
    if (!isPasswordValid) {
      throw new ApiError(401, "Invalid User Credentials.");
    }

    if (role !== user.role) {
      throw new ApiError(400, "Invalid Role Credentials.");
    }

    const { accessToken, refreshToken } = await generateAccessAndRefreshToken(
      user._id
    );

    const loggedInUser = await User.findById(user._id).select(
      "-password -refreshToken"
    );

    
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
      user: loggedInUser,
      accessToken,
      refreshToken,
      message: `User logged in successfully, welcome ${user.name}`,
    });

  } catch (error) {
    return res
      .status(error.statusCode || 500)
      .json(new ApiError(error.statusCode || 500, error.message));
  }
});


// Get user by id
const getUserById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const user = await User.findById(id);

  if (!user) {
    throw new ApiError(404, "User not found");
  }
  res.status(200).json(new ApiResponse(200, user, "User fetched successfully"));
});


const getAllUsers = asyncHandler(async (req, res) => {
  const users = await User.find();

  if (!users || users.length === 0) {
      console.log("No users found in database!");
      throw new ApiError(404, "No users found.");
  }

  console.log("Users fetched successfully");
  res.status(200).json(new ApiResponse(200, users, "Users fetched successfully"));
});



const logoutUser = async (req, res) => {
  try {
      return res.status(200).cookie("token", "", { maxAge: 0 }).json({
          message: "Logged out successfully.",
          success: true
      })
  } catch (error) {
      console.log(error);
  }
}



export { registerUser, loginUser, logoutUser, getAllUsers, getUserById };
