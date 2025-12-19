import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Layout, PageHeader } from '@/components/layout/Layout';
import { useAuth } from '@/contexts/AuthContext';
import { useReportFormats } from '@/hooks/useReportFormats';
import { AVAILABLE_METRICS } from '@/types/database';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Pencil, Trash2, Loader2, FileText } from 'lucide-react';

export default function Formats() {
  const { user, loading: authLoading } = useAuth();
  const { formats, isLoading, createFormat, updateFormat, deleteFormat } = useReportFormats();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingFormat, setEditingFormat] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: '', description: '', metrics: [] as string[], is_default: false });

  if (authLoading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  if (!user) return <Navigate to="/auth" replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const metricsData = formData.metrics.map(key => {
      const m = AVAILABLE_METRICS.find(am => am.key === key);
      return { key, label: m?.label || key };
    });
    const payload = { name: formData.name, description: formData.description, api_fields: ['campaign_name', 'impressions', 'spend', 'actions'], metrics: metricsData, is_default: formData.is_default };
    if (editingFormat) await updateFormat.mutateAsync({ id: editingFormat, ...payload });
    else await createFormat.mutateAsync(payload);
    setIsDialogOpen(false);
    setEditingFormat(null);
    setFormData({ name: '', description: '', metrics: [], is_default: false });
  };

  const openEdit = (format: typeof formats[0]) => {
    setEditingFormat(format.id);
    setFormData({ name: format.name, description: format.description || '', metrics: format.metrics.map(m => m.key), is_default: format.is_default });
    setIsDialogOpen(true);
  };

  const toggleMetric = (key: string) => {
    setFormData(prev => ({ ...prev, metrics: prev.metrics.includes(key) ? prev.metrics.filter(m => m !== key) : [...prev.metrics, key] }));
  };

  return (
    <Layout>
      <PageHeader title="Formatos de Relatório" description="Configure os formatos de relatório disponíveis">
        <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) { setEditingFormat(null); setFormData({ name: '', description: '', metrics: [], is_default: false }); } }}>
          <DialogTrigger asChild><Button><Plus className="w-4 h-4 mr-2" />Novo Formato</Button></DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editingFormat ? 'Editar' : 'Novo'} Formato</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div><Label>Nome</Label><Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required /></div>
              <div><Label>Descrição</Label><Textarea value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} /></div>
              <div><Label>Métricas</Label>
                <div className="grid grid-cols-1 gap-2 mt-2 max-h-60 overflow-y-auto p-2 border rounded-lg">
                  {AVAILABLE_METRICS.map(m => (
                    <label key={m.key} className="flex items-center gap-2 cursor-pointer p-2 rounded hover:bg-muted">
                      <Checkbox checked={formData.metrics.includes(m.key)} onCheckedChange={() => toggleMetric(m.key)} />
                      <span className="text-sm">{m.label}</span>
                    </label>
                  ))}
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={createFormat.isPending || updateFormat.isPending}>{(createFormat.isPending || updateFormat.isPending) && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Salvar</Button>
            </form>
          </DialogContent>
        </Dialog>
      </PageHeader>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      ) : formats.length === 0 ? (
        <Card><CardContent className="flex flex-col items-center py-12"><FileText className="w-16 h-16 text-muted-foreground mb-4" /><p className="text-muted-foreground">Nenhum formato cadastrado</p></CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {formats.map(format => (
            <Card key={format.id} className="animate-scale-in">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div><CardTitle className="text-lg flex items-center gap-2">{format.name}{format.is_default && <span className="px-2 py-0.5 rounded text-xs bg-primary/10 text-primary">Padrão</span>}</CardTitle>
                  <CardDescription className="mt-1">{format.description}</CardDescription></div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-1 mb-4">{format.metrics.slice(0, 5).map(m => <span key={m.key} className="px-2 py-1 rounded-full text-xs bg-secondary text-secondary-foreground">{m.label.replace(/[^\w\s]/g, '').trim()}</span>)}{format.metrics.length > 5 && <span className="px-2 py-1 rounded-full text-xs bg-muted text-muted-foreground">+{format.metrics.length - 5}</span>}</div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => openEdit(format)}><Pencil className="w-4 h-4" /></Button>
                  <Button variant="outline" size="sm" className="text-destructive hover:bg-destructive hover:text-destructive-foreground" onClick={() => deleteFormat.mutate(format.id)}><Trash2 className="w-4 h-4" /></Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </Layout>
  );
}
