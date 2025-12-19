import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Layout, PageHeader } from '@/components/layout/Layout';
import { useAuth } from '@/contexts/AuthContext';
import { useClients } from '@/hooks/useClients';
import { useReportFormats } from '@/hooks/useReportFormats';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Plus, Pencil, Trash2, Loader2, Users } from 'lucide-react';

export default function Clients() {
  const { user, loading: authLoading } = useAuth();
  const { clients, isLoading, createClient, updateClient, deleteClient } = useClients();
  const { formats } = useReportFormats();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: '', account_id: '', report_format_id: '', is_active: true });

  if (authLoading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  if (!user) return <Navigate to="/auth" replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingClient) {
      await updateClient.mutateAsync({ id: editingClient, ...formData, report_format_id: formData.report_format_id || null });
    } else {
      await createClient.mutateAsync({ ...formData, report_format_id: formData.report_format_id || null });
    }
    setIsDialogOpen(false);
    setEditingClient(null);
    setFormData({ name: '', account_id: '', report_format_id: '', is_active: true });
  };

  const openEdit = (client: typeof clients[0]) => {
    setEditingClient(client.id);
    setFormData({ name: client.name, account_id: client.account_id, report_format_id: client.report_format_id || '', is_active: client.is_active });
    setIsDialogOpen(true);
  };

  return (
    <Layout>
      <PageHeader title="Clientes" description="Gerencie seus clientes Meta Ads">
        <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) { setEditingClient(null); setFormData({ name: '', account_id: '', report_format_id: '', is_active: true }); } }}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" />Novo Cliente</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editingClient ? 'Editar' : 'Novo'} Cliente</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div><Label>Nome</Label><Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required /></div>
              <div><Label>Account ID (apenas números)</Label><Input value={formData.account_id} onChange={e => setFormData({...formData, account_id: e.target.value})} placeholder="123456789" required /></div>
              <div><Label>Formato de Relatório</Label>
                <Select value={formData.report_format_id} onValueChange={v => setFormData({...formData, report_format_id: v})}>
                  <SelectTrigger><SelectValue placeholder="Selecione um formato" /></SelectTrigger>
                  <SelectContent>{formats.map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2"><Switch checked={formData.is_active} onCheckedChange={v => setFormData({...formData, is_active: v})} /><Label>Cliente Ativo</Label></div>
              <Button type="submit" className="w-full" disabled={createClient.isPending || updateClient.isPending}>{(createClient.isPending || updateClient.isPending) && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Salvar</Button>
            </form>
          </DialogContent>
        </Dialog>
      </PageHeader>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      ) : clients.length === 0 ? (
        <Card><CardContent className="flex flex-col items-center py-12"><Users className="w-16 h-16 text-muted-foreground mb-4" /><p className="text-muted-foreground mb-4">Nenhum cliente cadastrado</p><Button onClick={() => setIsDialogOpen(true)}><Plus className="w-4 h-4 mr-2" />Adicionar Cliente</Button></CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {clients.map(client => (
            <Card key={client.id} className="animate-scale-in">
              <CardHeader className="flex flex-row items-start justify-between">
                <div><CardTitle className="text-lg">{client.name}</CardTitle><p className="text-sm text-muted-foreground mt-1">ID: {client.account_id}</p></div>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${client.is_active ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}`}>{client.is_active ? 'Ativo' : 'Inativo'}</span>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">Formato: {client.report_format?.name || 'Padrão'}</p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => openEdit(client)}><Pencil className="w-4 h-4" /></Button>
                  <Button variant="outline" size="sm" className="text-destructive hover:bg-destructive hover:text-destructive-foreground" onClick={() => deleteClient.mutate(client.id)}><Trash2 className="w-4 h-4" /></Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </Layout>
  );
}
