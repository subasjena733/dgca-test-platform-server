const express = require("express");

const router = express.Router();

const { protect } = require("../middleware/authMiddleware");
const { adminOnly } = require("../middleware/roleMiddleware");

const {
  getSubjects,
  addSubject,
} = require("../controllers/subjectController");


router.get(
  "/",
  protect,
  adminOnly,
  getSubjects
);

router.post(
  "/",
  protect,
  adminOnly,
  addSubject
);

module.exports = router;