/**
 * Players (Accounts/Profiles) API Routes
 *
 * Admin operations for user management
 */

import { Router } from 'express';
import { eq } from 'drizzle-orm';
import { db, accounts } from '../../db/index';
import { authenticateAdmin } from '../middleware/auth';
import { logger } from '../../utils/logger';

const router = Router();

/**
 * GET /api/players
 * List all players (accounts with profiles)
 */
router.get('/', authenticateAdmin, async (req, res) => {
  try {
    const allAccounts = await db.query.accounts.findMany({
      with: {
        profile: true,
      },
      orderBy: (accounts, { desc }) => [desc(accounts.createdAt)],
    });

    res.json(allAccounts);
  } catch (error) {
    logger.error('[API] Error fetching players:', error);
    res.status(500).json({
      error: 'Failed to fetch players',
      code: 'FETCH_FAILED',
    });
  }
});

/**
 * GET /api/players/:id
 * Get player details with settlements
 */
router.get('/:id', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const account = await db.query.accounts.findFirst({
      where: eq(accounts.id, id),
      with: {
        profile: {
          with: {
            settlements: {
              with: {
                plot: {
                  with: {
                    tile: {
                      with: {
                        region: {
                          with: {
                            world: true,
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!account) {
      return res.status(404).json({
        error: 'Player not found',
        code: 'NOT_FOUND',
      });
    }

    res.json(account);
  } catch (error) {
    logger.error('[API] Error fetching player:', error);
    res.status(500).json({
      error: 'Failed to fetch player',
      code: 'FETCH_FAILED',
    });
  }
});

/**
 * PUT /api/players/:id
 * Update player role (admin only)
 */
router.put('/:id', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    // Check if account exists
    const existing = await db.query.accounts.findFirst({
      where: eq(accounts.id, id),
    });

    if (!existing) {
      return res.status(404).json({
        error: 'Player not found',
        code: 'NOT_FOUND',
      });
    }

    // Validate role
    if (role && !['MEMBER', 'SUPPORT', 'ADMINISTRATOR'].includes(role)) {
      return res.status(400).json({
        error: 'Invalid role. Must be MEMBER, SUPPORT, or ADMINISTRATOR',
        code: 'INVALID_INPUT',
      });
    }

    // Update account
    const [updated] = await db
      .update(accounts)
      .set({
        role: role || existing.role,
        updatedAt: new Date(),
      })
      .where(eq(accounts.id, id))
      .returning();

    logger.info(`[API] Updated player role: ${id} -> ${role}`);
    res.json(updated);
  } catch (error) {
    logger.error('[API] Error updating player:', error);
    res.status(500).json({
      error: 'Failed to update player',
      code: 'UPDATE_FAILED',
    });
  }
});

/**
 * DELETE /api/players/:id
 * Delete player account (admin only, cascade deletes profile and settlements)
 */
router.delete('/:id', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if account exists
    const existing = await db.query.accounts.findFirst({
      where: eq(accounts.id, id),
      with: {
        profile: true,
      },
    });

    if (!existing) {
      return res.status(404).json({
        error: 'Player not found',
        code: 'NOT_FOUND',
      });
    }

    // Delete account (cascade will handle profile and settlements)
    await db.delete(accounts).where(eq(accounts.id, id));

    logger.info(`[API] Deleted player: ${id} - ${existing.email}`);
    res.json({
      success: true,
      message: `Player "${existing.profile?.username || existing.email}" deleted successfully`,
    });
  } catch (error) {
    logger.error('[API] Error deleting player:', error);
    res.status(500).json({
      error: 'Failed to delete player',
      code: 'DELETE_FAILED',
    });
  }
});

export default router;
