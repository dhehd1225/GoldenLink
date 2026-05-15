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
      <div className="relative bg-gradient-to-br from-blue-50 to-indigo-100 rounded-2xl h-80 lg:h-[420px] flex items-center justify-center overflow-hidden">
        {/* Decorative map-like background */}
        <div className="absolute inset-0 opacity-[0.07]">
          <svg viewBox="0 0 400 300" className="w-full h-full" fill="none" stroke="currentColor" strokeWidth="0.5">
            <path d="M0 150 Q100 100 200 150 T400 150" className="text-blue-400"/>
            <path d="M0 180 Q150 130 300 180 T400 170" className="text-blue-300"/>
            <circle cx="120" cy="130" r="3" fill="currentColor" className="text-red-400"/>
            <circle cx="200" cy="145" r="3" fill="currentColor" className="text-red-400"/>
            <circle cx="280" cy="155" r="3" fill="currentColor" className="text-red-400"/>
            <circle cx="160" cy="160" r="3" fill="currentColor" className="text-blue-400"/>
            <circle cx="240" cy="135" r="3" fill="currentColor" className="text-blue-400"/>
            <path d="M50 50 L50 250 M100 50 L100 250 M150 50 L150 250 M200 50 L200 250 M250 50 L250 250 M300 50 L300 250 M350 50 L350 250" className="text-gray-300" strokeWidth="0.2"/>
            <path d="M50 75 L350 75 M50 125 L350 125 M50 175 L350 175 M50 225 L350 225" className="text-gray-300" strokeWidth="0.2"/>
          </svg>
        </div>
        {/* Hospital markers preview */}
        <div className="relative z-10 text-center">
          <div className="flex justify-center gap-3 mb-4">
            {hospitals.slice(0, 3).map((h, i) => (
              <div key={h.id} className="flex items-center gap-1.5 bg-white/80 backdrop-blur px-3 py-1.5 rounded-full shadow-sm text-xs font-medium">
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-bold ${
                  i === 0 ? 'bg-red-500' : i === 1 ? 'bg-orange-500' : 'bg-yellow-600'
                }`}>{i + 1}</span>
                <span className="text-gray-700 truncate max-w-[80px]">{h.name}</span>
              </div>
            ))}
          </div>
          <p className="text-sm text-blue-600/60 font-medium">병원 위치 지도</p>
          <p className="text-xs text-blue-400/50 mt-1">실제 배포 시 지도가 표시됩니다</p>
        </div>
      </div>
    );
  }

  return <div ref={containerRef} className="rounded-2xl h-80 lg:h-[420px] w-full shadow-sm border border-gray-100" />;
}
