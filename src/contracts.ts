// The frozen contracts (architecture.md section 10). Owner: T00. Everyone else reads.
//
// Everything here is an exported `const` number or one of two typed arrays, so the minifier inlines
// the numbers and renames the arrays. Do not add objects, enums or strings.
// Constants that shaders need are repeated in common.glsl; tests/contracts keeps the two equal.

// ---- World (section 5) ------------------------------------------------------------------------
/** Side of the wrapped tile in metres. */
export const TILE = 4096;
/** Cells per tile side. */
export const CELLS = 32;
/** Side of one cell in metres. A road runs along every multiple of CELL in x and in z. */
export const CELL = 128;
/** Every AVE-th road line is an avenue (line index % AVE === 0). */
export const AVE = 4;
/** Street: centre line to building line, and centre line to curb. */
export const ST_HALF = 10;
export const ST_ROAD = 7;
/** Avenue: centre line to building line, and centre line to curb. */
export const AV_HALF = 18;
export const AV_ROAD = 13;
/** Time wraps every LOOP seconds (section 5.3). */
export const LOOP = 4096;
/** Tempo the engine uses for the beat while audio is not running. */
export const BPM0 = 104;
/** The one city seed. */
export const SEED = 1984;

// ---- Quality (section 11.1), indexed by quality 0, 1, 2 -----------------------------------------
// Kept as separate numbers rather than tables; the engine picks with a ternary.
export const Q_DENSITY0 = 0.4;
export const Q_DENSITY1 = 0.7;
export const Q_R0_0 = 900;
export const Q_R1_0 = 1300;
export const Q_R0_1 = 1200;
export const Q_R1_1 = 1650;
export const Q_R0_2 = 1500;
export const Q_R1_2 = 1950;

// ---- City plan (section 5.5) ------------------------------------------------------------------
/** Floats per box in plan.boxes. */
export const BOX = 8;
/** Box fields. Centre x and z are tile coordinates; B_Y is the base height; B_H the height. */
export const B_X = 0;
export const B_Y = 1;
export const B_Z = 2;
/** Integer 0..4095, shared by every box of one building. */
export const B_SEED = 3;
/** Half-widths in x and z. */
export const B_HX = 4;
export const B_H = 5;
export const B_HZ = 6;
export const B_KIND = 7;

/** Box kinds: the wide base of a building; its main body; a narrower top segment; any segment of a
 *  megatower; a thin mast on top of a tall building. */
export const K_PODIUM = 0;
export const K_SHAFT = 1;
export const K_CROWN = 2;
export const K_MEGA = 3;
export const K_SPIRE = 4;

/** Districts, byte 0 of each cell in plan.cells. */
export const D_LOW = 0;
export const D_MID = 1;
export const D_HIGH = 2;
export const D_PLAZA = 3;
export const D_MEGA = 4;

// ---- Draw order (section 4.5) -----------------------------------------------------------------
export const O_GROUND = 10;
export const O_BUILD = 20;
export const O_VEHICLE = 30;
export const O_SKY = 50;
export const O_BEAM = 60;
export const O_HOLO = 70;
export const O_GLOW = 80;

// ---- The uniform block F (section 10.2): slot = offset in floats ------------------------------
export const U_VP = 0;
export const U_CAM = 16;
export const U_TIME = 20;
export const U_RES = 24;
export const U_FADE = 28;
export const U_RIGHT = 32;
export const U_UP = 36;
export const U_FWD = 40;
export const U_SUN = 44;
export const U_MIX = 48;
export const U_MOOD = 52;
export const U_X0 = 56;
export const U_X1 = 60;

/** CPU mirror of the uniform block. The engine uploads it before each pass. */
export const F = new Float32Array(64);

// ---- The camera pose P (section 10.3) ---------------------------------------------------------
/** Position in metres. x and z may be any value; the engine wraps them into the tile. */
export const P_X = 0;
export const P_Y = 1;
export const P_Z = 2;
/** Radians. Yaw 0 looks along -z, positive yaw turns left. Positive pitch looks up. */
export const P_YAW = 3;
export const P_PITCH = 4;
export const P_ROLL = 5;
/** Vertical field of view in radians. */
export const P_FOV = 6;

/** The camera pose. Whoever drives the camera writes it each frame; the engine reads it. */
export const P = new Float32Array(8);
