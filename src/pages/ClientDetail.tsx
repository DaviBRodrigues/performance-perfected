import { useState, useMemo } from 'react';
import { Navigate, useParams, Link } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { useAuth } from '@/contexts/AuthContext';
import { useClients } from '@/hooks/useClients';
import { useReports } from '@/hooks/useReports';
import { useReportFormats } from '@/hooks/useReportFormats';
import { useScheduledReports } from '@/hooks/useScheduledReports';
import { useSettings } from '@/hooks/useSettings';
import { useClientIntegrations, Platform } from '@/hooks/useClientIntegrations';
import { Report, PLATFORMS } from '@/types/database';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  ArrowLeft, Plus, Trash2, Loader2, BarChart3, AlertCircle, Eye, Copy, 
  Calendar, Clock, Settings, Pencil, Link as LinkIcon, Unlink, Check, X
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

// Platform icons
function MetaIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2.04c-5.5 0-10 4.49-10 10.02 0 5 3.66 9.15 8.44 9.9v-7H7.9v-2.9h2.54V9.85c0-2.52 1.49-3.9 3.77-3.9 1.09 0 2.24.2 2.24.2v2.47H15.2c-1.24 0-1.63.78-1.63 1.57v1.88h2.78l-.45 2.9h-2.33v7a10 10 0 0 0 8.43-9.9c0-5.53-4.5-10.02-10-10.02Z"/>
    </svg>
  );
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

// Generate avatar color based on name
function getAvatarColor(name: string): string {
  const colors = [
    'bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-orange-500',
    'bg-pink-500', 'bg-teal-500', 'bg-indigo-500', 'bg-red-500',
  ];
  return colors[name.charCodeAt(0) % colors.length];
}

function getInitials(name: string): string {
  return name.split(' ').map(w => w.charAt(0)).slice(0, 2).join('').toUpperCase();
}

const DAY_NAMES = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

export default function ClientDetail() {
  const { id } = useParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();
  const { clients, isLoading: clientsLoading, updateClient } = useClients();
  const { reports, isLoading: reportsLoading, createReport, deleteReport } = useReports();
  const { formats } = useReportFormats();
  const { scheduledReports, createScheduledReport, deleteScheduledReport, updateScheduledReport } = useScheduledReports();
  const { hasAccessToken } = useSettings();
  const { integrations, createIntegration, deleteIntegration, isLoading: integrationsLoading } = useClientIntegrations(id);
  const { toast } = useToast();

  const [isReportDialogOpen, setIsReportDialogOpen] = useState(false);
  const [isScheduleDialogOpen, setIsScheduleDialogOpen] = useState(false);
  const [isIntegrationDialogOpen, setIsIntegrationDialogOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);

  const [reportForm, setReportForm] = useState({
    report_format_id: '',
    start_date: '',
    end_date: '',
    best_ad_scope: 'all' as 'all' | 'by_campaign' | 'by_objective',
    platform: 'meta_ads' as Platform,
  });

  const [scheduleForm, setScheduleForm] = useState({
    day_of_week: 1,
    run_time: '09:00',
    webhook_url: '',
    report_format_id: '',
    is_active: true,
  });

  const [integrationForm, setIntegrationForm] = useState({
    platform: 'meta_ads' as Platform,
    account_id: '',
    account_name: '',
  });

  const [clientForm, setClientForm] = useState({
    name: '',
    report_format_id: '',
    is_active: true,
  });

  const client = useMemo(() => clients.find(c => c.id === id), [clients, id]);
  
  const clientReports = useMemo(() => 
    reports.filter(r => r.client_id === id).sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    ), [reports, id]);

  const clientSchedules = useMemo(() => 
    scheduledReports.filter(s => s.client_id === id), [scheduledReports, id]);

  // Get connected integrations for platform selection
  const connectedIntegrations = useMemo(() => 
    integrations.filter(i => i.is_connected), [integrations]);

  if (authLoading || clientsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;
  if (!client) return <Navigate to="/clients" replace />;

  // Initialize client form when opening settings
  const openSettingsTab = () => {
    setClientForm({
      name: client.name,
      report_format_id: client.report_format_id || '',
      is_active: client.is_active ?? true,
    });
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateClient.mutateAsync({
      id: client.id,
      name: clientForm.name,
      report_format_id: clientForm.report_format_id || null,
      is_active: clientForm.is_active,
    });
    toast({ title: 'Configurações salvas!' });
  };

  const handleGenerateReport = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsGenerating(true);

    try {
      // Find the selected integration
      const selectedIntegration = integrations.find(i => 
        i.platform === reportForm.platform && i.is_connected
      );

      if (!selectedIntegration) {
        toast({ title: 'Erro', description: 'Nenhuma integração conectada para esta plataforma', variant: 'destructive' });
        return;
      }

      if (reportForm.platform === 'meta_ads') {
        const { data: reportData, error } = await supabase.functions.invoke('meta-ads-report', {
          body: {
            accountId: selectedIntegration.account_id,
            startDate: reportForm.start_date,
            endDate: reportForm.end_date,
            userId: user.id,
            bestAdScope: reportForm.best_ad_scope,
          },
        });

        if (error) {
          toast({ title: 'Erro ao buscar dados', description: error.message, variant: 'destructive' });
          return;
        }

        if (reportData.error) {
          toast({ title: 'Erro da API Meta Ads', description: reportData.error, variant: 'destructive' });
          return;
        }

        await createReport.mutateAsync({
          client_id: client.id,
          report_format_id: reportForm.report_format_id || client.report_format_id || undefined,
          title: `Relatório Meta Ads - ${client.name} - ${reportForm.start_date} a ${reportForm.end_date}`,
          start_date: reportForm.start_date,
          end_date: reportForm.end_date,
          data: reportData,
          status: 'completed',
        });

        toast({ title: 'Relatório gerado!', description: 'Dados reais obtidos da API do Meta Ads.' });
      } else {
        // Google Ads - placeholder for future implementation
        toast({ title: 'Em breve', description: 'Integração com Google Ads será implementada em breve.', variant: 'default' });
        return;
      }

      setIsReportDialogOpen(false);
      setReportForm({ report_format_id: '', start_date: '', end_date: '', best_ad_scope: 'all', platform: 'meta_ads' });
    } catch (err: any) {
      toast({ title: 'Erro ao gerar relatório', description: err.message, variant: 'destructive' });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCreateSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    await createScheduledReport.mutateAsync({
      client_id: client.id,
      ...scheduleForm,
      timezone: 'America/Sao_Paulo',
      report_format_id: scheduleForm.report_format_id || null,
    });
    setIsScheduleDialogOpen(false);
    setScheduleForm({ day_of_week: 1, run_time: '09:00', webhook_url: '', report_format_id: '', is_active: true });
  };

  const handleAddIntegration = async (e: React.FormEvent) => {
    e.preventDefault();
    await createIntegration.mutateAsync({
      client_id: client.id,
      platform: integrationForm.platform,
      account_id: integrationForm.account_id,
      account_name: integrationForm.account_name || undefined,
      is_connected: true,
    });
    setIsIntegrationDialogOpen(false);
    setIntegrationForm({ platform: 'meta_ads', account_id: '', account_name: '' });
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
      default:
        return value.toLocaleString('pt-BR');
    }
  };

  const copyReportText = (report: Report) => {
    const reportFormat = report.report_format || formats.find(f => f.id === client.report_format_id);
    const metricsToShow = reportFormat?.metrics || [
      { key: 'reach', label: '👥 Alcance' },
      { key: 'impressions', label: '👁️ Impressões' },
      { key: 'total_spend', label: '💲 Investimento Total' },
    ];

    let text = `📊 *RELATÓRIO SEMANAL - ${client.name.toUpperCase()}*\n`;
    text += `📅 Período: ${format(new Date(report.start_date), 'dd/MM/yyyy')} a ${format(new Date(report.end_date), 'dd/MM/yyyy')}\n`;
    text += `👤 Cliente: ${client.name}\n\n`;
    text += `━━━━━━━━━━━━━━━━━━━━\n\n`;

    metricsToShow.forEach(metric => {
      const value = report.data[metric.key as keyof typeof report.data];
      if (value !== undefined) {
        text += `${metric.label} ${formatMetricValue(metric.key, value as number | string)}\n`;
      }
    });

    if (report.data.best_ad) {
      text += `\n⭐ *Melhor Anúncio:* ${typeof report.data.best_ad === 'string' ? report.data.best_ad : JSON.stringify(report.data.best_ad)}\n`;
    }

    navigator.clipboard.writeText(text);
    toast({ title: 'Relatório copiado!', description: 'Cole no WhatsApp ou onde desejar.' });
  };

  const PlatformIcon = ({ platform, className }: { platform: Platform; className?: string }) => {
    if (platform === 'meta_ads') return <MetaIcon className={className} />;
    if (platform === 'google_ads') return <GoogleIcon className={className} />;
    return null;
  };

  return (
    <Layout>
      {/* Header */}
      <div className="mb-8">
        <Link to="/clients" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-4 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Voltar para Clientes
        </Link>
        
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className={`w-16 h-16 rounded-xl ${getAvatarColor(client.name)} flex items-center justify-center text-white font-bold text-xl shadow-lg`}>
              {getInitials(client.name)}
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold font-display">{client.name}</h1>
                <Badge variant={client.is_active ? "default" : "secondary"}>
                  {client.is_active ? 'Ativo' : 'Inativo'}
                </Badge>
              </div>
              <div className="flex items-center gap-3 mt-2">
                {connectedIntegrations.map(integration => (
                  <div key={integration.id} className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <PlatformIcon platform={integration.platform} className={`w-4 h-4 ${PLATFORMS[integration.platform].color}`} />
                    <span>{integration.account_name || integration.account_id}</span>
                  </div>
                ))}
                {connectedIntegrations.length === 0 && (
                  <span className="text-sm text-muted-foreground">Nenhuma integração conectada</span>
                )}
              </div>
            </div>
          </div>
          
          <Dialog open={isReportDialogOpen} onOpenChange={setIsReportDialogOpen}>
            <DialogTrigger asChild>
              <Button disabled={connectedIntegrations.length === 0}>
                <Plus className="w-4 h-4 mr-2" />
                Gerar Relatório
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Gerar Novo Relatório</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleGenerateReport} className="space-y-4">
                <div className="space-y-2">
                  <Label>Plataforma</Label>
                  <Select value={reportForm.platform} onValueChange={v => setReportForm({...reportForm, platform: v as Platform})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {connectedIntegrations.map(i => (
                        <SelectItem key={i.id} value={i.platform}>
                          <div className="flex items-center gap-2">
                            <PlatformIcon platform={i.platform} className={`w-4 h-4 ${PLATFORMS[i.platform].color}`} />
                            {PLATFORMS[i.platform].name} - {i.account_name || i.account_id}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Formato de Relatório</Label>
                  <Select value={reportForm.report_format_id} onValueChange={v => setReportForm({...reportForm, report_format_id: v})}>
                    <SelectTrigger><SelectValue placeholder="Usar formato padrão do cliente" /></SelectTrigger>
                    <SelectContent>
                      {formats.map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Data Início</Label>
                    <Input type="date" value={reportForm.start_date} onChange={e => setReportForm({...reportForm, start_date: e.target.value})} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Data Fim</Label>
                    <Input type="date" value={reportForm.end_date} onChange={e => setReportForm({...reportForm, end_date: e.target.value})} required />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Escopo do Melhor Anúncio</Label>
                  <Select value={reportForm.best_ad_scope} onValueChange={v => setReportForm({...reportForm, best_ad_scope: v as any})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">🏆 Melhor anúncio geral</SelectItem>
                      <SelectItem value="by_campaign">📊 Por campanha</SelectItem>
                      <SelectItem value="by_objective">🎯 Por objetivo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button type="submit" className="w-full" disabled={isGenerating || !hasAccessToken}>
                  {isGenerating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {isGenerating ? 'Buscando dados...' : 'Gerar Relatório'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Alerts */}
      {!hasAccessToken && (
        <Alert className="mb-6">
          <AlertCircle className="w-4 h-4" />
          <AlertDescription>
            Configure seu Access Token em <Link to="/settings" className="text-primary underline">Configurações</Link> para gerar relatórios do Meta Ads.
          </AlertDescription>
        </Alert>
      )}

      {connectedIntegrations.length === 0 && (
        <Alert className="mb-6">
          <LinkIcon className="w-4 h-4" />
          <AlertDescription>
            Adicione uma integração na aba "Integrações" para começar a gerar relatórios.
          </AlertDescription>
        </Alert>
      )}

      {/* Tabs */}
      <Tabs defaultValue="reports" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="reports" className="gap-2">
            <BarChart3 className="w-4 h-4" />
            <span className="hidden sm:inline">Relatórios</span>
          </TabsTrigger>
          <TabsTrigger value="schedules" className="gap-2">
            <Calendar className="w-4 h-4" />
            <span className="hidden sm:inline">Agendamentos</span>
          </TabsTrigger>
          <TabsTrigger value="integrations" className="gap-2">
            <LinkIcon className="w-4 h-4" />
            <span className="hidden sm:inline">Integrações</span>
          </TabsTrigger>
          <TabsTrigger value="settings" className="gap-2" onClick={openSettingsTab}>
            <Settings className="w-4 h-4" />
            <span className="hidden sm:inline">Configurações</span>
          </TabsTrigger>
        </TabsList>

        {/* Reports Tab */}
        <TabsContent value="reports" className="space-y-4">
          {reportsLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : clientReports.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center py-12">
                <BarChart3 className="w-16 h-16 text-muted-foreground mb-4" />
                <h3 className="font-semibold text-lg mb-2">Nenhum relatório gerado</h3>
                <p className="text-muted-foreground text-center mb-4">
                  Gere seu primeiro relatório para ver os dados de anúncios.
                </p>
                <Button onClick={() => setIsReportDialogOpen(true)} disabled={connectedIntegrations.length === 0}>
                  <Plus className="w-4 h-4 mr-2" />
                  Gerar Relatório
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {clientReports.map(report => (
                <Card key={report.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${PLATFORMS[report.platform as Platform || 'meta_ads'].bgColor}`}>
                        <PlatformIcon platform={report.platform as Platform || 'meta_ads'} className={`w-5 h-5 ${PLATFORMS[report.platform as Platform || 'meta_ads'].color}`} />
                      </div>
                      <div>
                        <h4 className="font-medium">{report.title}</h4>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(report.start_date), 'dd/MM/yyyy')} - {format(new Date(report.end_date), 'dd/MM/yyyy')}
                          <span className="mx-2">•</span>
                          Gerado há {formatDistanceToNow(new Date(report.created_at), { locale: ptBR })}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={report.status === 'completed' ? 'default' : 'secondary'}>
                        {report.status === 'completed' ? 'Concluído' : report.status}
                      </Badge>
                      <Button variant="outline" size="icon" onClick={() => setSelectedReport(report)}>
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button variant="outline" size="icon" onClick={() => copyReportText(report)}>
                        <Copy className="w-4 h-4" />
                      </Button>
                      <Button variant="outline" size="icon" className="text-destructive hover:bg-destructive hover:text-destructive-foreground" onClick={() => deleteReport.mutate(report.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Schedules Tab */}
        <TabsContent value="schedules" className="space-y-4">
          <div className="flex justify-end">
            <Dialog open={isScheduleDialogOpen} onOpenChange={setIsScheduleDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Novo Agendamento
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Criar Agendamento</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleCreateSchedule} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Dia da Semana</Label>
                    <Select value={String(scheduleForm.day_of_week)} onValueChange={v => setScheduleForm({...scheduleForm, day_of_week: parseInt(v)})}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {DAY_NAMES.map((day, idx) => <SelectItem key={idx} value={String(idx)}>{day}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Horário (Brasil)</Label>
                    <Input type="time" value={scheduleForm.run_time} onChange={e => setScheduleForm({...scheduleForm, run_time: e.target.value})} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Webhook URL</Label>
                    <Input value={scheduleForm.webhook_url} onChange={e => setScheduleForm({...scheduleForm, webhook_url: e.target.value})} placeholder="https://..." required />
                  </div>
                  <div className="space-y-2">
                    <Label>Formato de Relatório</Label>
                    <Select value={scheduleForm.report_format_id} onValueChange={v => setScheduleForm({...scheduleForm, report_format_id: v})}>
                      <SelectTrigger><SelectValue placeholder="Usar formato padrão" /></SelectTrigger>
                      <SelectContent>
                        {formats.map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={scheduleForm.is_active} onCheckedChange={v => setScheduleForm({...scheduleForm, is_active: v})} />
                    <Label>Ativo</Label>
                  </div>
                  <Button type="submit" className="w-full" disabled={createScheduledReport.isPending}>
                    {createScheduledReport.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Criar Agendamento
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {clientSchedules.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center py-12">
                <Calendar className="w-16 h-16 text-muted-foreground mb-4" />
                <h3 className="font-semibold text-lg mb-2">Nenhum agendamento</h3>
                <p className="text-muted-foreground text-center mb-4">
                  Crie agendamentos para enviar relatórios automaticamente.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {clientSchedules.map(schedule => (
                <Card key={schedule.id}>
                  <CardContent className="py-4 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-muted-foreground" />
                        <span className="font-medium">{DAY_NAMES[schedule.day_of_week]} às {schedule.run_time}</span>
                        <Badge variant={schedule.is_active ? 'default' : 'secondary'}>
                          {schedule.is_active ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1 truncate max-w-md">
                        Webhook: {schedule.webhook_url}
                      </p>
                      {schedule.last_run_at && (
                        <p className="text-xs text-muted-foreground">
                          Última execução: {formatDistanceToNow(new Date(schedule.last_run_at), { locale: ptBR, addSuffix: true })}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch 
                        checked={schedule.is_active} 
                        onCheckedChange={v => updateScheduledReport.mutate({ id: schedule.id, is_active: v })} 
                      />
                      <Button variant="outline" size="icon" className="text-destructive" onClick={() => deleteScheduledReport.mutate(schedule.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Integrations Tab */}
        <TabsContent value="integrations" className="space-y-4">
          <div className="flex justify-end">
            <Dialog open={isIntegrationDialogOpen} onOpenChange={setIsIntegrationDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Adicionar Integração
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Adicionar Integração</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleAddIntegration} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Plataforma</Label>
                    <Select value={integrationForm.platform} onValueChange={v => setIntegrationForm({...integrationForm, platform: v as Platform})}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="meta_ads">
                          <div className="flex items-center gap-2">
                            <MetaIcon className="w-4 h-4 text-blue-600" />
                            Meta Ads (Facebook / Instagram)
                          </div>
                        </SelectItem>
                        <SelectItem value="google_ads">
                          <div className="flex items-center gap-2">
                            <GoogleIcon className="w-4 h-4" />
                            Google Ads (em breve)
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>ID da Conta de Anúncios</Label>
                    <Input 
                      value={integrationForm.account_id} 
                      onChange={e => setIntegrationForm({...integrationForm, account_id: e.target.value})} 
                      placeholder={integrationForm.platform === 'meta_ads' ? 'Apenas números, sem act_' : 'ID da conta'}
                      required 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Nome da Conta (opcional)</Label>
                    <Input 
                      value={integrationForm.account_name} 
                      onChange={e => setIntegrationForm({...integrationForm, account_name: e.target.value})} 
                      placeholder="Ex: Conta Principal"
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={createIntegration.isPending}>
                    {createIntegration.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Adicionar Integração
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {integrationsLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : integrations.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center py-12">
                <LinkIcon className="w-16 h-16 text-muted-foreground mb-4" />
                <h3 className="font-semibold text-lg mb-2">Nenhuma integração</h3>
                <p className="text-muted-foreground text-center mb-4">
                  Adicione integrações para conectar contas de anúncios a este cliente.
                </p>
                <Button onClick={() => setIsIntegrationDialogOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Adicionar Integração
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {integrations.map(integration => (
                <Card key={integration.id} className="relative">
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`p-3 rounded-xl ${PLATFORMS[integration.platform].bgColor}`}>
                          <PlatformIcon platform={integration.platform} className={`w-6 h-6 ${PLATFORMS[integration.platform].color}`} />
                        </div>
                        <div>
                          <h4 className="font-semibold">{PLATFORMS[integration.platform].name}</h4>
                          <p className="text-sm text-muted-foreground">
                            {integration.account_name || `ID: ${integration.account_id}`}
                          </p>
                          {integration.account_name && (
                            <p className="text-xs text-muted-foreground">
                              ID: {integration.account_id}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={integration.is_connected ? 'default' : 'secondary'} className="gap-1">
                          {integration.is_connected ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                          {integration.is_connected ? 'Conectado' : 'Desconectado'}
                        </Badge>
                        <Button 
                          variant="outline" 
                          size="icon" 
                          className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
                          onClick={() => deleteIntegration.mutate(integration.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}

              {/* Available platforms to add */}
              {Object.values(PLATFORMS)
                .filter(p => !integrations.some(i => i.platform === p.id))
                .map(platform => (
                  <Card key={platform.id} className="border-dashed opacity-60 hover:opacity-100 transition-opacity cursor-pointer" onClick={() => {
                    setIntegrationForm({ ...integrationForm, platform: platform.id });
                    setIsIntegrationDialogOpen(true);
                  }}>
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-3">
                        <div className={`p-3 rounded-xl ${platform.bgColor}`}>
                          <PlatformIcon platform={platform.id} className={`w-6 h-6 ${platform.color}`} />
                        </div>
                        <div>
                          <h4 className="font-semibold">{platform.name}</h4>
                          <p className="text-sm text-muted-foreground">
                            Clique para adicionar
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
            </div>
          )}
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Configurações do Cliente</CardTitle>
              <CardDescription>Gerencie as informações e preferências deste cliente.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSaveSettings} className="space-y-6">
                <div className="space-y-2">
                  <Label>Nome do Cliente</Label>
                  <Input value={clientForm.name} onChange={e => setClientForm({...clientForm, name: e.target.value})} required />
                </div>
                <div className="space-y-2">
                  <Label>Formato de Relatório Padrão</Label>
                  <Select value={clientForm.report_format_id} onValueChange={v => setClientForm({...clientForm, report_format_id: v})}>
                    <SelectTrigger><SelectValue placeholder="Selecione um formato" /></SelectTrigger>
                    <SelectContent>
                      {formats.map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">Este formato será usado como padrão ao gerar relatórios para este cliente.</p>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={clientForm.is_active} onCheckedChange={v => setClientForm({...clientForm, is_active: v})} />
                  <Label>Cliente Ativo</Label>
                </div>
                <Button type="submit" disabled={updateClient.isPending}>
                  {updateClient.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Salvar Alterações
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Report View Sheet */}
      <Sheet open={!!selectedReport} onOpenChange={open => !open && setSelectedReport(null)}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          {selectedReport && (
            <>
              <SheetHeader className="mb-6">
                <SheetTitle>{selectedReport.title}</SheetTitle>
                <p className="text-sm text-muted-foreground">
                  {format(new Date(selectedReport.start_date), 'dd/MM/yyyy')} - {format(new Date(selectedReport.end_date), 'dd/MM/yyyy')}
                </p>
              </SheetHeader>

              <div className="space-y-4">
                {selectedReport.data.reach !== undefined && (
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-muted-foreground">👥 Alcance</span>
                    <span className="font-medium">{selectedReport.data.reach.toLocaleString('pt-BR')}</span>
                  </div>
                )}
                {selectedReport.data.impressions !== undefined && (
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-muted-foreground">👁️ Impressões</span>
                    <span className="font-medium">{selectedReport.data.impressions.toLocaleString('pt-BR')}</span>
                  </div>
                )}
                {selectedReport.data.link_clicks !== undefined && (
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-muted-foreground">🖱️ Cliques</span>
                    <span className="font-medium">{selectedReport.data.link_clicks.toLocaleString('pt-BR')}</span>
                  </div>
                )}
                {selectedReport.data.total_spend !== undefined && (
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-muted-foreground">💲 Investimento</span>
                    <span className="font-medium">R$ {selectedReport.data.total_spend.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                  </div>
                )}
                {selectedReport.data.messages_started !== undefined && (
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-muted-foreground">💬 Mensagens</span>
                    <span className="font-medium">{selectedReport.data.messages_started}</span>
                  </div>
                )}
                {selectedReport.data.best_ad && (
                  <div className="py-2">
                    <span className="text-muted-foreground block mb-2">⭐ Melhor Anúncio</span>
                    <span className="font-medium">{typeof selectedReport.data.best_ad === 'string' ? selectedReport.data.best_ad : JSON.stringify(selectedReport.data.best_ad, null, 2)}</span>
                  </div>
                )}
              </div>

              <div className="mt-6 flex gap-2">
                <Button onClick={() => copyReportText(selectedReport)} className="flex-1">
                  <Copy className="w-4 h-4 mr-2" />
                  Copiar para WhatsApp
                </Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </Layout>
  );
}
