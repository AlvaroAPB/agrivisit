import { useEffect, useRef } from "react";

interface Props {
  lat: string;
  lng: string;
  onSelect?: (lat: number, lng: number) => void;
  readonly?: boolean;
}

export default function MapaSatelite({ lat, lng, onSelect, readonly }: Props) {
  const divRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);

  const latN = parseFloat(lat);
  const lngN = parseFloat(lng);
  const hasCoords = !isNaN(latN) && !isNaN(lngN) && lat !== "" && lng !== "";

  const centerLat = hasCoords ? latN : 37.5;
  const centerLng = hasCoords ? lngN : -5.9;
  const zoom = hasCoords ? 15 : 7;

  useEffect(() => {
    if (!divRef.current) return;

    // Cargar Leaflet dinámicamente
    const loadLeaflet = async () => {
      // CSS
      if (!document.getElementById("leaflet-css")) {
        const link = document.createElement("link");
        link.id = "leaflet-css";
        link.rel = "stylesheet";
        link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
        document.head.appendChild(link);
      }

      // JS
      if (!(window as any).L) {
        await new Promise<void>((resolve) => {
          const script = document.createElement("script");
          script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
          script.onload = () => resolve();
          document.head.appendChild(script);
        });
      }

      const L = (window as any).L;
      if (!divRef.current) return;

      // Destruir mapa previo si existe
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markerRef.current = null;
      }

      const map = L.map(divRef.current, { zoomControl: true }).setView([centerLat, centerLng], zoom);
      mapRef.current = map;

      // Capa satélite Esri (gratuita, sin API key)
      L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        { attribution: "© Esri", maxZoom: 19 }
      ).addTo(map);

      // Capa de etiquetas encima del satélite
      L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
        { maxZoom: 19, opacity: 0.7 }
      ).addTo(map);

      // Marker personalizado verde
      const icon = L.divIcon({
        html: `<div style="width:24px;height:24px;background:#16a34a;border:3px solid white;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,0.4)"></div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
        className: "",
      });

      // Mostrar marker si hay coordenadas
      if (hasCoords) {
        markerRef.current = L.marker([latN, lngN], { icon, draggable: !readonly }).addTo(map);
        if (!readonly && onSelect) {
          markerRef.current.on("dragend", (e: any) => {
            const pos = e.target.getLatLng();
            onSelect(parseFloat(pos.lat.toFixed(6)), parseFloat(pos.lng.toFixed(6)));
          });
        }
      }

      // Clic en mapa → pone el marker y rellena coordenadas
      if (!readonly && onSelect) {
        map.on("click", (e: any) => {
          const { lat: la, lng: lo } = e.latlng;
          if (markerRef.current) {
            markerRef.current.setLatLng([la, lo]);
          } else {
            markerRef.current = L.marker([la, lo], { icon, draggable: true }).addTo(map);
            markerRef.current.on("dragend", (ev: any) => {
              const pos = ev.target.getLatLng();
              onSelect(parseFloat(pos.lat.toFixed(6)), parseFloat(pos.lng.toFixed(6)));
            });
          }
          onSelect(parseFloat(la.toFixed(6)), parseFloat(lo.toFixed(6)));
        });
      }
    };

    loadLeaflet();

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markerRef.current = null;
      }
    };
  }, []);

  // Actualizar marker cuando cambian coordenadas externamente
  useEffect(() => {
    if (!mapRef.current || !hasCoords) return;
    const L = (window as any).L;
    if (!L) return;
    if (markerRef.current) {
      markerRef.current.setLatLng([latN, lngN]);
      mapRef.current.setView([latN, lngN], Math.max(mapRef.current.getZoom(), 14));
    }
  }, [lat, lng]);

  const googleMapsUrl = hasCoords
    ? `https://www.google.com/maps/@${latN},${lngN},200m/data=!3m1!1e3`
    : `https://www.google.com/maps/@37.5,-5.9,8z/data=!3m1!1e3`;

  return (
    <div className="col-span-2">
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-sm font-medium text-gray-700">
          {readonly ? "Ubicación de la finca" : "Haz clic en el mapa para marcar la ubicación"}
        </p>
        <a href={googleMapsUrl} target="_blank" rel="noreferrer"
          className="text-xs px-2.5 py-1 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 flex items-center gap-1">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
          Abrir en Google Maps satélite
        </a>
      </div>
      <div ref={divRef} style={{ height: 280, borderRadius: 12, overflow: "hidden", border: "1px solid #e5e7eb" }} />
      {!readonly && (
        <p className="text-xs text-gray-400 mt-1.5">
          {hasCoords ? `📍 ${latN.toFixed(5)}, ${lngN.toFixed(5)} — también puedes arrastrar el marcador` : "Haz clic para colocar el marcador · el mapa también se puede buscar con la lupa de Google Maps"}
        </p>
      )}
    </div>
  );
}
