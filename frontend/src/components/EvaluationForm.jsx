import React, { useState } from "react";
import api from "../services/api";

const SCALE = [
  { label: "Exemplary", value: 4 },
  { label: "Proficient", value: 3 },
  { label: "Satisfactory", value: 2 },
  { label: "Foundational", value: 1 },
  { label: "Novice", value: 0 },
];

const EvaluationForm = ({ session, user }) => {
  const [loading, setLoading] = useState(false);

  // State for Rubric
  const [scores, setScores] = useState({});
  const [overallComments, setOverallComments] = useState("");

  // State for Progress Assessment
  const [progressData, setProgressData] = useState({
    summaryOfProgress: "",
    commentsForImprovement: "",
    overallSuggestions: "",
  });

  const isScored =
    session.sessionType === "PROPOSAL_DEFENSE" ||
    session.sessionType === "PRE_VIVA";

  // Assuming you fetch criteria from the backend based on rubricId, but hardcoded here for simplicity
  const criteria = [
    { key: "crit_a_title", title: "CRITERIA A: PROPOSED RESEARCH TITLE" },
    { key: "crit_b_abstract", title: "CRITERIA B: ABSTRACT" },
    // ... add the rest
  ];

  const totalMarks = Object.values(scores).reduce((a, b) => a + b, 0);
  const percentage =
    criteria.length > 0
      ? ((totalMarks / (criteria.length * 4)) * 100).toFixed(2)
      : 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const payload = {
        sessionId: session._id,
        studentId: session.studentId,
        evaluatorId: user.id, // Current logged-in panel
        sessionType: session.sessionType,
      };

      if (isScored) {
        payload.scores = scores;
        payload.totalMarks = parseFloat(percentage);
        payload.overallComments = overallComments;
        payload.rubricId = session.rubricId; // Make sure this is passed down
      } else {
        payload.summaryOfProgress = progressData.summaryOfProgress;
        payload.commentsForImprovement = progressData.commentsForImprovement;
        payload.overallSuggestions = progressData.overallSuggestions;
        payload.formFiller = "Panel";
      }

      await api.post("/evaluation/submit", payload);
      alert("Evaluation submitted successfully!");
    } catch (error) {
      alert(
        "Error submitting: " + (error.response?.data?.error || error.message),
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white shadow-lg rounded-lg mt-6">
      <h2 className="text-2xl font-bold text-gray-800 mb-2 border-b pb-2">
        {isScored ? "Evaluation Rubric" : "Progress Report Assessment Form"}
      </h2>
      <p className="text-sm text-gray-600 mb-6">
        Session Type: <strong>{session.sessionType.replace("_", " ")}</strong>
      </p>

      <form onSubmit={handleSubmit}>
        {/* ==================================================== */}
        {/* VIEW 1: PROGRESS ASSESSMENT FORM (Text Only)         */}
        {/* ==================================================== */}
        {!isScored && (
          <div className="space-y-4">
            <div>
              <label className="block font-bold mb-1">
                Summary of Research Progress:
              </label>
              <textarea
                required
                className="w-full p-2 border rounded"
                rows="4"
                value={progressData.summaryOfProgress}
                onChange={(e) =>
                  setProgressData({
                    ...progressData,
                    summaryOfProgress: e.target.value,
                  })
                }
              />
            </div>
            <div>
              <label className="block font-bold mb-1">
                Comments for Improvement:
              </label>
              <textarea
                required
                className="w-full p-2 border rounded"
                rows="4"
                value={progressData.commentsForImprovement}
                onChange={(e) =>
                  setProgressData({
                    ...progressData,
                    commentsForImprovement: e.target.value,
                  })
                }
              />
            </div>
            <div>
              <label className="block font-bold mb-1">
                Overall Suggestions:
              </label>
              <textarea
                required
                className="w-full p-2 border rounded"
                rows="4"
                value={progressData.overallSuggestions}
                onChange={(e) =>
                  setProgressData({
                    ...progressData,
                    overallSuggestions: e.target.value,
                  })
                }
              />
            </div>
          </div>
        )}

        {/* ==================================================== */}
        {/* VIEW 2: SCORED RUBRIC (Proposal / Pre-Viva)          */}
        {/* ==================================================== */}
        {isScored && (
          <>
            <table className="w-full text-left border-collapse mb-6 text-sm">
              <thead>
                <tr className="bg-indigo-700 text-white">
                  <th className="p-2 border">Criteria</th>
                  {SCALE.map((s) => (
                    <th key={s.value} className="p-2 border text-center">
                      {s.label} ({s.value})
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {criteria.map((crit) => (
                  <tr key={crit.key} className="hover:bg-gray-50 border-b">
                    <td className="p-2 font-semibold w-1/3">{crit.title}</td>
                    {SCALE.map((s) => (
                      <td key={s.value} className="p-2 text-center border-x">
                        <input
                          type="radio"
                          name={crit.key}
                          required
                          className="w-4 h-4 cursor-pointer"
                          onChange={() =>
                            setScores((prev) => ({
                              ...prev,
                              [crit.key]: s.value,
                            }))
                          }
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="bg-indigo-50 p-4 rounded-md flex justify-between items-center mb-6">
              <span className="font-bold">Calculated Score:</span>
              <span className="text-xl font-black text-indigo-700">
                {percentage}%
              </span>
            </div>

            <div className="mb-6">
              <label className="block font-bold mb-2">
                Overall Comments (Indexed for Search):
              </label>
              <textarea
                required
                className="w-full p-2 border rounded"
                rows="4"
                value={overallComments}
                onChange={(e) => setOverallComments(e.target.value)}
              />
            </div>
          </>
        )}

        <button
          type="submit"
          disabled={loading}
          className="mt-6 w-full bg-blue-600 text-white font-bold py-3 rounded hover:bg-blue-700"
        >
          {loading ? "Submitting..." : "Submit Evaluation"}
        </button>
      </form>
    </div>
  );
};

export default EvaluationForm;
