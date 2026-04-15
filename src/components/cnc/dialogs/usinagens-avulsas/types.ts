export type UsinagemAvulsaTipo = "dobradica" | "prateleira" | "canal_led" | "canal_ventilacao";

export type LadoReferencia = "superior" | "inferior" | "esquerda" | "direita";

export interface DobradicaConfig {
  lado: LadoReferencia;
  larguraPorta: number;
  alturaPorta: number;
  espessura: 15 | 18 | 25;
  numDobradicasTotal: number; // 2..5
  recuoBorda: number; // default 100mm from top/bottom edges
  distanciaBordaLateral: number; // default 4mm from side edge
  diametroFresa: number; // 35mm
  profundidade: number; // 11.5mm from surface
}

export interface PrateleiraConfig {
  largura: number;
  altura: number;
  espessura: 15 | 18 | 25;
}

export interface CanalLEDConfig {
  largura: number;
  altura: number;
  espessura: 15 | 18 | 25;
  ladoReferencia: LadoReferencia;
  profundidadeCanal: number;
  distanciaBorda: number;
  espessuraCanal: number; // width of the channel
  rompeLateral: boolean; // channel goes through the edge
  bordaInicio: boolean; // closed start
  bordaFim: boolean; // closed end
  cortarPeca: boolean; // whether to cut the piece contour
  afastamentoX: number; // offset from machine zero
  afastamentoY: number;
}

export interface CanalVentilacaoConfig {
  largura: number;
  altura: number;
  espessura: 15 | 18 | 25;
  ladoReferencia: LadoReferencia;
  profundidadeCanal: number;
  espessuraCanal: number;
  numCanais: number;
  distanciaBordaSuperior: number;
  distanciaBordaInferior: number;
  distribuicaoEquivalente: boolean;
  cortarPeca: boolean;
  afastamentoX: number;
  afastamentoY: number;
}

// Hinge standard: 35mm Forstner bit, 11.5mm depth from surface
export const DOBRADICA_DEFAULTS: DobradicaConfig = {
  lado: "esquerda",
  larguraPorta: 500,
  alturaPorta: 700,
  espessura: 15,
  numDobradicasTotal: 2,
  recuoBorda: 100,
  distanciaBordaLateral: 4,
  diametroFresa: 35,
  profundidade: 11.5,
};

// Shelf standard: 5mm bit, 12mm depth, 4 holes at standard positions
export const PRATELEIRA_DEFAULTS: PrateleiraConfig = {
  largura: 500,
  altura: 400,
  espessura: 15,
};

export const CANAL_LED_DEFAULTS: CanalLEDConfig = {
  largura: 600,
  altura: 100,
  espessura: 15,
  ladoReferencia: "superior",
  profundidadeCanal: 8,
  distanciaBorda: 15,
  espessuraCanal: 10,
  rompeLateral: false,
  bordaInicio: true,
  bordaFim: true,
  cortarPeca: true,
  afastamentoX: 0,
  afastamentoY: 0,
};

export const CANAL_VENTILACAO_DEFAULTS: CanalVentilacaoConfig = {
  largura: 1000,
  altura: 600,
  espessura: 15,
  ladoReferencia: "esquerda",
  profundidadeCanal: 8,
  espessuraCanal: 10,
  numCanais: 3,
  distanciaBordaSuperior: 60,
  distanciaBordaInferior: 60,
  distribuicaoEquivalente: true,
  cortarPeca: true,
  afastamentoX: 0,
  afastamentoY: 0,
};

/** Calculate hinge positions along the height of the door */
export function calcularPosicoesDobradicas(config: DobradicaConfig): number[] {
  const { alturaPorta, numDobradicasTotal, recuoBorda, diametroFresa } = config;
  const raio = diametroFresa / 2;
  
  // The edge distance is measured from the edge of the hole, not center
  const posTop = recuoBorda + raio; // center position of top hinge
  const posBottom = alturaPorta - recuoBorda - raio; // center position of bottom hinge
  
  if (numDobradicasTotal <= 2) return [posTop, posBottom];
  
  const positions = [posTop];
  const espacamento = (posBottom - posTop) / (numDobradicasTotal - 1);
  for (let i = 1; i < numDobradicasTotal - 1; i++) {
    positions.push(posTop + espacamento * i);
  }
  positions.push(posBottom);
  return positions;
}

/** Calculate shelf hole positions (4 standard holes) */
export function calcularFurosPrateleira(config: PrateleiraConfig) {
  const { largura, altura } = config;
  const recuoX = 37; // standard 37mm from edges
  const recuoY = 9.5; // standard 9.5mm from edges
  return [
    { x: recuoX, y: recuoY },
    { x: largura - recuoX, y: recuoY },
    { x: recuoX, y: altura - recuoY },
    { x: largura - recuoX, y: altura - recuoY },
  ];
}

/** Calculate ventilation channel Y positions */
export function calcularPosicoesCanaisVentilacao(config: CanalVentilacaoConfig): number[] {
  const { altura, numCanais, distanciaBordaSuperior, distanciaBordaInferior, distribuicaoEquivalente } = config;
  
  if (numCanais <= 0) return [];
  
  if (distribuicaoEquivalente) {
    if (distanciaBordaSuperior > 0 || distanciaBordaInferior > 0) {
      // Fixed edges + distribute between them
      const topY = distanciaBordaSuperior;
      const bottomY = altura - distanciaBordaInferior;
      if (numCanais === 1) return [(topY + bottomY) / 2];
      const step = (bottomY - topY) / (numCanais - 1);
      return Array.from({ length: numCanais }, (_, i) => topY + step * i);
    } else {
      // Full equal distribution
      const step = altura / (numCanais + 1);
      return Array.from({ length: numCanais }, (_, i) => step * (i + 1));
    }
  }
  
  // Manual: just distribute evenly for now
  const step = altura / (numCanais + 1);
  return Array.from({ length: numCanais }, (_, i) => step * (i + 1));
}
