import React from "react";
import {
  GoogleMapAdapter,
  BUILDING_CORNERS_GEO,
  BUILDING_ANCHOR,
  indoorToLatLng,
  GoogleMapAdapterProps,
  GoogleMapAdapterRef
} from "./map/GoogleMapAdapter";

// Real MUJ AB3 building corners — from Google Maps (NW, NE, SE, SW order)
export { BUILDING_CORNERS_GEO, BUILDING_ANCHOR, indoorToLatLng };

export type SatelliteMapViewProps = GoogleMapAdapterProps;
export type SatelliteMapViewRef = GoogleMapAdapterRef;

export const SatelliteMapView = GoogleMapAdapter;
export default GoogleMapAdapter;
