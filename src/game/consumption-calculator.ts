/**
 * Consumption Calculator
 * 
 * Calculates resource consumption for settlements including:
 * - Population food/water consumption
 * - Structure maintenance costs (future)
 * - Resource decay/spoilage (future)
 */

import type { Resources } from './resource-calculator';

/**
 * Per-capita consumption rates per tick (60 ticks per second)
 * These values are very small per tick but add up over time
 * 
 * Example: 0.00008333 food per person per tick
 * = 0.005 food per person per second
 * = 0.3 food per person per minute
 * = 18 food per person per hour
 * = 432 food per person per day
 */
export const CONSUMPTION_RATES = {
	/** Food consumed per person per tick */
	FOOD_PER_CAPITA_PER_TICK: 0.00008333, // 18 food/hour
	
	/** Water consumed per person per tick */
	WATER_PER_CAPITA_PER_TICK: 0.000125,  // 27 water/hour
	
	/** Base population capacity without structures */
	BASE_POPULATION_CAPACITY: 10
};

/**
 * Structure modifiers that affect population
 */
export interface StructureModifier {
	name: string;
	value: number;
}

/**
 * Structure with modifiers
 */
export interface Structure {
	name: string;
	modifiers: StructureModifier[];
}

/**
 * Calculate population capacity from settlement structures
 * Based on "Population Capacity" modifiers plus base capacity
 * 
 * @param structures Array of settlement structures with modifiers
 * @returns Total population capacity
 */
export function calculatePopulationCapacity(structures: Structure[]): number {
	let capacity = CONSUMPTION_RATES.BASE_POPULATION_CAPACITY;

	for (const structure of structures) {
		for (const modifier of structure.modifiers) {
			if (modifier.name === 'Population Capacity') {
				capacity += modifier.value;
			}
		}
	}

	return Math.max(0, Math.floor(capacity));
}

/**
 * Calculate actual population (for now, same as capacity)
 * 
 * Future: Track actual population with growth/decline mechanics
 * - Population grows when food/water abundant
 * - Population declines when resources scarce
 * - Population capped by capacity
 * 
 * @param structures Array of settlement structures
 * @param _currentPopulation Current population (optional, for future use)
 * @returns Current population count
 */
export function calculatePopulation(
	structures: Structure[],
	_currentPopulation?: number
): number {
	const capacity = calculatePopulationCapacity(structures);
	
	// For now, assume settlements are at max capacity
	// Future: Return Math.min(currentPopulation ?? capacity, capacity)
	return capacity;
}

/**
 * Calculate resource consumption per tick for a settlement
 * 
 * @param population Current population count
 * @param tickCount Number of ticks to calculate for (default: 1)
 * @returns Resource consumption amounts
 */
export function calculateConsumption(
	population: number,
	tickCount: number = 1
): Resources {
	const foodConsumption = population * CONSUMPTION_RATES.FOOD_PER_CAPITA_PER_TICK * tickCount;
	const waterConsumption = population * CONSUMPTION_RATES.WATER_PER_CAPITA_PER_TICK * tickCount;

	return {
		food: foodConsumption,
		water: waterConsumption,
		wood: 0,  // Future: Structure maintenance
		stone: 0, // Future: Structure maintenance
		ore: 0    // Future: Structure maintenance
	};
}

/**
 * Calculate morale from structures
 * Based on "Morale Boost" modifiers
 * 
 * @param structures Array of settlement structures
 * @returns Morale value (0-100)
 */
export function calculateMorale(structures: Structure[]): number {
	let morale = 50; // Base morale

	for (const structure of structures) {
		for (const modifier of structure.modifiers) {
			if (modifier.name === 'Morale Boost') {
				morale += modifier.value;
			}
		}
	}

	// Clamp to 0-100 range
	return Math.max(0, Math.min(100, morale));
}

/**
 * Calculate consumption summary for display
 * 
 * @param structures Array of settlement structures
 * @param currentPopulation Current population (optional)
 * @returns Consumption summary with rates and totals
 */
export function getConsumptionSummary(
	structures: Structure[],
	currentPopulation?: number
) {
	const population = calculatePopulation(structures, currentPopulation);
	const capacity = calculatePopulationCapacity(structures);
	const consumption = calculateConsumption(population, 60); // Per second
	const morale = calculateMorale(structures);

	return {
		population,
		capacity,
		consumption,
		morale,
		perCapitaPerSecond: {
			food: CONSUMPTION_RATES.FOOD_PER_CAPITA_PER_TICK * 60,
			water: CONSUMPTION_RATES.WATER_PER_CAPITA_PER_TICK * 60
		},
		perCapitaPerHour: {
			food: CONSUMPTION_RATES.FOOD_PER_CAPITA_PER_TICK * 60 * 60 * 60,
			water: CONSUMPTION_RATES.WATER_PER_CAPITA_PER_TICK * 60 * 60 * 60
		}
	};
}

/**
 * Check if settlement has sufficient resources for population
 * Returns true if resources can sustain population for at least 1 hour
 * 
 * @param population Current population
 * @param resources Current resource amounts
 * @returns Whether resources are sufficient
 */
export function hasResourcesForPopulation(
	population: number,
	resources: Resources
): boolean {
	// Calculate consumption for 1 hour (60 * 60 * 60 ticks)
	const hourlyConsumption = calculateConsumption(population, 60 * 60 * 60);
	
	return (
		resources.food >= hourlyConsumption.food &&
		resources.water >= hourlyConsumption.water
	);
}
