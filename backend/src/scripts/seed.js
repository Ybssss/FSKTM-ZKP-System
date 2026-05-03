// src/scripts/seed.js
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const path = require("path");
const axios = require("axios");
const cheerio = require("cheerio");
const https = require("https");

const User = require("../models/User");
const Session = require("../models/Session");
const Evaluation = require("../models/Evaluation");
const Rubric = require("../models/Rubric");

const envPath = path.join(__dirname, "../../.env");
dotenv.config({ path: envPath });

const MONGO_URI = process.env.MONGO_URI;

// ==========================================
// EXACT 3 UTHM RUBRICS
// ==========================================
const rubricsData = [
  {
    name: "Research Proposal Evaluation Rubric",
    sessionType: "PROPOSAL_DEFENSE",
    criteria: [
      {
        key: "crit_a_title",
        title: "CRITERIA A: PROPOSED RESEARCH TITLE",
        exemplary:
          "The candidate’s proposed research title is concise, conceptually sound, and appropriately aligned with the stated purpose and objectives of the study. It reflects a strong command of the subject matter.",
        proficient:
          "The candidate’s proposed research title is clearly articulated and appropriately aligned with the study’s purpose and objectives. It demonstrates a competent understanding of the subject matter.",
        satisfactory:
          "The candidate’s proposed research title is generally relevant and adequately aligned with the study’s purpose and objectives. Although the research direction is acceptable, additional refinement is required.",
        foundational:
          "The candidate’s proposed research title demonstrates limited clarity and only partial alignment with the study’s purpose. Marginally suitable for the academic programme.",
        novice:
          "The candidate’s proposed research title lacks clarity, coherence, and alignment with the study’s purpose. Unsuitable for the academic programme level.",
      },
      {
        key: "crit_b_exec_summary",
        title: "CRITERIA B: EXECUTIVE SUMMARY",
        exemplary:
          "The candidate’s executive summary presents a clear, coherent overview of the research proposal. High-level cognitive skills are demonstrated through critical synthesis.",
        proficient:
          "The candidate’s executive summary effectively communicates the core components of the proposal. Problem-solving elements are present.",
        satisfactory:
          "The candidate’s executive summary provides a basic structure and covers the main aspects of the research. Cognitive engagement is present but limited in depth.",
        foundational:
          "The candidate’s executive summary lacks clarity and cohesion. The problem, aim, or rationale may be unclear or disconnected.",
        novice:
          "The candidate’s executive summary is poorly structured and lacks essential components. Little or no demonstration of cognitive reasoning.",
      },
      {
        key: "crit_c_problem",
        title: "CRITERIA C: PROBLEM STATEMENT & SIGNIFICANCE",
        exemplary:
          "The problem statement is well-defined, contextually grounded, and critically justified with relevant literature. High-level cognitive skills are evident.",
        proficient:
          "The problem statement is clearly articulated and supported with appropriate context and references.",
        satisfactory:
          "The problem statement is adequately stated and generally relevant, though some elements may lack clarity or depth.",
        foundational:
          "The problem statement lacks clarity or is weakly developed. The justification is minimal.",
        novice:
          "The problem statement is unclear, unfocused, or missing. No meaningful justification is provided.",
      },
      // Add more criteria here as needed...
    ],
  },
  {
    name: "Pre-Oral Examination (Pre-Viva Voce) Rubric",
    sessionType: "PRE_VIVA",
    criteria: [
      {
        key: "crit_a_thesis_title",
        title: "CRITERIA A: THESIS TITLE",
        exemplary:
          "The candidate presents a thesis title that is concise, precise, and directly aligned with the core focus of the research. It is articulated with clarity and academic rigour.",
        proficient:
          "The candidate presents a thesis title that is relevant, clearly worded, and appropriate to the research domain. Demonstrates a sound understanding.",
        satisfactory:
          "The candidate presents a thesis title that identifies the general area of research and reflects an adequate level of understanding. Lacks specificity or depth.",
        foundational:
          "The candidate presents a thesis title that demonstrates limited familiarity with the subject area. The wording is vague or imprecise.",
        novice:
          "The candidate presents a thesis title that is unclear, unrelated, or unsuitable for academic inquiry.",
      },
      {
        key: "crit_f_methodology",
        title: "CRITERIA F: METHODOLOGY",
        exemplary:
          "The methodology is comprehensive, clearly aligned with the research objectives, and well justified. Demonstrates strong integration and advanced problem-solving skills.",
        proficient:
          "The methodology is coherent and appropriately structured, with relevant research design and methods clearly explained.",
        satisfactory:
          "The methodology outlines the basic research procedures with moderate alignment to the objectives. Justification is present but limited.",
        foundational:
          "The methodology lacks clarity and consistency, with weak alignment to the research objectives and inadequate justification.",
        novice:
          "The methodology is poorly structured or largely absent, with research methods that are inappropriate or disconnected.",
      },
      // Add more criteria here as needed...
    ],
  },
  {
    name: "Progress Report Assessment Form",
    sessionType: "PROGRESS_ASSESSMENT",
    criteria: [], // This remains empty because it uses textboxes, not a rubric grid
  },
];

const seedDatabase = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("✅ Database connected.\n");

    await Evaluation.deleteMany({});
    await Session.deleteMany({});
    await Rubric.deleteMany({});
    await User.deleteMany({});

    // 1. Create Rubrics
    console.log("📚 Seeding 3 UTHM Rubric Templates...");
    const createdRubrics = await Rubric.create(rubricsData);

    const proposalRubric = createdRubrics.find(
      (r) => r.sessionType === "PROPOSAL_DEFENSE",
    );
    const preVivaRubric = createdRubrics.find(
      (r) => r.sessionType === "PRE_VIVA",
    );
    const progressRubric = createdRubrics.find(
      (r) => r.sessionType === "PROGRESS_ASSESSMENT",
    );

    // 2. Create Admins & Students (ADDED CHONG BACK IN)
    console.log("👨‍💼 Seeding Admins and Students with Research Details...");
    const manualUsers = [
      {
        userId: "admin_samihah",
        name: "Dr. CHE SAMIHAH BINTI CHE DALIM",
        email: "samihah@uthm.edu.my",
        role: "admin",
        registrationCode: "temp",
      },
      {
        userId: "admin_pendaftar",
        name: "En. Pendaftar FSKTM",
        email: "pendaftar.fsktm@uthm.edu.my",
        role: "admin",
        registrationCode: "temp",
      },

      {
        userId: "AW240001",
        matricNumber: "AW240001",
        name: "Muhammad Ali",
        email: "ali@student.uthm.edu.my",
        role: "student",
        registrationCode: null,
        program: "Master of Information Technology",
        researchTitle:
          "Optimization of Zero-Knowledge Proofs in Web Authentication",
      },
      {
        userId: "AW240002",
        matricNumber: "AW240002",
        name: "Siti Nuraisyah",
        email: "siti@student.uthm.edu.my",
        role: "student",
        registrationCode: null,
        program: "PhD in Computer Science",
        researchTitle:
          "Advanced Deep Learning Models for Network Traffic Analysis",
      },
      // 🔴 FIX: Added Chong back into the array so the script doesn't crash
      {
        userId: "AW240003",
        matricNumber: "AW240003",
        name: "Chong Wei Ming",
        email: "chong@student.uthm.edu.my",
        role: "student",
        registrationCode: null,
        program: "Master of Software Engineering",
        researchTitle: "Blockchain Integration in Healthcare Record Systems",
      },
    ];
    let allUsers = await User.create(manualUsers);

    // 3. Scrape FSKTM Lecturers
    console.log("🌐 Fetching FSKTM Lecturers...");
    const scrapedPanels = [];
    try {
      const agent = new https.Agent({ rejectUnauthorized: false });
      const response = await axios.get(
        "https://community.uthm.edu.my/offices/info/28",
        { httpsAgent: agent, timeout: 10000 },
      );
      const $ = cheerio.load(response.data);

      $("a, h4, h5, h6, strong, td, span, div").each((index, element) => {
        let text = $(element).text().trim().replace(/\s+/g, " ");
        if (
          /^(PROF|DR|TS|EN|PN|IR|ASSOC)\.?/i.test(text) &&
          text.length > 10 &&
          text.length < 60
        ) {
          if (!scrapedPanels.some((p) => p.name === text)) {
            const cleanName = text
              .toLowerCase()
              .replace(/[^a-z ]/g, "")
              .split(" ");
            const emailPrefix =
              cleanName[cleanName.length - 1] || `staff${scrapedPanels.length}`;

            scrapedPanels.push({
              userId: `fsktm_stf_${scrapedPanels.length + 1}`,
              name: text,
              email: `${emailPrefix}${scrapedPanels.length + 1}@uthm.edu.my`,
              role: "panel",
              registrationCode: null,
              expertiseTags: ["Information Technology", "FSKTM General"],
            });
          }
        }
      });
    } catch (err) {}

    if (scrapedPanels.length < 4) {
      scrapedPanels.push(
        {
          userId: "stf_1",
          name: "PROF. DR. ABD SAMAD",
          email: "abdsamad@uthm.edu.my",
          role: "panel",
          expertiseTags: ["Software Engineering"],
        },
        {
          userId: "stf_2",
          name: "DR. CIK FERESA",
          email: "feresa@uthm.edu.my",
          role: "panel",
          expertiseTags: ["Information Security"],
        },
        {
          userId: "stf_3",
          name: "DR. EZAK FADZRIN",
          email: "ezak@uthm.edu.my",
          role: "panel",
          expertiseTags: ["Multimedia System"],
        },
        {
          userId: "stf_4",
          name: "TS. AHMAD TAJUDIN",
          email: "tajudin@uthm.edu.my",
          role: "panel",
          expertiseTags: ["Web Tech"],
        },
      );
    }

    const createdPanels = await User.create(scrapedPanels);
    allUsers = [...allUsers, ...createdPanels];
    const getUserId = (email) => allUsers.find((u) => u.email === email)._id;

    // Assign Supervisors
    await User.updateOne(
      { email: "ali@student.uthm.edu.my" },
      { supervisorId: createdPanels[0]._id },
    );
    await User.updateOne(
      { email: "siti@student.uthm.edu.my" },
      { supervisorId: createdPanels[1]._id },
    );
    await User.updateOne(
      { email: "chong@student.uthm.edu.my" },
      { supervisorId: createdPanels[2]._id },
    );

    // 4. Create Sessions (With Future Dates for the Dashboard)
    console.log("📅 Seeding 3 Evaluation Sessions...");

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);

    const sessionsData = [
      {
        studentId: getUserId("ali@student.uthm.edu.my"),
        sessionType: "PROPOSAL_DEFENSE",
        semester: "Semester 1, 2025/2026",
        date: tomorrow,
        time: "10:00 AM",
        venue: "Bilik Seminar 1",
        panel1Id: getUserId("samihah@uthm.edu.my"),
        panel2Id: createdPanels[1]._id,
      },
      {
        studentId: getUserId("siti@student.uthm.edu.my"),
        sessionType: "PRE_VIVA",
        semester: "Semester 1, 2025/2026",
        date: nextWeek,
        time: "2:30 PM",
        venue: "Makmal Komputer 3",
        panel1Id: getUserId("samihah@uthm.edu.my"),
        panel2Id: createdPanels[2]._id,
      },
      {
        studentId: getUserId("chong@student.uthm.edu.my"),
        sessionType: "PROGRESS_ASSESSMENT",
        semester: "Semester 1, 2025/2026",
        date: tomorrow,
        time: "09:00 AM",
        venue: "Online (Webex)",
        panel1Id: getUserId("samihah@uthm.edu.my"),
        panel2Id: createdPanels[3]._id,
      },
    ];
    const createdSessions = await Session.create(sessionsData);

    // 5. Auto-Create PENDING Evaluations
    console.log("📋 Seeding PENDING evaluations linked to Rubrics...");
    const evaluationsData = [
      {
        sessionId: createdSessions[0]._id,
        rubricId: proposalRubric._id,
        studentId: getUserId("ali@student.uthm.edu.my"),
        evaluatorId: getUserId("samihah@uthm.edu.my"),
        semester: createdSessions[0].semester,
        sessionType: createdSessions[0].sessionType,
        status: "PENDING",
      },
      {
        sessionId: createdSessions[0]._id,
        rubricId: proposalRubric._id,
        studentId: getUserId("ali@student.uthm.edu.my"),
        evaluatorId: createdPanels[1]._id,
        semester: createdSessions[0].semester,
        sessionType: createdSessions[0].sessionType,
        status: "PENDING",
      },

      {
        sessionId: createdSessions[1]._id,
        rubricId: preVivaRubric._id,
        studentId: getUserId("siti@student.uthm.edu.my"),
        evaluatorId: getUserId("samihah@uthm.edu.my"),
        semester: createdSessions[1].semester,
        sessionType: createdSessions[1].sessionType,
        status: "PENDING",
      },
      {
        sessionId: createdSessions[1]._id,
        rubricId: preVivaRubric._id,
        studentId: getUserId("siti@student.uthm.edu.my"),
        evaluatorId: createdPanels[2]._id,
        semester: createdSessions[1].semester,
        sessionType: createdSessions[1].sessionType,
        status: "PENDING",
      },

      {
        sessionId: createdSessions[2]._id,
        rubricId: progressRubric._id,
        studentId: getUserId("chong@student.uthm.edu.my"),
        evaluatorId: getUserId("samihah@uthm.edu.my"),
        semester: createdSessions[2].semester,
        sessionType: createdSessions[2].sessionType,
        status: "PENDING",
      },
      {
        sessionId: createdSessions[2]._id,
        rubricId: progressRubric._id,
        studentId: getUserId("chong@student.uthm.edu.my"),
        evaluatorId: createdPanels[3]._id,
        semester: createdSessions[2].semester,
        sessionType: createdSessions[2].sessionType,
        status: "PENDING",
      },
    ];
    await Evaluation.create(evaluationsData);

    console.log("✅ DATABASE SEEDING COMPLETED SUCCESSFULLY!");
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
  }
};

seedDatabase();
