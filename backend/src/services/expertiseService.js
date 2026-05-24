const mongoose = require("mongoose");
const User = require("../models/User");

const cleanTags = (tags = []) =>
  [...new Set(tags.map((tag) => String(tag || "").trim()).filter(Boolean))];

exports.fetchUserExpertise = async (identifier) => {
  const value = String(identifier || "").trim();

  if (!value) return [];

  const query = {
    role: { $in: ["panel", "admin"] },
    $or: [{ userId: value }],
  };

  if (mongoose.Types.ObjectId.isValid(value)) {
    query.$or.push({ _id: value });
  }

  const user = await User.findOne(query).select("expertiseTags").lean();

  return cleanTags(user?.expertiseTags || []);
};
