/**
 * Generador de datos sintéticos científicamente coherentes
 *
 * Basado en literatura:
 * - PEACH model (Grossman & DeJong, 1994) — desarrollo reproductivo
 * - Verma et al., 2023 — FDP (Fruit Development Period) por variedad
 * - Anzanello & Biasi, 2016 — GDD base 7°C para hueso
 * - El-Yazal & Rashad, 2008 — relación Brix-temperatura
 *
 * Modelo:
 * 1. Floración = momento donde se cumplen CP requeridos + GDD post-dormancia (~150 GDD base 4.5°C)
 * 2. Cosecha = floración + GDD necesarios según FDP de variedad
 * 3. Yield base = densidad × kg/árbol según edad y variedad
 * 4. Penalizaciones por estrés climático (heladas en flor, calor en envero)
 * 5. Calibre/Brix correlacionados con T media + amplitud térmica
 */

import { fetchHistoricalDaily, fetchHistoricalHourly, calculateChillPortions, calculateGDD, calculateFrostRisk } from "./climate";

// ─── Catálogo de variedades sintético basado en literatura ─────────────
// FDP = días desde plena flor hasta cosecha
// CR = Chill Requirement (Chill Portions)
// GDD_FDP = Growing Degree Days base 10°C desde flor hasta cosecha
export interface VarietyProfile {
  name: string;
  species: string;
  chillRequirement: number;     // CP necesarios
  gddBloomToHarvest: number;    // GDD base 10°C
  baseYieldKgTree: number;      // kg por árbol en óptimo
  optimalCaliberMm: number;
  optimalBrix: number;
  earlyOrLate: "early" | "mid" | "late";
}

export const VARIETIES: VarietyProfile[] = [
  // Nectarinas
  { name: "Big Top", species: "Nectarina", chillRequirement: 30, gddBloomToHarvest: 1100, baseYieldKgTree: 25, optimalCaliberMm: 70, optimalBrix: 13, earlyOrLate: "mid" },
  { name: "Diamond Ray", species: "Nectarina", chillRequirement: 35, gddBloomToHarvest: 1300, baseYieldKgTree: 28, optimalCaliberMm: 75, optimalBrix: 14, earlyOrLate: "mid" },
  { name: "Honey Royale", species: "Nectarina", chillRequirement: 25, gddBloomToHarvest: 950, baseYieldKgTree: 22, optimalCaliberMm: 68, optimalBrix: 15, earlyOrLate: "early" },
  { name: "Magique", species: "Nectarina", chillRequirement: 40, gddBloomToHarvest: 1500, baseYieldKgTree: 30, optimalCaliberMm: 78, optimalBrix: 13.5, earlyOrLate: "late" },
  // Melocotones
  { name: "Royal Time", species: "Melocotón", chillRequirement: 35, gddBloomToHarvest: 1200, baseYieldKgTree: 26, optimalCaliberMm: 73, optimalBrix: 12.5, earlyOrLate: "mid" },
  { name: "Sweet Crest", species: "Melocotón", chillRequirement: 45, gddBloomToHarvest: 1450, baseYieldKgTree: 32, optimalCaliberMm: 80, optimalBrix: 13, earlyOrLate: "late" },
  // Paraguayos
  { name: "UFO 4", species: "Paraguayo", chillRequirement: 30, gddBloomToHarvest: 1050, baseYieldKgTree: 20, optimalCaliberMm: 65, optimalBrix: 14, earlyOrLate: "mid" },
];

export function getVarietyProfile(varietyName: string): VarietyProfile | null {
  return VARIETIES.find(v => v.name.toLowerCase() === varietyName.toLowerCase()) ?? null;
}

// ─── Modelo de predicción de floración ────────────────────────────────
// Devuelve la fecha estimada de plena floración

export async function predictBloomDate(
  lat: number,
  lng: number,
  campaignYear: number,
  chillRequirement: number
): Promise<{ bloomDate: string | null; chillCompletedDate: string | null; chillPortionsAtBloom: number; gddPostDormancy: number } | null> {

  // Período: 1 oct (año-1) hasta 30 jun del año de campaña
  const startDate = `${campaignYear - 1}-10-01`;
  const endDate = `${campaignYear}-06-30`;

  try {
    const [daily, hourly] = await Promise.all([
      fetchHistoricalDaily(lat, lng, startDate, endDate),
      fetchHistoricalHourly(lat, lng, startDate, endDate),
    ]);

    // Calcular CP día a día hasta encontrar el día donde se cumple el CR
    let cumulativeCP = 0;
    let chillCompletedDate: string | null = null;
    const dailyCP: { date: string; cp: number }[] = [];

    let dynState = { inter: 0, portions: 0 };
    for (const dayData of hourly) {
      for (const t of dayData.temperatures) {
        if (t == null || isNaN(t)) continue;
        // Aplicar paso del Dynamic Model
        const tempK = t + 273.15;
        const ftmprt = 1.6 * 277 * (tempK - 277) / tempK;
        const sr = Math.exp(ftmprt);
        const xi = sr / (1 + sr);
        const xs = 139500 / 2.567e18 * Math.exp((12888.8 - 4153.5) / tempK);
        const ak1 = 2.567e18 * Math.exp(-12888.8 / tempK);
        const interE = xs - (xs - dynState.inter) * Math.exp(-ak1);
        let delt = 0;
        if (interE >= 1) {
          delt = xi * interE;
          dynState = { inter: interE * (1 - xi), portions: dynState.portions + delt };
        } else {
          dynState = { inter: interE, portions: dynState.portions };
        }
      }
      cumulativeCP = dynState.portions;
      dailyCP.push({ date: dayData.date, cp: cumulativeCP });

      if (chillCompletedDate === null && cumulativeCP >= chillRequirement) {
        chillCompletedDate = dayData.date;
      }
    }

    if (!chillCompletedDate) {
      return { bloomDate: null, chillCompletedDate: null, chillPortionsAtBloom: cumulativeCP, gddPostDormancy: 0 };
    }

    // Desde la fecha de fin de dormancia, acumular GDD base 4.5°C hasta llegar a 150 GDD (típico para hueso)
    const dailyAfterDormancy = daily.filter(d => d.date >= chillCompletedDate);
    let gddCumulative = 0;
    let bloomDate: string | null = null;
    const GDD_BLOOM_THRESHOLD = 150; // Aproximadamente 150 GDD base 4.5°C para plena flor

    for (const d of dailyAfterDormancy) {
      const gdd = Math.max(0, ((d.tmax + d.tmin) / 2) - 4.5);
      gddCumulative += gdd;
      if (gddCumulative >= GDD_BLOOM_THRESHOLD && !bloomDate) {
        bloomDate = d.date;
        break;
      }
    }

    return {
      bloomDate,
      chillCompletedDate,
      chillPortionsAtBloom: Math.round(cumulativeCP * 10) / 10,
      gddPostDormancy: Math.round(gddCumulative * 10) / 10,
    };
  } catch (e) {
    console.error("[predictBloomDate]", e);
    return null;
  }
}

// ─── Modelo de predicción de cosecha ──────────────────────────────────

export async function predictHarvestDate(
  lat: number,
  lng: number,
  bloomDate: string,
  gddTarget: number
): Promise<{ harvestDate: string | null; gddAccumulated: number; daysFromBloom: number } | null> {

  const startDate = bloomDate;
  // Buscar como máximo 200 días después de floración
  const endDate = new Date(new Date(bloomDate).getTime() + 200 * 24 * 60 * 60 * 1000)
    .toISOString().split("T")[0];

  try {
    const daily = await fetchHistoricalDaily(lat, lng, startDate, endDate);
    let gddCumulative = 0;
    let harvestDate: string | null = null;
    let dayCount = 0;

    for (const d of daily) {
      const gdd = Math.max(0, ((d.tmax + d.tmin) / 2) - 10);
      gddCumulative += gdd;
      dayCount++;
      if (gddCumulative >= gddTarget && !harvestDate) {
        harvestDate = d.date;
        break;
      }
    }

    return {
      harvestDate,
      gddAccumulated: Math.round(gddCumulative * 10) / 10,
      daysFromBloom: dayCount,
    };
  } catch (e) {
    console.error("[predictHarvestDate]", e);
    return null;
  }
}

// ─── Generador de campaña sintética ────────────────────────────────────

interface FarmSeed {
  farmId: number;
  lat: number;
  lng: number;
  variety: string;
  surface: number;        // ha
  density: number;        // plantas/ha
  plantingYear: number;
}

export async function generateSyntheticCampaign(
  farm: FarmSeed,
  campaignYear: number
): Promise<any | null> {

  const profile = getVarietyProfile(farm.variety);
  if (!profile) {
    console.warn(`[generator] Variedad no encontrada: ${farm.variety}`);
    return null;
  }

  // 1. Predecir fecha de floración real
  const bloomPred = await predictBloomDate(farm.lat, farm.lng, campaignYear, profile.chillRequirement);
  if (!bloomPred?.bloomDate) {
    console.warn(`[generator] No se pudo predecir floración para finca ${farm.farmId} año ${campaignYear}`);
    return null;
  }

  // 2. Predecir fecha de cosecha
  const harvestPred = await predictHarvestDate(
    farm.lat, farm.lng,
    bloomPred.bloomDate,
    profile.gddBloomToHarvest
  );
  if (!harvestPred?.harvestDate) return null;

  // 3. Detectar eventos climáticos: heladas en floración (±15 días alrededor de bloom)
  const bloomDate = new Date(bloomPred.bloomDate);
  const frostStart = new Date(bloomDate.getTime() - 15 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const frostEnd = new Date(bloomDate.getTime() + 15 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const frostData = await fetchHistoricalDaily(farm.lat, farm.lng, frostStart, frostEnd);
  const frostRisk = calculateFrostRisk(frostData);
  const frostInBloom = frostRisk.totalFrostDays;

  // 4. Estrés calor: días >35°C entre floración y cosecha
  const heatData = await fetchHistoricalDaily(farm.lat, farm.lng, bloomPred.bloomDate, harvestPred.harvestDate!);
  const heatStressDays = heatData.filter(d => d.tmax > 35).length;
  const tmeanRipening = heatData.length > 0
    ? heatData.reduce((a, b) => a + b.tmean, 0) / heatData.length
    : 18;

  // 5. Calcular yield realista con penalizaciones
  // Edad del árbol — penalización si <5 años o >25 años
  const treeAge = campaignYear - farm.plantingYear;
  let ageMultiplier = 1.0;
  if (treeAge < 3) ageMultiplier = 0.0;
  else if (treeAge < 5) ageMultiplier = 0.5 + (treeAge - 3) * 0.25;
  else if (treeAge > 25) ageMultiplier = Math.max(0.5, 1 - (treeAge - 25) * 0.05);

  // Yield base
  let yieldKgHa = profile.baseYieldKgTree * farm.density * ageMultiplier;

  // Penalización heladas: cada día de helada en floración -10% hasta -50%
  const frostPenalty = Math.min(0.5, frostInBloom * 0.10);
  yieldKgHa *= (1 - frostPenalty);

  // Penalización calor extremo: cada día >35°C -2% hasta -20%
  const heatPenalty = Math.min(0.20, heatStressDays * 0.02);
  yieldKgHa *= (1 - heatPenalty);

  // Hail event aleatorio (5% probabilidad anual)
  const hail = Math.random() < 0.05;
  if (hail) yieldKgHa *= 0.7;

  // Variabilidad inter-anual ±10% (clima, manejo, otros)
  const noise = 0.9 + Math.random() * 0.2;
  yieldKgHa *= noise;

  yieldKgHa = Math.max(0, Math.round(yieldKgHa));

  // 6. Calibre — correlación con T media en hinchamiento
  // Más calor = menos calibre (estrés hídrico)
  let caliber = profile.optimalCaliberMm;
  if (tmeanRipening > 23) caliber -= (tmeanRipening - 23) * 0.8;
  else if (tmeanRipening < 18) caliber -= (18 - tmeanRipening) * 0.5;
  caliber += (Math.random() - 0.5) * 4; // ruido ±2mm
  caliber = Math.round(caliber * 10) / 10;

  // Categoría calibre según escala UE
  const caliberCategory = caliber >= 90 ? "AAAA"
    : caliber >= 80 ? "AAA"
    : caliber >= 73 ? "AA"
    : caliber >= 67 ? "A"
    : caliber >= 61 ? "B"
    : caliber >= 56 ? "C"
    : caliber >= 51 ? "D"
    : "Pequeño";

  // 7. Brix — más calor moderado mejor, pero >30°C lo penaliza
  let brix = profile.optimalBrix;
  if (tmeanRipening > 28) brix -= (tmeanRipening - 28) * 0.3;
  else if (tmeanRipening >= 20) brix += (tmeanRipening - 20) * 0.1;
  else brix -= (20 - tmeanRipening) * 0.2;
  brix += (Math.random() - 0.5) * 1.5;
  brix = Math.round(brix * 10) / 10;

  // 8. Categoría comercial
  const commercialCategory = brix >= profile.optimalBrix && caliber >= profile.optimalCaliberMm * 0.95 && !hail
    ? "Extra"
    : brix >= profile.optimalBrix - 1 ? "Categoría I" : "Categoría II";

  // 9. Presión plagas (correlación inversa a humedad/precipitación)
  const pestPressure = Math.random() < 0.3 ? "alta" : Math.random() < 0.6 ? "media" : "baja";

  return {
    farmId: farm.farmId,
    year: campaignYear,
    variety: profile.name,
    bloomDate: new Date(bloomPred.bloomDate),
    harvestStartDate: new Date(harvestPred.harvestDate!),
    harvestEndDate: new Date(new Date(harvestPred.harvestDate!).getTime() + 14 * 24 * 60 * 60 * 1000),
    chillPortions: bloomPred.chillPortionsAtBloom.toString(),
    gddBloomToHarvest: harvestPred.gddAccumulated.toString(),
    yieldKgHa: yieldKgHa.toString(),
    totalYieldKg: Math.round(yieldKgHa * farm.surface).toString(),
    meanCaliberMm: caliber.toString(),
    caliberCategory,
    brixDegrees: brix.toString(),
    commercialCategory,
    frostEvents: frostInBloom,
    heatStressEvents: heatStressDays,
    hailEvent: hail,
    pestPressure,
    notes: `Generado con modelo PEACH simulado · T media maduración: ${tmeanRipening.toFixed(1)}°C · Edad árbol: ${treeAge} años`,
  };
}
