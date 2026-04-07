"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_HGT = exports.DEFAULT_UNK = exports.LOV_TABLES = exports.COLOUR_CODE_STYLES = exports.COLOUR_CODES = void 0;
exports.COLOUR_CODES = ['Green', 'Yellow', 'Orange', 'Red', 'Blue'];
exports.COLOUR_CODE_STYLES = {
    Green: { bg: '#22c55e', label: 'Green', description: 'Walking / Talking' },
    Yellow: { bg: '#eab308', label: 'Yellow', description: 'Minor Injuries' },
    Orange: { bg: '#f97316', label: 'Orange', description: 'Moderate' },
    Red: { bg: '#ef4444', label: 'Red', description: 'Critical' },
    Blue: { bg: '#3b82f6', label: 'Blue', description: 'Deceased' },
};
exports.LOV_TABLES = [
    'call_types',
    'reasons',
    'locations',
    'areas',
    'transports',
    'hospitals',
    'responders',
    'medical_history_presets',
    'drugs',
];
exports.DEFAULT_UNK = 'UNK';
exports.DEFAULT_HGT = 'N/A';
