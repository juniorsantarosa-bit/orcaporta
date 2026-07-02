import { useRef, useState, useCallback, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CuttingPiece } from "@/types/cutting";
import { ImagePlus, Loader2, Sparkles, AlertTriangle, Trash2, Layers, FileText } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { normalizeMaterialName, DOOR_TYPE_LABEL } from "@/lib/materialUtils";

type DoorType = 'single18' | 'provencal' | 'triple6';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (pieces: CuttingPiece[]) => void;
}

interface ExtractedPiece {
  item: number;
  descricao: string;
  larguraMm: number;
  alturaMm: number;
  espessuraMm: number;
  material?: string;
  quantidade: number;
  furosDobradica: number;
  confidence: number;
  _sourceLabel?: string;
}

interface PageSource {
  id: string;
  label: string;      // e.g. "arquivo.pdf · p.2" ou "foto.jpg"
  dataUrl: string;    // thumbnail / imagem enviada à IA
  status: 'pending' | 'processing' | 'done' | 'error';
  error?: string;
  cotas?: number[];
  divergencias?: string[];
  count?: number;
  reviewed?: boolean;
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function pdfPagesToDataUrls(file: File): Promise<string[]> {
  // pdfjs-dist v6 — legacy build funciona bem em Vite/browser
  const pdfjs: any = await import("pdfjs-dist/legacy/build/pdf.mjs");
  // worker via CDN — evita configurar bundler
  const workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/legacy/build/pdf.worker.min.mjs`;
  pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;

  const buf = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buf }).promise;
  const urls: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    // resolução: alvo ~2000px na maior aresta para leitura de tabela
    const baseViewport = page.getViewport({ scale: 1 });
    const target = 2000;
    const scale = Math.min(3, target / Math.max(baseViewport.width, baseViewport.height));
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport, canvas }).promise;
    urls.push(canvas.toDataURL("image/jpeg", 0.85));
  }
  return urls;
}

export function ImportarImagemIADialog({ open, onOpenChange, onImport }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [sources, setSources] = useState<PageSource[]>([]);
  const [pieces, setPieces] = useState<ExtractedPiece[]>([]);
  const [loading, setLoading] = useState(false);
  const [doorType, setDoorType] = useState<DoorType>('provencal');

  const reset = useCallback(() => {
    setSources([]);
    setPieces([]);
    setLoading(false);
  }, []);

  const CONFIDENCE_THRESHOLD = 0.95;

  const callExtract = async (dataUrl: string, reviewMode: boolean) => {
    const { data, error } = await supabase.functions.invoke("extract-pieces-from-image", {
      body: { imageDataUrl: dataUrl, reviewMode },
    });
    if (error) throw new Error(error.message);
    return data as { pieces: ExtractedPiece[]; cotasNoDesenho: number[]; divergencias: string[] };
  };

  const extractOne = useCallback(async (src: PageSource): Promise<ExtractedPiece[]> => {
    setSources(prev => prev.map(s => s.id === src.id ? { ...s, status: 'processing' } : s));
    try {
      let r = await callExtract(src.dataUrl, false);
      const lowConf = (r?.pieces ?? []).some(p => (p.confidence ?? 0) < CONFIDENCE_THRESHOLD);
      const hasDivergence = (r?.divergencias ?? []).length > 0;
      let reviewed = false;
      if (lowConf || hasDivergence) {
        // 2ª passada crítica — substitui resultado
        try {
          const r2 = await callExtract(src.dataUrl, true);
          if (r2?.pieces?.length) {
            r = r2;
            reviewed = true;
          }
        } catch {/* mantém 1ª leitura */}
      }
      const list = (r?.pieces ?? []).map(p => ({
        ...p,
        material: normalizeMaterialName(p.material, p.descricao),
        _sourceLabel: src.label,
      }));
      setSources(prev => prev.map(s => s.id === src.id
        ? { ...s, status: 'done', cotas: r?.cotasNoDesenho ?? [], divergencias: r?.divergencias ?? [], count: list.length, reviewed }
        : s));
      return list;
    } catch (e: any) {
      const msg = e?.message || "Falha na análise";
      setSources(prev => prev.map(s => s.id === src.id ? { ...s, status: 'error', error: msg } : s));
      toast.error(`${src.label}: ${msg}`);
      return [];
    }
  }, []);

  const handleFiles = useCallback(async (files: File[]) => {
    if (files.length === 0) return;
    setLoading(true);

    // 1) expandir arquivos em páginas/imagens
    const expanded: PageSource[] = [];
    for (const f of files) {
      try {
        if (f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf")) {
          const urls = await pdfPagesToDataUrls(f);
          urls.forEach((u, i) => expanded.push({
            id: `${f.name}-${i}-${Date.now()}-${Math.random()}`,
            label: `${f.name} · p.${i + 1}`,
            dataUrl: u,
            status: 'pending',
          }));
        } else if (f.type.startsWith("image/")) {
          const u = await fileToDataUrl(f);
          expanded.push({
            id: `${f.name}-${Date.now()}-${Math.random()}`,
            label: f.name,
            dataUrl: u,
            status: 'pending',
          });
        } else {
          toast.error(`Formato não suportado: ${f.name}`);
        }
      } catch (e: any) {
        toast.error(`Erro lendo ${f.name}: ${e?.message || e}`);
      }
    }

    if (expanded.length === 0) {
      setLoading(false);
      return;
    }
    setSources(prev => [...prev, ...expanded]);

    // 2) chamar a IA em paralelo (limite simples de 3 por vez p/ não estourar gateway)
    const queue = [...expanded];
    const collected: ExtractedPiece[] = [];
    const CONCURRENCY = 3;
    await Promise.all(
      Array.from({ length: CONCURRENCY }).map(async () => {
        while (queue.length) {
          const s = queue.shift()!;
          const res = await extractOne(s);
          collected.push(...res);
        }
      })
    );

    if (collected.length) {
      setPieces(prev => [...prev, ...collected]);
      toast.success(`${collected.length} peça(s) extraída(s) de ${expanded.length} página(s).`);
    }
    setLoading(false);
  }, [extractOne]);

  useEffect(() => { if (!open) reset(); }, [open, reset]);

  // Carrega anexos vindos de uma Ordem de Serviço (Gmail)
  useEffect(() => {
    if (!open) return;
    const raw = sessionStorage.getItem("maxcut.pendingOrderAttachments");
    if (!raw) return;
    try {
      const payload = JSON.parse(raw) as { attachments: Array<{ name: string; mime: string; dataUrl: string }> };
      sessionStorage.removeItem("maxcut.pendingOrderAttachments");
      const files: File[] = payload.attachments.map(a => {
        const b64 = a.dataUrl.split(",")[1] || "";
        const bin = atob(b64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        return new File([bytes], a.name, { type: a.mime });
      });
      if (files.length) {
        toast.info(`Carregando ${files.length} anexo(s) da ordem de serviço…`);
        handleFiles(files);
      }
    } catch (e) {
      console.error("Falha ao carregar anexos da ordem:", e);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const updatePiece = (idx: number, patch: Partial<ExtractedPiece>) => {
    setPieces(prev => prev.map((p, i) => (i === idx ? { ...p, ...patch } : p)));
  };
  const removePiece = (idx: number) => {
    setPieces(prev => prev.filter((_, i) => i !== idx));
  };

  const handleConfirm = () => {
    if (pieces.length === 0) {
      toast.error("Nenhuma peça para importar.");
      return;
    }
    const cuttingPieces: CuttingPiece[] = pieces.map((p, i) => ({
      id: Date.now() + i,
      projeto: p._sourceLabel ?? "Imagem",
      cliente: "",
      descricao: p.descricao,
      largura: p.larguraMm,
      altura: p.alturaMm,
      espessura: p.espessuraMm,
      material: normalizeMaterialName(p.material, p.descricao),
      quantidade: p.quantidade,
      bordaInf: true,
      bordaSup: true,
      bordaEsq: true,
      bordaDir: true,
      veio: false,
      observacao: `IA · ${p._sourceLabel ?? ""} · item ${p.item} · conf ${(p.confidence * 100).toFixed(0)}% · ${DOOR_TYPE_LABEL[doorType]}`,
      furosDobradica: p.furosDobradica || 0,
      bordaDuplaProvencal: doorType === 'provencal',
      doorType,
      provencal: doorType === 'provencal',
      source: "manual",
    }));
    onImport(cuttingPieces);
    toast.success(`${cuttingPieces.length} peça(s) importada(s).`);
    reset();
    onOpenChange(false);
  };

  const handleClose = (o: boolean) => {
    if (!o) reset();
    onOpenChange(o);
  };

  const confColor = (c: number) =>
    c >= 0.85 ? "text-emerald-500" : c >= 0.6 ? "text-amber-500" : "text-red-500";

  const hasSources = sources.length > 0;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-[1200px] h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-xl font-normal flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Importar Peças de Imagem/PDF (IA)
          </DialogTitle>
        </DialogHeader>

        {!hasSources ? (
          <div className="flex-1 flex flex-col gap-4">
            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <div className="flex items-center gap-2 text-xs font-semibold mb-2">
                <Layers className="h-4 w-4 text-primary" />
                Tipo de porta (define quantas chapas de cada espessura serão orçadas)
              </div>
              <div className="grid grid-cols-3 gap-2">
                {(['single18','provencal','triple6'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setDoorType(t)}
                    className={`text-left rounded border px-3 py-2 text-xs transition-colors ${
                      doorType === t
                        ? 'border-primary bg-primary/10 text-foreground'
                        : 'border-border hover:bg-muted/50 text-muted-foreground'
                    }`}
                  >
                    <div className="font-semibold text-foreground">{DOOR_TYPE_LABEL[t]}</div>
                    <div className="text-[10px] mt-0.5 text-muted-foreground">
                      {t === 'single18' && 'Porta lisa — 1 chapa única de 18mm.'}
                      {t === 'provencal' && 'Frente + fundo — chapa 6mm sobre chapa 15mm.'}
                      {t === 'triple6' && 'Três chapas 6mm coladas (faceadas) formando 18mm.'}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div
              className="border-2 border-dashed border-border rounded-lg p-12 text-center cursor-pointer hover:border-primary/50 transition-colors flex-1 flex flex-col items-center justify-center"
              onClick={() => fileRef.current?.click()}
            >
              <input
                ref={fileRef}
                type="file"
                className="hidden"
                accept="image/*,application/pdf"
                multiple
                onChange={(e) => {
                  const list = Array.from(e.target.files ?? []);
                  if (list.length) handleFiles(list);
                  // reset input para permitir reenviar o mesmo arquivo depois
                  e.target.value = "";
                }}
              />
              <div className="flex gap-3 mb-3">
                <ImagePlus className="h-14 w-14 text-muted-foreground" />
                <FileText className="h-14 w-14 text-muted-foreground" />
              </div>
              <p className="text-base text-muted-foreground">Clique para enviar imagens e/ou PDFs do projeto</p>
              <p className="text-xs text-muted-foreground mt-2">
                Você pode selecionar vários arquivos — a IA processa cada página/imagem automaticamente.
              </p>
              <p className="text-[10px] text-muted-foreground mt-1">PNG, JPG, WEBP, PDF — até ~10 MB cada.</p>
            </div>
          </div>
        ) : (
          <div className="flex-1 grid grid-cols-[280px_1fr] gap-3 overflow-hidden">
            {/* Lista de páginas/imagens */}
            <div className="border border-border rounded-lg flex flex-col overflow-hidden">
              <div className="px-3 py-2 border-b border-border bg-card flex items-center justify-between">
                <span className="text-xs font-medium">Origens ({sources.length})</span>
                <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => fileRef.current?.click()}>
                  + Adicionar
                </Button>
                <input
                  ref={fileRef}
                  type="file"
                  className="hidden"
                  accept="image/*,application/pdf"
                  multiple
                  onChange={(e) => {
                    const list = Array.from(e.target.files ?? []);
                    if (list.length) handleFiles(list);
                    e.target.value = "";
                  }}
                />
              </div>
              <ScrollArea className="flex-1">
                <div className="p-2 space-y-2">
                  {sources.map(s => (
                    <div key={s.id} className="rounded border border-border bg-muted/20 p-2 space-y-1">
                      <div className="aspect-video bg-black/30 rounded overflow-hidden flex items-center justify-center">
                        <img src={s.dataUrl} alt={s.label} className="max-w-full max-h-full object-contain" />
                      </div>
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[10px] truncate flex-1" title={s.label}>{s.label}</span>
                        {s.status === 'processing' && <Loader2 className="h-3 w-3 animate-spin text-primary" />}
                        {s.status === 'done' && (
                          <Badge variant="secondary" className="text-[9px] px-1 py-0">{s.count ?? 0}</Badge>
                        )}
                        {s.status === 'error' && (
                          <AlertTriangle className="h-3 w-3 text-red-500" />
                        )}
                        {s.status === 'pending' && (
                          <span className="text-[9px] text-muted-foreground">aguardando</span>
                        )}
                      </div>
                      {s.divergencias && s.divergencias.length > 0 && (
                        <div className="text-[9px] text-amber-500">⚠ {s.divergencias.length} divergência(s)</div>
                      )}
                      {s.error && <div className="text-[9px] text-red-500">{s.error}</div>}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>

            {/* Tabela agregada */}
            <div className="border border-border rounded-lg flex flex-col overflow-hidden">
              <div className="px-3 py-2 border-b border-border bg-card flex items-center justify-between">
                <span className="text-xs font-medium">Peças extraídas (todas as origens)</span>
                <div className="flex items-center gap-2">
                  {sources.some(s => s.reviewed) && (
                    <Badge variant="outline" className="text-[10px] border-amber-500 text-amber-600">
                      Revisão IA aplicada
                    </Badge>
                  )}
                  <Badge variant="outline" className="text-[10px]">{pieces.length} peça(s)</Badge>
                </div>
              </div>

              {/* Banner de divergências agregadas */}
              {(() => {
                const allDiv = sources.flatMap(s => (s.divergencias ?? []).map(d => ({ src: s.label, d })));
                if (allDiv.length === 0) return null;
                return (
                  <div className="mx-2 mt-2 rounded border border-amber-500/50 bg-amber-500/10 p-2 text-[11px]">
                    <div className="flex items-center gap-1 font-semibold text-amber-700 dark:text-amber-400 mb-1">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      {allDiv.length} divergência(s) tabela × desenho — revise antes de importar
                    </div>
                    <ul className="space-y-0.5 list-disc pl-5 text-amber-900 dark:text-amber-200">
                      {allDiv.slice(0, 8).map((x, i) => (
                        <li key={i}><span className="opacity-70">[{x.src}]</span> {x.d}</li>
                      ))}
                      {allDiv.length > 8 && <li className="opacity-70">…e mais {allDiv.length - 8}</li>}
                    </ul>
                  </div>
                );
              })()}

              {loading && pieces.length === 0 && (
                <div className="flex-1 flex flex-col items-center justify-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  <span>Processando arquivos com IA (com revisão automática)…</span>
                </div>
              )}

              {pieces.length > 0 && (
                <ScrollArea className="flex-1">
                  <div className="p-2">
                    <table className="w-full text-[11px]">
                      <thead className="text-muted-foreground sticky top-0 bg-card">
                        <tr className="border-b border-border">
                          <th className="text-left py-1 px-1 w-24">Origem</th>
                          <th className="text-left py-1 px-1 w-8">#</th>
                          <th className="text-left py-1 px-1">Descrição</th>
                          <th className="text-left py-1 px-1 w-28">Material</th>
                          <th className="text-left py-1 px-1 w-14">L</th>
                          <th className="text-left py-1 px-1 w-14">A</th>
                          <th className="text-left py-1 px-1 w-12">E</th>
                          <th className="text-left py-1 px-1 w-10">Qtd</th>
                          <th className="text-left py-1 px-1 w-10" title="Furos de dobradiça">Dob.</th>
                          <th className="text-left py-1 px-1 w-10">Conf</th>
                          <th className="w-6"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {pieces.map((p, i) => (
                          <tr key={i} className="border-b border-border/50">
                            <td className="py-1 px-1 text-[9px] text-muted-foreground truncate max-w-24" title={p._sourceLabel}>
                              {p._sourceLabel}
                            </td>
                            <td className="py-1 px-1">
                              <Input type="number" value={p.item}
                                onChange={(e) => updatePiece(i, { item: parseInt(e.target.value) || 0 })}
                                className="h-6 text-[11px] px-1" />
                            </td>
                            <td className="py-1 px-1">
                              <Input value={p.descricao}
                                onChange={(e) => updatePiece(i, { descricao: e.target.value })}
                                className="h-6 text-[11px] px-1" />
                            </td>
                            <td className="py-1 px-1">
                              <Input value={p.material ?? ""}
                                onChange={(e) => updatePiece(i, { material: e.target.value })}
                                className="h-6 text-[11px] px-1" />
                            </td>
                            <td className="py-1 px-1">
                              <Input type="number" value={p.larguraMm}
                                onChange={(e) => updatePiece(i, { larguraMm: parseFloat(e.target.value) || 0 })}
                                className="h-6 text-[11px] px-1" />
                            </td>
                            <td className="py-1 px-1">
                              <Input type="number" value={p.alturaMm}
                                onChange={(e) => updatePiece(i, { alturaMm: parseFloat(e.target.value) || 0 })}
                                className="h-6 text-[11px] px-1" />
                            </td>
                            <td className="py-1 px-1">
                              <Input type="number" step="0.1" value={p.espessuraMm}
                                onChange={(e) => updatePiece(i, { espessuraMm: parseFloat(e.target.value) || 0 })}
                                className="h-6 text-[11px] px-1" />
                            </td>
                            <td className="py-1 px-1">
                              <Input type="number" min={1} value={p.quantidade}
                                onChange={(e) => updatePiece(i, { quantidade: parseInt(e.target.value) || 1 })}
                                className="h-6 text-[11px] px-1" />
                            </td>
                            <td className="py-1 px-1">
                              <Input type="number" min={0} value={p.furosDobradica}
                                onChange={(e) => updatePiece(i, { furosDobradica: parseInt(e.target.value) || 0 })}
                                className="h-6 text-[11px] px-1" />
                            </td>
                            <td className={`py-1 px-1 font-mono ${confColor(p.confidence)}`}>
                              {(p.confidence * 100).toFixed(0)}%
                            </td>
                            <td className="py-1 px-1">
                              <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => removePiece(i)}>
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </ScrollArea>
              )}
            </div>
          </div>
        )}

        <DialogFooter className="mt-2">
          <Button variant="outline" onClick={() => handleClose(false)}>Cancelar</Button>
          <Button onClick={handleConfirm} disabled={pieces.length === 0 || loading}>
            {loading ? <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Processando…</> : `Importar ${pieces.length > 0 ? `(${pieces.length})` : ""}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
