const {
  buildSupervisorConflictMessage,
  hasSupervisorPanelConflict,
} = require("./supervisorConflictValidation");

describe("supervisorConflictValidation", () => {
  it("detects when the supervisor is included in panel assignments", () => {
    expect(
      hasSupervisorPanelConflict({
        supervisorId: "panel-2",
        panelIds: ["panel-1", "panel-2"],
      }),
    ).toBe(true);
  });

  it("accepts panel assignments that exclude the supervisor", () => {
    expect(
      hasSupervisorPanelConflict({
        supervisorId: "panel-3",
        panelIds: ["panel-1", "panel-2"],
      }),
    ).toBe(false);
  });

  it("builds a clear conflict message", () => {
    expect(
      buildSupervisorConflictMessage({
        studentName: "Tan Mei Ling",
        context: "default panel assignment",
      }),
    ).toBe(
      "Conflict of interest: Tan Mei Ling's supervisor cannot also be selected as a panel for default panel assignment.",
    );
  });
});
