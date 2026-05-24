const User = require("../models/User");
const { GoogleGenerativeAI } = require("@google/generative-ai");

exports.assignPanelToStudent = async (req, res) => {
  try {
    const { studentId, panelId } = req.body;
    const student = await User.findById(studentId);
    const panel = await User.findById(panelId);

    if (!student || !panel) {
      return res.status(404).json({
        success: false,
        message: "Student or panel not found",
      });
    }

    const alreadyAssigned = student.assignedPanels?.some((assignment) => {
      const assignedPanelId = assignment.panelId || assignment;
      return String(assignedPanelId) === String(panelId);
    });

    if (!alreadyAssigned) {
      student.assignedPanels.push({ panelId, startDate: new Date(), endDate: null });
      await student.save();
    }

    if (!panel.assignedStudents.some((id) => String(id) === String(studentId))) {
      panel.assignedStudents.push(studentId);
      await panel.save();
    }

    res.json({
      success: true,
      message:
        "Default panel assignment updated for future scheduling only. Existing sessions and evaluations were not changed.",
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error assigning panel" });
  }
};

exports.getMyStudents = async (req, res) => {
  try {
    const panel = await User.findById(req.user.id || req.user._id).populate(
      "assignedStudents",
      "name matricNumber program researchTitle researchAbstract",
    );
    res.json({ success: true, students: panel?.assignedStudents || [] });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error fetching students" });
  }
};

exports.getMyPanels = async (req, res) => {
  try {
    const student = await User.findById(req.user.id || req.user._id).populate(
      "assignedPanels.panelId",
      "name email profession expertiseTags",
    );
    res.json({ success: true, panels: student?.assignedPanels || [] });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error fetching panels" });
  }
};

const AI_MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash";
const AI_PANEL_LIMIT = Number(process.env.MATCHING_AI_PANEL_LIMIT || 8);
const AI_TIMEOUT_MS = Number(process.env.MATCHING_AI_TIMEOUT_MS || 12000);

const isFalseLike = (value) =>
  value === false ||
  String(value || "")
    .trim()
    .toLowerCase() === "false";

const isAiMatchingEnabled = (value) => {
  if (value !== undefined) return !isFalseLike(value);
  if (process.env.MATCHING_USE_AI !== undefined) {
    return !isFalseLike(process.env.MATCHING_USE_AI);
  }

  return true;
};

const withTimeout = (promise, timeoutMs, label) => {
  if (!timeoutMs || timeoutMs <= 0) return promise;

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error(`${label} timed out after ${timeoutMs}ms`)),
      timeoutMs,
    );

    promise
      .then((value) => {
        clearTimeout(timeout);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timeout);
        reject(error);
      });
  });
};

const EXACT_SHORT_TERMS = new Set([
  "ai",
  "ml",
  "dl",
  "nlp",
  "zkp",
  "iot",
  "ux",
  "ui",
  "ar",
  "vr",
  "mac",
  "otp",
  "api",
]);

const STOPWORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "from",
  "into",
  "using",
  "based",
  "system",
  "systems",
  "study",
  "research",
  "approach",
  "method",
  "model",
  "framework",
  "application",
  "applications",
  "development",
  "implementation",
  "analysis",
  "design",
  "of",
  "in",
  "on",
  "to",
  "a",
  "an",
  "and",
  "or",
  "by",
  "for",
]);

const synonymGroups = [
  ["zero", "knowledge", "proof", "zkp", "cryptography", "authentication", "passwordless"],
  ["security", "secure", "cybersecurity", "information", "privacy", "encryption", "malware", "forensic"],
  ["artificial", "intelligence", "ai", "machine", "learning", "ml", "deep", "dl", "neural"],
  ["bioinformatics", "gene", "protein", "biological", "semantic", "classification"],
  ["web", "frontend", "backend", "react", "node", "express", "database", "mobile"],
  ["software", "engineering", "agile", "process", "quality", "testing", "assessment", "certification"],
  ["blockchain", "distributed", "ledger", "smart", "contract"],
  ["data", "management", "analytics", "mining", "prediction", "classification", "database"],
  ["network", "iot", "wireless", "sensor", "protocol", "mobile"],
  ["multimedia", "interface", "ux", "ui", "hci", "augmented", "reality", "ar", "vr"],
  ["quantum", "key", "distribution", "communication", "cryptography"],
];

const normalizeTokens = (value = "") =>
  String(value)
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .map((word) => word.trim())
    .filter(
      (word) =>
        word &&
        (word.length > 2 || EXACT_SHORT_TERMS.has(word)) &&
        !STOPWORDS.has(word),
    );

const unique = (items = []) => [
  ...new Set(
    items
      .map((item) => String(item || "").trim())
      .filter(Boolean),
  ),
];

const limitText = (value = "", maxLength = 1200) => {
  const text = String(value || "")
    .replace(/\s+/g, " ")
    .trim();

  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
};

const expandTokens = (tokens) => {
  const expanded = new Set(tokens);

  for (const group of synonymGroups) {
    const hasGroupWord = group.some((word) => expanded.has(word));
    if (hasGroupWord) group.forEach((word) => expanded.add(word));
  }

  return expanded;
};

const scorePanel = (contextText, panel) => {
  const lowerContext = String(contextText || "").toLowerCase();
  const baseContextTokens = normalizeTokens(contextText);
  const contextTokens = expandTokens(baseContextTokens);
  const expertiseTags = unique(panel.expertiseTags || []);

  if (contextTokens.size === 0 || expertiseTags.length === 0) {
    return { score: 5, matches: [], reasons: ["No usable expertise keywords found."] };
  }

  const matches = [];
  const reasons = [];
  let bestTagScore = 0;
  let totalMatchedScore = 0;

  for (const tag of expertiseTags) {
    const tagText = String(tag || "").toLowerCase();
    const tagTokens = normalizeTokens(tagText);
    if (tagTokens.length === 0) continue;

    const expandedTagTokens = expandTokens(tagTokens);
    const overlappingTokens = [...expandedTagTokens].filter((token) =>
      contextTokens.has(token),
    );

    const rawOverlap = [...new Set(tagTokens)].filter((token) =>
      new Set(baseContextTokens).has(token),
    );

    const phraseMatched = lowerContext.includes(tagText);
    const tokenCoverage = overlappingTokens.length / Math.max(expandedTagTokens.size, 1);
    const rawCoverage = rawOverlap.length / Math.max(new Set(tagTokens).size, 1);

    let tagScore = 0;
    if (phraseMatched) tagScore = 96;
    else if (rawCoverage >= 0.75) tagScore = 88;
    else if (rawCoverage >= 0.5) tagScore = 78;
    else if (tokenCoverage >= 0.5) tagScore = 70;
    else if (tokenCoverage > 0) tagScore = 42 + Math.round(tokenCoverage * 35);

    if (tagScore > 0) {
      matches.push(tag);
      bestTagScore = Math.max(bestTagScore, tagScore);
      totalMatchedScore += tagScore;
      reasons.push(`${tag}: matched ${overlappingTokens.slice(0, 5).join(", ")}`);
    }
  }

  if (matches.length === 0) {
    return { score: 12, matches: [], reasons: ["No clear overlap with this panel's expertise."] };
  }

  const avgMatchedScore = totalMatchedScore / matches.length;
  const coverageBonus = Math.min(matches.length * 4, 18);
  const specificContextBonus = Math.min(Math.max(baseContextTokens.length - 4, 0), 10);
  const score = Math.min(
    98,
    Math.round(bestTagScore * 0.55 + avgMatchedScore * 0.3 + coverageBonus + specificContextBonus),
  );

  return { score, matches, reasons: reasons.slice(0, 4) };
};

const parseAiJson = (text = "") => {
  const raw = String(text || "").trim();
  try {
    return JSON.parse(raw);
  } catch (_) {
    const firstObject = raw.indexOf("{");
    const lastObject = raw.lastIndexOf("}");
    if (firstObject !== -1 && lastObject !== -1) {
      return JSON.parse(raw.slice(firstObject, lastObject + 1));
    }

    const firstArray = raw.indexOf("[");
    const lastArray = raw.lastIndexOf("]");
    if (firstArray !== -1 && lastArray !== -1) {
      return { recommendedPanelIds: JSON.parse(raw.slice(firstArray, lastArray + 1)) };
    }
  }

  return { recommendedPanelIds: [], aiReasons: {} };
};

const getAiRecommendation = async ({ contextText, panels }) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { ids: [], reasons: {}, model: null, used: false };
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: AI_MODEL });

  const prompt = `You are an academic panel matching assistant for UTHM FSKTM.

Student research context:
${limitText(contextText)}

Available panels:
${JSON.stringify(
    panels.map((panel) => ({
      id: String(panel._id),
      name: panel.name,
      profession: panel.profession || "",
      expertiseTags: (panel.expertiseTags || []).slice(0, 12),
    })),
    null,
    2,
  )}

Return JSON only in this exact shape:
{
  "recommendedPanelIds": ["panelId1", "panelId2"],
  "aiReasons": {
    "panelId1": "short reason based on expertise tags",
    "panelId2": "short reason based on expertise tags"
  }
}

Rules:
- Recommend at most 2 panels.
- Use the stated FIELD OF EXPERTISE / research interest tags.
- Do not recommend a panel if their expertise is weakly related.
- Prefer precise expertise over general ICT terms.`;

  const result = await model.generateContent(prompt);
  const responseText = result.response.text();
  const parsed = parseAiJson(responseText);

  const validPanelIds = new Set(panels.map((panel) => String(panel._id)));
  const ids = unique(parsed.recommendedPanelIds || [])
    .map(String)
    .filter((id) => validPanelIds.has(id))
    .slice(0, 2);

  return {
    ids,
    reasons: parsed.aiReasons || {},
    model: AI_MODEL,
    used: true,
  };
};

exports.matchExpertise = async (req, res) => {
  try {
    const startedAt = Date.now();
    const { researchTitle, researchAbstract, studentId, useAi } = req.body;

    const student = studentId
      ? await User.findById(studentId).select(
          "name researchTitle researchAbstract supervisorId",
        )
      : null;

    const finalTitle = String(researchTitle || student?.researchTitle || "").trim();
    const finalAbstract = String(
      researchAbstract || student?.researchAbstract || "",
    ).trim();

    if (!finalTitle && !finalAbstract) {
      return res.status(400).json({
        success: false,
        message: "Student must have a research title or abstract for expertise matching.",
      });
    }

    const allPanels = await User.find({ role: { $in: ["panel", "admin"] } })
      .select("_id name email userId role profession expertiseTags")
      .lean();

    const availablePanels = allPanels.filter((panel) => {
      if (!student?.supervisorId) return true;
      return String(panel._id) !== String(student.supervisorId);
    });

    if (availablePanels.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No available panels to match.",
      });
    }

    const panelsWithStoredExpertise = availablePanels.map((panel) => ({
      ...panel,
      expertiseTags: unique(panel.expertiseTags || []),
    }));

    const contextText = `${finalTitle}. ${finalAbstract}`.trim();
    const deterministicStartedAt = Date.now();

    const baseRecommendations = panelsWithStoredExpertise
      .map((panel) => {
        const match = scorePanel(contextText, panel);

        return {
          panel,
          match,
          baseScore: match.score,
        };
      })
      .sort((a, b) => b.baseScore - a.baseScore);

    const deterministicMs = Date.now() - deterministicStartedAt;

    let aiResult = { ids: [], reasons: {}, model: null, used: false };
    let aiMs = 0;
    let aiAttempted = false;
    if (isAiMatchingEnabled(useAi)) {
      aiAttempted = true;
      const aiStartedAt = Date.now();
      try {
        const aiCandidatePanels = baseRecommendations
          .slice(0, Math.max(AI_PANEL_LIMIT, 2))
          .map((item) => item.panel);

        aiResult = await withTimeout(
          getAiRecommendation({
            contextText,
            panels: aiCandidatePanels,
          }),
          AI_TIMEOUT_MS,
          "Gemini matching",
        );
      } catch (aiError) {
        console.warn("Gemini matching fallback:", aiError.message);
      } finally {
        aiMs = Date.now() - aiStartedAt;
      }
    }

    const aiSelected = new Set(aiResult.ids.map(String));

    const recommendations = baseRecommendations
      .map(({ panel, match, baseScore }) => {
        const aiBoost = aiSelected.has(String(panel._id)) ? 5 : 0;
        const score = Math.min(99, baseScore + aiBoost);

        return {
          panelId: String(panel._id),
          name: panel.name,
          email: panel.email,
          userId: panel.userId,
          role: panel.role,
          profession: panel.profession || "",
          expertiseTags: panel.expertiseTags || [],
          score,
          confidence: `${score}%`,
          matches: match.matches,
          reasons: [
            ...(aiResult.reasons?.[String(panel._id)]
              ? [`AI: ${aiResult.reasons[String(panel._id)]}`]
              : []),
            ...match.reasons,
          ].slice(0, 5),
          aiSelected: aiSelected.has(String(panel._id)),
        };
      })
      .sort((a, b) => b.score - a.score);

    const recommendedPanels = unique([
      ...aiResult.ids,
      ...recommendations.filter((item) => item.score >= 35).map((item) => item.panelId),
    ]).slice(0, 2);

    res.status(200).json({
      success: true,
      aiUsed: aiResult.used,
      aiModel: aiResult.model,
      scoringMethod: aiResult.used
        ? "Gemini recommendation plus deterministic expertise overlap score from stored database expertise tags."
        : "Deterministic expertise overlap score from stored database expertise tags.",
      studentId,
      researchTitle: finalTitle,
      hasAbstract: Boolean(finalAbstract),
      matchingMeta: {
        aiAttempted,
        deterministicMs,
        aiMs,
        totalMs: Date.now() - startedAt,
        panelsScored: baseRecommendations.length,
        aiPanelLimit: Math.max(AI_PANEL_LIMIT, 2),
      },
      recommendedPanels,
      recommendations,
    });
  } catch (error) {
    console.error("Expertise Matching Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to match panel expertise.",
      error: error.message,
    });
  }
};
