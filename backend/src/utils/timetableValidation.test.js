const {
  buildValidationItems,
  validateItems,
} = require("./timetableValidation");

describe("timetableValidation", () => {
  it("accepts non-conflicting timetable rows", () => {
    const items = buildValidationItems([
      {
        title: "Session A",
        studentId: "student-1",
        panels: ["panel-1", "panel-2"],
        date: "2026-06-11",
        startTime: "09:00",
        endTime: "10:00",
      },
      {
        title: "Session B",
        studentId: "student-2",
        panels: ["panel-3", "panel-4"],
        date: "2026-06-11",
        startTime: "10:00",
        endTime: "11:00",
      },
    ]);

    expect(() => validateItems(items)).not.toThrow();
  });

  it("rejects duplicate panel assignment inside one session", () => {
    const items = buildValidationItems([
      {
        title: "Duplicate Panel Session",
        studentId: "student-1",
        panels: ["panel-1", "panel-1"],
        date: "2026-06-11",
        startTime: "09:00",
        endTime: "10:00",
      },
    ]);

    expect(() => validateItems(items)).toThrow("duplicate panel selected");
  });

  it("rejects same student scheduled twice on the same day", () => {
    const items = buildValidationItems([
      {
        title: "Morning Session",
        studentId: "student-1",
        panels: ["panel-1", "panel-2"],
        date: "2026-06-11",
        startTime: "09:00",
        endTime: "10:00",
      },
      {
        title: "Afternoon Session",
        studentId: "student-1",
        panels: ["panel-3", "panel-4"],
        date: "2026-06-11",
        startTime: "14:00",
        endTime: "15:00",
      },
    ]);

    try {
      validateItems(items);
      throw new Error("Expected validation to fail.");
    } catch (error) {
      expect(error.validationErrors).toEqual(
        expect.arrayContaining([
          "Student conflict: one student can only have one session per day (Afternoon Session).",
        ]),
      );
    }
  });

  it("reports overlapping conflicts for each shared panel", () => {
    const items = buildValidationItems([
      {
        title: "Session A",
        studentId: "student-1",
        panels: ["panel-1", "panel-2"],
        date: "2026-06-11",
        startTime: "09:00",
        endTime: "10:30",
      },
      {
        title: "Session B",
        studentId: "student-2",
        panels: ["panel-1", "panel-2"],
        date: "2026-06-11",
        startTime: "10:00",
        endTime: "11:00",
      },
    ]);

    try {
      validateItems(items);
      throw new Error("Expected validation to fail.");
    } catch (error) {
      expect(error.validationErrors).toEqual(
        expect.arrayContaining([
          "Panel conflict: panel panel-1 is assigned at overlapping time (Session A / Session B).",
          "Panel conflict: panel panel-2 is assigned at overlapping time (Session A / Session B).",
        ]),
      );
    }
  });
});
