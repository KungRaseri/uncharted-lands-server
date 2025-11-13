/**
 * Test Helper Routes
 *
 * WARNING: These routes should ONLY be available in test/development environments
 * They provide dangerous operations like deleting users for test cleanup
 */

import { Router } from 'express';
import { db, accounts, profiles } from '../../db/index.js';
import { eq, like, desc } from 'drizzle-orm';
import { logger } from '../../utils/logger.js';
import { sendServerError, sendNotFoundError } from '../utils/responses.js';

const router = Router();

// Only enable these routes in test/development environments
const isTestEnvironment = process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'development';

if (!isTestEnvironment) {
  logger.warn('[TEST HELPERS] Test helper routes are disabled in production');
}

/**
 * Middleware to ensure test routes only work in test/dev
 */
const requireTestEnvironment = (req: any, res: any, next: any) => {
  if (!isTestEnvironment) {
    return res.status(403).json({
      error: 'Test helper routes are only available in test/development environments',
      code: 'FORBIDDEN',
    });
  }
  next();
};

/**
 * DELETE /api/test/cleanup/user/:email
 * Delete a test user and all associated data
 */
router.delete('/cleanup/user/:email', requireTestEnvironment, async (req, res) => {
  try {
    const { email } = req.params;

    logger.info(`[TEST CLEANUP] Cleaning up test user: ${email}`);

    // Find the user account
    const account = await db.query.accounts.findFirst({
      where: eq(accounts.email, email),
    });

    if (!account) {
      logger.warn(`[TEST CLEANUP] User not found: ${email}`);
      return sendNotFoundError(res, 'User not found');
    }

    // Delete in order due to foreign key constraints:
    // 1. Profile (will cascade to other data)
    await db.delete(profiles).where(eq(profiles.accountId, account.id));
    logger.info(`[TEST CLEANUP] Deleted profile for: ${email}`);

    // 2. Account
    await db.delete(accounts).where(eq(accounts.id, account.id));
    logger.info(`[TEST CLEANUP] Deleted account: ${email}`);

    res.json({
      success: true,
      message: `Test user ${email} and associated data deleted successfully`,
    });
  } catch (error) {
    logger.error('[TEST CLEANUP] Failed to delete test user', error);
    sendServerError(res, error, 'Failed to delete test user', 'CLEANUP_FAILED');
  }
});

/**
 * DELETE /api/test/cleanup/users/pattern
 * Delete all test users matching a pattern (e.g., %.test.local)
 */
router.delete('/cleanup/users/pattern', requireTestEnvironment, async (req, res) => {
  try {
    const { pattern } = req.body;

    if (!pattern || typeof pattern !== 'string') {
      return res.status(400).json({
        error: 'Pattern is required',
        code: 'MISSING_PATTERN',
      });
    }

    logger.info(`[TEST CLEANUP] Cleaning up test users with pattern: ${pattern}`);

    // Find all matching accounts
    const matchingAccounts = await db.select().from(accounts).where(like(accounts.email, pattern));

    if (matchingAccounts.length === 0) {
      return res.json({
        success: true,
        message: 'No matching users found',
        deletedCount: 0,
      });
    }

    const accountIds = matchingAccounts.map((a) => a.id);

    // Delete in order due to foreign key constraints
    for (const accountId of accountIds) {
      // 1. Profile (will cascade to other data)
      await db.delete(profiles).where(eq(profiles.accountId, accountId));

      // 2. Account
      await db.delete(accounts).where(eq(accounts.id, accountId));
    }

    logger.info(`[TEST CLEANUP] Deleted ${accountIds.length} test users`);

    res.json({
      success: true,
      message: `Deleted ${accountIds.length} test users matching pattern: ${pattern}`,
      deletedCount: accountIds.length,
      deletedEmails: matchingAccounts.map((a) => a.email),
    });
  } catch (error) {
    logger.error('[TEST CLEANUP] Failed to delete test users by pattern', error);
    sendServerError(res, error, 'Failed to delete test users', 'CLEANUP_FAILED');
  }
});

/**
 * DELETE /api/test/cleanup/all
 * Delete ALL test users (emails ending with @test.local)
 */
router.delete('/cleanup/all', requireTestEnvironment, async (req, res) => {
  try {
    logger.info('[TEST CLEANUP] Cleaning up ALL test users (@test.local)');

    // Find all test accounts
    const testAccounts = await db
      .select()
      .from(accounts)
      .where(like(accounts.email, '%@test.local'));

    if (testAccounts.length === 0) {
      return res.json({
        success: true,
        message: 'No test users found',
        deletedCount: 0,
      });
    }

    const accountIds = testAccounts.map((a) => a.id);

    // Delete in order due to foreign key constraints
    for (const accountId of accountIds) {
      await db.delete(profiles).where(eq(profiles.accountId, accountId));
      await db.delete(accounts).where(eq(accounts.id, accountId));
    }

    logger.info(`[TEST CLEANUP] Deleted ${accountIds.length} test users`);

    res.json({
      success: true,
      message: `Deleted ${accountIds.length} test users`,
      deletedCount: accountIds.length,
      deletedEmails: testAccounts.map((a) => a.email),
    });
  } catch (error) {
    logger.error('[TEST CLEANUP] Failed to delete all test users', error);
    sendServerError(res, error, 'Failed to delete test users', 'CLEANUP_FAILED');
  }
});

/**
 * GET /api/test/users
 * List all test users (emails ending with @test.local)
 */
router.get('/users', requireTestEnvironment, async (req, res) => {
  try {
    const testAccounts = await db
      .select({
        id: accounts.id,
        email: accounts.email,
        username: profiles.username,
        createdAt: accounts.createdAt,
      })
      .from(accounts)
      .leftJoin(profiles, eq(profiles.accountId, accounts.id))
      .where(like(accounts.email, '%@test.local'))
      .orderBy(desc(accounts.createdAt));

    res.json({
      success: true,
      count: testAccounts.length,
      users: testAccounts,
    });
  } catch (error) {
    logger.error('[TEST CLEANUP] Failed to list test users', error);
    sendServerError(res, error, 'Failed to list test users', 'LIST_FAILED');
  }
});

export default router;
