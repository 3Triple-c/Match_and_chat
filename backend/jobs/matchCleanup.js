import Match from "../models/Match.js";
export const startMatchCleanup = () => {
  setInterval(async () => {
    const now = new Date();
    await Match.updateMany(
      {
        isActive: true,
        expiresAt: { $lt: now },
      },
      { $set: { isActive: false } },
    );
  }, 60 * 1000);
};
