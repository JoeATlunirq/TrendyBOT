const jwt = require('jsonwebtoken');
const NocoDBService = require('../services/nocodb.service');

/**
 * Middleware to verify JWT and attach user to request object.
 */
const protect = async (req, res, next) => {
  let token;

  // Check for token in Authorization header (Bearer token)
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      // Get token from header
      token = req.headers.authorization.split(' ')[1];

      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Get user ID from token payload (assuming payload is { id: userId, ... })
      const userId = decoded.id;
      if (!userId) {
        throw new Error('Token payload missing user ID');
      }

      // Attach user ID to the request object for later use
      // Note: We don't fetch the full user details here to keep middleware fast.
      // Controllers can fetch details if needed using the ID.
      req.userId = userId; 
      next(); // Proceed to the next middleware or route handler
      
    } catch (error) {
      console.error('Token verification failed:', error);
      res.status(401).json({ message: 'Not authorized, token failed' });
    }
  } 

  if (!token) {
    res.status(401).json({ message: 'Not authorized, no token' });
  }
};

module.exports = { protect }; 