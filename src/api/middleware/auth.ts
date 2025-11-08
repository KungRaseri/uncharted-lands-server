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

// Type alias for account roles
type AccountRole = 'MEMBER' | 'SUPPORT' | 'ADMINISTRATOR';

// Extend Express Request to include authenticated user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        username: string;
        role: AccountRole;
      };
    }
  }
}

/**
 * Extract session token from cookies
 * @param cookies - Cookie header string
 * @returns Session token or null
 */
function extractSessionToken(cookies: string | undefined): string | null {
  if (!cookies) {
    return null;
  }

  const sessionRegex = /session=([^;]+)/;
  const sessionMatch = sessionRegex.exec(cookies);
  return sessionMatch ? sessionMatch[1] : null;
}

/**
 * Validate session token and fetch user from database
 * @param sessionToken - Session token to validate
 * @returns User account or null
 */
async function validateSessionToken(sessionToken: string) {
  return await db.query.accounts.findFirst({
    where: eq(accounts.userAuthToken, sessionToken),
    with: {
      profile: true,
    },
  });
}

/**
 * Send unauthorized error response
 */
function sendUnauthorizedResponse(res: Response, code: string, message: string): void {
  res.status(401).json({
    error: 'Unauthorized',
    code,
    message,
  });
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
    const cookies = req.headers.cookie;
    const sessionToken = extractSessionToken(cookies);

    if (!sessionToken) {
      logger.warn('[API AUTH] No session token found');
      sendUnauthorizedResponse(res, 'NO_SESSION', 'Authentication required');
      return;
    }

    const user = await validateSessionToken(sessionToken);

    if (!user) {
      logger.warn('[API AUTH] Invalid session token');
      sendUnauthorizedResponse(res, 'INVALID_SESSION', 'Invalid or expired session');
      return;
    }

    // Check if user has ADMINISTRATOR role
    if (user.role !== 'ADMINISTRATOR') {
      logger.warn(`[API AUTH] User ${user.email} (${user.role}) attempted admin access`);
      res.status(403).json({
        error: 'Forbidden',
        code: 'NOT_ADMIN',
        message: 'Administrator access required',
      });
      return;
    }

    // Attach user to request
    req.user = {
      id: user.id,
      email: user.email,
      username: user.profile?.username || user.email,
      role: user.role,
    };

    logger.info(`[API AUTH] ✓ Admin ${user.email} authenticated`);
    next();
  } catch (error) {
    logger.error('[API AUTH] Authentication error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      code: 'AUTH_ERROR',
      message: 'Authentication failed',
    });
  }
};

/**
 * Authentication middleware for any authenticated user (not just admin)
 *
 * Validates session cookie and ensures user is logged in.
 */
export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const cookies = req.headers.cookie;
    const sessionToken = extractSessionToken(cookies);

    if (!sessionToken) {
      logger.warn('[API AUTH] No session token found');
      sendUnauthorizedResponse(res, 'NO_SESSION', 'Authentication required');
      return;
    }

    const user = await validateSessionToken(sessionToken);

    if (!user) {
      logger.warn('[API AUTH] Invalid session token');
      sendUnauthorizedResponse(res, 'INVALID_SESSION', 'Invalid or expired session');
      return;
    }

    // Attach user to request (no role check)
    req.user = {
      id: user.id,
      email: user.email,
      username: user.profile?.username || user.email,
      role: user.role,
    };

    logger.info(`[API AUTH] ✓ User ${user.email} authenticated`);
    next();
  } catch (error) {
    logger.error('[API AUTH] Authentication error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      code: 'AUTH_ERROR',
      message: 'Authentication failed',
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
    const sessionToken = extractSessionToken(cookies);

    if (!sessionToken) {
      next();
      return;
    }

    const user = await validateSessionToken(sessionToken);

    if (user) {
      req.user = {
        id: user.id,
        email: user.email,
        username: user.profile?.username || user.email,
        role: user.role,
      };
      logger.info(`[API AUTH] Optional auth: ${user.email} (${user.role})`);
    }

    next();
  } catch (error) {
    logger.error('[API AUTH] Optional auth error:', error);
    next(); // Continue even if auth fails
  }
};
