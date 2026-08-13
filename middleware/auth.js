const { verifyToken } = require('../utils/jwt');

// Authenticate Token
const authenticate = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1] || req.query.token;

  if (!token) {
    return res.status(401).json({ message: 'No token provided' });
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(403).json({ message: 'Invalid or expired token' });
  }

  req.user = decoded;
  next();
};

// Authorize by Role
const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Access denied' });
    }
    next();
  };
};

// Verify School Access
const verifySchoolAccess = (req, res, next) => {
  const schoolId = req.params.schoolId || req.body.schoolId;
  if (req.user.schoolId !== schoolId) {
    return res.status(403).json({ message: 'School access denied' });
  }
  next();
};

module.exports = {
  authenticate,
  authorize,
  verifySchoolAccess,
};
