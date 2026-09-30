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
  'Engine Parts',
  'Transmission Parts',
  'Suspension Parts',
  'Electrical Parts',
  'Braking System',
  'Cooling System',
  'Lighting Parts',
  'Chassis Parts'
] as const;

export type PartCategory = typeof PART_CATEGORIES[number];

/**
 * Category-based placeholder suggestions for part names
 * These help users understand what type of part to enter for each category
 */
export const CATEGORY_PLACEHOLDERS: Record<string, string> = {
  'Engine Parts': 'e.g., Piston, Cylinder Head, Crankshaft',
  'Transmission Parts': 'e.g., Clutch Plate, Gear Box Assembly',
  'Suspension Parts': 'e.g., Front Shock Absorber, Rear Springs',
  'Electrical Parts': 'e.g., Alternator, Battery, Ignition Coil',
  'Braking System': 'e.g., Brake Pads, Brake Disc, Brake Cylinder',
  'Cooling System': 'e.g., Radiator, Water Pump, Cooling Fan',
  'Lighting Parts': 'e.g., Headlight Bulb, Tail Light Assembly',
  'Chassis Parts': 'e.g., Frame Bracket, Swing Arm, Foot Rest'
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
export const DEFAULT_CATEGORY = 'Engine Parts';
