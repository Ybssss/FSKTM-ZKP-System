const RUBRIC_NAME_ALIASES = {
  "Research Proposal Evaluation Rubric": "Research Proposal Rubric",
  "Progress Report Assessment Form": "Progress Report Form",
  "Pre-Oral Examination (Pre-Viva Voce) Rubric": "Pre-Viva Rubric",
};

const formatSessionType = (value = "") =>
  String(value || "")
    .replaceAll("_", " ")
    .trim();

const normalizeText = (value = "") => String(value || "").trim();

export const getRubricDisplayName = (rubricOrName, sessionType = "") => {
  const rawName =
    typeof rubricOrName === "string" ? rubricOrName : rubricOrName?.name;
  const normalizedName = normalizeText(rawName);

  if (normalizedName) {
    return RUBRIC_NAME_ALIASES[normalizedName] || normalizedName;
  }

  const fallbackSessionType = formatSessionType(
    typeof rubricOrName === "object" && rubricOrName?.sessionType
      ? rubricOrName.sessionType
      : sessionType,
  );

  return fallbackSessionType || "Rubric";
};
