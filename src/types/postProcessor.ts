/**
 * Post-processor types derived from real production files:
 * 
 * SmartCut (.nc): %, G0 G53 Z0.0, M752 header / M5, G0 G53 Z0.0, M750, M30, % footer
 *   - R-format arcs: G2 X... Y... R3.000
 *   - Diagonal ramp entry
 *   - Single Z format for coordinates
 * 
 * Mach CNC (.nc): G53Z0, M752 (Logica Inicial) header / M5, G53Z0, M750, M30 footer
 *   - Metadata comments in header
 *   - Two-pass cutting: Step 1/2 at Z2.0, Step 2/2 at Z-0.2
 *   - Different RPMs (S2500 for brocas vs S8000 in SmartCut)
 * 
 * Aspire (.tap): (TURBO_DNA_ASPIRE), G53 Z0, M752 / M5, G53 Z0, M702, M704, M30
 *   - I/J-format arcs: G2 X... Y... I0.0000 J3.0000
 *   - Helical ramp entry (30 micro-steps)
 *   - Z seguro: espessura+5.08 (e.g., 15+5.08=20.08)
 */

export type PostProcessorType = "smartcut" | "mach_cnc" | "aspire";
export type ArcFormat = "R" | "IJ";
export type RampEntry = "helicoidal" | "diagonal";

export interface PostProcessorConfig {
  tipo: PostProcessorType;
  nome: string;
  extensao: ".nc" | ".tap";
  arcFormat: ArcFormat;
  rampEntry: RampEntry;
  rampSteps: number;            // 10 for smartcut, 30 for aspire
  
  // Z heights
  zSeguro: number;              // SmartCut: 50, Mach: 50-53, Aspire: espessura+5.08
  zRapido: number;              // SmartCut: 16, Mach: 20-23, Aspire: espessura
  zSeguroAutoCalc: boolean;     // If true, zSeguro = espessura + offset
  zSeguroOffset: number;        // Offset above material for Aspire (5.08)
  
  // Cutting depths
  passePreCorte: number;        // Mach CNC Step 1: Z2.0 (above surface, holding cut)
  passeFinal: number;           // Z-0.1 (SmartCut) or Z-0.2 (Mach CNC)
  usarDoisPasses: boolean;      // Mach CNC: true for small pieces
  
  // Feed overrides (used when magazine tool feed should be overridden)
  avancoEntradaOverride: number | null;  // Mach: 1500, Aspire: 2500
  avancoCorteOverride: number | null;    // Mach: 10000, Aspire: 10000
  avancoLeadOut: number | null;          // Mach: 7000, Aspire: null
  
  // Size thresholds for two-pass
  larguraPequena: number;       // 150mm
  areaPequena: number;          // 90000mm²
  
  // Header/Footer
  headerLines: string[];
  footerLines: string[];
  includeMetadata: boolean;     // Mach CNC includes material/dimension comments
  
  // Contour
  raioContorno: number;         // R3.000
  leadOutDistance: number;       // SmartCut: 50mm exit, Mach/Aspire: leadout via feed change
}

export const SMARTCUT_CONFIG: PostProcessorConfig = {
  tipo: "smartcut",
  nome: "SmartCut Nesting",
  extensao: ".nc",
  arcFormat: "R",
  rampEntry: "diagonal",
  rampSteps: 10,
  zSeguro: 50,
  zRapido: 16,
  zSeguroAutoCalc: false,
  zSeguroOffset: 0,
  passePreCorte: 1.0,
  passeFinal: -0.1,
  usarDoisPasses: true,
  avancoEntradaOverride: 4000,
  avancoCorteOverride: 8000,
  avancoLeadOut: 4000,
  larguraPequena: 150,
  areaPequena: 90000,
  headerLines: ["%", "G0 G53 Z0.0", "M752"],
  footerLines: ["M5", "G0 G53 Z0.0", "M750", "M30", "%"],
  includeMetadata: false,
  raioContorno: 3.0,
  leadOutDistance: 50,
};

export const MACH_CNC_CONFIG: PostProcessorConfig = {
  tipo: "mach_cnc",
  nome: "Mach3D Corte - TURBO",
  extensao: ".nc",
  arcFormat: "R",
  rampEntry: "diagonal",
  rampSteps: 0,
  zSeguro: 50,
  zRapido: 20,
  zSeguroAutoCalc: false,
  zSeguroOffset: 3,
  passePreCorte: 2.0,
  passeFinal: -0.2,
  usarDoisPasses: true,
  avancoEntradaOverride: 1500,
  avancoCorteOverride: 10000,
  avancoLeadOut: 7000,
  larguraPequena: 150,
  areaPequena: 90000,
  headerLines: ["(######## HEADER ########)", "G53Z0 ", "M752 (Logica Inicial)"],
  footerLines: ["(######## FOOTER ########)", "M5 ", "G53Z0", "M750", "M30"],
  includeMetadata: true,
  raioContorno: 3.0,
  leadOutDistance: 50,
};

export const ASPIRE_CONFIG: PostProcessorConfig = {
  tipo: "aspire",
  nome: "Aspire / TURBO DNA",
  extensao: ".tap",
  arcFormat: "IJ",
  rampEntry: "helicoidal",
  rampSteps: 30,
  zSeguro: 20.08,
  zRapido: 15,
  zSeguroAutoCalc: true,
  zSeguroOffset: 5.08,
  passePreCorte: 0,
  passeFinal: -0.1,
  usarDoisPasses: false,
  avancoEntradaOverride: 2500,
  avancoCorteOverride: 10000,
  avancoLeadOut: null,
  larguraPequena: 150,
  areaPequena: 90000,
  headerLines: ["(TURBO_DNA_ASPIRE)", " ", "G53 Z0", "M752"],
  footerLines: [" ", "M5", "G53 Z0", "M702", "M704", "M30"],
  includeMetadata: false,
  raioContorno: 3.0,
  leadOutDistance: 15.1,  // ~leadOutDistance offset used in Aspire files
};

export const POST_PROCESSORS: Record<PostProcessorType, PostProcessorConfig> = {
  smartcut: SMARTCUT_CONFIG,
  mach_cnc: MACH_CNC_CONFIG,
  aspire: ASPIRE_CONFIG,
};
