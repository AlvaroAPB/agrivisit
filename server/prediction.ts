/**
 * Motor de predicción de cosecha para AgrIvisit
 * Modelo agronómico basado en:
 *  - Rendimiento base por variedad (catálogo)
 *  - Ajuste por edad de plantación (curva logística)
 *  - Ajuste por cobertura de frío (Chill Portions)
 *  - Ajuste por pH del suelo
 *  - Ajuste por dotación de riego
 *  - Calibración con histórico real de campañas
 */

export interface ParcelInput {
  id: number;
  name: string;
  especie: string;
  variedad: string;
  surface: number;          // ha
  anyoPlantacion?: number;
  anyoProduccion?: number;
  densidad?: number;        // pl/ha
  ph?: number;
  ce?: number;
  materiaOrganica?: number;
}

export interface FarmInput {
  id: number;
  name: string;
  location: string;
  dotacionAgua?: number;    // m³/ha/año
  irrigationType?: string;
  latitude?: number;
  longitude?: number;
  parcelas: ParcelInput[];
}

export interface CampaignHistorico {
  year: number;
  variety?: string;
  yieldKgHa?: number;
  totalYieldKg?: number;
  chillPortions?: number;
  frostEvents?: number;
  pestPressure?: string;
}

export interface ClimaInput {
  chillPortions: number;
  tmean: number;
  totalPrecipitation: number;
  frostDays: number;
}

export interface PrediccionParcela {
  parcelaId: number;
  parcelaName: string;
  especie: string;
  variedad: string;
  superficieHa: number;

  // Rendimiento estimado
  rendimientoBaseKgHa: number;
  rendimientoEstimadoKgHa: number;
  totalKg: number;
  totalToneladas: number;

  // Factores de ajuste (0-1)
  factores: {
    edad: number;
    frio: number;
    suelo: number;
    riego: number;
    historico: number;
  };

  // Rango (optimista / pesimista)
  rangoMin: number;
  rangoMax: number;

  // Confianza del modelo (0-100)
  confianza: number;

  // Explicación
  alertas: string[];
}

export interface PrediccionFinca {
  farmId: number;
  farmName: string;
  year: number;
  parcelas: PrediccionParcela[];

  // Totales finca
  totalKg: number;
  totalToneladas: number;
  superficieTotalHa: number;
  rendimientoMedioKgHa: number;

  // Histórico real
  historico: { year: number; kgHa: number; totalKg: number }[];

  // Proyección futura (5 años)
  proyeccion: { year: number; kgHa: number; totalKg: number; esFuturo: boolean }[];
}

// Rendimientos base por especie/variedad (kg/ha en condiciones óptimas)
const RENDIMIENTO_BASE: Record<string, number> = {
  // Melocotón / Nectarina
  "Royal Time": 20000, "Diamond Ray": 18000, "Persit": 17000,
  "Blu label": 19000, "Scali": 16000, "Royal Gem": 21000,
  // Arándano
  "Biloxi": 12000, "Blu Aroma®": 11000, "O'Neal": 10000, "Emerald": 13000,
  // Frambuesa
  "default_frambuesa": 15000,
  // Default por especie
  "default_melocoton": 18000, "default_nectarina": 18000,
  "default_arandano": 11000, "default": 15000,
};

function getRendimientoBase(especie: string, variedad: string): number {
  if (RENDIMIENTO_BASE[variedad]) return RENDIMIENTO_BASE[variedad];
  const esp = especie?.toLowerCase() || "";
  if (esp.includes("melocot")) return RENDIMIENTO_BASE["default_melocoton"];
  if (esp.includes("nectarin")) return RENDIMIENTO_BASE["default_nectarina"];
  if (esp.includes("arándano") || esp.includes("arandano")) return RENDIMIENTO_BASE["default_arandano"];
  if (esp.includes("frambuesa")) return RENDIMIENTO_BASE["default_frambuesa"];
  return RENDIMIENTO_BASE["default"];
}

// Ajuste por edad de plantación (curva logística)
// Año 1: 15%, Año 2: 35%, Año 3: 60%, Año 4: 80%, Año 5+: 100%
function ajusteEdad(anyoPlantacion?: number, anyoProduccion?: number, yearActual: number = new Date().getFullYear()): number {
  const firstProd = anyoProduccion || (anyoPlantacion ? anyoPlantacion + 2 : null);
  if (!firstProd) return 0.85; // si no hay dato, asumimos árbol adulto con incertidumbre
  const edadProduccion = yearActual - firstProd;
  if (edadProduccion <= 0) return 0.10;
  if (edadProduccion === 1) return 0.30;
  if (edadProduccion === 2) return 0.55;
  if (edadProduccion === 3) return 0.75;
  if (edadProduccion === 4) return 0.90;
  return 1.0; // plena producción año 5+
}

// Ajuste por cobertura de horas frío
// Requerimientos típicos por especie
const CHILL_REQS: Record<string, number> = {
  "Melocotón": 800, "Nectarina": 750, "Arándano": 400, "Frambuesa": 600, "default": 600,
};

function ajusteFrio(chillPortions: number, especie: string, requerimientoFrio?: number): number {
  // Convertir Chill Portions a Chill Hours aproximado (1 CP ≈ 20 CH)
  const chillHoursEstimado = chillPortions * 20;
  const req = requerimientoFrio || CHILL_REQS[especie] || CHILL_REQS["default"];
  const cobertura = Math.min(chillHoursEstimado / req, 1.0);
  // Penalización progresiva: <60% cobertura → penalización fuerte
  if (cobertura >= 1.0) return 1.0;
  if (cobertura >= 0.8) return 0.90 + (cobertura - 0.8) * 0.5;
  if (cobertura >= 0.6) return 0.75 + (cobertura - 0.6) * 0.75;
  return 0.5 + cobertura * 0.416; // penalización severa < 60%
}

// Ajuste por pH del suelo
// pH óptimo depende de la especie
const PH_OPTIMO: Record<string, [number, number]> = {
  "Melocotón": [6.0, 7.5], "Nectarina": [6.0, 7.5],
  "Arándano": [4.5, 5.5], "Frambuesa": [5.5, 6.5], "default": [6.0, 7.0],
};

function ajustePH(ph?: number, especie?: string): number {
  if (!ph) return 0.95;
  const rango = PH_OPTIMO[especie || ""] || PH_OPTIMO["default"];
  const [min, max] = rango;
  if (ph >= min && ph <= max) return 1.0;
  const desviacion = ph < min ? min - ph : ph - max;
  return Math.max(0.6, 1 - desviacion * 0.08);
}

// Ajuste por riego (dotación vs necesidad estimada)
// Necesidades hídricas típicas (m³/ha/año)
const AGUA_NECESARIA: Record<string, number> = {
  "Melocotón": 6000, "Nectarina": 6000, "Arándano": 5000, "Frambuesa": 5500, "default": 5500,
};

function ajusteRiego(dotacionAgua?: number, especie?: string, irrigationType?: string): number {
  if (!irrigationType || irrigationType === "Secano") return 0.70;
  if (!dotacionAgua) return 0.90; // tiene riego pero sin dato
  const necesaria = AGUA_NECESARIA[especie || ""] || AGUA_NECESARIA["default"];
  const ratio = dotacionAgua / necesaria;
  if (ratio >= 0.9 && ratio <= 1.3) return 1.0;
  if (ratio < 0.9) return 0.7 + ratio * 0.33;
  return 0.95; // exceso de agua también penaliza ligeramente
}

// Calibración con histórico real
function ajusteHistorico(historico: CampaignHistorico[], rendimientoBase: number): { factor: number; confianza: number } {
  const conRegistro = historico.filter(h => h.yieldKgHa && h.yieldKgHa > 0);
  if (conRegistro.length === 0) return { factor: 1.0, confianza: 40 };

  // Media ponderada (años más recientes pesan más)
  let sumPeso = 0;
  let sumFactor = 0;
  conRegistro.forEach((h, i) => {
    const peso = i + 1; // año más reciente = mayor peso
    const factor = h.yieldKgHa! / rendimientoBase;
    sumPeso += peso;
    sumFactor += factor * peso;
  });
  const factorMedio = sumFactor / sumPeso;
  // Confianza aumenta con más datos (máx 90%)
  const confianza = Math.min(40 + conRegistro.length * 15, 90);
  return { factor: Math.min(Math.max(factorMedio, 0.3), 1.5), confianza };
}

// ─── Función principal ────────────────────────────────────────────────────────
export function predecirCosechaFinca(
  farm: FarmInput,
  clima: ClimaInput,
  historico: CampaignHistorico[],
  year: number = new Date().getFullYear()
): PrediccionFinca {

  const prediccionesParcelas: PrediccionParcela[] = farm.parcelas
    .filter(p => p.surface > 0 && (p.especie || p.variedad))
    .map(p => {
      const alertas: string[] = [];
      const rendBase = getRendimientoBase(p.especie, p.variedad);

      // Calcular factores
      const fEdad = ajusteEdad(p.anyoPlantacion, p.anyoProduccion, year);
      const fFrio = ajusteFrio(clima.chillPortions, p.especie);
      const fSuelo = ajustePH(p.ph, p.especie);
      const fRiego = ajusteRiego(farm.dotacionAgua, p.especie, farm.irrigationType);

      // Histórico solo de esta variedad
      const histVariedad = historico.filter(h =>
        !h.variety || h.variety === p.variedad || h.variety === p.especie
      );
      const { factor: fHistorico, confianza } = ajusteHistorico(histVariedad, rendBase);

      // Rendimiento estimado
      const rendEstimado = Math.round(
        rendBase * fEdad * fFrio * fSuelo * fRiego * fHistorico
      );

      const totalKg = Math.round(rendEstimado * p.surface);
      const totalTon = totalKg / 1000;

      // Rango ±15% de incertidumbre
      const incert = 0.15;
      const rangoMin = Math.round(totalKg * (1 - incert));
      const rangoMax = Math.round(totalKg * (1 + incert));

      // Alertas
      if (fEdad < 0.5) alertas.push("Plantación joven — producción limitada");
      if (fFrio < 0.75) alertas.push("Déficit de frío — floración irregular posible");
      if (fSuelo < 0.85) alertas.push(`pH ${p.ph} fuera del rango óptimo para ${p.especie}`);
      if (fRiego < 0.85) alertas.push("Dotación de riego insuficiente para el cultivo");
      if (clima.frostDays > 3) alertas.push(`${clima.frostDays} días de helada detectados`);

      return {
        parcelaId: p.id,
        parcelaName: p.name,
        especie: p.especie,
        variedad: p.variedad,
        superficieHa: p.surface,
        rendimientoBaseKgHa: rendBase,
        rendimientoEstimadoKgHa: rendEstimado,
        totalKg,
        totalToneladas: parseFloat(totalTon.toFixed(2)),
        factores: {
          edad: parseFloat(fEdad.toFixed(2)),
          frio: parseFloat(fFrio.toFixed(2)),
          suelo: parseFloat(fSuelo.toFixed(2)),
          riego: parseFloat(fRiego.toFixed(2)),
          historico: parseFloat(fHistorico.toFixed(2)),
        },
        rangoMin,
        rangoMax,
        confianza,
        alertas,
      };
    });

  // Totales finca
  const totalKg = prediccionesParcelas.reduce((s, p) => s + p.totalKg, 0);
  const superficieTotal = prediccionesParcelas.reduce((s, p) => s + p.superficieHa, 0);
  const rendMedio = superficieTotal > 0 ? Math.round(totalKg / superficieTotal) : 0;

  // Histórico real de la finca (de campañas)
  const historicoFinca = historico
    .filter(h => h.yieldKgHa && h.yieldKgHa > 0)
    .map(h => ({
      year: h.year,
      kgHa: Math.round(h.yieldKgHa!),
      totalKg: Math.round(h.totalYieldKg || h.yieldKgHa! * superficieTotal),
    }))
    .sort((a, b) => a.year - b.year);

  // Proyección futura (5 años) — usa el año actual como base
  const proyeccion = [];
  for (let y = Math.max(year - 2, year - historicoFinca.length); y <= year + 4; y++) {
    const real = historicoFinca.find(h => h.year === y);
    if (real) {
      proyeccion.push({ ...real, esFuturo: false });
    } else {
      // Proyectar con ligero incremento si plantación joven, estable si adulta
      const anyoPlantMin = Math.min(...farm.parcelas.map(p => p.anyoPlantacion || year - 5));
      const edadFutura = y - anyoPlantMin;
      const factEdadFutura = ajusteEdad(anyoPlantMin, anyoPlantMin + 2, y);
      const kgHaProyectado = Math.round(rendMedio * (factEdadFutura / Math.max(prediccionesParcelas[0]?.factores.edad || 1, 0.1)));
      proyeccion.push({
        year: y,
        kgHa: kgHaProyectado,
        totalKg: Math.round(kgHaProyectado * superficieTotal),
        esFuturo: y > year,
      });
    }
  }

  return {
    farmId: farm.id,
    farmName: farm.name,
    year,
    parcelas: prediccionesParcelas,
    totalKg,
    totalToneladas: parseFloat((totalKg / 1000).toFixed(2)),
    superficieTotalHa: parseFloat(superficieTotal.toFixed(2)),
    rendimientoMedioKgHa: rendMedio,
    historico: historicoFinca,
    proyeccion,
  };
}
