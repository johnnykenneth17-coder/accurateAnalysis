const adminMiddleware = (req, res, next) => {
  if (req.user && req.user.role && req.user.role.toLowerCase() === "admin") {
    next();
  } else {
    res.status(403).json({ error: "Admin access required" });
  }
};
module.exports = adminMiddleware;
