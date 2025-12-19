import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Layout, PageHeader } from '@/components/layout/Layout';
import { useAuth } from '@/contexts/AuthContext';
import { useReports } from '@/hooks/useReports';
import { useClients } from '@/hooks/useClients';
import { useReportFormats } from '@/hooks/useReportFormats';
import { useSettings } from '@/hooks/useSettings';
import { Report } from '@/types/database';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Plus, Trash2, Loader2, BarChart3, AlertCircle, Eye, Copy } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Link } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

export default function Reports() {
  const { user, loading: authLoading } = useAuth();
  const { reports, isLoading, createReport, deleteReport } = useReports();
  const { clients } = useClients();
  const { formats } = useReportFormats();
  const { hasAccessToken } = useSettings();
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [formData, setFormData] = useState({ client_id: '', report_format_id: '', start_date: '', end_date: '' });

  if (authLoading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  if (!user) return <Navigate to="/auth" replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const client = clients.find(c => c.id === formData.client_id);
    if (!client) {
      toast({ title: 'Erro', description: 'Selecione um cliente', variant: 'destructive' });
      return;
    }

    setIsGenerating(true);

    try {
      // Chamar a edge function para buscar dados reais da API do Meta Ads
      const { data: reportData, error } = await supabase.functions.invoke('meta-ads-report', {
        body: {
          accountId: client.account_id,
          startDate: formData.start_date,
          endDate: formData.end_date,
          userId: user.id,
        },
      });

      if (error) {
        console.error('Edge function error:', error);
        toast({ 
          title: 'Erro ao buscar dados', 
          description: error.message || 'Erro ao conectar com a API do Meta Ads',
          variant: 'destructive' 
        });
        setIsGenerating(false);
        return;
      }

      if (reportData.error) {
        toast({ 
          title: 'Erro da API Meta Ads', 
          description: reportData.error,
          variant: 'destructive' 
        });
        setIsGenerating(false);
        return;
      }

      // Criar o relatório com os dados reais
      await createReport.mutateAsync({
        client_id: formData.client_id,
        report_format_id: formData.report_format_id || undefined,
        title: `Relatório - ${client.name} - ${formData.start_date} a ${formData.end_date}`,
        start_date: formData.start_date,
        end_date: formData.end_date,
        data: reportData,
        status: 'completed',
      });

      toast({ title: 'Relatório gerado!', description: 'Dados reais obtidos da API do Meta Ads.' });
      setIsDialogOpen(false);
      setFormData({ client_id: '', report_format_id: '', start_date: '', end_date: '' });

    } catch (err: any) {
      console.error('Error generating report:', err);
      toast({ 
        title: 'Erro ao gerar relatório', 
        description: err.message || 'Tente novamente',
        variant: 'destructive' 
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const formatMetricValue = (key: string, value: number | string | undefined) => {
    if (value === undefined) return '-';
    if (typeof value === 'string') return value;
    
    switch (key) {
      case 'total_spend':
      case 'cost_per_message':
      case 'cost_per_conversion':
        return `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
      case 'ctr_link_click':
        return `${value.toFixed(2)}%`;
      case 'reach':
      case 'impressions':
      case 'link_clicks':
      case 'messages_started':
      case 'conversions':
      case 'purchases':
      case 'cart_additions':
      case 'checkouts_initiated':
      case 'instagram_visits':
        return value.toLocaleString('pt-BR');
      default:
        return String(value);
    }
  };

  const getMetricLabel = (key: string): string => {
    const labels: Record<string, string> = {
      reach: '👥 Alcance',
      impressions: '👁️ Impressões',
      link_clicks: '🖱️ Cliques no Link',
      ctr_link_click: '🤩 CTR (Taxa de Cliques)',
      messages_started: '💬 Mensagens Iniciadas',
      cost_per_message: '💰 Custo por Mensagem',
      conversions: '🎯 Conversões',
      cost_per_conversion: '💵 Custo por Conversão',
      purchases: '🛍️ Compras',
      cart_additions: '🛒 Adição ao Carrinho',
      checkouts_initiated: '👤 Finalização de Compra',
      instagram_visits: '📱 Visitas ao Instagram',
      total_spend: '💲 Investimento Total',
      best_ad: '⭐ Melhor Anúncio',
    };
    return labels[key] || key;
  };

  const copyReportText = (report: Report) => {
    const format = report.report_format;
    const metricsToShow = format?.metrics || [
      { key: 'reach', label: '👥 Alcance' },
      { key: 'impressions', label: '👁️ Impressões' },
      { key: 'total_spend', label: '💲 Investimento Total' },
    ];

    let text = `📊 *RELATÓRIO SEMANAL META ADS*\n`;
    text += `📅 Período: ${new Date(report.start_date).toLocaleDateString('pt-BR')} a ${new Date(report.end_date).toLocaleDateString('pt-BR')}\n`;
    text += `👤 Cliente: ${report.client?.name || 'N/A'}\n\n`;
    text += `━━━━━━━━━━━━━━━━━━━━\n\n`;

    metricsToShow.forEach(metric => {
      const value = report.data[metric.key as keyof typeof report.data];
      if (value !== undefined) {
        text += `${metric.label} ${formatMetricValue(metric.key, value as number | string)}\n`;
      }
    });

    if (report.data.best_ad) {
      text += `\n⭐ *Melhor Anúncio:* ${report.data.best_ad}\n`;
    }

    if (report.data.campaigns && report.data.campaigns.length > 0) {
      text += `\n━━━━━━━━━━━━━━━━━━━━\n`;
      text += `📈 *CAMPANHAS*\n\n`;
      report.data.campaigns.forEach((campaign, idx) => {
        text += `*${idx + 1}. ${campaign.name}*\n`;
        if (campaign.reach) text += `   Alcance: ${campaign.reach.toLocaleString('pt-BR')}\n`;
        if (campaign.impressions) text += `   Impressões: ${campaign.impressions.toLocaleString('pt-BR')}\n`;
        if (campaign.spend) text += `   Investimento: R$ ${campaign.spend.toFixed(2)}\n`;
        text += '\n';
      });
    }

    navigator.clipboard.writeText(text);
    toast({ title: 'Relatório copiado!', description: 'Cole no WhatsApp ou onde desejar.' });
  };

  const activeClients = clients.filter(c => c.is_active);

  return (
    <Layout>
      <PageHeader title="Relatórios" description="Gere e visualize relatórios Meta Ads">
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button disabled={activeClients.length === 0 || !hasAccessToken}>
              <Plus className="w-4 h-4 mr-2" />Novo Relatório
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Gerar Novo Relatório</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label>Cliente</Label>
                <Select value={formData.client_id} onValueChange={v => setFormData({...formData, client_id: v})}>
                  <SelectTrigger><SelectValue placeholder="Selecione um cliente" /></SelectTrigger>
                  <SelectContent>{activeClients.map(c => <SelectItem key={c.id} value={c.id}>{c.name} (ID: {c.account_id})</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Formato de Relatório</Label>
                <Select value={formData.report_format_id} onValueChange={v => setFormData({...formData, report_format_id: v})}>
                  <SelectTrigger><SelectValue placeholder="Selecione um formato" /></SelectTrigger>
                  <SelectContent>{formats.map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Data Início</Label><Input type="date" value={formData.start_date} onChange={e => setFormData({...formData, start_date: e.target.value})} required /></div>
                <div><Label>Data Fim</Label><Input type="date" value={formData.end_date} onChange={e => setFormData({...formData, end_date: e.target.value})} required /></div>
              </div>
              <Button type="submit" className="w-full" disabled={isGenerating || !formData.client_id}>
                {isGenerating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {isGenerating ? 'Buscando dados...' : 'Gerar Relatório'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </PageHeader>

      {!hasAccessToken && (
        <Alert className="mb-6">
          <AlertCircle className="w-4 h-4" />
          <AlertDescription>
            Configure seu Access Token em <Link to="/settings" className="text-primary underline">Configurações</Link> para gerar relatórios com dados reais.
          </AlertDescription>
        </Alert>
      )}

      {activeClients.length === 0 && (
        <Alert className="mb-6">
          <AlertCircle className="w-4 h-4" />
          <AlertDescription>
            Cadastre pelo menos um cliente em <Link to="/clients" className="text-primary underline">Clientes</Link> para gerar relatórios.
          </AlertDescription>
        </Alert>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      ) : reports.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-12">
            <BarChart3 className="w-16 h-16 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Nenhum relatório gerado</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {reports.map(report => (
            <Card key={report.id} className="animate-scale-in hover:shadow-lg transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between py-4">
                <div className="flex-1">
                  <CardTitle className="text-lg">{report.title}</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    {report.client?.name} • {new Date(report.start_date).toLocaleDateString('pt-BR')} - {new Date(report.end_date).toLocaleDateString('pt-BR')}
                  </p>
                  {report.report_format && (
                    <span className="inline-block mt-2 px-2 py-0.5 rounded text-xs bg-secondary text-secondary-foreground">
                      {report.report_format.name}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    report.status === 'completed' ? 'bg-success/10 text-success' : 
                    report.status === 'error' ? 'bg-destructive/10 text-destructive' : 
                    'bg-warning/10 text-warning'
                  }`}>
                    {report.status === 'completed' ? 'Concluído' : report.status === 'error' ? 'Erro' : 'Pendente'}
                  </span>
                  <Button variant="outline" size="sm" onClick={() => setSelectedReport(report)}>
                    <Eye className="w-4 h-4" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => copyReportText(report)}>
                    <Copy className="w-4 h-4" />
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="text-destructive hover:bg-destructive hover:text-destructive-foreground" 
                    onClick={() => deleteReport.mutate(report.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}

      {/* Sheet para visualização do relatório */}
      <Sheet open={!!selectedReport} onOpenChange={(open) => !open && setSelectedReport(null)}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          {selectedReport && (
            <>
              <SheetHeader className="mb-6">
                <SheetTitle className="text-xl font-display">{selectedReport.title}</SheetTitle>
                <p className="text-sm text-muted-foreground">
                  {new Date(selectedReport.start_date).toLocaleDateString('pt-BR')} - {new Date(selectedReport.end_date).toLocaleDateString('pt-BR')}
                </p>
              </SheetHeader>

              <div className="space-y-6">
                {/* Métricas principais */}
                <div>
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <BarChart3 className="w-4 h-4" />
                    Métricas do Período
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    {(selectedReport.report_format?.metrics || []).map((metric) => {
                      const value = selectedReport.data[metric.key as keyof typeof selectedReport.data];
                      if (value === undefined || metric.key === 'campaigns' || metric.key === 'best_ad') return null;
                      return (
                        <div key={metric.key} className="p-3 rounded-lg bg-muted/50">
                          <p className="text-xs text-muted-foreground">{metric.label}</p>
                          <p className="text-lg font-semibold">{formatMetricValue(metric.key, value as number)}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Melhor Anúncio */}
                {selectedReport.data.best_ad && (
                  <div className="p-4 rounded-lg bg-gradient-to-r from-primary/10 to-accent/10 border border-primary/20">
                    <p className="text-sm text-muted-foreground mb-1">⭐ Melhor Anúncio</p>
                    <p className="font-semibold">{selectedReport.data.best_ad}</p>
                  </div>
                )}

                {/* Campanhas */}
                {selectedReport.data.campaigns && selectedReport.data.campaigns.length > 0 && (
                  <div>
                    <h3 className="font-semibold mb-3">📈 Campanhas</h3>
                    <div className="space-y-3">
                      {selectedReport.data.campaigns.map((campaign, idx) => (
                        <div key={idx} className="p-4 rounded-lg border bg-card">
                          <p className="font-medium mb-2">{campaign.name}</p>
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            {campaign.reach !== undefined && <div><span className="text-muted-foreground">Alcance:</span> {campaign.reach.toLocaleString('pt-BR')}</div>}
                            {campaign.impressions !== undefined && <div><span className="text-muted-foreground">Impressões:</span> {campaign.impressions.toLocaleString('pt-BR')}</div>}
                            {campaign.spend !== undefined && <div><span className="text-muted-foreground">Investimento:</span> R$ {campaign.spend.toFixed(2)}</div>}
                            {campaign.link_clicks !== undefined && <div><span className="text-muted-foreground">Cliques:</span> {campaign.link_clicks.toLocaleString('pt-BR')}</div>}
                            {campaign.ctr !== undefined && <div><span className="text-muted-foreground">CTR:</span> {campaign.ctr.toFixed(2)}%</div>}
                            {campaign.messages_started !== undefined && <div><span className="text-muted-foreground">Mensagens:</span> {campaign.messages_started}</div>}
                            {campaign.conversions !== undefined && <div><span className="text-muted-foreground">Conversões:</span> {campaign.conversions}</div>}
                            {campaign.purchases !== undefined && <div><span className="text-muted-foreground">Compras:</span> {campaign.purchases}</div>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Botão de copiar */}
                <Button 
                  className="w-full" 
                  variant="outline"
                  onClick={() => copyReportText(selectedReport)}
                >
                  <Copy className="w-4 h-4 mr-2" />
                  Copiar Relatório para WhatsApp
                </Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </Layout>
  );
}
