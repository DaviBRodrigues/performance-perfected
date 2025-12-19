import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ReportFormat, DEFAULT_REPORT_FORMATS, Metric } from '@/types/database';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Json } from '@/integrations/supabase/types';

export function useReportFormats() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: formats = [], isLoading, error } = useQuery({
    queryKey: ['report_formats', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from('report_formats')
        .select('*')
        .eq('user_id', user.id)
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      
      // Transform the data to match our ReportFormat type
      return (data || []).map(item => ({
        ...item,
        metrics: (item.metrics || []) as unknown as Metric[],
      })) as ReportFormat[];
    },
    enabled: !!user,
  });

  const initializeDefaultFormats = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Usuário não autenticado');
      
      const { data: existing } = await supabase
        .from('report_formats')
        .select('id')
        .eq('user_id', user.id)
        .limit(1);
      
      if (existing && existing.length > 0) {
        return existing;
      }
      
      const formatsToInsert = DEFAULT_REPORT_FORMATS.map((format) => ({
        ...format,
        user_id: user.id,
        metrics: format.metrics as unknown as Json,
      }));
      
      const { data, error } = await supabase
        .from('report_formats')
        .insert(formatsToInsert)
        .select();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['report_formats'] });
    },
  });

  const createFormat = useMutation({
    mutationFn: async (format: Omit<ReportFormat, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => {
      if (!user) throw new Error('Usuário não autenticado');
      
      const { data, error } = await supabase
        .from('report_formats')
        .insert({ 
          name: format.name,
          description: format.description,
          api_fields: format.api_fields,
          is_default: format.is_default,
          user_id: user.id,
          metrics: format.metrics as unknown as Json,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['report_formats'] });
      toast({ title: 'Formato criado com sucesso!' });
    },
    onError: (error: Error) => {
      toast({ 
        title: 'Erro ao criar formato', 
        description: error.message,
        variant: 'destructive' 
      });
    },
  });

  const updateFormat = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<ReportFormat> & { id: string }) => {
      const { data, error } = await supabase
        .from('report_formats')
        .update({
          name: updates.name,
          description: updates.description,
          api_fields: updates.api_fields,
          is_default: updates.is_default,
          metrics: updates.metrics as unknown as Json,
        })
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['report_formats'] });
      toast({ title: 'Formato atualizado com sucesso!' });
    },
    onError: (error: Error) => {
      toast({ 
        title: 'Erro ao atualizar formato', 
        description: error.message,
        variant: 'destructive' 
      });
    },
  });

  const deleteFormat = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('report_formats')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['report_formats'] });
      toast({ title: 'Formato removido com sucesso!' });
    },
    onError: (error: Error) => {
      toast({ 
        title: 'Erro ao remover formato', 
        description: error.message,
        variant: 'destructive' 
      });
    },
  });

  return {
    formats,
    isLoading,
    error,
    initializeDefaultFormats,
    createFormat,
    updateFormat,
    deleteFormat,
  };
}
