const MAX_PROFILE_IMAGE_URL_LENGTH = 2_200_000;
const PROFILE_IMAGE_PATTERN =
  /^data:image\/(?:png|jpe?g|webp);base64,[A-Za-z0-9+/=]+$/;

const idString = (value) => String(value?._id || value || "");

const cleanProfileImageUrl = (value) => {
  const profileImageUrl = String(value || "").trim();
  if (!profileImageUrl) return "";
  if (profileImageUrl.length > MAX_PROFILE_IMAGE_URL_LENGTH) {
    const err = new Error("Profile image must be smaller than 1.5 MB.");
    err.statusCode = 400;
    throw err;
  }
  if (!PROFILE_IMAGE_PATTERN.test(profileImageUrl)) {
    const err = new Error("Profile image must be a PNG, JPG, JPEG, or WebP file.");
    err.statusCode = 400;
    throw err;
  }
  return profileImageUrl;
};

const mergeStaffStudents = (assignedStudents = [], supervisedStudents = []) => {
  const byId = new Map();

  const addStudent = (student, relation) => {
    const raw = student?.toObject ? student.toObject() : student;
    if (!raw) return;

    const key = idString(raw._id);
    const existing = byId.get(key);

    if (existing) {
      const relations = new Set([
        ...(existing.profileRelations || [existing.profileRelation]).filter(Boolean),
        relation,
      ]);
      existing.profileRelations = [...relations];
      existing.profileRelation = [...relations].join(" & ");
      byId.set(key, existing);
      return;
    }

    byId.set(key, {
      ...raw,
      profileRelations: [relation],
      profileRelation: relation,
    });
  };

  assignedStudents.forEach((student) => addStudent(student, "Panel"));
  supervisedStudents.forEach((student) => addStudent(student, "Supervisor"));

  return [...byId.values()].sort((a, b) =>
    String(a.name || a.userId || "").localeCompare(
      String(b.name || b.userId || ""),
    ),
  );
};

module.exports = {
  MAX_PROFILE_IMAGE_URL_LENGTH,
  PROFILE_IMAGE_PATTERN,
  cleanProfileImageUrl,
  mergeStaffStudents,
};
