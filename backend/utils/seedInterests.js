import Interest from "../models/Interest.js";

const DEFAULT_INTERESTS = [
  "math",
  "physics",
  "chemistry",
  "biology",
  "computer science",
  "statistics",
  "economics",
  "accounting",
  "engineering",
  "medicine",
  "law",
  "literature",
  "history",
  "philosophy",
  "psychology",
  "business",
  "design",
  "music",
  "art",
  "football",
  "basketball",
  "chess",
  "coding",
  "python",
];

export const seedInterestsIfEmpty = async () => {
  const count = await Interest.countDocuments();
  if (count > 0) return;
  const docs = DEFAULT_INTERESTS.map(name => ({ name }));
  await Interest.insertMany(docs, { ordered: false });
};
