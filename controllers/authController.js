const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const RegistrationRequest = require("../models/RegistrationRequest");
const PasswordResetRequest = require("../models/PasswordResetRequest");

const registerUser = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Already an approved user?
    const existingUser = await User.findOne({ email });

    if (existingUser) {
      return res.status(400).json({
        message: "User already exists"
      });
    }

    // Already waiting for approval?
    const existingRequest =
      await RegistrationRequest.findOne({
        email,
        status: "PENDING"
      });

    if (existingRequest) {
      return res.status(400).json({
        message:
          "Registration request already submitted. Please wait for admin approval."
      });
    }

    const hashedPassword = await bcrypt.hash(
      password,
      10
    );

    await RegistrationRequest.create({
      name,
      email,
      password: hashedPassword,
      role: "student",
      status: "PENDING"
    });

    res.status(201).json({
      message:
        "Registration submitted successfully. Awaiting admin approval."
    });
  } catch (error) {
    res.status(500).json({
      message: error.message
    });
  }
};

const getPendingRegistrations = async (req, res) => {
  try {
    const requests = await RegistrationRequest.find({
      status: "PENDING"
    }).sort({ createdAt: -1 });

    res.status(200).json(requests);
  } catch (error) {
    res.status(500).json({
      message: error.message
    });
  }
};

const approveRegistration = async (req, res) => {
  try {
    const { requestId } = req.params;

    const request = await RegistrationRequest.findById(requestId);

    if (!request) {
      return res.status(404).json({
        message: "Registration request not found"
      });
    }

    // Double check if user already exists
    const existingUser = await User.findOne({
      email: request.email
    });

    if (existingUser) {
      return res.status(400).json({
        message: "User already exists"
      });
    }

    // Create approved user
    const user = await User.create({
      name: request.name,
      email: request.email,
      password: request.password,
      role: request.role
    });

    // Delete pending request
    await RegistrationRequest.findByIdAndDelete(requestId);

    res.status(200).json({
      message: "Registration approved successfully",
      userId: user._id
    });

  } catch (error) {
    res.status(500).json({
      message: error.message
    });
  }
};

const rejectRegistration = async (req, res) => {
  try {
    const { requestId } = req.params;

    const request = await RegistrationRequest.findById(requestId);

    if (!request) {
      return res.status(404).json({
        message: "Registration request not found"
      });
    }

    await RegistrationRequest.findByIdAndDelete(requestId);

    res.status(200).json({
      message: "Registration rejected successfully"
    });

  } catch (error) {
    res.status(500).json({
      message: error.message
    });
  }
};

const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({
        message: "User not found"
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(400).json({
        message: "Invalid credentials"
      });
    }

    const token = jwt.sign(
      {
        userId: user._id,
        role: user.role,
        isPremium: user.isPremium
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.status(200).json({
      message: "Login successful",
      token,
      user: {
      userId: user._id,
      name: user.name,
      role: user.role,
      isPremium: user.isPremium
  }
    });

  } catch (error) {
    res.status(500).json({
      message: error.message
    });
  }
};

const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select("-password");

    if (!user) {
      return res.status(404).json({
        message: "User not found"
      });
    }

    res.status(200).json(user);

  } catch (error) {
    res.status(500).json({
      message: error.message
    });
  }
};

const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const user = await User.findById(req.user.userId);

    if (!user) {
      return res.status(404).json({
        message: "User not found"
      });
    }

    const isMatch = await bcrypt.compare(
      currentPassword,
      user.password
    );

    if (!isMatch) {
      return res.status(400).json({
        message: "Current password is incorrect"
      });
    }

    const hashedPassword = await bcrypt.hash(
      newPassword,
      10
    );

    user.password = hashedPassword;

    await user.save();

    res.status(200).json({
      message: "Password changed successfully"
    });

  } catch (error) {
    res.status(500).json({
      message: error.message
    });
  }
};

const requestPasswordReset = async (req, res) => {
  try {

    const { email } = req.body;

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({
        message: "User not found"
      });
    }

    const existingRequest =
      await PasswordResetRequest.findOne({
        email
      });

    if (existingRequest) {
      return res.status(400).json({
        message:
          "Password reset request already pending."
      });
    }

    await PasswordResetRequest.create({
      name: user.name,
      email: user.email
    });

    res.status(200).json({
      message:
        "Password reset request submitted successfully."
    });

  } catch (error) {
    res.status(500).json({
      message: error.message
    });
  }
};

const getPasswordResetRequests = async (req, res) => {
  try {

    const requests = await PasswordResetRequest.find()
      .sort({ createdAt: -1 });

    res.status(200).json(requests);

  } catch (error) {
    res.status(500).json({
      message: error.message
    });
  }
};

const rejectPasswordReset = async (req, res) => {
  try {

    const { requestId } = req.params;

    await PasswordResetRequest.findByIdAndDelete(requestId);

    res.status(200).json({
      message: "Request rejected."
    });

  } catch (error) {
    res.status(500).json({
      message: error.message
    });
  }
};

const resetPasswordByAdmin = async (req, res) => {
  try {

    const { requestId } = req.params;
    const { newPassword } = req.body;

    const request = await PasswordResetRequest.findById(requestId);

    if (!request) {
      return res.status(404).json({
        message: "Request not found"
      });
    }

    const user = await User.findOne({
      email: request.email
    });

    if (!user) {
      return res.status(404).json({
        message: "User not found"
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    user.password = hashedPassword;

    await user.save();

    await PasswordResetRequest.findByIdAndDelete(requestId);

    res.status(200).json({
      message: "Password reset successfully."
    });

  } catch (error) {
    res.status(500).json({
      message: error.message
    });
  }
};

module.exports = {
  registerUser,
  loginUser,
  getProfile,
  getPendingRegistrations,
  approveRegistration,
  rejectRegistration,
  changePassword,
  requestPasswordReset,
  getPasswordResetRequests,
  rejectPasswordReset,
  resetPasswordByAdmin
};