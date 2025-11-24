/**
 * Production Effectiveness Integration Tests (Part 6.7)
 *
 * Tests that structure health affects resource production according to GDD Section 6.6.
 *
 * Formula Integration:
 * Production = BaseRate × PlotResource × Quality × BiomeEfficiency × LevelMultiplier × Effectiveness × Ticks
 *
 * Effectiveness Breakpoints (from GDD):
 * - 100% health → 1x effectiveness (100% production)
 * - 80% health → 0.95x effectiveness (95% production)
 * - 60% health → 0.85x effectiveness (85% production)
 * - 40% health → 0.6x effectiveness (60% production)
 * - 20% health → 0.25x effectiveness (25% production)
 * - 10% health → 0.1x effectiveness (10% production)
 * - 0% health → 0.0x effectiveness (0% production - destroyed)
 */

import { describe, test, expect } from 'vitest';
import { calculateProduction } from '../../../src/game/resource-calculator.js';
import type { Plot, SettlementStructure, Tile, World } from '../../../src/db/schema.js';

describe('Production Effectiveness Integration (Part 6.7)', () => {
	// Test setup helpers
	const createBaseTile = (): Partial<Tile> => ({
		id: 'tile-1',
		worldId: 'world-1',
		x: 0,
		y: 0,
		tileType: 'LAND',
		biome: 'GRASSLAND',
		elevation: 50,
		precipitation: 50,
		temperature: 20,
		quality: 80,
		primaryResource: 'FOOD',
		specialResource: null,
		landmark: null,
		createdAt: new Date(),
		updatedAt: new Date(),
	});

	const createBasePlot = (tileId: string): Partial<Plot> => ({
		id: 'plot-1',
		tileId,
		settlementId: 'settlement-1',
		claimedAt: new Date(),
		FOOD: 100, // High food value
		WATER: 50,
		WOOD: 30,
		STONE: 20,
		ORE: 10,
		qualityMultiplier: 0.8, // 80% quality
	});

	const createBaseWorld = (): Partial<World> => ({
		id: 'world-1',
		name: 'Test World',
		serverId: 'server-1',
		seed: 12345,
		size: 'MEDIUM',
		status: 'READY',
		templateType: 'STANDARD',
		productionMultiplier: 1, // Standard production
		consumptionMultiplier: 1,
		createdAt: new Date(),
		updatedAt: new Date(),
	});

	const createFarmExtractor = (health: number | null): Partial<SettlementStructure> => ({
		id: 'extractor-1',
		settlementId: 'settlement-1',
		plotId: 'plot-1',
		category: 'EXTRACTOR',
		type: 'FARM',
		level: 1,
		name: 'Test Farm',
		health, // Variable health for testing
		staffed: true,
		createdAt: new Date(),
		updatedAt: new Date(),
	});

	describe('Health → Effectiveness → Production Chain', () => {
		test('100% health → 100% production (pristine)', () => {
			const tile = createBaseTile();
			const plot = createBasePlot(tile.id!);
			const world = createBaseWorld();
			const extractor = createFarmExtractor(100);

			const production = calculateProduction(
				[tile as Tile],
				[plot as Plot],
				[extractor as SettlementStructure],
				world as World,
				1, // 1 tick
			);

			// Calculate expected production
			// BaseRate (0.01) × PlotFood (100) × Quality (0.8) × BiomeEff (1) × Level (1) × Effectiveness (1) × Ticks (1)
			const expected = 0.01 * 100 * 0.8 * 1 * 1 * 1 * 1;
			expect(production.FOOD).toBeCloseTo(expected, 5);
			expect(production.FOOD).toBeCloseTo(0.8, 5); // Full production
		});

		test('80% health → 95% production (excellent condition)', () => {
			const tile = createBaseTile();
			const plot = createBasePlot(tile.id!);
			const world = createBaseWorld();
			const extractor = createFarmExtractor(80);

			const production = calculateProduction(
				[tile as Tile],
				[plot as Plot],
				[extractor as SettlementStructure],
				world as World,
				1,
			);

			// Expected: 0.8 (full production) × 0.95 (95% effectiveness)
			const expected = 0.01 * 100 * 0.8 * 1 * 1 * 0.95 * 1;
			expect(production.FOOD).toBeCloseTo(expected, 5);
			expect(production.FOOD).toBeCloseTo(0.76, 5); // 95% of full
		});

		test('60% health → 85% production (good condition)', () => {
			const tile = createBaseTile();
			const plot = createBasePlot(tile.id!);
			const world = createBaseWorld();
			const extractor = createFarmExtractor(60);

			const production = calculateProduction(
				[tile as Tile],
				[plot as Plot],
				[extractor as SettlementStructure],
				world as World,
				1,
			);

			// Expected: 0.8 (full production) × 0.85 (85% effectiveness)
			const expected = 0.01 * 100 * 0.8 * 1 * 1 * 0.85 * 1;
			expect(production.FOOD).toBeCloseTo(expected, 5);
			expect(production.FOOD).toBeCloseTo(0.68, 5); // 85% of full
		});

		test('40% health → 60% production (damaged)', () => {
			const tile = createBaseTile();
			const plot = createBasePlot(tile.id!);
			const world = createBaseWorld();
			const extractor = createFarmExtractor(40);

			const production = calculateProduction(
				[tile as Tile],
				[plot as Plot],
				[extractor as SettlementStructure],
				world as World,
				1,
			);

			// Expected: 0.8 (full production) × 0.6 (60% effectiveness)
			const expected = 0.01 * 100 * 0.8 * 1 * 1 * 0.6 * 1;
			expect(production.FOOD).toBeCloseTo(expected, 5);
			expect(production.FOOD).toBeCloseTo(0.48, 5); // 60% of full
		});

		test('20% health → 25% production (poor condition)', () => {
			const tile = createBaseTile();
			const plot = createBasePlot(tile.id!);
			const world = createBaseWorld();
			const extractor = createFarmExtractor(20);

			const production = calculateProduction(
				[tile as Tile],
				[plot as Plot],
				[extractor as SettlementStructure],
				world as World,
				1,
			);

			// Expected: 0.8 (full production) × 0.25 (25% effectiveness)
			const expected = 0.01 * 100 * 0.8 * 1 * 1 * 0.25 * 1;
			expect(production.FOOD).toBeCloseTo(expected, 5);
			expect(production.FOOD).toBeCloseTo(0.2, 5); // 25% of full
		});

		test('10% health → 10% production (critical)', () => {
			const tile = createBaseTile();
			const plot = createBasePlot(tile.id!);
			const world = createBaseWorld();
			const extractor = createFarmExtractor(10);

			const production = calculateProduction(
				[tile as Tile],
				[plot as Plot],
				[extractor as SettlementStructure],
				world as World,
				1,
			);

			// Expected: 0.8 (full production) × 0.1 (10% effectiveness)
			const expected = 0.01 * 100 * 0.8 * 1 * 1 * 0.1 * 1;
			expect(production.FOOD).toBeCloseTo(expected, 5);
			expect(production.FOOD).toBeCloseTo(0.08, 5); // 10% of full
		});

		test('0% health → 0% production (destroyed)', () => {
			const tile = createBaseTile();
			const plot = createBasePlot(tile.id!);
			const world = createBaseWorld();
			const extractor = createFarmExtractor(0);

			const production = calculateProduction(
				[tile as Tile],
				[plot as Plot],
				[extractor as SettlementStructure],
				world as World,
				1,
			);

			// Expected: 0.8 (full production) × 0.0 (0% effectiveness)
			expect(production.FOOD).toBe(0);
		});
	});

	describe('Null/Undefined Health Handling', () => {
		test('null health → 100% production (default pristine)', () => {
			const tile = createBaseTile();
			const plot = createBasePlot(tile.id!);
			const world = createBaseWorld();
			const extractor = createFarmExtractor(null);

			const production = calculateProduction(
				[tile as Tile],
				[plot as Plot],
				[extractor as SettlementStructure],
				world as World,
				1,
			);

			// Expected: Full production (null health defaults to 100%)
			const expected = 0.01 * 100 * 0.8 * 1 * 1 * 1 * 1;
			expect(production.FOOD).toBeCloseTo(expected, 5);
			expect(production.FOOD).toBeCloseTo(0.8, 5);
		});
	});

	describe('Multiple Extractors with Different Health Levels', () => {
		test('should sum production from multiple extractors with varying health', () => {
			const tile1 = createBaseTile();
			tile1.id = 'tile-1';
			const tile2 = { ...createBaseTile(), id: 'tile-2' };

			const plot1 = createBasePlot(tile1.id);
			plot1.id = 'plot-1';
			plot1.FOOD = 100;

			const plot2 = { ...createBasePlot(tile2.id), id: 'plot-2', FOOD: 100 };

			const world = createBaseWorld();

			// 3 extractors with different health levels
			const extractor1 = createFarmExtractor(100); // Full production
			extractor1.id = 'ext-1';
			extractor1.plotId = 'plot-1';

			const extractor2 = { ...createFarmExtractor(60), id: 'ext-2', plotId: 'plot-2' }; // 85% production

			const extractor3 = { ...createFarmExtractor(20), id: 'ext-3', plotId: 'plot-1' }; // 25% production

			const production = calculateProduction(
				[tile1 as Tile, tile2 as Tile],
				[plot1 as Plot, plot2 as Plot],
				[extractor1 as SettlementStructure, extractor2 as SettlementStructure, extractor3 as SettlementStructure],
				world as World,
				1,
			);

			// Expected total production:
			// Extractor1 (100% health): 0.01 × 100 × 0.8 × 1 × 1 × 1 = 0.8
			// Extractor2 (60% health): 0.01 × 100 × 0.8 × 1 × 1 × 0.85 = 0.68
			// Extractor3 (20% health): 0.01 × 100 × 0.8 × 1 × 1 × 0.25 = 0.2
			// Total: 0.8 + 0.68 + 0.2 = 1.68
			expect(production.FOOD).toBeCloseTo(1.68, 5);
		});
	});

	describe('Edge Cases & Real-World Scenarios', () => {
		test('farm at 54% health produces correct amount (GDD example)', () => {
			const tile = createBaseTile();
			const plot = createBasePlot(tile.id!);
			const world = createBaseWorld();
			const extractor = createFarmExtractor(54);

			const production = calculateProduction(
				[tile as Tile],
				[plot as Plot],
				[extractor as SettlementStructure],
				world as World,
				1,
			);

			// 54% health → ~73% effectiveness (interpolated between 40% and 60%)
			// GDD states: "Farm at 54% health: Produces 51 food/hour (good condition)"
			// Our formula: 0.01 × 100 × 0.8 × 1 × 1 × 0.73 × 1 = 0.584 per tick
			// But this is per tick; hourly would be different

			// For this test, just verify effectiveness is applied correctly
			const effectiveness = 0.73; // Interpolated between 0.6 (40%) and 0.85 (60%)
			const expected = 0.01 * 100 * 0.8 * 1 * 1 * effectiveness * 1;
			expect(production.FOOD).toBeCloseTo(expected, 2); // Allow for interpolation variance
		});

		test('multiple resource types with same health', () => {
			const tile = createBaseTile();
			const plot = createBasePlot(tile.id!);
			plot.WATER = 80;
			plot.WOOD = 60;

			const world = createBaseWorld();
			const extractor = createFarmExtractor(75); // Between 60% and 80% health

			const production = calculateProduction(
				[tile as Tile],
				[plot as Plot],
				[extractor as SettlementStructure],
				world as World,
				1,
			);

			// 75% health → ~90% effectiveness (interpolated)
			// Should apply same effectiveness to all resources produced by this extractor
			const effectiveness = 0.9; // Approximate
			expect(production.FOOD).toBeCloseTo(0.01 * 100 * 0.8 * 1 * 1 * effectiveness, 1);
			// Note: WATER and WOOD won't be produced by a FARM extractor (wrong resource type)
		});

		test('health changes over time affect production proportionally', () => {
			const tile = createBaseTile();
			const plot = createBasePlot(tile.id!);
			const world = createBaseWorld();

			// Measure production at different health levels
			const healthLevels = [100, 90, 70, 50, 30, 10, 0];
			const productions: number[] = [];

			for (const health of healthLevels) {
				const extractor = createFarmExtractor(health);
				const production = calculateProduction(
					[tile as Tile],
					[plot as Plot],
					[extractor as SettlementStructure],
					world as World,
					1,
				);
				productions.push(production.FOOD);
			}

			// Production should decrease monotonically as health drops
			for (let i = 1; i < productions.length; i++) {
				expect(productions[i]).toBeLessThanOrEqual(productions[i - 1]);
			}

			// First should be highest, last should be zero
			expect(productions[0]).toBeCloseTo(0.8, 5); // 100% health
			expect(productions[productions.length - 1]).toBe(0); // 0% health
		});
	});

	describe('Integration with Other Multipliers', () => {
		test('effectiveness stacks with level multiplier', () => {
			const tile = createBaseTile();
			const plot = createBasePlot(tile.id!);
			const world = createBaseWorld();

			// Level 3 extractor at 60% health
			const extractor = createFarmExtractor(60);
			extractor.level = 3; // Level multiplier = 1 + (3-1) × 0.2 = 1.4

			const production = calculateProduction(
				[tile as Tile],
				[plot as Plot],
				[extractor as SettlementStructure],
				world as World,
				1,
			);

			// Expected: 0.01 × 100 × 0.8 × 1 × 1.4 (level) × 0.85 (health) × 1
			const expected = 0.01 * 100 * 0.8 * 1 * 1.4 * 0.85 * 1;
			expect(production.FOOD).toBeCloseTo(expected, 5);
			expect(production.FOOD).toBeCloseTo(0.952, 5);
		});

		test('effectiveness stacks with world template multiplier', () => {
			const tile = createBaseTile();
			const plot = createBasePlot(tile.id!);
			const world = createBaseWorld();
			world.productionMultiplier = 1.5; // Relaxed mode (150% production)

			const extractor = createFarmExtractor(40); // 60% effectiveness

			const production = calculateProduction(
				[tile as Tile],
				[plot as Plot],
				[extractor as SettlementStructure],
				world as World,
				1,
			);

			// Expected: 0.01 × 100 × 0.8 × 1 × 1 × 0.6 (health) × 1 × 1.5 (world)
			const expected = 0.01 * 100 * 0.8 * 1 * 1 * 0.6 * 1 * 1.5;
			expect(production.FOOD).toBeCloseTo(expected, 5);
			expect(production.FOOD).toBeCloseTo(0.72, 5);
		});

		test('effectiveness stacks with tick count', () => {
			const tile = createBaseTile();
			const plot = createBasePlot(tile.id!);
			const world = createBaseWorld();
			const extractor = createFarmExtractor(80); // 95% effectiveness

			const production = calculateProduction(
				[tile as Tile],
				[plot as Plot],
				[extractor as SettlementStructure],
				world as World,
				3600, // 1 hour at 60 ticks/sec
			);

			// Expected: 0.01 × 100 × 0.8 × 1 × 1 × 0.95 × 3600
			const expected = 0.01 * 100 * 0.8 * 1 * 1 * 0.95 * 3600;
			expect(production.FOOD).toBeCloseTo(expected, 5);
			expect(production.FOOD).toBeCloseTo(2736, 5);
		});
	});

	describe('GDD Compliance Validation', () => {
		test('matches GDD Section 6.6 effectiveness formula', () => {
			// GDD states: "Farm at 60% health: Produces 51 food/hour (good condition)"
			// This means 85% effectiveness at 60% health

			const tile = createBaseTile();
			const plot = createBasePlot(tile.id!);
			const world = createBaseWorld();
			const extractor = createFarmExtractor(60);

			const production = calculateProduction(
				[tile as Tile],
				[plot as Plot],
				[extractor as SettlementStructure],
				world as World,
				1,
			);

			// Verify 85% effectiveness is applied
			const fullProduction = 0.01 * 100 * 0.8 * 1 * 1 * 1 * 1;
			const damagedProduction = production.FOOD;
			const actualEffectiveness = damagedProduction / fullProduction;

			expect(actualEffectiveness).toBeCloseTo(0.85, 2); // Should be 85%
		});
	});
});
