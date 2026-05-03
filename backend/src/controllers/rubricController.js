const Rubric = require("../models/Rubric");

exports.getAllRubrics = async (req, res) => {
  try {
    const rubrics = await Rubric.find({});
    res.status(200).json({ success: true, data: rubrics });
  } catch (error) {
    console.error("Error fetching rubrics:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to fetch rubrics." });
  }
};
