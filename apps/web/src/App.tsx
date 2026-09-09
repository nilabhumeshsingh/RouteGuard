import React, { useState, useCallback, useEffect, useRef } from "react";
import { NavRail } from "./components/common/NavRail";
import { GoogleSearchBar } from "./components/search/GoogleSearchBar";
import { CategoryFilterChips, CampusCategory } from "./components/search/CategoryFilterChips";
import { GoogleSearchPanel } from "./components/search/GoogleSearchPanel";
import { PositioningStatusBar, PositioningSourceType } from "./components/controls/PositioningStatusBar";
import { GoogleMapControls } from "./components/controls/GoogleMapControls";
import { LayersModal } from "./components/controls/LayersModal";
import { BottomSheet, SheetSnapPoint } from "./components/sheet/BottomSheet";
import { RoutePreviewCard } from "./components/navigation/RoutePreviewCard";
import { TurnByTurnNav } from "./components/navigation/TurnByTurnNav";
import { EmergencyBanner } from "./components/emergency/EmergencyBanner";
import { EmergencySheetContent } from "./components/emergency/EmergencySheetContent";
import { JudgeParameterMenu, ScenarioParams } from "./components/demo/JudgeParameterMenu";
import { CampusMapContainer, CampusMapContainerHandle } from "./components/map/CampusMapContainer";
import { FloorId, MapLayerConfig, UserPositionState, GuardianState, MapViewMode } from "./types";
import { HazardOverlay, MobilityProfile, PositionEstimate, RouteResult } from "@routeguard/shared";
import { ARCHITECTURAL_ROOMS, ArchitecturalRoom, POI } from "./data/floor2Data";
import {
  calculateRouteTradeOffs,
  calculateEvacuationRoute,
  findSafestStairRoute,
  SAFE_STAIR_TARGETS,
  RouteComparison,
  projectRouteToReferenceGuide,
  speakInstruction
} from "./services/routingService";
import { fetchActiveHazard } from "./services/hazardService";

export const App: React.FC = () => {
  // Map Container Handle for Zoom & Recenter
  const mapHandleRef = useRef<CampusMapContainerHandle>(null);

  // App & Theme State
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [viewMode, setViewMode] = useState<MapViewMode>("3D");
  const [currentFloor, setCurrentFloor] = useState<FloorId>("floor-2");
  const [snapPoint, setSnapPoint] = useState<SheetSnapPoint>("peek");
  const [isLayersModalOpen, setIsLayersModalOpen] = useState(false);

  // Search & Category Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchPanelOpen, setIsSearchPanelOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<CampusCategory>("All");

  // Scanner & Positioning State
  const [isScannerConnected, setIsScannerConnected] = useState(true);
  const [scannerLabel, setScannerLabel] = useState("BLE · 0.9");
  const [positionSource, setPositionSource] = useState<PositioningSourceType>("BLE");
  const [signalAge, setSignalAge] = useState(1);
  const [apCount, setApCount] = useState(9);

  const [userPos, setUserPos] = useState<UserPositionState>({
    x: 472.5,
    y: 193.75,
    floorId: "floor-2",
    uncertaintyRadius: 2.2,
    nearestPlaceName: "Room 204"
  });

  // Emergency State
  const [isAlarmActive, setIsAlarmActive] = useState(false);
  const [alarmLocation, setAlarmLocation] = useState("Room 207");
  const [alarmTime, setAlarmTime] = useState("14:32");
  const [smokeMinutes, setSmokeMinutes] = useState<0 | 2 | 5 | 10>(0);
  const [isSOSActive, setIsSOSActive] = useState(false);

  // Google Maps & Women's Night Safety Mode State
  const [isNightSafetyActive, setIsNightSafetyActive] = useState(false);
  const [googleMapType, setGoogleMapType] = useState<"satellite" | "hybrid" | "roadmap">("satellite");
  const [isTrafficActive, setIsTrafficActive] = useState(true);

  // Routing State
  const [selectedPOI, setSelectedPOI] = useState<POI | null>(null);
  const [routeComparison, setRouteComparison] = useState<RouteComparison | null>(null);
  const [activeProfile, setActiveProfile] = useState<MobilityProfile>("recommended");
  const [activeRoute, setActiveRoute] = useState<RouteResult | null>(null);
  const [isNavigating, setIsNavigating] = useState(false);

  // Judge Demo & Scenario State
  const [isJudgeMenuOpen, setIsJudgeMenuOpen] = useState(false);
  const [isScenarioRunning, setIsScenarioRunning] = useState(false);
  const [scenarioTimeLeft, setScenarioTimeLeft] = useState(60);
  const [evacuationProgress, setEvacuationProgress] = useState(0);
  const scenarioTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Layers Config
  const [layers, setLayers] = useState<MapLayerConfig>({
    rooms: true,
    labels: true,
    pois: true,
    emergencyEquipment: true,
    hazards: true
  });

  // Guardian State
  const [guardianState, setGuardianState] = useState<GuardianState>({
    isPaired: true,
    pairingCode: "839-421",
    childName: "Alex",
    childPosition: {
      x: 337.5,
      y: 351,
      floorId: "floor-2",
      placeName: "Room 219 (AI Lab)"
    },
    batteryLevel: 92,
    lastUpdatedSecondsAgo: 2,
    inSafeZone: true,
    geofenceWarning: null
  });

  // Hazard Overlays
  const [hazardOverlays, setHazardOverlays] = useState<HazardOverlay[]>([]);
  const [activeFireRoom, setActiveFireRoom] = useState<string | null>(null);

  // Signal age ticker
  useEffect(() => {
    const ticker = setInterval(() => {
      setSignalAge((prev) => (prev >= 15 ? 1 : prev + 1));
    }, 1000);
    return () => clearInterval(ticker);
  }, []);

  // Native Android positioning bridge support
  useEffect(() => {
    (window as any).onNativePositionUpdate = (pos: PositionEstimate) => {
      setUserPos({
        x: pos.x,
        y: pos.y,
        floorId: "floor-2",
        uncertaintyRadius: pos.uncertaintyRadius || 2.0,
        nearestPlaceName: pos.nearestPlaceName || "Floor 2"
      });
      setSignalAge(0);
    };

    const handleCustomEvent = (e: any) => {
      if (e.detail) {
        setUserPos({
          x: e.detail.x,
          y: e.detail.y,
          floorId: "floor-2",
          uncertaintyRadius: e.detail.uncertaintyRadius || 2.0,
          nearestPlaceName: e.detail.nearestPlaceName || "Floor 2"
        });
        setSignalAge(0);
      }
    };
    window.addEventListener("nativePositionUpdate", handleCustomEvent as EventListener);

    return () => {
      window.removeEventListener("nativePositionUpdate", handleCustomEvent as EventListener);
      delete (window as any).onNativePositionUpdate;
    };
  }, []);

  // Poll live WiFi scanner from backend (laptop-1 or active device)
  useEffect(() => {
    let cancelled = false;
    const pollInterval = setInterval(async () => {
      try {
        const res = await fetch("/api/scan/laptop-1");
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled || !data || !data.position) return;

        const pos = data.position;
        setUserPos({
          x: pos.x,
          y: pos.y,
          floorId: "floor-2",
          uncertaintyRadius: pos.uncertaintyMeters || 2.0,
          nearestPlaceName: pos.label || "Floor 2"
        });
        setSignalAge(Math.max(0, Math.round((data.ageMs || 0) / 1000)));
        setScannerLabel(`WIFI · ${pos.confidence ?? 1}`);
        if (data.apCount !== undefined) setApCount(data.apCount);
        setIsScannerConnected(true);
      } catch {
        // Backend temporarily offline
      }
    }, 2000);

    return () => {
      cancelled = true;
      clearInterval(pollInterval);
    };
  }, []);

  // Evacuate dynamically from user's current location to nearest safe stairs/exit
  const handleEvacuate = useCallback(async (fireRoomId?: string) => {
    setIsAlarmActive(true);
    const fireCode = (fireRoomId || "219").replace(/^(room\s*|node-)/i, "").trim();
    setActiveFireRoom(fireCode);

    // Determine current user node based on live positioning
    let currentUserNode = "node-219";
    if (userPos.nearestPlaceName) {
      const match = userPos.nearestPlaceName.match(/\b(20[1-9]|21[0-9]|220)\b/);
      if (match) {
        currentUserNode = `node-${match[1]}`;
      }
    }

    let activeHazard: Awaited<ReturnType<typeof fetchActiveHazard>> | null = null;
    try {
      const hazard = await fetchActiveHazard();
      if (hazard.active && (!hazard.roomId || hazard.roomId === fireCode)) {
        activeHazard = hazard;
      }
    } catch {
      // Preserve the existing local evacuation fallback when the API is unavailable.
    }

    // Prefer backend hazard data; retain the existing local rules as a compatibility fallback.
    const blockedNodes = new Set<string>();
    const blockedEdges = new Set<string>(activeHazard?.blockedEdgeIds || []);

    if (activeHazard) {
      activeHazard.blockedNodeIds.forEach((nodeId) => blockedNodes.add(nodeId));
    } else {
      if (currentUserNode !== `node-${fireCode}`) {
        blockedNodes.add(`node-${fireCode}`);
      }

      if (fireCode === "208") {
        if (currentUserNode !== "node-207") blockedNodes.add("node-207");
        if (currentUserNode !== "node-208") blockedNodes.add("c-208");
        blockedNodes.add("node-wash-girls-208");
        blockedNodes.add("c-lift");
      } else if (fireCode === "219") {
        blockedNodes.add("node-219a");
        blockedNodes.add("node-219c");
        if (currentUserNode !== "node-219") {
          blockedNodes.add("c-219");
        }
      }
    }

    // Ensure currentUserNode is never blocked
    blockedNodes.delete(currentUserNode);

    let evacRoute = calculateEvacuationRoute(currentUserNode, blockedNodes, isNightSafetyActive, blockedEdges);

    // If strict blockage prevented finding an egress route, unblock corridors to find life-safety path to stairs
    if (!evacRoute || evacRoute.status !== "found" || !evacRoute.pathPoints || evacRoute.pathPoints.length < 2) {
      const fallbackBlocked = new Set<string>();
      if (currentUserNode !== `node-${fireCode}`) {
        fallbackBlocked.add(`node-${fireCode}`);
      }
      evacRoute = calculateEvacuationRoute(currentUserNode, fallbackBlocked, isNightSafetyActive, blockedEdges);
    }

    // Fail-safe: if still unavailable, compute guaranteed life-safety path to nearest stairs
    if (!evacRoute || evacRoute.status !== "found" || !evacRoute.pathPoints || evacRoute.pathPoints.length < 2) {
      const targetExit = (currentUserNode === "node-208" || currentUserNode === "node-207") ? "exit-east" : "exit-west";
      evacRoute = {
        status: "found",
        routeId: `rt-emergency-${Date.now()}`,
        profile: "emergency",
        totalDistanceMeters: 16.5,
        estimatedTimeSeconds: 14,
        isEmergencyExit: true,
        tradeOffExplanation: "Emergency evacuation path to nearest clear fire exit stairs.",
        segments: [
          {
            fromNodeId: currentUserNode,
            toNodeId: `c-${fireCode}`,
            distanceMeters: 4,
            travelTimeSeconds: 3,
            instruction: "Exit room into corridor",
            isStepFree: true,
            edgeType: "door",
            hazardLevel: "none"
          },
          {
            fromNodeId: `c-${fireCode}`,
            toNodeId: "c-220",
            distanceMeters: 4.5,
            travelTimeSeconds: 4,
            instruction: "Head west along south corridor",
            isStepFree: true,
            edgeType: "corridor",
            hazardLevel: "none"
          },
          {
            fromNodeId: "c-220",
            toNodeId: "c-west",
            distanceMeters: 4.5,
            travelTimeSeconds: 4,
            instruction: "Continue straight towards Fire Exit West",
            isStepFree: true,
            edgeType: "corridor",
            hazardLevel: "none"
          },
          {
            fromNodeId: "c-west",
            toNodeId: targetExit,
            distanceMeters: 3.5,
            travelTimeSeconds: 3,
            instruction: "Enter Stairs & Fire Exit Ramp SW",
            isStepFree: true,
            edgeType: "ramp",
            hazardLevel: "none"
          }
        ],
        pathPoints: [
          { x: 371.25, y: 351.25, floorId: "floor-2" },
          { x: 371.25, y: 291.25, floorId: "floor-2" },
          { x: 303.75, y: 291.25, floorId: "floor-2" },
          { x: 191.25, y: 291.25, floorId: "floor-2" },
          { x: 191.25, y: 351.25, floorId: "floor-2" }
        ]
      };
    }

    const lastSeg = evacRoute.segments[evacRoute.segments.length - 1];
    const destinationNode = lastSeg?.toNodeId || "exit-west";
    const targetObj = SAFE_STAIR_TARGETS.find((s) => s.id === destinationNode);

    const exitPoi: POI = {
      id: "poi-evac-exit",
      name: targetObj ? targetObj.name : destinationNode === "exit-east" ? "Stairs & Fire Exit NE" : "Stairs & Fire Exit Ramp SW",
      category: "Emergency Exit",
      nodeId: destinationNode,
      aliases: ["fire exit", "stairs", "emergency stairs"]
    };

    setSelectedPOI(exitPoi);
    setActiveProfile("emergency");
    setActiveRoute(evacRoute);
    setIsNavigating(true);
    setSnapPoint("half");

    speakInstruction(
      evacRoute.tradeOffExplanation ||
      `Emergency evacuation active! Fire detected in Room ${fireCode}. Proceed directly to ${exitPoi.name}.`
    );
  }, [userPos.nearestPlaceName, isNightSafetyActive]);

  // One-tap navigation to safest stairs through corridors
  const handleNavigateToSafestStairs = useCallback(() => {
    if (isAlarmActive) {
      void handleEvacuate(activeFireRoom || undefined);
      return;
    }

    let currentUserNode = "node-204";
    if (userPos.nearestPlaceName) {
      const match = userPos.nearestPlaceName.match(/\b(20[1-9]|21[0-9]|220)\b/);
      if (match) {
        currentUserNode = `node-${match[1]}`;
      }
    }

    const stairRoute = findSafestStairRoute(currentUserNode, {
      isNightSafety: isNightSafetyActive,
      isStepFree: activeProfile === "step-free"
    });

    if (stairRoute && stairRoute.status === "found") {
      const lastSeg = stairRoute.segments[stairRoute.segments.length - 1];
      const destinationNode = lastSeg?.toNodeId || "node-stairs-north";
      const targetObj = SAFE_STAIR_TARGETS.find((s) => s.id === destinationNode);

      const stairPoi: POI = {
        id: "poi-target-stairs",
        name: targetObj ? targetObj.name : "Safest Central Stairs (ST-NM)",
        category: "Stairs",
        nodeId: destinationNode,
        aliases: ["stairs", "safe stairs", "nearest stairs"]
      };

      setSelectedPOI(stairPoi);
      setActiveRoute(stairRoute);
      setIsNavigating(false);
      setSnapPoint("half");
      speakInstruction(stairRoute.tradeOffExplanation || "Routing to the safest stairs via central concourse.");
    }
  }, [activeFireRoom, activeProfile, handleEvacuate, isAlarmActive, isNightSafetyActive, userPos.nearestPlaceName]);

  // Dismiss Alarm
  const handleDismissAlarm = () => {
    setIsAlarmActive(false);
    setActiveFireRoom(null);
    setIsNavigating(false);
    setSelectedPOI(null);
    setActiveRoute(null);
    setHazardOverlays([]);
    setSmokeMinutes(0);
    setSnapPoint("peek");
    speakInstruction("Emergency alarm reset. System returned to normal status.");
    fetch("/api/fire", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clear: true }) }).catch(() => {});
  };

  // Poll live Fire Alarm from backend / Vercel (ESP32 trigger)
  useEffect(() => {
    let cancelled = false;
    const fireInterval = setInterval(async () => {
      try {
        const res = await fetch("/api/fire");
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled || !data) return;

        let al = null;
        if (data && data.active && data.alarm) {
          al = data.alarm;
        } else if (Array.isArray(data)) {
          al = data.find((item: any) => item.active);
        }

        if (al) {
          const fireRoomCode = (al.roomId || "219").replace(/^(room\s*|node-)/i, "").trim();
          const fireLabel = al.label || `Room ${fireRoomCode}`;

          setAlarmLocation(fireLabel);
          setAlarmTime(
            new Date(al.triggeredAt || Date.now()).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit"
            })
          );

          if (!isAlarmActive || activeFireRoom !== fireRoomCode) {
            setIsAlarmActive(true);
            setActiveFireRoom(fireRoomCode);

            const rm = ARCHITECTURAL_ROOMS.find(
              (r) =>
                r.code.toLowerCase() === fireRoomCode.toLowerCase() ||
                r.id.toLowerCase() === `room-${fireRoomCode.toLowerCase()}` ||
                r.name.toLowerCase().includes(fireRoomCode.toLowerCase())
            );
            const poly = rm
              ? [
                  { x: rm.bounds.x, y: rm.bounds.y },
                  { x: rm.bounds.x + rm.bounds.width, y: rm.bounds.y },
                  { x: rm.bounds.x + rm.bounds.width, y: rm.bounds.y + rm.bounds.height },
                  { x: rm.bounds.x, y: rm.bounds.y + rm.bounds.height }
                ]
              : [
                  { x: 337.5, y: 302.5 },
                  { x: 405, y: 302.5 },
                  { x: 405, y: 400 },
                  { x: 337.5, y: 400 }
                ];

            setHazardOverlays([
              {
                zoneId: "room-" + fireRoomCode,
                floorId: "floor-2",
                severity: "fire",
                polygon: poly,
                pulsed: true,
                smokeIntensity: 0.85
              }
            ]);
            setSmokeMinutes(2);
            handleEvacuate(fireRoomCode);
          }
        } else if ((data.active === false || (Array.isArray(data) && !data.some((i: any) => i.active))) && isAlarmActive && !isScenarioRunning) {
          setIsAlarmActive(false);
          setActiveFireRoom(null);
          setHazardOverlays([]);
          setSmokeMinutes(0);
          setActiveRoute(null);
          setIsNavigating(false);
        }
      } catch {
        // Backend offline fallback
      }
    }, 1500);

    return () => {
      cancelled = true;
      clearInterval(fireInterval);
    };
  }, [isAlarmActive, activeFireRoom, handleEvacuate, isScenarioRunning]);

  // Toggle map detail layer
  const toggleLayer = (layer: keyof MapLayerConfig) => {
    setLayers((prev) => ({ ...prev, [layer]: !prev[layer] }));
  };

  // Recenter button
  const handleRecenter = () => {
    mapHandleRef.current?.resetView();
  };

  // Select destination and calculate route preview
  const handleSelectDestination = useCallback(
    (poi: POI) => {
      if (isAlarmActive) {
        void handleEvacuate(activeFireRoom || undefined);
        return;
      }

      setSelectedPOI(poi);
      setIsSearchPanelOpen(false);

      const startNode = "node-204";
      const endNode = poi.nodeId;
      const blocked = isAlarmActive
        ? activeFireRoom === "219"
          ? new Set(["node-219", "node-219a", "node-219c", "c-219"])
          : new Set(["node-207", "node-208", "c-208", "c-lift"])
        : undefined;

      const comparison = calculateRouteTradeOffs(startNode, endNode, blocked, isNightSafetyActive);
      setRouteComparison(comparison);
      setActiveProfile("recommended");
      setActiveRoute(comparison.recommended);
      setIsNavigating(false);
      setSnapPoint("half");

      // Focus room in 3D camera
      const roomId = poi.id.replace("poi-", "");
      mapHandleRef.current?.focusRoom(roomId);
    },
    [activeFireRoom, handleEvacuate, isAlarmActive, isNightSafetyActive]
  );

  // Women's Night Safety Mode Toggle Handler
  const handleToggleNightSafety = () => {
    const next = !isNightSafetyActive;
    setIsNightSafetyActive(next);

    // Recalculate route if destination is currently selected
    if (selectedPOI) {
      const startNode = "node-204";
      const endNode = selectedPOI.nodeId;
      const blocked = isAlarmActive
        ? activeFireRoom === "219"
          ? new Set(["node-219", "node-219a", "node-219c", "c-219"])
          : new Set(["node-207", "node-208", "c-208", "c-lift"])
        : undefined;

      const comparison = calculateRouteTradeOffs(startNode, endNode, blocked, next);
      setRouteComparison(comparison);
      setActiveRoute(comparison.recommended);
    }

    if (next) {
      speakInstruction("Women's Night Safety Active. Avoiding low footfall corridors and dark service stairwells.");
    } else {
      speakInstruction("Standard routing profile restored.");
    }
  };

  // Category chip filter click
  const handleCategorySelect = (cat: CampusCategory) => {
    setSelectedCategory(cat);
    // If not "All", open search panel to show matching places
    if (cat !== "All") {
      setIsSearchPanelOpen(true);
    }
  };

  // Profile selection (Recommended / Shortest / Step-free)
  const handleSelectProfile = (profile: MobilityProfile) => {
    if (isAlarmActive) {
      void handleEvacuate(activeFireRoom || undefined);
      return;
    }

    if (!routeComparison) return;
    setActiveProfile(profile);
    if (profile === "step-free") setActiveRoute(routeComparison.stepFree);
    else if (profile === "shortest") setActiveRoute(routeComparison.shortest);
    else setActiveRoute(routeComparison.recommended);
  };

  // Start Navigation
  const handleStartNavigation = () => {
    if (isAlarmActive) {
      void handleEvacuate(activeFireRoom || undefined);
      return;
    }

    setIsNavigating(true);
    setSnapPoint("half");
    speakInstruction(
      `Starting navigation to ${selectedPOI?.name || "destination"}. Follow the illuminated path on your floor plan.`
    );
  };

  // End Navigation
  const handleEndNavigation = () => {
    if (isAlarmActive) {
      void handleEvacuate(activeFireRoom || undefined);
      return;
    }

    setIsNavigating(false);
    setSelectedPOI(null);
    setRouteComparison(null);
    setActiveRoute(null);
    setSnapPoint("peek");
  };

  // SOS Trigger
  const handleSendSOS = () => {
    setIsSOSActive(true);
    speakInstruction("Emergency SOS alert dispatched. Security team is on the way.");
  };

  // Toggle Scanner Connection
  const handleToggleScanner = () => {
    const nextState = !isScannerConnected;
    setIsScannerConnected(nextState);
    if (nextState) {
      setScannerLabel("BLE · 0.9");
      setPositionSource("BLE");
      setApCount(9);
      setSignalAge(0);
    } else {
      setPositionSource("Manual");
      setScannerLabel("Disconnected");
    }
  };

  // Run Judge Scenario Simulation
  const handleRunScenario = (params: ScenarioParams) => {
    setIsScenarioRunning(true);
    setScenarioTimeLeft(60);
    setEvacuationProgress(0);
    setIsAlarmActive(true);
    const fireCode = (params.fireRoomId || "219").replace(/^(room\s*|node-)/i, "").trim();
    setActiveFireRoom(fireCode);
    setAlarmLocation(`Room ${fireCode}`);
    setAlarmTime(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));

    const rm = ARCHITECTURAL_ROOMS.find(
      (r) =>
        r.code.toLowerCase() === fireCode.toLowerCase() ||
        r.id.toLowerCase() === `room-${fireCode.toLowerCase()}` ||
        r.name.toLowerCase().includes(fireCode.toLowerCase())
    );
    const poly = rm
      ? [
          { x: rm.bounds.x, y: rm.bounds.y },
          { x: rm.bounds.x + rm.bounds.width, y: rm.bounds.y },
          { x: rm.bounds.x + rm.bounds.width, y: rm.bounds.y + rm.bounds.height },
          { x: rm.bounds.x, y: rm.bounds.y + rm.bounds.height }
        ]
      : [
          { x: 337.5, y: 302.5 },
          { x: 405, y: 302.5 },
          { x: 405, y: 400 },
          { x: 337.5, y: 400 }
        ];

    setHazardOverlays([
      {
        zoneId: "room-" + fireCode,
        floorId: "floor-2",
        severity: "fire",
        polygon: poly,
        pulsed: true,
        smokeIntensity: 0.85
      }
    ]);
    setSmokeMinutes(2);

    // Advance smoke & evac % over 60s
    if (scenarioTimerRef.current) clearInterval(scenarioTimerRef.current);

    let seconds = 60;
    scenarioTimerRef.current = setInterval(() => {
      seconds -= 1;
      setScenarioTimeLeft(seconds);
      const progress = Math.min(100, Math.round(((60 - seconds) / 60) * 100));
      setEvacuationProgress(progress);

      // Advance smoke forecast based on elapsed time
      if (seconds === 45) setSmokeMinutes(2);
      else if (seconds === 30) setSmokeMinutes(5);
      else if (seconds === 10) setSmokeMinutes(10);

      if (seconds <= 0) {
        if (scenarioTimerRef.current) clearInterval(scenarioTimerRef.current);
        setIsScenarioRunning(false);
        setEvacuationProgress(100);
        speakInstruction("Evaluation scenario completed. All occupants safely evacuated.");
      }
    }, 1000);

    // Trigger dynamic evacuation rerouting
    handleEvacuate(fireCode);
  };

  const handleStopScenario = () => {
    if (scenarioTimerRef.current) clearInterval(scenarioTimerRef.current);
    setIsScenarioRunning(false);
  };

  // Room selected from 3D/2D map click
  const handleSelectRoom = (room: ArchitecturalRoom) => {
    handleSelectDestination({
      id: `poi-${room.code}`,
      name: room.name,
      category: room.category,
      nodeId: room.nodeId,
      aliases: [room.code, room.name]
    });
  };

  const handleSelectNode = (nodeId: string, label: string) => {
    handleSelectDestination({
      id: `poi-${nodeId}`,
      name: label,
      category: "Selected Space",
      nodeId: nodeId,
      aliases: [label]
    });
  };

  // Determine bottom sheet header content
  const renderBottomSheetHeader = () => {
    if (isAlarmActive) {
      return (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#D93025] animate-pulse" />
            <span className="text-xs font-bold uppercase tracking-wider text-[#D93025]">
              Evacuation Protocol Active
            </span>
          </div>
          <span className="text-xs text-[#5F6368]">Nearest: Stair NE</span>
        </div>
      );
    }

    if (isNavigating && selectedPOI) {
      return (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#137333] animate-pulse" />
            <span className="text-xs font-semibold text-[#137333]">Navigating to {selectedPOI.name}</span>
          </div>
          <button onClick={handleEndNavigation} className="text-xs font-medium text-[#5F6368] hover:text-[#202124]">
            Exit
          </button>
        </div>
      );
    }

    if (selectedPOI && routeComparison) {
      return (
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-[#5F6368] uppercase tracking-wider">Route Comparison</span>
          <span className="text-xs font-medium text-[#1A73E8]">3 Options Available</span>
        </div>
      );
    }

    return (
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-[#5F6368]">Academic Block 1 · Second Floor</span>
        <span className="text-xs font-medium text-[#1A73E8] cursor-pointer" onClick={() => setIsSearchPanelOpen(true)}>
          Browse All Rooms
        </span>
      </div>
    );
  };

  // Determine bottom sheet body content
  const renderBottomSheetBody = () => {
    if (isNavigating && activeRoute && selectedPOI) {
      return (
        <TurnByTurnNav
          route={activeRoute}
          destinationName={selectedPOI.name}
          onEndNavigation={handleEndNavigation}
        />
      );
    }

    if (isAlarmActive) {
      return (
        <EmergencySheetContent
          avoidList={[`Room ${activeFireRoom || "219"} (Active Hazard)`, "Corridor B (Heavy Smoke)", "Passenger Lifts (Offline)"]}
          nearestExitName={selectedPOI?.name || "Stairs SW / Fire Exit Ramp"}
          nearestExitMeta={`${Math.round(activeRoute?.totalDistanceMeters || 16)}m · ${Math.round(activeRoute?.estimatedTimeSeconds || 14)}s walking`}
          onStartEvacuation={() => handleEvacuate(activeFireRoom || undefined)}
          onSendSOS={handleSendSOS}
          isSOSActive={isSOSActive}
        />
      );
    }

    if (selectedPOI && routeComparison) {
      return (
        <RoutePreviewCard
          destinationName={selectedPOI.name}
          categoryLabel={selectedPOI.category}
          comparison={routeComparison}
          activeProfile={activeProfile}
          isNightSafety={isNightSafetyActive}
          onSelectProfile={handleSelectProfile}
          onStartNavigation={handleStartNavigation}
          onCancel={handleEndNavigation}
        />
      );
    }

    // Default Peek Content: Quick search shortcuts & recent destinations
    return (
      <div className="space-y-3 pt-2 select-none">
        {/* Quick Action: Safest Stairs through corridors */}
        <button
          onClick={handleNavigateToSafestStairs}
          className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-[#052e16] to-[#14532d] border border-[#22c55e]/50 hover:border-[#22c55e] text-white flex items-center justify-between transition-all shadow-sm group cursor-pointer"
        >
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-[22px] text-[#4ade80] group-hover:scale-110 transition-transform">
              stairs
            </span>
            <div className="text-left">
              <div className="text-xs font-bold flex items-center gap-1.5">
                Navigate to Safest Stairs
                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#22c55e]/20 text-[#4ade80] border border-[#22c55e]/40">
                  95% CORE
                </span>
              </div>
              <div className="text-[10.5px] text-zinc-300">Strict corridor route to monitored Central ST-NM / ST-SM</div>
            </div>
          </div>
          <span className="material-symbols-outlined text-[18px] text-[#4ade80] group-hover:translate-x-0.5 transition-transform">
            arrow_forward
          </span>
        </button>

        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-[#5F6368] uppercase tracking-wider">Suggested Places</span>
          <button
            onClick={() => setIsSearchPanelOpen(true)}
            className="text-xs font-semibold text-[#1A73E8] hover:underline"
          >
            Search More
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {[
            { id: "poi-204", name: "Room 204", desc: "Lecture Hall · North", icon: "school" },
            { id: "poi-219", name: "Room 219", desc: "AI & Robotics Lab", icon: "precision_manufacturing" },
            { id: "poi-wash-nw", name: "Washroom NW", desc: "Male Restroom", icon: "wc" },
            { id: "poi-stairs-safest", name: "Safest Stairs", desc: "Central Concourse · 95%", icon: "stairs" }
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => {
                if (item.id === "poi-stairs-safest") {
                  handleNavigateToSafestStairs();
                  return;
                }
                const room = ARCHITECTURAL_ROOMS.find((r) => item.id.includes(r.code) || item.id.includes(r.id));
                if (room) handleSelectRoom(room);
                else handleSelectNode(item.id, item.name);
              }}
              className="p-2.5 rounded-xl border border-[#DADCE0] bg-[#F8F9FA] hover:bg-[#F1F3F4] text-left transition-all group cursor-pointer"
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="material-symbols-outlined text-[18px] text-[#1A73E8]">{item.icon}</span>
                <span className="text-xs font-bold text-[#202124] group-hover:text-[#1A73E8] transition-colors truncate">
                  {item.name}
                </span>
              </div>
              <div className="text-[11px] text-[#5F6368] truncate">{item.desc}</div>
            </button>
          ))}
        </div>
      </div>
    );
  };

  const visibleRoute = activeRoute
    ? { ...activeRoute, pathPoints: projectRouteToReferenceGuide(activeRoute.pathPoints) }
    : null;

  return (
    <div
      className={`relative w-full h-screen overflow-hidden ${
        isDarkMode ? "bg-[#1a1f3a] text-white" : "bg-[#F8F6F0] text-[#202124]"
      } flex font-sans select-none`}
    >
      {/* 1. Desktop Left Navigation Rail */}
      <NavRail
        onOpenLayers={() => setIsLayersModalOpen(true)}
        onOpenRecents={() => setIsSearchPanelOpen(true)}
        onOpenSaved={() => setIsSearchPanelOpen(true)}
        onTriggerJudgeMenu={() => setIsJudgeMenuOpen(true)}
        onAskRouteGuard={() => setIsSearchPanelOpen(true)}
        isDarkMode={isDarkMode}
      />

      {/* 2. Top Emergency Fire Alert Banner (56px #FF3B30) */}
      <EmergencyBanner
        isAlarmActive={isAlarmActive}
        alarmLocation={alarmLocation}
        timestamp={alarmTime}
        onEvacuate={handleEvacuate}
        onDismissAlarm={handleDismissAlarm}
      />

      {/* 3. Main Full-Bleed Map Canvas Area */}
      <main className="relative flex-1 h-full w-full overflow-hidden">
        {/* Full-Bleed 3D / 2D Map Container */}
        <CampusMapContainer
          ref={mapHandleRef}
          currentFloor={currentFloor}
          layers={layers}
          userPosition={userPos}
          routePoints={visibleRoute?.pathPoints}
          activeRoute={visibleRoute}
          routeIsStepFree={activeProfile === "step-free"}
          isEmergencyRoute={isAlarmActive || !!activeRoute?.isEmergencyExit || selectedPOI?.category === "Stairs" || selectedPOI?.category === "Emergency Exit"}
          hazardOverlays={hazardOverlays}
          smokeMinutes={smokeMinutes}
          guardianState={guardianState}
          onSelectNode={handleSelectNode}
          onSelectRoom={handleSelectRoom}
          viewMode={viewMode}
          onSwitchViewMode={setViewMode}
          isNightSafety={isNightSafetyActive}
          isTrafficActive={isTrafficActive}
          googleMapType={googleMapType}
          onToggleGoogleMapType={setGoogleMapType}
          onToggleTraffic={setIsTrafficActive}
          categoryFilter={selectedCategory.toLowerCase()}
          theme={isAlarmActive ? "emergency" : isDarkMode ? "dark" : "light"}
        />

        {/* Top-Right Mode Switcher Pill (3D / 2D / Maps) - Desktop */}
        <div className="hidden md:flex absolute top-3 right-4 z-30 items-center gap-1 bg-white/95 backdrop-blur-md rounded-full p-1 shadow-md border border-[#DADCE0] text-xs font-semibold select-none">
          <button
            onClick={() => setViewMode("3D")}
            className={`px-3 py-1.5 rounded-full flex items-center gap-1.5 transition-all cursor-pointer ${
              viewMode === "3D"
                ? "bg-[#1A73E8] text-white shadow-sm font-bold"
                : "text-[#5F6368] hover:text-[#202124] hover:bg-[#F1F3F4]"
            }`}
            title="3D Dollhouse View"
          >
            <span className="material-symbols-outlined text-[16px]">view_in_ar</span>
            <span>3D Dollhouse</span>
          </button>
          <button
            onClick={() => setViewMode("2D")}
            className={`px-3 py-1.5 rounded-full flex items-center gap-1.5 transition-all cursor-pointer ${
              viewMode === "2D"
                ? "bg-[#1A73E8] text-white shadow-sm font-bold"
                : "text-[#5F6368] hover:text-[#202124] hover:bg-[#F1F3F4]"
            }`}
            title="2D Blueprint View"
          >
            <span className="material-symbols-outlined text-[16px]">map</span>
            <span>2D Blueprint</span>
          </button>
          <button
            onClick={() => setViewMode("Google")}
            className={`px-3.5 py-1.5 rounded-full flex items-center gap-1.5 transition-all cursor-pointer ${
              viewMode === "Google"
                ? "bg-[#34A853] text-white shadow-sm font-bold"
                : "text-[#1A73E8] bg-[#E8F0FE] hover:bg-[#D2E3FC] border border-[#1A73E8]/30 font-bold"
            }`}
            title="Switch to Google Maps Satellite & Aerial View"
          >
            <span className="material-symbols-outlined text-[16px] text-[#34A853]">satellite_alt</span>
            <span>Google Maps</span>
          </button>
        </div>

        {/* Floating Top Controls (Search Bar, Category Chips, Status Bar, Quick Toggles) */}
        {!isAlarmActive && (
          <div className="absolute top-3 left-4 right-4 md:left-20 md:right-auto md:w-[500px] z-30 flex flex-col gap-2 pointer-events-auto">
            {/* Floating Google Pill Search Bar */}
            <GoogleSearchBar
              value={searchQuery}
              onChange={setSearchQuery}
              onFocus={() => setIsSearchPanelOpen(true)}
              isScannerConnected={isScannerConnected}
              scannerLabel={scannerLabel}
              onToggleScanner={handleToggleScanner}
            />

            {/* Category Filter Chips */}
            <CategoryFilterChips
              selectedCategory={selectedCategory}
              onSelectCategory={handleCategorySelect}
            />

            {/* Action Toolbar (Mobile Mode Switcher, Positioning, Women's Night Safe, Google Maps Toggles) */}
            <div className="flex items-center gap-2 flex-wrap select-none">
              {/* Mobile View Mode Pill */}
              <div className="flex md:hidden items-center gap-0.5 bg-white/95 backdrop-blur-md rounded-full p-1 shadow-sm border border-[#DADCE0] text-xs font-semibold">
                <button
                  onClick={() => setViewMode("3D")}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition-all cursor-pointer ${
                    viewMode === "3D" ? "bg-[#1A73E8] text-white shadow-xs" : "text-[#5F6368]"
                  }`}
                >
                  3D
                </button>
                <button
                  onClick={() => setViewMode("2D")}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition-all cursor-pointer ${
                    viewMode === "2D" ? "bg-[#1A73E8] text-white shadow-xs" : "text-[#5F6368]"
                  }`}
                >
                  2D
                </button>
                <button
                  onClick={() => setViewMode("Google")}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition-all cursor-pointer ${
                    viewMode === "Google" ? "bg-[#34A853] text-white shadow-xs" : "text-[#1A73E8] bg-[#E8F0FE]"
                  }`}
                >
                  Maps
                </button>
              </div>

              {/* Positioning Status Bar */}
              <div className="w-fit">
                <PositioningStatusBar
                  source={positionSource}
                  confidence="94% (±2.2m)"
                  ageSeconds={signalAge}
                  batteryPercent={92}
                  apCount={apCount}
                  onSelectSource={(s) => setPositionSource(s)}
                  onRecenter={handleRecenter}
                />
              </div>

              {/* Women's Safe Night Path Mode Button */}
              <button
                onClick={handleToggleNightSafety}
                className={`h-8 px-3 rounded-full flex items-center gap-1.5 text-xs font-semibold shadow-sm border transition-all cursor-pointer ${
                  isNightSafetyActive
                    ? "bg-[#FEF3C7] text-[#92400E] border-[#F59E0B] ring-2 ring-[#F59E0B]/30 font-bold"
                    : "bg-white/95 text-[#5F6368] border-[#DADCE0] hover:bg-[#F8F9FA] hover:text-[#202124]"
                }`}
                title="Women's Night Safety: Avoids deserted corridors, low-footfall areas, and isolated stairs"
              >
                <span className={`material-symbols-outlined text-[16px] ${isNightSafetyActive ? "text-[#D97706]" : "text-[#5F6368]"}`}>
                  shield
                </span>
                <span>{isNightSafetyActive ? "Safe Night (Active)" : "Safe Night Path"}</span>
              </button>

              {/* Safest Stairs Quick Button */}
              <button
                onClick={handleNavigateToSafestStairs}
                className="h-8 px-3 rounded-full flex items-center gap-1.5 text-xs font-semibold bg-white/95 text-[#15803d] border border-[#bbf7d0] hover:bg-[#f0fdf4] hover:border-[#86efac] shadow-sm transition-all cursor-pointer active:scale-95"
                title="Safest Stairs: Route strictly via corridors to nearest safe monitored stairs"
              >
                <span className="material-symbols-outlined text-[16px] text-[#16a34a]">
                  stairs
                </span>
                <span>Safest Stairs</span>
              </button>

              {/* Contextual Google Maps Controls (Clean & Unobstructed) */}
              {viewMode === "Google" && (
                <>
                  {/* Toggle Default View vs Satellite */}
                  <button
                    onClick={() =>
                      setGoogleMapType((prev) =>
                        prev === "satellite" || prev === "hybrid" ? "roadmap" : "satellite"
                      )
                    }
                    className="h-8 px-3 rounded-full flex items-center gap-1.5 text-xs font-semibold bg-white/95 backdrop-blur-md shadow-sm border border-[#DADCE0] text-[#1A73E8] hover:bg-[#F8F9FA] active:scale-95 transition-all cursor-pointer"
                    title={
                      googleMapType === "satellite" || googleMapType === "hybrid"
                        ? "Switch to Default View (Vector Map)"
                        : "Switch to Satellite Mode (Aerial Photos)"
                    }
                  >
                    <span className="material-symbols-outlined text-[16px]">
                      {googleMapType === "satellite" || googleMapType === "hybrid" ? "map" : "satellite_alt"}
                    </span>
                    <span>
                      {googleMapType === "satellite" || googleMapType === "hybrid"
                        ? "Default View"
                        : "Satellite Mode"}
                    </span>
                  </button>

                  {/* Toggle Live Traffic Layer */}
                  <button
                    onClick={() => setIsTrafficActive((prev) => !prev)}
                    className={`h-8 px-3 rounded-full flex items-center gap-1.5 text-xs font-semibold shadow-sm border transition-all cursor-pointer ${
                      isTrafficActive
                        ? "bg-[#E6F4EA] text-[#137333] border-[#34A853]/40 font-bold"
                        : "bg-white/95 text-[#5F6368] border-[#DADCE0] hover:bg-[#F8F9FA]"
                    }`}
                    title="Toggle Google Maps Live Traffic layer"
                  >
                    <span
                      className={`material-symbols-outlined text-[16px] ${
                        isTrafficActive ? "text-[#137333]" : "text-[#5F6368]"
                      }`}
                    >
                      traffic
                    </span>
                    <span>Traffic: {isTrafficActive ? "ON" : "OFF"}</span>
                  </button>
                </>
              )}
            </div>

            {/* Expandable Search Drawer Overlay */}
            <GoogleSearchPanel
              isOpen={isSearchPanelOpen}
              query={searchQuery}
              onClose={() => setIsSearchPanelOpen(false)}
              onSelectPOI={handleSelectDestination}
              categoryFilter={selectedCategory}
            />
          </div>
        )}

        {/* Floating Map Controls (Zoom, My Location, Floor Switcher, Layers) */}
        <GoogleMapControls
          currentFloor={currentFloor}
          onSelectFloor={setCurrentFloor}
          onZoomIn={() => mapHandleRef.current?.zoomIn()}
          onZoomOut={() => mapHandleRef.current?.zoomOut()}
          onRecenter={handleRecenter}
          onToggleLayers={() => setIsLayersModalOpen(true)}
          isLocating={true}
        />

        {/* Bottom Sheet UI (80px peek / 50vh half / 90vh full) */}
        <BottomSheet
          snapPoint={snapPoint}
          onSnapChange={setSnapPoint}
          headerContent={renderBottomSheetHeader()}
        >
          {renderBottomSheetBody()}
        </BottomSheet>
      </main>

      {/* Layers Configuration Modal */}
      <LayersModal
        isOpen={isLayersModalOpen}
        onClose={() => setIsLayersModalOpen(false)}
        viewMode={viewMode}
        onSetViewMode={setViewMode}
        isDarkMode={isDarkMode}
        onToggleDarkMode={() => setIsDarkMode(!isDarkMode)}
        layers={layers}
        onToggleLayer={toggleLayer}
      />

      {/* Judge Parameter Menu (Admin Demo Trigger) */}
      <JudgeParameterMenu
        isOpen={isJudgeMenuOpen}
        onClose={() => setIsJudgeMenuOpen(false)}
        onRunScenario={handleRunScenario}
        isScenarioRunning={isScenarioRunning}
        scenarioTimeLeft={scenarioTimeLeft}
        evacuationProgress={evacuationProgress}
        onStopScenario={handleStopScenario}
      />
    </div>
  );
};

export default App;
