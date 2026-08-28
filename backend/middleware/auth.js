const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "change-this-development-secret";

function requireAdminAuth(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const [scheme, token] = authHeader.split(" ");

  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({ message: "Authentication required." });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.admin = {
      id: payload.sub,
      username: payload.username,
      role: payload.role,
    };
    return next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid or expired session." });
  }
}

function requireAgentAuth(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const [scheme, token] = authHeader.split(" ");

  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({ message: "Authentication required." });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);

    if (payload.token_type !== "agent" || payload.role !== "agent") {
      return res.status(403).json({ message: "Agent access is required." });
    }

    req.agent = {
      id: payload.sub,
      fullName: payload.full_name,
      email: payload.email,
      role: payload.role,
    };
    return next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid or expired session." });
  }
}

module.exports = {
  requireAdminAuth,
  requireAgentAuth,
  JWT_SECRET,
};
