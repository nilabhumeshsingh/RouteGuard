import { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import { HazardOverlay, PositionEstimate, RouteResult } from '@routeguard/shared';
import { projectRouteToReferenceGuide } from '../services/routingService';

export interface UserMarker {
  id: string;
  name?: string;
  label?: string;
  position: { x: number; y: number; floorId?: string };
  role?: string;
}

export interface Indoor3DAdapterRef {
  zoomIn: () => void;
  zoomOut: () => void;
  resetView: () => void;
  focusRoom: (roomId: string) => void;
}

export interface Indoor3DAdapterProps {
  position: PositionEstimate | null;
  route: RouteResult | null;
  hazards: HazardOverlay[];
  users: UserMarker[];
  mode: 'normal' | 'emergency' | 'simulation';
  categoryFilter?: string;
  theme?: 'light' | 'dark' | 'emergency';
  smokeMinutes?: number;
  onRoomSelect: (roomId: string) => void;
  onMapClick: (position: { x: number; y: number }) => void;
  onError: () => void; // triggers 2D fallback
}

const FLOORPLAN_URL = '/3d/standalone_floorplan.html';
const FALLBACK_URL = '/standalone_floorplan.html';

export const Indoor3DAdapter = forwardRef<Indoor3DAdapterRef, Indoor3DAdapterProps>((props, ref) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [activeUrl, setActiveUrl] = useState(FLOORPLAN_URL);

  useImperativeHandle(ref, () => ({
    zoomIn: () => {
      iframeRef.current?.contentWindow?.postMessage({ type: 'ZOOM_IN' }, '*');
    },
    zoomOut: () => {
      iframeRef.current?.contentWindow?.postMessage({ type: 'ZOOM_OUT' }, '*');
    },
    resetView: () => {
      iframeRef.current?.contentWindow?.postMessage({ type: 'RESET_VIEW' }, '*');
    },
    focusRoom: (roomId: string) => {
      iframeRef.current?.contentWindow?.postMessage({ type: 'FOCUS_ROOM', roomId }, '*');
    }
  }));

  // Handshake timeout: triggers fallback if 3D fails to signal MAP_READY within 5s
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!ready) {
        if (activeUrl === FLOORPLAN_URL) {
          // Attempt fallback URL once before failing to 2D
          setActiveUrl(FALLBACK_URL);
        } else {
          setFailed(true);
          props.onError();
        }
      }
    }, 5000);
    return () => clearTimeout(timer);
  }, [ready, activeUrl, props]);

  // Ping iframe once mounted
  useEffect(() => {
    const pingTimer = setInterval(() => {
      if (!ready && iframeRef.current?.contentWindow) {
        iframeRef.current.contentWindow.postMessage({ type: 'PING' }, '*');
      }
    }, 600);
    return () => clearInterval(pingTimer);
  }, [ready]);

  // Message listener for events emitted from 3D floorplan
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (iframeRef.current?.contentWindow && event.source !== iframeRef.current.contentWindow) return;
      const msg = event.data;
      if (!msg || typeof msg !== 'object') return;

      if (msg.type === 'MAP_READY') {
        setReady(true);
      } else if (msg.type === 'ROOM_SELECTED') {
        props.onRoomSelect(msg.roomId);
      } else if (msg.type === 'USER_CLICKED_MAP') {
        props.onMapClick(msg.position);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [props]);

  // Forward position
  useEffect(() => {
    if (ready && props.position) {
      iframeRef.current?.contentWindow?.postMessage(
        { type: 'SET_POSITION', position: props.position },
        '*'
      );
    }
  }, [props.position, ready]);

  // Forward active route
  useEffect(() => {
    if (ready) {
      if (props.route && props.route.pathPoints && props.route.pathPoints.length > 1) {
        const guidePath = projectRouteToReferenceGuide(props.route.pathPoints);
        iframeRef.current?.contentWindow?.postMessage(
          {
            type: 'SET_ROUTE',
            route: guidePath,
            profile: props.route.profile,
            etaSeconds: props.route.estimatedTimeSeconds
          },
          '*'
        );
      } else {
        iframeRef.current?.contentWindow?.postMessage({ type: 'CLEAR_ROUTE' }, '*');
      }
    }
  }, [props.route, ready]);

  // Forward hazards
  useEffect(() => {
    if (ready) {
      if (props.hazards && props.hazards.length > 0) {
        props.hazards.forEach((h: any) => {
          const raw = h.roomId || h.zoneId || '208';
          const roomId = raw.replace(/^(room-|ZONE_FLOOR2_)/i, '');
          iframeRef.current?.contentWindow?.postMessage(
            {
              type: 'SET_HAZARD',
              hazard: {
                id: h.id || `hazard-${roomId}`,
                roomId,
                severity: h.severity || 'critical',
                pulsed: h.pulsed !== false
              }
            },
            '*'
          );
        });
      } else {
        iframeRef.current?.contentWindow?.postMessage({ type: 'CLEAR_HAZARD' }, '*');
      }
    }
  }, [props.hazards, ready]);

  // Forward smoke minutes
  useEffect(() => {
    if (ready) {
      const activeHazard = props.hazards && props.hazards.length > 0 ? props.hazards[0] : null;
      const rawRoomId = activeHazard ? ((activeHazard as any).roomId || activeHazard.zoneId) : undefined;
      const roomId = rawRoomId ? String(rawRoomId).replace(/^(room-|ZONE_FLOOR2_)/i, '') : undefined;
      iframeRef.current?.contentWindow?.postMessage(
        {
          type: 'SET_SMOKE_FORECAST',
          forecast: { minutes: props.smokeMinutes || 0, roomId }
        },
        '*'
      );
    }
  }, [props.smokeMinutes, props.hazards, ready]);

  // Forward users
  useEffect(() => {
    if (ready) {
      iframeRef.current?.contentWindow?.postMessage(
        { type: 'SET_USERS', users: props.users || [] },
        '*'
      );
    }
  }, [props.users, ready]);

  // Forward category filter
  useEffect(() => {
    if (ready) {
      iframeRef.current?.contentWindow?.postMessage(
        { type: 'FILTER_CATEGORY', category: props.categoryFilter || 'all' },
        '*'
      );
    }
  }, [props.categoryFilter, ready]);

  // Forward theme / mode
  useEffect(() => {
    if (ready) {
      iframeRef.current?.contentWindow?.postMessage(
        { type: 'SET_THEME', theme: props.theme || 'light' },
        '*'
      );
      iframeRef.current?.contentWindow?.postMessage(
        { type: 'SET_MODE', mode: props.mode || 'normal' },
        '*'
      );
    }
  }, [props.theme, props.mode, ready]);

  if (failed) return null; // Parent will mount 2D fallback

  return (
    <div className="relative w-full h-full bg-[#F8F6F0]">
      {!ready && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-[#F8F6F0] gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-[#1A73E8] border-t-transparent animate-spin" />
          <div className="text-sm font-medium text-[#5F6368] tracking-tight">Loading 3D Campus Map…</div>
        </div>
      )}
      <iframe
        ref={iframeRef}
        src={activeUrl}
        title="RouteGuard 3D Floor Plan"
        className="w-full h-full border-0 block"
        sandbox="allow-scripts allow-same-origin"
      />
    </div>
  );
});

Indoor3DAdapter.displayName = 'Indoor3DAdapter';
jai gurudev