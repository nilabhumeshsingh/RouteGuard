export interface Point2D {
  x: number;
  y: number;
}

export interface CorridorSegment {
  from: Point2D;
  to: Point2D;
}

function pointToSegmentDistanceSquared(p: Point2D, v: Point2D, w: Point2D): { distSq: number; projected: Point2D } {
  const l2 = Math.pow(v.x - w.x, 2) + Math.pow(v.y - w.y, 2);
  if (l2 === 0) {
    return {
      distSq: Math.pow(p.x - v.x, 2) + Math.pow(p.y - v.y, 2),
      projected: { x: v.x, y: v.y }
    };
  }

  // Consider the line extending the segment, parameterized as v + t (w - v).
  // We find projection of point p onto the line.
  // It falls where t = [(p-v) . (w-v)] / |w-v|^2
  // We clamp t from [0, 1] to handle points outside the segment.
  const t = Math.max(0, Math.min(1, ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2));
  const projected = {
    x: v.x + t * (w.x - v.x),
    y: v.y + t * (w.y - v.y)
  };

  const distSq = Math.pow(p.x - projected.x, 2) + Math.pow(p.y - projected.y, 2);
  return { distSq, projected };
}

export function snapToNearestCorridor(
  point: Point2D,
  corridors: CorridorSegment[],
  maxSnapDistance = 40
): Point2D {
  if (corridors.length === 0) return point;

  let minDistanceSq = Infinity;
  let bestPoint = point;

  for (const seg of corridors) {
    const { distSq, projected } = pointToSegmentDistanceSquared(point, seg.from, seg.to);
    if (distSq < minDistanceSq) {
      minDistanceSq = distSq;
      bestPoint = projected;
    }
  }

  if (Math.sqrt(minDistanceSq) <= maxSnapDistance) {
    return {
      x: Math.round(bestPoint.x * 10) / 10,
      y: Math.round(bestPoint.y * 10) / 10
    };
  }

  return point;
}
