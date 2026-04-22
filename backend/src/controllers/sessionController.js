exports.createSession = async (req, res) => {
  try {
    const { studentId, sessionType, semester, panel1Id, panel2Id } = req.body;

    const student = await User.findById(studentId);

    if (
      student.supervisorId.toString() === panel1Id ||
      student.supervisorId.toString() === panel2Id
    ) {
      return res.status(400).json({
        error:
          "Conflict of Interest: A Supervisor cannot be assigned as an evaluating panel for their own student.",
      });
    }

    if (panel1Id === panel2Id) {
      return res
        .status(400)
        .json({ error: "Panel 1 and Panel 2 must be different examiners." });
    }

    const newSession = new Session({
      studentId,
      sessionType,
      semester,
      panel1Id,
      panel2Id,
    });
    await newSession.save();

    res
      .status(201)
      .json({ message: "Session scheduled successfully", session: newSession });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
