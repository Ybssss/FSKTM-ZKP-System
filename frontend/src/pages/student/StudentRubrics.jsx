import React, { useState, useEffect } from "react";
import { rubricAPI } from "../../services/api";
import { ClipboardList, Search, ChevronDown, ChevronUp } from "lucide-react";
import UserProfileLink from "../../components/UserProfileLink";
import {
  formatMarkLabel,
  getCriterionMaxScore,
  getScoreDescription,
  getScoreScale,
} from "../../utils/evaluationForm";
import { getRubricDisplayName } from "../../utils/rubricLabels";

export default function StudentRubrics() {
  const [rubrics, setRubrics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedRubric, setExpandedRubric] = useState(null);

  useEffect(() => {
    fetchRubrics();
  }, []);

  const fetchRubrics = async () => {
    try {
      setLoading(true);
      const response = await rubricAPI.getAll();
      // Only show active rubrics to students
      const availableRubrics = response.rubrics || response.data || [];
      setRubrics(availableRubrics);
    } catch (error) {
      console.error("Error fetching rubrics:", error);
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (rubricId) => {
    setExpandedRubric(expandedRubric === rubricId ? null : rubricId);
  };

  const filteredRubrics = rubrics.filter(
    (r) =>
      r.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.description?.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Evaluation Rubrics</h1>
        <p className="text-gray-600 mt-1">
          View the rubrics used for evaluating your progress
        </p>
      </div>

      {/* Search */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Search Rubrics
        </label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search by name or description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <div className="mt-2 text-sm text-gray-600">
          Showing {filteredRubrics.length} of {rubrics.length} rubrics
        </div>
      </div>

      {/* Rubrics List */}
      <div className="space-y-4">
        {filteredRubrics.length > 0 ? (
          filteredRubrics.map((rubric) => {
            const isExpanded = expandedRubric === rubric._id;
            const quantitativeCriteria =
              rubric.criteria?.filter(
                (criterion) => criterion.type !== "qualitative",
              ) || [];
            const totalWeightage = quantitativeCriteria.reduce(
              (sum, criterion) => sum + Number(criterion.weight || 0),
              0,
            );
            const rubricSummary = quantitativeCriteria.length
              ? `Total Weightage: ${totalWeightage}%`
              : "Qualitative feedback rubric";

            return (
              <div
                key={rubric._id}
                className="bg-white rounded-lg border border-gray-200"
              >
                <div
                  className="p-6 cursor-pointer"
                  onClick={() => toggleExpand(rubric._id)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900">
                          {getRubricDisplayName(rubric)}
                        </h3>
                      </div>
                      {rubric.description && (
                        <p className="text-sm text-gray-600 mt-1">
                          {rubric.description}
                        </p>
                      )}
                      <div className="flex items-center gap-4 mt-3 text-sm text-gray-600">
                        <span>{rubric.criteria?.length || 0} Criteria</span>
                        <span>{rubricSummary}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {isExpanded ? (
                        <ChevronUp className="w-6 h-6 text-gray-400" />
                      ) : (
                        <ChevronDown className="w-6 h-6 text-gray-400" />
                      )}
                    </div>
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-gray-200 p-6 bg-gray-50">
                    <h4 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      <ClipboardList className="w-5 h-5 text-blue-600" />
                      Evaluation Criteria
                    </h4>
                    <div className="space-y-3">
                      {rubric.criteria?.map((criterion, index) => (
                        <div
                          key={index}
                          className="bg-white rounded-lg border border-gray-200 p-4"
                        >
                          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                            <div className="flex-1">
                              <h5 className="font-bold text-gray-900">
                                {criterion.title ||
                                  criterion.key ||
                                  `Criterion ${index + 1}`}
                              </h5>

                              {criterion.description && (
                                <p className="text-sm text-gray-600 mt-1">
                                  {criterion.description}
                                </p>
                              )}

                              <div className="flex flex-wrap gap-2 mt-3">
                                <span className="px-2 py-1 bg-blue-50 text-blue-700 text-xs font-bold rounded border border-blue-100">
                                  Type: {criterion.type || "quantitative"}
                                </span>

                                {criterion.type !== "qualitative" ? (
                                  <>
                                    <span className="px-2 py-1 bg-gray-50 text-gray-700 text-xs font-bold rounded border border-gray-100">
                                      Max Score: {criterion.maxScore ?? 5}
                                    </span>

                                    <span className="px-2 py-1 bg-gray-50 text-gray-700 text-xs font-bold rounded border border-gray-100">
                                      Weight: {criterion.weight ?? 0}%
                                    </span>
                                  </>
                                ) : (
                                  <span className="px-2 py-1 bg-amber-50 text-amber-700 text-xs font-bold rounded border border-amber-100">
                                    Feedback prompt
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {criterion.type !== "qualitative" && (
                            <div className="mt-4 border-t border-gray-100 pt-4">
                              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">
                                  Marking Scale
                                </p>
                                <span className="text-xs font-semibold text-gray-500">
                                  {getCriterionMaxScore(criterion) + 1} score slots
                                </span>
                              </div>

                              <div className="overflow-x-auto rounded-lg border border-gray-200">
                                <table className="w-full min-w-[900px] table-fixed text-left text-sm">
                                  <thead>
                                    <tr className="bg-white border-b border-gray-200">
                                      {getScoreScale(criterion).map((score) => (
                                        <th
                                          key={score.value}
                                          className="p-3 border-r last:border-r-0 border-gray-200 text-center font-bold text-gray-500 text-xs uppercase tracking-wider"
                                        >
                                          {formatMarkLabel(score.value)}
                                        </th>
                                      ))}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    <tr className="divide-x divide-gray-200">
                                      {getScoreScale(criterion).map((score) => (
                                        <td
                                          key={score.value}
                                          className="align-top bg-gray-50 p-4"
                                        >
                                          <div className="flex min-h-[172px] flex-col items-center text-center">
                                            <span className="mb-3 rounded-full bg-gray-900 px-2.5 py-1 text-[11px] font-black text-white">
                                              {formatMarkLabel(score.value)}
                                            </span>
                                            <span className="mb-3 rounded bg-gray-100 px-2 py-1 text-[11px] font-black text-gray-600">
                                              Max {getCriterionMaxScore(criterion)}
                                            </span>
                                            <p className="text-xs leading-relaxed text-gray-700">
                                              {getScoreDescription(criterion, score)}
                                            </p>
                                          </div>
                                        </td>
                                      ))}
                                    </tr>
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    {rubric.createdBy && (
                      <div className="mt-4 pt-4 border-t border-gray-200 text-sm text-gray-600">
                        Created by:{" "}
                        <UserProfileLink
                          user={rubric.createdBy}
                          fallback="Administrator"
                          className="font-semibold"
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <ClipboardList className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              No Rubrics Found
            </h3>
            <p className="text-gray-600">
              {rubrics.length === 0
                ? "No evaluation rubrics are currently available."
                : "No rubrics match your search criteria."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
