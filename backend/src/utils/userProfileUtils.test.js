const {
  cleanProfileImageUrl,
  mergeStaffStudents,
} = require("./userProfileUtils");

describe("userProfileUtils", () => {
  it("accepts supported base64 image payloads", () => {
    const payload = "  data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUA  ";

    expect(cleanProfileImageUrl(payload)).toBe(
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUA",
    );
  });

  it("rejects unsupported image formats", () => {
    expect(() =>
      cleanProfileImageUrl("data:image/gif;base64,R0lGODlhAQABAIAAAAUEBA=="),
    ).toThrow("Profile image must be a PNG, JPG, JPEG, or WebP file.");
  });

  it("allows clearing the stored image", () => {
    expect(cleanProfileImageUrl("")).toBe("");
    expect(cleanProfileImageUrl(null)).toBe("");
  });

  it("merges panel and supervisor relationships for the same student", () => {
    const merged = mergeStaffStudents(
      [
        { _id: "student-2", name: "Zara Panel Only" },
        { _id: "student-1", name: "Ali Shared" },
      ],
      [
        { _id: "student-1", name: "Ali Shared" },
        { _id: "student-3", name: "Bala Supervisor Only" },
      ],
    );

    expect(merged).toEqual([
      expect.objectContaining({
        _id: "student-1",
        name: "Ali Shared",
        profileRelation: "Panel & Supervisor",
        profileRelations: ["Panel", "Supervisor"],
      }),
      expect.objectContaining({
        _id: "student-3",
        name: "Bala Supervisor Only",
        profileRelation: "Supervisor",
        profileRelations: ["Supervisor"],
      }),
      expect.objectContaining({
        _id: "student-2",
        name: "Zara Panel Only",
        profileRelation: "Panel",
        profileRelations: ["Panel"],
      }),
    ]);
  });
});
