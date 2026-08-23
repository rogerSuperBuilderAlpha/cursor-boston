/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import { useEffect, useMemo, useRef } from "react";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import { useTheme } from "next-themes";
import {
  BOSTON_MAP_CENTER,
  BOSTON_MAP_DEFAULT_ZOOM,
  CARTO_TILE_URLS,
  getCartoAttribution,
  getMapBounds,
  type EventMapMarker,
} from "@/lib/events-map";
import "leaflet/dist/leaflet.css";

interface EventMapLeafletProps {
  markers: EventMapMarker[];
  selectedEventId: string | null;
  onSelect: (eventId: string) => void;
}

function createMarkerIcon(isPast: boolean, isSelected: boolean): L.DivIcon {
  const color = isSelected ? "#059669" : isPast ? "#737373" : "#2563eb";
  const size = isSelected ? 18 : 14;

  return L.divIcon({
    className: "",
    html: `<span style="display:block;width:${size}px;height:${size}px;border-radius:9999px;background:${color};border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.35);"></span>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });
}

function FitBounds({ markers }: { markers: EventMapMarker[] }) {
  const map = useMap();

  useEffect(() => {
    const bounds = getMapBounds(markers);
    if (!bounds) {
      map.setView([BOSTON_MAP_CENTER.lat, BOSTON_MAP_CENTER.lng], BOSTON_MAP_DEFAULT_ZOOM);
      return;
    }

    if (markers.length === 1) {
      map.setView([markers[0].lat, markers[0].lng], 14);
      return;
    }

    map.fitBounds(bounds, { padding: [48, 48], maxZoom: 14 });
  }, [map, markers]);

  return null;
}

function FocusSelectedMarker({
  markers,
  selectedEventId,
}: {
  markers: EventMapMarker[];
  selectedEventId: string | null;
}) {
  const map = useMap();
  const previousSelection = useRef<string | null>(null);

  useEffect(() => {
    if (!selectedEventId || selectedEventId === previousSelection.current) return;

    const marker = markers.find((item) => item.eventId === selectedEventId);
    if (!marker) return;

    previousSelection.current = selectedEventId;
    map.flyTo([marker.lat, marker.lng], Math.max(map.getZoom(), 14), { duration: 0.6 });
  }, [map, markers, selectedEventId]);

  return null;
}

export function EventMapLeaflet({
  markers,
  selectedEventId,
  onSelect,
}: EventMapLeafletProps) {
  const { resolvedTheme } = useTheme();
  const tileUrl = resolvedTheme === "dark" ? CARTO_TILE_URLS.dark : CARTO_TILE_URLS.light;

  const center = useMemo<[number, number]>(() => {
    if (markers.length === 1) {
      return [markers[0].lat, markers[0].lng];
    }
    return [BOSTON_MAP_CENTER.lat, BOSTON_MAP_CENTER.lng];
  }, [markers]);

  if (markers.length === 0) {
    return (
      <div className="flex h-full items-center justify-center bg-neutral-100 px-6 text-center text-sm text-neutral-600 dark:bg-neutral-900 dark:text-neutral-400">
        No mappable venues yet. Check back when upcoming events publish addresses.
      </div>
    );
  }

  return (
    <MapContainer
      center={center}
      zoom={BOSTON_MAP_DEFAULT_ZOOM}
      scrollWheelZoom
      className="h-full w-full"
      aria-label="Interactive map of Cursor Boston event venues"
    >
      <TileLayer url={tileUrl} attribution={getCartoAttribution()} />
      <FitBounds markers={markers} />
      <FocusSelectedMarker markers={markers} selectedEventId={selectedEventId} />
      {markers.map((marker) => (
        <Marker
          key={marker.eventId}
          position={[marker.lat, marker.lng]}
          icon={createMarkerIcon(marker.isPast, marker.eventId === selectedEventId)}
          eventHandlers={{
            click: () => onSelect(marker.eventId),
          }}
        >
          <Popup>
            <div className="space-y-1 text-sm">
              <p className="font-semibold text-neutral-950">{marker.title}</p>
              <p className="text-neutral-600">{marker.venueName}</p>
              <p className="text-neutral-500">{marker.date} · {marker.time}</p>
              <a href={marker.href} className="font-medium text-emerald-700 hover:underline">
                View event details
              </a>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
