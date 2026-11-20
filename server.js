const express = require("express");
const cors = require("cors");
require("dotenv").config();

const connectDB = require("./config/db");
const questionRoutes = require("./routes/questionRoutes");
const testRoutes = require("./routes/testRoutes");
const mockTestRoutes = require("./routes/mockTestRoutes");
const authRoutes = require("./routes/authRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const adminRoutes = require("./routes/adminRoutes");
const subjectRoutes = require("./routes/subjectRoutes");
const lessonRoutes = require("./routes/lessonRoutes");

const app = express();
// Middleware
app.use(cors());
app.use(express.json());

//Mongo DB connection via Config/db.js
connectDB();

// Routes
app.use("/api/questions", questionRoutes);
app.use("/api/tests", testRoutes);
app.use("/api/mock-tests", mockTestRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/subjects", subjectRoutes);
app.use("/api/lessons", lessonRoutes);

// Test Route
app.get("/", (req, res) => {
  res.send("DGCA API Running");
});

//Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
