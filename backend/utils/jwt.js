export const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET || process.env.JWT_SECRETT;

  if (!secret) {
    throw new Error("JWT secret is not configured");
  }

  return secret;
};
