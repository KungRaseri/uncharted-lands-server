/**
 * Authentication Middleware for REST API
 * 
 * Validates admin access for API endpoints
 */

import type { Request, Response, NextFunction } from 'express';
import { logger } from '../../utils/logger';

/**
 * Temporary authentication middleware
 * 
 * TODO: Implement proper authentication
 * - Parse session cookie from SvelteKit
 * - Validate session token
 * - Check user has ADMINISTRATOR role
 * - Attach user to req.user
 * 
 * For now, this allows all requests (INSECURE)
 */
export const authenticateAdmin = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // TODO: Real authentication
    // const authToken = req.headers.authorization?.replace('Bearer ', '');
    // const session = await validateSession(authToken);
    // if (!session || session.role !== 'ADMINISTRATOR') {
    //   res.status(403).json({ error: 'Forbidden', code: 'NOT_ADMIN' });
    //   return;
    // }
    // req.user = session.user;

    // ⚠️ WARNING: NO AUTHENTICATION - DEVELOPMENT ONLY
    logger.warn('[API AUTH] ⚠️ Authentication middleware bypassed (development mode)');
    
    next();
  } catch (error) {
    logger.error('[API AUTH] Authentication error:', error);
    res.status(401).json({ 
      error: 'Unauthorized', 
      code: 'AUTH_FAILED' 
    });
  }
};

/**
 * Optional authentication (allows unauthenticated access but attaches user if present)
 */
export const optionalAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // TODO: Attempt to authenticate but don't fail if no auth
    next();
  } catch (error) {
    next(); // Continue even if auth fails
  }
};
