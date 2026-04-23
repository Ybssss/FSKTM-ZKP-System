// src/scripts/seed.js
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const path = require("path");

// Models
const User = require("../models/User");
const Session = require("../models/Session");
const Evaluation = require("../models/Evaluation");

// Load environment variables dynamically
const envPath = path.join(__dirname, "../../.env");
dotenv.config({ path: envPath });

const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error(`FATAL ERROR: MONGO_URI is undefined.`);
  console.error(`We looked for the .env file exactly here: ${envPath}`);
  process.exit(1);
}

const seedDatabase = async () => {
  try {
    console.log("🔌 Connecting to MongoDB Atlas...");
    await mongoose.connect(MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("✅ Database connected successfully.\n");

    // 1. Clean the database
    console.log("🧹 Cleaning old data from collections...");
    await Evaluation.deleteMany({});
    await Session.deleteMany({});
    await User.deleteMany({});
    console.log("✅ Old data cleaned.\n");

    // 2. Create Real FSKTM Users
    console.log(
      "👨‍🏫 Seeding real FSKTM UTHM staff from community.uthm.edu.my...",
    );

    const usersData = [
      // === ADMINS ===
      {
        userId: "admin_samihah",
        name: "Dr. CHE SAMIHAH BINTI CHE DALIM",
        email: "samihah@uthm.edu.my",
        role: "admin",
        registrationCode: "123456",
        expertiseTags: [
          "Multimedia",
          "Human-Computer Interaction (HCI)",
          "AR/VR",
        ],
      },
      {
        userId: "admin_pendaftar",
        name: "En. Pendaftar FSKTM",
        email: "pendaftar.fsktm@uthm.edu.my",
        role: "admin",
        registrationCode: "123456",
      },

      // === REAL FSKTM PANELS (Jabatan Kejuruteraan Perisian) ===
      {
        userId: "stf_abdsamad",
        name: "PROF. Dr. ABD SAMAD BIN HASAN BASARI",
        email: "abdsamad@uthm.edu.my",
        role: "panel",
        registrationCode: "123456",
        expertiseTags: [
          "Software Engineering",
          "Optimization",
          "Artificial Intelligence",
        ],
      },
      {
        userId: "stf_abdullahm",
        name: "Dr. ABDULLAH ABDURAHMAN MOHAMED AHMED",
        email: "abdullahm@uthm.edu.my",
        role: "panel",
        registrationCode: "123456",
        expertiseTags: [
          "Software Engineering",
          "Data Mining",
          "Machine Learning",
        ],
      },
      {
        userId: "stf_azizulr",
        name: "PROF. MADYA Ts. Dr. AZIZUL AZHAR BIN RAMLI",
        email: "azizulr@uthm.edu.my",
        role: "panel",
        registrationCode: "123456",
        expertiseTags: ["Software Engineering", "Data Analytics", "IoT"],
      },

      // === REAL FSKTM PANELS (Jabatan Keselamatan Maklumat dan Teknologi Web) ===
      {
        userId: "stf_tajudin",
        name: "Ts. AHMAD TAJUDIN BIN BAHARIN",
        email: "tajudin@uthm.edu.my",
        role: "panel",
        registrationCode: "123456",
        expertiseTags: [
          "Information Security",
          "Web Technology",
          "Cybersecurity",
        ],
      },
      {
        userId: "stf_feresa",
        name: "Dr. CIK FERESA BINTI MOHD FOOZY",
        email: "feresa@uthm.edu.my",
        role: "panel",
        registrationCode: "123456",
        expertiseTags: [
          "Information Security",
          "Network Security",
          "Cryptography",
        ],
      },
      {
        userId: "stf_deden",
        name: "Ts. Dr. DEDEN WITARSYAH",
        email: "deden@uthm.edu.my",
        role: "panel",
        registrationCode: "123456",
        expertiseTags: [
          "Cybersecurity",
          "Web Application Security",
          "Database Security",
        ],
      },
      {
        userId: "stf_firkhan",
        name: "Dr. FIRKHAN ALI BIN HAMID ALI",
        email: "firkhan@uthm.edu.my",
        role: "panel",
        registrationCode: "123456",
        expertiseTags: [
          "Information Security",
          "Malware Analysis",
          "Digital Forensics",
        ],
      },
      {
        userId: "stf_hairuln",
        name: "PROF. Ts. Dr. HAIRULNIZAM BIN MAHDIN",
        email: "hairuln@uthm.edu.my",
        role: "panel",
        registrationCode: "123456",
        expertiseTags: ["Information Security", "Big Data", "Cloud Computing"],
      },
      {
        userId: "stf_hana",
        name: "PUAN HANAYANTI BINTI HAFIT",
        email: "hana@uthm.edu.my",
        role: "panel",
        registrationCode: "123456",
        expertiseTags: ["Web Technology", "Database", "E-Commerce"],
      },
      {
        userId: "stf_rahmi",
        name: "PROF. MADYA Ts. Dr. ISREDZA RAHMI BINTI A HAMID",
        email: "rahmi@uthm.edu.my",
        role: "panel",
        registrationCode: "123456",
        expertiseTags: [
          "Information Security",
          "Network Security",
          "Steganography",
        ],
      },
      {
        userId: "stf_malik",
        name: "PROF. MADYA Dr. KAMARUDDIN MALIK BIN MOHAMAD",
        email: "malik@uthm.edu.my",
        role: "panel",
        registrationCode: "123456",
        expertiseTags: [
          "Network Security",
          "Wireless Sensor Networks",
          "IoT Security",
        ],
      },

      // === REAL FSKTM PANELS (Jabatan Multimedia) ===
      {
        userId: "stf_ezak",
        name: "Dr. EZAK FADZRIN BIN AHMAD SHAUBARI",
        email: "ezak@uthm.edu.my",
        role: "panel",
        registrationCode: "123456",
        expertiseTags: ["Multimedia System", "Computer Vision", "Animation"],
      },
      {
        userId: "stf_azizanis",
        name: "ENCIK AZIZAN BIN ISMAIL",
        email: "azizanis@uthm.edu.my",
        role: "panel",
        registrationCode: "123456",
        expertiseTags: ["Multimedia", "Digital Media", "Graphic Design"],
      },

      // === STUDENTS ===
      {
        userId: "AW240001",
        name: "Muhammad Ali Bin Abu Bakar",
        email: "ali@student.uthm.edu.my",
        role: "student",
        registrationCode: "123456",
      },
      {
        userId: "AW240002",
        name: "Siti Nuraisyah Binti Abdullah",
        email: "siti@student.uthm.edu.my",
        role: "student",
        registrationCode: "123456",
      },
      {
        userId: "AW240003",
        name: "Chong Wei Ming",
        email: "chong@student.uthm.edu.my",
        role: "student",
        registrationCode: "123456",
      },
    ];

    const createdUsers = await User.create(usersData);

    // Helper function to find user ID by email
    const getUserId = (email) =>
      createdUsers.find((u) => u.email === email)._id;

    // Assign Supervisors to Students based on matching expertise
    const ali = createdUsers.find((u) => u.email === "ali@student.uthm.edu.my");
    const siti = createdUsers.find(
      (u) => u.email === "siti@student.uthm.edu.my",
    );
    const chong = createdUsers.find(
      (u) => u.email === "chong@student.uthm.edu.my",
    );

    ali.supervisorId = getUserId("abdsamad@uthm.edu.my"); // Ali's supervisor is Prof Abd Samad
    siti.supervisorId = getUserId("feresa@uthm.edu.my"); // Siti's supervisor is Dr Feresa
    chong.supervisorId = getUserId("samihah@uthm.edu.my"); // Chong's supervisor is Dr Samihah

    await ali.save();
    await siti.save();
    await chong.save();

    console.log(`✅ ${createdUsers.length} FSKTM staff and students seeded.\n`);

    // 3. Create Evaluation Sessions
    console.log("📅 Seeding Evaluation Sessions...");
    const sessionsData = [
      // Session 1: PROPOSAL_DEFENSE (Completed session in the past for Historical Search)
      {
        studentId: ali._id,
        sessionType: "PROPOSAL_DEFENSE",
        semester: "Semester 2, 2024/2025",
        panel1Id: getUserId("azizulr@uthm.edu.my"), // Ensuring no conflict of interest
        panel2Id: getUserId("abdullahm@uthm.edu.my"),
      },
      // Session 2: UPGRADING (Currently active session)
      {
        studentId: siti._id,
        sessionType: "UPGRADING",
        semester: "Semester 1, 2025/2026",
        panel1Id: getUserId("hairuln@uthm.edu.my"),
        panel2Id: getUserId("malik@uthm.edu.my"),
        supervisorEndorsed: true, // Required by UTHM Upgrading form
      },
      // Session 3: PRE_VIVA (Upcoming session)
      {
        studentId: chong._id,
        sessionType: "PRE_VIVA",
        semester: "Semester 1, 2025/2026",
        panel1Id: getUserId("ezak@uthm.edu.my"),
        panel2Id: getUserId("azizanis@uthm.edu.my"),
      },
    ];
    const createdSessions = await Session.create(sessionsData);
    console.log(`✅ ${createdSessions.length} sessions seeded.\n`);

    // 4. Create Historical Evaluations (Mapped exactly to the UTHM 13-Criteria PDF Forms)
    console.log("📋 Seeding exact UTHM Rubric evaluations (Criteria A-M)...");

    const aliSession = createdSessions[0]; // Proposal Defense Session

    // The PDF Evaluation Rubric maps: 4=Exemplary, 3=Proficient, 2=Satisfactory, 1=Foundational, 0=Novice
    const evaluationsData = [
      {
        sessionId: aliSession._id,
        studentId: ali._id,
        evaluatorId: getUserId("azizulr@uthm.edu.my"),
        semester: aliSession.semester,
        sessionType: aliSession.sessionType,
        scores: {
          crit_a_title: 4, // Criteria A: PROPOSED RESEARCH TITLE
          crit_b_exec_summary: 3, // Criteria B: EXECUTIVE SUMMARY
          crit_c_problem_statement: 4, // Criteria C: PROBLEM STATEMENT & SIGNIFICANCE
          crit_d_objective: 3, // Criteria D: OBJECTIVE OF STUDY
          crit_e_literature: 2, // Criteria E: LITERATURE REVIEW
          crit_f_methodology: 3, // Criteria F: METHODOLOGY
          crit_g_preliminary_results: 4, // Criteria G: PRELIMINARY RESULTS
          crit_h_method_reliability: 3, // Criteria H: METHOD RELIABILITY, VALIDITY AND ETHICS
          crit_i_organization: 3, // Criteria I: ORGANIZATION OF IDEAS
          crit_j_language: 2, // Criteria J: LANGUAGE AND WRITING STYLE
          crit_k_references: 4, // Criteria K: REFERENCES AND CITATION
          crit_l_presentation: 3, // Criteria L: ORAL PRESENTATION SKILLS
          crit_m_deliberative: 3, // Criteria M: DELIBERATIVE ORAL EVALUATION
        },
        totalMarks: 78.84, // (41 marks / 52 max marks) * 100 = 78.84% -> PASS WITH MAJOR AMENDMENT
        strengths:
          "The problem statement is well-defined and contextually grounded.",
        weaknesses:
          "Literature review is highly descriptive rather than analytical. Some key authors are underrepresented.",
        recommendations:
          "Enhance the critical analysis in the literature review section.",
        overallComments:
          "Overall a good proposal. The candidate effectively applies appropriate tools and methods to analyse data. However, the literature review shows minimal interpretation with limited engagement with literature. Methodology issues must be addressed before proceeding.",
      },
      {
        sessionId: aliSession._id,
        studentId: ali._id,
        evaluatorId: getUserId("abdullahm@uthm.edu.my"),
        semester: aliSession.semester,
        sessionType: aliSession.sessionType,
        scores: {
          crit_a_title: 3,
          crit_b_exec_summary: 3,
          crit_c_problem_statement: 3,
          crit_d_objective: 2,
          crit_e_literature: 2,
          crit_f_methodology: 2, // Satisfactory
          crit_g_preliminary_results: 3,
          crit_h_method_reliability: 3,
          crit_i_organization: 3,
          crit_j_language: 3,
          crit_k_references: 3,
          crit_l_presentation: 4,
          crit_m_deliberative: 3,
        },
        totalMarks: 71.15, // (37 marks / 52 max marks) * 100 = 71.15% -> PASS WITH MAJOR AMENDMENT
        strengths:
          "Candidate presented a very good deliberative oral evaluation.",
        weaknesses:
          "Methodology reported outlines basic research procedures with only moderate alignment to objectives.",
        recommendations:
          "Revisit the connection between the methods and the research objectives.",
        overallComments:
          "The methodology reported outlines the basic research procedures with moderate alignment to the objectives. Justification is present but limited. Practical application and problem-solving elements are evident but underdeveloped. Acceptable for the level of the academic programme enrolled, though improvement is needed.",
      },
    ];

    await Evaluation.create(evaluationsData);
    console.log(`✅ Historical evaluations seeded successfully.\n`);

    console.log("🎉==============================================🎉");
    console.log("✅ DATABASE SEEDING COMPLETED SUCCESSFULLY! ✅");
    console.log("🎉==============================================🎉");
    console.log("\nYou can now test your system using these credentials:");
    console.log("--------------------------------------------------");
    console.log("ADMIN LOGIN: samihah@uthm.edu.my");
    console.log("PANEL LOGIN 1 (Evaluator): azizulr@uthm.edu.my");
    console.log("PANEL LOGIN 2 (Evaluator): abdullahm@uthm.edu.my");
    console.log("PANEL LOGIN 3 (Ali's Supervisor): abdsamad@uthm.edu.my");
    console.log("--------------------------------------------------");
    console.log(
      'Search Keyword Test: Log in as Admin and search "methodology issues" to find the historical comment!',
    );
  } catch (error) {
    console.error("❌ Error seeding database:", error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log("\nDatabase connection closed.");
  }
};

// Run the seeder
seedDatabase();
