'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { MatchedHospital } from '@/lib/types';

declare global {
  interface Window {
    kakao: {
      maps: {
        load: (callback: () => void) => void;
        Map: new (container: HTMLElement, options: { center: unknown; level: number }) => KakaoMap;
        LatLng: new (lat: number, lng: number) => unknown;
        LatLngBounds: new () => { extend: (latlng: unknown) => void };
        Marker: new (options: { position: unknown; map: KakaoMap }) => KakaoMarker;
        InfoWindow: new (options: { content: string }) => KakaoInfoWindow;
        CustomOverlay: new (options: { position: unknown; content: string; yAnchor: number }) => KakaoOverlay;
        event: { addListener: (target: unknown, type: string, handler: () => void) => void };
      };
    };
  }
}

interface KakaoMap {
  setBounds: (bounds: unknown) => void;
  setCenter: (latlng: unknown) => void;
}

interface KakaoMarker {
  setMap: (map: KakaoMap | null) => void;
}

interface KakaoInfoWindow {
  open: (map: KakaoMap, marker: KakaoMarker) => void;
  close: () => void;
}

interface KakaoOverlay {
  setMap: (map: KakaoMap | null) => void;
}

interface Props {
  hospitals: MatchedHospital[];
  userLat: number;
  userLng: number;
  selectedId?: string;
  onSelect?: (id: string) => void;
}

export default function KakaoMap({ hospitals, userLat, userLng, selectedId, onSelect }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<KakaoMap | null>(null);
  const markersRef = useRef<KakaoMarker[]>([]);
  const overlaysRef = useRef<KakaoOverlay[]>([]);
  const infoWindowsRef = useRef<KakaoInfoWindow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [noKey, setNoKey] = useState(false);

  // Stable callback ref to avoid re-render loops
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_KAKAO_MAP_KEY;
    if (!key) { setNoKey(true); return; }

    if (window.kakao?.maps) { setLoaded(true); return; }

    const script = document.createElement('script');
    script.src = `//dapi.kakao.com/v2/maps/sdk.js?appkey=${key}&autoload=false`;
    script.onload = () => {
      window.kakao.maps.load(() => setLoaded(true));
    };
    document.head.appendChild(script);
  }, []);

  // Cleanup previous markers/overlays
  const clearMarkers = useCallback(() => {
    markersRef.current.forEach(m => m.setMap(null));
    overlaysRef.current.forEach(o => o.setMap(null));
    infoWindowsRef.current.forEach(iw => iw.close());
    markersRef.current = [];
    overlaysRef.current = [];
    infoWindowsRef.current = [];
  }, []);

  // Init map once
  useEffect(() => {
    if (!loaded || !containerRef.current || mapRef.current) return;
    const { kakao } = window;
    const center = new kakao.maps.LatLng(userLat, userLng);
    mapRef.current = new kakao.maps.Map(containerRef.current, { center, level: 7 });
  }, [loaded, userLat, userLng]);

  // Update markers when hospitals or selection changes
  useEffect(() => {
    const map = mapRef.current;
    if (!loaded || !map) return;
    const { kakao } = window;

    clearMarkers();

    const bounds = new kakao.maps.LatLngBounds();
    const center = new kakao.maps.LatLng(userLat, userLng);
    bounds.extend(center);

    // User position overlay
    const userOverlay = new kakao.maps.CustomOverlay({
      position: center,
      content: '<div style="width:16px;height:16px;background:#3B82F6;border:3px solid white;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.3);"></div>',
      yAnchor: 0.5,
    });
    userOverlay.setMap(map);
    overlaysRef.current.push(userOverlay);

    // Hospital markers
    hospitals.slice(0, 5).forEach((h, i) => {
      const pos = new kakao.maps.LatLng(h.lat, h.lng);
      bounds.extend(pos);

      const marker = new kakao.maps.Marker({ position: pos, map });
      markersRef.current.push(marker);

      const infoContent = `<div style="padding:8px 12px;font-size:13px;white-space:nowrap;"><b>${i + 1}. ${h.name}</b><br/>${h.distance}km | 병상 ${h.availableBeds}</div>`;
      const infoWindow = new kakao.maps.InfoWindow({ content: infoContent });
      infoWindowsRef.current.push(infoWindow);

      if (selectedId === h.id) infoWindow.open(map, marker);

      kakao.maps.event.addListener(marker, 'click', () => {
        // Close all info windows first
        infoWindowsRef.current.forEach(iw => iw.close());
        infoWindow.open(map, marker);
        onSelectRef.current?.(h.id);
      });
    });

    map.setBounds(bounds);
  }, [loaded, hospitals, userLat, userLng, selectedId, clearMarkers]);

  if (noKey) {
    return (
      <div className="bg-gray-100 rounded-2xl h-64 flex items-center justify-center text-gray-400 text-sm">
        <div className="text-center">
          <svg className="w-10 h-10 mx-auto mb-2 text-gray-300" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
          <p>카카오맵 API 키를 설정하면</p>
          <p>지도가 표시됩니다</p>
        </div>
      </div>
    );
  }

  return <div ref={containerRef} className="rounded-2xl h-64 w-full" />;
}
