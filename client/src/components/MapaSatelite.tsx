import { useEffect, useRef, useState } from "react";
import { Maximize2, Minimize2, MapPin, Search, X, Loader2, Pencil, Trash2, Crosshair, Undo2 } from "lucide-react";

interface Props {
  lat: string;
  lng: string;
  onSelect?: (lat: number, lng: number) => void;
  onLocationFound?: (info: { municipio?: string; region?: string; pais?: string; altitud?: string }) => void;
  onPolygonChange?: (info: { polygon: number[][] | null; areaHa: number | null }) => void;
  initialPolygon?: number[][] | null;
  readonly?: boolean;
  pais?: string;
}

const MAPTILER_KEY = "XgBpftLrirF6DzSrbFzv";
type LayerType = "maptiler" | "pnoa" | "esri";

interface SearchResult {
  text: string; place_name: string; center: [number, number];
  context?: { id: string; text: string }[]; place_type?: string[];
}

function polygonAreaHa(coords: number[][]): number {
  if (coords.length < 3) return 0;
  const R = 6378137;
  let area = 0;
  for (let i = 0; i < coords.length; i++) {
    const [lng1, lat1] = coords[i];
    const [lng2, lat2] = coords[(i + 1) % coords.length];
    area += (lng2 - lng1) * Math.PI / 180 * (2 + Math.sin(lat1 * Math.PI / 180) + Math.sin(lat2 * Math.PI / 180));
  }
  return Math.abs(area * R * R / 2) / 10000;
}

// Centroide del polígono para colocar la etiqueta
function polygonCentroid(coords: number[][]): [number, number] {
  const lat = coords.reduce((s, [la]) => s + la, 0) / coords.length;
  const lng = coords.reduce((s, [, ln]) => s + ln, 0) / coords.length;
  return [lat, lng];
}

export default function MapaSatelite({ lat, lng, onSelect, onLocationFound, onPolygonChange, initialPolygon, readonly, pais }: Props) {
  const divRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const polygonRef = useRef<any>(null);
  const labelRef = useRef<any>(null); // etiqueta de superficie
  const midMarkersRef = useRef<any[]>([]); // marcadores de punto medio para insertar vértice
  const drawingRef = useRef<{ active: boolean; points: number[][]; tempLayer: any; tempMarkers: any[] }>({ active: false, points: [], tempLayer: null, tempMarkers: [] });
  const editVertexMarkersRef = useRef<any[]>([]);

  const [expanded, setExpanded] = useState(false);
  const [savedPolygon, setSavedPolygon] = useState<number[][] | null>(initialPolygon || null);
  const defaultLayer: LayerType = pais === "España" ? "pnoa" : "maptiler";
  const [layer, setLayer] = useState<LayerType>(defaultLayer);

  // Si cambia el país a algo distinto de España, cambiar de PNOA a Mundial
  useEffect(() => {
    if (pais !== "España" && layer === "pnoa") {
      setLayer("maptiler");
    }
  }, [pais]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [searching, setSearching] = useState(false);
  const [drawingMode, setDrawingMode] = useState(false);
  const [editingMode, setEditingMode] = useState(false);
  const [markerMode, setMarkerMode] = useState(true);
  const [currentArea, setCurrentArea] = useState<number | null>(initialPolygon ? polygonAreaHa(initialPolygon.map(([la, ln]) => [ln, la])) : null);
  const [, forceUpdate] = useState(0);
  const coords = { lat: lat || "", lng: lng || "" };
  const latN = parseFloat(lat || "");
  const lngN = parseFloat(lng || "");
  const hasCoords = !isNaN(latN) && !isNaN(lngN) && !!lat && !!lng;

  useEffect(() => {
    if (initialPolygon && !savedPolygon) {
      setSavedPolygon(initialPolygon);
      setCurrentArea(polygonAreaHa(initialPolygon.map(([la, ln]) => [ln, la])));
    }
  }, [initialPolygon]);

  useEffect(() => {
    if (searchQuery.length < 3) { setSearchResults([]); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const url = `https://api.maptiler.com/geocoding/${encodeURIComponent(searchQuery)}.json?key=${MAPTILER_KEY}&language=es&limit=6`;
        const res = await fetch(url);
        const data = await res.json();
        setSearchResults(data.features || []);
        setShowResults(true);
      } catch (e) { console.error(e); }
      finally { setSearching(false); }
    }, 400);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const getElevation = async (la: number, lo: number) => {
    try {
      const res = await fetch(`https://api.open-meteo.com/v1/elevation?latitude=${la}&longitude=${lo}`);
      const data = await res.json();
      return data.elevation?.[0] != null ? Math.round(data.elevation[0]).toString() : "";
    } catch { return ""; }
  };

  const reverseGeocode = async (la: number, lo: number) => {
    if (!onLocationFound) return;
    try {
      const url = `https://api.maptiler.com/geocoding/${lo},${la}.json?key=${MAPTILER_KEY}&language=es`;
      const res = await fetch(url);
      const data = await res.json();
      const feature = data.features?.[0];
      let municipio = "", region = "", paisFound = "";
      if (feature) {
        if (feature.context) {
          for (const ctx of feature.context as any[]) {
            if (ctx.id?.startsWith("municipality") || ctx.id?.startsWith("place")) municipio = ctx.text;
            else if (ctx.id?.startsWith("region") || ctx.id?.startsWith("subregion")) region = ctx.text;
            else if (ctx.id?.startsWith("country")) paisFound = ctx.text;
          }
        }
        if (!municipio && feature.place_type?.includes("place")) municipio = feature.text;
      }
      const altitud = await getElevation(la, lo);
      onLocationFound({ municipio, region, pais: paisFound, altitud });
    } catch (e) { console.error(e); }
  };

  const selectResult = async (result: SearchResult) => {
    const [lo, la] = result.center;
    const laR = parseFloat(la.toFixed(6)), loR = parseFloat(lo.toFixed(6));
    if (onSelect) onSelect(laR, loR);
    if (onLocationFound) {
      let municipio = "", region = "", paisFound = "";
      if (result.context) {
        for (const ctx of result.context) {
          if (ctx.id?.startsWith("municipality") || ctx.id?.startsWith("place")) municipio = ctx.text;
          else if (ctx.id?.startsWith("region") || ctx.id?.startsWith("subregion")) region = ctx.text;
          else if (ctx.id?.startsWith("country")) paisFound = ctx.text;
        }
      }
      if (!municipio) municipio = result.text;
      const altitud = await getElevation(laR, loR);
      onLocationFound({ municipio, region, pais: paisFound, altitud });
    }
    setSearchQuery(""); setSearchResults([]); setShowResults(false);
    if (mapRef.current) mapRef.current.setView([laR, loR], 16);
  };

  // ─── Etiqueta de superficie en el mapa ───────────────────────────────
  const updateLabel = (area: number, points: number[][]) => {
    const L = (window as any).L;
    if (!L || !mapRef.current) return;
    if (labelRef.current) mapRef.current.removeLayer(labelRef.current);
    if (points.length < 3) return;
    const [cLat, cLng] = polygonCentroid(points);
    const html = `<div style="background:rgba(22,163,74,0.85);color:white;padding:3px 8px;border-radius:6px;font-size:13px;font-weight:600;white-space:nowrap;box-shadow:0 1px 4px rgba(0,0,0,0.3)">${area.toFixed(2)} ha</div>`;
    labelRef.current = L.marker([cLat, cLng], {
      icon: L.divIcon({ html, className: "", iconAnchor: [0, 0] }),
      interactive: false,
    }).addTo(mapRef.current);
  };

  const clearLabel = () => {
    if (labelRef.current && mapRef.current) {
      mapRef.current.removeLayer(labelRef.current);
      labelRef.current = null;
    }
  };

  // ─── Marcadores de punto medio para insertar vértice ─────────────────
  const updateMidMarkers = (points: number[][]) => {
    const L = (window as any).L;
    if (!L || !mapRef.current) return;
    midMarkersRef.current.forEach(m => mapRef.current.removeLayer(m));
    midMarkersRef.current = [];
    if (points.length < 2) return;

    for (let i = 0; i < points.length; i++) {
      const [la1, ln1] = points[i];
      const [la2, ln2] = points[(i + 1) % points.length];
      const midLa = (la1 + la2) / 2, midLn = (ln1 + ln2) / 2;
      const idx = i;
      const midIcon = L.divIcon({
        html: `<div style="width:10px;height:10px;background:#f97316;border:2px solid white;border-radius:50%;cursor:copy;box-shadow:0 1px 3px rgba(0,0,0,0.3)"></div>`,
        iconSize: [10, 10], iconAnchor: [5, 5], className: "",
      });
      const m = L.marker([midLa, midLn], { icon: midIcon }).addTo(mapRef.current);
      m.on("click", (e: any) => {
        L.DomEvent.stopPropagation(e);
        const newPoints = [...points];
        newPoints.splice(idx + 1, 0, [midLa, midLn]);
        rebuildEditMarkers(newPoints);
      });
      midMarkersRef.current.push(m);
    }
  };

  // ─── Reconstruir todos los marcadores de edición ─────────────────────
  const rebuildEditMarkers = (points: number[][]) => {
    const L = (window as any).L;
    if (!L || !mapRef.current) return;
    if (!points || points.length < 3) return;

    // Limpiar anteriores con try/catch defensivo
    editVertexMarkersRef.current.forEach(m => {
      try { mapRef.current?.removeLayer(m); } catch {}
    });
    editVertexMarkersRef.current = [];
    midMarkersRef.current.forEach(m => {
      try { mapRef.current?.removeLayer(m); } catch {}
    });
    midMarkersRef.current = [];

    const onUpdate = () => {
      try {
        const newPts = editVertexMarkersRef.current.map(m => {
          const ll = m.getLatLng();
          return [parseFloat(ll.lat.toFixed(6)), parseFloat(ll.lng.toFixed(6))];
        });
        if (newPts.length < 3) return;
        if (polygonRef.current) polygonRef.current.setLatLngs(newPts);
        const areaHa = polygonAreaHa(newPts.map(([la, ln]) => [ln, la]));
        setCurrentArea(areaHa);
        setSavedPolygon([...newPts]);
        updateLabel(areaHa, newPts);
        if (onPolygonChange) onPolygonChange({ polygon: newPts, areaHa });
      } catch (err) { console.error("Error en onUpdate:", err); }
    };

    // Actualizar polígono con los nuevos puntos
    try {
      if (polygonRef.current) polygonRef.current.setLatLngs(points);
    } catch {}
    const areaHa = polygonAreaHa(points.map(([la, ln]) => [ln, la]));
    setCurrentArea(areaHa);
    setSavedPolygon([...points]);
    updateLabel(areaHa, points);

    // Crear vértices arrastrables
    editVertexMarkersRef.current = points.map(([la, ln]) => {
      const editIcon = L.divIcon({
        html: `<div style="width:14px;height:14px;background:#06b6d4;border:3px solid white;border-radius:50%;cursor:move;box-shadow:0 1px 4px rgba(0,0,0,0.4)"></div>`,
        iconSize: [14, 14], iconAnchor: [7, 7], className: "",
      });
      const m = L.marker([la, ln], { icon: editIcon, draggable: true }).addTo(mapRef.current);
      m.on("drag", onUpdate);
      m.on("dragend", () => {
        onUpdate();
        try {
          const newPts = editVertexMarkersRef.current.map(mk => {
            const ll = mk.getLatLng();
            return [parseFloat(ll.lat.toFixed(6)), parseFloat(ll.lng.toFixed(6))];
          });
          updateMidMarkers(newPts);
        } catch (err) { console.error("Error en dragend:", err); }
      });
      return m;
    });

    updateMidMarkers(points);
    if (onPolygonChange) onPolygonChange({ polygon: points, areaHa });
  };

  // ─── Inicio de edición ───────────────────────────────────────────────
  const [backupPolygon, setBackupPolygon] = useState<number[][] | null>(null);

  const startEditing = (points: number[][]) => {
    setEditingMode(true);
    setMarkerMode(false);
    rebuildEditMarkers(points);
  };

  const startDrawingWithBackup = () => {
    // Guardar polígono actual como backup antes de redibujar
    if (savedPolygon) setBackupPolygon([...savedPolygon]);
    startDrawing();
  };

  const restoreBackup = () => {
    const L = (window as any).L;
    if (!L || !mapRef.current || !backupPolygon) return;
    if (editingMode) finishEditing();
    if (polygonRef.current) { mapRef.current.removeLayer(polygonRef.current); polygonRef.current = null; }
    polygonRef.current = L.polygon(backupPolygon, { color: "#16a34a", weight: 3, fillColor: "#16a34a", fillOpacity: 0.2 }).addTo(mapRef.current);
    const areaHa = polygonAreaHa(backupPolygon.map(([la, ln]) => [ln, la]));
    setCurrentArea(areaHa);
    setSavedPolygon([...backupPolygon]);
    updateLabel(areaHa, backupPolygon);
    if (onPolygonChange) onPolygonChange({ polygon: backupPolygon, areaHa });
    setBackupPolygon(null);
    startEditing([...backupPolygon]);
    // Limpiar modo dibujo si estaba activo
    const draw = drawingRef.current;
    draw.tempMarkers.forEach(m => mapRef.current?.removeLayer(m));
    if (draw.tempLayer) mapRef.current?.removeLayer(draw.tempLayer);
    drawingRef.current = { active: false, points: [], tempLayer: null, tempMarkers: [] };
    setDrawingMode(false);
  };

  const finishEditing = () => {
    editVertexMarkersRef.current.forEach(m => mapRef.current?.removeLayer(m));
    editVertexMarkersRef.current = [];
    midMarkersRef.current.forEach(m => mapRef.current?.removeLayer(m));
    midMarkersRef.current = [];
    setEditingMode(false);
    setMarkerMode(true);
  };

  // ─── Dibujo de nuevo polígono ────────────────────────────────────────
  const finishDrawing = () => {
    const L = (window as any).L;
    if (!L || !mapRef.current) return;
    const draw = drawingRef.current;

    // 1. Guardar copia de los puntos antes de tocar nada
    const pointsCopy = [...draw.points];

    // 2. Marcar como inactivo INMEDIATAMENTE para evitar reentradas
    drawingRef.current = { active: false, points: [], tempLayer: null, tempMarkers: [] };

    // 3. Limpiar marcadores temporales y línea
    draw.tempMarkers.forEach(m => {
      try { mapRef.current?.removeLayer(m); } catch {}
    });
    if (draw.tempLayer) {
      try { mapRef.current?.removeLayer(draw.tempLayer); } catch {}
    }

    // 4. Si menos de 3 puntos, salir
    if (pointsCopy.length < 3) {
      setDrawingMode(false);
      setMarkerMode(true);
      return;
    }

    // 5. Crear el polígono final
    if (polygonRef.current) {
      try { mapRef.current?.removeLayer(polygonRef.current); } catch {}
    }
    polygonRef.current = L.polygon(pointsCopy, {
      color: "#16a34a", weight: 3, fillColor: "#16a34a", fillOpacity: 0.2
    }).addTo(mapRef.current);

    const areaHa = polygonAreaHa(pointsCopy.map(([la, ln]) => [ln, la]));
    setCurrentArea(areaHa);
    setSavedPolygon(pointsCopy);
    updateLabel(areaHa, pointsCopy);
    if (onPolygonChange) onPolygonChange({ polygon: pointsCopy, areaHa });

    setDrawingMode(false);
    mapRef.current?.doubleClickZoom?.enable?.();

    // 6. Entrar en modo edición — diferido para que React haya re-renderizado
    setTimeout(() => {
      try { startEditing(pointsCopy); }
      catch (err) { console.error("Error al iniciar edición:", err); }
    }, 50);
  };

  const undoLastPoint = () => {
    const draw = drawingRef.current;
    if (draw.points.length === 0) return;
    const lastMarker = draw.tempMarkers.pop();
    if (lastMarker) mapRef.current?.removeLayer(lastMarker);
    draw.points.pop();
    if (draw.tempLayer) mapRef.current?.removeLayer(draw.tempLayer);
    const L = (window as any).L;
    if (draw.points.length > 0 && L) {
      draw.tempLayer = L.polyline(draw.points, { color: "#16a34a", dashArray: "5,5", weight: 2 }).addTo(mapRef.current);
    } else { draw.tempLayer = null; }
    forceUpdate(n => n + 1);
  };

  const startDrawing = () => {
    if (editingMode) finishEditing();
    if (polygonRef.current) { mapRef.current?.removeLayer(polygonRef.current); polygonRef.current = null; }
    clearLabel();
    setSavedPolygon(null); setCurrentArea(null);
    setMarkerMode(false); setDrawingMode(true);
    mapRef.current?.doubleClickZoom?.disable?.();
    drawingRef.current = { active: true, points: [], tempLayer: null, tempMarkers: [] };
  };

  const clearPolygon = () => {
    if (editingMode) finishEditing();
    if (polygonRef.current) { mapRef.current?.removeLayer(polygonRef.current); polygonRef.current = null; }
    clearLabel();
    setSavedPolygon(null); setCurrentArea(null);
    if (onPolygonChange) onPolygonChange({ polygon: null, areaHa: null });
  };

  useEffect(() => {
    if (!divRef.current) return;
    const initMap = async () => {
      if (!document.getElementById("leaflet-css")) {
        const link = document.createElement("link");
        link.id = "leaflet-css"; link.rel = "stylesheet";
        link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
        document.head.appendChild(link);
      }
      if (!(window as any).L) {
        await new Promise<void>(resolve => {
          const s = document.createElement("script");
          s.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
          s.onload = () => resolve();
          document.head.appendChild(s);
        });
      }
      const L = (window as any).L;
      if (!divRef.current) return;
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; markerRef.current = null; polygonRef.current = null; labelRef.current = null; }

      const sc = (window as any)._agrivisit_map_center;
      const sz = (window as any)._agrivisit_map_zoom;
      const iLat = sc ? sc[0] : (hasCoords ? latN : 37.5);
      const iLng = sc ? sc[1] : (hasCoords ? lngN : -5.9);
      const iZoom = sz ?? (hasCoords ? 16 : 6);

      const map = L.map(divRef.current, { zoomControl: true, attributionControl: true }).setView([iLat, iLng], iZoom);
      mapRef.current = map;

      if (layer === "pnoa") {
        L.tileLayer.wms("https://www.ign.es/wms-inspire/pnoa-ma", { layers: "OI.OrthoimageCoverage", format: "image/jpeg", attribution: "© PNOA · IGN España", maxZoom: 19 }).addTo(map);
      } else if (layer === "esri") {
        L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", { attribution: "© Esri", maxZoom: 19 }).addTo(map);
      } else {
        L.tileLayer(`https://api.maptiler.com/tiles/satellite-v2/{z}/{x}/{y}.jpg?key=${MAPTILER_KEY}`, { attribution: "© MapTiler", maxZoom: 20 }).addTo(map);
      }
      L.tileLayer(`https://api.maptiler.com/maps/hybrid/{z}/{x}/{y}.png?key=${MAPTILER_KEY}`, { maxZoom: 20, opacity: 0.6 }).addTo(map);

      // Polígono guardado + modo edición automático
      if (savedPolygon && savedPolygon.length >= 3) {
        polygonRef.current = L.polygon(savedPolygon, { color: "#16a34a", weight: 3, fillColor: "#16a34a", fillOpacity: 0.2 }).addTo(map);
        const areaHa = polygonAreaHa(savedPolygon.map(([la, ln]) => [ln, la]));
        updateLabel(areaHa, savedPolygon);
        // Entrar en modo edición automáticamente
        setTimeout(() => startEditing(savedPolygon), 100);
      }

      const icon = L.divIcon({
        html: `<div style="width:20px;height:20px;background:#16a34a;border:3px solid white;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,0.5)"></div>`,
        iconSize: [20, 20], iconAnchor: [10, 10], className: "",
      });

      if (hasCoords) {
        markerRef.current = L.marker([latN, lngN], { icon, draggable: !readonly }).addTo(map);
        if (!readonly && onSelect) {
          markerRef.current.on("dragend", (e: any) => {
            const pos = e.target.getLatLng();
            onSelect(parseFloat(pos.lat.toFixed(6)), parseFloat(pos.lng.toFixed(6)));
            reverseGeocode(pos.lat, pos.lng);
          });
        }
      }

      map.on("click", (e: any) => {
        const la = parseFloat(e.latlng.lat.toFixed(6)), lo = parseFloat(e.latlng.lng.toFixed(6));
        const draw = drawingRef.current;
        if (draw.active) {
          const isFirst = draw.points.length === 0;
          draw.points.push([la, lo]);

          const vi = L.divIcon({
            html: `<div style="width:${isFirst ? '16px' : '10px'};height:${isFirst ? '16px' : '10px'};background:${isFirst ? '#16a34a' : '#06b6d4'};border:${isFirst ? '3px' : '2px'} solid white;border-radius:50%;cursor:${isFirst ? 'crosshair' : 'pointer'};box-shadow:0 1px 4px rgba(0,0,0,0.5)"></div>`,
            iconSize: [isFirst ? 16 : 10, isFirst ? 16 : 10],
            iconAnchor: [isFirst ? 8 : 5, isFirst ? 8 : 5],
            className: ""
          });
          const m = L.marker([la, lo], { icon: vi }).addTo(map);

          if (isFirst) {
            m.bindTooltip("Clic aquí para cerrar", { permanent: false, direction: "top", offset: [0, -12] });
            // CRÍTICO: usar setTimeout para diferir finishDrawing fuera del ciclo de Leaflet
            // Si llamamos a finishDrawing síncronamente desde aquí, removeLayer(este_marker)
            // se ejecuta mientras Leaflet aún está procesando el click → excepción.
            m.on("click", (ev: any) => {
              L.DomEvent.stopPropagation(ev);
              if (drawingRef.current.points.length >= 3) {
                setTimeout(() => {
                  try { finishDrawing(); }
                  catch (err) { console.error("Error al cerrar polígono:", err); }
                }, 0);
              }
            });
          }

          draw.tempMarkers.push(m);
          if (draw.tempLayer) map.removeLayer(draw.tempLayer);
          draw.tempLayer = L.polyline(draw.points, { color: "#16a34a", dashArray: "5,5", weight: 2 }).addTo(map);
          forceUpdate(n => n + 1);

        } else if (!readonly && onSelect && markerMode) {
          if (markerRef.current) markerRef.current.setLatLng([la, lo]);
          else {
            markerRef.current = L.marker([la, lo], { icon, draggable: true }).addTo(map);
            markerRef.current.on("dragend", (ev: any) => {
              const pos = ev.target.getLatLng();
              onSelect(parseFloat(pos.lat.toFixed(6)), parseFloat(pos.lng.toFixed(6)));
              reverseGeocode(pos.lat, pos.lng);
            });
          }
          onSelect(la, lo);
          reverseGeocode(la, lo);
        }
      });

      map.on("dblclick", (e: any) => {
        if (drawingRef.current.active) {
          e.originalEvent?.preventDefault?.();
          e.originalEvent?.stopPropagation?.();
          if (drawingRef.current.points.length >= 3) {
            setTimeout(() => {
              try { finishDrawing(); }
              catch (err) { console.error("Error al cerrar polígono:", err); }
            }, 0);
          }
        }
      });
    };

    initMap();
    return () => {
      if (mapRef.current) {
        const c = mapRef.current.getCenter();
        (window as any)._agrivisit_map_center = [c.lat, c.lng];
        (window as any)._agrivisit_map_zoom = mapRef.current.getZoom();
        mapRef.current.remove();
        mapRef.current = null; markerRef.current = null;
        polygonRef.current = null; labelRef.current = null;
        editVertexMarkersRef.current = []; midMarkersRef.current = [];
      }
    };
  }, [expanded, layer]);

  useEffect(() => {
    if (!mapRef.current || !hasCoords || !markerRef.current) return;
    markerRef.current.setLatLng([latN, lngN]);
  }, [lat, lng]);

  const renderSearch = (inExpanded: boolean) => (
    <div className={`relative ${inExpanded ? "w-72" : "flex-1 max-w-xs"}`}>
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
        <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
          onFocus={() => searchResults.length > 0 && setShowResults(true)}
          placeholder="Buscar dirección, municipio..."
          className={`w-full pl-8 pr-7 py-1.5 text-xs rounded-lg border ${inExpanded ? "bg-gray-800 border-gray-700 text-white placeholder-gray-500" : "bg-white border-gray-200"} focus:outline-none focus:ring-2 focus:ring-green-500`} />
        {searchQuery && <button onClick={() => { setSearchQuery(""); setSearchResults([]); }} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><X className="w-3.5 h-3.5" /></button>}
        {searching && <Loader2 className="absolute right-7 top-1/2 -translate-y-1/2 w-3.5 h-3.5 animate-spin text-gray-400" />}
      </div>
      {showResults && searchResults.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg shadow-lg border border-gray-200 max-h-72 overflow-y-auto z-[1000]">
          {searchResults.map((r, i) => (
            <button key={i} onClick={() => selectResult(r)} className="w-full text-left px-3 py-2 hover:bg-gray-50 border-b border-gray-50 last:border-0">
              <p className="text-sm text-gray-900">{r.text}</p>
              <p className="text-xs text-gray-500 truncate">{r.place_name}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );

  const renderTools = (inExpanded: boolean) => {
    const G = inExpanded;
    return (
      <div className="flex items-center gap-1.5 flex-wrap">
        {!drawingMode && !editingMode && (
          <button onClick={() => setMarkerMode(m => !m)}
            className={`flex items-center gap-1 px-2.5 py-1 text-xs rounded-lg ${markerMode ? (G ? "bg-green-600 text-white" : "bg-green-50 text-green-700 border border-green-200") : (G ? "bg-gray-700 text-gray-300" : "bg-gray-100 text-gray-600")}`}>
            <Crosshair className="w-3 h-3" /> {markerMode ? "Marcando" : "Marcar coords"}
          </button>
        )}
        {!drawingMode && !editingMode && !savedPolygon && (
          <button onClick={startDrawing}
            className={`flex items-center gap-1 px-2.5 py-1 text-xs rounded-lg ${G ? "bg-purple-600 text-white" : "bg-purple-50 text-purple-700 border border-purple-200"}`}>
            <Pencil className="w-3 h-3" /> Dibujar parcela
          </button>
        )}
          {drawingMode && (
          <>
            <span className={`text-xs ${G ? "text-yellow-300" : "text-purple-700 font-medium"}`}>
              {drawingRef.current.points.length} vértices · doble clic para terminar
            </span>
            <button onClick={undoLastPoint} disabled={drawingRef.current.points.length === 0}
              className={`flex items-center gap-1 text-xs px-2 py-1 rounded disabled:opacity-40 ${G ? "bg-amber-600 text-white" : "bg-amber-50 text-amber-700 border border-amber-200"}`}>
              <Undo2 className="w-3 h-3" /> Atrás
            </button>
            {drawingRef.current.points.length >= 3 && (
              <button onClick={finishDrawing}
                className={`text-xs px-2 py-1 rounded ${G ? "bg-green-600 text-white" : "bg-green-50 text-green-700 border border-green-200"}`}>✓ Terminar</button>
            )}
            {backupPolygon && (
              <button onClick={restoreBackup}
                className={`flex items-center gap-1 text-xs px-2 py-1 rounded ${G ? "bg-blue-600 text-white" : "bg-blue-50 text-blue-700 border border-blue-200"}`}>
                ↩ Recuperar anterior
              </button>
            )}
            <button onClick={() => {
              const d = drawingRef.current;
              d.tempMarkers.forEach(m => mapRef.current?.removeLayer(m));
              if (d.tempLayer) mapRef.current?.removeLayer(d.tempLayer);
              drawingRef.current = { active: false, points: [], tempLayer: null, tempMarkers: [] };
              setDrawingMode(false); setMarkerMode(true);
              // Si había backup, restaurar el polígono anterior
              if (backupPolygon) restoreBackup();
            }} className="text-xs px-2 py-1 bg-gray-200 text-gray-700 rounded">Cancelar</button>
          </>
        )}
        {savedPolygon && !drawingMode && (
          <>
            <span className={`text-xs px-2 py-1 rounded font-medium ${G ? "bg-green-600 text-white" : "bg-green-50 text-green-700 border border-green-200"}`}>
              {currentArea?.toFixed(2)} ha
            </span>
            {!editingMode && (
              <button onClick={() => startEditing(savedPolygon)}
                className={`flex items-center gap-1 text-xs px-2 py-1 rounded ${G ? "bg-purple-600 text-white" : "bg-purple-50 text-purple-700 border border-purple-200"}`}>
                <Pencil className="w-3 h-3" /> Editar vértices
              </button>
            )}
            {editingMode && (
              <button onClick={finishEditing}
                className={`text-xs px-2 py-1 rounded ${G ? "bg-green-600 text-white" : "bg-green-50 text-green-700 border border-green-200"}`}>
                ✓ Terminar edición
              </button>
            )}
            <button onClick={startDrawingWithBackup}
              className={`text-xs px-2 py-1 rounded ${G ? "bg-gray-700 text-white" : "bg-gray-100 text-gray-700"}`}>Redibujar</button>
            <button onClick={clearPolygon}
              className={`text-xs px-2 py-1 rounded ${G ? "bg-red-600 text-white" : "bg-red-50 text-red-600"}`}>
              <Trash2 className="w-3 h-3" />
            </button>
            {editingMode && (
              <span className={`text-xs ${G ? "text-cyan-300" : "text-purple-600"}`}>
                Arrastra vértices cian · pulsa puntos naranjas para añadir
              </span>
            )}
          </>
        )}
      </div>
    );
  };

  return (
    <>
      {expanded && (
        <div className="fixed inset-0 z-50 flex flex-col" style={{ background: "#000" }}>
          <div className="flex items-center gap-3 px-4 py-2 bg-gray-900 text-white flex-wrap">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-green-400" />
              <span className="text-sm font-medium whitespace-nowrap">{hasCoords ? `${latN.toFixed(5)}, ${lngN.toFixed(5)}` : "Sin ubicar"}</span>
            </div>
            {renderSearch(true)}
            {!readonly && renderTools(true)}
            <div className="flex bg-gray-800 rounded-lg p-0.5 ml-auto">
              {(["pnoa", "maptiler", "esri"] as LayerType[]).map(l => (
                <button key={l} onClick={() => { if (l === "pnoa" && pais !== "España") return; setLayer(l); }}
                  title={l === "pnoa" && pais !== "España" ? "PNOA solo disponible para España" : undefined}
                  className={`px-3 py-1 text-xs rounded transition-colors ${
                    layer === l ? "bg-green-600 text-white" :
                    l === "pnoa" && pais !== "España" ? "text-gray-600 cursor-not-allowed opacity-40" :
                    "text-gray-400 hover:text-white"
                  }`}>
                  {l === "pnoa" ? "PNOA 🇪🇸" : l === "maptiler" ? "Mundial" : "Esri"}
                </button>
              ))}
            </div>
            <button onClick={() => setExpanded(false)} className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700">
              <Minimize2 className="w-4 h-4" /> Cerrar
            </button>
          </div>
          <div ref={divRef} style={{ flex: 1 }} />
        </div>
      )}
      {!expanded && (
        <div className="col-span-2">
          <div className="flex items-center justify-between mb-1.5 gap-2 flex-wrap">
            <p className="text-sm font-medium text-gray-700">
              {readonly ? "Ubicación" : hasCoords ? `📍 ${latN.toFixed(5)}, ${lngN.toFixed(5)}` : "Busca o haz clic en el mapa"}
            </p>
            <div className="flex items-center gap-2 flex-wrap">
              {renderSearch(false)}
              {!readonly && renderTools(false)}
              <div className="flex bg-gray-100 rounded-lg p-0.5">
                <button onClick={() => { if (pais !== "España") return; setLayer("pnoa"); }}
                  title={pais !== "España" ? "PNOA solo disponible en España" : ""}
                  className={`px-2 py-0.5 text-xs rounded transition-colors ${
                    layer === "pnoa" ? "bg-white shadow-sm text-gray-900" :
                    pais !== "España" ? "text-gray-300 cursor-not-allowed" : "text-gray-500 hover:text-gray-700"
                  }`}>PNOA 🇪🇸</button>
                <button onClick={() => setLayer("maptiler")}
                  className={`px-2 py-0.5 text-xs rounded ${layer === "maptiler" ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"}`}>
                  Mundial
                </button>
              </div>
              <button onClick={() => setExpanded(true)} className="flex items-center gap-1.5 text-xs px-2.5 py-1 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200">
                <Maximize2 className="w-3 h-3" /> Expandir
              </button>
            </div>
          </div>
          <div ref={divRef} style={{ height: 280, borderRadius: 12, overflow: "hidden", border: "1px solid #e5e7eb", background: "#1a1a2e" }} />
        </div>
      )}
    </>
  );
}
