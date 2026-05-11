'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { MatchedHospital } from '@/lib/types';

declare global {
  interface Window {
    naver: {
      maps: {
        Map: new (el: HTMLElement, opts: Record<string, unknown>) => NMap;
        LatLng: new (lat: number, lng: number) => NLatLng;
        LatLngBounds: new (sw: NLatLng, ne: NLatLng) => unknown;
        Marker: new (opts: Record<string, unknown>) => NMarker;
        InfoWindow: new (opts: Record<string, unknown>) => NInfoWindow;
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
    markersRef.current.forEach(m => m.setMap(null));
    infoWindowsRef.current.forEach(iw => iw.close());
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
      zoomControlOptions: { position: 3 }, // TOP_RIGHT
    });
  }, [loaded, userLat, userLng]);

  // Update markers
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

  if (noKey) {
    return (
      <div className="bg-gray-100 rounded-2xl h-80 lg:h-[420px] flex items-center justify-center text-gray-400 text-sm">
        <div className="text-center">
          <svg className="w-10 h-10 mx-auto mb-2 text-gray-300" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
          <p>네이버 지도 API 키를 설정하면</p>
          <p>지도가 표시됩니다</p>
          <p className="text-xs mt-2 text-gray-300">NEXT_PUBLIC_NAVER_MAP_KEY</p>
        </div>
      </div>
    );
  }

  return <div ref={containerRef} className="rounded-2xl h-80 lg:h-[420px] w-full shadow-sm border border-gray-100" />;
}
