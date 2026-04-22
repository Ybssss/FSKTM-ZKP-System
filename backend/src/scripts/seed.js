// src/scripts/seed.js
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const path = require("path");

// Models
const User = require("../models/User");
const Session = require("../models/Session");
const Evaluation = require("../models/Evaluation");
const Timetable = require("../models/Timetable");

const envPath = path.join(__dirname, "../../.env");
dotenv.config({ path: envPath });

const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error(`FATAL ERROR: MONGO_URI is undefined.`);
  console.error(`We looked for the .env file exactly here: ${envPath}`);
  console.error(
    `Please ensure the file is named exactly '.env' and NOT 'env.txt' or '.env.txt'`,
  );
  process.exit(1);
}

const seedDatabase = async () => {
  try {
    console.log("Connecting to MongoDB Atlas...");
    await mongoose.connect(MONGO_URI);
    console.log("Database connected successfully.");

    // 1. Clean the database
    console.log("Cleaning old data from collections...");
    await Evaluation.deleteMany({});
    await Session.deleteMany({});
    await User.deleteMany({});
    await Timetable.deleteMany({});
    console.log("Old data cleaned.");

    // 2. Create Users (Admins, Panels, Students)
    console.log("Seeding new users...");
    const usersData = [
      // Admins & Superadmin
      {
        userId: "superadmin",
        name: "Prof. Dr. Head of Graduate Studies",
        email: "superadmin@uthm.edu.my",
        role: "superadmin",
        registrationCode: "REG-SUPERADMIN",
      },
      {
        userId: "samihah",
        name: "Dr. Samihah Binti Che Dalim",
        email: "samihah@uthm.edu.my",
        role: "admin",
        expertiseTags: ["Multimedia", "HCI", "User Experience"],
        registrationCode: "REG-SAMIH",
      },
      {
        userId: "registrar",
        name: "En. Registrar FSKTM",
        email: "registrar@uthm.edu.my",
        role: "admin",
        registrationCode: "REG-REGISTRAR",
      },

      // Panels
      {
        userId: "ahmad",
        name: "Prof. Dr. Ahmad",
        email: "ahmad@uthm.edu.my",
        role: "panel",
        expertiseTags: [
          "AI",
          "Machine Learning",
          "Data Science",
          "Network Traffic",
        ],
        registrationCode: "REG-AHMAD",
      },
      {
        userId: "kamal",
        name: "Dr. Kamal",
        email: "kamal@uthm.edu.my",
        role: "panel",
        expertiseTags: [
          "Software Engineering",
          "ZKP",
          "Cryptography",
          "Authentication",
        ],
        registrationCode: "REG-KAMAL",
      },

      // Students (Will assign supervisors below)
      {
        userId: "ali",
        matricNumber: "AI123456",
        name: "Ali Bin Abu",
        email: "ali@student.uthm.edu.my",
        role: "student",
        registrationCode: "REG-ALI",
      },
      {
        userId: "siti",
        matricNumber: "AI654321",
        name: "Siti Nurhaliza",
        email: "siti@student.uthm.edu.my",
        role: "student",
        registrationCode: "REG-SITI",
      },
    ];
    const createdUsers = await User.create(usersData);

    // Get references to specific users for relationships
    const drSamihah = createdUsers.find(
      (u) => u.email === "samihah@uthm.edu.my",
    );
    const profAhmad = createdUsers.find((u) => u.email === "ahmad@uthm.edu.my");
    const drKamal = createdUsers.find((u) => u.email === "kamal@uthm.edu.my");
    let ali = createdUsers.find((u) => u.email === "ali@student.uthm.edu.my");
    let siti = createdUsers.find((u) => u.email === "siti@student.uthm.edu.my");

    // Assign Supervisors to Students
    ali.supervisorId = profAhmad._id;
    siti.supervisorId = drKamal._id;
    await ali.save();
    await siti.save();

    console.log(`${createdUsers.length} users seeded.`);

    // 3. Create Evaluation Sessions
    console.log("Seeding new sessions...");
    const sessionsData = [
      // A) A completed session from last semester for historical search testing
      {
        studentId: ali._id,
        sessionType: "PROPOSAL_DEFENSE",
        semester: "Semester 2, 2024/2025",
        panel1Id: drSamihah._id,
        panel2Id: drKamal._id,
      },
      // B) A newly scheduled session for this semester to show on the dashboard
      {
        studentId: siti._id,
        sessionType: "UPGRADING",
        semester: "Semester 1, 2025/2026",
        panel1Id: drSamihah._id,
        panel2Id: profAhmad._id,
      },
    ];
    const createdSessions = await Session.create(sessionsData);
    const historicalSession = createdSessions.find((s) =>
      s.studentId.equals(ali._id),
    );

    console.log(`${createdSessions.length} sessions seeded.`);

    // 3.5. Create Timetable Entries for Upcoming Sessions
    console.log("Seeding timetable entries for upcoming sessions...");
    const now = new Date();
    const futureDate1 = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days from now
    const futureDate2 = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000); // 14 days from now

    const timetableData = [
      {
        sessionType: "PROPOSAL_DEFENSE",
        title: "Proposal Defense - Ali Bin Abu",
        description: "Research proposal defense for AI project",
        date: futureDate1,
        startTime: "10:00",
        endTime: "12:00",
        venue: "Conference Room A, FSKTM",
        students: [ali._id],
        panels: [drSamihah._id, drKamal._id],
        createdBy: drSamihah._id,
      },
      {
        sessionType: "UPGRADING",
        title: "Upgrading Evaluation - Siti Nurhaliza",
        description: "Master to PhD upgrading evaluation",
        date: futureDate2,
        startTime: "14:00",
        endTime: "16:00",
        venue: "Seminar Hall B, FSKTM",
        students: [siti._id],
        panels: [drSamihah._id, profAhmad._id],
        createdBy: drSamihah._id,
      },
    ];
    const createdTimetables = await Timetable.create(timetableData);
    console.log(`${createdTimetables.length} timetable entries seeded.`);

    // 4. Create Historical Evaluations for the completed session
    console.log("Seeding historical evaluations for search testing...");
    const evaluationsData = [
      {
        sessionId: historicalSession._id,
        panelId: drSamihah._id,
        studentId: ali._id,
        evaluatorId: drSamihah._id,
        semester: "Semester 2, 2024/2025",
        sessionType: "PROPOSAL_DEFENSE",
        rubricScores: { crit_a: 3, crit_b: 4, crit_c: 3, crit_d: 4 },
        totalMarks: 87.5,
        overallComments:
          "The literature review is comprehensive and well-structured. The proposed abstract clearly outlines the research scope. Good work.",
      },
      {
        sessionId: historicalSession._id,
        panelId: drKamal._id,
        studentId: ali._id,
        evaluatorId: drKamal._id,
        semester: "Semester 2, 2024/2025",
        sessionType: "PROPOSAL_DEFENSE",
        rubricScores: { crit_a: 4, crit_b: 3, crit_c: 2, crit_d: 2 },
        totalMarks: 68.75,
        overallComments:
          "Your methodology section has some issues regarding the selection of cryptographic algorithms. The problem statement is strong, but the proposed methodology issues need refinement.",
      },
    ];
    await Evaluation.create(evaluationsData);
    console.log(`${evaluationsData.length} historical evaluations seeded.`);

    console.log("\n✅ Database seeded successfully!");
    console.log("You can now test the system with the following users:");
    createdUsers.forEach((u) =>
      console.log(`- ${u.role}: ${u.name} (${u.email})`),
    );
  } catch (error) {
    console.error("❌ Error seeding database:", error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log("Database connection closed.");
  }
};

// Run the seeder
seedDatabase();
