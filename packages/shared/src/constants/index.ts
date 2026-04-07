export const COLOUR_CODES = ['Green', 'Yellow', 'Orange', 'Red', 'Blue'] as const;
export type ColourCode = typeof COLOUR_CODES[number];

export const COLOUR_CODE_STYLES: Record<ColourCode, { bg: string; label: string; description: string }> = {
  Green:  { bg: '#22c55e', label: 'Green',  description: 'Walking / Talking' },
  Yellow: { bg: '#eab308', label: 'Yellow', description: 'Minor Injuries' },
  Orange: { bg: '#f97316', label: 'Orange', description: 'Moderate' },
  Red:    { bg: '#ef4444', label: 'Red',    description: 'Critical' },
  Blue:   { bg: '#3b82f6', label: 'Blue',   description: 'Deceased' },
};

export const LOV_TABLES = [
  'call_types',
  'reasons',
  'locations',
  'areas',
  'transports',
  'hospitals',
  'responders',
  'medical_history_presets',
  'drugs',
] as const;
export type LovTable = typeof LOV_TABLES[number];

export const DEFAULT_UNK = 'UNK';
export const DEFAULT_HGT = 'N/A';
