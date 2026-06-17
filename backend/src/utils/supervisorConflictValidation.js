const idString = (value) => String(value?._id || value || "");

const normalizePanelIds = (panelIds = []) =>
  (Array.isArray(panelIds) ? panelIds : [])
    .map((panel) => idString(panel?.panelId || panel))
    .filter(Boolean);

const hasSupervisorPanelConflict = ({ supervisorId, panelIds = [] }) => {
  const supervisorIdString = idString(supervisorId);
  if (!supervisorIdString) return false;
  return normalizePanelIds(panelIds).includes(supervisorIdString);
};

const buildSupervisorConflictMessage = ({
  studentName = "This student",
  context = "session assignment",
} = {}) =>
  `Conflict of interest: ${studentName}'s supervisor cannot also be selected as a panel for ${context}.`;

module.exports = {
  buildSupervisorConflictMessage,
  hasSupervisorPanelConflict,
  idString,
  normalizePanelIds,
};
