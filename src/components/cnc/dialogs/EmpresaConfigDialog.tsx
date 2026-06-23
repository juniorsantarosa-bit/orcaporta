import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Upload, Trash2, Building2 } from "lucide-react";
import { CompanyInfo, loadCompany, saveCompany, DEFAULT_COMPANY } from "@/lib/companyStore";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: (c: CompanyInfo) => void;
}

export function EmpresaConfigDialog({ open, onOpenChange, onSaved }: Props) {
  const [form, setForm] = useState<CompanyInfo>(DEFAULT_COMPANY);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) setForm(loadCompany());
  }, [open]);

  const update = <K extends keyof CompanyInfo>(k: K, v: CompanyInfo[K]) =>
    setForm(prev => ({ ...prev, [k]: v }));

  const handleLogo = (file: File) => {
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Logo deve ter no máximo 2 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => update("logoDataUrl", String(e.target?.result ?? ""));
    reader.readAsDataURL(file);
  };

  const handleSave = () => {
    saveCompany(form);
    onSaved?.(form);
    toast.success("Dados da empresa salvos.");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[640px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            Configurações da Empresa
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-4 p-3 border border-border rounded">
            {form.logoDataUrl ? (
              <div className="relative">
                <img src={form.logoDataUrl} alt="Logo" className="h-16 max-w-[160px] object-contain rounded border border-border bg-white p-1" />
                <Button variant="ghost" size="sm" className="absolute -top-2 -right-2 h-6 w-6 p-0 bg-destructive text-destructive-foreground rounded-full"
                  onClick={() => update("logoDataUrl", "")}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ) : (
              <div className="h-16 w-32 border-2 border-dashed border-border rounded flex items-center justify-center text-[10px] text-muted-foreground">
                Sem logo
              </div>
            )}
            <div>
              <input ref={fileRef} type="file" accept="image/*" className="hidden"
                onChange={(e) => e.target.files?.[0] && handleLogo(e.target.files[0])} />
              <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}>
                <Upload className="h-3 w-3 mr-1" /> Carregar Logo
              </Button>
              <p className="text-[10px] text-muted-foreground mt-1">Aparecerá no cabeçalho do orçamento (PNG/JPG, máx 2 MB).</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label className="text-xs">Nome da empresa</Label>
              <Input value={form.nome} onChange={(e) => update("nome", e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Telefone</Label>
              <Input value={form.telefone} onChange={(e) => update("telefone", e.target.value)} placeholder="(11) 99999-9999" />
            </div>
            <div>
              <Label className="text-xs">E-mail</Label>
              <Input value={form.email} onChange={(e) => update("email", e.target.value)} placeholder="contato@empresa.com" />
            </div>
            <div className="col-span-2">
              <Label className="text-xs">Endereço</Label>
              <Input value={form.endereco} onChange={(e) => update("endereco", e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">CNPJ / CPF</Label>
              <Input value={form.cnpj} onChange={(e) => update("cnpj", e.target.value)} />
            </div>
            <div className="col-span-2">
              <Label className="text-xs">Rodapé do orçamento</Label>
              <Textarea value={form.rodape} onChange={(e) => update("rodape", e.target.value)} className="min-h-[60px] text-xs" />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
