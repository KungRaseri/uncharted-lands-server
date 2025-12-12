# Phase 4: Database Migration & Settlement Modifier Aggregation

> **Status**: 🚧 In Progress  
> **Start Date**: December 11, 2025  
> **Estimated Duration**: 2-4 hours  
> **Dependencies**: Phase 3 Complete ✅

---

## Overview

**Goal**: Add database-level tracking of settlement modifiers and implement aggregation system to efficiently calculate total modifiers for each settlement.

**Why This Matters**:
- **Performance**: Pre-calculate modifiers instead of computing on every request
- **Analytics**: Track modifier changes over time
- **UI Display**: Show settlement-wide bonuses in one place
- **Validation**: Ensure modifiers are correctly applied to game mechanics

---

## Architecture Design

### Database Schema

```sql
-- New table: settlement_modifiers
CREATE TABLE settlement_modifiers (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  settlement_id TEXT NOT NULL REFERENCES settlements(id) ON DELETE CASCADE,
  modifier_type TEXT NOT NULL,
  total_value DECIMAL(10, 2) NOT NULL,
  source_count INTEGER NOT NULL DEFAULT 0,
  contributing_structures JSONB DEFAULT '[]',
  last_calculated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  
  -- Ensure one row per settlement per modifier type
  UNIQUE(settlement_id, modifier_type)
);

-- Indexes for performance
CREATE INDEX idx_settlement_modifiers_settlement 
  ON settlement_modifiers(settlement_id);

CREATE INDEX idx_settlement_modifiers_type 
  ON settlement_modifiers(modifier_type);

CREATE INDEX idx_settlement_modifiers_updated 
  ON settlement_modifiers(last_calculated_at);
```

**Rationale**:
- `settlement_id`: Foreign key to settlements table
- `modifier_type`: e.g., 'FOOD_PRODUCTION', 'HAPPINESS', 'DEFENSE'
- `total_value`: Sum of all modifiers of this type from all structures
- `source_count`: Number of structures contributing to this modifier
- `contributing_structures`: JSONB array of `{structureId, structureName, level, value}`
- `last_calculated_at`: When aggregation last ran (for cache invalidation)
- `UNIQUE(settlement_id, modifier_type)`: One row per type per settlement

---

## Implementation Tasks

### Task 4.1: Create Drizzle Schema ✅ **NEXT**

**File**: `server/src/db/schema.ts`

**Add New Table**:
```typescript
import { pgTable, text, decimal, integer, timestamp, unique, jsonb } from 'drizzle-orm/pg-core';
import { settlements } from './schema';

export const settlementModifiers = pgTable(
  'settlement_modifiers',
  {
    id: text('id').primaryKey().$default(() => crypto.randomUUID()),
    settlementId: text('settlement_id')
      .notNull()
      .references(() => settlements.id, { onDelete: 'cascade' }),
    modifierType: text('modifier_type').notNull(),
    totalValue: decimal('total_value', { precision: 10, scale: 2 }).notNull(),
    sourceCount: integer('source_count').notNull().default(0),
    contributingStructures: jsonb('contributing_structures').$type<ContributingStructure[]>().default([]),
    lastCalculatedAt: timestamp('last_calculated_at').notNull().defaultNow(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    unq: unique().on(table.settlementId, table.modifierType),
  })
);

export interface ContributingStructure {
  structureId: string;
  structureName: string;
  level: number;
  value: number;
}

export type SettlementModifier = typeof settlementModifiers.$inferSelect;
export type NewSettlementModifier = typeof settlementModifiers.$inferInsert;
```

**Verify**: TypeScript compilation should succeed

---

### Task 4.2: Generate Migration

**Command**:
```bash
cd server
npm run db:generate
```

**Expected Output**: `drizzle/XXXX_add_settlement_modifiers.sql`

**Verify Migration**:
```sql
-- Should contain:
-- 1. CREATE TABLE settlement_modifiers
-- 2. CREATE INDEX idx_settlement_modifiers_settlement
-- 3. CREATE INDEX idx_settlement_modifiers_type
-- 4. CREATE INDEX idx_settlement_modifiers_updated
-- 5. ALTER TABLE for foreign key (if not inline)
```

---

### Task 4.3: Create Aggregation Service

**File**: `server/src/game/settlement-modifier-aggregator.ts`

**Purpose**: Calculate and persist settlement-wide modifiers

```typescript
import { db } from '../db';
import { settlementModifiers, settlementStructures } from '../db/schema';
import { calculateStructureModifiers, type StructureModifier } from './modifier-calculator';
import { eq, and } from 'drizzle-orm';
import type { ContributingStructure } from '../db/schema';

/**
 * Aggregates all modifiers for a settlement and updates the database
 * 
 * @param settlementId - Settlement to aggregate modifiers for
 * @returns Array of aggregated modifiers
 * 
 * @example
 * const modifiers = await aggregateSettlementModifiers('settlement-123');
 * // Returns: [{ type: 'FOOD_PRODUCTION', totalValue: 150, sourceCount: 3, ... }]
 */
export async function aggregateSettlementModifiers(
  settlementId: string
): Promise<SettlementModifier[]> {
  // 1. Get all structures in the settlement
  const structures = await db
    .select({
      id: settlementStructures.id,
      structureId: settlementStructures.structureId,
      level: settlementStructures.level,
    })
    .from(settlementStructures)
    .where(eq(settlementStructures.settlementId, settlementId));

  // 2. Calculate modifiers for each structure
  const allModifiers: Array<StructureModifier & { structureDbId: string }> = [];
  
  for (const structure of structures) {
    const modifiers = calculateStructureModifiers(structure.structureId, structure.level);
    for (const modifier of modifiers) {
      allModifiers.push({
        ...modifier,
        structureDbId: structure.id,
      });
    }
  }

  // 3. Group by modifier type and sum values
  const aggregated = new Map<string, {
    totalValue: number;
    sourceCount: number;
    contributing: ContributingStructure[];
  }>();

  for (const modifier of allModifiers) {
    const existing = aggregated.get(modifier.type) || {
      totalValue: 0,
      sourceCount: 0,
      contributing: [],
    };

    existing.totalValue += modifier.value;
    existing.sourceCount += 1;
    existing.contributing.push({
      structureId: modifier.structureDbId,
      structureName: modifier.structureName,
      level: modifier.level,
      value: modifier.value,
    });

    aggregated.set(modifier.type, existing);
  }

  // 4. Update database (upsert)
  const results: SettlementModifier[] = [];
  
  for (const [modifierType, data] of aggregated) {
    const [result] = await db
      .insert(settlementModifiers)
      .values({
        settlementId,
        modifierType,
        totalValue: data.totalValue.toFixed(2),
        sourceCount: data.sourceCount,
        contributingStructures: data.contributing,
        lastCalculatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [settlementModifiers.settlementId, settlementModifiers.modifierType],
        set: {
          totalValue: data.totalValue.toFixed(2),
          sourceCount: data.sourceCount,
          contributingStructures: data.contributing,
          lastCalculatedAt: new Date(),
          updatedAt: new Date(),
        },
      })
      .returning();
    
    results.push(result);
  }

  return results;
}

/**
 * Get current aggregated modifiers for a settlement
 * 
 * @param settlementId - Settlement ID
 * @returns Array of modifiers with type, total value, and contributing structures
 */
export async function getSettlementModifiers(
  settlementId: string
): Promise<SettlementModifier[]> {
  return await db
    .select()
    .from(settlementModifiers)
    .where(eq(settlementModifiers.settlementId, settlementId));
}

/**
 * Recalculate modifiers for all settlements (admin/maintenance function)
 * 
 * @returns Number of settlements processed
 */
export async function recalculateAllSettlementModifiers(): Promise<number> {
  const { settlements } = await import('../db/schema');
  
  const allSettlements = await db
    .select({ id: settlements.id })
    .from(settlements);

  let count = 0;
  for (const settlement of allSettlements) {
    await aggregateSettlementModifiers(settlement.id);
    count++;
  }

  return count;
}
```

---

### Task 4.4: Update API Endpoints

**File**: `server/src/api/routes/settlements.ts`

**Add New Endpoint**:
```typescript
// GET /api/settlements/:id/modifiers
app.get('/api/settlements/:id/modifiers', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Verify settlement exists and user has access
    const settlement = await db.query.settlements.findFirst({
      where: eq(settlements.id, id),
    });

    if (!settlement) {
      return res.status(404).json({ error: 'Settlement not found' });
    }

    // Get aggregated modifiers
    const modifiers = await getSettlementModifiers(id);

    return res.json({
      settlementId: id,
      modifiers,
      lastUpdated: modifiers[0]?.lastCalculatedAt || null,
    });
  } catch (error) {
    logger.error('Failed to get settlement modifiers', { error });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/settlements/:id/modifiers/recalculate
app.post('/api/settlements/:id/modifiers/recalculate', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Verify settlement exists
    const settlement = await db.query.settlements.findFirst({
      where: eq(settlements.id, id),
    });

    if (!settlement) {
      return res.status(404).json({ error: 'Settlement not found' });
    }

    // Recalculate modifiers
    const modifiers = await aggregateSettlementModifiers(id);

    return res.json({
      success: true,
      settlementId: id,
      modifiersCalculated: modifiers.length,
      modifiers,
    });
  } catch (error) {
    logger.error('Failed to recalculate settlement modifiers', { error });
    return res.status(500).json({ error: 'Internal server error' });
  }
});
```

---

### Task 4.5: Update Structure Lifecycle Hooks

**File**: `server/src/api/routes/structures.ts`

**Trigger Aggregation on Structure Changes**:

```typescript
// After structure creation
app.post('/api/structures/create', async (req: Request, res: Response) => {
  // ... existing creation logic ...
  
  // NEW: Recalculate settlement modifiers
  await aggregateSettlementModifiers(structure.settlementId);
  
  // ... existing response ...
});

// After structure upgrade
app.post('/api/structures/:id/upgrade', async (req: Request, res: Response) => {
  // ... existing upgrade logic ...
  
  // NEW: Recalculate settlement modifiers
  await aggregateSettlementModifiers(structure.settlementId);
  
  // ... existing response ...
});

// After structure deletion
app.delete('/api/structures/:id', async (req: Request, res: Response) => {
  // ... existing deletion logic ...
  
  // NEW: Recalculate settlement modifiers
  await aggregateSettlementModifiers(settlementId);
  
  // ... existing response ...
});
```

---

### Task 4.6: Update Seed Script

**File**: `server/src/db/seed.ts`

**Add Settlement Modifiers After Structures**:

```typescript
// After creating structures
console.log('Creating structures...');
await createStructures(newServer.id);

// NEW: Calculate initial modifiers
console.log('Calculating settlement modifiers...');
const settlements = await db
  .select({ id: settlementSchema.id })
  .from(settlementSchema)
  .where(eq(settlementSchema.serverId, newServer.id));

for (const settlement of settlements) {
  await aggregateSettlementModifiers(settlement.id);
}

console.log(`✓ Calculated modifiers for ${settlements.length} settlements`);
```

---

### Task 4.7: Write Integration Tests

**File**: `server/tests/integration/settlement-modifiers.test.ts`

**Tests to Cover**:
1. ✅ Aggregation calculates correct totals
2. ✅ Contributing structures tracked
3. ✅ Upsert works (update existing records)
4. ✅ Recalculation after structure creation
5. ✅ Recalculation after structure upgrade
6. ✅ Recalculation after structure deletion
7. ✅ GET endpoint returns correct data
8. ✅ POST recalculate endpoint works

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../../src/db';
import { 
  aggregateSettlementModifiers, 
  getSettlementModifiers 
} from '../../src/game/settlement-modifier-aggregator';
import { createTestSettlement, createTestStructure } from '../helpers/test-factory';

describe('Settlement Modifier Aggregation', () => {
  let settlementId: string;

  beforeEach(async () => {
    // Create test settlement with structures
    settlementId = await createTestSettlement({
      structures: [
        { structureId: 'Farm', level: 1 },
        { structureId: 'Farm', level: 5 },
        { structureId: 'Workshop', level: 3 },
      ],
    });
  });

  it('should aggregate modifiers correctly', async () => {
    const modifiers = await aggregateSettlementModifiers(settlementId);
    
    // Farm provides FOOD_PRODUCTION: 10 (L1) + 50 (L5) = 60
    const foodMod = modifiers.find(m => m.modifierType === 'FOOD_PRODUCTION');
    expect(foodMod).toBeDefined();
    expect(parseFloat(foodMod!.totalValue)).toBe(60);
    expect(foodMod!.sourceCount).toBe(2);
    
    // Workshop provides UPGRADE_SPEED: exponential scaling
    const upgradeMod = modifiers.find(m => m.modifierType === 'UPGRADE_SPEED');
    expect(upgradeMod).toBeDefined();
    expect(parseFloat(upgradeMod!.totalValue)).toBeCloseTo(11.25, 1);
    expect(upgradeMod!.sourceCount).toBe(1);
  });

  it('should track contributing structures', async () => {
    const modifiers = await aggregateSettlementModifiers(settlementId);
    const foodMod = modifiers.find(m => m.modifierType === 'FOOD_PRODUCTION');
    
    expect(foodMod!.contributingStructures).toHaveLength(2);
    expect(foodMod!.contributingStructures[0]).toMatchObject({
      structureName: 'Farm',
      level: 1,
      value: 10,
    });
  });

  it('should upsert on recalculation', async () => {
    // First aggregation
    await aggregateSettlementModifiers(settlementId);
    
    // Add new structure
    await createTestStructure(settlementId, { structureId: 'Farm', level: 1 });
    
    // Recalculate
    const modifiers = await aggregateSettlementModifiers(settlementId);
    const foodMod = modifiers.find(m => m.modifierType === 'FOOD_PRODUCTION');
    
    // Should now be 60 + 10 = 70
    expect(parseFloat(foodMod!.totalValue)).toBe(70);
    expect(foodMod!.sourceCount).toBe(3);
  });

  it('should retrieve modifiers via API', async () => {
    await aggregateSettlementModifiers(settlementId);
    const modifiers = await getSettlementModifiers(settlementId);
    
    expect(modifiers.length).toBeGreaterThan(0);
    expect(modifiers[0]).toHaveProperty('settlementId', settlementId);
    expect(modifiers[0]).toHaveProperty('modifierType');
    expect(modifiers[0]).toHaveProperty('totalValue');
  });
});
```

---

### Task 4.8: Run Migration

**Commands**:
```bash
# Apply migration to development database
cd server
npm run db:migrate

# Verify with Drizzle Studio
npm run db:studio
# Check: settlement_modifiers table exists with correct schema
```

**Rollback Plan** (if needed):
```bash
# Drizzle doesn't have built-in rollback, so manual SQL:
psql -d your_database -c "DROP TABLE IF EXISTS settlement_modifiers CASCADE;"
```

---

## Testing Checklist

### Unit Tests ✅
- [ ] aggregateSettlementModifiers() calculates correctly
- [ ] getSettlementModifiers() retrieves correctly
- [ ] recalculateAllSettlementModifiers() processes all

### Integration Tests ✅
- [ ] Database table created successfully
- [ ] Upsert logic works (no duplicate rows)
- [ ] Foreign key cascade works (delete settlement → delete modifiers)
- [ ] Indexes improve query performance

### API Tests ✅
- [ ] GET /api/settlements/:id/modifiers returns 200
- [ ] POST /api/settlements/:id/modifiers/recalculate returns 200
- [ ] Returns 404 for non-existent settlements
- [ ] Handles database errors gracefully

### E2E Tests (Phase 5)
- [ ] Structure creation triggers recalculation
- [ ] Structure upgrade triggers recalculation
- [ ] UI displays aggregated modifiers correctly

---

## Performance Considerations

### Query Optimization
- **Indexes**: settlement_id, modifier_type, last_calculated_at
- **Batch Recalculation**: Use transactions for multiple settlements
- **Caching**: Consider Redis for frequently accessed modifiers

### Scalability
- **Async Processing**: Recalculation can be queued (not blocking)
- **Debouncing**: Don't recalculate on every tiny change
- **Partial Updates**: Only recalculate affected modifier types

---

## Documentation Updates

### Files to Update After Completion
- [ ] `server/README.md` - Add aggregation service docs
- [ ] `client/docs/game-design/GDD-Implementation-Tracker.md` - Mark Phase 4 complete
- [ ] `server/PHASE-4-COMPLETE.md` - Create completion report
- [ ] API documentation (if using Swagger/OpenAPI)

---

## Success Criteria

Phase 4 is complete when:
- ✅ settlement_modifiers table created and migrated
- ✅ Aggregation service implemented and tested
- ✅ API endpoints working
- ✅ Structure lifecycle hooks trigger recalculation
- ✅ Seed script populates initial modifiers
- ✅ All integration tests passing (target: 100%)
- ✅ Documentation updated

---

## Time Estimates

| Task | Estimated Time | Actual Time |
|------|---------------|-------------|
| 4.1: Drizzle Schema | 15 min | - |
| 4.2: Generate Migration | 5 min | - |
| 4.3: Aggregation Service | 45 min | - |
| 4.4: API Endpoints | 20 min | - |
| 4.5: Structure Hooks | 15 min | - |
| 4.6: Seed Script | 10 min | - |
| 4.7: Integration Tests | 60 min | - |
| 4.8: Migration & Verification | 15 min | - |
| **TOTAL** | **2h 45min** | - |

---

## Next: Phase 5

After Phase 4 completion:
- Client-side UI to display aggregated modifiers
- Real-time updates when structures change
- Prerequisite validation UI
- Performance optimization

---

**Status**: Ready to begin Task 4.1 (Drizzle Schema)  
**Last Updated**: December 11, 2025
