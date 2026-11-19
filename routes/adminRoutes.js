const express = require("express");
const router = express.Router();

const { protect } = require("../middleware/authMiddleware");
const { adminOnly } = require("../middleware/roleMiddleware");
const {
  getAdminAnalytics,
  getAdminStudents,
  getAdminStudentDetails,
  updateStudentPremiumStatus
} = require("../controllers/adminController");
const { getPendingRegistrations, approveRegistration, rejectRegistration, 
     getPasswordResetRequests, rejectPasswordReset,resetPasswordByAdmin
} = require("../controllers/authController");

router.get("/analytics", protect, adminOnly, getAdminAnalytics);
router.get("/students", protect, adminOnly, getAdminStudents);
router.get("/students/:studentId", protect, adminOnly, getAdminStudentDetails);
router.patch("/students/:studentId/premium", protect, adminOnly, updateStudentPremiumStatus);
router.get("/pending-registrations", protect,adminOnly, getPendingRegistrations);
router.post("/approve-registration/:requestId",protect,adminOnly, approveRegistration);
router.delete("/reject-registration/:requestId", protect, adminOnly, rejectRegistration);

// Registration Requests
router.get("/pending-registrations", protect, adminOnly, getPendingRegistrations);
router.post("/approve-registration/:requestId", protect, adminOnly, approveRegistration);

// Password Reset Requests
router.get("/password-reset-requests",protect, adminOnly, getPasswordResetRequests);
router.post("/reset-password/:requestId", protect, adminOnly, resetPasswordByAdmin);
router.delete("/password-reset-request/:requestId", protect, adminOnly, rejectPasswordReset);

module.exports = router;
