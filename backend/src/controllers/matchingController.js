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
exports.matchExpertise = async (req, res) => {
  try {
    const { researchTitle, studentId } = req.body;

    if (!researchTitle)
      return res
        .status(400)
        .json({ error: "Student must have a research title for AI matching." });

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error("CRITICAL: GEMINI_API_KEY is missing from .env file!");
      return res
        .status(500)
        .json({ error: "AI matching is disabled. Server misconfiguration." });
    }

    const student = await User.findById(studentId);

    const allPanels = await User.find({
      role: { $in: ["panel", "admin"] },
    }).select("_id name expertiseTags");

    // CONFLICT OF INTEREST BLOCK: Remove SV from AI's view
    const availablePanels = allPanels.filter((panel) => {
      if (!student.supervisorId) return true;
      return panel._id.toString() !== student.supervisorId.toString();
    });

    if (availablePanels.length === 0)
      return res.status(400).json({ error: "No available panels to match." });

    const genAI = new GoogleGenerativeAI(apiKey);

    const model = genAI.getGenerativeModel({
      model: "gemini-flash-lite-latest",
    });

    const prompt = `
      You are an expert academic routing AI for Universiti Tun Hussein Onn Malaysia (UTHM).
      
      Student Research Title: "${researchTitle}"

      Available Panels (JSON format):
      ${JSON.stringify(
        availablePanels.map((p) => ({
          id: p._id.toString(),
          expertise:
            p.expertiseTags && p.expertiseTags.length > 0
              ? p.expertiseTags.join(", ")
              : "Generalist Lecturer",
        })),
      )}

      CRITICAL RULES:
      1. ONLY select panels whose expertise is HIGHLY RELATED to the research title.
      2. If a panel's expertise has nothing to do with the title, DO NOT select them. Let them have lower priority. 
      3. It is perfectly fine to return only 1 ID or an empty array [] if no one is a good match.
      4. NEVER exceed 2 IDs.
      5. Return ONLY a valid JSON array of the string IDs. No explanations.
      Example: ["id1", "id2"] or ["id1"] or []
    `;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text().trim();

    let recommendedPanelIds = [];
    try {
      const firstBracket = responseText.indexOf("[");
      const lastBracket = responseText.lastIndexOf("]");
      if (firstBracket === -1 || lastBracket === -1)
        throw new Error("No array found");

      const cleanJson = responseText.substring(firstBracket, lastBracket + 1);
      let parsedIds = JSON.parse(cleanJson);

      recommendedPanelIds = parsedIds
        .map((id) => String(id))
        .filter((id) => availablePanels.some((p) => p._id.toString() === id))
        .slice(0, 2);
    } catch (parseError) {
      console.error("Gemini Parse Error:", responseText);
      return res
        .status(500)
        .json({ error: "AI returned malformed data. Please select manually." });
    }

    res
      .status(200)
      .json({ success: true, recommendedPanels: recommendedPanelIds });
  } catch (error) {
    console.error("AI Matching Error:", error);
    res.status(500).json({
      error: "Failed to communicate with AI Matcher. Servers might be busy.",
    });
  }
};
