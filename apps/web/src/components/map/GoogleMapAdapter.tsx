import React, { useEffect, useRef, useState, forwardRef, useImperativeHandle } from "react";
import { FloorId, UserPositionState, GuardianState } from "../../types";
import { HazardOverlay, RoutePoint, RouteResult } from "@routeguard/shared";
import { ARCHITECTURAL_ROOMS, ArchitecturalRoom } from "../../data/floor2Data";

// Google Maps API Key with fallback to provided production key
const GOOGLE_MAPS_API_KEY: string =
  ((import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY as string) ||
  "AIzaSyCncccRP4QMuK4Fjm4APryWE497RjFOS40";

// Real MUJ AB3 building corners — from Google Maps (NW, NE, SE, SW order)
export const BUILDING_CORNERS_GEO: [number, number][] = [
  [26.84492, 75.56474],  // NW corner
  [26.84382, 75.56522],  // NE corner
  [26.84366, 75.56478],  // SE corner
  [26.84476, 75.56427]   // SW corner
];

// Geographic centroid = building center (local origin 0,0 in floorplan)
export const BUILDING_ANCHOR = {
  lat: (26.84492 + 26.84382 + 26.84366 + 26.84476) / 4,  // 26.84429
  lng: (75.56474 + 75.56522 + 75.56478 + 75.56427) / 4   // 75.56500
};

export const MUJ_AB3_CENTER = BUILDING_ANCHOR;
export const MUJ_AB1_CENTER = BUILDING_ANCHOR;

/**
 * Converts local SVG floor plan coordinates or local meters (x, y) into GPS Lat/Lng on AB3.
 * The anchor (local origin 0,0 = building center) maps to the geographic centroid of the 4 corners.
 */
export function indoorToLatLng(x: number, y: number): { lat: number; lng: number } {
  const nw = BUILDING_CORNERS_GEO[0];
  const ne = BUILDING_CORNERS_GEO[1];
  const se = BUILDING_CORNERS_GEO[2];
  const sw = BUILDING_CORNERS_GEO[3];

  let t_x: number;
  let t_y: number;

  if (Math.abs(x) <= 80 && Math.abs(y) <= 80) {
    // Local coordinates in meters relative to building center (0,0)
    t_x = 0.5 + x / 130;
    t_y = 0.5 + y / 50;
  } else {
    // SVG floorplan coordinates (0..850, 0..650)
    t_x = x / 850;
    t_y = y / 650;
  }

  const clampedX = Math.max(0, Math.min(1, t_x));
  const clampedY = Math.max(0, Math.min(1, t_y));

  // Bilinear interpolation across real-world building polygon
  const lat =
    (1 - clampedX) * (1 - clampedY) * nw[0] +
    clampedX * (1 - clampedY) * ne[0] +
    clampedX * clampedY * se[0] +
    (1 - clampedX) * clampedY * sw[0];

  const lng =
    (1 - clampedX) * (1 - clampedY) * nw[1] +
    clampedX * (1 - clampedY) * ne[1] +
    clampedX * clampedY * se[1] +
    (1 - clampedX) * clampedY * sw[1];

  return { lat, lng };
}

export interface GoogleMapAdapterProps {
  currentFloor: FloorId;
  userPosition: UserPositionState;
  routePoints?: RoutePoint[] | null;
  activeRoute?: RouteResult | null;
  isEmergencyRoute?: boolean;
  isNightSafety?: boolean;
  isTrafficActive?: boolean;
  mapType?: "satellite" | "hybrid" | "roadmap";
  onToggleMapType?: (type: "satellite" | "hybrid" | "roadmap") => void;
  onToggleTraffic?: (active: boolean) => void;
  hazardOverlays?: HazardOverlay[];
  guardianState?: GuardianState | null;
  onSelectRoom?: (room: ArchitecturalRoom) => void;
  onSelectNode?: (nodeId: string, label: string) => void;
  onSwitchViewMode?: (mode: "3D" | "2D" | "Google") => void;
}

export interface GoogleMapAdapterRef {
  zoomIn: () => void;
  zoomOut: () => void;
  resetView: () => void;
  focusRoom: (roomId: string) => void;
}

export const GoogleMapAdapter = forwardRef<GoogleMapAdapterRef, GoogleMapAdapterProps>(
  (
    {
      currentFloor,
      userPosition,
      routePoints,
      activeRoute,
      isEmergencyRoute,
      isNightSafety = false,
      isTrafficActive = true,
      mapType: externalMapType,
      onToggleMapType,
      onToggleTraffic,
      hazardOverlays = [],
      guardianState,
      onSelectRoom,
      onSelectNode,
      onSwitchViewMode
    },
    ref
  ) => {
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapInstanceRef = useRef<any>(null);
    const [isLoaded, setIsLoaded] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [internalMapType, setInternalMapType] = useState<"satellite" | "hybrid" | "roadmap">("satellite");

    // Effective mapType
    const currentMapType = externalMapType || internalMapType;

    const setMapType = (type: "satellite" | "hybrid" | "roadmap") => {
      setInternalMapType(type);
      onToggleMapType?.(type);
    };

    const toggleSatelliteDefault = () => {
      const nextType = currentMapType === "satellite" || currentMapType === "hybrid" ? "roadmap" : "satellite";
      setMapType(nextType);
    };

    // Dynamic objects on map
    const userMarkerRef = useRef<any>(null);
    const userCircleRef = useRef<any>(null);
    const childMarkerRef = useRef<any>(null);
    const routePolylineRef = useRef<any>(null);
    const routeGlowLineRef = useRef<any>(null);
    const routeDestinationMarkerRef = useRef<any>(null);
    const roomMarkersRef = useRef<any[]>([]);
    const hazardMarkersRef = useRef<any[]>([]);
    const exitMarkersRef = useRef<any[]>([]);
    const safetyMarkersRef = useRef<any[]>([]);
    const trafficLayerRef = useRef<any>(null);
    const infoWindowRef = useRef<any>(null);

    // Expose methods to parent container
    useImperativeHandle(ref, () => ({
      zoomIn: () => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.setZoom((mapInstanceRef.current.getZoom() || 19) + 1);
        }
      },
      zoomOut: () => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.setZoom((mapInstanceRef.current.getZoom() || 19) - 1);
        }
      },
      resetView: () => {
        if (mapInstanceRef.current) {
          const userLatLng = indoorToLatLng(userPosition.x, userPosition.y);
          mapInstanceRef.current.panTo(userLatLng);
          mapInstanceRef.current.setZoom(19);
        }
      },
      focusRoom: (roomId: string) => {
        const room = ARCHITECTURAL_ROOMS.find((r) => r.id === roomId || r.code === roomId);
        if (room && mapInstanceRef.current) {
          const roomLatLng = indoorToLatLng(
            room.bounds.x + room.bounds.width / 2,
            room.bounds.y + room.bounds.height / 2
          );
          mapInstanceRef.current.panTo(roomLatLng);
          mapInstanceRef.current.setZoom(20);
        }
      }
    }));

    // 1. Dynamically Load Google Maps JS API
    useEffect(() => {
      if ((window as any).google && (window as any).google.maps) {
        setIsLoaded(true);
        return;
      }

      const existingScript = document.getElementById("routeguard-gmaps-script");
      if (existingScript) {
        existingScript.addEventListener("load", () => setIsLoaded(true));
        return;
      }

      const script = document.createElement("script");
      script.id = "routeguard-gmaps-script";
      script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=geometry`;
      script.async = true;
      script.defer = true;

      script.onload = () => {
        setIsLoaded(true);
      };

      script.onerror = (e) => {
        console.error("Failed to load Google Maps script", e);
        setLoadError("Google Maps script failed to load. Check API key and internet connectivity.");
      };

      document.head.appendChild(script);
    }, []);

    // 2. Initialize Google Map Instance
    useEffect(() => {
      if (!isLoaded || !mapContainerRef.current || mapInstanceRef.current) return;

      try {
        const google = (window as any).google;
        const initialCenter = indoorToLatLng(userPosition.x, userPosition.y);

        const map = new google.maps.Map(mapContainerRef.current, {
          center: initialCenter,
          zoom: 19,
          mapTypeId: currentMapType,
          tilt: 45,
          heading: 0,
          fullscreenControl: false,
          streetViewControl: false,
          mapTypeControl: false,
          zoomControl: false,
          styles: [
            {
              featureType: "poi",
              elementType: "labels",
              stylers: [{ visibility: "off" }]
            }
          ]
        });

        mapInstanceRef.current = map;
        infoWindowRef.current = new google.maps.InfoWindow();

        // Academic Block 3 Boundary Polygon (from real-world Google Maps coordinates)
        const campusPolygonCoords = BUILDING_CORNERS_GEO.map(([lat, lng]) => ({ lat, lng }));

        new google.maps.Polygon({
          paths: campusPolygonCoords,
          strokeColor: "#1A73E8",
          strokeOpacity: 0.9,
          strokeWeight: 2.5,
          fillColor: "#1A73E8",
          fillOpacity: 0.15,
          map: map
        });

        // Add Exit Stairwell Markers
        const exits = [
          {
            name: "Stairs & Fire Exit Ramp SW",
            x: 200,
            y: 490,
            desc: "Primary emergency stairs to outdoor courtyard"
          },
          {
            name: "Stairs & Fire Exit NE",
            x: 820,
            y: 80,
            desc: "Secondary emergency exit stairs"
          }
        ];

        exitMarkersRef.current = exits.map((exit) => {
          const pos = indoorToLatLng(exit.x, exit.y);
          const marker = new google.maps.Marker({
            position: pos,
            map: map,
            title: exit.name,
            icon: {
              path: google.maps.SymbolPath.CIRCLE,
              scale: 8,
              fillColor: "#34C759",
              fillOpacity: 1,
              strokeColor: "#FFFFFF",
              strokeWeight: 2
            }
          });

          marker.addListener("click", () => {
            infoWindowRef.current.setContent(`
              <div style="padding: 6px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                <div style="font-weight: 700; color: #1e7e34; font-size: 13px; display: flex; items-center; gap: 4px;">
                  🟢 ${exit.name}
                </div>
                <div style="font-size: 11px; color: #555; margin-top: 2px;">${exit.desc}</div>
                <div style="margin-top: 6px; font-size: 10px; background: #e8f5e9; color: #2e7d32; padding: 2px 6px; border-radius: 4px; display: inline-block;">
                  SAFE EVACUATION ZONE
                </div>
              </div>
            `);
            infoWindowRef.current.open(map, marker);
          });

          return marker;
        });

        // Render Room Entrance Markers
        roomMarkersRef.current = ARCHITECTURAL_ROOMS.map((room) => {
          const centerPos = indoorToLatLng(
            room.bounds.x + room.bounds.width / 2,
            room.bounds.y + room.bounds.height / 2
          );
          const marker = new google.maps.Marker({
            position: centerPos,
            map: map,
            title: `${room.code} - ${room.name}`,
            label: {
              text: room.code,
              color: "#FFFFFF",
              fontSize: "9px",
              fontWeight: "bold"
            },
            icon: {
              path: google.maps.SymbolPath.CIRCLE,
              scale: 12,
              fillColor: room.category === "lab" ? "#0066CC" : room.category === "restroom" ? "#5856D6" : "#202124",
              fillOpacity: 0.85,
              strokeColor: "#FFFFFF",
              strokeWeight: 1.5
            }
          });

          marker.addListener("click", () => {
            infoWindowRef.current.setContent(`
              <div style="padding: 8px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; min-width: 160px;">
                <div style="font-weight: 700; color: #202124; font-size: 14px;">Room ${room.code}</div>
                <div style="font-size: 12px; color: #5F6368; margin-top: 2px;">${room.name}</div>
                <div style="font-size: 11px; color: #70757a; margin-top: 2px;">${room.wing}</div>
                <button id="btn-nav-${room.id}" style="margin-top: 8px; width: 100%; background: #1A73E8; color: white; border: none; border-radius: 6px; padding: 4px 8px; font-size: 11px; font-weight: 600; cursor: pointer;">
                  Navigate Here
                </button>
              </div>
            `);
            infoWindowRef.current.open(map, marker);

            setTimeout(() => {
              const btn = document.getElementById(`btn-nav-${room.id}`);
              if (btn) {
                btn.onclick = () => {
                  onSelectRoom?.(room);
                  onSelectNode?.(room.nodeId, room.name);
                  infoWindowRef.current.close();
                };
              }
            }, 50);
          });

          return marker;
        });
      } catch (err: any) {
        console.error("Error initializing Google Map:", err);
        setLoadError(err?.message || "Failed to initialize Google Maps.");
      }
    }, [isLoaded]);

    // 3. Switch Map Type
    useEffect(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.setMapTypeId(currentMapType);
      }
    }, [currentMapType]);

    // 4. Live Traffic API Layer Integration
    useEffect(() => {
      if (!isLoaded || !mapInstanceRef.current) return;
      const google = (window as any).google;
      if (!google?.maps) return;

      try {
        if (isTrafficActive) {
          if (!trafficLayerRef.current) {
            trafficLayerRef.current = new google.maps.TrafficLayer();
          }
          trafficLayerRef.current.setMap(mapInstanceRef.current);
        } else {
          if (trafficLayerRef.current) {
            trafficLayerRef.current.setMap(null);
          }
        }
      } catch (e) {
        console.warn("Could not toggle traffic layer", e);
      }
    }, [isLoaded, isTrafficActive]);

    // 5. Update Live User Marker & Accuracy Circle
    useEffect(() => {
      if (!isLoaded || !mapInstanceRef.current) return;
      const google = (window as any).google;
      const userLatLng = indoorToLatLng(userPosition.x, userPosition.y);

      if (!userMarkerRef.current) {
        userMarkerRef.current = new google.maps.Marker({
          position: userLatLng,
          map: mapInstanceRef.current,
          title: `You are near ${userPosition.nearestPlaceName}`,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 8,
            fillColor: "#0033cc",
            fillOpacity: 1,
            strokeColor: "#FFFFFF",
            strokeWeight: 2.5
          },
          zIndex: 999
        });
      } else {
        userMarkerRef.current.setPosition(userLatLng);
        userMarkerRef.current.setTitle(`You are near ${userPosition.nearestPlaceName}`);
      }

      if (!userCircleRef.current) {
        userCircleRef.current = new google.maps.Circle({
          strokeColor: "#0033cc",
          strokeOpacity: 0.8,
          strokeWeight: 2,
          fillColor: "#002299",
          fillOpacity: 0.25,
          map: mapInstanceRef.current,
          center: userLatLng,
          radius: Math.max(4, userPosition.uncertaintyRadius || 5)
        });
      } else {
        userCircleRef.current.setCenter(userLatLng);
        userCircleRef.current.setRadius(Math.max(4, userPosition.uncertaintyRadius || 5));
      }

      // Guardian Child Marker (if paired)
      if (guardianState?.isPaired && guardianState.childPosition) {
        const childLatLng = indoorToLatLng(guardianState.childPosition.x, guardianState.childPosition.y);
        if (!childMarkerRef.current) {
          childMarkerRef.current = new google.maps.Marker({
            position: childLatLng,
            map: mapInstanceRef.current,
            title: `Child: ${guardianState.childName}`,
            icon: {
              path: google.maps.SymbolPath.CIRCLE,
              scale: 8,
              fillColor: "#FF9500",
              fillOpacity: 1,
              strokeColor: "#FFFFFF",
              strokeWeight: 2
            },
            zIndex: 998
          });
        } else {
          childMarkerRef.current.setPosition(childLatLng);
        }
      } else if (childMarkerRef.current) {
        childMarkerRef.current.setMap(null);
        childMarkerRef.current = null;
      }
    }, [isLoaded, userPosition, guardianState]);

    // 6. Update Navigation / Emergency / Night Safety Polyline
    useEffect(() => {
      if (!isLoaded || !mapInstanceRef.current) return;
      const google = (window as any).google;

      // Clean up previous polylines & markers
      if (routePolylineRef.current) {
        routePolylineRef.current.setMap(null);
        routePolylineRef.current = null;
      }
      if (routeGlowLineRef.current) {
        routeGlowLineRef.current.setMap(null);
        routeGlowLineRef.current = null;
      }
      if (routeDestinationMarkerRef.current) {
        routeDestinationMarkerRef.current.setMap(null);
        routeDestinationMarkerRef.current = null;
      }

      const points: Array<{ x: number; y: number }> =
        routePoints || activeRoute?.pathPoints || [];

      if (points.length >= 2) {
        const pathCoords = points.map((p) => indoorToLatLng(p.x, p.y));

        if (isEmergencyRoute) {
          // Glow layer for emergency route
          routeGlowLineRef.current = new google.maps.Polyline({
            path: pathCoords,
            geodesic: true,
            strokeColor: "#00ff66",
            strokeOpacity: 0.55,
            strokeWeight: 14,
            map: mapInstanceRef.current,
            zIndex: 100
          });

          // Primary emergency route line
          routePolylineRef.current = new google.maps.Polyline({
            path: pathCoords,
            geodesic: true,
            strokeColor: "#00e676",
            strokeOpacity: 1.0,
            strokeWeight: 6,
            map: mapInstanceRef.current,
            zIndex: 101
          });

          // Destination Beacon Marker for Ground Floor Fire Exit
          const lastPoint = pathCoords[pathCoords.length - 1];
          routeDestinationMarkerRef.current = new google.maps.Marker({
            position: lastPoint,
            map: mapInstanceRef.current,
            title: "Ground Floor Fire Exit (Safe Assembly Area)",
            zIndex: 105,
            icon: {
              path: google.maps.SymbolPath.CIRCLE,
              scale: 14,
              fillColor: "#00E676",
              fillOpacity: 1,
              strokeColor: "#FFFFFF",
              strokeWeight: 3
            },
            label: {
              text: "🏃",
              fontSize: "13px"
            }
          });

          routeDestinationMarkerRef.current.addListener("click", () => {
            infoWindowRef.current.setContent(`
              <div style="padding: 8px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                <div style="font-weight: 800; color: #00c853; font-size: 14px;">🏃 GROUND FLOOR FIRE EXIT</div>
                <div style="font-size: 12px; color: #333; margin-top: 4px; font-weight: 600;">Descend via stairs to Level 0 Exterior</div>
                <div style="margin-top: 6px; font-size: 11px; background: #e8f5e9; color: #1b5e20; padding: 4px 8px; border-radius: 4px; display: inline-block;">
                  ✅ Exterior Safe Assembly Area
                </div>
              </div>
            `);
            infoWindowRef.current.open(mapInstanceRef.current, routeDestinationMarkerRef.current);
          });
        } else if (isNightSafety) {
          // Night Safety / High Footfall Route line (Sapphire / Cyan Glow)
          routeGlowLineRef.current = new google.maps.Polyline({
            path: pathCoords,
            geodesic: true,
            strokeColor: "#00B4D8",
            strokeOpacity: 0.45,
            strokeWeight: 10,
            map: mapInstanceRef.current,
            zIndex: 100
          });

          routePolylineRef.current = new google.maps.Polyline({
            path: pathCoords,
            geodesic: true,
            strokeColor: "#0077B6",
            strokeOpacity: 1.0,
            strokeWeight: 5,
            map: mapInstanceRef.current,
            zIndex: 101
          });
        } else {
          // Standard Google Navigation line
          routePolylineRef.current = new google.maps.Polyline({
            path: pathCoords,
            geodesic: true,
            strokeColor: "#1A73E8",
            strokeOpacity: 0.9,
            strokeWeight: 5,
            map: mapInstanceRef.current,
            zIndex: 100
          });
        }
      }
    }, [isLoaded, routePoints, activeRoute, isEmergencyRoute, isNightSafety]);

    // 7. Night Safety Markers & High-Footfall Corridors
    useEffect(() => {
      if (!isLoaded || !mapInstanceRef.current) return;
      const google = (window as any).google;

      // Clean up previous safety markers
      safetyMarkersRef.current.forEach((m) => m.setMap(null));
      safetyMarkersRef.current = [];

      if (isNightSafety) {
        // 1. 🟢 GREEN ZONE: High-Footfall Central Concourse & Monitored Security Zone (85%+ Footfall)
        const greenConcourseCoords = [
          indoorToLatLng(430, 160),
          indoorToLatLng(650, 160),
          indoorToLatLng(650, 330),
          indoorToLatLng(430, 330)
        ];
        const greenPolygon = new google.maps.Polygon({
          paths: greenConcourseCoords,
          strokeColor: "#16A34A",
          strokeOpacity: 0.9,
          strokeWeight: 2.5,
          fillColor: "#22C55E",
          fillOpacity: 0.30,
          map: mapInstanceRef.current,
          zIndex: 60
        });

        // 2. 🟠 ORANGE ZONES: Moderate Footfall Academic Wings (50%-80% Footfall)
        const orangeMidNorthCoords = [
          indoorToLatLng(270, 80),
          indoorToLatLng(430, 80),
          indoorToLatLng(430, 205),
          indoorToLatLng(270, 205)
        ];
        const orangeNorthPolygon = new google.maps.Polygon({
          paths: orangeMidNorthCoords,
          strokeColor: "#EA580C",
          strokeOpacity: 0.85,
          strokeWeight: 1.5,
          fillColor: "#F97316",
          fillOpacity: 0.25,
          map: mapInstanceRef.current,
          zIndex: 55
        });

        const orangeMidSouthCoords = [
          indoorToLatLng(270, 280),
          indoorToLatLng(430, 280),
          indoorToLatLng(430, 405),
          indoorToLatLng(270, 405)
        ];
        const orangeSouthPolygon = new google.maps.Polygon({
          paths: orangeMidSouthCoords,
          strokeColor: "#EA580C",
          strokeOpacity: 0.85,
          strokeWeight: 1.5,
          fillColor: "#F97316",
          fillOpacity: 0.25,
          map: mapInstanceRef.current,
          zIndex: 55
        });

        const orangeMidEastCoords = [
          indoorToLatLng(650, 80),
          indoorToLatLng(780, 80),
          indoorToLatLng(780, 405),
          indoorToLatLng(650, 405)
        ];
        const orangeEastPolygon = new google.maps.Polygon({
          paths: orangeMidEastCoords,
          strokeColor: "#EA580C",
          strokeOpacity: 0.85,
          strokeWeight: 1.5,
          fillColor: "#F97316",
          fillOpacity: 0.25,
          map: mapInstanceRef.current,
          zIndex: 55
        });

        // 3. 🔴 LIGHTER RED ZONES: Low Footfall Peripheral Wings & Restrooms (20%-45% Footfall)
        const redWestWingCoords = [
          indoorToLatLng(165, 80),
          indoorToLatLng(270, 80),
          indoorToLatLng(270, 405),
          indoorToLatLng(165, 405)
        ];
        const redWestPolygon = new google.maps.Polygon({
          paths: redWestWingCoords,
          strokeColor: "#DC2626",
          strokeOpacity: 0.85,
          strokeWeight: 1.5,
          fillColor: "#EF4444",
          fillOpacity: 0.28,
          map: mapInstanceRef.current,
          zIndex: 50
        });

        const redEastWingCoords = [
          indoorToLatLng(780, 80),
          indoorToLatLng(885, 80),
          indoorToLatLng(885, 405),
          indoorToLatLng(780, 405)
        ];
        const redEastPolygon = new google.maps.Polygon({
          paths: redEastWingCoords,
          strokeColor: "#DC2626",
          strokeOpacity: 0.85,
          strokeWeight: 1.5,
          fillColor: "#EF4444",
          fillOpacity: 0.28,
          map: mapInstanceRef.current,
          zIndex: 50
        });

        // 4. ⚫ DARKER RED TO BLACK ZONE: Deserted West Balcony & Rear Alleys (<15% Footfall · Avoid at Night)
        const blackBalconyCoords = [
          indoorToLatLng(50, 140),
          indoorToLatLng(165, 140),
          indoorToLatLng(165, 345),
          indoorToLatLng(50, 345)
        ];
        const blackBalconyPolygon = new google.maps.Polygon({
          paths: blackBalconyCoords,
          strokeColor: "#000000",
          strokeOpacity: 0.95,
          strokeWeight: 2.5,
          fillColor: "#7F1D1D",
          fillOpacity: 0.65,
          map: mapInstanceRef.current,
          zIndex: 65
        });

        // Security Help Desk Point (Central AB1 Security Station)
        const securityPos = indoorToLatLng(566, 320);
        const securityMarker = new google.maps.Marker({
          position: securityPos,
          map: mapInstanceRef.current,
          title: "Central Security Station (24/7 Monitored Safe Zone)",
          label: {
            text: "👮",
            fontSize: "16px"
          },
          zIndex: 150
        });

        securityMarker.addListener("click", () => {
          infoWindowRef.current.setContent(`
            <div style="padding: 6px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
              <div style="font-weight: 700; color: #15803D; font-size: 13px;">🛡️ Central Security Station</div>
              <div style="font-size: 11px; color: #444; margin-top: 2px;">24/7 Security Guard Desk · CCTV Surveillance</div>
              <div style="font-size: 11px; color: #0284C7; font-weight: 600; margin-top: 4px;">Ext: 100 · +91 141 3999100</div>
              <div style="margin-top: 4px; font-size: 10px; background: #DCFCE7; color: #166534; font-weight: 700; padding: 2px 6px; border-radius: 4px; display: inline-block;">
                🟢 92% FOOTFALL · HIGH SAFETY CONCOURSE
              </div>
            </div>
          `);
          infoWindowRef.current.open(mapInstanceRef.current, securityMarker);
        });

        // Low-footfall cautionary pin at West Balcony (Deserted zone)
        const balconyPos = indoorToLatLng(110, 240);
        const balconyWarningMarker = new google.maps.Marker({
          position: balconyPos,
          map: mapInstanceRef.current,
          title: "Deserted Balcony Terrace (Strictly Bypassed at Night)",
          label: {
            text: "🚫",
            fontSize: "16px"
          },
          zIndex: 150
        });

        balconyWarningMarker.addListener("click", () => {
          infoWindowRef.current.setContent(`
            <div style="padding: 6px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
              <div style="font-weight: 700; color: #991B1B; font-size: 13px;">🚫 Deserted Balcony Terrace</div>
              <div style="font-size: 11px; color: #444; margin-top: 2px;">Unlit outdoor zone with zero night surveillance</div>
              <div style="margin-top: 4px; font-size: 10px; background: #FEE2E2; color: #991B1B; font-weight: 700; padding: 2px 6px; border-radius: 4px; display: inline-block;">
                ⚫ 6% FOOTFALL · STRICTLY AVOID AT NIGHT
              </div>
            </div>
          `);
          infoWindowRef.current.open(mapInstanceRef.current, balconyWarningMarker);
        });

        safetyMarkersRef.current.push(
          greenPolygon,
          orangeNorthPolygon,
          orangeSouthPolygon,
          orangeEastPolygon,
          redWestPolygon,
          redEastPolygon,
          blackBalconyPolygon,
          securityMarker,
          balconyWarningMarker
        );
      }
    }, [isLoaded, isNightSafety]);

    // 8. Hazard Overlays (Fire & Smoke)
    useEffect(() => {
      if (!isLoaded || !mapInstanceRef.current) return;
      const google = (window as any).google;

      // Clean up previous hazard markers
      hazardMarkersRef.current.forEach((m) => m.setMap(null));
      hazardMarkersRef.current = [];

      hazardOverlays.forEach((hazard) => {
        if (hazard.severity === "fire" && hazard.polygon.length > 0) {
          const avgX = hazard.polygon.reduce((sum, pt) => sum + pt.x, 0) / hazard.polygon.length;
          const avgY = hazard.polygon.reduce((sum, pt) => sum + pt.y, 0) / hazard.polygon.length;
          const pos = indoorToLatLng(avgX, avgY);

          // Danger circle
          const circle = new google.maps.Circle({
            strokeColor: "#FF3B30",
            strokeOpacity: 0.8,
            strokeWeight: 2,
            fillColor: "#FF3B30",
            fillOpacity: 0.35,
            map: mapInstanceRef.current,
            center: pos,
            radius: 8,
            zIndex: 200
          });

          // Fire marker
          const marker = new google.maps.Marker({
            position: pos,
            map: mapInstanceRef.current,
            title: `FIRE HAZARD: ${hazard.zoneId}`,
            label: {
              text: "🔥",
              fontSize: "18px"
            },
            zIndex: 201
          });

          hazardMarkersRef.current.push(circle, marker);
        }
      });
    }, [isLoaded, hazardOverlays]);

    return (
      <div className="relative w-full h-full overflow-hidden select-none bg-[#1F2421]">
        {/* Iconic 1-Tap Quick Toggle: Satellite Mode <-> Default View (Bottom-Left next to Layers button) */}
        <div className="absolute left-[68px] bottom-24 md:bottom-6 z-20 select-none">
          <button
            onClick={toggleSatelliteDefault}
            className="h-11 px-3.5 bg-white/95 backdrop-blur-md rounded-xl shadow-[0_2px_10px_rgba(0,0,0,0.25)] border border-[#DADCE0] flex items-center gap-2.5 text-xs font-bold text-[#202124] hover:bg-[#F8F9FA] active:scale-95 transition-all cursor-pointer"
            title={
              currentMapType === "satellite" || currentMapType === "hybrid"
                ? "Switch to Default View (Clean Vector Map)"
                : "Switch to Satellite Mode (Aerial Photographic View)"
            }
          >
            <div
              className={`w-7 h-7 rounded-lg flex items-center justify-center text-white shadow-sm transition-colors ${
                currentMapType === "satellite" || currentMapType === "hybrid" ? "bg-[#1A73E8]" : "bg-[#34A853]"
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">
                {currentMapType === "satellite" || currentMapType === "hybrid" ? "map" : "satellite_alt"}
              </span>
            </div>
            <div className="flex flex-col text-left">
              <span className="text-[9px] text-[#5F6368] uppercase tracking-wider font-semibold">Toggle Mode</span>
              <span className="text-[12px] font-bold text-[#1A73E8]">
                {currentMapType === "satellite" || currentMapType === "hybrid" ? "Default View" : "Satellite Mode"}
              </span>
            </div>
          </button>
        </div>

        {/* Top-Right Google API & Live Traffic Connected Badge */}
        <div className="absolute top-16 md:top-4 right-4 z-20 flex flex-col items-end gap-1.5 pointer-events-auto select-none">
          <div className="bg-white/95 backdrop-blur-md rounded-xl px-3 py-1.5 shadow-md border border-[#DADCE0] flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${isTrafficActive ? "bg-[#34A853] animate-pulse" : "bg-[#5F6368]"}`} />
            <span className="text-[11px] font-bold text-[#202124]">
              {isTrafficActive ? "Live Traffic Active" : "Google Maps Live"}
            </span>
            <span className="text-[10px] text-[#5F6368] font-mono">MUJ · AB1</span>
          </div>

          {isNightSafety && (
            <>
              <div className="bg-[#1C1C1E]/95 backdrop-blur-md text-[#FFD60A] rounded-xl px-3 py-1 shadow-md border border-[#FFD60A]/30 flex items-center gap-1.5 text-[10px] font-bold animate-pulse">
                <span className="material-symbols-outlined text-[14px]">shield</span>
                <span>Women's Safe Path Active</span>
              </div>

              {/* Night Safety Footfall Heatmap Legend */}
              <div className="bg-white/95 backdrop-blur-md rounded-2xl p-2.5 shadow-xl border border-[#DADCE0] text-xs max-w-[220px] pointer-events-auto text-left">
                <div className="flex items-center gap-1.5 pb-1 mb-1.5 border-b border-[#E5E7EB]">
                  <span className="material-symbols-outlined text-[15px] text-[#1A73E8]">shield</span>
                  <span className="font-bold text-[#111827] text-[11px]">Footfall Safety Zones</span>
                </div>
                <div className="space-y-1 text-[10px]">
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded bg-[#22C55E] shrink-0 border border-[#16A34A]" />
                    <span className="text-[#15803D] font-semibold">Green: High (85%+) · Safe</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded bg-[#F97316] shrink-0 border border-[#EA580C]" />
                    <span className="text-[#C2410C] font-semibold">Orange: Moderate (50-80%)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded bg-[#EF4444] shrink-0 border border-[#DC2626]" />
                    <span className="text-[#B91C1C] font-semibold">Lighter Red: Low (20-45%)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded bg-[#7F1D1D] shrink-0 border border-[#000000]" />
                    <span className="text-[#7F1D1D] font-semibold">Dark Red/Black: &lt;15% (Avoid)</span>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Error Fallback Banner if script fails */}
        {loadError && (
          <div className="absolute top-20 left-4 right-4 z-30 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 flex items-center justify-between shadow-lg">
            <span>{loadError}</span>
            <button
              onClick={() => window.location.reload()}
              className="px-2 py-1 bg-red-600 text-white rounded font-medium hover:bg-red-700"
            >
              Retry
            </button>
          </div>
        )}

        {/* Loading Spinner */}
        {!isLoaded && !loadError && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-[#F8F9FA] text-[#5F6368] gap-3">
            <div className="w-8 h-8 border-3 border-[#1A73E8] border-t-transparent rounded-full animate-spin" />
            <p className="text-xs font-semibold">Connecting to Google Maps Platform…</p>
          </div>
        )}

        {/* Google Maps Container DOM */}
        <div ref={mapContainerRef} className="w-full h-full" />
      </div>
    );
  }
);

GoogleMapAdapter.displayName = "GoogleMapAdapter";
