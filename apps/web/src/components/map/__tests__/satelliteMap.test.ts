import { describe, it, expect } from "vitest";
import {
  BUILDING_CORNERS_GEO,
  BUILDING_ANCHOR,
  indoorToLatLng
} from "../GoogleMapAdapter";
import {
  BUILDING_CORNERS_GEO as EXPORTED_CORNERS,
  BUILDING_ANCHOR as EXPORTED_ANCHOR,
  indoorToLatLng as exportedIndoorToLatLng
} from "../../SatelliteMapView";

describe("MUJ AB3 Satellite Building Footprint & Anchor Mapping", () => {
  it("defines the exact real-world Google Maps corners for AB3", () => {
    expect(BUILDING_CORNERS_GEO).toHaveLength(4);
    // NW
    expect(BUILDING_CORNERS_GEO[0]).toEqual([26.84492, 75.56474]);
    // NE
    expect(BUILDING_CORNERS_GEO[1]).toEqual([26.84382, 75.56522]);
    // SE
    expect(BUILDING_CORNERS_GEO[2]).toEqual([26.84366, 75.56478]);
    // SW
    expect(BUILDING_CORNERS_GEO[3]).toEqual([26.84476, 75.56427]);

    // Same via SatelliteMapView re-export
    expect(EXPORTED_CORNERS).toEqual(BUILDING_CORNERS_GEO);
  });

  it("calculates the geographic centroid as the building center anchor", () => {
    const expectedLat = (26.84492 + 26.84382 + 26.84366 + 26.84476) / 4;
    const expectedLng = (75.56474 + 75.56522 + 75.56478 + 75.56427) / 4;

    expect(BUILDING_ANCHOR.lat).toBeCloseTo(expectedLat, 5);
    expect(BUILDING_ANCHOR.lng).toBeCloseTo(expectedLng, 5);
    expect(EXPORTED_ANCHOR).toEqual(BUILDING_ANCHOR);
  });

  it("maps local origin (0, 0) precisely to BUILDING_ANCHOR centroid", () => {
    const originCoords = indoorToLatLng(0, 0);
    expect(originCoords.lat).toBeCloseTo(BUILDING_ANCHOR.lat, 5);
    expect(originCoords.lng).toBeCloseTo(BUILDING_ANCHOR.lng, 5);

    const reExportCoords = exportedIndoorToLatLng(0, 0);
    expect(reExportCoords.lat).toBeCloseTo(originCoords.lat, 5);
    expect(reExportCoords.lng).toBeCloseTo(originCoords.lng, 5);
  });

  it("ensures floorplan room coordinates fall strictly inside the building bounding box", () => {
    // Room 204 in floorplan coordinates (x = 472.5, y = 193.75)
    const pos204 = indoorToLatLng(472.5, 193.75);

    const minLat = Math.min(...BUILDING_CORNERS_GEO.map((c) => c[0]));
    const maxLat = Math.max(...BUILDING_CORNERS_GEO.map((c) => c[0]));
    const minLng = Math.min(...BUILDING_CORNERS_GEO.map((c) => c[1]));
    const maxLng = Math.max(...BUILDING_CORNERS_GEO.map((c) => c[1]));

    expect(pos204.lat).toBeGreaterThanOrEqual(minLat);
    expect(pos204.lat).toBeLessThanOrEqual(maxLat);
    expect(pos204.lng).toBeGreaterThanOrEqual(minLng);
    expect(pos204.lng).toBeLessThanOrEqual(maxLng);
  });
});
