// src/scripts/seed.js
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const path = require("path");
const SessionBatch = require("../models/SessionBatch");
const User = require("../models/User");
const Timetable = require("../models/Timetable");
const Evaluation = require("../models/Evaluation");
const Rubric = require("../models/Rubric");
const Attendance = require("../models/Attendance");
const PermissionRequest = require("../models/PermissionRequest");

const envPath = path.join(__dirname, "../../.env");
dotenv.config({ path: envPath });

const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error(`FATAL ERROR: MONGO_URI is undefined.`);
  process.exit(1);
}

// ==========================================
// 100% COMPLETE FSKTM UTHM RUBRICS
// ==========================================
const rubricsData = [
  {
    name: "Research Proposal Evaluation Rubric",
    sessionType: "PROPOSAL_DEFENSE",
    criteria: [
      {
        key: "crit_a_title",
        title: "CRITERIA A: PROPOSED RESEARCH TITLE",
        type: "quantitative",
        weight: 5,
        maxScore: 4,
        exemplary:
          "The candidate presents a thesis title that is concise, precise, and directly aligned with the core focus of the research. The title reflects comprehensive subject knowledge and a clear grasp of key relationships within the field. It is articulated with clarity and academic rigour.",
        proficient:
          "The candidate presents a thesis title that is relevant, clearly worded, and appropriate to the research domain. It demonstrates a sound understanding of the subject matter and outlines the main scope of the study.",
        satisfactory:
          "The candidate presents a thesis title that identifies the general area of research and reflects an adequate level of understanding. However, the title lacks specificity, depth, or balanced scope.",
        foundational:
          "The candidate presents a thesis title that demonstrates limited familiarity with the subject area. The wording is vague, overgeneralised, or imprecise.",
        novice:
          "The candidate presents a thesis title that is unclear, unrelated, or unsuitable for academic inquiry. The title does not demonstrate basic understanding of the subject.",
      },
      {
        key: "crit_b_exec_summary",
        title: "CRITERIA B: EXECUTIVE SUMMARY",
        type: "quantitative",
        weight: 10,
        maxScore: 4,
        exemplary:
          "The candidate's executive summary presents a clear, coherent overview of the research proposal. The problem, purpose/objectives, and rationale are logically structured and well integrated. High-level cognitive skills are demonstrated through critical synthesis.",
        proficient:
          "The candidate's executive summary effectively communicates the core components of the proposal. The research problem and purpose/objectives are clearly stated, and there is evidence of logical reasoning.",
        satisfactory:
          "The candidate's executive summary provides a basic structure and covers the main aspects of the research. Cognitive engagement is present but limited in depth.",
        foundational:
          "The candidate's executive summary lacks clarity and cohesion. The problem, aim, or rationale may be unclear or disconnected.",
        novice:
          "The candidate's executive summary is poorly structured and lacks essential components. Little or no demonstration of cognitive reasoning.",
      },
      {
        key: "crit_c_problem",
        title: "CRITERIA C: PROBLEM STATEMENT & SIGNIFICANCE",
        type: "quantitative",
        weight: 15,
        maxScore: 4,
        exemplary:
          "The problem statement is well-defined, contextually grounded, and critically justified with relevant literature. High-level cognitive and critical thinking skills are evident.",
        proficient:
          "The problem statement is clearly articulated and supported with appropriate context and references. The significance of the study is logically presented.",
        satisfactory:
          "The problem statement is adequately stated and generally relevant, though some elements may lack clarity or depth.",
        foundational:
          "The problem statement lacks clarity or is weakly developed. The justification is minimal, and the significance is not convincingly explained.",
        novice:
          "The problem statement is unclear, unfocused, or missing. No meaningful justification is provided.",
      },
      {
        key: "crit_d_objective",
        title: "CRITERIA D: OBJECTIVE OF STUDY & RESEARCH QUESTIONS",
        type: "quantitative",
        weight: 10,
        maxScore: 4,
        exemplary:
          "The research objectives are clearly defined, focused, and aligned with the research problem, structured to be measurable, achievable, and academically pertinent.",
        proficient:
          "The research objectives are clear, relevant, and generally well-aligned with the research problem, offering measurable and structured guidance.",
        satisfactory:
          "The research objectives are generally understandable but show limited clarity, specificity, and alignment with the research problem.",
        foundational:
          "The research objectives are unclear, overly broad, and weakly connected to the research problem, with poor structure.",
        novice:
          "The research objectives are absent or entirely unclear, showing no alignment with the research problem.",
      },
      {
        key: "crit_e_literature",
        title: "CRITERIA E: LITERATURE REVIEW",
        type: "quantitative",
        weight: 15,
        maxScore: 4,
        exemplary:
          "The literature review demonstrates critical engagement with a wide range of relevant and credible sources, clearly identifying key debates and gaps.",
        proficient:
          "The literature review is well-organised and clearly written, using relevant sources to support the research context. Evidence of critical discussion and synthesis is present.",
        satisfactory:
          "The literature review adequately covers relevant sources but is largely descriptive rather than analytical. Some key authors or themes may be underrepresented.",
        foundational:
          "The literature review is loosely structured and shows limited critical insight. Coverage of relevant literature is incomplete.",
        novice:
          "The literature review is poorly constructed, showing minimal critical engagement and limited relevance.",
      },
      {
        key: "crit_f_methodology",
        title: "CRITERIA F: METHODOLOGY",
        type: "quantitative",
        weight: 20,
        maxScore: 4,
        exemplary:
          "The methodology is comprehensive, clearly aligned with the research objectives, and well justified. The research design, data collection, and analysis methods are methodologically sound.",
        proficient:
          "The methodology is coherent and appropriately structured, with relevant research design and methods that are clearly explained and generally well justified.",
        satisfactory:
          "The methodology outlines the basic research procedures with moderate alignment to the objectives. Justification is provided but limited.",
        foundational:
          "The methodology lacks clarity and consistency, with weak alignment to the research objectives and inadequate justification.",
        novice:
          "The methodology is poorly structured or largely absent, with research methods that are inappropriate or disconnected.",
      },
      {
        key: "crit_g_prelim",
        title: "CRITERIA G: PRELIMINARY RESULTS / EXPECTED OUTCOME",
        type: "quantitative",
        weight: 5,
        maxScore: 4,
        exemplary:
          "Preliminary findings (where applicable) are presented clearly and supported by rigorous analysis using appropriate digital or analytical tools. Expected outcomes are precisely formulated.",
        proficient:
          "Preliminary findings are explained with clarity and supported by relevant data and tools. Expected outcomes are reasonably derived.",
        satisfactory:
          "Preliminary findings are reported with limited depth and supported by basic analysis. Expected outcomes are generally aligned.",
        foundational:
          "Preliminary findings are vaguely presented and lack analytical rigour. Expected outcomes are loosely connected.",
        novice:
          "Preliminary findings are absent or unclear, with no meaningful analytical support.",
      },
      {
        key: "crit_h_ethics",
        title: "CRITERIA H: METHOD RELIABILITY, VALIDITY AND ETHICS",
        type: "quantitative",
        weight: 5,
        maxScore: 4,
        exemplary:
          "Methodological reliability and validity are comprehensively addressed with well-reasoned justification and supported by appropriate references. Ethical considerations are thoroughly integrated.",
        proficient:
          "Methodological reliability and validity are adequately explained with reasonable justification. Ethical considerations are incorporated.",
        satisfactory:
          "Basic attention is given to methodological reliability and validity, though explanation may be general. Some ethical procedures are mentioned.",
        foundational:
          "Methodological reliability and validity are vaguely addressed. Ethical aspects are referenced but poorly defined.",
        novice:
          "Methodological reliability and validity are omitted. Ethical considerations are absent or misinterpreted.",
      },
      {
        key: "crit_i_org",
        title: "CRITERIA I: ORGANIZATION OF IDEAS",
        type: "quantitative",
        weight: 5,
        maxScore: 4,
        exemplary:
          "The proposal was written with exceptional clarity and coherence, demonstrating a logical and purposeful sequence of ideas. Transitions were seamless.",
        proficient:
          "The proposal was written in a clear and structured manner, with logical progression and effective transitions between sections.",
        satisfactory:
          "The proposal was written with a basic level of organisation, though occasional inconsistencies in flow or clarity were evident.",
        foundational:
          "The proposal was written with limited coherence and structure. Ideas were not consistently organised.",
        novice:
          "The proposal was written without clear structure or logical progression. Ideas appeared fragmented.",
      },
      {
        key: "crit_j_lang",
        title: "CRITERIA J: LANGUAGE AND WRITING STYLE",
        type: "quantitative",
        weight: 5,
        maxScore: 4,
        exemplary:
          "The proposal was written using precise, formal, and discipline-appropriate language throughout. Sentence structure and grammar consistently accurate.",
        proficient:
          "The proposal was written with generally accurate and formal language appropriate to the academic context.",
        satisfactory:
          "The proposal was written using language that was mostly appropriate, though lapses in grammar or clarity were occasionally evident.",
        foundational:
          "The proposal was written with frequent grammatical or structural errors that affected clarity.",
        novice:
          "The proposal was written with persistent language and grammatical issues that interfered with meaning.",
      },
      {
        key: "crit_k_ref",
        title: "CRITERIA K: REFERENCES AND CITATION",
        type: "quantitative",
        weight: 5,
        maxScore: 4,
        exemplary:
          "Demonstrates precise and consistent use of the required referencing style throughout. All citations are accurate and correctly formatted.",
        proficient:
          "Referencing style is applied correctly with only occasional minor errors. Sources are appropriately chosen.",
        satisfactory:
          "Referencing is generally appropriate but contains recurring formatting or citation errors.",
        foundational:
          "Referencing style is inconsistently applied, with frequent formatting errors and incomplete citations.",
        novice:
          "Shows little or no understanding of academic referencing. Citations are largely inaccurate or absent.",
      },
      {
        key: "crit_l_pres",
        title: "CRITERIA L: ORAL PRESENTATION SKILLS",
        type: "quantitative",
        weight: 5,
        maxScore: 4,
        exemplary:
          "Presentation delivered with clarity, confidence, and a strong academic presence. Ideas communicated logically and fluently.",
        proficient:
          "Presentation delivered clearly, with appropriate tone and structure. Key points effectively communicated.",
        satisfactory:
          "Presentation delivered with adequate clarity and structure, though some hesitation was evident.",
        foundational:
          "Presentation delivered with limited clarity and confidence. Content was poorly organised.",
        novice:
          "Presentation delivered in a disorganised and unclear manner. Key ideas poorly expressed.",
      },
      {
        key: "crit_m_qual",
        title: "PANEL'S FEEDBACK: STRENGTHS & WEAKNESSES",
        type: "qualitative",
        weight: 0,
        maxScore: 0,
        description:
          "Please elaborate on specific areas the candidate must improve before proceeding.",
      },
    ],
  },
  {
    name: "Pre-Oral Examination (Pre-Viva Voce) Rubric",
    sessionType: "PRE_VIVA",
    criteria: [
      {
        key: "crit_a_title",
        title: "CRITERIA A: THESIS TITLE",
        type: "quantitative",
        weight: 5,
        maxScore: 4,
        exemplary:
          "Title is concise, precise, and directly aligned with the core focus of the research. Articulated with clarity and academic rigour.",
        proficient:
          "Title is relevant, clearly worded, and appropriate to the research domain. Demonstrates a sound understanding.",
        satisfactory:
          "Identifies the general area of research and reflects an adequate level of understanding. Lacks specificity.",
        foundational:
          "Demonstrates limited familiarity with the subject area. The wording is vague or imprecise.",
        novice: "Unclear, unrelated, or unsuitable for academic inquiry.",
      },
      {
        key: "crit_b_abs",
        title: "CRITERIA B: ABSTRACT",
        type: "quantitative",
        weight: 5,
        maxScore: 4,
        exemplary:
          "Demonstrates high scholarly competence. Offers a precise, coherent, and methodologically sound synthesis.",
        proficient:
          "Presented in a well-organised and academically appropriate manner. Clearly identifies research problem.",
        satisfactory:
          "Constructs the abstract with reasonable academic coherence. Lacks critical depth.",
        foundational:
          "Demonstrates partial understanding. Ambiguously stated or underdeveloped.",
        novice: "Fails to construct a coherent abstract. Vague or fragmented.",
      },
      {
        key: "crit_c_prob",
        title: "CRITERIA C: PROBLEM STATEMENT",
        type: "quantitative",
        weight: 10,
        maxScore: 4,
        exemplary:
          "Well-defined, contextually grounded, and critically justified with relevant literature. Strong critical thinking.",
        proficient:
          "Clear and logical problem statement. Relevant and supported with appropriate background.",
        satisfactory:
          "Generally clear but may be overly broad. Rationale is not fully persuasive.",
        foundational:
          "Attempt made, but lacks sufficient clarity, specificity, or focus.",
        novice:
          "Does not provide a coherent or researchable problem statement.",
      },
      {
        key: "crit_d_obj",
        title: "CRITERIA D: OBJECTIVE OF STUDY",
        type: "quantitative",
        weight: 5,
        maxScore: 4,
        exemplary:
          "Articulates objectives with exceptional clarity and precision. Measurable and strong strategic focus.",
        proficient: "Objectives are clear, relevant, and appropriately scoped.",
        satisfactory:
          "Objectives are understandable and somewhat aligned, but may lack specificity.",
        foundational: "Objectives are vague, overly broad, or loosely related.",
        novice: "Does not present appropriate research objectives.",
      },
      {
        key: "crit_e_lit",
        title: "CRITERIA E: LITERATURE REVIEW",
        type: "quantitative",
        weight: 10,
        maxScore: 4,
        exemplary:
          "Shows critical engagement and synthesis of credible sources. Key debates articulated.",
        proficient:
          "Well-organised and clearly written. Evidence of critical discussion.",
        satisfactory:
          "Adequate coverage but tends to be more descriptive than analytical.",
        foundational: "Loosely structured with limited critical insight.",
        novice: "Poorly constructed, showing minimal critical engagement.",
      },
      {
        key: "crit_f_meth",
        title: "CRITERIA F: METHODOLOGY",
        type: "quantitative",
        weight: 10,
        maxScore: 4,
        exemplary:
          "Methodology is clearly articulated, rigorously justified, and highly appropriate.",
        proficient:
          "Methodology is logically structured and appropriate for the research aims.",
        satisfactory:
          "Methodology is generally appropriate, though may lack detail or strong justification.",
        foundational:
          "Methodology has minimal explanation. Procedures are loosely aligned.",
        novice: "Fails to present a viable methodology.",
      },
      {
        key: "crit_g_res",
        title: "CRITERIA G: RESULTS AND DISCUSSION / DATA ANALYSIS",
        type: "quantitative",
        weight: 10,
        maxScore: 4,
        exemplary:
          "Demonstrates critical analysis, with findings well-integrated and justified. Results synthesized insightfully.",
        proficient:
          "Clear and well-structured, effectively interpreting results and linking them to objectives.",
        satisfactory:
          "Addresses main findings with basic interpretation. Descriptive rather than critical.",
        foundational:
          "Shows minimal interpretation with limited engagement with literature.",
        novice: "Provides little or no meaningful analysis.",
      },
      {
        key: "crit_h_find",
        title: "CRITERIA H: PRESENTATION OF FINDINGS",
        type: "quantitative",
        weight: 5,
        maxScore: 4,
        exemplary:
          "Presented with clarity and logical flow, supported by accurate and well-designed visualisations.",
        proficient:
          "Findings presented with clarity and effective structure. Digital tools used appropriately.",
        satisfactory:
          "Generally clear but may lack depth or polish. Visuals may be simplistic.",
        foundational:
          "Struggles to present findings coherently. Use of tools is minimal or misapplied.",
        novice: "Presentation lacks structure and coherence.",
      },
      {
        key: "crit_i_eth",
        title: "CRITERIA I: DATA RELIABILITY, VALIDITY AND ETHICS",
        type: "quantitative",
        weight: 5,
        maxScore: 4,
        exemplary:
          "Demonstrates strong critical thinking in data analysis using well-justified methods. Rigorous ethical compliance.",
        proficient:
          "Applies suitable analytical methods to interpret data. Ethical considerations addressed.",
        satisfactory:
          "Basic competence in handling data. Ethical procedures partially implemented.",
        foundational:
          "Limited ability in organising data. Ethical considerations addressed superficially.",
        novice:
          "Unable to apply appropriate data analysis techniques. Ethical obligations not observed.",
      },
      {
        key: "crit_j_contrib",
        title: "CRITERIA J: CONTRIBUTION TO THE BODY OF KNOWLEDGE",
        type: "quantitative",
        weight: 10,
        maxScore: 4,
        exemplary:
          "Substantive and original contribution yielding novel theoretical constructs or innovations.",
        proficient:
          "Coherent and well-substantiated contribution addressing a relevant gap.",
        satisfactory:
          "Valid contribution addressing a defined question, though significance was limited.",
        foundational:
          "Limited contribution to knowledge addressing a narrowly defined issue.",
        novice: "Did not demonstrate a meaningful or credible contribution.",
      },
      {
        key: "crit_k_conc",
        title: "CRITERIA K: CONCLUSION AND RECOMMENDATIONS",
        type: "quantitative",
        weight: 5,
        maxScore: 4,
        exemplary:
          "Formulated conclusions reflecting a high level of synthesis. Original and analytically grounded.",
        proficient: "Presented coherent conclusions aligned with objectives.",
        satisfactory:
          "Presented acceptable conclusions derived from findings, limited in analytical depth.",
        foundational: "Presented basic conclusions with weak synthesis.",
        novice: "Failed to present coherent or substantiated conclusions.",
      },
      {
        key: "crit_l_org2",
        title: "CRITERIA L: ORGANIZATION OF IDEAS",
        type: "quantitative",
        weight: 5,
        maxScore: 4,
        exemplary:
          "Exceptional clarity and coherence. Logical progression of ideas.",
        proficient:
          "Ideas presented in a coherent and logically sequenced manner.",
        satisfactory:
          "Generally consistent structure, though some sections lacked cohesion.",
        foundational:
          "Basic attempt at organising content. Inconsistent sequencing.",
        novice: "Failed to organise thesis content in a coherent manner.",
      },
      {
        key: "crit_m_lang2",
        title: "CRITERIA M: LANGUAGE AND WRITING STYLE",
        type: "quantitative",
        weight: 5,
        maxScore: 4,
        exemplary:
          "Language consistently precise, scholarly, and aligned with disciplinary norms.",
        proficient:
          "Language appropriate to context with clear articulation of arguments.",
        satisfactory:
          "Acceptable academic language, with occasional imprecision.",
        foundational:
          "Limited control over academic writing conventions. Inconsistently structured.",
        novice: "Did not demonstrate proficiency in academic writing.",
      },
      {
        key: "crit_n_ref2",
        title: "CRITERIA N: REFERENCES AND CITATION",
        type: "quantitative",
        weight: 5,
        maxScore: 4,
        exemplary:
          "Precise and consistent use of required referencing style. All citations accurate.",
        proficient:
          "Style applied correctly with only occasional minor errors.",
        satisfactory:
          "Generally appropriate but contains recurring formatting or citation errors.",
        foundational:
          "Inconsistently applied, with frequent formatting errors and incomplete citations.",
        novice: "Shows little or no understanding of academic referencing.",
      },
      {
        key: "crit_o_pres2",
        title: "CRITERIA O: ORAL PRESENTATION SKILLS",
        type: "quantitative",
        weight: 2.5,
        maxScore: 4,
        exemplary:
          "Delivered a well-structured and analytically rigorous presentation.",
        proficient:
          "Presented coherently, showing a solid grasp of the objective.",
        satisfactory:
          "Communicated main aspects with reasonable clarity. Lacked consistency in fluency.",
        foundational:
          "Presented research with limited clarity and organisation.",
        novice:
          "Did not present the research in an academically appropriate manner.",
      },
      {
        key: "crit_p_delib",
        title: "CRITERIA P: DELIBERATIVE ORAL EVALUATION",
        type: "quantitative",
        weight: 2.5,
        maxScore: 4,
        exemplary:
          "Exceptional academic leadership, full autonomy, and deep sense of responsibility in defending the thesis.",
        proficient:
          "Displays strong academic independence and responsibility. Defence is well-structured.",
        satisfactory:
          "Shows adequate autonomy and a satisfactory level of responsibility.",
        foundational:
          "Demonstrates limited autonomy and emerging responsibility. Justifications are superficial.",
        novice: "Fails to exhibit autonomy, responsibility, or leadership.",
      },
      {
        key: "crit_qual_chairperson",
        title: "RECOMMENDATION TO CHAIRPERSON",
        type: "qualitative",
        weight: 0,
        maxScore: 0,
        description:
          "Specify whether the candidate requires minor amendments, major amendments, or re-evaluation before the final Viva Voce.",
      },
    ],
  },
  {
    name: "Progress Report Assessment Form",
    sessionType: "PROGRESS_ASSESSMENT",
    criteria: [
      {
        key: "prog_1_summary",
        title: "Summary of Research Progress",
        type: "qualitative",
        weight: 0,
        maxScore: 0,
        description:
          "Please summarize the student's progress since the last evaluation.",
      },
      {
        key: "prog_2_improve",
        title: "Comments for Improvement",
        type: "qualitative",
        weight: 0,
        maxScore: 0,
        description:
          "What specific areas require the student's immediate attention?",
      },
      {
        key: "prog_3_suggest",
        title: "Overall Suggestions",
        type: "qualitative",
        weight: 0,
        maxScore: 0,
        description:
          "Provide final recommendations for the next phase of research.",
      },
    ],
  },
];

const seedDatabase = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("✅ Database connected.\n");

    //Cleared Timetables instead of deprecated Sessions
    await PermissionRequest.deleteMany({});
    await Attendance.deleteMany({});
    await Evaluation.deleteMany({});
    await Timetable.deleteMany({});
    await Rubric.deleteMany({});
    await User.deleteMany({});
    await SessionBatch.deleteMany({});

    // 1. Create Rubrics
    console.log("📚 Seeding UTHM Rubric Templates with FULL Criteria...");
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

    // 2. Create Admins (Unified without SuperAdmin)
    console.log("👨‍💼 Seeding Administrators...");
    const adminUsers = [
      {
        userId: "admin_samihah",
        name: "CHE SAMIHAH BINTI CHE DALIM",
        email: "samihah@uthm.edu.my",
        role: "admin",
        registrationCode: "temp",
        // 🔴 FIXED: Since admins can be assigned to panels now, give them tags!
        expertiseTags: ["System Architecture", "Software Engineering", "HCI"],
      },
      {
        userId: "admin_pendaftar",
        name: "PENDAFTAR FSKTM",
        email: "pendaftar.fsktm@uthm.edu.my",
        role: "admin",
        registrationCode: "temp",
      },
    ];
    let allUsers = await User.create(adminUsers);

    // 3. Create Stable Demo Panels
    console.log("👥 Seeding 5 Demo Panel Accounts...");

    const demoPanels = [
      {
        userId: "panel_zkp",
        name: "NUR ZIADAH BINTI HARUN",
        email: "panel.zkp@example.com",
        role: "panel",
        profession: "Senior Lecturer",
        registrationCode: "PANEL001",
        expertiseTags: [
          "Zero-Knowledge Proof",
          "Cryptography",
          "Passwordless Authentication",
          "Information Security",
          "Authentication",
          "Blockchain",
        ],
      },
      {
        userId: "panel_ai",
        name: "SHAHREEN BINTI KASIM",
        email: "panel.ai@example.com",
        role: "panel",
        profession: "Senior Lecturer",
        registrationCode: "PANEL002",
        expertiseTags: [
          "Artificial Intelligence",
          "Machine Learning",
          "Deep Learning",
          "Data Mining",
        ],
      },
      {
        userId: "panel_blockchain",
        name: "SAPI'EE BIN JAMEL",
        email: "panel.blockchain@example.com",
        role: "panel",
        profession: "Senior Lecturer",
        registrationCode: "PANEL003",
        expertiseTags: [
          "Blockchain",
          "Smart Contract",
          "Healthcare Information Systems",
          "Distributed Ledger",
        ],
      },
      {
        userId: "panel_web",
        name: "NUR LIYANA BINTI SULAIMAN",
        email: "panel.web@example.com",
        role: "panel",
        profession: "Senior Lecturer",
        registrationCode: "PANEL004",
        expertiseTags: [
          "Web Application",
          "Software Engineering",
          "React",
          "Node.js",
          "Usability Testing",
        ],
      },
      {
        userId: "panel_network",
        name: "ZUBAILE BIN ABDULLAH",
        email: "panel.network@example.com",
        role: "panel",
        profession: "Senior Lecturer",
        registrationCode: "PANEL005",
        expertiseTags: [
          "Computer Networks",
          "IoT",
          "Cloud Computing",
          "Distributed Systems",
        ],
      },
    ];

    const createdPanels = await User.create(demoPanels);
    allUsers = [...allUsers, ...createdPanels];

    // 4. Create Students and Assign Supervisors
    console.log("🎓 Seeding Students and assigning Supervisors securely...");

    const studentUsers = [
      {
        userId: "AW240001",
        matricNumber: "AW240001",
        name: "Muhammad Ali",
        email: "ali@student.uthm.edu.my",
        role: "student",
        registrationCode: "111111",
        program: "Master of Information Technology",
        researchTitle: "Optimization of Zero-Knowledge Proof Authentication",
        researchAbstract:
          "This research focuses on optimizing zero-knowledge proof authentication for passwordless login in a web-based evaluation system.",
        supervisorId: createdPanels[0]._id,
      },
      {
        userId: "AW240002",
        matricNumber: "AW240002",
        name: "Siti Nuraisyah",
        email: "siti@student.uthm.edu.my",
        role: "student",
        registrationCode: "222222",
        program: "PhD in Computer Science",
        researchTitle: "Advanced Deep Learning Models for Academic Prediction",
        researchAbstract:
          "This research explores advanced deep learning models for intelligent prediction and classification tasks in academic data environments.",
        supervisorId: createdPanels[1]._id,
      },
      {
        userId: "AW240003",
        matricNumber: "AW240003",
        name: "Chong Wei Ming",
        email: "chong@student.uthm.edu.my",
        role: "student",
        registrationCode: "333333",
        program: "Master of Software Engineering",
        researchTitle: "Blockchain-Based Healthcare Information System",
        researchAbstract:
          "This study proposes a blockchain-based healthcare information system to improve data integrity, auditability, and secure sharing.",
        supervisorId: createdPanels[2]._id,
      },
      {
        userId: "AW240004",
        matricNumber: "AW240004",
        name: "Tan Mei Ling",
        email: "meiling@student.uthm.edu.my",
        role: "student",
        registrationCode: "444444",
        program: "Master of Information Security",
        researchTitle: "Secure Online Evaluation Workflow Using ZKP",
        researchAbstract:
          "This research designs a secure online evaluation workflow using zero-knowledge proof authentication and role-based access control.",
        supervisorId: createdPanels[3]._id,
      },
      {
        userId: "AW240005",
        matricNumber: "AW240005",
        name: "Nur Aina Zulkifli",
        email: "aina@student.uthm.edu.my",
        role: "student",
        registrationCode: "555555",
        program: "Master of Information Security",
        researchTitle: "Privacy-Preserving Authentication for Academic Systems",
        researchAbstract:
          "This research investigates privacy-preserving authentication methods for academic web systems using cryptographic verification.",
        supervisorId: createdPanels[0]._id,
      },
      {
        userId: "AW240006",
        matricNumber: "AW240006",
        name: "Ahmad Danish Hakimi",
        email: "danish@student.uthm.edu.my",
        role: "student",
        registrationCode: "666666",
        program: "Master of Computer Science",
        researchTitle:
          "Natural Language Processing for Academic Feedback Analysis",
        researchAbstract:
          "This research applies natural language processing to analyze evaluation comments and identify feedback patterns.",
        supervisorId: createdPanels[1]._id,
      },
      {
        userId: "AW240007",
        matricNumber: "AW240007",
        name: "Priya Nair",
        email: "priya@student.uthm.edu.my",
        role: "student",
        registrationCode: "777777",
        program: "PhD in Computer Science",
        researchTitle: "Smart Contract Audit Trail for Research Evaluation",
        researchAbstract:
          "This study explores smart contract mechanisms for transparent and verifiable audit trails in academic evaluation workflows.",
        supervisorId: createdPanels[2]._id,
      },
      {
        userId: "AW240008",
        matricNumber: "AW240008",
        name: "Lim Jia Wei",
        email: "jiawei@student.uthm.edu.my",
        role: "student",
        registrationCode: "888888",
        program: "Master of Software Engineering",
        researchTitle: "Usability Evaluation of Web-Based Assessment Platforms",
        researchAbstract:
          "This research evaluates usability factors in web-based academic assessment platforms through structured user testing.",
        supervisorId: createdPanels[3]._id,
      },
      {
        userId: "AW240009",
        matricNumber: "AW240009",
        name: "Mohd Hafiz Rahman",
        email: "hafiz@student.uthm.edu.my",
        role: "student",
        registrationCode: "999999",
        program: "Master of Computer Networks",
        researchTitle: "IoT Network Monitoring for Smart Campus Environments",
        researchAbstract:
          "This research develops an IoT network monitoring approach for smart campus environments with emphasis on reliability and scalability.",
        supervisorId: createdPanels[4]._id,
      },
      {
        userId: "AW240010",
        matricNumber: "AW240010",
        name: "Amira Sofea",
        email: "amira@student.uthm.edu.my",
        role: "student",
        registrationCode: "101010",
        program: "Master of Cloud Computing",
        researchTitle:
          "Cloud-Based Monitoring Framework for Distributed Applications",
        researchAbstract:
          "This research proposes a cloud-based monitoring framework for distributed applications using scalable service metrics.",
        supervisorId: createdPanels[4]._id,
      },
    ];

    const createdStudents = await User.create(studentUsers);
    allUsers = [...allUsers, ...createdStudents];
    const getUserId = (email) => allUsers.find((u) => u.email === email)._id;

    console.log("🔗 Saving Panel Assignments to Database...");

    const panelAssignmentMap = [
      {
        studentEmail: "ali@student.uthm.edu.my",
        panelIds: [createdPanels[0]._id, createdPanels[1]._id],
      },
      {
        studentEmail: "siti@student.uthm.edu.my",
        panelIds: [createdPanels[1]._id, createdPanels[2]._id],
      },
      {
        studentEmail: "chong@student.uthm.edu.my",
        panelIds: [createdPanels[2]._id, createdPanels[3]._id],
      },
      {
        studentEmail: "meiling@student.uthm.edu.my",
        panelIds: [createdPanels[3]._id, createdPanels[0]._id],
      },
      {
        studentEmail: "aina@student.uthm.edu.my",
        panelIds: [createdPanels[0]._id, createdPanels[4]._id],
      },
      {
        studentEmail: "danish@student.uthm.edu.my",
        panelIds: [createdPanels[1]._id, createdPanels[3]._id],
      },
      {
        studentEmail: "priya@student.uthm.edu.my",
        panelIds: [createdPanels[2]._id, createdPanels[4]._id],
      },
      {
        studentEmail: "jiawei@student.uthm.edu.my",
        panelIds: [createdPanels[3]._id, createdPanels[1]._id],
      },
      {
        studentEmail: "hafiz@student.uthm.edu.my",
        panelIds: [createdPanels[4]._id, createdPanels[0]._id],
      },
      {
        studentEmail: "amira@student.uthm.edu.my",
        panelIds: [createdPanels[4]._id, createdPanels[2]._id],
      },
    ];

    for (const assignment of panelAssignmentMap) {
      const studentId = getUserId(assignment.studentEmail);

      await User.findByIdAndUpdate(studentId, {
        $set: {
          assignedPanels: assignment.panelIds.map((panelId) => ({
            panelId,
            startDate: new Date(),
            endDate: null,
          })),
        },
      });

      for (const panelId of assignment.panelIds) {
        await User.findByIdAndUpdate(panelId, {
          $addToSet: {
            assignedStudents: studentId,
          },
        });
      }
    }

    // 5. Create Sessions (Using Timetable Model)
    console.log("📅 Seeding Evaluation Sessions...");

    // 🔴 FIXED: Added rubricId directly to the Timetable schema to prevent frontend errors
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 2);

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);

    const lastMonth = new Date();
    lastMonth.setDate(lastMonth.getDate() - 30);

    const lastWeek = new Date();
    lastWeek.setDate(lastWeek.getDate() - 7);

    const inThreeDays = new Date();
    inThreeDays.setDate(inThreeDays.getDate() + 3);

    const inTwoWeeks = new Date();
    inTwoWeeks.setDate(inTwoWeeks.getDate() + 14);

    const inThreeWeeks = new Date();
    inThreeWeeks.setDate(inThreeWeeks.getDate() + 21);

    const inOneMonth = new Date();
    inOneMonth.setDate(inOneMonth.getDate() + 30);

    const mainBatchDate = inThreeDays;
    const mainBatchId = "BATCH-PRS-2026-MAIN";
    const mainBatchName = "FSKTM PRS Main Batch";
    const mainBatchMeetLink = "https://meet.google.com/fsktm-prs-main";

    const completedHistoryBatchDate = lastWeek;
    const completedHistoryBatchId = "BATCH-HIST-2025-A";
    const completedHistoryBatchName = "FSKTM Completed Progress History";
    const completedHistoryMeetLink =
      "https://meet.google.com/fsktm-progress-history";

    await SessionBatch.create([
      {
        batchName: "FSKTM PRS Demo Batch A",
        batchId: "BATCH-PRS-2026-A",
        academicSession: "2025/2026, Semester 1",
        scheduleTitle: "Postgraduate Progress Presentation Schedule",
        sessionType: "PROPOSAL_DEFENSE",
        rubricId: proposalRubric._id,
        date: tomorrow,
        startTime: "10:00",
        slotDurationMinutes: 60,
        breakBetweenSlotsMinutes: 5,
        googleMeetLink: "https://meet.google.com/fsktm-prs-demo-a",
        status: "active",
        createdBy: getUserId("samihah@uthm.edu.my"),
      },
      {
        batchName: "FSKTM PRS Demo Batch B",
        batchId: "BATCH-PRS-2026-B",
        academicSession: "2025/2026, Semester 1",
        scheduleTitle: "Postgraduate Progress Presentation Schedule",
        sessionType: "PROPOSAL_DEFENSE",
        rubricId: proposalRubric._id,
        date: lastMonth,
        startTime: "09:30",
        slotDurationMinutes: 60,
        breakBetweenSlotsMinutes: 5,
        googleMeetLink: "https://meet.google.com/fsktm-prs-demo-b",
        status: "active",
        createdBy: getUserId("samihah@uthm.edu.my"),
      },
      {
        batchName: "FSKTM PRS Demo Batch C",
        batchId: "BATCH-PRS-2026-C",
        academicSession: "2025/2026, Semester 1",
        scheduleTitle: "Postgraduate Progress Presentation Schedule",
        sessionType: "PRE_VIVA",
        rubricId: preVivaRubric._id,
        date: inTwoWeeks,
        startTime: "13:00",
        slotDurationMinutes: 60,
        breakBetweenSlotsMinutes: 5,
        googleMeetLink: "https://meet.google.com/fsktm-prs-demo-c",
        status: "active",
        createdBy: getUserId("samihah@uthm.edu.my"),
      },
      {
        batchName: mainBatchName,
        batchId: mainBatchId,
        academicSession: "2025/2026, Semester 1",
        scheduleTitle: "Postgraduate Progress Presentation Schedule",
        sessionType: "PROPOSAL_DEFENSE",
        rubricId: proposalRubric._id,
        date: mainBatchDate,
        startTime: "09:00",
        slotDurationMinutes: 60,
        breakBetweenSlotsMinutes: 5,
        googleMeetLink: mainBatchMeetLink,
        status: "active",
        createdBy: getUserId("samihah@uthm.edu.my"),
      },
      {
        batchName: completedHistoryBatchName,
        batchId: completedHistoryBatchId,
        academicSession: "2024/2025, Semester 2",
        scheduleTitle: "Postgraduate Progress Presentation Schedule",
        sessionType: "PROGRESS_ASSESSMENT",
        rubricId: progressRubric._id,
        date: completedHistoryBatchDate,
        startTime: "09:00",
        slotDurationMinutes: 45,
        breakBetweenSlotsMinutes: 5,
        googleMeetLink: completedHistoryMeetLink,
        status: "completed",
        createdBy: getUserId("samihah@uthm.edu.my"),
      },
    ]);

    const addMinutesToHHMM = (time, minutesToAdd) => {
      const [hours, minutes] = time.split(":").map(Number);
      const date = new Date();
      date.setHours(hours, minutes + minutesToAdd, 0, 0);
      return date.toTimeString().slice(0, 5);
    };

    const batchSessionPlan = [
      {
        studentEmail: "ali@student.uthm.edu.my",
        panels: [createdPanels[0]._id, createdPanels[1]._id],
      },
      {
        studentEmail: "siti@student.uthm.edu.my",
        panels: [createdPanels[1]._id, createdPanels[2]._id],
      },
      {
        studentEmail: "chong@student.uthm.edu.my",
        panels: [createdPanels[2]._id, createdPanels[3]._id],
      },
      {
        studentEmail: "meiling@student.uthm.edu.my",
        panels: [createdPanels[3]._id, createdPanels[0]._id],
      },
      {
        studentEmail: "aina@student.uthm.edu.my",
        panels: [createdPanels[0]._id, createdPanels[4]._id],
      },
      {
        studentEmail: "danish@student.uthm.edu.my",
        panels: [createdPanels[1]._id, createdPanels[3]._id],
      },
      {
        studentEmail: "priya@student.uthm.edu.my",
        panels: [createdPanels[2]._id, createdPanels[4]._id],
      },
      {
        studentEmail: "jiawei@student.uthm.edu.my",
        panels: [createdPanels[3]._id, createdPanels[1]._id],
      },
      {
        studentEmail: "hafiz@student.uthm.edu.my",
        panels: [createdPanels[4]._id, createdPanels[0]._id],
      },
      {
        studentEmail: "amira@student.uthm.edu.my",
        panels: [createdPanels[4]._id, createdPanels[2]._id],
      },
    ];

    const completedHistoryPlan = panelAssignmentMap.map(
      ({ studentEmail, panelIds }) => ({
        studentEmail,
        panels: panelIds,
      }),
    );

    const sessionsData = [
      // Case 1: Upcoming proposal defense, evaluations pending
      {
        students: [getUserId("ali@student.uthm.edu.my")],
        panels: [getUserId("samihah@uthm.edu.my"), createdPanels[1]._id],
        title: "Proposal Defense - Muhammad Ali",
        sessionType: "PROPOSAL_DEFENSE",
        rubricId: proposalRubric._id,
        date: tomorrow,
        startTime: "10:00",
        endTime: "11:00",
        venue: "meet.google.com/ali-proposal-demo",
        status: "scheduled",
      },

      // Case 2: Completed Pre-Viva, official report should publish
      {
        students: [getUserId("siti@student.uthm.edu.my")],
        panels: [getUserId("samihah@uthm.edu.my"), createdPanels[2]._id],
        title: "Pre-Viva - Siti Nuraisyah",
        sessionType: "PRE_VIVA",
        rubricId: preVivaRubric._id,
        date: yesterday,
        startTime: "14:30",
        endTime: "15:30",
        venue: "https://teams.microsoft.com/l/meetup-join/siti-previva-demo",
        status: "completed",
      },

      // Case 3: Completed qualitative-only Progress Assessment
      {
        students: [getUserId("chong@student.uthm.edu.my")],
        panels: [getUserId("samihah@uthm.edu.my"), createdPanels[3]._id],
        title: "Progress Assessment - Chong Wei Ming",
        sessionType: "PROGRESS_ASSESSMENT",
        rubricId: progressRubric._id,
        date: yesterday,
        startTime: "09:00",
        endTime: "10:00",
        venue: "zoom.us/j/1234567890",
        status: "completed",
      },

      // Case 4: Pending publication, only one panel completed
      {
        students: [getUserId("meiling@student.uthm.edu.my")],
        panels: [createdPanels[1]._id, createdPanels[2]._id],
        title: "Proposal Defense - Tan Mei Ling",
        sessionType: "PROPOSAL_DEFENSE",
        rubricId: proposalRubric._id,
        date: nextWeek,
        startTime: "11:30",
        endTime: "12:30",
        venue: "https://meet.google.com/meiling-proposal-demo",
        status: "scheduled",
      },
      // Case 5: Siti completed Proposal Defense, scored official report
      {
        students: [getUserId("siti@student.uthm.edu.my")],
        panels: [getUserId("samihah@uthm.edu.my"), createdPanels[1]._id],
        title: "Proposal Defense - Siti Nuraisyah",
        sessionType: "PROPOSAL_DEFENSE",
        rubricId: proposalRubric._id,
        date: lastMonth,
        startTime: "09:30",
        endTime: "10:30",
        venue: "meet.google.com/siti-proposal-completed-demo",
        status: "completed",
      },

      // Case 6: Ali completed qualitative Progress Assessment
      {
        students: [getUserId("ali@student.uthm.edu.my")],
        panels: [getUserId("samihah@uthm.edu.my"), createdPanels[1]._id],
        title: "Progress Assessment - Muhammad Ali",
        sessionType: "PROGRESS_ASSESSMENT",
        rubricId: progressRubric._id,
        date: lastWeek,
        startTime: "15:00",
        endTime: "16:00",
        venue: "https://zoom.us/j/9876543210",
        status: "completed",
      },

      // Case 7: Ali upcoming Pre-Viva, both pending
      {
        students: [getUserId("ali@student.uthm.edu.my")],
        panels: [getUserId("samihah@uthm.edu.my"), createdPanels[2]._id],
        title: "Pre-Viva - Muhammad Ali",
        sessionType: "PRE_VIVA",
        rubricId: preVivaRubric._id,
        date: inThreeWeeks,
        startTime: "10:30",
        endTime: "11:30",
        venue: "teams.microsoft.com/l/meetup-join/ali-previva-pending-demo",
        status: "scheduled",
      },

      // Case 8: Chong upcoming Pre-Viva, both pending
      {
        students: [getUserId("chong@student.uthm.edu.my")],
        panels: [createdPanels[2]._id, createdPanels[3]._id],
        title: "Pre-Viva - Chong Wei Ming",
        sessionType: "PRE_VIVA",
        rubricId: preVivaRubric._id,
        date: inTwoWeeks,
        startTime: "13:00",
        endTime: "14:00",
        venue: "meet.google.com/chong-previva-pending-demo",
        status: "scheduled",
      },

      // Case 9: Mei Ling completed qualitative Progress Assessment
      {
        students: [getUserId("meiling@student.uthm.edu.my")],
        panels: [createdPanels[1]._id, createdPanels[2]._id],
        title: "Progress Assessment - Tan Mei Ling",
        sessionType: "PROGRESS_ASSESSMENT",
        rubricId: progressRubric._id,
        date: lastWeek,
        startTime: "16:00",
        endTime: "17:00",
        venue: "https://meet.google.com/meiling-progress-completed-demo",
        status: "completed",
      },

      // Case 10: Siti upcoming Progress Assessment, both pending
      {
        students: [getUserId("siti@student.uthm.edu.my")],
        panels: [getUserId("samihah@uthm.edu.my"), createdPanels[2]._id],
        title: "Progress Assessment - Siti Nuraisyah",
        sessionType: "PROGRESS_ASSESSMENT",
        rubricId: progressRubric._id,
        date: inOneMonth,
        startTime: "11:00",
        endTime: "12:00",
        venue: "https://zoom.us/j/2223334445",
        status: "scheduled",
      },
    ];

    sessionsData.push(
      {
        students: [getUserId("siti@student.uthm.edu.my")],
        panels: [createdPanels[0]._id, createdPanels[3]._id],
        title: "Demo Access Session - Siti Nuraisyah",
        sessionType: "PROGRESS_ASSESSMENT",
        rubricId: progressRubric._id,
        date: inThreeDays,
        startTime: "09:00",
        endTime: "10:00",
        venue: "https://meet.google.com/demo-siti-zkp-web",
        status: "scheduled",
      },
      {
        students: [getUserId("meiling@student.uthm.edu.my")],
        panels: [createdPanels[0]._id, createdPanels[4]._id],
        title: "Demo Access Session - Tan Mei Ling",
        sessionType: "PRE_VIVA",
        rubricId: preVivaRubric._id,
        date: inTwoWeeks,
        startTime: "15:00",
        endTime: "16:00",
        venue: "https://meet.google.com/demo-meiling-zkp-network",
        status: "scheduled",
      },
      {
        students: [getUserId("ali@student.uthm.edu.my")],
        panels: [createdPanels[4]._id, createdPanels[3]._id],
        title: "Demo Access Session - Muhammad Ali",
        sessionType: "PROPOSAL_DEFENSE",
        rubricId: proposalRubric._id,
        date: inOneMonth,
        startTime: "14:00",
        endTime: "15:00",
        venue: "https://meet.google.com/demo-ali-network-web",
        status: "scheduled",
      },
    );

    sessionsData.push(
      ...batchSessionPlan.map((slot, index) => {
        const student = allUsers.find((u) => u.email === slot.studentEmail);
        const startTime = addMinutesToHHMM("09:00", index * 65);
        const endTime = addMinutesToHHMM(startTime, 60);

        return {
          students: [getUserId(slot.studentEmail)],
          panels: slot.panels,
          title: `Batch Presentation - ${student.name}`,
          sessionType: "PROPOSAL_DEFENSE",
          rubricId: proposalRubric._id,
          date: mainBatchDate,
          startTime,
          endTime,
          venue: mainBatchMeetLink,
          googleMeetLink: mainBatchMeetLink,
          status: "scheduled",
          batchId: mainBatchId,
          batchName: mainBatchName,
          academicSession: "2025/2026, Semester 1",
          scheduleTitle: "Postgraduate Progress Presentation Schedule",
          slotDurationMinutes: 60,
          breakBetweenSlotsMinutes: 5,
        };
      }),
    );

    sessionsData.push(
      ...completedHistoryPlan.map((slot, index) => {
        const student = allUsers.find((u) => u.email === slot.studentEmail);
        const startTime = addMinutesToHHMM("09:00", index * 50);
        const endTime = addMinutesToHHMM(startTime, 45);

        return {
          students: [getUserId(slot.studentEmail)],
          panels: slot.panels,
          title: `Completed Progress Review - ${student.name}`,
          sessionType: "PROGRESS_ASSESSMENT",
          rubricId: progressRubric._id,
          date: completedHistoryBatchDate,
          startTime,
          endTime,
          venue: completedHistoryMeetLink,
          googleMeetLink: completedHistoryMeetLink,
          status: "completed",
          batchId: completedHistoryBatchId,
          batchName: completedHistoryBatchName,
          academicSession: "2024/2025, Semester 2",
          scheduleTitle: "Postgraduate Progress Presentation Schedule",
          slotDurationMinutes: 45,
          breakBetweenSlotsMinutes: 5,
          studentDocuments: [
            {
              title: `${student.name} Progress Report`,
              url: "https://drive.google.com/file/d/demo-progress-report",
              source: "external-link",
              type: "report",
              uploadedBy: getUserId(slot.studentEmail),
              description:
                "Seeded progress report uploaded by the student for a completed evaluation.",
            },
            {
              title: `${student.name} Presentation Slides`,
              url: "https://drive.google.com/file/d/demo-progress-slides",
              source: "external-link",
              type: "slides",
              uploadedBy: getUserId(slot.studentEmail),
              description:
                "Seeded presentation slides uploaded by the student for completed panel review.",
            },
          ],
        };
      }),
    );

    const enrichedSessionsData = sessionsData.map((session, index) => {
      const batchInfo =
        index < 4
          ? {
              batchId: "BATCH-PRS-2026-A",
              batchName: "FSKTM PRS Demo Batch A",
              googleMeetLink: "https://meet.google.com/fsktm-prs-demo-a",
            }
          : index < 7
            ? {
                batchId: "BATCH-PRS-2026-B",
                batchName: "FSKTM PRS Demo Batch B",
                googleMeetLink: "https://meet.google.com/fsktm-prs-demo-b",
              }
            : {
                batchId: "BATCH-PRS-2026-C",
                batchName: "FSKTM PRS Demo Batch C",
                googleMeetLink: "https://meet.google.com/fsktm-prs-demo-c",
              };

      return {
        ...session,
        batchId: session.batchId || batchInfo.batchId,
        batchName: session.batchName || batchInfo.batchName,
        academicSession: session.academicSession || "2025/2026, Semester 1",
        scheduleTitle:
          session.scheduleTitle ||
          "Postgraduate Progress Presentation Schedule",
        googleMeetLink: session.googleMeetLink || batchInfo.googleMeetLink,
        venue:
          session.venue || session.googleMeetLink || batchInfo.googleMeetLink,
        slotDurationMinutes: session.slotDurationMinutes || 60,
        breakBetweenSlotsMinutes:
          session.breakBetweenSlotsMinutes === undefined
            ? 5
            : session.breakBetweenSlotsMinutes,
        createdBy: getUserId("samihah@uthm.edu.my"),
        studentDocuments: session.studentDocuments || [
          {
            title: `${session.title} Demo Report`,
            url: "https://drive.google.com/",
            source: "external-link",
            type: "report",
            uploadedBy: session.students[0],
            description: "Seeded demo material for panel review testing.",
          },
          {
            title: `${session.title} Demo Slides`,
            url: "https://drive.google.com/",
            source: "external-link",
            type: "slides",
            uploadedBy: session.students[0],
            description: "Seeded demo presentation slides.",
          },
        ],
      };
    });

    const createdSessions = await Timetable.create(enrichedSessionsData);

    const getSessionIdByTitle = (title) => {
      const session = createdSessions.find((s) => s.title === title);

      if (!session) {
        throw new Error(`Seed session not found: ${title}`);
      }

      return session._id;
    };

    // 6. Auto-Create Evaluations
    console.log("📋 Seeding evaluations linked to Rubrics...");
    const makeScoreMapFromValues = (rubric, values = {}) => {
      const map = {};

      rubric.criteria
        .filter((criterion) => criterion.type === "quantitative")
        .forEach((criterion) => {
          map[criterion.key] = values[criterion.key] ?? 3;
        });

      return map;
    };

    const makeQualitativeMap = (rubric, text) => {
      const map = {};

      rubric.criteria
        .filter((criterion) => criterion.type === "qualitative")
        .forEach((criterion) => {
          map[criterion.key] = text;
        });

      return map;
    };
    const evaluationsData = [
      // Case 1: Ali upcoming proposal defense, both pending
      {
        sessionId: createdSessions[0]._id,
        rubricId: proposalRubric._id,
        studentId: getUserId("ali@student.uthm.edu.my"),
        evaluatorId: getUserId("samihah@uthm.edu.my"),
        semester: "Semester 1, 2025/2026",
        sessionType: "PROPOSAL_DEFENSE",
        status: "PENDING",
      },
      {
        sessionId: createdSessions[0]._id,
        rubricId: proposalRubric._id,
        studentId: getUserId("ali@student.uthm.edu.my"),
        evaluatorId: createdPanels[1]._id,
        semester: "Semester 1, 2025/2026",
        sessionType: "PROPOSAL_DEFENSE",
        status: "PENDING",
      },

      // Case 2: Siti completed Pre-Viva, both panels completed
      {
        sessionId: createdSessions[1]._id,
        rubricId: preVivaRubric._id,
        studentId: getUserId("siti@student.uthm.edu.my"),
        evaluatorId: getUserId("samihah@uthm.edu.my"),
        semester: "Semester 1, 2025/2026",
        sessionType: "PRE_VIVA",
        status: "COMPLETED",
        totalMarks: 76.25,
        scores: makeScoreMapFromValues(preVivaRubric, {
          crit_a_title: 3,
          crit_b_abs: 4,
          crit_c_prob: 3,
          crit_d_obj: 3,
          crit_e_lit: 2,
          crit_f_meth: 4,
          crit_g_res: 3,
          crit_h_find: 3,
          crit_i_eth: 4,
          crit_j_contrib: 2,
          crit_k_conc: 3,
          crit_l_org2: 3,
          crit_m_lang2: 3,
          crit_n_ref2: 2,
          crit_o_pres2: 3,
          crit_p_delib: 3,
        }),
        qualitativeFeedback: makeQualitativeMap(
          preVivaRubric,
          "PASS. The candidate demonstrates solid understanding and adequate scholarly contribution. Minor improvements are required in literature structure and methodological explanation.",
        ),
        overallComments:
          "The candidate demonstrates strong understanding and is ready to proceed with minor corrections.",
      },
      {
        sessionId: createdSessions[1]._id,
        rubricId: preVivaRubric._id,
        studentId: getUserId("siti@student.uthm.edu.my"),
        evaluatorId: createdPanels[2]._id,
        semester: "Semester 1, 2025/2026",
        sessionType: "PRE_VIVA",
        status: "COMPLETED",
        totalMarks: 81.5,
        scores: makeScoreMapFromValues(preVivaRubric, {
          crit_a_title: 4,
          crit_b_abs: 3,
          crit_c_prob: 3,
          crit_d_obj: 4,
          crit_e_lit: 3,
          crit_f_meth: 3,
          crit_g_res: 3,
          crit_h_find: 4,
          crit_i_eth: 3,
          crit_j_contrib: 3,
          crit_k_conc: 3,
          crit_l_org2: 4,
          crit_m_lang2: 3,
          crit_n_ref2: 3,
          crit_o_pres2: 3,
          crit_p_delib: 4,
        }),
        qualitativeFeedback: makeQualitativeMap(
          preVivaRubric,
          "PASS with minor amendments. The contribution is acceptable, but the candidate should improve the abstract, literature synthesis, and conclusion flow.",
        ),
        overallComments:
          "Good research maturity. The candidate should refine presentation of findings and thesis structure.",
      },

      // Case 3: Chong completed qualitative-only Progress Assessment
      {
        sessionId: createdSessions[2]._id,
        rubricId: progressRubric._id,
        studentId: getUserId("chong@student.uthm.edu.my"),
        evaluatorId: getUserId("samihah@uthm.edu.my"),
        semester: "Semester 1, 2025/2026",
        sessionType: "PROGRESS_ASSESSMENT",
        status: "COMPLETED",
        summaryOfProgress:
          "The student has completed the system architecture, core backend API, and initial frontend integration.",
        commentsForImprovement:
          "The student should improve evaluation workflow validation and ensure consistent data formatting across routes.",
        overallSuggestions:
          "Proceed with usability testing and strengthen documentation for the ZKP authentication flow.",
      },
      {
        sessionId: createdSessions[2]._id,
        rubricId: progressRubric._id,
        studentId: getUserId("chong@student.uthm.edu.my"),
        evaluatorId: createdPanels[3]._id,
        semester: "Semester 1, 2025/2026",
        sessionType: "PROGRESS_ASSESSMENT",
        status: "COMPLETED",
        summaryOfProgress:
          "The student has shown consistent progress and has prepared a working prototype for demonstration.",
        commentsForImprovement:
          "More testing is required for attendance, session details, and role-based UI hiding.",
        overallSuggestions:
          "Continue improving demo data coverage and prepare screenshots for final documentation.",
      },

      // Case 4: Mei Ling pending publication, one completed and one pending
      {
        sessionId: createdSessions[3]._id,
        rubricId: proposalRubric._id,
        studentId: getUserId("meiling@student.uthm.edu.my"),
        evaluatorId: createdPanels[1]._id,
        semester: "Semester 1, 2025/2026",
        sessionType: "PROPOSAL_DEFENSE",
        status: "COMPLETED",
        totalMarks: 68.0,
        scores: makeScoreMapFromValues(proposalRubric, {
          crit_a_title: 3,
          crit_b_exec_summary: 2,
          crit_c_problem: 2,
          crit_d_objective: 3,
          crit_e_literature: 2,
          crit_f_methodology: 2,
          crit_g_prelim: 2,
          crit_h_ethics: 3,
          crit_i_org: 3,
          crit_j_lang: 3,
          crit_k_ref: 2,
          crit_l_pres: 3,
        }),
        qualitativeFeedback: makeQualitativeMap(
          proposalRubric,
          "The research direction is promising but the methodology and research questions require refinement.",
        ),
        overallComments:
          "The student needs to sharpen the problem statement and justify the selected methodology.",
      },
      {
        sessionId: createdSessions[3]._id,
        rubricId: proposalRubric._id,
        studentId: getUserId("meiling@student.uthm.edu.my"),
        evaluatorId: createdPanels[2]._id,
        semester: "Semester 1, 2025/2026",
        sessionType: "PROPOSAL_DEFENSE",
        status: "PENDING",
      },
      // Case 5: Siti completed Proposal Defense, both panels completed
      {
        sessionId: getSessionIdByTitle("Proposal Defense - Siti Nuraisyah"),
        rubricId: proposalRubric._id,
        studentId: getUserId("siti@student.uthm.edu.my"),
        evaluatorId: getUserId("samihah@uthm.edu.my"),
        semester: "Semester 2, 2024/2025",
        sessionType: "PROPOSAL_DEFENSE",
        status: "COMPLETED",
        totalMarks: 74.5,
        scores: makeScoreMapFromValues(proposalRubric, {
          crit_a_title: 3,
          crit_b_exec_summary: 3,
          crit_c_problem: 3,
          crit_d_objective: 4,
          crit_e_literature: 3,
          crit_f_methodology: 3,
          crit_g_prelim: 2,
          crit_h_ethics: 3,
          crit_i_org: 4,
          crit_j_lang: 3,
          crit_k_ref: 3,
          crit_l_pres: 3,
        }),
        qualitativeFeedback: makeQualitativeMap(
          proposalRubric,
          "The proposal is acceptable and demonstrates a clear direction. Improve methodology justification and expand the literature gap.",
        ),
        overallComments:
          "Good proposal foundation. The candidate can proceed with refinement.",
      },
      {
        sessionId: getSessionIdByTitle("Proposal Defense - Siti Nuraisyah"),
        rubricId: proposalRubric._id,
        studentId: getUserId("siti@student.uthm.edu.my"),
        evaluatorId: createdPanels[1]._id,
        semester: "Semester 2, 2024/2025",
        sessionType: "PROPOSAL_DEFENSE",
        status: "COMPLETED",
        totalMarks: 79.0,
        scores: makeScoreMapFromValues(proposalRubric, {
          crit_a_title: 4,
          crit_b_exec_summary: 3,
          crit_c_problem: 3,
          crit_d_objective: 4,
          crit_e_literature: 3,
          crit_f_methodology: 4,
          crit_g_prelim: 3,
          crit_h_ethics: 3,
          crit_i_org: 3,
          crit_j_lang: 4,
          crit_k_ref: 3,
          crit_l_pres: 3,
        }),
        qualitativeFeedback: makeQualitativeMap(
          proposalRubric,
          "The candidate shows strong potential. Research questions and expected outcome are clear, but literature coverage should be widened.",
        ),
        overallComments: "Strong presentation and clear research motivation.",
      },

      // Case 6: Ali completed qualitative Progress Assessment
      {
        sessionId: getSessionIdByTitle("Progress Assessment - Muhammad Ali"),
        rubricId: progressRubric._id,
        studentId: getUserId("ali@student.uthm.edu.my"),
        evaluatorId: getUserId("samihah@uthm.edu.my"),
        semester: "Semester 2, 2024/2025",
        sessionType: "PROGRESS_ASSESSMENT",
        status: "COMPLETED",
        summaryOfProgress:
          "The student has completed the initial ZKP authentication prototype and started integrating timetable workflows.",
        commentsForImprovement:
          "Improve frontend error handling and document the cryptographic authentication flow more clearly.",
        overallSuggestions:
          "Continue integration testing and prepare a clearer architecture diagram.",
      },
      {
        sessionId: getSessionIdByTitle("Progress Assessment - Muhammad Ali"),
        rubricId: progressRubric._id,
        studentId: getUserId("ali@student.uthm.edu.my"),
        evaluatorId: createdPanels[1]._id,
        semester: "Semester 2, 2024/2025",
        sessionType: "PROGRESS_ASSESSMENT",
        status: "COMPLETED",
        summaryOfProgress:
          "The student is progressing well and has achieved a functional proof-of-concept.",
        commentsForImprovement:
          "More complete testing is needed for session detail, attendance, and role-based rendering.",
        overallSuggestions:
          "Proceed with controlled demo testing using seeded users and sessions.",
      },

      // Case 7: Ali upcoming Pre-Viva, both pending
      {
        sessionId: getSessionIdByTitle("Pre-Viva - Muhammad Ali"),
        rubricId: preVivaRubric._id,
        studentId: getUserId("ali@student.uthm.edu.my"),
        evaluatorId: getUserId("samihah@uthm.edu.my"),
        semester: "Semester 1, 2025/2026",
        sessionType: "PRE_VIVA",
        status: "PENDING",
      },
      {
        sessionId: getSessionIdByTitle("Pre-Viva - Muhammad Ali"),
        rubricId: preVivaRubric._id,
        studentId: getUserId("ali@student.uthm.edu.my"),
        evaluatorId: createdPanels[2]._id,
        semester: "Semester 1, 2025/2026",
        sessionType: "PRE_VIVA",
        status: "PENDING",
      },

      // Case 8: Chong upcoming Pre-Viva, both pending
      {
        sessionId: getSessionIdByTitle("Pre-Viva - Chong Wei Ming"),
        rubricId: preVivaRubric._id,
        studentId: getUserId("chong@student.uthm.edu.my"),
        evaluatorId: createdPanels[2]._id,
        semester: "Semester 1, 2025/2026",
        sessionType: "PRE_VIVA",
        status: "PENDING",
      },
      {
        sessionId: getSessionIdByTitle("Pre-Viva - Chong Wei Ming"),
        rubricId: preVivaRubric._id,
        studentId: getUserId("chong@student.uthm.edu.my"),
        evaluatorId: createdPanels[3]._id,
        semester: "Semester 1, 2025/2026",
        sessionType: "PRE_VIVA",
        status: "PENDING",
      },

      // Case 9: Mei Ling completed qualitative Progress Assessment
      {
        sessionId: getSessionIdByTitle("Progress Assessment - Tan Mei Ling"),
        rubricId: progressRubric._id,
        studentId: getUserId("meiling@student.uthm.edu.my"),
        evaluatorId: createdPanels[1]._id,
        semester: "Semester 2, 2024/2025",
        sessionType: "PROGRESS_ASSESSMENT",
        status: "COMPLETED",
        summaryOfProgress:
          "The student has refined the research framework and completed the early security workflow design.",
        commentsForImprovement:
          "The student should improve evaluation of usability and provide more detailed testing evidence.",
        overallSuggestions:
          "Continue with prototype validation and prepare comparison against existing systems.",
      },
      {
        sessionId: getSessionIdByTitle("Progress Assessment - Tan Mei Ling"),
        rubricId: progressRubric._id,
        studentId: getUserId("meiling@student.uthm.edu.my"),
        evaluatorId: createdPanels[2]._id,
        semester: "Semester 2, 2024/2025",
        sessionType: "PROGRESS_ASSESSMENT",
        status: "COMPLETED",
        summaryOfProgress:
          "The project direction is suitable and the student has made steady progress.",
        commentsForImprovement:
          "The problem statement should be more focused and technical validation should be expanded.",
        overallSuggestions:
          "Proceed with implementation testing and prepare clearer limitations.",
      },

      // Case 10: Siti upcoming Progress Assessment, both pending
      {
        sessionId: getSessionIdByTitle("Progress Assessment - Siti Nuraisyah"),
        rubricId: progressRubric._id,
        studentId: getUserId("siti@student.uthm.edu.my"),
        evaluatorId: getUserId("samihah@uthm.edu.my"),
        semester: "Semester 1, 2025/2026",
        sessionType: "PROGRESS_ASSESSMENT",
        status: "PENDING",
      },
      {
        sessionId: getSessionIdByTitle("Progress Assessment - Siti Nuraisyah"),
        rubricId: progressRubric._id,
        studentId: getUserId("siti@student.uthm.edu.my"),
        evaluatorId: createdPanels[2]._id,
        semester: "Semester 1, 2025/2026",
        sessionType: "PROGRESS_ASSESSMENT",
        status: "PENDING",
      },
      {
        sessionId: getSessionIdByTitle("Demo Access Session - Siti Nuraisyah"),
        rubricId: progressRubric._id,
        studentId: getUserId("siti@student.uthm.edu.my"),
        evaluatorId: createdPanels[0]._id,
        semester: "Semester 1, 2025/2026",
        sessionType: "PROGRESS_ASSESSMENT",
        status: "PENDING",
      },
      {
        sessionId: getSessionIdByTitle("Demo Access Session - Siti Nuraisyah"),
        rubricId: progressRubric._id,
        studentId: getUserId("siti@student.uthm.edu.my"),
        evaluatorId: createdPanels[3]._id,
        semester: "Semester 1, 2025/2026",
        sessionType: "PROGRESS_ASSESSMENT",
        status: "PENDING",
      },
      {
        sessionId: getSessionIdByTitle("Demo Access Session - Tan Mei Ling"),
        rubricId: preVivaRubric._id,
        studentId: getUserId("meiling@student.uthm.edu.my"),
        evaluatorId: createdPanels[0]._id,
        semester: "Semester 1, 2025/2026",
        sessionType: "PRE_VIVA",
        status: "PENDING",
      },
      {
        sessionId: getSessionIdByTitle("Demo Access Session - Tan Mei Ling"),
        rubricId: preVivaRubric._id,
        studentId: getUserId("meiling@student.uthm.edu.my"),
        evaluatorId: createdPanels[4]._id,
        semester: "Semester 1, 2025/2026",
        sessionType: "PRE_VIVA",
        status: "PENDING",
      },
      {
        sessionId: getSessionIdByTitle("Demo Access Session - Muhammad Ali"),
        rubricId: proposalRubric._id,
        studentId: getUserId("ali@student.uthm.edu.my"),
        evaluatorId: createdPanels[4]._id,
        semester: "Semester 1, 2025/2026",
        sessionType: "PROPOSAL_DEFENSE",
        status: "PENDING",
      },
      {
        sessionId: getSessionIdByTitle("Demo Access Session - Muhammad Ali"),
        rubricId: proposalRubric._id,
        studentId: getUserId("ali@student.uthm.edu.my"),
        evaluatorId: createdPanels[3]._id,
        semester: "Semester 1, 2025/2026",
        sessionType: "PROPOSAL_DEFENSE",
        status: "PENDING",
      },
    ];

    for (const slot of batchSessionPlan) {
      const student = allUsers.find((u) => u.email === slot.studentEmail);

      for (const panelId of slot.panels) {
        evaluationsData.push({
          sessionId: getSessionIdByTitle(
            `Batch Presentation - ${student.name}`,
          ),
          rubricId: proposalRubric._id,
          studentId: getUserId(slot.studentEmail),
          evaluatorId: panelId,
          semester: "Semester 1, 2025/2026",
          sessionType: "PROPOSAL_DEFENSE",
          status: "PENDING",
        });
      }
    }

    for (const slot of completedHistoryPlan) {
      const student = allUsers.find((u) => u.email === slot.studentEmail);

      for (const panelId of slot.panels) {
        evaluationsData.push({
          sessionId: getSessionIdByTitle(
            `Completed Progress Review - ${student.name}`,
          ),
          rubricId: progressRubric._id,
          studentId: getUserId(slot.studentEmail),
          evaluatorId: panelId,
          semester: "Semester 2, 2024/2025",
          sessionType: "PROGRESS_ASSESSMENT",
          status: "COMPLETED",
          summaryOfProgress:
            "The student has completed the planned milestone and demonstrated acceptable research progress.",
          commentsForImprovement:
            "The student should strengthen validation evidence, improve documentation, and prepare clearer analysis for the next stage.",
          overallSuggestions:
            "Proceed to the next phase with continuous supervision and scheduled follow-up review.",
        });
      }
    }

    const createdEvaluations = await Evaluation.create(evaluationsData);
    console.log("🧾 Seeding attendance records...");

    await Attendance.create([
      {
        timetableId: createdSessions[1]._id,
        studentId: getUserId("siti@student.uthm.edu.my"),
        status: "present",
        checkInTime: new Date(),
      },
      {
        timetableId: createdSessions[2]._id,
        studentId: getUserId("chong@student.uthm.edu.my"),
        status: "present",
        checkInTime: new Date(),
      },
      {
        timetableId: createdSessions[3]._id,
        studentId: getUserId("meiling@student.uthm.edu.my"),
        status: "absent",
      },
      {
        timetableId: getSessionIdByTitle("Proposal Defense - Siti Nuraisyah"),
        studentId: getUserId("siti@student.uthm.edu.my"),
        status: "present",
        checkInTime: lastMonth,
      },
      {
        timetableId: getSessionIdByTitle("Progress Assessment - Muhammad Ali"),
        studentId: getUserId("ali@student.uthm.edu.my"),
        status: "late",
        checkInTime: lastWeek,
        notes: "Demo late check-in record.",
      },
      {
        timetableId: getSessionIdByTitle("Progress Assessment - Tan Mei Ling"),
        studentId: getUserId("meiling@student.uthm.edu.my"),
        status: "present",
        checkInTime: lastWeek,
      },
    ]);

    await Attendance.create(
      completedHistoryPlan.map((slot) => {
        const student = allUsers.find((u) => u.email === slot.studentEmail);

        return {
          timetableId: getSessionIdByTitle(
            `Completed Progress Review - ${student.name}`,
          ),
          studentId: getUserId(slot.studentEmail),
          status: "present",
          checkInTime: completedHistoryBatchDate,
          notes: "Seeded attendance for completed progress history.",
        };
      }),
    );

    console.log("🔐 Seeding permission request demo cases...");

    const sitiCompletedEvalBySamihah = createdEvaluations.find(
      (ev) =>
        ev.studentId.toString() ===
          getUserId("siti@student.uthm.edu.my").toString() &&
        ev.evaluatorId.toString() ===
          getUserId("samihah@uthm.edu.my").toString() &&
        ev.status === "COMPLETED",
    );

    const chongCompletedEvalBySamihah = createdEvaluations.find(
      (ev) =>
        ev.studentId.toString() ===
          getUserId("chong@student.uthm.edu.my").toString() &&
        ev.evaluatorId.toString() ===
          getUserId("samihah@uthm.edu.my").toString() &&
        ev.status === "COMPLETED",
    );

    if (sitiCompletedEvalBySamihah) {
      await PermissionRequest.create({
        requestingPanelId: createdPanels[1]._id,
        targetEvaluationId: sitiCompletedEvalBySamihah._id,
        owningPanelId: getUserId("samihah@uthm.edu.my"),
        studentId: getUserId("siti@student.uthm.edu.my"),
        status: "PENDING",
        reason: "Demo pending request for historical feedback vault.",
      });
    }

    if (chongCompletedEvalBySamihah) {
      await PermissionRequest.create({
        requestingPanelId: createdPanels[2]._id,
        targetEvaluationId: chongCompletedEvalBySamihah._id,
        owningPanelId: getUserId("samihah@uthm.edu.my"),
        studentId: getUserId("chong@student.uthm.edu.my"),
        status: "APPROVED",
        reason: "Demo approved request for historical feedback vault.",
      });
    }
    console.log("\n🧪 DEMO ACCOUNTS");
    console.log("Admin: admin_samihah / registration code: temp");
    console.log("Student Ali: AW240001 / code: 111111");
    console.log("Student Siti: AW240002 / code: 222222");
    console.log("Student Chong: AW240003 / code: 333333");
    console.log("Student Mei Ling: AW240004 / code: 444444");
    console.log("Student Aina: AW240005 / code: 555555");
    console.log("Student Danish: AW240006 / code: 666666");
    console.log("Student Priya: AW240007 / code: 777777");
    console.log("Student Jia Wei: AW240008 / code: 888888");
    console.log("Student Hafiz: AW240009 / code: 999999");
    console.log("Student Amira: AW240010 / code: 101010");
    createdPanels.forEach((panel, index) => {
      console.log(
        `Panel ${index + 1}: ${panel.userId} / ${panel.email} / code: ${panel.registrationCode}`,
      );
    });
    const totalStudents = await User.countDocuments({ role: "student" });
    const totalPanels = await User.countDocuments({ role: "panel" });
    const totalBatches = await SessionBatch.countDocuments({});
    const totalTimetables = await Timetable.countDocuments({});
    const totalEvaluations = await Evaluation.countDocuments({});
    const studentsWithCompletedEvaluations = await Evaluation.distinct(
      "studentId",
      { status: "COMPLETED" },
    );

    const seededPanels = await User.find({ role: "panel" })
      .select("name assignedStudents")
      .lean();

    console.log("\n📊 SEED VALIDATION SUMMARY");
    console.log(`Panels: ${totalPanels}`);
    console.log(`Students: ${totalStudents}`);
    console.log(`Session batches: ${totalBatches}`);
    console.log(`Timetables: ${totalTimetables}`);
    console.log(`Evaluations: ${totalEvaluations}`);
    console.log(
      `Students with completed evaluations: ${studentsWithCompletedEvaluations.length}/${totalStudents}`,
    );

    seededPanels.forEach((panel) => {
      console.log(
        `${panel.name}: ${panel.assignedStudents?.length || 0} assigned student(s)`,
      );
    });
    console.log("✅ DATABASE SEEDING COMPLETED SUCCESSFULLY!");
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
  }
};

seedDatabase();
