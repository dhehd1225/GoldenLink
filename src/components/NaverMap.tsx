'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { MatchedHospital } from '@/lib/types';
import LeafletMap from './LeafletMap';

declare global {
  interface Window {
    naver: {
      maps: {
        Map: new (el: HTMLElement, opts: Record<string, unknown>) => NMap;
        LatLng: new (lat: number, lng: number) => NLatLng;
        LatLngBounds: new (sw: NLatLng, ne: NLatLng) => unknown;
        Marker: new (opts: Record<string, unknown>) => NMarker;
        InfoWindow: new (opts: Record<string, unknown>) => NInfoWindow;
        Polyline: new (opts: Record<string, unknown>) => NPolyline;
        Event: { addListener: (target: unknown, type: string, handler: () => void) => void };
        Size: new (w: number, h: number) => unknown;
        Point: new (x: number, y: number) => unknown;
      };
    };
  }
}

interface NLatLng { lat: () => number; lng: () => number }
interface NMap {
  fitBounds: (bounds: unknown, padding?: Record<string, number>) => void;
  getCenter: () => NLatLng;
  panTo: (latlng: NLatLng) => void;
}
interface NMarker { setMap: (map: NMap | null) => void; getPosition: () => NLatLng }
interface NInfoWindow { open: (map: NMap, marker: NMarker) => void; close: () => void; setMap: (map: NMap | null) => void }
interface NPolyline { setMap: (map: NMap | null) => void }

interface Props {
  hospitals: MatchedHospital[];
  userLat: number;
  userLng: number;
  selectedId?: string;
  onSelect?: (id: string) => void;
}

export default function NaverMap({ hospitals, userLat, userLng, selectedId, onSelect }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<NMap | null>(null);
  const markersRef = useRef<NMarker[]>([]);
  const infoWindowsRef = useRef<NInfoWindow[]>([]);
  const routeRef = useRef<NPolyline | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [noKey, setNoKey] = useState(false);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_NAVER_MAP_KEY;
    if (!key) { setNoKey(true); return; }
    if (window.naver?.maps) { setLoaded(true); return; }

    const script = document.createElement('script');
    script.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${key}`;
    script.onload = () => setLoaded(true);
    document.head.appendChild(script);
  }, []);

  const clearMarkers = useCallback(() => {
    markersRef.current.forEach(m => { try { m.setMap(null); } catch { /* naver sdk cleanup race */ } });
    infoWindowsRef.current.forEach(iw => { try { iw.close(); } catch { /* ignore */ } });
    if (routeRef.current) { try { routeRef.current.setMap(null); } catch { /* ignore */ } routeRef.current = null; }
    markersRef.current = [];
    infoWindowsRef.current = [];
  }, []);

  // Init map once
  useEffect(() => {
    if (!loaded || !containerRef.current || mapRef.current) return;
    const { naver } = window;
    const center = new naver.maps.LatLng(userLat, userLng);
    mapRef.current = new naver.maps.Map(containerRef.current, {
      center,
      zoom: 12,
      zoomControl: true,
      zoomControlOptions: { position: 3 },
    });
  }, [loaded, userLat, userLng]);

  // Update markers + route
  useEffect(() => {
    const map = mapRef.current;
    if (!loaded || !map) return;
    const { naver } = window;

    clearMarkers();

    const points: NLatLng[] = [];
    const userPos = new naver.maps.LatLng(userLat, userLng);
    points.push(userPos);

    // User marker (blue dot)
    const userMarker = new naver.maps.Marker({
      position: userPos,
      map,
      icon: {
        content: '<div style="width:18px;height:18px;background:#3B82F6;border:3px solid white;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,0.3);"></div>',
        size: new naver.maps.Size(18, 18),
        anchor: new naver.maps.Point(9, 9),
      },
    });
    markersRef.current.push(userMarker);

    const rankColors = ['#DC2626', '#EA580C', '#CA8A04', '#6B7280', '#6B7280'];

    hospitals.slice(0, 5).forEach((h, i) => {
      const pos = new naver.maps.LatLng(h.lat, h.lng);
      points.push(pos);

      const marker = new naver.maps.Marker({
        position: pos,
        map,
        icon: {
          content: `<div style="display:flex;align-items:center;justify-content:center;width:32px;height:32px;background:${rankColors[i]};color:white;border-radius:50%;font-weight:900;font-size:14px;box-shadow:0 2px 8px rgba(0,0,0,0.3);border:2px solid white;">${i + 1}</div>`,
          size: new naver.maps.Size(32, 32),
          anchor: new naver.maps.Point(16, 16),
        },
      });
      markersRef.current.push(marker);

      const infoWindow = new naver.maps.InfoWindow({
        content: `<div style="padding:10px 14px;font-size:13px;line-height:1.5;min-width:180px;">
          <b style="font-size:14px;">${i + 1}. ${h.name}</b><br/>
          <span style="color:#666;">${h.distance}km &middot; 약 ${h.estimatedTime}분</span><br/>
          <span style="color:#2563EB;font-weight:600;">병상 ${h.availableBeds}개</span> &middot;
          <span style="color:#16A34A;font-weight:600;">수술실 ${h.operatingRooms.available}개</span>
        </div>`,
        borderWidth: 0,
        backgroundColor: 'white',
        anchorSize: new naver.maps.Size(10, 10),
      });
      infoWindowsRef.current.push(infoWindow);

      if (selectedId === h.id) infoWindow.open(map, marker);

      naver.maps.Event.addListener(marker, 'click', () => {
        infoWindowsRef.current.forEach(iw => iw.close());
        infoWindow.open(map, marker);
        onSelectRef.current?.(h.id);
      });
    });

    // Draw route to selected hospital via OSRM
    const target = hospitals.find(h => h.id === selectedId) || hospitals[0];
    if (target) {
      fetch(`https://router.project-osrm.org/route/v1/driving/${userLng},${userLat};${target.lng},${target.lat}?overview=full&geometries=geojson`)
        .then(r => r.json())
        .then(data => {
          if (!data.routes?.[0]?.geometry || !mapRef.current) return;
          const coords = data.routes[0].geometry.coordinates.map(
            (c: [number, number]) => new naver.maps.LatLng(c[1], c[0])
          );
          routeRef.current = new naver.maps.Polyline({
            map: mapRef.current,
            path: coords,
            strokeColor: '#DC2626',
            strokeWeight: 4,
            strokeOpacity: 0.7,
            strokeStyle: 'shortdash',
          });
        })
        .catch(() => {
          // Fallback: straight line
          if (!mapRef.current) return;
          routeRef.current = new naver.maps.Polyline({
            map: mapRef.current,
            path: [
              new naver.maps.LatLng(userLat, userLng),
              new naver.maps.LatLng(target.lat, target.lng),
            ],
            strokeColor: '#DC2626',
            strokeWeight: 3,
            strokeOpacity: 0.5,
            strokeStyle: 'shortdash',
          });
        });
    }

    // Fit bounds
    if (points.length >= 2) {
      let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180;
      points.forEach(p => {
        minLat = Math.min(minLat, p.lat());
        maxLat = Math.max(maxLat, p.lat());
        minLng = Math.min(minLng, p.lng());
        maxLng = Math.max(maxLng, p.lng());
      });
      const sw = new naver.maps.LatLng(minLat, minLng);
      const ne = new naver.maps.LatLng(maxLat, maxLng);
      const bounds = new naver.maps.LatLngBounds(sw, ne);
      map.fitBounds(bounds, { top: 40, right: 40, bottom: 40, left: 40 });
    }
  }, [loaded, hospitals, userLat, userLng, selectedId, clearMarkers]);

  // No API key: fall back to LeafletMap
  if (noKey) {
    return <LeafletMap hospitals={hospitals} userLat={userLat} userLng={userLng} selectedId={selectedId} onSelect={onSelect} />;
  }

  return <div ref={containerRef} className="rounded-2xl h-80 lg:h-[420px] w-full shadow-sm border border-gray-100" />;
}
