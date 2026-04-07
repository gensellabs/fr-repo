export declare const COLOUR_CODES: readonly ["Green", "Yellow", "Orange", "Red", "Blue"];
export type ColourCode = typeof COLOUR_CODES[number];
export declare const COLOUR_CODE_STYLES: Record<ColourCode, {
    bg: string;
    label: string;
    description: string;
}>;
export declare const LOV_TABLES: readonly ["call_types", "reasons", "locations", "areas", "transports", "hospitals", "responders", "medical_history_presets", "drugs"];
export type LovTable = typeof LOV_TABLES[number];
export declare const DEFAULT_UNK = "UNK";
export declare const DEFAULT_HGT = "N/A";
