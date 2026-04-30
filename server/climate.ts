/**
 * Servicio climático para AgriVisit
 *
 * Conecta con Open-Meteo (API gratuita, sin key) para obtener datos meteorológicos
 * históricos y de predicción por coordenadas GPS.
 *
 * Implementa modelos científicos:
 * - Dynamic Model (Chill Portions) — Fishman et al. — para acumulación de frío
 * - Growing Degree Days (GDD) — base 10°C — para fenología post-frío
 * - Estadísticas mensuales (T media/min/max, precipitación, etc.)
 */

interface DailyData {
  date: string;
  tmax: number;
  tmin: number;
  tmean: number;
  precipitation: number;
  // Para Dynamic Model necesitamos T horaria (la calculamos a partir de min/max)
  hourly_temps?: number[];
}

interface HourlyData {
  date: string;
  temperatures: number[]; // 24 valores
}

// ─── 1. FETCH DATOS DE OPEN-METEO ─────────────────────────────────────

export async function fetchHistoricalDaily(
  lat: number,
  lng: number,
  startDate: string,
  endDate: string
): Promise<DailyData[]> {
  const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lng}&start_date=${startDate}&end_date=${endDate}&daily=temperature_2m_max,temperature_2m_min,temperature_2m_mean,precipitation_sum&timezone=auto`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Open-Meteo error: ${res.status}`);
  const data: any = await res.json();

  const daily: DailyData[] = [];
  for (let i = 0; i < data.daily.time.length; i++) {
    daily.push({
      date: data.daily.time[i],
      tmax: data.daily.temperature_2m_max[i],
      tmin: data.daily.temperature_2m_min[i],
      tmean: data.daily.temperature_2m_mean[i],
      precipitation: data.daily.precipitation_sum[i] ?? 0,
    });
  }
  return daily;
}

export async function fetchHistoricalHourly(
  lat: number,
  lng: number,
  startDate: string,
  endDate: string
): Promise<HourlyData[]> {
  const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lng}&start_date=${startDate}&end_date=${endDate}&hourly=temperature_2m&timezone=auto`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Open-Meteo hourly error: ${res.status}`);
  const data: any = await res.json();

  const hourly: HourlyData[] = [];
  const temps: number[] = data.hourly.temperature_2m;
  const times: string[] = data.hourly.time;

  // Agrupar por día (24 valores cada uno)
  for (let i = 0; i < times.length; i += 24) {
    const date = times[i].split("T")[0];
    hourly.push({
      date,
      temperatures: temps.slice(i, i + 24),
    });
  }
  return hourly;
}

// ─── 2. DYNAMIC MODEL (CHILL PORTIONS) ────────────────────────────────
// Basado en Fishman et al. (1987) — el modelo más preciso para zonas cálidas.
// Implementación de referencia: chillR (Luedeling, 2018)

interface DynamicState {
  inter: number; // intermedio
  portions: number; // chill portions acumuladas
}

const DYNAMIC_PARAMS = {
  e0: 4153.5,
  e1: 12888.8,
  a0: 139500,
  a1: 2.567e18,
  slp: 1.6,
  tetmlt: 277,
};

function dynamicStep(prev: DynamicState, tempC: number): DynamicState {
  // Implementación de referencia chillR (Luedeling et al., 2018)
  const tempK = tempC + 273.15;
  const { e0, e1, a0, a1, slp, tetmlt } = DYNAMIC_PARAMS;

  // ftmprt: factor de modulación de temperatura (Erez & Couvillon, 1987)
  const ftmprt = slp * tetmlt * (tempK - tetmlt) / tempK;
  const sr = Math.exp(ftmprt);
  const xi = sr / (1 + sr);

  // xs: máximo teórico
  const xs = a0 / a1 * Math.exp((e1 - e0) / tempK);

  // ak1: tasa de degradación del intermedio
  const ak1 = a1 * Math.exp(-e1 / tempK);

  // Estado intermedio
  const interE = xs - (xs - prev.inter) * Math.exp(-ak1);

  let delt = 0;
  let inter: number;
  if (interE >= 1) {
    delt = xi * interE;
    inter = interE * (1 - xi);
  } else {
    delt = 0;
    inter = interE;
  }

  return {
    inter,
    portions: prev.portions + delt,
  };
}

/**
 * Calcula Chill Portions (Dynamic Model) a partir de datos horarios.
 * Recibe array de temperaturas horarias (cualquier longitud).
 */
export function calculateChillPortions(hourlyTemps: number[]): number {
  let state: DynamicState = { inter: 0, portions: 0 };
  for (const t of hourlyTemps) {
    if (t == null || isNaN(t)) continue;
    state = dynamicStep(state, t);
  }
  return Math.round(state.portions * 10) / 10;
}

/**
 * Calcula evolución de Chill Portions día a día (para gráfico acumulado).
 */
export function calculateChillPortionsDaily(
  hourlyData: HourlyData[]
): { date: string; cumulative: number }[] {
  let state: DynamicState = { inter: 0, portions: 0 };
  const result: { date: string; cumulative: number }[] = [];

  for (const day of hourlyData) {
    for (const t of day.temperatures) {
      if (t != null && !isNaN(t)) {
        state = dynamicStep(state, t);
      }
    }
    result.push({
      date: day.date,
      cumulative: Math.round(state.portions * 10) / 10,
    });
  }
  return result;
}

// ─── 3. HORAS FRÍO (MODELO CLÁSICO <7.2°C) ────────────────────────────

export function calculateChillHours(hourlyTemps: number[]): number {
  return hourlyTemps.filter(t => t != null && !isNaN(t) && t < 7.2 && t >= 0).length;
}

export function calculateChillHoursDaily(
  hourlyData: HourlyData[]
): { date: string; cumulative: number }[] {
  let total = 0;
  return hourlyData.map(day => {
    total += calculateChillHours(day.temperatures);
    return { date: day.date, cumulative: total };
  });
}

// ─── 4. GROWING DEGREE DAYS (GDD) ─────────────────────────────────────

export function calculateGDD(
  daily: DailyData[],
  baseTemp: number = 10,
  startDate?: string
): { date: string; daily: number; cumulative: number }[] {
  let cumulative = 0;
  const filtered = startDate ? daily.filter(d => d.date >= startDate) : daily;

  return filtered.map(d => {
    const gddDay = Math.max(0, ((d.tmax + d.tmin) / 2) - baseTemp);
    cumulative += gddDay;
    return {
      date: d.date,
      daily: Math.round(gddDay * 10) / 10,
      cumulative: Math.round(cumulative * 10) / 10,
    };
  });
}

// ─── 5. ESTADÍSTICAS MENSUALES ────────────────────────────────────────

export interface MonthlyStats {
  month: string; // YYYY-MM
  tmean: number;
  tmin: number;
  tmax: number;
  precipitation: number;
  daysFrost: number; // días con T<0
  daysHot: number;   // días con T>35
}

export function calculateMonthlyStats(daily: DailyData[]): MonthlyStats[] {
  const groups: Record<string, DailyData[]> = {};
  for (const d of daily) {
    const month = d.date.substring(0, 7);
    if (!groups[month]) groups[month] = [];
    groups[month].push(d);
  }

  return Object.entries(groups).map(([month, days]) => {
    const tmeans = days.map(d => d.tmean);
    const tmins = days.map(d => d.tmin);
    const tmaxs = days.map(d => d.tmax);
    return {
      month,
      tmean: Math.round((tmeans.reduce((a, b) => a + b, 0) / tmeans.length) * 10) / 10,
      tmin: Math.round(Math.min(...tmins) * 10) / 10,
      tmax: Math.round(Math.max(...tmaxs) * 10) / 10,
      precipitation: Math.round(days.reduce((a, b) => a + b.precipitation, 0) * 10) / 10,
      daysFrost: days.filter(d => d.tmin < 0).length,
      daysHot: days.filter(d => d.tmax > 35).length,
    };
  });
}

// ─── 6. RIESGO HELADA ─────────────────────────────────────────────────

export function calculateFrostRisk(daily: DailyData[]): {
  totalFrostDays: number;
  minTemp: number;
  frostDates: string[];
} {
  const frostDays = daily.filter(d => d.tmin < 0);
  return {
    totalFrostDays: frostDays.length,
    minTemp: daily.length > 0 ? Math.min(...daily.map(d => d.tmin)) : 0,
    frostDates: frostDays.map(d => d.date),
  };
}

// ─── 7. RESUMEN COMPLETO PARA UNA FINCA ───────────────────────────────

export interface ClimateSummary {
  location: { lat: number; lng: number };
  dataSource: {
    model: string;
    gridLat: number;
    gridLng: number;
    elevation: number;
    distanceKm: number;
  };
  period: { start: string; end: string };
  chillPortions: number;
  chillHours: number;
  monthlyStats: MonthlyStats[];
  frostRisk: { totalFrostDays: number; minTemp: number; frostDates: string[] };
  chillEvolution: { date: string; cumulative: number }[];
  chillHoursEvolution: { date: string; cumulative: number }[];
  gddEvolution: { date: string; daily: number; cumulative: number }[];
}

export async function buildClimateSummary(
  lat: number,
  lng: number,
  startDate: string,
  endDate: string,
  gddStartDate?: string
): Promise<ClimateSummary> {
  // Obtener metadatos de la fuente (modelo, punto de grid, elevación)
  const metaUrl = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lng}&start_date=${startDate}&end_date=${startDate}&daily=temperature_2m_max&timezone=auto`;
  const metaRes = await fetch(metaUrl);
  const meta: any = await metaRes.json();

  const gridLat = meta.latitude ?? lat;
  const gridLng = meta.longitude ?? lng;
  const elevation = meta.elevation ?? 0;

  // Distancia entre la finca y el punto de grid (Haversine simplificado)
  const dLat = (gridLat - lat) * Math.PI / 180;
  const dLng = (gridLng - lng) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat*Math.PI/180)*Math.cos(gridLat*Math.PI/180)*Math.sin(dLng/2)**2;
  const distanceKm = 6371 * 2 * Math.asin(Math.sqrt(a));

  const [daily, hourly] = await Promise.all([
    fetchHistoricalDaily(lat, lng, startDate, endDate),
    fetchHistoricalHourly(lat, lng, startDate, endDate),
  ]);

  const allHourly = hourly.flatMap(h => h.temperatures);

  return {
    location: { lat, lng },
    dataSource: {
      model: "ERA5-Land (Open-Meteo)",
      gridLat,
      gridLng,
      elevation,
      distanceKm: Math.round(distanceKm * 100) / 100,
    },
    period: { start: startDate, end: endDate },
    chillPortions: calculateChillPortions(allHourly),
    chillHours: calculateChillHours(allHourly),
    monthlyStats: calculateMonthlyStats(daily),
    frostRisk: calculateFrostRisk(daily),
    chillEvolution: calculateChillPortionsDaily(hourly),
    chillHoursEvolution: calculateChillHoursDaily(hourly),
    gddEvolution: calculateGDD(daily, 10, gddStartDate),
  };
}
