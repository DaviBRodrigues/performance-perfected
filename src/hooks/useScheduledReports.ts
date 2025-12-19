import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export interface ScheduledReport {
  id: string;
  client_id: string;
  user_id: string;
  webhook_url: string;
  day_of_week: number;
  run_time: string;
  timezone: string;
  is_active: boolean;
  last_run_at: string | null;
  report_format_id: string | null;
  created_at: string;
  updated_at: string;
  client?: {
    id: string;
    name: string;
    account_id: string;
  };
  report_format?: {
    id: string;
    name: string;
    metrics: Array<{ key: string; label: string }>;
  };
}

export function useScheduledReports() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: scheduledReports = [], isLoading, error } = useQuery({
    queryKey: ['scheduled-reports', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from('scheduled_reports')
        .select('*, client:clients(id, name, account_id), report_format:report_formats(id, name, metrics)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as ScheduledReport[];
    },
    enabled: !!user,
  });

  const createScheduledReport = useMutation({
    mutationFn: async (report: Omit<ScheduledReport, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'last_run_at' | 'client'>) => {
      if (!user) throw new Error('Usuário não autenticado');
      
      const { data, error } = await supabase
        .from('scheduled_reports')
        .insert({ ...report, user_id: user.id })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduled-reports'] });
      toast({ title: 'Agendamento criado com sucesso!' });
    },
    onError: (error: Error) => {
      toast({ 
        title: 'Erro ao criar agendamento', 
        description: error.message,
        variant: 'destructive' 
      });
    },
  });

  const updateScheduledReport = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<ScheduledReport> & { id: string }) => {
      const { client, report_format, ...cleanUpdates } = updates;
      const { data, error } = await supabase
        .from('scheduled_reports')
        .update(cleanUpdates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduled-reports'] });
      toast({ title: 'Agendamento atualizado com sucesso!' });
    },
    onError: (error: Error) => {
      toast({ 
        title: 'Erro ao atualizar agendamento', 
        description: error.message,
        variant: 'destructive' 
      });
    },
  });

  const deleteScheduledReport = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('scheduled_reports')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduled-reports'] });
      toast({ title: 'Agendamento removido com sucesso!' });
    },
    onError: (error: Error) => {
      toast({ 
        title: 'Erro ao remover agendamento', 
        description: error.message,
        variant: 'destructive' 
      });
    },
  });

  return {
    scheduledReports,
    isLoading,
    error,
    createScheduledReport,
    updateScheduledReport,
    deleteScheduledReport,
  };
}
