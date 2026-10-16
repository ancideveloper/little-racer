// Where every landmark and building stands, expressed relative to the road (arc position s, side, offset).
// Terrain pads and scenery exclusion zones are derived from this list so everything fits together.

const P = {};

/** side: +1 = right of travel, -1 = left. Returns world position and a yaw that makes local +Z face the road. */
export function placeAt(route, s, side, off) {
  route.at(s, P);
  const x = P.x + P.rx * side * off, z = P.z + P.rz * side * off;
  const fx = -side * P.rx, fz = -side * P.rz;           // direction from building toward the road
  return { x, y: P.y, z, yaw: Math.atan2(fx, fz), tx: P.tx, tz: P.tz, s, side, off };
}

export function buildLayout(route) {
  const m = route.marks;
  const items = [];
  const put = (id, s, side, off, w, d, extra = {}) => {
    const p = placeAt(route, s, side, off);
    items.push({ id, ...p, w, d, radius: Math.hypot(w, d) / 2 + 2, ...extra });
  };

  // --- town entrance ---
  put('entranceSign', 26, 1, 17, 18, 6, { kind: 'landmark' });

  // --- main street, left (north) side ---
  put('souvenirs', 52, -1, 15, 11, 9);
  put('diner', 88, -1, 24, 26, 15, { kind: 'landmark' });
  put('paintShop', 130, -1, 22, 24, 17, { kind: 'landmark' });
  put('postOffice', 164, -1, 15, 12, 10);
  put('barber', 190, -1, 15, 10, 9);
  put('bakery', 215, -1, 15, 11, 9);
  put('rockCafe', 244, -1, 16, 13, 10);
  // --- main street, right (south) side ---
  put('iceCream', 52, 1, 15, 9, 9);
  put('tireShop', 90, 1, 22, 24, 16, { kind: 'landmark' });
  put('fuelStation', 126, 1, 18, 18, 14);
  put('generalStore', 158, 1, 15, 14, 10);
  put('hardware', 186, 1, 15, 12, 10);
  put('townHall', 218, 1, 17, 14, 12);
  put('nursery', 248, 1, 16, 14, 10);

  // --- beyond the main street ---
  put('towYard', m.yard + 2, -1, 30, 30, 22, { kind: 'landmark' });
  put('coneMotel', m.motel + 6, 1, 28, 38, 22, { kind: 'landmark' });

  return items;
}

/** Terrain pads: flat circular areas under buildings. */
export function layoutPads(items) {
  return items.map((it) => ({ x: it.x, z: it.z, r0: it.radius * 0.9, r1: it.radius * 0.9 + 9, y: it.y - 0.04 }));
}

/** Circular exclusion zones for scenery. */
export function layoutZones(items) {
  return items.map((it) => ({ x: it.x, z: it.z, r: it.radius + 3 }));
}
