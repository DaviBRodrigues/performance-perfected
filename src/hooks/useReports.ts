import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Report, ReportData, ReportFormat, Client, Metric } from '@/types/database';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Json } from '@/integrations/supabase/types';

export function useReports() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: reports = [], isLoading, error } = useQuery({
    queryKey: ['reports', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from('reports')
        .select('*, client:clients(*), report_format:report_formats(*)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      // Transform the data to match our Report type
      return (data || []).map(report => ({
        ...report,
        data: (report.data || {}) as ReportData,
        status: report.status as Report['status'],
        client: report.client ? {
          ...report.client,
        } as Client : undefined,
        report_format: report.report_format ? {
          ...report.report_format,
          metrics: (report.report_format.metrics || []) as unknown as Metric[],
        } as ReportFormat : undefined,
      })) as Report[];
    },
    enabled: !!user,
  });

  const createReport = useMutation({
    mutationFn: async (report: {
      client_id: string;
      report_format_id?: string;
      title: string;
      start_date: string;
      end_date: string;
      data: ReportData;
      status?: string;
    }) => {
      if (!user) throw new Error('Usuário não autenticado');
      
      const { data, error } = await supabase
        .from('reports')
        .insert({ 
          client_id: report.client_id,
          report_format_id: report.report_format_id,
          title: report.title,
          start_date: report.start_date,
          end_date: report.end_date,
          status: report.status,
          user_id: user.id,
          data: report.data as unknown as Json,
        })
        .select('*, client:clients(*), report_format:report_formats(*)')
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      toast({ title: 'Relatório gerado com sucesso!' });
    },
    onError: (error: Error) => {
      toast({ 
        title: 'Erro ao gerar relatório', 
        description: error.message,
        variant: 'destructive' 
      });
    },
  });

  const deleteReport = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('reports')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      toast({ title: 'Relatório removido com sucesso!' });
    },
    onError: (error: Error) => {
      toast({ 
        title: 'Erro ao remover relatório', 
        description: error.message,
        variant: 'destructive' 
      });
    },
  });

  return {
    reports,
    isLoading,
    error,
    createReport,
    deleteReport,
  };
}
