/**
 * Authentication Middleware for REST API
 * 
 * Validates admin access for API endpoints
 */

import type { Request, Response, NextFunction } from 'express';
import { db } from '../../db';
import { accounts } from '../../db/schema';
import { eq } from 'drizzle-orm';
import { logger } from '../../utils/logger';

// Extend Express Request to include authenticated user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        username: string;
        role: 'MEMBER' | 'SUPPORT' | 'ADMINISTRATOR';
      };
    }
  }
}

/**
 * Authentication middleware for admin routes
 * 
 * Validates session cookie from SvelteKit and checks for ADMINISTRATOR role.
 * Session cookie contains userAuthToken which is used to look up the user.
 */
export const authenticateAdmin = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Extract session from cookies
    // SvelteKit sends cookies in the Cookie header
    const cookies = req.headers.cookie;
    
    if (!cookies) {
      logger.warn('[API AUTH] No cookies provided');
      res.status(401).json({ 
        error: 'Unauthorized', 
        code: 'NO_SESSION',
        message: 'Authentication required' 
      });
      return;
    }

    // Parse session cookie
    const sessionMatch = cookies.match(/session=([^;]+)/);
    const sessionToken = sessionMatch ? sessionMatch[1] : null;

    if (!sessionToken) {
      logger.warn('[API AUTH] No session token found in cookies');
      res.status(401).json({ 
        error: 'Unauthorized', 
        code: 'NO_SESSION',
        message: 'Authentication required' 
      });
      return;
    }

    // Validate session token against database
    const user = await db.query.accounts.findFirst({
      where: eq(accounts.userAuthToken, sessionToken),
      with: {
        profile: true
      }
    });

    if (!user) {
      logger.warn('[API AUTH] Invalid session token');
      res.status(401).json({ 
        error: 'Unauthorized', 
        code: 'INVALID_SESSION',
        message: 'Invalid or expired session' 
      });
      return;
    }

    // Check if user has ADMINISTRATOR role
    if (user.role !== 'ADMINISTRATOR') {
      logger.warn(`[API AUTH] User ${user.email} (${user.role}) attempted admin access`);
      res.status(403).json({ 
        error: 'Forbidden', 
        code: 'NOT_ADMIN',
        message: 'Administrator access required' 
      });
      return;
    }

    // Attach user to request
    req.user = {
      id: user.id,
      email: user.email,
      username: user.profile?.username || user.email,
      role: user.role as 'MEMBER' | 'SUPPORT' | 'ADMINISTRATOR'
    };

    logger.info(`[API AUTH] ✓ Admin ${user.email} authenticated`);
    next();
  } catch (error) {
    logger.error('[API AUTH] Authentication error:', error);
    res.status(500).json({ 
      error: 'Internal Server Error', 
      code: 'AUTH_ERROR',
      message: 'Authentication failed' 
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
    const cookies = req.headers.cookie;
    
    if (!cookies) {
      next();
      return;
    }

    const sessionMatch = cookies.match(/session=([^;]+)/);
    const sessionToken = sessionMatch ? sessionMatch[1] : null;

    if (!sessionToken) {
      next();
      return;
    }

    const user = await db.query.accounts.findFirst({
      where: eq(accounts.userAuthToken, sessionToken),
      with: {
        profile: true
      }
    });

    if (user) {
      req.user = {
        id: user.id,
        email: user.email,
        username: user.profile?.username || user.email,
        role: user.role as 'MEMBER' | 'SUPPORT' | 'ADMINISTRATOR'
      };
      logger.info(`[API AUTH] Optional auth: ${user.email} (${user.role})`);
    }

    next();
  } catch (error) {
    logger.error('[API AUTH] Optional auth error:', error);
    next(); // Continue even if auth fails
  }
};
