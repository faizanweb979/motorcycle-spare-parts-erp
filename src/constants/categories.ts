/**
 * Centralized Part Categories Configuration
 * 
 * This file defines all part categories used throughout the ERP system.
 * Categories are used in:
 * - Parts Master (Add/Edit/Filter)
 * - Part Detail Page
 * - Sales & Purchases
 * - Reports & Analytics
 * 
 * DO NOT duplicate this list elsewhere. Import from this file.
 */

export const PART_CATEGORIES = [
  'Loom Spare Parts',
  'Plant Parts',
  'Auto Cutting Parts',
  'Dican 3 Parts',
  'Quality Department Parts',
  'Floor Mill Parts',
  'Bearing',
  'Belt'
] as const;

export type PartCategory = typeof PART_CATEGORIES[number];

/**
 * Category-based placeholder suggestions for part names
 * These help users understand what type of part to enter for each category
 */
export const CATEGORY_PLACEHOLDERS: Record<string, string> = {
  'Loom Spare Parts': 'e.g., Loom Motor Gear Assembly',
  'Plant Parts': 'e.g., Plant Machine Shaft',
  'Auto Cutting Parts': 'e.g., Cutting Blade Holder',
  'Dican 3 Parts': 'e.g., Dican 3 Machine Component',
  'Quality Department Parts': 'e.g., Quality Inspection Gauge',
  'Floor Mill Parts': 'e.g., Floor Mill Roller Bearing',
  'Bearing': 'e.g., 6204 Deep Groove Ball Bearing',
  'Belt': 'e.g., V-Belt A42 Industrial'
};

/**
 * Get placeholder text for a given category
 */
export function getCategoryPlaceholder(category: string): string {
  return CATEGORY_PLACEHOLDERS[category] || 'e.g., Part name or description';
}

/**
 * Default category for new parts
 */
export const DEFAULT_CATEGORY = 'Loom Spare Parts';
