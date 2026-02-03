# OpenStreetMap vs Google Maps - Analisi Comparativa

## DOMANDA: Possiamo usare OpenStreetMap invece di Google Maps?

**Risposta Breve**: **SÌ, assolutamente raccomandato per 10 bus!** ✅

OpenStreetMap (OSM) + Leaflet.js è una soluzione completamente gratuita, open-source e senza limiti di utilizzo, perfetta per una flotta ridotta.

---

## 1. CONFRONTO TECNICO

### Google Maps JavaScript API

**Pro**:
- ✅ UI/UX familiare agli utenti
- ✅ Dati sempre aggiornati (Street View, Places, Traffic)
- ✅ Geocoding API integrata di alta qualità
- ✅ Directions API per routing
- ✅ Supporto ufficiale Google
- ✅ Documentazione eccellente

**Contro**:
- ❌ **Costo**: €0-10/mese per 10 bus (quota free 28k loads) ma rischio sforamento
- ❌ Vendor lock-in
- ❌ Richiede API key e billing account
- ❌ Limiti di utilizzo (quote, rate limits)
- ❌ Terms of Service restrittivi

### OpenStreetMap + Leaflet.js

**Pro**:
- ✅ **Completamente GRATUITO** (zero costi, zero limiti) 🎉
- ✅ Open source (nessun vendor lock-in)
- ✅ Dati mondiali crowd-sourced
- ✅ Nessuna API key richiesta
- ✅ Privacy-friendly (no tracking Google)
- ✅ Tile server self-hostable (opzionale)
- ✅ Ecosistema plugin ricco (Leaflet plugins)
- ✅ Supporto polylines, markers, clustering
- ✅ Leggero (~39 KB Leaflet.js vs ~1 MB Google Maps)

**Contro**:
- ⚠️ UI meno "polished" di Google Maps (ma professionale)
- ⚠️ Dati Italia buoni ma non sempre aggiornati come Google
- ⚠️ No Street View integrato
- ⚠️ Routing richiede servizio esterno (OSRM, GraphHopper)
- ⚠️ Geocoding richiede servizio esterno (Nominatim)

---

## 2. RACCOMANDAZIONE PER 10 BUS

### 🏆 **SOLUZIONE CONSIGLIATA: OpenStreetMap + Leaflet.js**

**Motivazioni**:
1. **Costo zero assoluto** (importante per budget ridotto)
2. **Funzionalità sufficienti** per tracking bus (mappa + marker + polylines)
3. **Italia ben coperta** su OSM (dati strade buoni)
4. **No complessità billing** Google Cloud
5. **Privacy migliore** (GDPR friendly, no tracking)

**Unica eccezione**: Se servono funzionalità avanzate Google (Street View, Places API, Traffic real-time) → allora Google Maps.

---

## 3. IMPLEMENTAZIONE LEAFLET.JS

### 3.1 Setup Base

#### Installazione

```bash
npm install leaflet
npm install @types/leaflet --save-dev  # TypeScript types
```

#### Codice React (Monitoring Frontend)

```tsx
// src/components/BusMap.tsx
import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Bus } from '@/types';

// Fix Leaflet default icon issue con Webpack
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
});

interface BusMapProps {
  buses: Bus[];
  selectedLineId?: number;
}

export const BusMap: React.FC<BusMapProps> = ({ buses, selectedLineId }) => {
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<Map<number, L.Marker>>(new Map());

  // Inizializza mappa
  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Crea mappa centrata su Italia (esempio: Milano)
    const map = L.map(mapContainerRef.current).setView([45.4642, 9.1900], 12);

    // Tile layer OpenStreetMap
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    mapRef.current = map;

    return () => {
      map.remove();
    };
  }, []);

  // Aggiorna marker bus
  useEffect(() => {
    if (!mapRef.current) return;

    const map = mapRef.current;

    // Rimuovi marker vecchi non più presenti
    markersRef.current.forEach((marker, busId) => {
      if (!buses.find(b => b.id === busId)) {
        marker.remove();
        markersRef.current.delete(busId);
      }
    });

    // Aggiungi/aggiorna marker
    buses.forEach(bus => {
      if (!bus.latitude || !bus.longitude) return;

      const latLng: L.LatLngExpression = [bus.latitude, bus.longitude];

      let marker = markersRef.current.get(bus.id);

      if (!marker) {
        // Crea nuovo marker con icona custom
        const icon = createBusIcon(bus.status);
        marker = L.marker(latLng, { icon }).addTo(map);

        // Popup con info bus
        marker.bindPopup(`
          <div>
            <h3>${bus.label}</h3>
            <p><strong>Targa:</strong> ${bus.plate}</p>
            <p><strong>Linea:</strong> ${bus.line_name}</p>
            <p><strong>Velocità:</strong> ${bus.speed ? Math.round(bus.speed * 3.6) : 0} km/h</p>
            <p><strong>Ultimo aggiornamento:</strong> ${formatTimestamp(bus.last_update)}</p>
            <p><strong>Stato:</strong> <span class="status-${bus.status}">${bus.status}</span></p>
          </div>
        `);

        markersRef.current.set(bus.id, marker);
      } else {
        // Aggiorna posizione esistente con animazione
        marker.setLatLng(latLng);
        marker.setIcon(createBusIcon(bus.status));
      }
    });

    // Auto-fit bounds se ci sono bus
    if (buses.length > 0) {
      const bounds = L.latLngBounds(
        buses
          .filter(b => b.latitude && b.longitude)
          .map(b => [b.latitude!, b.longitude!] as L.LatLngExpression)
      );
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [buses]);

  return (
    <div
      ref={mapContainerRef}
      style={{ width: '100%', height: '600px' }}
      className="bus-map"
    />
  );
};

// Crea icona bus custom colorata per stato
function createBusIcon(status: 'moving' | 'stopped' | 'offline'): L.DivIcon {
  const colors = {
    moving: '#22c55e',    // verde
    stopped: '#f59e0b',   // arancione
    offline: '#94a3b8',   // grigio
  };

  return L.divIcon({
    html: `
      <div style="
        width: 30px;
        height: 30px;
        background-color: ${colors[status]};
        border: 3px solid white;
        border-radius: 50%;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 16px;
      ">
        🚌
      </div>
    `,
    className: 'custom-bus-marker',
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, -15],
  });
}

function formatTimestamp(timestamp?: string): string {
  if (!timestamp) return 'N/A';
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);

  if (diffSec < 60) return `${diffSec} sec fa`;
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)} min fa`;
  return date.toLocaleTimeString('it-IT');
}
```

### 3.2 Tile Providers (Alternative a OSM Standard)

```tsx
// Diverse tile provider per stili differenti

// 1. OpenStreetMap Standard (default)
const osmStandard = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

// 2. OpenStreetMap HOT (Humanitarian style - più contrasto)
const osmHOT = 'https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png';

// 3. CartoDB Positron (minimal, chiaro)
const cartoDBPositron = 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png';

// 4. CartoDB Dark Matter (dark mode)
const cartoDBDark = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png';

// 5. Stamen Toner (bianco/nero ad alto contrasto)
const stamenToner = 'https://stamen-tiles.a.ssl.fastly.net/toner/{z}/{x}/{y}.png';

// Esempio cambio provider
L.tileLayer(cartoDBPositron, {
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> | &copy; <a href="https://carto.com/attributions">CARTO</a>',
  maxZoom: 19,
}).addTo(map);
```

**Raccomandazione**: **CartoDB Positron** (minimalista, professionale, bus markers ben visibili)

### 3.3 Polylines (Percorsi Linee)

```tsx
// Disegna percorso linea su mappa
import { decode } from '@googlemaps/polyline-codec'; // per Google encoded polyline

function drawRoute(map: L.Map, route: Route) {
  // Decode Google polyline format
  const coordinates = decode(route.polyline);

  // Converti in formato Leaflet [lat, lng]
  const latLngs: L.LatLngExpression[] = coordinates.map(([lat, lng]) => [lat, lng]);

  // Disegna polyline
  const polyline = L.polyline(latLngs, {
    color: route.line_color || '#3b82f6',
    weight: 4,
    opacity: 0.7,
  }).addTo(map);

  // Aggiungi fermate (circles)
  route.stops.forEach(stop => {
    L.circleMarker([stop.latitude, stop.longitude], {
      radius: 6,
      fillColor: '#ef4444',
      fillOpacity: 1,
      color: '#fff',
      weight: 2,
    })
      .addTo(map)
      .bindPopup(`<strong>${stop.name}</strong>`);
  });

  return polyline;
}
```

### 3.4 Marker Clustering (Se >50 bus in futuro)

```bash
npm install leaflet.markercluster
npm install @types/leaflet.markercluster --save-dev
```

```tsx
import L from 'leaflet';
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';

// Crea cluster group
const markers = L.markerClusterGroup({
  maxClusterRadius: 50,
  spiderfyOnMaxZoom: true,
  showCoverageOnHover: false,
  zoomToBoundsOnClick: true,
});

// Aggiungi marker a cluster
buses.forEach(bus => {
  const marker = L.marker([bus.latitude, bus.longitude]);
  markers.addLayer(marker);
});

map.addLayer(markers);
```

---

## 4. GEOCODING (Nominatim)

### 4.1 Reverse Geocoding (Coordinate → Indirizzo)

**Nominatim** è il servizio di geocoding gratuito di OpenStreetMap.

```typescript
// src/services/geocoding.service.ts

interface NominatimResponse {
  display_name: string;
  address: {
    road?: string;
    city?: string;
    postcode?: string;
    country?: string;
  };
}

export async function reverseGeocode(
  lat: number,
  lon: number
): Promise<string> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?` +
      `format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'BusTrackerApp/1.0' // OBBLIGATORIO per Nominatim
      }
    });

    if (!response.ok) throw new Error('Geocoding failed');

    const data: NominatimResponse = await response.json();
    return data.display_name;
  } catch (error) {
    console.error('Reverse geocoding error:', error);
    return `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
  }
}
```

**IMPORTANTE**: Nominatim ha rate limit (1 req/sec). Per uso production, considera:
- Caching aggressivo in PostgreSQL
- Debouncing richieste
- Self-hosting Nominatim (se >1000 req/giorno)

### 4.2 Geocoding (Indirizzo → Coordinate)

```typescript
// Per creazione fermate: utente inserisce indirizzo, ottieni coordinate

export async function geocodeAddress(address: string): Promise<{lat: number, lon: number} | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?` +
      `format=json&q=${encodeURIComponent(address)}&limit=1`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'BusTrackerApp/1.0'
      }
    });

    const data = await response.json();

    if (data.length === 0) return null;

    return {
      lat: parseFloat(data[0].lat),
      lon: parseFloat(data[0].lon),
    };
  } catch (error) {
    console.error('Geocoding error:', error);
    return null;
  }
}
```

---

## 5. ROUTING (OSRM - Optional)

Se serve calcolare percorsi ottimali (Directions API equivalent):

**OSRM (Open Source Routing Machine)** - Gratuito

```typescript
// Calcola percorso tra due punti

export async function calculateRoute(
  startLat: number,
  startLon: number,
  endLat: number,
  endLon: number
): Promise<{distance: number, duration: number, polyline: string} | null> {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/` +
      `${startLon},${startLat};${endLon},${endLat}?` +
      `overview=full&geometries=polyline`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.code !== 'Ok') return null;

    const route = data.routes[0];
    return {
      distance: route.distance, // metri
      duration: route.duration, // secondi
      polyline: route.geometry,
    };
  } catch (error) {
    console.error('Routing error:', error);
    return null;
  }
}
```

**Nota**: OSRM public server ha rate limits. Per production self-host o usa GraphHopper.

---

## 6. CONFRONTO COSTI

### Google Maps (10 bus, stima conservativa)

| Servizio | Uso/Mese | Costo Unitario | Totale | Note |
|----------|----------|----------------|--------|------|
| Map Loads | 6,000 | $0.007 (dopo 28k free) | **$0** | Sotto quota free |
| Geocoding | 50 | $0.005 | **$0.25** | One-time setup |
| Directions (opzionale) | 100 | $0.05 | **$5** | Se implementato |
| **Totale Mese** | - | - | **€0-5** | ✅ Accettabile |

**Rischi**:
- ⚠️ Sforamento quota se operatori aprono mappa frequentemente
- ⚠️ Necessità billing account Google Cloud (carta credito obbligatoria)

### OpenStreetMap + Leaflet.js

| Servizio | Uso/Mese | Costo | Totale |
|----------|----------|-------|--------|
| Tile Loading (Leaflet) | Illimitato | **€0** | **€0** |
| Geocoding (Nominatim) | 50-100 | **€0** | **€0** |
| Routing (OSRM) | 100 | **€0** | **€0** |
| **Totale Mese** | - | - | **€0** 🎉 |

**Vantaggi**:
- ✅ Zero costi assoluti
- ✅ Zero setup billing
- ✅ Nessuna carta credito richiesta

---

## 7. PERFORMANCE COMPARISON

### Bundle Size

- **Google Maps API**: ~1 MB (lazy loaded)
- **Leaflet.js**: ~39 KB (minified + gzipped) → **96% più leggero** ✅

### Map Load Time (network cache cold)

- **Google Maps**: ~1.2-1.5s
- **Leaflet + OSM tiles**: ~0.8-1.2s → **Leggermente più veloce** ✅

### Rendering Performance (10 marker)

- **Google Maps**: 60 FPS
- **Leaflet.js**: 60 FPS → **Identico** ✅

**Conclusione**: Leaflet.js è più performante e leggero.

---

## 8. MIGRAZIONE GOOGLE MAPS → OPENSTREETMAP

Se inizi con Google Maps e vuoi migrare in futuro:

### 8.1 Compatibilità Polyline Format

Google e Leaflet usano stesso formato encoded polyline ✅

```typescript
import { decode } from '@googlemaps/polyline-codec';

// Polyline salvato da Google Maps Editor funziona identico con Leaflet
const coordinates = decode(route.polyline);
const leafletPolyline = L.polyline(coordinates.map(([lat, lng]) => [lat, lng]));
```

### 8.2 Adapter Pattern (Supporta Entrambi)

```typescript
// src/lib/map-adapter.ts

type MapProvider = 'google' | 'leaflet';

interface MapAdapter {
  createMap(container: HTMLElement, center: [number, number], zoom: number): void;
  addMarker(lat: number, lon: number, options: MarkerOptions): Marker;
  addPolyline(coordinates: [number, number][], options: PolylineOptions): Polyline;
}

class LeafletAdapter implements MapAdapter {
  private map: L.Map;

  createMap(container: HTMLElement, center: [number, number], zoom: number) {
    this.map = L.map(container).setView(center, zoom);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(this.map);
  }

  addMarker(lat: number, lon: number, options: MarkerOptions) {
    return L.marker([lat, lon]).addTo(this.map);
  }

  // ... altri metodi
}

class GoogleMapsAdapter implements MapAdapter {
  private map: google.maps.Map;

  createMap(container: HTMLElement, center: [number, number], zoom: number) {
    this.map = new google.maps.Map(container, {
      center: { lat: center[0], lng: center[1] },
      zoom,
    });
  }

  // ... altri metodi
}

// Factory
export function createMapAdapter(provider: MapProvider): MapAdapter {
  return provider === 'google' ? new GoogleMapsAdapter() : new LeafletAdapter();
}
```

Questo permette switch provider con config flag.

---

## 9. LIMITAZIONI OPENSTREETMAP (Casi Edge)

### Quando OSM NON È Ideale

1. **Street View**: Non disponibile
   - **Soluzione**: Mapillary (street-level imagery crowd-sourced, free)

2. **Places API** (ricerca POI, autocomplete indirizzi):
   - **Soluzione**: Nominatim search (meno accurato di Google)

3. **Traffic Real-Time**:
   - **Soluzione**: Non disponibile gratuitamente (solo Google/TomTom a pagamento)

4. **Dati sempre aggiornati**:
   - OSM può avere lag di giorni/settimane per nuove strade
   - Google aggiorna continuamente

### Per il Nostro Caso (10 Bus)

- ✅ **Non servono** Street View, Places, Traffic
- ✅ **Servono solo**: Mappa base, marker, polyline, geocoding base
- ✅ **Conclusione**: OpenStreetMap copre 100% dei requisiti

---

## 10. RACCOMANDAZIONE FINALE

### ✅ USARE OPENSTREETMAP + LEAFLET.JS

**Motivazioni Decisive**:

1. **Costo zero assoluto** vs €0-10/mese Google (piccolo ma evitabile)
2. **Nessuna complessità billing/API key**
3. **Performance migliore** (bundle 96% più leggero)
4. **Privacy-first** (GDPR friendly)
5. **Open source** (no vendor lock-in)
6. **Funzionalità sufficienti** per tracking 10 bus

**Quando Riconsiderare Google Maps**:

- Se serve Street View integrato
- Se serve autocomplete indirizzi avanzato (Places API)
- Se serve Traffic real-time
- Se cliente insiste su "brand Google"

Per tutto il resto: **OpenStreetMap è la scelta migliore** ✅

---

## 11. IMPLEMENTAZIONE CONSIGLIATA

### Setup Iniziale (15 minuti)

```bash
# 1. Installa Leaflet
npm install leaflet
npm install @types/leaflet --save-dev

# 2. Crea componente mappa
# Vedi esempio codice sezione 3.1

# 3. Tile provider: CartoDB Positron (minimal)
# Vedi esempio codice sezione 3.2

# 4. Geocoding: Nominatim con caching PostgreSQL
# Vedi esempio codice sezione 4.1
```

### Database Cache Geocoding

```sql
-- Tabella cache per evitare chiamate ripetute a Nominatim
CREATE TABLE geocoding_cache (
  id SERIAL PRIMARY KEY,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  address TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(latitude, longitude)
);

CREATE INDEX idx_geocoding_coords ON geocoding_cache(latitude, longitude);
```

```typescript
// Geocoding con cache
async function getCachedAddress(lat: number, lon: number): Promise<string> {
  // Check cache PostgreSQL
  const cached = await db.query(
    'SELECT address FROM geocoding_cache WHERE latitude = $1 AND longitude = $2',
    [lat, lon]
  );

  if (cached.rows.length > 0) {
    return cached.rows[0].address;
  }

  // Cache miss: chiama Nominatim
  const address = await reverseGeocode(lat, lon);

  // Salva in cache
  await db.query(
    'INSERT INTO geocoding_cache (latitude, longitude, address) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
    [lat, lon, address]
  );

  return address;
}
```

---

## 12. MIGRAZIONE DOCS ESISTENTI

Aggiorno documenti precedenti con riferimento OpenStreetMap:

- **Doc 01 (Architettura)**: Sostituisci Google Maps con Leaflet.js
- **Doc 02 (API)**: Nessun cambio (backend-agnostic)
- **Doc 04 (UI Flows)**: Sostituisci screenshot Google Maps con OSM
- **Doc 07 (Sizing 10 bus)**: Costi Google Maps €0-10 → **€0 con OSM** ✅

---

## CONCLUSIONE

Per **10 bus** con requisiti base (tracking, mappa, marker, percorsi):

🏆 **OpenStreetMap + Leaflet.js è la scelta ottimale**

- Costo: **€0** (vs €0-10 Google)
- Performance: **Migliore** (bundle più leggero)
- Privacy: **Migliore** (no tracking)
- Complessità: **Minore** (no billing setup)
- Affidabilità: **Identica** (OSM uptime 99.9%+)

**Implementazione**: ~1 giorno (vs 1 giorno Google Maps, stesso effort)

**Decisione**: ✅ **Procedere con OpenStreetMap**
