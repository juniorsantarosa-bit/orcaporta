import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, Save, Users, Check, X, Pencil } from "lucide-react";
import { toast } from "sonner";
import {
  DEFAULT_PRICE_TABLE,
  deleteClient,
  listClients,
  saveClient,
} from "@/lib/commercialStore";
import type { Client, ClientPriceTable } from "@/types/commercial";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Cliente atualmente selecionado no orçamento (opcional) */
  selectedClientId?: string | null;
  /** Chamado quando o usuário escolhe um cliente para usar no orçamento */
  onSelect?: (client: Client | null) => void;
}

const blankClient = (): Omit<Client, "id" | "createdAt" | "updatedAt"> => ({
  nome: "",
  razaoSocial: "",
  cnpjCpf: "",
  endereco: "",
  responsavel: "",
  email: "",
  telefone: "",
  observacoes: "",
  precos: { ...DEFAULT_PRICE_TABLE },
});

export function ClientesDialog({ open, onOpenChange, selectedClientId, onSelect }: Props) {
  const [clients, setClients] = useState<Client[]>([]);
  const [editing, setEditing] = useState<(Omit<Client, "id" | "createdAt" | "updatedAt"> & { id?: string }) | null>(null);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    if (open) {
      setClients(listClients());
      setEditing(null);
    }
  }, [open]);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter(c =>
      [c.nome, c.razaoSocial, c.responsavel, c.email, c.cnpjCpf]
        .filter(Boolean).some(v => v!.toLowerCase().includes(q)));
  }, [clients, filter]);

  const startNew = () => setEditing({ ...blankClient() });
  const startEdit = (c: Client) => setEditing({ ...c });
  const cancelEdit = () => setEditing(null);

  const handleSave = () => {
    if (!editing) return;
    if (!editing.nome.trim()) {
      toast.error("Informe o nome do cliente");
      return;
    }
    saveClient(editing);
    setClients(listClients());
    setEditing(null);
    toast.success("Cliente salvo");
  };

  const handleDelete = (id: string) => {
    if (!confirm("Excluir este cliente?")) return;
    deleteClient(id);
    setClients(listClients());
    if (selectedClientId === id) onSelect?.(null);
    toast.info("Cliente excluído");
  };

  const handlePick = (c: Client) => {
    onSelect?.(c);
    onOpenChange(false);
    toast.success(`Cliente "${c.nome}" selecionado`);
  };

  const updatePreco = (key: keyof ClientPriceTable, val: string) => {
    if (!editing) return;
    const num = parseFloat(val.replace(",", "."));
    setEditing({ ...editing, precos: { ...editing.precos, [key]: isNaN(num) ? 0 : num } });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[1000px] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Clientes
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-[320px_1fr] gap-4 flex-1 min-h-0">
          {/* Lista */}
          <div className="border border-border rounded flex flex-col min-h-0">
            <div className="p-2 border-b border-border flex gap-2">
              <Input
                placeholder="Buscar..."
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="h-8 text-xs"
              />
              <Button size="sm" onClick={startNew} className="h-8 gap-1">
                <Plus className="h-3.5 w-3.5" /> Novo
              </Button>
            </div>
            <ScrollArea className="flex-1">
              {filtered.length === 0 ? (
                <div className="p-4 text-center text-xs text-muted-foreground">
                  Nenhum cliente cadastrado.
                </div>
              ) : (
                <ul className="divide-y divide-border">
                  {filtered.map(c => (
                    <li
                      key={c.id}
                      className={`p-2 text-xs cursor-pointer hover:bg-muted/40 ${
                        selectedClientId === c.id ? "bg-primary/10 border-l-2 border-l-primary" : ""
                      } ${editing?.id === c.id ? "bg-muted/60" : ""}`}
                      onClick={() => startEdit(c)}
                    >
                      <div className="font-semibold truncate">{c.nome}</div>
                      {c.razaoSocial && (
                        <div className="text-[10px] text-muted-foreground truncate">{c.razaoSocial}</div>
                      )}
                      <div className="flex items-center justify-between mt-1 gap-1">
                        <Button
                          size="sm" variant="outline"
                          className="h-6 text-[10px] gap-1 flex-1"
                          onClick={(e) => { e.stopPropagation(); handlePick(c); }}
                        >
                          <Check className="h-3 w-3" /> Selecionar
                        </Button>
                        <Button
                          size="sm" variant="ghost"
                          className="h-6 w-6 p-0 text-primary"
                          title="Editar cliente"
                          onClick={(e) => { e.stopPropagation(); startEdit(c); }}
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm" variant="ghost"
                          className="h-6 w-6 p-0 text-destructive"
                          title="Excluir cliente"
                          onClick={(e) => { e.stopPropagation(); handleDelete(c.id); }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </ScrollArea>
          </div>

          {/* Form */}
          <div className="border border-border rounded flex flex-col min-h-0">
            {!editing ? (
              <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground p-6 text-center">
                Selecione um cliente à esquerda para editar,
                <br />ou clique em <b>Novo</b> para cadastrar.
              </div>
            ) : (
              <ScrollArea className="flex-1">
                <div className="p-4 space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <Label className="text-[10px] uppercase">Nome / Fantasia *</Label>
                      <Input value={editing.nome} onChange={(e) => setEditing({ ...editing, nome: e.target.value })} />
                    </div>
                    <div>
                      <Label className="text-[10px] uppercase">Razão Social</Label>
                      <Input value={editing.razaoSocial ?? ""} onChange={(e) => setEditing({ ...editing, razaoSocial: e.target.value })} />
                    </div>
                    <div>
                      <Label className="text-[10px] uppercase">CNPJ / CPF</Label>
                      <Input value={editing.cnpjCpf ?? ""} onChange={(e) => setEditing({ ...editing, cnpjCpf: e.target.value })} />
                    </div>
                    <div className="col-span-2">
                      <Label className="text-[10px] uppercase">Endereço</Label>
                      <Input value={editing.endereco ?? ""} onChange={(e) => setEditing({ ...editing, endereco: e.target.value })} />
                    </div>
                    <div>
                      <Label className="text-[10px] uppercase">Responsável</Label>
                      <Input value={editing.responsavel ?? ""} onChange={(e) => setEditing({ ...editing, responsavel: e.target.value })} />
                    </div>
                    <div>
                      <Label className="text-[10px] uppercase">E-mail</Label>
                      <Input type="email" value={editing.email ?? ""} onChange={(e) => setEditing({ ...editing, email: e.target.value })} />
                    </div>
                    <div>
                      <Label className="text-[10px] uppercase">Telefone</Label>
                      <Input value={editing.telefone ?? ""} onChange={(e) => setEditing({ ...editing, telefone: e.target.value })} />
                    </div>
                    <div className="col-span-2">
                      <Label className="text-[10px] uppercase">Observações</Label>
                      <Textarea
                        value={editing.observacoes ?? ""}
                        onChange={(e) => setEditing({ ...editing, observacoes: e.target.value })}
                        className="min-h-[60px] text-xs"
                      />
                    </div>
                  </div>

                  <div className="border-t border-border pt-3">
                    <div className="text-xs font-semibold uppercase text-muted-foreground mb-2">
                      Valores Negociados
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <Label className="text-[10px] uppercase">R$ corte (chapa)</Label>
                        <Input type="number" step="0.01" min={0}
                          value={editing.precos.corte}
                          onChange={(e) => updatePreco("corte", e.target.value)} />
                      </div>
                      <div>
                        <Label className="text-[10px] uppercase">R$ corte (peça)</Label>
                        <Input type="number" step="0.01" min={0}
                          value={editing.precos.cortePeca}
                          onChange={(e) => updatePreco("cortePeca", e.target.value)} />
                      </div>
                      <div>
                        <Label className="text-[10px] uppercase">R$ por furo</Label>
                        <Input type="number" step="0.01" min={0}
                          value={editing.precos.furo}
                          onChange={(e) => updatePreco("furo", e.target.value)} />
                      </div>
                      <div>
                        <Label className="text-[10px] uppercase">R$/m fita</Label>
                        <Input type="number" step="0.01" min={0}
                          value={editing.precos.fita}
                          onChange={(e) => updatePreco("fita", e.target.value)} />
                      </div>
                      <div>
                        <Label className="text-[10px] uppercase" title="Fita aplicada à mão em recortes internos / curvos">R$/m fita manual</Label>
                        <Input type="number" step="0.01" min={0}
                          value={editing.precos.fitaManual}
                          onChange={(e) => updatePreco("fitaManual", e.target.value)} />
                      </div>
                      <div>
                        <Label className="text-[10px] uppercase">R$/m fresa</Label>
                        <Input type="number" step="0.01" min={0}
                          value={editing.precos.fresaMetro}
                          onChange={(e) => updatePreco("fresaMetro", e.target.value)} />
                      </div>
                      <div>
                        <Label className="text-[10px] uppercase">R$/m serra</Label>
                        <Input type="number" step="0.01" min={0}
                          value={editing.precos.serraMetro}
                          onChange={(e) => updatePreco("serraMetro", e.target.value)} />
                      </div>
                    </div>
                  </div>
                </div>
              </ScrollArea>
            )}

            {editing && (
              <div className="border-t border-border p-2 flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={cancelEdit}>
                  <X className="h-4 w-4 mr-1" /> Cancelar
                </Button>
                <Button size="sm" onClick={handleSave}>
                  <Save className="h-4 w-4 mr-1" /> Salvar
                </Button>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
