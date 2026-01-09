import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export type Platform = 'meta_ads' | 'google_ads';

export interface ClientIntegration {
  id: string;
  client_id: string;
  user_id: string;
  platform: Platform;
  account_id: string;
  account_name: string | null;
  is_connected: boolean;
  credentials: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export function useClientIntegrations(clientId?: string) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: integrations = [], isLoading, error } = useQuery({
    queryKey: ['client-integrations', clientId],
    queryFn: async () => {
      if (!user || !clientId) return [];
      
      const { data, error } = await supabase
        .from('client_integrations')
        .select('*')
        .eq('client_id', clientId)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as ClientIntegration[];
    },
    enabled: !!user && !!clientId,
  });

  const createIntegration = useMutation({
    mutationFn: async (integration: {
      client_id: string;
      platform: Platform;
      account_id: string;
      account_name?: string;
      is_connected?: boolean;
    }) => {
      if (!user) throw new Error('Usuário não autenticado');
      
      const { data, error } = await supabase
        .from('client_integrations')
        .insert({ 
          ...integration, 
          user_id: user.id,
          is_connected: integration.is_connected ?? true,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-integrations'] });
      toast({ title: 'Integração adicionada com sucesso!' });
    },
    onError: (error: Error) => {
      toast({ 
        title: 'Erro ao adicionar integração', 
        description: error.message,
        variant: 'destructive' 
      });
    },
  });

  const updateIntegration = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<ClientIntegration> & { id: string }) => {
      const { credentials, ...safeUpdates } = updates;
      const { data, error } = await supabase
        .from('client_integrations')
        .update(safeUpdates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-integrations'] });
      toast({ title: 'Integração atualizada!' });
    },
    onError: (error: Error) => {
      toast({ 
        title: 'Erro ao atualizar integração', 
        description: error.message,
        variant: 'destructive' 
      });
    },
  });

  const deleteIntegration = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('client_integrations')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-integrations'] });
      toast({ title: 'Integração removida!' });
    },
    onError: (error: Error) => {
      toast({ 
        title: 'Erro ao remover integração', 
        description: error.message,
        variant: 'destructive' 
      });
    },
  });

  return {
    integrations,
    isLoading,
    error,
    createIntegration,
    updateIntegration,
    deleteIntegration,
  };
}
