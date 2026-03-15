const mongoose = require("mongoose");
const dotenv = require("dotenv");
const path = require("path");

// Load environment variables from backend/.env
dotenv.config({ path: path.join(__dirname, "../../.env") });

// Import Models
const User = require("../models/User");
const Rubric = require("../models/Rubric");
const Timetable = require("../models/Timetable");
const Evaluation = require("../models/Evaluation");
const Attendance = require("../models/Attendance");

const seedDatabase = async () => {
  try {
    console.log("🌱 Starting Enterprise Database Seeding...");

    if (!process.env.MONGO_URI) {
      console.error("❌ MONGO_URI not found in .env file!");
      process.exit(1);
    }

    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB");

    // Clear existing data
    console.log("🗑️  Clearing existing data...");
    await User.deleteMany({});
    await Rubric.deleteMany({});
    await Timetable.deleteMany({});
    await Evaluation.deleteMany({});
    await Attendance.deleteMany({});

    // ==========================================
    // 1. CREATE USERS
    // ==========================================
    console.log("\n👥 Creating Users...");

    const superAdmin = await User.create({
      userId: "SUP001",
      name: "System Grandmaster",
      email: "superadmin@uthm.edu.my",
      role: "superadmin",
      registrationCode: "TEST-123",
      zkpRegistered: false,
      isActive: true,
    });
    const admin = await User.create({
      userId: "ADMIN001",
      name: "Dr. Hassan Abdullah",
      email: "hassan@uthm.edu.my",
      role: "admin",
      registrationCode: "TEST-123",
      zkpRegistered: false,
      isActive: true,
    });
    const supervisor1 = await User.create({
      userId: "SVR001",
      name: "Prof. Data Analysis",
      email: "data@uthm.edu.my",
      role: "supervisor",
      registrationCode: "TEST-123",
      zkpRegistered: false,
      isActive: true,
    });

    // Panels
    const panel1 = await User.create({
      userId: "PANEL001",
      name: "Dr. Rahman Ahmad",
      email: "rahman@uthm.edu.my",
      role: "panel",
      registrationCode: "TEST-123",
      zkpRegistered: false,
      isActive: true,
    });
    const panel2 = await User.create({
      userId: "PANEL002",
      name: "Dr. Siti Aminah",
      email: "siti@uthm.edu.my",
      role: "panel",
      registrationCode: "TEST-123",
      zkpRegistered: false,
      isActive: true,
    });
    const panel3 = await User.create({
      userId: "PANEL003",
      name: "Dr. Kumar Raj",
      email: "kumar@uthm.edu.my",
      role: "panel",
      registrationCode: "TEST-123",
      zkpRegistered: false,
      isActive: true,
    });

    // Students
    const student1 = await User.create({
      userId: "STU001",
      name: "Ahmad Ibrahim",
      email: "ahmad@student.uthm.edu.my",
      matricNumber: "AI230001",
      role: "student",
      program: "PhD Computer Science",
      supervisorId: supervisor1._id,
      registrationCode: "TEST-123",
      zkpRegistered: false,
      isActive: true,
    });
    const student2 = await User.create({
      userId: "STU002",
      name: "Nurul Huda Bt. Hassan",
      email: "nurul@student.uthm.edu.my",
      matricNumber: "NH230002",
      role: "student",
      program: "Master Computer Science",
      supervisorId: supervisor1._id,
      registrationCode: "TEST-123",
      zkpRegistered: false,
      isActive: true,
    });

    // ==========================================
    // 2. ASSIGN PANELS TO STUDENTS (STRICT 2-TO-1 RULE)
    // ==========================================
    console.log("👥 Assigning 2 panels per student...");

    // Student 1 gets Panel 1 & Panel 2
    student1.assignedPanels = [
      { panelId: panel1._id, startDate: new Date("2024-01-01") },
      { panelId: panel2._id, startDate: new Date("2024-01-01") },
    ];
    await student1.save();

    panel1.assignedStudents = [student1._id];
    await panel1.save();
    panel2.assignedStudents = [student1._id, student2._id];
    await panel2.save();

    // Student 2 gets Panel 2 & Panel 3
    student2.assignedPanels = [
      { panelId: panel2._id, startDate: new Date("2024-02-01") },
      { panelId: panel3._id, startDate: new Date("2024-02-01") },
    ];
    await student2.save();
    panel3.assignedStudents = [student2._id];
    await panel3.save();

    // ==========================================
    // 3. CREATE RUBRICS
    // ==========================================
    console.log("📋 Creating rubrics...");

    const rubric1 = await Rubric.create({
      name: "PhD Progress Review",
      description:
        "Comprehensive evaluation rubric for PhD student progress reviews",
      criteria: [
        {
          name: "Research Progress",
          description: "Overall progress",
          weight: 30,
          maxScore: 100,
        },
        {
          name: "Literature Review",
          description: "Quality and depth",
          weight: 20,
          maxScore: 100,
        },
        {
          name: "Methodology",
          description: "Rigor of research methodology",
          weight: 25,
          maxScore: 100,
        },
        {
          name: "Data Analysis",
          description: "Quality of data collection",
          weight: 15,
          maxScore: 100,
        },
        {
          name: "Presentation Skills",
          description: "Clarity and effectiveness",
          weight: 10,
          maxScore: 100,
        },
      ],
      createdBy: admin._id,
      isActive: true,
    });

    // ==========================================
    // 4. CREATE TIMETABLES (SESSIONS)
    // ==========================================
    console.log("📅 Creating sessions...");

    const session1 = await Timetable.create({
      sessionType: "Progress Review #1",
      title: "Progress Review #1 - Ahmad Ibrahim",
      description:
        "First progress review presentation for ML Healthcare research",
      date: new Date(), // Set to today so it shows up active
      startTime: "14:00",
      endTime: "16:00",
      venue: "Seminar Room A",
      students: [student1._id],
      panels: [panel1._id, panel2._id], // Both panels assigned!
      status: "completed",
      createdBy: admin._id,
    });

    const session2 = await Timetable.create({
      sessionType: "Proposal Defense",
      title: "Proposal Defense - Nurul Huda",
      date: new Date(Date.now() + 86400000 * 5), // 5 days from now
      startTime: "10:00",
      endTime: "12:00",
      venue: "Dewan Kuliah 1",
      students: [student2._id],
      panels: [panel2._id, panel3._id],
      status: "scheduled",
      createdBy: admin._id,
    });

    // ==========================================
    // 5. CREATE ATTENDANCE
    // ==========================================
    console.log("✅ Marking test attendance...");
    await Attendance.create({
      studentId: student1._id,
      timetableId: session1._id,
      status: "present",
      verificationMethod: "qr-code",
      checkInTime: new Date(),
    });

    /// ==========================================
    // 6. CREATE EVALUATIONS (STRICT SCHEMA COMPLIANCE)
    // ==========================================
    console.log("📊 Creating dual-evaluations for Combined Average test...");

    // Panel 1 Evaluation for Student 1
    await Evaluation.create({
      studentId: student1._id,
      evaluatorId: panel1._id,
      panelId: panel1._id,
      rubricId: rubric1._id,
      semester: "Semester 1 2024/2025",
      sessionType: "Progress Review #1",
      // Mongoose expects a Map (Object), not an Array!
      scores: {
        "Research Progress": 80,
        "Literature Review": 85,
        Methodology: 75,
        "Data Analysis": 90,
        "Presentation Skills": 80,
      },
      overallScore: 81.25, // Must match the DB Schema exact naming
      remarks:
        "Good progress, but methodology needs minor refinements. (Marked by Panel 1)",
    });

    // Panel 2 Evaluation for Student 1
    await Evaluation.create({
      studentId: student1._id,
      evaluatorId: panel2._id,
      panelId: panel2._id,
      rubricId: rubric1._id,
      semester: "Semester 1 2024/2025",
      sessionType: "Progress Review #1",
      scores: {
        "Research Progress": 90,
        "Literature Review": 88,
        Methodology: 85,
        "Data Analysis": 92,
        "Presentation Skills": 85,
      },
      overallScore: 88.15,
      remarks:
        "Excellent grasp of the subject. Ready for next phase. (Marked by Panel 2)",
    });

    console.log("\n" + "=".repeat(80));
    console.log("🎉 DB SEEDING COMPLETED! 🎉");
    console.log("=".repeat(80));
    console.log("✨ TEST SCENARIO LOADED:");
    console.log("   Student: Ahmad Ibrahim (STU001)");
    console.log("   Session: Progress Review #1");
    console.log("   Panel 1 Score: 81.25%");
    console.log("   Panel 2 Score: 88.15%");
    console.log("   -> Expected Combined Average on Frontend: 84.70%");
    console.log("=".repeat(80) + "\n");
  } catch (error) {
    console.error("❌ Seeding error:", error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
};

seedDatabase();
