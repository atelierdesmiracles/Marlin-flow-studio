// Realistic demo Marlin Configuration.h and Configuration_adv.h content.
// Used to seed the demo project on first launch.

export const DEMO_CONFIG_H = `/**
 * Marlin 3D Printer Firmware
 * Copyright (c) 2020 MarlinFirmware [https://github.com/MarlinFirmware/Marlin]
 *
 * Demo configuration for Centauri Carbon (SKR 1.4 Turbo + TMC2209 + BLTouch)
 */

// ==================== GENERAL ====================
#define CUSTOM_MACHINE_NAME "Centauri Carbon"
#define MACHINE_UUID "00000000-0000-0000-0000-000000000001"
#define BAUDRATE 115200

// ==================== MACHINE ====================
#define X_BED_SIZE 235
#define Y_BED_SIZE 235
#define Z_MAX_POS 250
#define X_MIN_POS 0
#define Y_MIN_POS 0
#define X_MAX_POS 220
#define Y_MAX_POS 220

// ==================== BOARD ====================
#define MOTHERBOARD BOARD_BTT_SKR_V1_4_TURBO
#define USE_CONTROLLER_FAN

// ==================== MOTION ====================
#define DEFAULT_AXIS_STEPS_PER_UNIT { 80, 80, 400, 95 }
#define DEFAULT_MAX_FEEDRATE { 300, 300, 5, 25 }
#define DEFAULT_MAX_ACCELERATION { 3000, 3000, 100, 10000 }
#define DEFAULT_ACCELERATION 1500
#define DEFAULT_TRAVEL_ACCELERATION 1500
#define JUNCTION_DEVIATION_MM 0.013
#define DEFAULT_MINIMUMFEEDRATE 0.0
#define HOMING_FEEDRATE_XY 3000
#define HOMING_FEEDRATE_Z 600

// ==================== THERMAL ====================
#define EXTRUDE_MINTEMP 170
#define HEATER_0_MAXTEMP 275
#define HEATER_BED_MAXTEMP 120
#define PREHEAT_1_TEMP_HOTEND 180
#define PREHEAT_1_TEMP_BED 60
#define TEMP_SENSOR_0 5
#define TEMP_SENSOR_BED 1
#define PIDTEMP
#define DEFAULT_Kp 22.2
#define DEFAULT_Ki 1.08
#define DEFAULT_Kd 114.0
//#define PIDTEMPBED

// ==================== EXTRUDER ====================
#define EXTRUDERS 1
//#define SINGLENOZZLE

// ==================== PROBE ====================
#define BLTOUCH
#define BLTOUCH_HS_MODE
#define NOZZLE_TO_PROBE_OFFSET { -44, -10, 0 }
#define Z_MIN_PROBE_ENDSTOP_INVERTING 0

// ==================== LEVELING ====================
#define AUTO_BED_LEVELING_BILINEAR
#define GRID_MAX_POINTS_X 5
#define GRID_MAX_POINTS_Y 5
#define Z_SAFE_HOMING
#define Z_SAFE_HOMING_X_POINT 110
#define Z_SAFE_HOMING_Y_POINT 110
//#define MESH_BED_LEVELING
//#define AUTO_BED_LEVELING_LINEAR

// ==================== DRIVERS ====================
#define X_DRIVER_TYPE TMC2209
#define Y_DRIVER_TYPE TMC2209
#define Z_DRIVER_TYPE TMC2209
#define E0_DRIVER_TYPE TMC2209
#define X_MICROSTEPS 16
#define X_CURRENT 800
#define STEALTHCHOP_XY
#define STEALTHCHOP_Z
#define STEALTHCHOP_E

// ==================== EEPROM ====================
#define EEPROM_SETTINGS
#define EEPROM_AUTO_INIT

// ==================== DISPLAY ====================
#define SDSUPPORT
#define REPRAP_DISCOUNT_SMART_CONTROLLER
//#define CR10_STOCKDISPLAY

// ==================== SAFETY ====================
#define POWER_LOSS_RECOVERY
#define THERMAL_PROTECTION_HOTENDS
#define THERMAL_PROTECTION_BED
#define USE_WATCHDOG

// ==================== ADVANCED ====================
#define LIN_ADVANCE
#define ADVANCE_K 0.06
//#define S_CURVE_ACCELERATION
`;

export const DEMO_CONFIG_ADV_H = `/**
 * Configuration_adv.h - Demo
 * Centauri Carbon
 */

// ==================== GENERAL ====================
#define BED_MAXTEMP 120
#define HOTEND_MAXTEMP 275

// ==================== MOTION ====================
#define MICROSTEP_MODES { 16, 16, 16, 16, 16 }
#define MANUAL_FEEDRATE { 50 * 60, 50 * 60, 4 * 60, 60 }

// ==================== NETWORK ====================
//#define HAS_WIRED_NETWORKING
//#define HAS_WIFI

// ==================== SAFETY ====================
#define THERMAL_PROTECTION_PERIOD 40
#define THERMAL_PROTECTION_HYSTERESIS 4

// ==================== DEBUG ====================
//#define DEBUG_LEVELING_FEATURE
#define M115_GEOMETRY_REPORT
`;

export const DEMO_PROJECT = {
  name: "Demo - Centauri Carbon",
  description: "Projet de démonstration : imprimante CoreXY Centauri Carbon, carte SKR 1.4 Turbo, drivers TMC2209, BLTouch.",
  manufacturer: "Centauri",
  model: "Centauri Carbon",
  board: "BTT SKR 1.4 Turbo",
  marlinVersion: "2.1.x",
  configVersion: "1.0.0",
  author: "Marlin Configurator NG",
  tags: ["demo", "corexy", "tmc2209", "bltouch"],
  files: {
    "Configuration.h": DEMO_CONFIG_H,
    "Configuration_adv.h": DEMO_CONFIG_ADV_H,
  },
};