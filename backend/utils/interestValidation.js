import Interest from "../models/Interest.js";

const normalizeInterest = value => {
  if (typeof value !== "string") return "";
  return value.trim().toLowerCase();
};

const normalizeInterests = interests => {
  if (!Array.isArray(interests)) return [];
  const normalized = interests.map(normalizeInterest).filter(Boolean);
  return [...new Set(normalized)];
};

export const getAllowedInterests = async () => {
  const docs = await Interest.find({ isActive: true })
    .sort({ name: 1 })
    .select("name -_id");
  return docs.map(d => d.name);
};

export const validateAndNormalizeInterests = async ({
  interest,
  primaryInterest,
}) => {
  const allowed = await getAllowedInterests();
  const normalizedPrimary = normalizeInterest(primaryInterest);
  if (!normalizedPrimary) {
    throw new Error("primaryInterest is required");
  }
  if (!allowed.includes(normalizedPrimary)) {
    throw new Error("primaryInterest is not allowed");
  }

  const normalizedInterests = normalizeInterests(interest);
  const invalid = normalizedInterests.filter(i => !allowed.includes(i));
  if (invalid.length > 0) {
    throw new Error(`Invalid interests: ${invalid.join(", ")}`);
  }

  const finalInterests = normalizedInterests.includes(normalizedPrimary)
    ? normalizedInterests
    : [...normalizedInterests, normalizedPrimary];

  return { interest: finalInterests, primaryInterest: normalizedPrimary };
};
