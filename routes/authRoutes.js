const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");

const { registerUser, loginUser, changePassword, getProfile, requestPasswordReset } = require("../controllers/authController");

router.post("/register", registerUser);
router.post("/login", loginUser);
router.put("/change-password", protect, changePassword);
router.get("/profile", protect, getProfile);
router.post("/request-password-reset", requestPasswordReset);

module.exports = router;