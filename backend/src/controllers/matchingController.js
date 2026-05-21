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

// @desc    Match Student Research Title/Abstract with best Panels
const STOPWORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "from",
  "into",
  "using",
  "based",
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

const IMPORTANT_SHORT_TOKENS = new Set(["ai", "ml", "dl", "nlp", "zkp", "iot", "ui", "ux"]);

const synonymGroups = [
  ["zero", "knowledge", "proof", "zkp", "cryptography", "authentication", "passwordless", "privacy", "encryption"],
  ["security", "secure", "cybersecurity", "information", "privacy", "encryption", "authentication", "access", "control"],
  ["artificial", "intelligence", "ai", "machine", "learning", "ml", "deep", "dl", "neural", "prediction", "classification"],
  ["natural", "language", "processing", "nlp", "text", "feedback", "sentiment", "comments"],
  ["web", "frontend", "backend", "react", "node", "express", "database", "usability", "interface", "platform"],
  ["blockchain", "distributed", "ledger", "smart", "contract", "audit", "traceability"],
  ["image", "vision", "computer", "classification", "recognition"],
  ["data", "analytics", "mining", "prediction", "classification"],
  ["network", "iot", "wireless", "sensor", "protocol", "cloud", "distributed", "monitoring"],
];

const normalizeTokens = (value = "") =>
  String(value)
    .toLowerCase()
    .normalize("NFKC")
    .replace(/zero-knowledge/g, "zero knowledge")
    .replace(/passwordless/g, "passwordless authentication")
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .map((word) => word.trim())
    .filter(
      (word) =>
        word &&
        !STOPWORDS.has(word) &&
        (word.length > 2 || IMPORTANT_SHORT_TOKENS.has(word)),
    );

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

const tagWeight = (tagText) => {
  const value = String(tagText || "").toLowerCase();
  if (/(zero|zkp|cryptography|authentication|security|artificial|machine|deep|blockchain|contract|network|iot|cloud|web|software|usability|natural language|nlp)/.test(value)) {
    return 1.15;
  }
  return 1;
};

const scorePanel = ({ titleText, abstractText, panel }) => {
  const titleTokens = expandTokens(normalizeTokens(titleText));
  const abstractTokens = expandTokens(normalizeTokens(abstractText));
  const contextText = `${titleText}. ${abstractText}`.toLowerCase();
  const contextTokens = new Set([...titleTokens, ...abstractTokens]);

  const expertiseTags = Array.isArray(panel.expertiseTags)
    ? panel.expertiseTags.filter(Boolean)
    : [];

  if (contextTokens.size === 0 || expertiseTags.length === 0) {
    return { score: 20, matches: [], reasons: ["No research text or panel expertise tags available."] };
  }

  let rawScore = 0;
  const matches = [];
  const reasons = [];

  for (const tag of expertiseTags) {
    const tagText = String(tag || "").toLowerCase().trim();
    const tagTokens = normalizeTokens(tagText);
    const expandedTagTokens = expandTokens(tagTokens);

    if (tagTokens.length === 0) continue;

    const exactPhrase = tagText.length >= 3 && contextText.includes(tagText);
    const titleOverlap = [...expandedTagTokens].filter((token) => titleTokens.has(token));
    const abstractOverlap = [...expandedTagTokens].filter((token) => abstractTokens.has(token));
    const uniqueOverlap = new Set([...titleOverlap, ...abstractOverlap]);

    const overlapRatio = uniqueOverlap.size / Math.max(tagTokens.length, 1);
    let tagScore = 0;

    if (exactPhrase) {
      tagScore = 42;
    } else if (overlapRatio >= 1) {
      tagScore = 36;
    } else if (overlapRatio >= 0.66) {
      tagScore = 30;
    } else if (overlapRatio >= 0.33) {
      tagScore = 20;
    } else if (uniqueOverlap.size > 0) {
      tagScore = 12;
    }

    if (titleOverlap.length > 0) tagScore += 10;
    if (abstractOverlap.length > 1) tagScore += 5;

    tagScore = Math.round(tagScore * tagWeight(tagText));

    if (tagScore > 0) {
      rawScore += tagScore;
      matches.push(tag);
      reasons.push(`${tag}: ${[...uniqueOverlap].slice(0, 5).join(", ") || "phrase match"}`);
    }
  }

  if (matches.length === 0) {
    return { score: 25, matches: [], reasons: ["No direct expertise keyword match found."] };
  }

  const coverageBonus = Math.min(matches.length * 6, 18);
  const diversityBonus = Math.min(new Set(matches.map((m) => String(m).toLowerCase().split(/\s+/)[0])).size * 3, 9);
  const finalScore = Math.max(35, Math.min(98, Math.round(rawScore + coverageBonus + diversityBonus)));

  return {
    score: finalScore,
    matches: [...new Set(matches)].slice(0, 8),
    reasons: reasons.slice(0, 6),
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

    const recommendations = availablePanels
      .map((panel) => {
        const match = scorePanel({
          titleText: finalTitle,
          abstractText: finalAbstract,
          panel,
        });

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
          reasons: match.reasons || [],
        };
      })
      .sort((a, b) => b.score - a.score);

    const recommendedPanels = recommendations
      .filter((item) => item.score >= 35)
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
