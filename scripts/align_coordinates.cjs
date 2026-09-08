const fs = require('fs');
const path = require('path');

const ROOM_MAP = {
  "AB1 Room 204": { x3d: 1.75, z3d: 7.25, label: "Room 204", roomId: "204", xSvg: 506.25, ySvg: 135 },
  "room 219": { x3d: -7.25, z3d: -7.25, label: "Room 219", roomId: "219", xSvg: 371.25, ySvg: 351.25 },
  "219a": { x3d: -8.0, z3d: -7.25, label: "Room 219", roomId: "219", xSvg: 360, ySvg: 351.25 },
  "219c": { x3d: -6.5, z3d: -7.25, label: "Room 219", roomId: "219", xSvg: 380, ySvg: 351.25 },
  "BETWEEN 211-210": { x3d: -7.5, z3d: 0.0, label: "Corridor (211-210)", roomId: "c-211-210", xSvg: 400, ySvg: 242.5 },
  "BETWEEN 210-212": { x3d: 0.0, z3d: 0.0, label: "Corridor (210-212)", roomId: "c-210-212", xSvg: 480, ySvg: 242.5 },
  "BETWEEN 212-209": { x3d: 6.5, z3d: 0.0, label: "Corridor (212-209)", roomId: "c-212-209", xSvg: 580, ySvg: 242.5 },
  "218": { x3d: -2.75, z3d: -7.25, label: "Room 218", roomId: "218", xSvg: 438.75, ySvg: 351.25 },
  "217": { x3d: 1.75, z3d: -7.25, label: "Room 217", roomId: "217", xSvg: 506.25, ySvg: 351.25 },
  "ELEVATOR - STAIRCASE AREA": { x3d: 5.75, z3d: -7.25, label: "Elevator & Stairs", roomId: "stair-sm", xSvg: 550, ySvg: 351.25 },
  "215": { x3d: 14.25, z3d: -7.25, label: "Room 215", roomId: "215", xSvg: 696.25, ySvg: 351.25 },
  "214": { x3d: 18.75, z3d: -7.25, label: "Room 214", roomId: "214", xSvg: 763.75, ySvg: 351.25 },
  "WASHROOM NEAR 214": { x3d: 22.5, z3d: -7.25, label: "Male Washroom (SE)", roomId: "wash-se", xSvg: 815, ySvg: 351.25 },
  "HALL NEAR 208 CORNER": { x3d: 22.5, z3d: 0.0, label: "Corridor (East Wing)", roomId: "c-east", xSvg: 815, ySvg: 242.5 },
  "GIRL WASHROOM IN FRONT OF 208": { x3d: 22.5, z3d: 7.25, label: "Female Washroom (NE)", roomId: "wash-ne", xSvg: 815, ySvg: 135 },
  "207": { x3d: 18.75, z3d: 7.25, label: "Room 207", roomId: "207", xSvg: 763.75, ySvg: 135 },
  "208": { x3d: 20.5, z3d: 0.0, label: "Room 208", roomId: "208", xSvg: 780, ySvg: 242.5 },
  "206": { x3d: 14.25, z3d: 7.25, label: "Room 206", roomId: "206", xSvg: 696.25, ySvg: 135 },
  "209": { x3d: 8.5, z3d: 0.0, label: "Room 209", roomId: "209", xSvg: 610, ySvg: 242.5 },
  "210": { x3d: -3.5, z3d: 0.0, label: "Room 210", roomId: "210", xSvg: 440, ySvg: 242.5 },
  "201": { x3d: -11.75, z3d: 7.25, label: "Room 201", roomId: "201", xSvg: 303.75, ySvg: 135 },
  "BOYS WASHROOM NEAR 201": { x3d: -15.75, z3d: 7.25, label: "Male Washroom (NW)", roomId: "wash-nw", xSvg: 240, ySvg: 135 },
  "IN FRONT OF BALCONY": { x3d: -21.0, z3d: 0.0, label: "Balcony Entrance", roomId: "c-west", xSvg: 160, ySvg: 242.5 },
  "IN CIRCULAR BALCONY": { x3d: -24.0, z3d: 0.0, label: "Circular Balcony", roomId: "balcony", xSvg: 120, ySvg: 242.5 },
  "GIRLS WASHROOM IN FRONT OF 211": { x3d: -15.75, z3d: -7.25, label: "Female Washroom (SW)", roomId: "wash-sw", xSvg: 240, ySvg: 351.25 },
  "211": { x3d: -11.5, z3d: 0.0, label: "Room 211", roomId: "211", xSvg: 340, ySvg: 242.5 },
  "220": { x3d: -11.75, z3d: -7.25, label: "Room 220", roomId: "220", xSvg: 303.75, ySvg: 351.25 },
  "212": { x3d: 4.5, z3d: 0.0, label: "Room 212", roomId: "212", xSvg: 540, ySvg: 242.5 }
};

const jsonPath = path.resolve(__dirname, '../apps/api/src/data/sample/floor2-fingerprints.json');
const tsPath = path.resolve(__dirname, '../api/position/fingerprints.ts');

const raw = fs.readFileSync(jsonPath, 'utf8');
const originalFps = JSON.parse(raw);

const aligned = originalFps.map(fp => {
  const loc = fp.location;
  const meta = ROOM_MAP[loc] || {
    x3d: (fp.x - 480) / 15,
    z3d: (242.5 - fp.y) / 15,
    label: loc,
    roomId: loc.replace(/^(ab1\s*|room\s*)/i, '').toLowerCase(),
    xSvg: fp.x,
    ySvg: fp.y
  };

  return {
    ...fp,
    label: meta.label,
    roomId: meta.roomId,
    x: meta.x3d,
    y: meta.z3d,
    x3d: meta.x3d,
    z3d: meta.z3d,
    xSvg: meta.xSvg !== undefined ? meta.xSvg : fp.x,
    ySvg: meta.ySvg !== undefined ? meta.ySvg : fp.y
  };
});

fs.writeFileSync(jsonPath, JSON.stringify(aligned, null, 2), 'utf8');
console.log('✓ Updated apps/api/src/data/sample/floor2-fingerprints.json with true 3D coordinates');

const tsContent = `export const fingerprints = ${JSON.stringify(aligned, null, 2)};\n`;
fs.writeFileSync(tsPath, tsContent, 'utf8');
console.log('✓ Updated api/position/fingerprints.ts with true 3D coordinates');
