import { Router } from 'express';
import { db } from '../../db/index.js';
import { settlements } from '../../db/schema.js';
import { eq } from 'drizzle-orm';

const router = Router();

/**
 * GET /api/settlements
 * Get all settlements (with optional player filter)
 */
router.get('/', async (req, res) => {
  try {
    const { playerProfileId } = req.query;

    // Build the query
    const result = await db.query.settlements.findMany({
      where: playerProfileId ? eq(settlements.playerProfileId, playerProfileId as string) : undefined,
      with: {
        plot: {
          with: {
            tile: {
              with: {
                biome: true
              }
            }
          }
        },
        structures: true,
        storage: true
      }
    });

    res.json(result);
  } catch (error) {
    console.error('Error fetching settlements:', error);
    res.status(500).json({ error: 'Failed to fetch settlements' });
  }
});

/**
 * GET /api/settlements/:id
 * Get a specific settlement by ID
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const settlement = await db.query.settlements.findFirst({
      where: eq(settlements.id, id),
      with: {
        plot: {
          with: {
            tile: {
              with: {
                biome: true,
                region: true
              }
            }
          }
        },
        structures: true,
        storage: true
      }
    });

    if (!settlement) {
      return res.status(404).json({ error: 'Settlement not found' });
    }

    res.json(settlement);
  } catch (error) {
    console.error('Error fetching settlement:', error);
    res.status(500).json({ error: 'Failed to fetch settlement' });
  }
});

export default router;
