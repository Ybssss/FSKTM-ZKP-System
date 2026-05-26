// src/scripts/seed.js
const mongoose = require("mongoose");
const { GridFSBucket } = require("mongodb");
const { Readable } = require("stream");
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
        weight: 15,
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


const getPublicBackendUrl = () =>
  String(
    process.env.PUBLIC_BACKEND_URL ||
      process.env.BACKEND_URL ||
      `http://localhost:${process.env.PORT || 5000}`,
  ).replace(/\/$/, "");

const createSeedGridFsFile = async ({ filename, content, mimeType = "text/plain" }) => {
  if (!mongoose.connection.db) {
    throw new Error("MongoDB connection is not ready for seeded file storage.");
  }

  const bucket = new GridFSBucket(mongoose.connection.db, {
    bucketName: process.env.GRIDFS_BUCKET_NAME || "session_materials",
  });

  return new Promise((resolve, reject) => {
    const uploadStream = bucket.openUploadStream(filename, {
      contentType: mimeType,
      metadata: {
        seeded: true,
        originalName: filename,
        uploadedAt: new Date(),
      },
    });

    Readable.from([Buffer.from(content, "utf8")])
      .pipe(uploadStream)
      .on("error", reject)
      .on("finish", () => {
        const fileId = uploadStream.id.toString();
        resolve({
          id: fileId,
          name: filename,
          originalName: filename,
          mimeType,
          size: String(Buffer.byteLength(content, "utf8")),
          url: `${getPublicBackendUrl()}/api/timetables/documents/file/${fileId}`,
        });
      });
  });
};

const makeSeedMaterialContent = ({ studentName, sessionTitle, materialType }) => `FSKTM ZKP System Demo Material

Student: ${studentName}
Session: ${sessionTitle}
Material Type: ${materialType}

This is a seeded demo file stored in MongoDB GridFS. It is used to test session material upload and view workflows.
`;

const cleanGridFsBucket = async () => {
  const bucketName = process.env.GRIDFS_BUCKET_NAME || "session_materials";

  if (!mongoose.connection.db) {
    console.warn("⚠️ MongoDB connection is not ready. Skipping GridFS cleanup.");
    return;
  }

  try {
    const filesCollection = mongoose.connection.db.collection(`${bucketName}.files`);
    const chunksCollection = mongoose.connection.db.collection(`${bucketName}.chunks`);

    const fileCount = await filesCollection.countDocuments({});
    const chunkCount = await chunksCollection.countDocuments({});

    await filesCollection.deleteMany({});
    await chunksCollection.deleteMany({});

    console.log(
      `🧹 Deleted ${fileCount} uploaded material file(s) and ${chunkCount} GridFS chunk(s) from bucket "${bucketName}".`,
    );
  } catch (error) {
    console.warn("⚠️ Could not clean GridFS uploaded files:", error.message);
  }
};


const proposalWeightTotal = rubricsData
  .find((rubric) => rubric.sessionType === "PROPOSAL_DEFENSE")
  .criteria.filter((criterion) => criterion.type === "quantitative")
  .reduce((sum, criterion) => sum + Number(criterion.weight || 0), 0);

if (proposalWeightTotal !== 100) {
  console.error(`FATAL ERROR: Proposal rubric quantitative weight is ${proposalWeightTotal}%, expected 100%.`);
  process.exit(1);
}

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

    // Clean uploaded materials stored in MongoDB GridFS too.
    // Without this, reseeding removes timetable references but leaves orphan files in:
    // session_materials.files and session_materials.chunks.
    await cleanGridFsBucket();

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
        registrationCode: "demo",
        // 🔴 FIXED: Since admins can be assigned to panels now, give them tags!
        profession: "DS13 Pensyarah Kanan — Jabatan Multimedia",
        expertiseTags: [
          "Multimedia",
          "Interface Design",
          "Augmented Reality",
          "User Experience",
          "Human-Computer Interaction",
          "Child-Computer Interaction",
        ],
      },
      {
        userId: "admin_pendaftar",
        name: "PENDAFTAR FSKTM",
        email: "pendaftar.fsktm@uthm.edu.my",
        role: "admin",
        registrationCode: "demo",
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
        profession:
          "DS13 Pensyarah Kanan — Jabatan Keselamatan Maklumat dan Teknologi Web",
        registrationCode: "demo",
        expertiseTags: [
          "Security System",
          "Cryptography",
          "Quantum Key Distribution",
          "Quantum Communication",
          "Authentication",
          "Blockchain Technology",
        ],
      },
      {
        userId: "panel_ai",
        name: "SHAHREEN BINTI KASIM",
        email: "panel.ai@example.com",
        role: "panel",
        profession:
          "DS14 Profesor Madya — Jabatan Keselamatan Maklumat dan Teknologi Web",
        registrationCode: "demo",
        expertiseTags: [
          "Bioinformatics",
          "Gene Expression Analysis",
          "Gene Function Prediction",
          "Classification",
          "Support Vector Machine",
          "Semantic Similarity",
        ],
      },
      {
        userId: "panel_blockchain",
        name: "SAPI'EE BIN JAMEL",
        email: "panel.blockchain@example.com",
        role: "panel",
        profession:
          "DS14 Profesor Madya — Jabatan Keselamatan Maklumat dan Teknologi Web",
        registrationCode: "demo",
        expertiseTags: [
          "Data Management",
          "Data Encryption",
          "Information Security",
          "Block Cipher",
          "Cryptanalysis",
          "Message Authentication Code",
        ],
      },
      {
        userId: "panel_web",
        name: "NUR LIYANA BINTI SULAIMAN",
        email: "panel.web@example.com",
        role: "panel",
        profession: "DS13 Pensyarah Kanan — Jabatan Kejuruteraan Perisian",
        registrationCode: "demo",
        expertiseTags: [
          "Software Engineering",
          "Software Process Models",
          "Agile Software Development",
          "Software Process Quality",
          "Software Process Improvement",
          "Software Assessment and Certification",
        ],
      },
      {
        userId: "panel_network",
        name: "ZUBAILE BIN ABDULLAH",
        email: "panel.network@example.com",
        role: "panel",
        profession:
          "DS13 Pensyarah Kanan — Jabatan Keselamatan Maklumat dan Teknologi Web",
        registrationCode: "demo",
        expertiseTags: [
          "Security System",
          "Malware",
          "Worms and Viruses",
          "Android Botnet Detection",
          "Information Security",
          "Wireless and Mobile Computing Security",
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
        registrationCode: "demo",
        program: "Master of Information Technology",
        yearOfStudy: 1,
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
        registrationCode: "demo",
        program: "PhD in Computer Science",
        yearOfStudy: 2,
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
        registrationCode: "demo",
        program: "Master of Software Engineering",
        yearOfStudy: 1,
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
        registrationCode: "demo",
        program: "Master of Information Security",
        yearOfStudy: 1,
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
        registrationCode: "demo",
        program: "Master of Information Security",
        yearOfStudy: 1,
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
        registrationCode: "demo",
        program: "Master of Computer Science",
        yearOfStudy: 1,
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
        registrationCode: "demo",
        program: "PhD in Computer Science",
        yearOfStudy: 3,
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
        registrationCode: "demo",
        program: "Master of Software Engineering",
        yearOfStudy: 1,
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
        registrationCode: "demo",
        program: "Master of Computer Networks",
        yearOfStudy: 2,
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
        registrationCode: "demo",
        program: "Master of Cloud Computing",
        yearOfStudy: 1,
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
    const drSamihahId = getUserId("samihah@uthm.edu.my");

    const studentLifecyclePlan = [
      {
        studentEmail: "ali@student.uthm.edu.my",
        startTime: "09:00",
        panels: [drSamihahId, createdPanels[1]._id],
      },
      {
        studentEmail: "siti@student.uthm.edu.my",
        startTime: "09:00",
        panels: [createdPanels[2]._id, createdPanels[3]._id],
      },
      {
        studentEmail: "chong@student.uthm.edu.my",
        startTime: "10:05",
        panels: [createdPanels[0]._id, drSamihahId],
      },
      {
        studentEmail: "meiling@student.uthm.edu.my",
        startTime: "10:05",
        panels: [createdPanels[3]._id, createdPanels[4]._id],
      },
      {
        studentEmail: "aina@student.uthm.edu.my",
        startTime: "11:10",
        panels: [drSamihahId, createdPanels[4]._id],
      },
      {
        studentEmail: "danish@student.uthm.edu.my",
        startTime: "11:10",
        panels: [createdPanels[1]._id, createdPanels[3]._id],
      },
      {
        studentEmail: "priya@student.uthm.edu.my",
        startTime: "12:15",
        panels: [createdPanels[2]._id, drSamihahId],
      },
      {
        studentEmail: "jiawei@student.uthm.edu.my",
        startTime: "12:15",
        panels: [createdPanels[0]._id, createdPanels[1]._id],
      },
      {
        studentEmail: "hafiz@student.uthm.edu.my",
        startTime: "14:00",
        panels: [drSamihahId, createdPanels[4]._id],
      },
      {
        studentEmail: "amira@student.uthm.edu.my",
        startTime: "14:00",
        panels: [createdPanels[0]._id, createdPanels[2]._id],
      },
    ];

    console.log("🔗 Saving Panel Assignments to Database...");

    const panelAssignmentMap = studentLifecyclePlan.map(
      ({ studentEmail, panels }) => ({
        studentEmail,
        panelIds: panels,
      }),
    );

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
    console.log("📅 Seeding Evaluation Sessions with conflict-safe batches...");

    const makeDate = (dateOnly) => new Date(`${dateOnly}T00:00:00.000Z`);

    const academicSession = "2025/2026, Semester 1";
    const scheduleTitle = "Postgraduate Progress Presentation Schedule";

    const stageConfigs = [
      {
        stageKey: "proposal",
        batchSuffix: "PROPOSAL",
        sessionType: "PROPOSAL_DEFENSE",
        rubric: proposalRubric,
        date: makeDate("2026-06-10"),
        status: "completed",
        titlePrefix: "Proposal Defense",
        googleMeetSegment: "proposal",
      },
      {
        stageKey: "progress1",
        batchSuffix: "PROGRESS-1",
        sessionType: "PROGRESS_ASSESSMENT",
        rubric: progressRubric,
        date: makeDate("2026-07-01"),
        status: "completed",
        titlePrefix: "Progress Assessment 1",
        googleMeetSegment: "progress-1",
      },
      {
        stageKey: "progress2",
        batchSuffix: "PROGRESS-2",
        sessionType: "PROGRESS_ASSESSMENT",
        rubric: progressRubric,
        date: makeDate("2026-07-22"),
        status: "completed",
        titlePrefix: "Progress Assessment 2",
        googleMeetSegment: "progress-2",
      },
      {
        stageKey: "previva",
        batchSuffix: "PREVIVA",
        sessionType: "PRE_VIVA",
        rubric: preVivaRubric,
        date: makeDate("2026-08-24"),
        status: "scheduled",
        titlePrefix: "Pre-Viva",
        googleMeetSegment: "previva",
      },
    ];

    const addMinutesToHHMM = (time, minutesToAdd) => {
      const [hours, minutes] = time.split(":").map(Number);
      const date = new Date();
      date.setHours(hours, minutes + minutesToAdd, 0, 0);
      return date.toTimeString().slice(0, 5);
    };

    // Batch names follow the real-world idea of named rooms/tracks.
    // PIXEL, QUANTUM, WAVELET, and CYBER are used only as the four
    // Progress Assessment 1 demo batches on the same date. Each batch
    // now contains multiple students so printed/exported forms have
    // richer demo rows.
    const lifecycleBatchGroups = {
      proposal: [
        {
          batchName: "ALPHA",
          studentEmails: [
            "ali@student.uthm.edu.my",
            "chong@student.uthm.edu.my",
            "aina@student.uthm.edu.my",
          ],
        },
        {
          batchName: "BETA",
          studentEmails: [
            "siti@student.uthm.edu.my",
            "meiling@student.uthm.edu.my",
            "danish@student.uthm.edu.my",
          ],
        },
        {
          batchName: "GAMMA",
          studentEmails: [
            "priya@student.uthm.edu.my",
            "hafiz@student.uthm.edu.my",
          ],
        },
        {
          batchName: "DELTA",
          studentEmails: [
            "jiawei@student.uthm.edu.my",
            "amira@student.uthm.edu.my",
          ],
        },
      ],
      progress1: [
        {
          batchName: "PIXEL",
          studentEmails: [
            "ali@student.uthm.edu.my",
            "chong@student.uthm.edu.my",
            "aina@student.uthm.edu.my",
          ],
        },
        {
          batchName: "QUANTUM",
          studentEmails: [
            "siti@student.uthm.edu.my",
            "meiling@student.uthm.edu.my",
            "danish@student.uthm.edu.my",
          ],
        },
        {
          batchName: "WAVELET",
          studentEmails: [
            "priya@student.uthm.edu.my",
            "hafiz@student.uthm.edu.my",
          ],
        },
        {
          batchName: "CYBER",
          studentEmails: [
            "jiawei@student.uthm.edu.my",
            "amira@student.uthm.edu.my",
          ],
        },
      ],
      progress2: [
        {
          batchName: "MATRIX",
          studentEmails: [
            "ali@student.uthm.edu.my",
            "meiling@student.uthm.edu.my",
            "priya@student.uthm.edu.my",
          ],
        },
        {
          batchName: "VECTOR",
          studentEmails: [
            "siti@student.uthm.edu.my",
            "chong@student.uthm.edu.my",
            "jiawei@student.uthm.edu.my",
          ],
        },
        {
          batchName: "NEXUS",
          studentEmails: [
            "aina@student.uthm.edu.my",
            "hafiz@student.uthm.edu.my",
          ],
        },
        {
          batchName: "PULSE",
          studentEmails: [
            "danish@student.uthm.edu.my",
            "amira@student.uthm.edu.my",
          ],
        },
      ],
      previva: [
        {
          batchName: "APEX",
          studentEmails: [
            "ali@student.uthm.edu.my",
            "siti@student.uthm.edu.my",
            "priya@student.uthm.edu.my",
          ],
        },
        {
          batchName: "MERIDIAN",
          studentEmails: [
            "chong@student.uthm.edu.my",
            "meiling@student.uthm.edu.my",
            "jiawei@student.uthm.edu.my",
          ],
        },
        {
          batchName: "HORIZON",
          studentEmails: [
            "aina@student.uthm.edu.my",
            "danish@student.uthm.edu.my",
          ],
        },
        {
          batchName: "ECLIPSE",
          studentEmails: [
            "hafiz@student.uthm.edu.my",
            "amira@student.uthm.edu.my",
          ],
        },
      ],
    };

    const reservedConcurrentBatchNames = new Set([
      "PIXEL",
      "QUANTUM",
      "WAVELET",
      "CYBER",
    ]);

    const getStageBatchId = (stage, batchName) =>
      `BATCH-${stage.batchSuffix}-2026-${batchName}`;

    const getStageMeetingLink = (stage, batchName) =>
      `https://meet.google.com/fsktm-${stage.googleMeetSegment}-${batchName.toLowerCase()}`;

    const studentSlotMap = new Map(
      studentLifecyclePlan.map((slot) => [slot.studentEmail, slot]),
    );

    const getBatchStartTime = (group) => {
      const minutes = group.studentEmails
        .map((studentEmail) => studentSlotMap.get(studentEmail)?.startTime)
        .filter(Boolean)
        .map((time) => {
          const [hours, mins] = time.split(":").map(Number);
          return hours * 60 + mins;
        });

      if (!minutes.length) return "09:00";

      const earliest = Math.min(...minutes);
      return `${String(Math.floor(earliest / 60)).padStart(2, "0")}:${String(
        earliest % 60,
      ).padStart(2, "0")}`;
    };

    const stageBatchRecords = stageConfigs.flatMap((stage) =>
      (lifecycleBatchGroups[stage.stageKey] || []).map((group) => ({
        batchName: group.batchName,
        batchId: getStageBatchId(stage, group.batchName),
        academicSession,
        scheduleTitle,
        sessionType: stage.sessionType,
        rubricId: stage.rubric._id,
        date: stage.date,
        startTime: getBatchStartTime(group),
        slotDurationMinutes: 60,
        breakBetweenSlotsMinutes: 5,
        googleMeetLink: getStageMeetingLink(stage, group.batchName),
        status: stage.status === "completed" ? "completed" : "active",
        createdBy: getUserId("samihah@uthm.edu.my"),
      })),
    );

    const sessionsData = stageConfigs.flatMap((stage) =>
      (lifecycleBatchGroups[stage.stageKey] || []).flatMap((group) =>
        group.studentEmails.map((studentEmail) => {
          const slot = studentSlotMap.get(studentEmail);
          const student = allUsers.find((u) => u.email === studentEmail);
          const endTime = addMinutesToHHMM(slot.startTime, 60);
          const meetingLink = getStageMeetingLink(stage, group.batchName);

          return {
            students: [getUserId(studentEmail)],
            panels: slot.panels,
            title: `${stage.titlePrefix} - ${student.name}`,
            sessionType: stage.sessionType,
            rubricId: stage.rubric._id,
            date: stage.date,
            startTime: slot.startTime,
            endTime,
            venue: meetingLink,
            googleMeetLink: meetingLink,
            status: stage.status,
            batchId: getStageBatchId(stage, group.batchName),
            batchName: group.batchName,
            academicSession,
            scheduleTitle,
            slotDurationMinutes: 60,
            breakBetweenSlotsMinutes: 5,
          };
        }),
      ),
    );

    const parseTimeToMinutes = (timeValue) => {
      const [hours, minutes] = String(timeValue || "00:00").split(":").map(Number);
      return hours * 60 + minutes;
    };

    const dateKey = (value) => new Date(value).toISOString().slice(0, 10);

    const validateSeedSchedule = (sessions) => {
      const studentDayMap = new Map();

      for (const session of sessions) {
        const keyDate = dateKey(session.date);
        for (const studentId of session.students || []) {
          const key = `${studentId}:${keyDate}`;
          if (studentDayMap.has(key)) {
            throw new Error(
              `Seed violation: student has more than one session on ${keyDate}: ${session.title}`,
            );
          }
          studentDayMap.set(key, session.title);
        }
      }

      const lifecycleByStudent = new Map();

      for (const session of sessions) {
        for (const studentId of session.students || []) {
          const key = String(studentId);
          if (!lifecycleByStudent.has(key)) lifecycleByStudent.set(key, []);
          lifecycleByStudent.get(key).push(session);
        }
      }

      for (const [studentId, studentSessions] of lifecycleByStudent.entries()) {
        const proposalSessions = studentSessions.filter(
          (session) => session.sessionType === "PROPOSAL_DEFENSE",
        );
        const progressSessions = studentSessions.filter(
          (session) => session.sessionType === "PROGRESS_ASSESSMENT",
        );
        const preVivaSessions = studentSessions.filter(
          (session) => session.sessionType === "PRE_VIVA",
        );

        if (proposalSessions.length !== 1) {
          throw new Error(
            `Seed violation: student ${studentId} must have exactly one Proposal Defense, found ${proposalSessions.length}.`,
          );
        }

        if (progressSessions.length < 2) {
          throw new Error(
            `Seed violation: student ${studentId} must have at least two Progress Assessments before Pre-Viva, found ${progressSessions.length}.`,
          );
        }

        if (preVivaSessions.length !== 1) {
          throw new Error(
            `Seed violation: student ${studentId} must have exactly one Pre-Viva, found ${preVivaSessions.length}.`,
          );
        }

        const proposalDate = new Date(proposalSessions[0].date).getTime();
        const latestProgressDate = Math.max(
          ...progressSessions.map((session) => new Date(session.date).getTime()),
        );
        const preVivaDate = new Date(preVivaSessions[0].date).getTime();

        if (!(proposalDate < latestProgressDate && latestProgressDate < preVivaDate)) {
          throw new Error(
            `Seed violation: student ${studentId} lifecycle must be Proposal Defense → Progress Assessment(s) → Pre-Viva.`,
          );
        }
      }

      const exactConcurrentBatchSessions = sessions.filter((session) =>
        reservedConcurrentBatchNames.has(String(session.batchName || "").toUpperCase()),
      );

      const exactConcurrentNames = new Set(
        exactConcurrentBatchSessions.map((session) => String(session.batchName).toUpperCase()),
      );

      for (const requiredName of reservedConcurrentBatchNames) {
        if (!exactConcurrentNames.has(requiredName)) {
          throw new Error(
            `Seed violation: missing required same-day demo batch name ${requiredName}.`,
          );
        }
      }

      if (exactConcurrentNames.size !== reservedConcurrentBatchNames.size) {
        throw new Error(
          "Seed violation: only PIXEL, QUANTUM, WAVELET, and CYBER should use the reserved same-day demo batch names.",
        );
      }

      const exactConcurrentDates = new Set(
        exactConcurrentBatchSessions.map((session) => dateKey(session.date)),
      );

      if (exactConcurrentDates.size !== 1) {
        throw new Error(
          "Seed violation: PIXEL, QUANTUM, WAVELET, and CYBER demo batches must be on the same date.",
        );
      }

      const invalidReservedType = exactConcurrentBatchSessions.find(
        (session) => session.sessionType !== "PROGRESS_ASSESSMENT",
      );

      if (invalidReservedType) {
        throw new Error(
          `Seed violation: ${invalidReservedType.batchName} must be a Progress Assessment session.`,
        );
      }

      for (const requiredName of reservedConcurrentBatchNames) {
        const rowCount = exactConcurrentBatchSessions.filter(
          (session) => String(session.batchName || "").toUpperCase() === requiredName,
        ).length;

        if (rowCount < 2) {
          throw new Error(
            `Seed violation: ${requiredName} should contain at least two students for richer demo export/print rows.`,
          );
        }
      }

      for (let i = 0; i < sessions.length; i += 1) {
        const a = sessions[i];
        const aDate = dateKey(a.date);
        const aStart = parseTimeToMinutes(a.startTime);
        const aEnd = parseTimeToMinutes(a.endTime);

        for (let j = i + 1; j < sessions.length; j += 1) {
          const b = sessions[j];
          if (aDate !== dateKey(b.date)) continue;

          const bStart = parseTimeToMinutes(b.startTime);
          const bEnd = parseTimeToMinutes(b.endTime);
          const overlaps = aStart < bEnd && bStart < aEnd;
          if (!overlaps) continue;

          const aPanels = new Set((a.panels || []).map(String));
          const crashedPanel = (b.panels || []).find((panelId) => aPanels.has(String(panelId)));
          if (crashedPanel) {
            throw new Error(
              `Seed violation: panel time crash on ${aDate} between "${a.title}" and "${b.title}".`,
            );
          }
        }
      }
    };

    validateSeedSchedule(sessionsData);
    console.log("✅ Seed schedule validation passed before inserting timetables.");

    await SessionBatch.create(stageBatchRecords);

    const enrichedSessionsData = await Promise.all(
      sessionsData.map(async (session) => {
        const student = allUsers.find(
          (candidate) => String(candidate._id) === String(session.students?.[0]),
        );
        const studentName = student?.name || "Student";
        const safeTitle = String(session.title || "session")
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "")
          .slice(0, 80);

        const reportFile = await createSeedGridFsFile({
          filename: `${safeTitle}-report.txt`,
          content: makeSeedMaterialContent({
            studentName,
            sessionTitle: session.title,
            materialType: "Report",
          }),
        });

        const slidesFile = await createSeedGridFsFile({
          filename: `${safeTitle}-slides.txt`,
          content: makeSeedMaterialContent({
            studentName,
            sessionTitle: session.title,
            materialType: "Presentation Slides",
          }),
        });

        return {
          ...session,
          createdBy: getUserId("samihah@uthm.edu.my"),
          studentDocuments: [
            {
              title: `${session.title} Demo Report`,
              url: reportFile.url,
              driveFileId: reportFile.id,
              fileStorageId: reportFile.id,
              originalFileName: reportFile.originalName || reportFile.name,
              mimeType: reportFile.mimeType,
              source: "gridfs",
              type: "report",
              uploadedBy: session.students[0],
              fileSize: reportFile.size,
              description:
                "Seeded demo report stored in MongoDB GridFS for panel review testing.",
            },
            {
              title: `${session.title} Demo Slides`,
              url: slidesFile.url,
              driveFileId: slidesFile.id,
              fileStorageId: slidesFile.id,
              originalFileName: slidesFile.originalName || slidesFile.name,
              mimeType: slidesFile.mimeType,
              source: "gridfs",
              type: "slides",
              uploadedBy: session.students[0],
              fileSize: slidesFile.size,
              description:
                "Seeded demo slides stored in MongoDB GridFS for panel review testing.",
            },
          ],
        };
      }),
    );

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

    const calculateWeightedTotalMarks = (rubric, scores = {}) =>
      Number(
        rubric.criteria
          .filter((criterion) => criterion.type === "quantitative")
          .reduce((sum, criterion) => {
            const score = Number(scores[criterion.key] || 0);
            const maxScore = Number(criterion.maxScore || 4);
            const weight = Number(criterion.weight || 0);

            return maxScore > 0 ? sum + (score / maxScore) * weight : sum;
          }, 0)
          .toFixed(2),
      );

    const makeQualitativeMap = (rubric, text) => {
      const map = {};

      rubric.criteria
        .filter((criterion) => criterion.type === "qualitative")
        .forEach((criterion) => {
          map[criterion.key] = text;
        });

      return map;
    };

    const evaluationsData = [];

    for (const stage of stageConfigs) {
      for (const slot of studentLifecyclePlan) {
        const student = allUsers.find((u) => u.email === slot.studentEmail);
        const title = `${stage.titlePrefix} - ${student.name}`;
        const isCompleted = stage.status === "completed";

        for (const panelId of slot.panels) {
          const common = {
            sessionId: getSessionIdByTitle(title),
            rubricId: stage.rubric._id,
            studentId: getUserId(slot.studentEmail),
            evaluatorId: panelId,
            semester: "Semester 1, 2025/2026",
            sessionType: stage.sessionType,
            status: isCompleted ? "COMPLETED" : "PENDING",
          };

          if (!isCompleted) {
            evaluationsData.push(common);
          } else if (stage.sessionType === "PROGRESS_ASSESSMENT") {
            evaluationsData.push({
              ...common,
              summaryOfProgress:
                stage.stageKey === "progress1"
                  ? "The student has completed early research milestones after proposal approval, including refinement of objectives and initial system design."
                  : "The student has demonstrated continued progress, including prototype improvement, preliminary validation, and preparation for pre-viva readiness.",
              commentsForImprovement:
                stage.stageKey === "progress1"
                  ? "The student should strengthen the literature gap, improve research planning, and prepare clearer evidence for the next progress review."
                  : "The student should finalize data analysis, improve report structure, and prepare stronger justification before pre-viva.",
              overallSuggestions:
                stage.stageKey === "progress1"
                  ? "Proceed to the next progress assessment after completing planned implementation milestones."
                  : "Proceed toward pre-viva preparation with continuous supervision and final documentation refinement.",
            });
          } else if (stage.sessionType === "PRE_VIVA") {
            const scores = makeScoreMapFromValues(stage.rubric, {
              crit_a_title: 3,
              crit_b_abs: 3,
              crit_c_prob: 3,
              crit_d_obj: 3,
              crit_e_lit: 3,
              crit_f_meth: 3,
              crit_g_res: 3,
              crit_h_find: 3,
              crit_i_eth: 3,
              crit_j_contrib: 3,
              crit_k_conc: 3,
              crit_l_org2: 3,
              crit_m_lang2: 3,
              crit_n_ref2: 3,
              crit_o_pres2: 3,
              crit_p_delib: 3,
            });

            evaluationsData.push({
              ...common,
              totalMarks: calculateWeightedTotalMarks(stage.rubric, scores),
              scores,
              qualitativeFeedback: makeQualitativeMap(
                stage.rubric,
                "The candidate demonstrates acceptable thesis readiness with minor improvements required before final submission.",
              ),
              overallComments:
                "The candidate is ready to proceed with minor amendments and improved presentation of findings.",
            });
          } else {
            const scores = makeScoreMapFromValues(stage.rubric, {
              crit_a_title: 3,
              crit_b_exec_summary: 3,
              crit_c_problem: 3,
              crit_d_objective: 3,
              crit_e_literature: 3,
              crit_f_methodology: 3,
              crit_g_prelim: 3,
              crit_h_ethics: 3,
              crit_i_org: 3,
              crit_j_lang: 3,
              crit_k_ref: 3,
              crit_l_pres: 3,
            });

            evaluationsData.push({
              ...common,
              totalMarks: calculateWeightedTotalMarks(stage.rubric, scores),
              scores,
              qualitativeFeedback: makeQualitativeMap(
                stage.rubric,
                "The proposal is acceptable. The research direction is clear and the methodology is suitable with minor refinement.",
              ),
              overallComments:
                "Good proposal foundation. The candidate can proceed after refining literature gap and methodology justification.",
            });
          }
        }
      }
    }

    const createdEvaluations = await Evaluation.create(evaluationsData);

    console.log("🧾 Seeding attendance records...");

    await Attendance.create(
      stageConfigs
        .filter((stage) => stage.status === "completed")
        .flatMap((stage) =>
          studentLifecyclePlan.map((slot) => {
            const student = allUsers.find((u) => u.email === slot.studentEmail);

            return {
              timetableId: getSessionIdByTitle(`${stage.titlePrefix} - ${student.name}`),
              studentId: getUserId(slot.studentEmail),
              status: "present",
              checkInTime: stage.date,
              notes: "Seeded attendance for completed lifecycle evaluation.",
            };
          }),
        ),
    );

    console.log("🔐 Seeding permission request demo cases...");

    const findSessionByTitle = (title) =>
      createdSessions.find((session) => session.title === title);

    const findCompletedEvaluation = ({
      studentEmail,
      sessionTitle,
      evaluatorId,
      excludeEvaluatorId,
    }) => {
      const targetSession = findSessionByTitle(sessionTitle);

      if (!targetSession) return null;

      return createdEvaluations.find((ev) => {
        const sameStudent =
          ev.studentId.toString() === getUserId(studentEmail).toString();
        const sameSession =
          ev.sessionId.toString() === targetSession._id.toString();
        const completed = ev.status === "COMPLETED";
        const evaluatorMatches = evaluatorId
          ? ev.evaluatorId.toString() === evaluatorId.toString()
          : true;
        const evaluatorExcluded = excludeEvaluatorId
          ? ev.evaluatorId.toString() !== excludeEvaluatorId.toString()
          : true;

        return (
          sameStudent &&
          sameSession &&
          completed &&
          evaluatorMatches &&
          evaluatorExcluded
        );
      });
    };

    const createPermissionDemo = async ({
      studentEmail,
      historicalSessionTitle,
      currentSessionTitle,
      requestingPanelId,
      owningPanelId,
      status,
      reason,
    }) => {
      const currentSession = findSessionByTitle(currentSessionTitle);
      const targetEvaluation = findCompletedEvaluation({
        studentEmail,
        sessionTitle: historicalSessionTitle,
        evaluatorId: owningPanelId,
      });

      if (!currentSession || !targetEvaluation) {
        console.warn(
          `⚠️ Skipped permission demo: ${studentEmail}, historical=${historicalSessionTitle}, current=${currentSessionTitle}`,
        );
        return;
      }

      const permissionPayload = {
        requestingPanelId,
        targetEvaluationId: targetEvaluation._id,
        owningPanelId: targetEvaluation.evaluatorId,
        studentId: getUserId(studentEmail),
        status,
        reason,
        scope: "SINGLE_EVALUATION",
        currentSessionId: currentSession._id,
        batchId: currentSession.batchId || null,
      };

      if (status === "APPROVED") {
        permissionPayload.approvedBy = targetEvaluation.evaluatorId;
        permissionPayload.approvedAt = new Date();
      }

      await PermissionRequest.create(permissionPayload);
    };

    await createPermissionDemo({
      studentEmail: "siti@student.uthm.edu.my",
      historicalSessionTitle: "Proposal Defense - Siti Nuraisyah",
      currentSessionTitle: "Pre-Viva - Siti Nuraisyah",
      requestingPanelId: createdPanels[3]._id,
      owningPanelId: createdPanels[2]._id,
      status: "PENDING",
      reason:
        "Demo pending request to review Siti Nuraisyah's previous Proposal Defense before the current Pre-Viva session.",
    });

    await createPermissionDemo({
      studentEmail: "chong@student.uthm.edu.my",
      historicalSessionTitle: "Progress Assessment 2 - Chong Wei Ming",
      currentSessionTitle: "Pre-Viva - Chong Wei Ming",
      requestingPanelId: createdPanels[0]._id,
      owningPanelId: createdPanels[2]._id,
      status: "APPROVED",
      reason:
        "Demo approved request to review Chong Wei Ming's previous Progress Assessment before the current Pre-Viva session.",
    });
    console.log("\n🧪 DEMO ACCOUNTS");
    console.log("Admin: admin_samihah / registration code: demo");
    console.log("Student Ali: AW240001 / code: demo");
    console.log("Student Siti: AW240002 / code: demo");
    console.log("Student Chong: AW240003 / code: demo");
    console.log("Student Mei Ling: AW240004 / code: demo");
    console.log("Student Aina: AW240005 / code: demo");
    console.log("Student Danish: AW240006 / code: demo");
    console.log("Student Priya: AW240007 / code: demo");
    console.log("Student Jia Wei: AW240008 / code: demo");
    console.log("Student Hafiz: AW240009 / code: demo");
    console.log("Student Amira: AW240010 / code: demo");
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
