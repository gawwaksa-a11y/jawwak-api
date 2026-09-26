const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';

/// ترميز إحداثيات إلى geohash بدقّة محددة (افتراضياً 6 خانات ≈ ~1.2 كم).
/// يُستخدم لتكوين مفتاح كاش موحّد للمناطق المتقاربة.
export function encodeGeohash(
  lat: number,
  lng: number,
  precision = 6,
): string {
  let latMin = -90;
  let latMax = 90;
  let lngMin = -180;
  let lngMax = 180;

  let hash = '';
  let bit = 0;
  let ch = 0;
  let even = true;

  while (hash.length < precision) {
    if (even) {
      const mid = (lngMin + lngMax) / 2;
      if (lng >= mid) {
        ch |= 1 << (4 - bit);
        lngMin = mid;
      } else {
        lngMax = mid;
      }
    } else {
      const mid = (latMin + latMax) / 2;
      if (lat >= mid) {
        ch |= 1 << (4 - bit);
        latMin = mid;
      } else {
        latMax = mid;
      }
    }

    even = !even;
    if (bit < 4) {
      bit++;
    } else {
      hash += BASE32[ch];
      bit = 0;
      ch = 0;
    }
  }

  return hash;
}
