import React, { useEffect, useRef, useState, forwardRef, useImperativeHandle } from "react";
import { FloorId, UserPositionState, GuardianState } from "../../types";
import { HazardOverlay, RoutePoint, RouteResult } from "@routeguard/shared";
import { ARCHITECTURAL_ROOMS, ArchitecturalRoom } from "../../data/floor2Data";

// Google Maps API Key with fallback to provided production key
const GOOGLE_MAPS_API_KEY: string =
  ((import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY as string) ||
  "AIzaSyCncccRP4QMuK4Fjm4APryWE497RjFOS40";

// Academic Block 1 (AB1) Reference Coordinates at Manipal University Jaipur
export const MUJ_AB1_CENTER = { lat: 26.84384, lng: 75.56593 };

// Bounds for Indoor -> GPS projection (Floor 2 AB1 Wing)
const CAMPUS_BOUNDS = {
  northWest: { lat: 26.84435, lng: 75.56530 },
  southEast: { lat: 26.84335, lng: 75.56655 }
};

/**
 * Converts local SVG floor plan coordinates (x, y) into GPS Lat/Lng on AB1.
 */
export function indoorToLatLng(x: number, y: number): { lat: number; lng: number } {
  const normX = Math.max(0, Math.min(1, x / 850));
  const normY = Math.max(0, Math.min(1, y / 650));
  const lat = CAMPUS_BOUNDS.northWest.lat - normY * (CAMPUS_BOUNDS.northWest.lat - CAMPUS_BOUNDS.southEast.lat);
  const lng = CAMPUS_BOUNDS.northWest.lng + normX * (CAMPUS_BOUNDS.southEast.lng - CAMPUS_BOUNDS.northWest.lng);
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

        // Academic Block 1 Boundary Polygon
        const campusPolygonCoords = [
          indoorToLatLng(0, 0),
          indoorToLatLng(850, 0),
          indoorToLatLng(850, 650),
          indoorToLatLng(0, 650)
        ];

        new google.maps.Polygon({
          paths: campusPolygonCoords,
          strokeColor: "#1A73E8",
          strokeOpacity: 0.8,
          strokeWeight: 2,
          fillColor: "#1A73E8",
          fillOpacity: 0.10,
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
            scale: 7,
            fillColor: "#1A73E8",
            fillOpacity: 1,
            strokeColor: "#FFFFFF",
            strokeWeight: 3
          },
          zIndex: 999
        });
      } else {
        userMarkerRef.current.setPosition(userLatLng);
        userMarkerRef.current.setTitle(`You are near ${userPosition.nearestPlaceName}`);
      }

      if (!userCircleRef.current) {
        userCircleRef.current = new google.maps.Circle({
          strokeColor: "#1A73E8",
          strokeOpacity: 0.4,
          strokeWeight: 1,
          fillColor: "#1A73E8",
          fillOpacity: 0.15,
          map: mapInstanceRef.current,
          center: userLatLng,
          radius: Math.max(3, userPosition.uncertaintyRadius || 4)
        });
      } else {
        userCircleRef.current.setCenter(userLatLng);
        userCircleRef.current.setRadius(Math.max(3, userPosition.uncertaintyRadius || 4));
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

      // Clean up previous polylines
      if (routePolylineRef.current) {
        routePolylineRef.current.setMap(null);
        routePolylineRef.current = null;
      }
      if (routeGlowLineRef.current) {
        routeGlowLineRef.current.setMap(null);
        routeGlowLineRef.current = null;
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
            strokeColor: "#34C759",
            strokeOpacity: 0.4,
            strokeWeight: 10,
            map: mapInstanceRef.current,
            zIndex: 100
          });

          // Primary emergency route line
          routePolylineRef.current = new google.maps.Polyline({
            path: pathCoords,
            geodesic: true,
            strokeColor: "#28a745",
            strokeOpacity: 1.0,
            strokeWeight: 5,
            map: mapInstanceRef.current,
            zIndex: 101
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
        // High-Footfall Central Concourse polygon highlight
        const concourseCoords = [
          indoorToLatLng(350, 180),
          indoorToLatLng(650, 180),
          indoorToLatLng(650, 310),
          indoorToLatLng(350, 310)
        ];

        const concoursePolygon = new google.maps.Polygon({
          paths: concourseCoords,
          strokeColor: "#00B4D8",
          strokeOpacity: 0.8,
          strokeWeight: 2,
          fillColor: "#00B4D8",
          fillOpacity: 0.18,
          map: mapInstanceRef.current,
          zIndex: 50
        });

        // Security Help Desk Point (Central AB1 Security Station)
        const securityPos = indoorToLatLng(566, 320);
        const securityMarker = new google.maps.Marker({
          position: securityPos,
          map: mapInstanceRef.current,
          title: "Central Security Station (24/7 Monitored)",
          label: {
            text: "👮",
            fontSize: "16px"
          },
          zIndex: 150
        });

        securityMarker.addListener("click", () => {
          infoWindowRef.current.setContent(`
            <div style="padding: 6px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
              <div style="font-weight: 700; color: #0077b6; font-size: 13px;">🛡️ Central Security Station</div>
              <div style="font-size: 11px; color: #444; margin-top: 2px;">24/7 Security Guard & CCTV Desk</div>
              <div style="font-size: 11px; color: #0077b6; font-weight: 600; margin-top: 4px;">Ext: 100 · +91 141 3999100</div>
              <div style="margin-top: 4px; font-size: 10px; background: #e0f2fe; color: #0284c7; padding: 2px 6px; border-radius: 4px; display: inline-block;">
                VERIFIED HIGH FOOTFALL
              </div>
            </div>
          `);
          infoWindowRef.current.open(mapInstanceRef.current, securityMarker);
        });

        // Low-footfall cautionary pin at West service alley
        const isolatedPos = indoorToLatLng(191, 291);
        const cautionMarker = new google.maps.Marker({
          position: isolatedPos,
          map: mapInstanceRef.current,
          title: "Isolated Low-Footfall Area (Bypassed at Night)",
          label: {
            text: "⚠️",
            fontSize: "14px"
          },
          zIndex: 150
        });

        safetyMarkersRef.current.push(concoursePolygon, securityMarker, cautionMarker);
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
            <div className="bg-[#1C1C1E]/95 backdrop-blur-md text-[#FFD60A] rounded-xl px-3 py-1 shadow-md border border-[#FFD60A]/30 flex items-center gap-1.5 text-[10px] font-bold animate-pulse">
              <span className="material-symbols-outlined text-[14px]">shield</span>
              <span>Women's Safe Path Active</span>
            </div>
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
