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

      // Get user ID from token payload (should be { userId: ..., ... } now)
      const userId = decoded.userId;
      if (!userId) {
        console.error('Token verification failed: Token payload missing user ID');
        // Send response and return to prevent further execution
        return res.status(401).json({ message: 'Not authorized, invalid token payload' });
      }

      // Attach user ID to the request object for later use
      // Note: We don't fetch the full user details here to keep middleware fast.
      // Controllers can fetch details if needed using the ID.
      req.userId = userId; 
      return next(); // Explicitly return after calling next()
      
    } catch (error) {
      console.error('Token verification failed:', error.message); // Log specific error message
      // Send response and return 
      return res.status(401).json({ message: 'Not authorized, token failed' }); 
    }
  } 

  // If we reach here, it means no valid Bearer token was found in the header
  console.log('Authorization header missing or not Bearer token');
  return res.status(401).json({ message: 'Not authorized, no token' }); 
};

module.exports = { protect }; 