/**
 * BLOCKER 2 Validation Tests
 * 
 * Tests for production system requiring extractor structures.
 * Validates that resources are only produced when extractors exist on plots.
 * 
 * Test Scenarios (from AUDIT-GDD-vs-Implementation.md):
 * 1. No extractors → Zero production
 * 2. FARM level 1 → Correct food production
 * 3. FARM level 2 → 20% more production (level multiplier)
 * 4a. FARM in FOREST → 80% food (biome efficiency)
 * 4b. LUMBER_MILL in FOREST → 200% wood (biome efficiency)
 * 5. Multiple extractors on same plot → Production sums correctly
 */

import { describe, test, expect } from 'vitest';
import {
	calculateProduction,
	isExtractor,
	getAverageLevel,
	getMaxLevel,
	getExtractorsByResource,
	type StructureWithInfo
} from '../../../src/game/resource-calculator';
import type { Plot } from '../../../src/db/schema';

// ===== TEST DATA SETUP =====

/**
 * Creates a mock plot with specified resource values
 */
function createMockPlot(overrides: Partial<Plot> = {}): Plot {
	return {
		id: 'plot-1',
		tileId: 'tile-1',
		settlementId: 'settlement-1',
		qualityMultiplier: 1,
		food: 10,
		water: 10,
		wood: 10,
		stone: 10,
		ore: 10,
		claimedAt: Date.now(),
		...overrides
	} as Plot;
}

/**
 * Creates a mock extractor structure
 */
function createMockExtractor(
	extractorType: string,
	level: number = 1,
	overrides: Partial<StructureWithInfo> = {}
): StructureWithInfo {
	return {
		id: `structure-${extractorType}-${level}`,
		settlementId: 'settlement-1',
		structureId: `def-${extractorType}`,
		plotId: 'plot-1',
		name: extractorType,
		level,
		category: 'EXTRACTOR',
		extractorType,
		buildingType: null,
		constructionStartedAt: null,
		constructionCompletedAt: new Date(),
		description: `Mock ${extractorType}`,
		createdAt: new Date(),
		updatedAt: new Date(),
		...overrides
	} as StructureWithInfo;
}

// ===== TEST SCENARIOS =====

describe('BLOCKER 2: Production Requires Extractors', () => {
	const TICKS_PER_SECOND = 60;
	const BIOME_GRASSLAND = 'GRASSLAND'; // 1x all resources
	const BIOME_FOREST = 'FOREST'; // 0.8x food, 2x wood

	// ===== SCENARIO 1: No Extractors → Zero Production =====
	describe('Scenario 1: No extractors produce zero resources', () => {
		test('plot with resources but no extractors produces nothing', () => {
			const plot = createMockPlot({
				food: 10,
				water: 10,
				wood: 10,
				stone: 10,
				ore: 10,
				qualityMultiplier: 1.5
			});

			const production = calculateProduction(
				plot,
				[], // No extractors
				TICKS_PER_SECOND,
				BIOME_GRASSLAND
			);

			expect(production.food).toBe(0);
			expect(production.water).toBe(0);
			expect(production.wood).toBe(0);
			expect(production.stone).toBe(0);
			expect(production.ore).toBe(0);
		});

		test('plot with BUILDING (not EXTRACTOR) produces nothing', () => {
			const plot = createMockPlot({ food: 10 });
			const building: StructureWithInfo = {
				id: 'building-1',
				settlementId: 'settlement-1',
				structureId: 'def-house',
				plotId: null, // Buildings don't have plotId
				name: 'House',
				level: 1,
				category: 'BUILDING',
				extractorType: null,
				buildingType: 'HOUSE',
				constructionStartedAt: null,
				constructionCompletedAt: new Date(),
				description: 'Housing',
				createdAt: new Date(),
				updatedAt: new Date()
			} as StructureWithInfo;

			const production = calculateProduction(
				plot,
				[building], // Building, not extractor
				TICKS_PER_SECOND,
				BIOME_GRASSLAND
			);

			expect(production.food).toBe(0);
			expect(production.water).toBe(0);
			expect(production.wood).toBe(0);
			expect(production.stone).toBe(0);
			expect(production.ore).toBe(0);
		});
	});

	// ===== SCENARIO 2: FARM Level 1 → Correct Food Production =====
	describe('Scenario 2: FARM level 1 produces correct food', () => {
		test('FARM level 1 with quality 1.2 in GRASSLAND', () => {
			const plot = createMockPlot({
				food: 10,
				qualityMultiplier: 1.2
			});

			const farm = createMockExtractor('FARM', 1);

			const production = calculateProduction(
				plot,
				[farm],
				TICKS_PER_SECOND,
				BIOME_GRASSLAND
			);

			// Formula: BaseRate × Resource × Quality × BiomeEff × LevelMult × Ticks
			// 0.01 × 10 × 1.2 × 1.0 × 1.0 × 60 = 7.2 food
			expect(production.food).toBeCloseTo(7.2, 4);
			expect(production.water).toBe(0);
			expect(production.wood).toBe(0);
			expect(production.stone).toBe(0);
			expect(production.ore).toBe(0);
		});

		test('FARM level 1 with quality 1 in GRASSLAND', () => {
			const plot = createMockPlot({
				food: 10,
				qualityMultiplier: 1
			});

			const farm = createMockExtractor('FARM', 1);

			const production = calculateProduction(
				plot,
				[farm],
				TICKS_PER_SECOND,
				BIOME_GRASSLAND
			);

			// 0.01 × 10 × 1 × 1 × 1 × 60 = 6 food
			expect(production.food).toBeCloseTo(6, 4);
		});
	});

	// ===== SCENARIO 3: FARM Level 2 → 20% More Production =====
	describe('Scenario 3: FARM level 2 produces 20% more', () => {
		test('FARM level 2 has 1.2x multiplier', () => {
			const plot = createMockPlot({
				food: 10,
				qualityMultiplier: 1.2
			});

			const farmL2 = createMockExtractor('FARM', 2);

			const production = calculateProduction(
				plot,
				[farmL2],
				TICKS_PER_SECOND,
				BIOME_GRASSLAND
			);

			// Level multiplier: 1 + (2-1) × 0.2 = 1.2
			// 0.01 × 10 × 1.2 × 1.0 × 1.2 × 60 = 8.64 food
			expect(production.food).toBeCloseTo(8.64, 4);
		});

		test('FARM level 3 has 1.4x multiplier', () => {
			const plot = createMockPlot({
				food: 10,
				qualityMultiplier: 1
			});

			const farmL3 = createMockExtractor('FARM', 3);

			const production = calculateProduction(
				plot,
				[farmL3],
				TICKS_PER_SECOND,
				BIOME_GRASSLAND
			);

			// Level multiplier: 1 + (3-1) × 0.2 = 1.4
			// 0.01 × 10 × 1 × 1 × 1.4 × 60 = 8.4 food
			expect(production.food).toBeCloseTo(8.4, 4);
		});
	});

	// ===== SCENARIO 4a: FARM in FOREST → 80% Food =====
	describe('Scenario 4a: Biome efficiency affects production (FARM in FOREST)', () => {
		test('FARM in FOREST produces 80% food (0.8x efficiency)', () => {
			const plot = createMockPlot({
				food: 10,
				qualityMultiplier: 1
			});

			const farm = createMockExtractor('FARM', 1);

			const production = calculateProduction(
				plot,
				[farm],
				TICKS_PER_SECOND,
				BIOME_FOREST // Forest has 0.8x food efficiency
			);

			// 0.01 × 10 × 1 × 0.8 × 1 × 60 = 4.8 food
			expect(production.food).toBeCloseTo(4.8, 4);
		});
	});

	// ===== SCENARIO 4b: LUMBER_MILL in FOREST → 200% Wood =====
	describe('Scenario 4b: Biome efficiency affects production (LUMBER_MILL in FOREST)', () => {
		test('LUMBER_MILL in FOREST produces 200% wood (2x efficiency)', () => {
			const plot = createMockPlot({
				wood: 15,
				qualityMultiplier: 1
			});

			const lumberMill = createMockExtractor('LUMBER_MILL', 1);

			const production = calculateProduction(
				plot,
				[lumberMill],
				TICKS_PER_SECOND,
				BIOME_FOREST // Forest has 2x wood efficiency
			);

			// 0.01 × 15 × 1 × 2 × 1 × 60 = 18 wood
			expect(production.wood).toBeCloseTo(18, 4);
			expect(production.food).toBe(0);
		});

		test('QUARRY in DESERT produces 200% stone (2x efficiency)', () => {
			const plot = createMockPlot({
				stone: 12,
				qualityMultiplier: 1
			});

			const quarry = createMockExtractor('QUARRY', 1);

			const production = calculateProduction(
				plot,
				[quarry],
				TICKS_PER_SECOND,
				'DESERT' // Desert has 2x stone efficiency
			);

			// 0.01 × 12 × 1 × 2 × 1 × 60 = 14.4 stone
			expect(production.stone).toBeCloseTo(14.4, 4);
		});
	});

	// ===== SCENARIO 5: Multiple Extractors on Same Plot =====
	describe('Scenario 5: Multiple extractors produce combined resources', () => {
		test('FARM + WELL on same plot produce food + water', () => {
			const plot = createMockPlot({
				food: 10,
				water: 8,
				qualityMultiplier: 1
			});

			const farm = createMockExtractor('FARM', 1);
			const well = createMockExtractor('WELL', 1);

			const production = calculateProduction(
				plot,
				[farm, well],
				TICKS_PER_SECOND,
				BIOME_GRASSLAND
			);

			// Food: 0.01 × 10 × 1 × 1 × 1 × 60 = 6
			// Water: 0.01 × 8 × 1 × 1 × 1 × 60 = 4.8
			expect(production.food).toBeCloseTo(6, 4);
			expect(production.water).toBeCloseTo(4.8, 4);
			expect(production.wood).toBe(0);
			expect(production.stone).toBe(0);
			expect(production.ore).toBe(0);
		});

		test('3 extractors (FARM L2 + WELL + LUMBER_MILL L3)', () => {
			const plot = createMockPlot({
				food: 10,
				water: 8,
				wood: 12,
				qualityMultiplier: 1
			});

			const farm = createMockExtractor('FARM', 2); // Level 2 = 1.2x
			const well = createMockExtractor('WELL', 1); // Level 1 = 1.0x
			const lumberMill = createMockExtractor('LUMBER_MILL', 3); // Level 3 = 1.4x

			const production = calculateProduction(
				plot,
				[farm, well, lumberMill],
				TICKS_PER_SECOND,
				BIOME_GRASSLAND
			);

			// Food: 0.01 × 10 × 1.0 × 1.0 × 1.2 × 60 = 7.2
			// Water: 0.01 × 8 × 1.0 × 1.0 × 1.0 × 60 = 4.8
			// Wood: 0.01 × 12 × 1.0 × 1.0 × 1.4 × 60 = 10.08
			expect(production.food).toBeCloseTo(7.2, 4);
			expect(production.water).toBeCloseTo(4.8, 4);
			expect(production.wood).toBeCloseTo(10.08, 4);
			expect(production.stone).toBe(0);
			expect(production.ore).toBe(0);
		});
	});

	// ===== HELPER FUNCTION TESTS =====
	describe('Helper Functions', () => {
		test('isExtractor() identifies extractors correctly', () => {
			const extractor = createMockExtractor('FARM', 1);
			const building: StructureWithInfo = {
				id: 'building-1',
				settlementId: 'settlement-1',
				structureId: 'def-house',
				plotId: null,
				name: 'House',
				level: 1,
				category: 'BUILDING',
				extractorType: null,
				buildingType: 'HOUSE',
				constructionStartedAt: null,
				constructionCompletedAt: new Date(),
				description: 'Housing',
				createdAt: new Date(),
				updatedAt: new Date()
			} as StructureWithInfo;

			expect(isExtractor(extractor)).toBe(true);
			expect(isExtractor(building)).toBe(false);
		});

		test('getAverageLevel() calculates average correctly', () => {
			const extractors = [
				createMockExtractor('FARM', 1),
				createMockExtractor('WELL', 2),
				createMockExtractor('LUMBER_MILL', 3)
			];

			const average = getAverageLevel(extractors);
			expect(average).toBeCloseTo(2, 4); // (1+2+3)/3 = 2
		});

		test('getAverageLevel() returns 0 for empty array', () => {
			expect(getAverageLevel([])).toBe(0);
		});

		test('getMaxLevel() finds maximum level', () => {
			const extractors = [
				createMockExtractor('FARM', 1),
				createMockExtractor('WELL', 5),
				createMockExtractor('LUMBER_MILL', 3)
			];

			const maxLevel = getMaxLevel(extractors);
			expect(maxLevel).toBe(5);
		});

		test('getMaxLevel() returns 0 for empty array', () => {
			expect(getMaxLevel([])).toBe(0);
		});

		test('getExtractorsByResource() filters by resource type', () => {
			const extractors = [
				createMockExtractor('FARM', 1),
				createMockExtractor('WELL', 2),
				createMockExtractor('LUMBER_MILL', 3),
				createMockExtractor('QUARRY', 1)
			];

			const foodExtractors = getExtractorsByResource(extractors, 'food');
			expect(foodExtractors).toHaveLength(1);
			expect(foodExtractors[0].extractorType).toBe('FARM');

			const waterExtractors = getExtractorsByResource(extractors, 'water');
			expect(waterExtractors).toHaveLength(1);
			expect(waterExtractors[0].extractorType).toBe('WELL');

			const woodExtractors = getExtractorsByResource(extractors, 'wood');
			expect(woodExtractors).toHaveLength(1);
			expect(woodExtractors[0].extractorType).toBe('LUMBER_MILL');

			const stoneExtractors = getExtractorsByResource(extractors, 'stone');
			expect(stoneExtractors).toHaveLength(1);
			expect(stoneExtractors[0].extractorType).toBe('QUARRY');

			const oreExtractors = getExtractorsByResource(extractors, 'ore');
			expect(oreExtractors).toHaveLength(0); // No MINE in this set
		});
	});
});
