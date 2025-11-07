/**
 * Admin Dashboard API Routes
 * 
 * Statistics and overview data for admin panel
 */

import { Router } from 'express';
import { sql } from 'drizzle-orm';
import { db, servers, worlds, accounts, settlements } from '../../db/index';
import { authenticateAdmin } from '../middleware/auth';
import { logger } from '../../utils/logger';

const router = Router();

/**
 * GET /api/admin/dashboard
 * Get dashboard statistics
 */
router.get('/dashboard', authenticateAdmin, async (req, res) => {
  try {
    // Count all entities
    const [serverCount] = await db.select({ count: sql<number>`count(*)` }).from(servers);
    const [worldCount] = await db.select({ count: sql<number>`count(*)` }).from(worlds);
    const [accountCount] = await db.select({ count: sql<number>`count(*)` }).from(accounts);
    const [settlementCount] = await db.select({ count: sql<number>`count(*)` }).from(settlements);

    // Get recent servers
    const recentServers = await db.query.servers.findMany({
      limit: 5,
      orderBy: (servers, { desc }) => [desc(servers.createdAt)],
      with: {
        worlds: {
          columns: {
            id: true,
            name: true
          }
        }
      }
    });

    // Get recent worlds
    const recentWorlds = await db.query.worlds.findMany({
      limit: 5,
      orderBy: (worlds, { desc }) => [desc(worlds.createdAt)],
      with: {
        server: {
          columns: {
            id: true,
            name: true
          }
        }
      }
    });

    // Get recent players
    const recentPlayers = await db.query.accounts.findMany({
      limit: 5,
      orderBy: (accounts, { desc }) => [desc(accounts.createdAt)],
      with: {
        profile: {
          columns: {
            id: true,
            username: true,
            picture: true
          }
        }
      }
    });

    const stats = {
      counts: {
        servers: Number(serverCount.count),
        worlds: Number(worldCount.count),
        players: Number(accountCount.count),
        settlements: Number(settlementCount.count)
      },
      recent: {
        servers: recentServers,
        worlds: recentWorlds,
        players: recentPlayers
      },
      timestamp: new Date().toISOString()
    };

    res.json(stats);
  } catch (error) {
    logger.error('[API] Error fetching dashboard stats:', error);
    res.status(500).json({ 
      error: 'Failed to fetch dashboard statistics', 
      code: 'FETCH_FAILED' 
    });
  }
});

export default router;
