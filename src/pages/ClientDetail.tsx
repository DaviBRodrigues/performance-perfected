import { useState, useMemo } from 'react';
import { Navigate, useParams, Link } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { useAuth } from '@/contexts/AuthContext';
import { useClients } from '@/hooks/useClients';
import { useReports } from '@/hooks/useReports';
import { useReportFormats } from '@/hooks/useReportFormats';
import { useScheduledReports } from '@/hooks/useScheduledReports';
import { useSettings } from '@/hooks/useSettings';
import { Report } from '@/types/database';
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
  Calendar, Clock, Settings, CheckCircle, Pencil, FileText, 
  TrendingUp, DollarSign, Users, MousePointer
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

// Meta Ads icon component
function MetaIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2.04c-5.5 0-10 4.49-10 10.02 0 5 3.66 9.15 8.44 9.9v-7H7.9v-2.9h2.54V9.85c0-2.52 1.49-3.9 3.77-3.9 1.09 0 2.24.2 2.24.2v2.47H15.2c-1.24 0-1.63.78-1.63 1.57v1.88h2.78l-.45 2.9h-2.33v7a10 10 0 0 0 8.43-9.9c0-5.53-4.5-10.02-10-10.02Z"/>
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
  const { toast } = useToast();

  const [isReportDialogOpen, setIsReportDialogOpen] = useState(false);
  const [isScheduleDialogOpen, setIsScheduleDialogOpen] = useState(false);
  const [isSettingsDialogOpen, setIsSettingsDialogOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);

  const [reportForm, setReportForm] = useState({
    report_format_id: '',
    start_date: '',
    end_date: '',
    best_ad_scope: 'all' as 'all' | 'by_campaign' | 'by_objective',
  });

  const [scheduleForm, setScheduleForm] = useState({
    day_of_week: 1,
    run_time: '09:00',
    webhook_url: '',
    report_format_id: '',
    is_active: true,
  });

  const [clientForm, setClientForm] = useState({
    name: '',
    account_id: '',
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

  // Stats
  const stats = useMemo(() => {
    const lastReport = clientReports[0];
    const totalSpend = clientReports.reduce((sum, r) => sum + (r.data?.total_spend || 0), 0);
    const totalReach = clientReports.reduce((sum, r) => sum + (r.data?.reach || 0), 0);
    const totalClicks = clientReports.reduce((sum, r) => sum + (r.data?.link_clicks || 0), 0);
    
    return { 
      reportCount: clientReports.length,
      lastReportAt: lastReport ? new Date(lastReport.created_at) : null,
      totalSpend,
      totalReach,
      totalClicks,
    };
  }, [clientReports]);

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
  const openSettings = () => {
    setClientForm({
      name: client.name,
      account_id: client.account_id,
      report_format_id: client.report_format_id || '',
      is_active: client.is_active ?? true,
    });
    setIsSettingsDialogOpen(true);
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateClient.mutateAsync({
      id: client.id,
      ...clientForm,
      report_format_id: clientForm.report_format_id || null,
    });
    setIsSettingsDialogOpen(false);
  };

  const handleGenerateReport = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsGenerating(true);

    try {
      const { data: reportData, error } = await supabase.functions.invoke('meta-ads-report', {
        body: {
          accountId: client.account_id,
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
        title: `Relatório - ${client.name} - ${reportForm.start_date} a ${reportForm.end_date}`,
        start_date: reportForm.start_date,
        end_date: reportForm.end_date,
        data: reportData,
        status: 'completed',
      });

      toast({ title: 'Relatório gerado!', description: 'Dados reais obtidos da API do Meta Ads.' });
      setIsReportDialogOpen(false);
      setReportForm({ report_format_id: '', start_date: '', end_date: '', best_ad_scope: 'all' });
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
              <div className="flex items-center gap-2 mt-1 text-muted-foreground">
                <MetaIcon className="w-4 h-4 text-blue-600" />
                <span className="text-sm">ID: {client.account_id}</span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={openSettings}>
              <Settings className="w-4 h-4" />
            </Button>
            <Dialog open={isReportDialogOpen} onOpenChange={setIsReportDialogOpen}>
              <DialogTrigger asChild>
                <Button disabled={!hasAccessToken}>
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
                  <Button type="submit" className="w-full" disabled={isGenerating}>
                    {isGenerating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    {isGenerating ? 'Buscando dados...' : 'Gerar Relatório'}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      {/* Alerts */}
      {!hasAccessToken && (
        <Alert className="mb-6">
          <AlertCircle className="w-4 h-4" />
          <AlertDescription>
            Configure seu Access Token em <Link to="/settings" className="text-primary underline">Configurações</Link> para gerar relatórios.
          </AlertDescription>
        </Alert>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Relatórios</p>
                <p className="text-2xl font-bold">{stats.reportCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-success/10 text-success">
                <DollarSign className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Investimento Total</p>
                <p className="text-2xl font-bold">R$ {stats.totalSpend.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-info/10 text-info">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Alcance Total</p>
                <p className="text-2xl font-bold">{stats.totalReach.toLocaleString('pt-BR')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-warning/10 text-warning">
                <MousePointer className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Cliques Totais</p>
                <p className="text-2xl font-bold">{stats.totalClicks.toLocaleString('pt-BR')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="reports" className="space-y-6">
        <TabsList>
          <TabsTrigger value="reports" className="gap-2">
            <BarChart3 className="w-4 h-4" />
            Relatórios
          </TabsTrigger>
          <TabsTrigger value="schedules" className="gap-2">
            <Calendar className="w-4 h-4" />
            Agendamentos
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
                  Gere seu primeiro relatório para ver os dados do Meta Ads.
                </p>
                <Button onClick={() => setIsReportDialogOpen(true)} disabled={!hasAccessToken}>
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
                    <div>
                      <h4 className="font-medium">{report.title}</h4>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(report.start_date), 'dd/MM/yyyy')} - {format(new Date(report.end_date), 'dd/MM/yyyy')}
                        <span className="mx-2">•</span>
                        Gerado há {formatDistanceToNow(new Date(report.created_at), { locale: ptBR })}
                      </p>
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
      </Tabs>

      {/* Settings Dialog */}
      <Dialog open={isSettingsDialogOpen} onOpenChange={setIsSettingsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Configurações do Cliente</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveSettings} className="space-y-4">
            <div className="space-y-2">
              <Label>Nome do Cliente</Label>
              <Input value={clientForm.name} onChange={e => setClientForm({...clientForm, name: e.target.value})} required />
            </div>
            <div className="space-y-2">
              <Label>Account ID do Meta Ads</Label>
              <Input value={clientForm.account_id} onChange={e => setClientForm({...clientForm, account_id: e.target.value})} required />
              <p className="text-xs text-muted-foreground">Apenas números, sem o prefixo "act_"</p>
            </div>
            <div className="space-y-2">
              <Label>Formato de Relatório Padrão</Label>
              <Select value={clientForm.report_format_id} onValueChange={v => setClientForm({...clientForm, report_format_id: v})}>
                <SelectTrigger><SelectValue placeholder="Selecione um formato" /></SelectTrigger>
                <SelectContent>
                  {formats.map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={clientForm.is_active} onCheckedChange={v => setClientForm({...clientForm, is_active: v})} />
              <Label>Cliente Ativo</Label>
            </div>
            <Button type="submit" className="w-full" disabled={updateClient.isPending}>
              {updateClient.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Salvar Alterações
            </Button>
          </form>
        </DialogContent>
      </Dialog>

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
