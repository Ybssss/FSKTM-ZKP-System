const User = require("../models/User");

exports.getPanelExpertise = async (req, res) => {
  try {
    const { panelName, userId } = req.query;
    const searchValue = String(userId || panelName || "").trim();

    if (!searchValue) {
      return res.status(400).json({
        success: false,
        message: "Panel name or user ID is required.",
      });
    }

    const panel = await User.findOne({
      role: { $in: ["panel", "admin"] },
      $or: [
        { userId: searchValue },
        { name: { $regex: searchValue.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" } },
      ],
    })
      .select("name userId expertiseTags")
      .lean();

    if (!panel) {
      return res.status(404).json({
        success: false,
        message: "Panel not found.",
      });
    }

    res.status(200).json({
      success: true,
      panelName: panel.name,
      userId: panel.userId,
      expertiseTags: Array.isArray(panel.expertiseTags)
        ? panel.expertiseTags.filter(Boolean)
        : [],
      source: "database",
    });
  } catch (error) {
    console.error("Database expertise lookup error:", error.message);
    res
      .status(500)
      .json({ success: false, message: "Failed to read expertise from database." });
  }
};
