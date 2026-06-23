/**
 * Configuração da empresa que aparece no cabeçalho dos orçamentos impressos.
 * Persistido em localStorage.
 */

export interface CompanyInfo {
  nome: string;
  telefone: string;
  email: string;
  endereco: string;
  cnpj: string;
  /** Logo em data URL (base64) */
  logoDataUrl: string;
  /** Texto livre (rodapé) */
  rodape: string;
}

const KEY = "maxcut.empresa.v1";

export const DEFAULT_COMPANY: CompanyInfo = {
  nome: "MAXCUT",
  telefone: "",
  email: "",
  endereco: "",
  cnpj: "",
  logoDataUrl: "",
  rodape: "Orçamento válido por 30 dias.",
};

export function loadCompany(): CompanyInfo {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_COMPANY;
    return { ...DEFAULT_COMPANY, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_COMPANY;
  }
}

export function saveCompany(c: CompanyInfo): void {
  localStorage.setItem(KEY, JSON.stringify(c));
}
