import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Layout, PageHeader } from '@/components/layout/Layout';
import { useAuth } from '@/contexts/AuthContext';
import { useReports } from '@/hooks/useReports';
import { useClients } from '@/hooks/useClients';
import { useReportFormats } from '@/hooks/useReportFormats';
import { useSettings } from '@/hooks/useSettings';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, Loader2, BarChart3, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Link } from 'react-router-dom';

export default function Reports() {
  const { user, loading: authLoading } = useAuth();
  const { reports, isLoading, createReport, deleteReport } = useReports();
  const { clients } = useClients();
  const { formats } = useReportFormats();
  const { hasAccessToken } = useSettings();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({ client_id: '', report_format_id: '', start_date: '', end_date: '' });

  if (authLoading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  if (!user) return <Navigate to="/auth" replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const client = clients.find(c => c.id === formData.client_id);
    await createReport.mutateAsync({
      client_id: formData.client_id,
      report_format_id: formData.report_format_id || undefined,
      title: `Relatório - ${client?.name || 'Cliente'} - ${formData.start_date} a ${formData.end_date}`,
      start_date: formData.start_date,
      end_date: formData.end_date,
      data: { reach: 0, impressions: 0, total_spend: 0 },
      status: 'completed',
    });
    setIsDialogOpen(false);
    setFormData({ client_id: '', report_format_id: '', start_date: '', end_date: '' });
  };

  const activeClients = clients.filter(c => c.is_active);

  return (
    <Layout>
      <PageHeader title="Relatórios" description="Gere e visualize relatórios Meta Ads">
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild><Button disabled={!hasAccessToken || activeClients.length === 0}><Plus className="w-4 h-4 mr-2" />Novo Relatório</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Gerar Novo Relatório</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div><Label>Cliente</Label>
                <Select value={formData.client_id} onValueChange={v => setFormData({...formData, client_id: v})}>
                  <SelectTrigger><SelectValue placeholder="Selecione um cliente" /></SelectTrigger>
                  <SelectContent>{activeClients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Formato de Relatório</Label>
                <Select value={formData.report_format_id} onValueChange={v => setFormData({...formData, report_format_id: v})}>
                  <SelectTrigger><SelectValue placeholder="Selecione um formato" /></SelectTrigger>
                  <SelectContent>{formats.map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Data Início</Label><Input type="date" value={formData.start_date} onChange={e => setFormData({...formData, start_date: e.target.value})} required /></div>
                <div><Label>Data Fim</Label><Input type="date" value={formData.end_date} onChange={e => setFormData({...formData, end_date: e.target.value})} required /></div>
              </div>
              <Button type="submit" className="w-full" disabled={createReport.isPending || !formData.client_id}>{createReport.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Gerar Relatório</Button>
            </form>
          </DialogContent>
        </Dialog>
      </PageHeader>

      {!hasAccessToken && (
        <Alert className="mb-6"><AlertCircle className="w-4 h-4" /><AlertDescription>Configure seu Access Token Meta Ads em <Link to="/settings" className="text-primary underline">Configurações</Link> para gerar relatórios.</AlertDescription></Alert>
      )}

      {activeClients.length === 0 && (
        <Alert className="mb-6"><AlertCircle className="w-4 h-4" /><AlertDescription>Cadastre pelo menos um cliente em <Link to="/clients" className="text-primary underline">Clientes</Link> para gerar relatórios.</AlertDescription></Alert>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      ) : reports.length === 0 ? (
        <Card><CardContent className="flex flex-col items-center py-12"><BarChart3 className="w-16 h-16 text-muted-foreground mb-4" /><p className="text-muted-foreground">Nenhum relatório gerado</p></CardContent></Card>
      ) : (
        <div className="space-y-4">
          {reports.map(report => (
            <Card key={report.id} className="animate-scale-in">
              <CardHeader className="flex flex-row items-center justify-between py-4">
                <div>
                  <CardTitle className="text-lg">{report.title}</CardTitle>
                  <p className="text-sm text-muted-foreground">{report.client?.name} • {new Date(report.start_date).toLocaleDateString('pt-BR')} - {new Date(report.end_date).toLocaleDateString('pt-BR')}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${report.status === 'completed' ? 'bg-success/10 text-success' : report.status === 'error' ? 'bg-destructive/10 text-destructive' : 'bg-warning/10 text-warning'}`}>{report.status === 'completed' ? 'Concluído' : report.status === 'error' ? 'Erro' : 'Pendente'}</span>
                  <Button variant="outline" size="sm" className="text-destructive" onClick={() => deleteReport.mutate(report.id)}><Trash2 className="w-4 h-4" /></Button>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}
    </Layout>
  );
}
