# Game Loop Refactor - Manual Patch

> **Created**: December 9, 2025  
> **Purpose**: Complete the `processSettlementWorldBased` function implementation  
> **Status**: Due to IDE resource constraints, manual application recommended

---

## Problem

The `game-loop.ts` file currently has:

- Incomplete `processSettlementWorldBased` function (lines 335-412)
- Duplicate old code with `settlement.` references (lines 413+)
- Missing try/catch closure causing compile errors

## Solution

Replace lines **335-679** (entire old `processSettlement` function) with the complete `processSettlementWorldBased` implementation below.

---

## Complete New Function

```typescript
/**
 * Process a settlement in the world-based system (Refactored December 2025)
 * 
 * This function replaces the old processSettlement and adapts it for timing-based processing:
 * - Queries settlement data directly (no activeSettlements Map)
 * - Emits real-time projections OR actual updates based on timing flags
 * - Writes to database only on actual production/population ticks
 * - Checks room occupancy before Socket.IO emission
 * 
 * @param settlementId - Settlement to process
 * @param worldId - World the settlement belongs to
 * @param io - Socket.IO server instance
 * @param timing - Timing flags for this tick
 */
async function processSettlementWorldBased(
  settlementId: string,
  worldId: string,
  io: SocketIOServer,
  timing: {
    isResourceProductionTime: boolean;
    isPopulationUpdateTime: boolean;
    shouldEmitProjection: boolean;
    currentTime: number;
    secondsSinceEpoch: number;
  }
): Promise<void> {
  try {
    // Check if anyone is in the world room before processing
    const roomSize = io.sockets.adapter.rooms.get(`world:${worldId}`)?.size || 0;
    
    // If no clients in room and not a production tick, skip emission
    // (Still process production ticks to update database even if no one is watching)
    if (roomSize === 0 && !timing.isResourceProductionTime && !timing.isPopulationUpdateTime) {
      return; // Skip projection emission for empty rooms
    }

    // Fetch settlement details
    const settlementData = await getSettlementWithDetails(settlementId);

    if (!settlementData?.settlement || !settlementData.storage || !settlementData.tile) {
      logger.warn('[GAME LOOP] Settlement data incomplete, skipping', {
        settlementId,
      });
      return;
    }

    const { storage, tile, biome, world } = settlementData;
    const worldTemplateType = world?.worldTemplateType || 'STANDARD';

    // Get template config and extract multipliers
    const templateConfig = getWorldTemplateConfig(worldTemplateType as WorldTemplateType);
    const consumptionMultiplier = templateConfig.consumptionMultiplier;
    const productionMultiplier = templateConfig.productionMultiplier;

    // Fetch settlement structures
    const structureData = await getSettlementStructures(settlementId);

    // Transform structure data into format expected by calculators
    const structures: Structure[] = structureData
      .map((row) => ({
        name: row.structureDef?.name || 'Unknown',
        modifiers: structureData
          .filter((r) => r.structure.id === row.structure.id && r.modifiers)
          .map((r) => ({
            name: r.modifiers!.name,
            value: r.modifiers!.value,
          })),
      }))
      .filter(
        (struct, index, self) =>
          // Remove duplicates (each structure appears once per modifier)
          index === self.findIndex((s) => s.name === struct.name)
      );

    // Filter extractors on this specific tile
    const extractors = structureData
      .filter(
        (row) => row.structure.tileId === tile.id && row.structureDef?.category === 'EXTRACTOR'
      )
      .map((row) => ({
        ...row.structure,
        category: row.structureDef?.category,
        extractorType: row.structureDef?.extractorType,
        buildingType: row.structureDef?.buildingType,
      }));

    // ==================================================================
    // RESOURCE PRODUCTION (On production tick OR projection)
    // ==================================================================
    
    // Get settlement population
    const populationData = await getSettlementPopulation(settlementId);
    const totalPopulation = populationData?.currentPopulation || 0;

    // Map all settlement structures to StructureWithType format for assignment
    const allStructuresForAssignment: StructureWithType[] = structureData.map((row) => ({
      ...row.structure,
      category: (row.structureDef?.category as 'EXTRACTOR' | 'BUILDING') || 'BUILDING',
    }));

    // Run auto-assignment algorithm (only on production ticks, not projections)
    if (timing.isResourceProductionTime) {
      const assignmentResult = autoAssignPopulation(totalPopulation, allStructuresForAssignment);

      // Update database with new assignments
      for (const [structureId, assigned] of assignmentResult.assignments) {
        await db
          .update(settlementStructures)
          .set({ populationAssigned: assigned })
          .where(eq(settlementStructures.id, structureId));
      }

      // Log assignment statistics
      if (assignmentResult.totalAssigned > 0 || assignmentResult.understaffedStructures.length > 0) {
        logger.debug('[GAME LOOP] Population assignment', {
          settlementId,
          totalPopulation,
          assigned: assignmentResult.totalAssigned,
          remaining: assignmentResult.remainingPopulation,
        });
      }
    }

    // Calculate staffing bonuses for production
    const staffingBonuses = calculateAllStaffingBonuses(allStructuresForAssignment);

    // Calculate production for this interval
    // For projections: calculate fractional production (time since last hour)
    // For production ticks: calculate full hour's production
    const secondsSinceLastProduction = timing.isResourceProductionTime
      ? RESOURCE_INTERVAL_SEC // Full interval
      : timing.secondsSinceEpoch % RESOURCE_INTERVAL_SEC; // Partial interval

    const ticksForThisInterval = Math.floor((secondsSinceLastProduction / 60) * TICK_RATE);

    // Calculate base production
    const baseProduction = calculateProduction(
      tile,
      extractors,
      ticksForThisInterval,
      biome?.name,
      productionMultiplier
    );

    // Query active disasters affecting this world
    const activeDisasters = await db.query.disasterEvents.findMany({
      where: and(
        eq(disasterEvents.worldId, world?.id || ''),
        or(eq(disasterEvents.status, 'IMPACT'), eq(disasterEvents.status, 'AFTERMATH'))
      ),
    });

    // Calculate disaster production modifiers
    const disasterModifiers = calculateAllDisasterModifiers(
      activeDisasters.map((d) => ({
        type: d.type,
        status: d.status,
        impactEndedAt: d.impactEndedAt ?? undefined,
      })),
      { settlementId, playerId: world?.id || '', worldId, lastUpdateTick: 0 },
      timing.currentTime
    );

    // Apply disaster penalties to base production
    let production = {
      food: baseProduction.food * disasterModifiers.resourceModifiers.food,
      water: baseProduction.water * disasterModifiers.resourceModifiers.water,
      wood: baseProduction.wood * disasterModifiers.resourceModifiers.wood,
      stone: baseProduction.stone * disasterModifiers.resourceModifiers.stone,
      ore: baseProduction.ore * disasterModifiers.resourceModifiers.ore,
    };

    // Apply staffing bonuses
    for (const extractor of extractors) {
      const bonus = staffingBonuses.get(extractor.id) || 1;
      const extractorType = extractor.extractorType;

      if (extractorType === 'FARM') production.food *= bonus;
      else if (extractorType === 'WELL') production.water *= bonus;
      else if (extractorType === 'LUMBER_MILL') production.wood *= bonus;
      else if (extractorType === 'QUARRY') production.stone *= bonus;
      else if (extractorType === 'MINE') production.ore *= bonus;
    }

    // Calculate consumption for this interval
    const population = calculatePopulation(structures);
    const structureCount = structures.length;
    const consumption = calculateConsumption(
      population,
      structureCount,
      ticksForThisInterval,
      consumptionMultiplier
    );

    // Calculate net resource changes
    const netProduction = subtractResources(production, consumption);

    // Get current resources
    const currentResources = {
      food: storage.food,
      water: storage.water,
      wood: storage.wood,
      stone: storage.stone,
      ore: storage.ore,
    };

    // Calculate storage capacity
    const capacity = calculateStorageCapacity(structures);

    // ==================================================================
    // DATABASE WRITE (On production tick only, NOT on projections)
    // ==================================================================
    if (timing.isResourceProductionTime) {
      // Add net production to current resources
      const proposedResources = addResources(currentResources, netProduction);

      // Calculate waste (resources exceeding capacity)
      const waste = calculateWaste(currentResources, netProduction, capacity);

      // Clamp resources to capacity
      const finalResources = clampToCapacity(proposedResources, capacity);

      // Update storage in database
      await updateSettlementStorage(storage.id, finalResources);

      // Broadcast resource update to world
      const resourceUpdatePayload = {
        type: 'auto-production',
        settlementId,
        resources: finalResources,
        production,
        consumption,
        netProduction,
        population,
        timestamp: timing.currentTime,
      };

      if (roomSize > 0) {
        io.to(`world:${worldId}`).emit('resource-update', resourceUpdatePayload);
      }

      // Broadcast waste event if any resources were wasted
      if (waste.food > 0 || waste.water > 0 || waste.wood > 0 || waste.stone > 0 || waste.ore > 0) {
        if (roomSize > 0) {
          io.to(`world:${worldId}`).emit('resource-waste', {
            settlementId,
            waste,
            capacity,
            timestamp: timing.currentTime,
          });
        }

        logger.debug('[GAME LOOP] Resources wasted due to capacity', {
          settlementId,
          waste,
        });
      }

      // Check storage capacity warnings (>90% full)
      const nearCapacity = isNearCapacity(finalResources, capacity);
      const hasWarnings = Object.values(nearCapacity).some(Boolean);

      if (hasWarnings && roomSize > 0) {
        io.to(`world:${worldId}`).emit('storage-warning', {
          settlementId,
          nearCapacity,
          resources: finalResources,
          capacity,
          timestamp: timing.currentTime,
        });
      }

      // Check if settlement has enough resources for population (1 hour buffer)
      const hasResources = hasResourcesForPopulation(population, structureCount, finalResources);

      if (!hasResources && population > 0 && roomSize > 0) {
        io.to(`world:${worldId}`).emit('resource-shortage', {
          settlementId,
          population,
          resources: finalResources,
          timestamp: timing.currentTime,
        });

        logger.warn('[GAME LOOP] Settlement has insufficient resources', {
          settlementId,
          population,
          resources: finalResources,
        });
      }

      logger.debug('[GAME LOOP] Settlement resources updated', {
        settlementId,
        production,
        consumption,
        netProduction,
        population,
        finalResources,
      });
    }

    // ==================================================================
    // REAL-TIME PROJECTION (On projection ticks, NOT on production)
    // ==================================================================
    else if (timing.shouldEmitProjection && roomSize > 0) {
      // Calculate projected resources (current + partial production)
      const projectedResources = addResources(currentResources, netProduction);
      const finalProjected = clampToCapacity(projectedResources, capacity);

      // Emit projection event
      io.to(`world:${worldId}`).emit('resource-preview', {
        settlementId,
        resources: finalProjected,
        production,
        consumption,
        netProduction,
        population,
        secondsUntilNextProduction: RESOURCE_INTERVAL_SEC - secondsSinceLastProduction,
        timestamp: timing.currentTime,
      });
    }

    // ==================================================================
    // POPULATION UPDATE (On population tick only)
    // ==================================================================
    if (timing.isPopulationUpdateTime) {
      await processPopulation(
        settlementId,
        worldId,
        structures,
        currentResources,
        io
      );
    }

  } catch (error) {
    logger.error('[GAME LOOP] Error processing settlement:', error, {
      settlementId,
    });
  }
}
```

---

## How to Apply This Patch

### Option 1: Manual Replacement (Recommended)

1. Open `server/src/game/game-loop.ts` in your IDE
2. Find line 335 (starts with `async function processSettlementWorldBased`)
3. Find line 679 (the closing `}` of the old function, just before `async function processPopulation`)
4. Select everything from line 335 to line 679
5. Delete the selected code
6. Paste the complete new function from above
7. Save the file
8. The compile errors should be reduced significantly

### Option 2: Git Patch (Alternative)

If you prefer, you can:

1. Copy the new function code above
2. Save it to a temporary file
3. Use your IDE's "Replace in File" feature:
   - Search for: The old function signature and first few lines
   - Replace with: The new function

---

## What This Fixes

✅ **Removes**:

- All references to `settlement.settlementId` (use `settlementId` parameter)
- All references to `settlement.worldId` (use `worldId` parameter)
- All references to `settlement.lastUpdateTick` (no longer needed)
- activeSettlements.delete() call (Map no longer exists)

✅ **Adds**:

- Room occupancy check (don't emit to empty rooms)
- Timing-based behavior (production vs projection)
- Real-time projection emission (`resource-preview` event)
- Proper database write gating (only on production ticks)
- Population update integration (on half-hour offset)
- `RESOURCE_INTERVAL_SEC` constant usage

✅ **Preserves**:

- All existing game logic (production, consumption, disasters, population)
- Structure assignment system
- Staffing bonuses
- Waste tracking
- Warning emissions
- Error handling

---

## Expected Results After Applying

**Compile errors reduced from 30+ to ~7**:

- ✅ Line 303 error resolved (processSettlementWorldBased now implemented)
- ✅ All `settlement.` reference errors resolved (30+ errors)
- ❌ Still remaining: 4 registration functions with activeSettlements (7 errors) - to be removed next

**New functionality enabled**:

- ✅ Hourly resource production (configurable with RESOURCE_INTERVAL_SEC)
- ✅ Real-time projection every 1 second (configurable with SOCKET_EMIT_INTERVAL_SEC)
- ✅ Half-hour population updates (configurable with POPULATION_INTERVAL_SEC)
- ✅ Room-based emission (only emit to occupied rooms)
- ✅ Projection vs production separation (no DB writes for projections)

---

## Next Steps After This Patch

1. **Test Compilation**: `npm run check` should show only ~7 errors (registration functions)
2. **Remove Registration Functions**: Delete registerSettlement, unregisterSettlement, registerPlayerSettlements, unregisterPlayerSettlements (lines ~750-920)
3. **Update handlers.ts**: Remove calls to registration functions
4. **Add Environment Variables**: Update `.env.example` with the 3 new constants
5. **Test with Dev Intervals**: Start server with `RESOURCE_INTERVAL_SEC=5` and verify production every 5 seconds
6. **UI Countdown Timer**: Add to ResourcePanel.svelte

---

**Created**: December 9, 2025  
**File**: c:\code\uncharted-lands\server\src\game\game-loop.ts  
**Lines to Replace**: 335-679  
**Estimated Time**: 2-3 minutes manual application
