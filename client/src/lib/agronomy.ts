// ─── LÓGICA AGRONÓMICA SAT ROYAL (Marruecos, Perú, España, Sudáfrica) ───

export const CULTIVOS_HUESO = ["Melocotón","Nectarina","Albaricoque","Paraguayo","Pluot","Ciruela","Cereza"];
export const CULTIVOS_BERRIES = ["Arándano","Frambuesa","Fresa"]; // Mora eliminada

export interface FertiParams {
  yieldTarget: number; // t/ha
  soilCE: number;      // Conductividad Eléctrica
}

/**
 * Calcula necesidades NPK basadas en extracciones reales por cultivo
 */
export const getNutrientNeeds = (especie: string, params: FertiParams) => {
  const isBerry = CULTIVOS_BERRIES.includes(especie);
  
  // Coeficientes SAT (kg de nutriente por tonelada producida)
  const coef = isBerry 
    ? { n: 1.6, p: 0.5, k: 2.2 }  // Berries
    : { n: 2.8, p: 0.9, k: 3.8 }; // Fruto de Hueso

  // Factor de Salinidad: Si CE > 1.2 en zonas cálidas, subimos dosis por lavado
  const salinityAdjust = (isBerry && params.soilCE > 1.2) ? 1.25 : 1.05;

  return {
    n: (params.yieldTarget * coef.n * salinityAdjust).toFixed(1),
    p: (params.yieldTarget * coef.p * salinityAdjust).toFixed(1),
    k: (params.yieldTarget * coef.k * salinityAdjust).toFixed(1),
    isCriticalCE: params.soilCE > 2.0
  };
};

/**
 * Modelo GDD para estimación de fechas
 */
export const calculateGDD = (tMax: number, tMin: number, baseTemp: number = 4.4) => {
  const avg = (tMax + tMin) / 2;
  return Math.max(0, avg - baseTemp);
};