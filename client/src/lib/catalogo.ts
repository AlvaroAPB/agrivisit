/**
 * Catálogo maestro de Especies y Variedades — AgriVisit / SAT Royal
 *
 * Parámetros agronómicos basados en literatura científica:
 * - Fruta de hueso: EUFRIN 2023, Day et al. 2008, Grossman & DeJong 1994
 * - Arándano low-chill: Retamales & Hancock 2018, NeSmith 2008
 * - Frambuesa: Jennings 1988, Takeda & Finn 2018
 * - Nutrición: Penn State Tree Fruit Guide 2022-23, WSU EM119E 2022
 *   BBCH nutritional stages: Hanson & Proctor 2020, Stiles & Reid 1991
 *
 * TEMPORAL: datos ficticios para validación del modelo.
 * Reemplazar con datos reales cuando llegue el Excel de variedades.
 */

export type GrupoEspecie = "hueso" | "arandano" | "frambuesa";

// ─── Extracción nutricional por tonelada de fruta producida ──────────
// Fuente base: Weinbaum et al. (1992), Neilsen & Neilsen (2003)
// Ajustado por variedad (±15-25% respecto a valores medios de especie)
export interface ExtraccionNPK {
  // kg de elemento puro por tonelada de fruta producida
  N: number;
  P2O5: number;
  K2O: number;
  CaO: number;
  MgO: number;
  // Microelementos g/tonelada fruta
  Fe_g: number;
  Mn_g: number;
  Zn_g: number;
  B_g: number;
}

// ─── Rangos foliares óptimos por especie (mid-season) ────────────────
export interface RangoFoliar {
  N: [number, number];   // % hoja seca
  P: [number, number];
  K: [number, number];
  Ca: [number, number];
  Mg: [number, number];
  Fe: [number, number];  // ppm
  Mn: [number, number];
  Zn: [number, number];
  B: [number, number];
  Cu: [number, number];
}

// ─── Plan de fertirrigación por fenofase ─────────────────────────────
export interface FenofaseNPK {
  fase: string;
  porcentajeN: number;  // % del total anual de N en esta fase
  porcentajeP: number;
  porcentajeK: number;
  descripcion: string;
}

export interface Variedad {
  id: string;
  nombre: string;
  especie: string;
  grupo: GrupoEspecie;
  // Fenología / modelo predictivo
  chillPortions?: number;
  gddBloomToHarvest?: number;
  fdpDias?: number;
  chillHours?: number;
  gddBase4?: number;
  gddBase3?: number;
  ciclosAnio?: number;
  // Calidad objetivo
  calibreOptMm: number;
  brixOpt: number;
  pesoFrutoG?: number;
  rendimientoBaseKgHa?: number; // producción base en condiciones óptimas
  // Nutrición
  extraccion: ExtraccionNPK;    // kg elemento/t fruta
  rangoFoliar: RangoFoliar;     // rangos óptimos análisis foliar
  // Agronómico
  portainjertosRec?: string[];
  densidadRec?: string;
  conduccionRec?: string;
  observaciones?: string;
  obtentor?: string;
  protegida?: boolean;
}

export interface Especie {
  nombre: string;
  grupo: GrupoEspecie;
  descripcion: string;
  fenofasesNPK: FenofaseNPK[];  // distribución anual del abonado
  variedades: Variedad[];
}

// ─── DISTRIBUCIÓN FENOFÁSICA DEL ABONADO ─────────────────────────────
// Basado en: Stiles & Reid 1991, Hanson & Proctor 2020

const FENOFASES_HUESO: FenofaseNPK[] = [
  { fase: "Brotación / plena flor", porcentajeN: 20, porcentajeP: 20, porcentajeK: 10, descripcion: "N para arranque vegetativo. P para desarrollo radicular y cuajado." },
  { fase: "Cuajado → fruto 2cm", porcentajeN: 20, porcentajeP: 20, porcentajeK: 15, descripcion: "Período crítico. Fruto compite con brotes vegetativos." },
  { fase: "Endurecimiento hueso", porcentajeN: 15, porcentajeP: 15, porcentajeK: 20, descripcion: "Reducir N para no provocar brotación excesiva. Subir K." },
  { fase: "Engorde del fruto", porcentajeN: 20, porcentajeP: 20, porcentajeK: 35, descripcion: "Fase K dominante. Máxima demanda de potasio para calibre y Brix." },
  { fase: "Poscosecha", porcentajeN: 25, porcentajeP: 25, porcentajeK: 20, descripcion: "Reposición reservas árbol. Crucial para yemas del año siguiente." },
];

const FENOFASES_ARANDANO: FenofaseNPK[] = [
  { fase: "Brotación / floración", porcentajeN: 25, porcentajeP: 25, porcentajeK: 15, descripcion: "Inicio vegetativo. pH sustrato crítico (4.5-5.5). N-NH4 preferido." },
  { fase: "Cuajado → fruto verde", porcentajeN: 25, porcentajeP: 25, porcentajeK: 20, descripcion: "Alta demanda de Ca para firmeza del fruto." },
  { fase: "Maduración", porcentajeN: 15, porcentajeP: 15, porcentajeK: 40, descripcion: "K domina en maduración. Reducir N para favorecer coloración." },
  { fase: "Poscosecha", porcentajeN: 35, porcentajeP: 35, porcentajeK: 25, descripcion: "Acumulación de reservas. Fósforo clave para inducción floral." },
];

const FENOFASES_FRAMBUESA: FenofaseNPK[] = [
  { fase: "Brotación primavera", porcentajeN: 30, porcentajeP: 25, porcentajeK: 15, descripcion: "Alta demanda N para desarrollo de tallos primocanes." },
  { fase: "Floración / cuajado", porcentajeN: 20, porcentajeP: 25, porcentajeK: 20, descripcion: "Ca importante para firmeza y resistencia a Botrytis." },
  { fase: "Maduración ciclo 1", porcentajeN: 15, porcentajeP: 15, porcentajeK: 35, descripcion: "K domina. Reducir N para concentrar azúcares." },
  { fase: "Ciclo 2 (otoño)", porcentajeN: 35, porcentajeP: 35, porcentajeK: 30, descripcion: "Reactivación completa. Mayor demanda nutricional total." },
];

// ─── RANGOS FOLIARES BASE POR GRUPO ──────────────────────────────────

const FOLIAR_HUESO_BASE: RangoFoliar = {
  N: [2.6, 3.5], P: [0.15, 0.35], K: [1.6, 3.0], Ca: [1.6, 2.5], Mg: [0.31, 0.8],
  Fe: [61, 200], Mn: [26, 200], Zn: [19, 50], B: [26, 60], Cu: [6, 20],
};

const FOLIAR_ARANDANO_BASE: RangoFoliar = {
  N: [1.8, 2.5], P: [0.12, 0.35], K: [0.5, 1.2], Ca: [0.3, 0.8], Mg: [0.1, 0.3],
  Fe: [60, 250], Mn: [50, 350], Zn: [8, 30], B: [25, 70], Cu: [5, 20],
};

const FOLIAR_FRAMBUESA_BASE: RangoFoliar = {
  N: [2.1, 3.0], P: [0.16, 0.4], K: [1.3, 2.5], Ca: [0.9, 1.5], Mg: [0.26, 0.6],
  Fe: [51, 150], Mn: [21, 150], Zn: [16, 40], B: [21, 50], Cu: [5, 15],
};

// Pequeña variación por variedad (±10%) para que cada una sea distinta
function varyFoliar(base: RangoFoliar, factorMin: number, factorMax: number): RangoFoliar {
  const v = (val: number, f: number) => Math.round(val * f * 100) / 100;
  return {
    N: [v(base.N[0], factorMin), v(base.N[1], factorMax)],
    P: [v(base.P[0], factorMin), v(base.P[1], factorMax)],
    K: [v(base.K[0], factorMin), v(base.K[1], factorMax)],
    Ca: [v(base.Ca[0], factorMin), v(base.Ca[1], factorMax)],
    Mg: [v(base.Mg[0], factorMin), v(base.Mg[1], factorMax)],
    Fe: [Math.round(base.Fe[0] * factorMin), Math.round(base.Fe[1] * factorMax)],
    Mn: [Math.round(base.Mn[0] * factorMin), Math.round(base.Mn[1] * factorMax)],
    Zn: [Math.round(base.Zn[0] * factorMin), Math.round(base.Zn[1] * factorMax)],
    B: [Math.round(base.B[0] * factorMin), Math.round(base.B[1] * factorMax)],
    Cu: [Math.round(base.Cu[0] * factorMin), Math.round(base.Cu[1] * factorMax)],
  };
}

// ─── CATÁLOGO COMPLETO ────────────────────────────────────────────────

export const CATALOGO: Especie[] = [

  // ═══ NECTARINA ═══════════════════════════════════════════════════
  {
    nombre: "Nectarina",
    grupo: "hueso",
    descripcion: "Prunus persica var. nucipersica — piel lisa",
    fenofasesNPK: FENOFASES_HUESO,
    variedades: [
      {
        id: "nect-bigtop", nombre: "Big Top", especie: "Nectarina", grupo: "hueso",
        chillPortions: 30, gddBloomToHarvest: 1100, fdpDias: 85,
        calibreOptMm: 70, brixOpt: 13.5, pesoFrutoG: 180, rendimientoBaseKgHa: 18000,
        extraccion: { N: 4.2, P2O5: 1.4, K2O: 5.8, CaO: 1.2, MgO: 0.5, Fe_g: 18, Mn_g: 12, Zn_g: 8, B_g: 6 },
        rangoFoliar: varyFoliar(FOLIAR_HUESO_BASE, 0.95, 1.05),
        portainjertosRec: ["GF677", "Felinem", "Cadaman"],
        densidadRec: "4×1.5 m (1667 pl/ha)", conduccionRec: "Vaso / Espaldera",
        obtentor: "Sun World", protegida: true,
        observaciones: "Variedad líder temprana. Baja exigencia en frío — ideal sur España y Marruecos.",
      },
      {
        id: "nect-diamondray", nombre: "Diamond Ray", especie: "Nectarina", grupo: "hueso",
        chillPortions: 35, gddBloomToHarvest: 1300, fdpDias: 100,
        calibreOptMm: 75, brixOpt: 14.0, pesoFrutoG: 200, rendimientoBaseKgHa: 20000,
        extraccion: { N: 4.5, P2O5: 1.6, K2O: 6.2, CaO: 1.4, MgO: 0.6, Fe_g: 20, Mn_g: 14, Zn_g: 9, B_g: 7 },
        rangoFoliar: varyFoliar(FOLIAR_HUESO_BASE, 0.98, 1.08),
        portainjertosRec: ["GF677", "Garnem"],
        densidadRec: "4×1.5 m (1667 pl/ha)", conduccionRec: "Espaldera",
        obtentor: "Sun World", protegida: true,
        observaciones: "Media estación. Calibre AA. Buena adaptación a Sevilla.",
      },
      {
        id: "nect-honeyroyale", nombre: "Honey Royale", especie: "Nectarina", grupo: "hueso",
        chillPortions: 25, gddBloomToHarvest: 950, fdpDias: 75,
        calibreOptMm: 68, brixOpt: 15.0, pesoFrutoG: 160, rendimientoBaseKgHa: 16000,
        extraccion: { N: 3.8, P2O5: 1.2, K2O: 5.2, CaO: 1.0, MgO: 0.45, Fe_g: 16, Mn_g: 10, Zn_g: 7, B_g: 5 },
        rangoFoliar: varyFoliar(FOLIAR_HUESO_BASE, 0.92, 1.02),
        portainjertosRec: ["GF677", "Felinem"],
        densidadRec: "3.5×1.5 m (1905 pl/ha)", conduccionRec: "Vaso",
        observaciones: "Muy temprana. Mínimo requerimiento de frío — apta para Marruecos y zonas muy cálidas.",
      },
      {
        id: "nect-royalsanguine", nombre: "Royal Sanguine®", especie: "Nectarina", grupo: "hueso",
        chillPortions: 32, gddBloomToHarvest: 1200, fdpDias: 92,
        calibreOptMm: 73, brixOpt: 14.5, pesoFrutoG: 190, rendimientoBaseKgHa: 17000,
        extraccion: { N: 4.3, P2O5: 1.5, K2O: 6.0, CaO: 1.3, MgO: 0.55, Fe_g: 19, Mn_g: 13, Zn_g: 8, B_g: 6 },
        rangoFoliar: varyFoliar(FOLIAR_HUESO_BASE, 0.96, 1.06),
        obtentor: "SAT Royal", protegida: true,
        observaciones: "Nectarina sanguina exclusiva Royal. Alta demanda mercado premium europeo.",
      },
    ],
  },

  // ═══ MELOCOTÓN ════════════════════════════════════════════════════
  {
    nombre: "Melocotón",
    grupo: "hueso",
    descripcion: "Prunus persica — piel con vello",
    fenofasesNPK: FENOFASES_HUESO,
    variedades: [
      {
        id: "melo-royaltime", nombre: "Royal Time", especie: "Melocotón", grupo: "hueso",
        chillPortions: 35, gddBloomToHarvest: 1200, fdpDias: 92,
        calibreOptMm: 73, brixOpt: 12.5, pesoFrutoG: 200, rendimientoBaseKgHa: 20000,
        extraccion: { N: 4.8, P2O5: 1.6, K2O: 6.5, CaO: 1.5, MgO: 0.6, Fe_g: 22, Mn_g: 15, Zn_g: 10, B_g: 7 },
        rangoFoliar: varyFoliar(FOLIAR_HUESO_BASE, 1.0, 1.1),
        portainjertosRec: ["GF677", "Garnem"], conduccionRec: "Vaso",
        observaciones: "Media estación. Buen comportamiento en zona semi-árida.",
      },
      {
        id: "melo-sweetcrest", nombre: "Sweet Crest", especie: "Melocotón", grupo: "hueso",
        chillPortions: 45, gddBloomToHarvest: 1450, fdpDias: 110,
        calibreOptMm: 80, brixOpt: 13.0, pesoFrutoG: 230, rendimientoBaseKgHa: 22000,
        extraccion: { N: 5.2, P2O5: 1.8, K2O: 7.0, CaO: 1.6, MgO: 0.65, Fe_g: 24, Mn_g: 16, Zn_g: 11, B_g: 8 },
        rangoFoliar: varyFoliar(FOLIAR_HUESO_BASE, 1.02, 1.12),
        portainjertosRec: ["GF677"], conduccionRec: "Espaldera",
        observaciones: "Tardío. Calibre AAA. Requiere más frío — mejor para zonas de altitud.",
      },
      {
        id: "melo-royalglory", nombre: "Royal Glory", especie: "Melocotón", grupo: "hueso",
        chillPortions: 38, gddBloomToHarvest: 1250, fdpDias: 96,
        calibreOptMm: 75, brixOpt: 13.0, pesoFrutoG: 210, rendimientoBaseKgHa: 19000,
        extraccion: { N: 4.6, P2O5: 1.5, K2O: 6.3, CaO: 1.4, MgO: 0.58, Fe_g: 21, Mn_g: 14, Zn_g: 9, B_g: 7 },
        rangoFoliar: varyFoliar(FOLIAR_HUESO_BASE, 0.97, 1.07),
        observaciones: "Variedad clásica española. Rojo intenso, excelente presentación.",
      },
    ],
  },

  // ═══ PARAGUAYO ════════════════════════════════════════════════════
  {
    nombre: "Paraguayo",
    grupo: "hueso",
    descripcion: "Prunus persica var. platycarpa — fruto achatado",
    fenofasesNPK: FENOFASES_HUESO,
    variedades: [
      {
        id: "para-ufo4", nombre: "UFO 4", especie: "Paraguayo", grupo: "hueso",
        chillPortions: 30, gddBloomToHarvest: 1050, fdpDias: 80,
        calibreOptMm: 65, brixOpt: 14.0, pesoFrutoG: 140, rendimientoBaseKgHa: 14000,
        extraccion: { N: 3.6, P2O5: 1.2, K2O: 5.0, CaO: 0.9, MgO: 0.4, Fe_g: 15, Mn_g: 10, Zn_g: 7, B_g: 5 },
        rangoFoliar: varyFoliar(FOLIAR_HUESO_BASE, 0.9, 1.0),
        observaciones: "Variedad chata precoz. Muy apreciada en mercados europeos.",
      },
    ],
  },

  // ═══ INTERESPECÍFICO ═════════════════════════════════════════════
  {
    nombre: "Pluot® / Interespecífico",
    grupo: "hueso",
    descripcion: "Híbrido ciruela × albaricoque — Pluot® y Metis®",
    fenofasesNPK: FENOFASES_HUESO,
    variedades: [
      {
        id: "pluo-metis1", nombre: "Metis® A", especie: "Pluot® / Interespecífico", grupo: "hueso",
        chillPortions: 28, gddBloomToHarvest: 1100, fdpDias: 85,
        calibreOptMm: 58, brixOpt: 16.0, pesoFrutoG: 90, rendimientoBaseKgHa: 10000,
        extraccion: { N: 3.2, P2O5: 1.0, K2O: 4.5, CaO: 0.8, MgO: 0.35, Fe_g: 13, Mn_g: 9, Zn_g: 6, B_g: 4 },
        rangoFoliar: varyFoliar(FOLIAR_HUESO_BASE, 0.88, 0.98),
        obtentor: "SAT Royal", protegida: true,
        observaciones: "Interespecífico ciruela-albaricoque. Alto Brix. Formato gourmet.",
      },
      {
        id: "pluo-pluot1", nombre: "Pluot® Premium", especie: "Pluot® / Interespecífico", grupo: "hueso",
        chillPortions: 30, gddBloomToHarvest: 1150, fdpDias: 88,
        calibreOptMm: 55, brixOpt: 17.0, pesoFrutoG: 85, rendimientoBaseKgHa: 9000,
        extraccion: { N: 3.0, P2O5: 1.0, K2O: 4.2, CaO: 0.75, MgO: 0.32, Fe_g: 12, Mn_g: 8, Zn_g: 5, B_g: 4 },
        rangoFoliar: varyFoliar(FOLIAR_HUESO_BASE, 0.85, 0.95),
        obtentor: "SAT Royal", protegida: true,
        observaciones: "Alta acidez + azúcar. Formato snack. Mercados nórdicos.",
      },
    ],
  },

  // ═══ ARÁNDANO ════════════════════════════════════════════════════
  {
    nombre: "Arándano",
    grupo: "arandano",
    descripcion: "Vaccinium corymbosum — variedades low-chill",
    fenofasesNPK: FENOFASES_ARANDANO,
    variedades: [
      {
        id: "aran-bluaroma", nombre: "Blu Aroma®", especie: "Arándano", grupo: "arandano",
        chillHours: 200, gddBase4: 1200,
        calibreOptMm: 18, brixOpt: 13.5, pesoFrutoG: 3.2, rendimientoBaseKgHa: 12000,
        extraccion: { N: 8.5, P2O5: 3.2, K2O: 10.5, CaO: 2.8, MgO: 1.2, Fe_g: 35, Mn_g: 90, Zn_g: 18, B_g: 12 },
        rangoFoliar: varyFoliar(FOLIAR_ARANDANO_BASE, 0.95, 1.05),
        densidadRec: "3×0.75 m (4444 pl/ha)", conduccionRec: "Hilera en malla",
        obtentor: "SAT Royal", protegida: true,
        observaciones: "Variedad estrella Royal. Doble Sabor del Año. 10.000 t/año. Principal cultivo Marruecos.",
      },
      {
        id: "aran-biloxi", nombre: "Biloxi", especie: "Arándano", grupo: "arandano",
        chillHours: 150, gddBase4: 1100,
        calibreOptMm: 16, brixOpt: 12.0, pesoFrutoG: 2.5, rendimientoBaseKgHa: 11000,
        extraccion: { N: 7.8, P2O5: 2.9, K2O: 9.8, CaO: 2.5, MgO: 1.0, Fe_g: 32, Mn_g: 80, Zn_g: 16, B_g: 10 },
        rangoFoliar: varyFoliar(FOLIAR_ARANDANO_BASE, 0.90, 1.0),
        densidadRec: "3×0.75 m (4444 pl/ha)",
        obtentor: "USDA",
        observaciones: "Referencia mundial low-chill. Muy productiva. Ideal Marruecos y sur España.",
      },
      {
        id: "aran-oneal", nombre: "O'Neal", especie: "Arándano", grupo: "arandano",
        chillHours: 400, gddBase4: 1300,
        calibreOptMm: 18, brixOpt: 13.0, pesoFrutoG: 3.0, rendimientoBaseKgHa: 13000,
        extraccion: { N: 8.8, P2O5: 3.4, K2O: 11.0, CaO: 3.0, MgO: 1.3, Fe_g: 38, Mn_g: 95, Zn_g: 20, B_g: 13 },
        rangoFoliar: varyFoliar(FOLIAR_ARANDANO_BASE, 0.98, 1.08),
        observaciones: "Calibre grande. Algo más exigente en frío — mejor Huelva y sur Portugal.",
      },
      {
        id: "aran-emerald", nombre: "Emerald", especie: "Arándano", grupo: "arandano",
        chillHours: 250, gddBase4: 1150,
        calibreOptMm: 19, brixOpt: 12.5, pesoFrutoG: 3.5, rendimientoBaseKgHa: 14000,
        extraccion: { N: 9.2, P2O5: 3.5, K2O: 11.5, CaO: 3.1, MgO: 1.35, Fe_g: 40, Mn_g: 100, Zn_g: 21, B_g: 14 },
        rangoFoliar: varyFoliar(FOLIAR_ARANDANO_BASE, 1.0, 1.10),
        obtentor: "Universidad de Florida",
        observaciones: "Calibre AAA, muy firme. Excelente poscosecha. Adaptada a Huelva y Marruecos.",
      },
    ],
  },

  // ═══ FRAMBUESA ════════════════════════════════════════════════════
  {
    nombre: "Frambuesa",
    grupo: "frambuesa",
    descripcion: "Rubus idaeus — variedades remontantes low-chill",
    fenofasesNPK: FENOFASES_FRAMBUESA,
    variedades: [
      {
        id: "fram-royalglamour", nombre: "Royal Glamour®", especie: "Frambuesa", grupo: "frambuesa",
        chillHours: 150, gddBase3: 750, ciclosAnio: 2,
        calibreOptMm: 22, brixOpt: 11.5, pesoFrutoG: 6.5, rendimientoBaseKgHa: 20000,
        extraccion: { N: 12.0, P2O5: 4.5, K2O: 14.0, CaO: 5.0, MgO: 2.0, Fe_g: 45, Mn_g: 60, Zn_g: 25, B_g: 15 },
        rangoFoliar: varyFoliar(FOLIAR_FRAMBUESA_BASE, 1.0, 1.10),
        densidadRec: "3×0.3 m (11111 pl/ha)", conduccionRec: "Espaldera doble",
        obtentor: "SAT Royal", protegida: true,
        observaciones: "Variedad exclusiva Royal. Referencia en Huelva y Marruecos. 2.000 t/año.",
      },
      {
        id: "fram-autumnbliss", nombre: "Autumn Bliss", especie: "Frambuesa", grupo: "frambuesa",
        chillHours: 200, gddBase3: 800, ciclosAnio: 2,
        calibreOptMm: 20, brixOpt: 10.5, pesoFrutoG: 5.5, rendimientoBaseKgHa: 18000,
        extraccion: { N: 11.0, P2O5: 4.0, K2O: 13.0, CaO: 4.5, MgO: 1.8, Fe_g: 40, Mn_g: 55, Zn_g: 22, B_g: 13 },
        rangoFoliar: varyFoliar(FOLIAR_FRAMBUESA_BASE, 0.95, 1.05),
        densidadRec: "3×0.3 m (11111 pl/ha)", conduccionRec: "Espaldera",
        obtentor: "HRI East Malling",
        observaciones: "Remontante clásica. Muy productiva. Dos cosechas: mayo-junio y sept-nov.",
      },
      {
        id: "fram-kweli", nombre: "Kweli", especie: "Frambuesa", grupo: "frambuesa",
        chillHours: 100, gddBase3: 720, ciclosAnio: 3,
        calibreOptMm: 20, brixOpt: 11.5, pesoFrutoG: 5.0, rendimientoBaseKgHa: 25000,
        extraccion: { N: 13.0, P2O5: 5.0, K2O: 15.5, CaO: 5.5, MgO: 2.2, Fe_g: 50, Mn_g: 65, Zn_g: 28, B_g: 17 },
        rangoFoliar: varyFoliar(FOLIAR_FRAMBUESA_BASE, 1.02, 1.12),
        observaciones: "Extremadamente low-chill. 3 ciclos en zonas subtropicales. Ideal Marruecos y Perú.",
      },
    ],
  },
];

// ─── Utilidades ──────────────────────────────────────────────────────

export function getVariedadesByEspecie(especie: string): Variedad[] {
  return CATALOGO.find(e => e.nombre === especie)?.variedades ?? [];
}
export function getVariedadById(id: string): Variedad | undefined {
  for (const esp of CATALOGO) {
    const v = esp.variedades.find(v => v.id === id);
    if (v) return v;
  }
}
export function getEspecieByNombre(nombre: string): Especie | undefined {
  return CATALOGO.find(e => e.nombre === nombre);
}
export function getAllVariedades(): Variedad[] {
  return CATALOGO.flatMap(e => e.variedades);
}
export const GRUPOS: { id: GrupoEspecie; label: string }[] = [
  { id: "hueso", label: "Fruta de hueso" },
  { id: "arandano", label: "Arándano" },
  { id: "frambuesa", label: "Frambuesa" },
];

// Fertilizantes comunes en fertirrigación
export const FERTILIZANTES = [
  { nombre: "Nitrato amónico (33%N)", N: 33, P2O5: 0, K2O: 0, CaO: 0, MgO: 0, precioKg: 0.42 },
  { nombre: "Nitrato cálcico (15.5%N)", N: 15.5, P2O5: 0, K2O: 0, CaO: 26, MgO: 0, precioKg: 0.38 },
  { nombre: "MAP Fosfato monoamónico", N: 12, P2O5: 61, K2O: 0, CaO: 0, MgO: 0, precioKg: 0.65 },
  { nombre: "MKP Fosfato monopotásico", N: 0, P2O5: 52, K2O: 34, CaO: 0, MgO: 0, precioKg: 1.10 },
  { nombre: "Sulfato potásico (50%K₂O)", N: 0, P2O5: 0, K2O: 50, CaO: 0, MgO: 0, precioKg: 0.55 },
  { nombre: "Nitrato potásico (13%N)", N: 13, P2O5: 0, K2O: 46, CaO: 0, MgO: 0, precioKg: 0.72 },
  { nombre: "Sulfato magnésico Kieserita", N: 0, P2O5: 0, K2O: 0, CaO: 0, MgO: 16, precioKg: 0.28 },
  { nombre: "Ácido fosfórico (52%P₂O₅)", N: 0, P2O5: 52, K2O: 0, CaO: 0, MgO: 0, precioKg: 0.90 },
  { nombre: "Quelato Fe EDDHA (6%)", N: 0, P2O5: 0, K2O: 0, CaO: 0, MgO: 0, precioKg: 8.50 },
  { nombre: "Sulfato de zinc (23%Zn)", N: 0, P2O5: 0, K2O: 0, CaO: 0, MgO: 0, precioKg: 0.80 },
  { nombre: "Boro soluble (20%B)", N: 0, P2O5: 0, K2O: 0, CaO: 0, MgO: 0, precioKg: 1.20 },
];
