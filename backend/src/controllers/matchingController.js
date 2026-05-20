const User = require("../models/User");
const { GoogleGenerativeAI } = require("@google/generative-ai");

exports.assignPanelToStudent = async (req, res) => {
  try {
    const { studentId, panelId } = req.body;
    const student = await User.findById(studentId);
    const panel = await User.findById(panelId);

    if (!student || !panel)
      return res
        .status(404)
        .json({ success: false, message: "Student or panel not found" });

    // Use $addToSet to prevent duplicates safely
    if (!student.assignedPanels.includes(panelId)) {
      student.assignedPanels.push(panelId);
      await student.save();
    }
    if (!panel.assignedStudents.includes(studentId)) {
      panel.assignedStudents.push(studentId);
      await panel.save();
    }

    res.json({
      success: true,
      message: "Panel assigned to student successfully",
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error assigning panel" });
  }
};

exports.getMyStudents = async (req, res) => {
  try {
    const panel = await User.findById(req.user.id || req.user._id).populate(
      "assignedStudents",
      "name matricNumber program researchTitle",
    );
    res.json({ success: true, students: panel.assignedStudents || [] });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Error fetching students" });
  }
};

exports.getMyPanels = async (req, res) => {
  try {
    const student = await User.findById(req.user.id || req.user._id).populate(
      "assignedPanels",
      "name email",
    );
    res.json({ success: true, panels: student.assignedPanels || [] });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error fetching panels" });
  }
};

// @desc    Use Gemini AI to match Student Research Title with best Panels
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
  "study",
  "research",
  "approach",
  "method",
  "model",
  "framework",
  "application",
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
]);

const synonymGroups = [
  [
    "zero",
    "knowledge",
    "proof",
    "zkp",
    "cryptography",
    "authentication",
    "passwordless",
  ],
  [
    "security",
    "secure",
    "cybersecurity",
    "information",
    "privacy",
    "encryption",
  ],
  ["artificial", "intelligence", "ai", "machine", "learning", "deep", "neural"],
  ["web", "frontend", "backend", "react", "node", "express", "database"],
  ["blockchain", "distributed", "ledger", "smart", "contract"],
  ["image", "vision", "computer", "classification", "recognition"],
  ["data", "analytics", "mining", "prediction", "classification"],
  ["network", "iot", "wireless", "sensor", "protocol"],
];

const normalizeTokens = (value = "") =>
  String(value)
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .map((word) => word.trim())
    .filter((word) => word.length > 2 && !STOPWORDS.has(word));

const expandTokens = (tokens) => {
  const expanded = new Set(tokens);

  for (const group of synonymGroups) {
    const hasGroupWord = group.some((word) => expanded.has(word));
    if (hasGroupWord) {
      group.forEach((word) => expanded.add(word));
    }
  }

  return expanded;
};

const scorePanel = (contextText, panel) => {
  const contextTokens = expandTokens(normalizeTokens(contextText));
  const expertiseTags = Array.isArray(panel.expertiseTags)
    ? panel.expertiseTags.filter(Boolean)
    : [];

  if (contextTokens.size === 0 || expertiseTags.length === 0) {
    return {
      score: 10,
      matches: [],
    };
  }

  let totalScore = 0;
  const matches = [];

  for (const tag of expertiseTags) {
    const tagText = String(tag || "").toLowerCase();
    const tagTokens = normalizeTokens(tagText);

    if (tagTokens.length === 0) continue;

    const expandedTagTokens = expandTokens(tagTokens);
    const overlappingTokens = [...expandedTagTokens].filter((token) =>
      contextTokens.has(token),
    );

    const overlapRatio = overlappingTokens.length / expandedTagTokens.size;
    const phraseMatched = contextText.toLowerCase().includes(tagText);

    let tagScore = 0;

    if (phraseMatched) {
      tagScore = 95;
    } else if (overlapRatio >= 0.75) {
      tagScore = 85;
    } else if (overlapRatio >= 0.5) {
      tagScore = 75;
    } else if (overlapRatio > 0) {
      tagScore = Math.max(45, Math.round(overlapRatio * 70));
    }

    if (tagScore > 0) {
      totalScore += tagScore;
      matches.push(tag);
    }
  }

  if (matches.length === 0) {
    return {
      score: 15,
      matches: [],
    };
  }

  const average = totalScore / matches.length;
  const coverageBonus = Math.min(matches.length * 5, 15);
  const finalScore = Math.min(95, Math.round(average + coverageBonus));

  return {
    score: finalScore,
    matches,
  };
};

exports.matchExpertise = async (req, res) => {
  try {
    const { researchTitle, researchAbstract, studentId } = req.body;

    const student = studentId
      ? await User.findById(studentId).select(
          "name researchTitle researchAbstract supervisorId",
        )
      : null;

    const finalTitle = String(
      researchTitle || student?.researchTitle || "",
    ).trim();

    const finalAbstract = String(
      researchAbstract || student?.researchAbstract || "",
    ).trim();

    if (!finalTitle && !finalAbstract) {
      return res.status(400).json({
        success: false,
        message:
          "Student must have a research title or abstract for expertise matching.",
      });
    }

    const allPanels = await User.find({
      role: { $in: ["panel", "admin"] },
    }).select("_id name email userId role expertiseTags");

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

    const contextText = `${finalTitle}. ${finalAbstract}`;

    const recommendations = availablePanels
      .map((panel) => {
        const match = scorePanel(contextText, panel);

        return {
          panelId: String(panel._id),
          name: panel.name,
          email: panel.email,
          userId: panel.userId,
          role: panel.role,
          expertiseTags: panel.expertiseTags || [],
          score: match.score,
          confidence: `${match.score}%`,
          matches: match.matches,
        };
      })
      .sort((a, b) => b.score - a.score);

    const recommendedPanels = recommendations
      .filter((item) => item.score >= 30)
      .slice(0, 2)
      .map((item) => item.panelId);

    res.status(200).json({
      success: true,
      studentId,
      researchTitle: finalTitle,
      hasAbstract: Boolean(finalAbstract),
      recommendedPanels,
      recommendations,
    });
  } catch (error) {
    console.error("AI Matching Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to match panel expertise.",
      error: error.message,
    });
  }
};
