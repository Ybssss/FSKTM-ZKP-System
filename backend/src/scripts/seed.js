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

if (!MONGO_URI) {
  console.error(`FATAL ERROR: MONGO_URI is undefined.`);
  process.exit(1);
}

// ==========================================
// MIXED RUBRICS (Quantitative & Qualitative)
// ==========================================
const rubricsData = [
  {
    name: "Research Proposal Evaluation Rubric",
    sessionType: "PROPOSAL_DEFENSE",
    criteria: [
      // --- QUANTITATIVE CRITERIA (With Weights and Scores) ---
      {
        key: "crit_a_title",
        title: "CRITERIA A: PROPOSED RESEARCH TITLE",
        type: "quantitative",
        weight: 10, // 10% of total score
        maxScore: 4,
        exemplary:
          "The candidate’s proposed research title is concise, conceptually sound, and appropriately aligned with the stated purpose and objectives of the study. It reflects a strong command of the subject matter.",
        proficient:
          "The candidate’s proposed research title is clearly articulated and appropriately aligned with the study’s purpose and objectives.",
        satisfactory:
          "The candidate’s proposed research title is generally relevant and adequately aligned. Additional refinement is required.",
        foundational:
          "The candidate’s proposed research title demonstrates limited clarity. Marginally suitable.",
        novice:
          "The candidate’s proposed research title lacks clarity, coherence, and alignment. Unsuitable.",
      },
      {
        key: "crit_b_exec_summary",
        title: "CRITERIA B: EXECUTIVE SUMMARY",
        type: "quantitative",
        weight: 20, // 20% of total score
        maxScore: 4,
        exemplary:
          "Presents a clear, coherent overview of the research proposal. High-level cognitive skills are demonstrated.",
        proficient:
          "Effectively communicates the core components of the proposal. Problem-solving elements are present.",
        satisfactory:
          "Provides a basic structure and covers the main aspects of the research.",
        foundational:
          "Lacks clarity and cohesion. The problem, aim, or rationale may be unclear.",
        novice: "Poorly structured and lacks essential components.",
      },
      {
        key: "crit_f_methodology",
        title: "CRITERIA F: METHODOLOGY",
        type: "quantitative",
        weight: 40, // 40% of total score
        maxScore: 4,
        exemplary:
          "The methodology is comprehensive, clearly aligned with the research objectives, and well justified.",
        proficient:
          "The methodology is coherent and appropriately structured, with relevant research design.",
        satisfactory:
          "Outlines the basic research procedures with moderate alignment to the objectives.",
        foundational:
          "Lacks clarity and consistency, with weak alignment to the research objectives.",
        novice: "Poorly structured or largely absent.",
      },
      {
        key: "crit_l_presentation",
        title: "CRITERIA L: ORAL PRESENTATION SKILLS",
        type: "quantitative",
        weight: 30, // 30% of total score
        maxScore: 4,
        exemplary:
          "Presentation was delivered with clarity, confidence, and a strong academic presence.",
        proficient:
          "Presentation was delivered clearly, with appropriate tone and structure.",
        satisfactory:
          "Presentation was delivered with adequate clarity and structure, though some hesitation was evident.",
        foundational:
          "Presentation was delivered with limited clarity and confidence.",
        novice:
          "Presentation was delivered in a disorganised and unclear manner.",
      },
      // --- QUALITATIVE CRITERIA (No weights, pure text feedback) ---
      {
        key: "crit_qual_1",
        title: "PANEL'S QUALITATIVE FEEDBACK",
        type: "qualitative",
        weight: 0,
        maxScore: 0,
        description:
          "Please provide specific qualitative feedback regarding the student's problem statement and literature review. Do they need more recent citations?",
      },
      {
        key: "crit_qual_2",
        title: "ETHICS & RELIABILITY REMARKS",
        type: "qualitative",
        weight: 0,
        maxScore: 0,
        description:
          "Note any concerns regarding data reliability, validity, or ethical compliance.",
      },
    ],
  },
  {
    name: "Pre-Oral Examination (Pre-Viva Voce) Rubric",
    sessionType: "PRE_VIVA",
    criteria: [
      {
        key: "crit_a_thesis_title",
        title: "CRITERIA A: THESIS TITLE",
        type: "quantitative",
        weight: 50,
        maxScore: 4,
        exemplary:
          "Concise, precise, and directly aligned with the core focus of the research.",
        proficient:
          "Relevant, clearly worded, and appropriate to the research domain.",
        satisfactory:
          "Identifies the general area of research and reflects an adequate level of understanding.",
        foundational: "Demonstrates limited familiarity with the subject area.",
        novice: "Unclear, unrelated, or unsuitable for academic inquiry.",
      },
      {
        key: "crit_k_conclusion",
        title: "CRITERIA K: CONCLUSION AND RECOMMENDATIONS",
        type: "quantitative",
        weight: 50,
        maxScore: 4,
        exemplary:
          "Formulated conclusions that reflected a high level of synthesis, critically integrating the study's findings.",
        proficient:
          "Presented coherent conclusions aligned with the study's objectives.",
        satisfactory:
          "Presented acceptable conclusions derived from the findings, though limited in analytical depth.",
        foundational: "Presented basic conclusions with weak synthesis.",
        novice: "Failed to present coherent or substantiated conclusions.",
      },
      {
        key: "crit_qual_viva",
        title: "FINAL RECOMMENDATIONS TO CHAIRPERSON",
        type: "qualitative",
        weight: 0,
        maxScore: 0,
        description:
          "Provide a qualitative summary of why this thesis should pass or require major amendments.",
      },
    ],
  },
  {
    name: "Progress Report Assessment Form",
    sessionType: "PROGRESS_ASSESSMENT",
    criteria: [], // Entirely qualitative textboxes handled by UI
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
    console.log(
      "📚 Seeding UTHM Rubric Templates (Mixed Quantitative/Qualitative)...",
    );
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

    // 2. Create Admins
    console.log("👨‍💼 Seeding Admins...");
    const adminUsers = [
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
    ];
    let allUsers = await User.create(adminUsers);

    // 3. Scrape FSKTM Lecturers (Panels)
    console.log("🌐 Fetching FSKTM Lecturers (Panels)...");
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

    // Fallback Panels if Scraper fails
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

    // 4. Create Students and GUARANTEE Supervisor Assignment
    console.log("🎓 Seeding Students and assigning Supervisors securely...");

    // We explicitly attach the exact ObjectId of the newly created panels to the students
    const studentUsers = [
      {
        userId: "AW240001",
        matricNumber: "AW240001",
        name: "Muhammad Ali",
        email: "ali@student.uthm.edu.my",
        role: "student",
        registrationCode: null,
        program: "Master of Information Technology",
        researchTitle: "Optimization of Zero-Knowledge Proofs",
        supervisorId: createdPanels[0]._id, // Guaranteed Assignment
      },
      {
        userId: "AW240002",
        matricNumber: "AW240002",
        name: "Siti Nuraisyah",
        email: "siti@student.uthm.edu.my",
        role: "student",
        registrationCode: null,
        program: "PhD in Computer Science",
        researchTitle: "Advanced Deep Learning Models",
        supervisorId: createdPanels[1]._id, // Guaranteed Assignment
      },
      {
        userId: "AW240003",
        matricNumber: "AW240003",
        name: "Chong Wei Ming",
        email: "chong@student.uthm.edu.my",
        role: "student",
        registrationCode: null,
        program: "Master of Software Engineering",
        researchTitle: "Blockchain Healthcare Systems",
        supervisorId: createdPanels[2]._id, // Guaranteed Assignment
      },
    ];

    const createdStudents = await User.create(studentUsers);
    allUsers = [...allUsers, ...createdStudents];
    const getUserId = (email) => allUsers.find((u) => u.email === email)._id;

    // 5. Create Sessions (Preventing Conflict of Interest)
    console.log("📅 Seeding 3 Evaluation Sessions...");

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);

    const sessionsData = [
      {
        // Proposal Defense - Ali (SV is Panel 0, so Evaluators are Admin and Panel 1)
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
        // Pre-Viva - Siti (SV is Panel 1, so Evaluators are Admin and Panel 2)
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
        // Progress - Chong (SV is Panel 2, so Evaluators are Admin and Panel 3)
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

    // 6. Auto-Create PENDING Evaluations
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
