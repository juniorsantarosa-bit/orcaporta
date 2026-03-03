/**
 * Tool Magazine configuration for ATC-16 machines.
 * Mapped from real SmartCut/Aspire/Mach CNC production files.
 */

export type ToolType = "broca" | "fresa_topo" | "fresa_vbit" | "fresa_disco" | "none";

export interface ToolSlot {
  position: number;       // T1-T16
  nome: string;
  tipo: ToolType;
  diametro: number;       // mm
  rpm: number;
  avancoCorte: number;    // Feed rate for cutting (mm/min)
  avancoEntrada: number;  // Feed rate for ramp/plunge entry (mm/min)
  ativo: boolean;
}

export interface ToolMagazine {
  nome: string;
  slots: ToolSlot[];
}

/**
 * Default magazine derived from production files:
 * - 0001_Areia_15mm.nc (SmartCut): T1=Fresa6mm S24000, T2=Broca3mm S8000, T5=Broca35mm S8000
 * - hellena_*.nc (Mach CNC): T1=Fresa6mm S18000, T3=Broca4mm S2500, T5=Broca35mm S2500, T6=VBit45 S18000
 * - hellena_Oasis_15mm.nc: T2=Broca3mm, T4=Broca15mm
 */
export const DEFAULT_TOOL_MAGAZINE: ToolMagazine = {
  nome: "Mach Turbo ATC16",
  slots: [
    { position: 1,  nome: "Fresa 6mm",      tipo: "fresa_topo", diametro: 6.0,  rpm: 24000, avancoCorte: 8000,  avancoEntrada: 4000, ativo: true },
    { position: 2,  nome: "Broca 3mm",       tipo: "broca",      diametro: 3.0,  rpm: 8000,  avancoCorte: 3000,  avancoEntrada: 3000, ativo: true },
    { position: 3,  nome: "Broca 4mm",       tipo: "broca",      diametro: 4.0,  rpm: 2500,  avancoCorte: 5000,  avancoEntrada: 5000, ativo: true },
    { position: 4,  nome: "Broca 15mm",      tipo: "broca",      diametro: 15.0, rpm: 8000,  avancoCorte: 3000,  avancoEntrada: 3000, ativo: true },
    { position: 5,  nome: "Broca 35mm",      tipo: "broca",      diametro: 35.0, rpm: 8000,  avancoCorte: 3000,  avancoEntrada: 3000, ativo: true },
    { position: 6,  nome: "Fresa VBit 45°",  tipo: "fresa_vbit", diametro: 18.5, rpm: 18000, avancoCorte: 4000,  avancoEntrada: 1000, ativo: true },
    { position: 7,  nome: "",                 tipo: "none",       diametro: 0,    rpm: 0,     avancoCorte: 0,     avancoEntrada: 0,    ativo: false },
    { position: 8,  nome: "",                 tipo: "none",       diametro: 0,    rpm: 0,     avancoCorte: 0,     avancoEntrada: 0,    ativo: false },
    { position: 9,  nome: "",                 tipo: "none",       diametro: 0,    rpm: 0,     avancoCorte: 0,     avancoEntrada: 0,    ativo: false },
    { position: 10, nome: "",                 tipo: "none",       diametro: 0,    rpm: 0,     avancoCorte: 0,     avancoEntrada: 0,    ativo: false },
    { position: 11, nome: "",                 tipo: "none",       diametro: 0,    rpm: 0,     avancoCorte: 0,     avancoEntrada: 0,    ativo: false },
    { position: 12, nome: "",                 tipo: "none",       diametro: 0,    rpm: 0,     avancoCorte: 0,     avancoEntrada: 0,    ativo: false },
    { position: 13, nome: "",                 tipo: "none",       diametro: 0,    rpm: 0,     avancoCorte: 0,     avancoEntrada: 0,    ativo: false },
    { position: 14, nome: "",                 tipo: "none",       diametro: 0,    rpm: 0,     avancoCorte: 0,     avancoEntrada: 0,    ativo: false },
    { position: 15, nome: "",                 tipo: "none",       diametro: 0,    rpm: 0,     avancoCorte: 0,     avancoEntrada: 0,    ativo: false },
    { position: 16, nome: "",                 tipo: "none",       diametro: 0,    rpm: 0,     avancoCorte: 0,     avancoEntrada: 0,    ativo: false },
  ],
};

/** Find the tool slot for a given tool function */
export function findToolByDiameter(magazine: ToolMagazine, diametro: number, tipo?: ToolType): ToolSlot | undefined {
  return magazine.slots.find(s => s.ativo && s.diametro === diametro && (tipo ? s.tipo === tipo : true));
}

export function findToolByPosition(magazine: ToolMagazine, position: number): ToolSlot | undefined {
  return magazine.slots.find(s => s.position === position && s.ativo);
}

/** Get the fresa de corte (main cutting endmill) */
export function getMainFresa(magazine: ToolMagazine): ToolSlot {
  return magazine.slots.find(s => s.ativo && s.tipo === "fresa_topo") || magazine.slots[0];
}
