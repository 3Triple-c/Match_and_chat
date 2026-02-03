import jwt from "jsonwebtoken";
import User from "../models/User.js";

export const protect = async (req, res, next) => {
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];
  }
  if (!token) {
    return res.status(401).json({ message: "Not authorized,no token" });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRETT);
    // console.log("token: ",token)
    // console.log("decoded: ",decoded)
    // attach user (without password) to request object
    req.user = await User.findById(decoded.id).select("-password");

    next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({
        message: "Session expire. please login again",
        code: "TOKEN_EXPIRED",
      });
    }
    console.error(err);
    return res.status(401).json({ message: "Not authorized,token failed" });
  }
};
