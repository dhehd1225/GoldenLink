'use client';

import { useEffect, useRef, useState } from 'react';
import { MatchedHospital } from '@/lib/types';

interface Props {
  hospitals: MatchedHospital[];
  userLat: number;
  userLng: number;
  selectedId?: string;
  onSelect?: (id: string) => void;
  transporting?: boolean;
}

export default function LeafletMap({ hospitals, userLat, userLng, selectedId, onSelect, transporting }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const routeLayerRef = useRef<L.Polyline | null>(null);
  const [ready, setReady] = useState(false);
  const LRef = useRef<typeof import('leaflet') | null>(null);

  // Dynamic import leaflet (SSR-safe)
  useEffect(() => {
    import('leaflet').then((L) => {
      LRef.current = L;
      delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });
      setReady(true);
    });
  }, []);

  // Init map
  useEffect(() => {
    const L = LRef.current;
    if (!ready || !L || !containerRef.current || mapInstanceRef.current) return;

    const map = L.map(containerRef.current, {
      center: [userLat, userLng],
      zoom: 13,
      zoomControl: true,
      attributionControl: false,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
    }).addTo(map);

    L.control.attribution({ position: 'bottomright', prefix: false })
      .addAttribution('&copy; <a href="https://osm.org">OSM</a>')
      .addTo(map);

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, [ready, userLat, userLng]);

  // Update markers + route
  useEffect(() => {
    const L = LRef.current;
    const map = mapInstanceRef.current;
    if (!L || !map) return;

    // Clear old
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];
    if (routeLayerRef.current) {
      routeLayerRef.current.remove();
      routeLayerRef.current = null;
    }

    const target = hospitals.find(h => h.id === selectedId) || hospitals[0];

    // User marker (blue pulsing dot)
    const userIcon = L.divIcon({
      className: '',
      html: `<div style="width:20px;height:20px;background:#3B82F6;border:3px solid white;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,0.3);position:relative;">
        <div style="position:absolute;inset:-6px;border-radius:50%;background:rgba(59,130,246,0.2);animation:pulse 2s infinite;"></div>
      </div>`,
      iconSize: [20, 20],
      iconAnchor: [10, 10],
    });
    const userMarker = L.marker([userLat, userLng], { icon: userIcon })
      .addTo(map)
      .bindPopup('<b>현재 위치</b><br/>구급차 출발지');
    markersRef.current.push(userMarker);

    const rankColors = ['#DC2626', '#EA580C', '#CA8A04', '#6B7280', '#6B7280'];
    const allBounds = L.latLngBounds([[userLat, userLng]]);

    hospitals.slice(0, 5).forEach((h, i) => {
      allBounds.extend([h.lat, h.lng]);

      const isTarget = transporting && h.id === (selectedId || hospitals[0]?.id);
      const size = isTarget ? 40 : 34;

      const hospitalIcon = L.divIcon({
        className: '',
        html: `<div style="display:flex;align-items:center;justify-content:center;width:${size}px;height:${size}px;background:${isTarget ? '#DC2626' : rankColors[i]};color:white;border-radius:50%;font-weight:900;font-size:${isTarget ? 16 : 14}px;box-shadow:0 ${isTarget ? 4 : 2}px ${isTarget ? 12 : 8}px rgba(0,0,0,${isTarget ? 0.4 : 0.3});border:${isTarget ? 3 : 2}px solid white;">${i + 1}</div>`,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
      });

      const marker = L.marker([h.lat, h.lng], { icon: hospitalIcon })
        .addTo(map)
        .bindPopup(`
          <div style="font-size:13px;line-height:1.5;min-width:180px;">
            <b style="font-size:14px;">${i + 1}. ${h.name}</b><br/>
            <span style="color:#666;">${h.distance}km · 약 ${h.estimatedTime}분</span><br/>
            <span style="color:#2563EB;font-weight:600;">병상 ${h.availableBeds}개</span> ·
            <span style="color:#16A34A;font-weight:600;">수술실 ${h.operatingRooms.available}개</span>
          </div>
        `);

      marker.on('click', () => onSelect?.(h.id));
      if (selectedId === h.id) marker.openPopup();
      markersRef.current.push(marker);
    });

    // Draw route to selected hospital
    if (target) {
      const routeStyle = transporting
        ? { color: '#DC2626', weight: 6, opacity: 0.9, dashArray: undefined as string | undefined }
        : { color: '#DC2626', weight: 4, opacity: 0.7, dashArray: '8, 8' as string | undefined };

      fetch(`https://router.project-osrm.org/route/v1/driving/${userLng},${userLat};${target.lng},${target.lat}?overview=full&geometries=geojson`)
        .then(r => r.json())
        .then(data => {
          if (data.routes?.[0]?.geometry) {
            const coords = data.routes[0].geometry.coordinates.map(
              (c: [number, number]) => [c[1], c[0]] as [number, number]
            );
            routeLayerRef.current = L.polyline(coords, routeStyle).addTo(map);

            // Transporting: zoom to route only (user → target hospital)
            if (transporting) {
              const routeBounds = L.latLngBounds([[userLat, userLng], [target.lat, target.lng]]);
              map.fitBounds(routeBounds, { padding: [60, 60], maxZoom: 14 });
            }
          }
        })
        .catch(() => {
          routeLayerRef.current = L.polyline(
            [[userLat, userLng], [target.lat, target.lng]],
            { color: '#DC2626', weight: 3, opacity: 0.5, dashArray: '10, 10' }
          ).addTo(map);
        });
    }

    // Default view: fit all hospitals. Transporting: zoom handled after route loads
    if (!transporting) {
      map.fitBounds(allBounds, { padding: [40, 40] });
    } else if (target) {
      // Immediate zoom before OSRM loads
      const routeBounds = L.latLngBounds([[userLat, userLng], [target.lat, target.lng]]);
      map.fitBounds(routeBounds, { padding: [60, 60], maxZoom: 14 });
    }
  }, [ready, hospitals, userLat, userLng, selectedId, onSelect, transporting]);

  return (
    <>
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <style>{`
        @keyframes pulse { 0%,100% { transform: scale(1); opacity: 0.6; } 50% { transform: scale(1.8); opacity: 0; } }
      `}</style>
      <div ref={containerRef} className="rounded-2xl h-80 lg:h-[420px] w-full shadow-sm border border-gray-100 z-0" />
    </>
  );
}
