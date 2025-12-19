import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Layout, PageHeader } from '@/components/layout/Layout';
import { useAuth } from '@/contexts/AuthContext';
import { useClients } from '@/hooks/useClients';
import { useReportFormats } from '@/hooks/useReportFormats';
import { useScheduledReports } from '@/hooks/useScheduledReports';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Plus, Pencil, Trash2, Loader2, Calendar, Clock, Send, FileText, Play } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const DAYS_OF_WEEK = [
  { value: '0', label: 'Domingo' },
  { value: '1', label: 'Segunda-feira' },
  { value: '2', label: 'Terça-feira' },
  { value: '3', label: 'Quarta-feira' },
  { value: '4', label: 'Quinta-feira' },
  { value: '5', label: 'Sexta-feira' },
  { value: '6', label: 'Sábado' },
];

const HOURS = Array.from({ length: 24 }, (_, i) => ({
  value: String(i).padStart(2, '0'),
  label: String(i).padStart(2, '0'),
}));

const MINUTES = Array.from({ length: 60 }, (_, i) => ({
  value: String(i).padStart(2, '0'),
  label: String(i).padStart(2, '0'),
}));

export default function Scheduler() {
  const { user, loading: authLoading } = useAuth();
  const { clients } = useClients();
  const { formats } = useReportFormats();
  const { scheduledReports, isLoading, createScheduledReport, updateScheduledReport, deleteScheduledReport } = useScheduledReports();
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<string | null>(null);
  const [testingScheduleId, setTestingScheduleId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    client_id: '',
    webhook_url: 'https://hook.us2.make.com/ubpb53m819d72abao2kcd3bluqj6ffal',
    day_of_week: '1',
    run_time: '09:00',
    report_format_id: '',
    is_active: true,
  });

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const payload = {
      client_id: formData.client_id,
      webhook_url: formData.webhook_url,
      day_of_week: parseInt(formData.day_of_week),
      run_time: formData.run_time,
      timezone: 'America/Sao_Paulo',
      report_format_id: formData.report_format_id || null,
      is_active: formData.is_active,
    };

    if (editingSchedule) {
      await updateScheduledReport.mutateAsync({ id: editingSchedule, ...payload });
    } else {
      await createScheduledReport.mutateAsync(payload);
    }
    
    setIsDialogOpen(false);
    setEditingSchedule(null);
    resetForm();
  };

  const resetForm = () => {
    setFormData({
      client_id: '',
      webhook_url: 'https://hook.us2.make.com/ubpb53m819d72abao2kcd3bluqj6ffal',
      day_of_week: '1',
      run_time: '09:00',
      report_format_id: '',
      is_active: true,
    });
  };

  const openEdit = (schedule: typeof scheduledReports[0]) => {
    setEditingSchedule(schedule.id);
    setFormData({
      client_id: schedule.client_id,
      webhook_url: schedule.webhook_url,
      day_of_week: String(schedule.day_of_week),
      run_time: schedule.run_time,
      report_format_id: schedule.report_format_id || '',
      is_active: schedule.is_active,
    });
    setIsDialogOpen(true);
  };

  const getDayLabel = (day: number) => {
    return DAYS_OF_WEEK.find(d => d.value === String(day))?.label || 'N/A';
  };

  const formatLastRun = (date: string | null) => {
    if (!date) return 'Nunca executado';
    return new Date(date).toLocaleString('pt-BR');
  };

  const handleTestNow = async (schedule: typeof scheduledReports[0]) => {
    if (!user || !schedule.client) return;
    
    setTestingScheduleId(schedule.id);
    
    try {
      // Get the date range for the previous week
      const now = new Date();
      const currentDay = now.getDay();
      const daysToLastMonday = currentDay === 0 ? 6 : currentDay + 6;
      
      const lastMonday = new Date(now);
      lastMonday.setDate(now.getDate() - daysToLastMonday);
      
      const lastSunday = new Date(lastMonday);
      lastSunday.setDate(lastMonday.getDate() + 6);
      
      const formatDate = (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };
      
      const startDate = formatDate(lastMonday);
      const endDate = formatDate(lastSunday);
      
      // Call meta-ads-report to get the data
      const { data: reportData, error: reportError } = await supabase.functions.invoke('meta-ads-report', {
        body: {
          accountId: schedule.client.account_id,
          startDate,
          endDate,
          userId: user.id,
          bestAdScope: 'all',
        },
      });

      if (reportError || reportData?.error) {
        throw new Error(reportError?.message || reportData?.error || 'Erro ao buscar dados');
      }

      // Get the report format metrics
      const metricsToShow = schedule.report_format?.metrics || [
        { key: 'reach', label: '👥 Alcance' },
        { key: 'impressions', label: '👁️ Impressões' },
        { key: 'link_clicks', label: '🔗 Cliques no Link' },
        { key: 'messages_started', label: '💬 Mensagens Iniciadas' },
        { key: 'cost_per_message', label: '💰 Custo por Mensagem' },
        { key: 'instagram_visits', label: '📱 Visitas ao Instagram' },
        { key: 'total_spend', label: '💲 Investimento Total' },
      ];

      // Format metric value
      const formatMetricValue = (key: string, value: number | string | undefined): string => {
        if (value === undefined || value === null) return '-';
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

      // Generate WhatsApp text
      const formatDatePt = (dateStr: string) => {
        const [year, month, day] = dateStr.split('-');
        return `${day}/${month}/${year}`;
      };

      let whatsappText = `📊 *RELATÓRIO SEMANAL - ${schedule.client.name.toUpperCase()}*\n`;
      whatsappText += `📅 Período: ${formatDatePt(startDate)} a ${formatDatePt(endDate)}\n`;
      whatsappText += `👤 Cliente: ${schedule.client.name}\n\n`;
      whatsappText += `━━━━━━━━━━━━━━━━━━━━\n\n`;

      (metricsToShow as Array<{key: string; label: string}>).forEach((metric) => {
        const value = reportData[metric.key];
        if (value !== undefined && value !== null) {
          whatsappText += `${metric.label} ${formatMetricValue(metric.key, value)}\n`;
        }
      });

      if (reportData.best_ad) {
        whatsappText += `\n⭐ *Melhor Anúncio:* ${reportData.best_ad}\n`;
      }

      // Add campaigns section
      if (reportData.campaigns && reportData.campaigns.length > 0) {
        whatsappText += `\n━━━━━━━━━━━━━━━━━━━━\n`;
        whatsappText += `📈 *CAMPANHAS*\n\n`;

        reportData.campaigns.forEach((campaign: any, idx: number) => {
          whatsappText += `*${idx + 1}. ${campaign.name}*\n`;
          if (campaign.reach) whatsappText += `   Alcance: ${campaign.reach.toLocaleString('pt-BR')}\n`;
          if (campaign.impressions) whatsappText += `   Impressões: ${campaign.impressions.toLocaleString('pt-BR')}\n`;
          if (campaign.spend) whatsappText += `   Investimento: R$ ${campaign.spend.toFixed(2)}\n`;
          if (campaign.link_clicks) whatsappText += `   Cliques: ${campaign.link_clicks.toLocaleString('pt-BR')}\n`;
          if (campaign.messages_started && campaign.messages_started > 0) {
            whatsappText += `   Mensagens: ${campaign.messages_started}\n`;
            if (campaign.cost_per_message) {
              whatsappText += `   Custo/Mensagem: R$ ${campaign.cost_per_message.toFixed(2)}\n`;
            }
          }
          if (campaign.purchases && campaign.purchases > 0) {
            whatsappText += `   Compras: ${campaign.purchases}\n`;
            if (campaign.cost_per_purchase) {
              whatsappText += `   Custo/Compra: R$ ${campaign.cost_per_purchase.toFixed(2)}\n`;
            }
          }
          whatsappText += '\n';
        });
      }

      // Build payload
      const payload = {
        cliente: schedule.client.name,
        account_id: schedule.client.account_id,
        periodo: {
          inicio: startDate,
          fim: endDate,
        },
        metricas: reportData,
        format_name: schedule.report_format?.name || 'Padrão',
        gerado_em: new Date().toISOString(),
      };

      // Send to webhook
      await fetch(schedule.webhook_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payload,
          whatsapp_text: whatsappText,
        }),
      });

      toast({
        title: 'Teste enviado!',
        description: 'O relatório foi enviado para o webhook com sucesso.',
      });

    } catch (error: any) {
      console.error('Error testing schedule:', error);
      toast({
        title: 'Erro ao testar',
        description: error.message || 'Não foi possível enviar o relatório de teste.',
        variant: 'destructive',
      });
    } finally {
      setTestingScheduleId(null);
    }
  };

  // Get clients that don't have a schedule yet
  const availableClients = clients.filter(
    client => !scheduledReports.some(s => s.client_id === client.id) || 
              editingSchedule && scheduledReports.find(s => s.id === editingSchedule)?.client_id === client.id
  );

  return (
    <Layout>
      <PageHeader 
        title="Agendamentos" 
        description="Configure envios automáticos de relatórios semanais"
      >
        <Dialog 
          open={isDialogOpen} 
          onOpenChange={(open) => { 
            setIsDialogOpen(open); 
            if (!open) { 
              setEditingSchedule(null); 
              resetForm(); 
            } 
          }}
        >
          <DialogTrigger asChild>
            <Button disabled={availableClients.length === 0}>
              <Plus className="w-4 h-4 mr-2" />
              Novo Agendamento
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingSchedule ? 'Editar' : 'Novo'} Agendamento</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label>Cliente</Label>
                <Select 
                  value={formData.client_id} 
                  onValueChange={v => setFormData({...formData, client_id: v})}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um cliente" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableClients.map(client => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Formato de Relatório</Label>
                <Select 
                  value={formData.report_format_id} 
                  onValueChange={v => setFormData({...formData, report_format_id: v})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um formato" />
                  </SelectTrigger>
                  <SelectContent>
                    {formats.map(format => (
                      <SelectItem key={format.id} value={format.id}>
                        {format.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Webhook URL (Make)</Label>
                <Input 
                  value={formData.webhook_url} 
                  onChange={e => setFormData({...formData, webhook_url: e.target.value})} 
                  placeholder="https://hook.us2.make.com/..." 
                  required 
                />
              </div>

              <div>
                <Label>Dia da Semana</Label>
                <Select 
                  value={formData.day_of_week} 
                  onValueChange={v => setFormData({...formData, day_of_week: v})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DAYS_OF_WEEK.map(day => (
                      <SelectItem key={day.value} value={day.value}>
                        {day.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Horário (Brasil)</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Select 
                    value={formData.run_time.split(':')[0]} 
                    onValueChange={v => setFormData({...formData, run_time: `${v}:${formData.run_time.split(':')[1] || '00'}`})}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Hora" />
                    </SelectTrigger>
                    <SelectContent>
                      {HOURS.map(hour => (
                        <SelectItem key={hour.value} value={hour.value}>
                          {hour.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select 
                    value={formData.run_time.split(':')[1] || '00'} 
                    onValueChange={v => setFormData({...formData, run_time: `${formData.run_time.split(':')[0]}:${v}`})}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Min" />
                    </SelectTrigger>
                    <SelectContent>
                      {MINUTES.map(min => (
                        <SelectItem key={min.value} value={min.value}>
                          {min.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Switch 
                  checked={formData.is_active} 
                  onCheckedChange={v => setFormData({...formData, is_active: v})} 
                />
                <Label>Agendamento Ativo</Label>
              </div>

              <Button 
                type="submit" 
                className="w-full" 
                disabled={createScheduledReport.isPending || updateScheduledReport.isPending || !formData.client_id}
              >
                {(createScheduledReport.isPending || updateScheduledReport.isPending) && (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                )}
                Salvar
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </PageHeader>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : scheduledReports.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-12">
            <Calendar className="w-16 h-16 text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">Nenhum agendamento configurado</p>
            {clients.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Cadastre um cliente primeiro para criar agendamentos
              </p>
            ) : (
              <Button onClick={() => setIsDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Criar Agendamento
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {scheduledReports.map(schedule => (
            <Card key={schedule.id} className="animate-scale-in">
              <CardHeader className="flex flex-row items-start justify-between">
                <div>
                  <CardTitle className="text-lg">{schedule.client?.name || 'Cliente'}</CardTitle>
                  <CardDescription className="mt-1">
                    ID: {schedule.client?.account_id}
                  </CardDescription>
                </div>
                <span 
                  className={`px-2 py-1 rounded-full text-xs font-medium ${
                    schedule.is_active 
                      ? 'bg-success/10 text-success' 
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {schedule.is_active ? 'Ativo' : 'Inativo'}
                </span>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="w-4 h-4" />
                  <span>{getDayLabel(schedule.day_of_week)}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="w-4 h-4" />
                  <span>{schedule.run_time} (Brasil)</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Send className="w-4 h-4" />
                  <span className="truncate text-xs">{schedule.webhook_url.slice(0, 40)}...</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <FileText className="w-4 h-4" />
                  <span>Formato: {schedule.report_format?.name || 'Padrão'}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Última execução: {formatLastRun(schedule.last_run_at)}
                </p>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => handleTestNow(schedule)}
                    disabled={testingScheduleId === schedule.id}
                    title="Testar agora"
                  >
                    {testingScheduleId === schedule.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Play className="w-4 h-4" />
                    )}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => openEdit(schedule)}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="text-destructive hover:bg-destructive hover:text-destructive-foreground" 
                    onClick={() => deleteScheduledReport.mutate(schedule.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card className="mt-8">
        <CardHeader>
          <CardTitle className="text-lg">Como funciona</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>• O relatório é gerado automaticamente toda semana no dia e horário configurado</p>
          <p>• Período considerado: segunda-feira a domingo da semana anterior</p>
          <p>• Os dados são enviados para o webhook do Make em formato JSON + texto WhatsApp</p>
          <p>• Campos não disponíveis são enviados como null</p>
          <p>• Nenhuma ação manual é necessária após a configuração</p>
        </CardContent>
      </Card>
    </Layout>
  );
}
