import { useState, useMemo } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Layout, PageHeader } from '@/components/layout/Layout';
import { useAuth } from '@/contexts/AuthContext';
import { useClients } from '@/hooks/useClients';
import { useReports } from '@/hooks/useReports';
import { useReportFormats } from '@/hooks/useReportFormats';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Plus, Loader2, Users, Search, SlidersHorizontal, ChevronRight } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

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
    'bg-blue-500',
    'bg-green-500',
    'bg-purple-500',
    'bg-orange-500',
    'bg-pink-500',
    'bg-teal-500',
    'bg-indigo-500',
    'bg-red-500',
  ];
  const index = name.charCodeAt(0) % colors.length;
  return colors[index];
}

// Get initials from name
function getInitials(name: string): string {
  return name
    .split(' ')
    .map(word => word.charAt(0))
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

interface ClientCardProps {
  client: {
    id: string;
    name: string;
    account_id: string;
    is_active: boolean;
    report_format?: { name: string } | null;
  };
  reportCount: number;
  lastReportAt: Date | null;
  onClick: () => void;
}

function ClientCard({ client, reportCount, lastReportAt, onClick }: ClientCardProps) {
  return (
    <Card 
      className="group hover:shadow-lg transition-all duration-300 border-border/50 hover:border-primary/30 animate-scale-in cursor-pointer"
      onClick={onClick}
    >
      <CardContent className="p-6">
        <div className="flex items-start gap-4">
          {/* Avatar */}
          <div className={`w-14 h-14 rounded-xl ${getAvatarColor(client.name)} flex items-center justify-center text-white font-bold text-lg shadow-md`}>
            {getInitials(client.name)}
          </div>
          
          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="font-semibold text-foreground truncate">{client.name}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <MetaIcon className="w-4 h-4 text-blue-600" />
                  {client.is_active ? (
                    <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
                  ) : (
                    <span className="w-2 h-2 rounded-full bg-muted-foreground" />
                  )}
                </div>
              </div>
              
              {/* Arrow indicator */}
              <ChevronRight className="w-5 h-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            
            {/* Stats */}
            <div className="mt-4 pt-4 border-t border-border/50">
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{reportCount}</span> {reportCount === 1 ? 'relatório' : 'relatórios'}
              </p>
              {lastReportAt ? (
                <p className="text-xs text-primary mt-1">
                  Último relatório gerado há {formatDistanceToNow(lastReportAt, { locale: ptBR })}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground mt-1">
                  Nenhum relatório gerado
                </p>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Clients() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { clients, isLoading, createClient, updateClient, deleteClient } = useClients();
  const { reports } = useReports();
  const { formats } = useReportFormats();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({ name: '', account_id: '', report_format_id: '', is_active: true });
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'recent'>('recent');

  // Calculate report stats per client
  const clientStats = useMemo(() => {
    const stats: Record<string, { count: number; lastAt: Date | null }> = {};
    
    clients.forEach(client => {
      const clientReports = reports.filter(r => r.client_id === client.id);
      const sortedReports = clientReports.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      
      stats[client.id] = {
        count: clientReports.length,
        lastAt: sortedReports.length > 0 ? new Date(sortedReports[0].created_at) : null,
      };
    });
    
    return stats;
  }, [clients, reports]);

  // Filter and sort clients
  const filteredClients = useMemo(() => {
    let result = clients.filter(client =>
      client.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (sortBy === 'recent') {
      result = result.sort((a, b) => {
        const aLast = clientStats[a.id]?.lastAt?.getTime() || 0;
        const bLast = clientStats[b.id]?.lastAt?.getTime() || 0;
        return bLast - aLast;
      });
    } else {
      result = result.sort((a, b) => a.name.localeCompare(b.name));
    }

    return result;
  }, [clients, searchQuery, sortBy, clientStats]);

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
    await createClient.mutateAsync({ ...formData, report_format_id: formData.report_format_id || null });
    setIsDialogOpen(false);
    setFormData({ name: '', account_id: '', report_format_id: '', is_active: true });
  };

  const resetForm = () => {
    setFormData({ name: '', account_id: '', report_format_id: '', is_active: true });
  };

  return (
    <Layout>
      <PageHeader title="Meus Clientes" description="Gerencie seus clientes Meta Ads">
        <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              Novo Cliente
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Novo Cliente</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Nome do Cliente</Label>
                <Input 
                  value={formData.name} 
                  onChange={e => setFormData({...formData, name: e.target.value})} 
                  placeholder="Ex: Empresa ABC"
                  required 
                />
              </div>
              <div className="space-y-2">
                <Label>Account ID do Meta Ads</Label>
                <Input 
                  value={formData.account_id} 
                  onChange={e => setFormData({...formData, account_id: e.target.value})} 
                  placeholder="123456789" 
                  required 
                />
                <p className="text-xs text-muted-foreground">Apenas números, sem o prefixo "act_"</p>
              </div>
              <div className="space-y-2">
                <Label>Formato de Relatório</Label>
                <Select value={formData.report_format_id} onValueChange={v => setFormData({...formData, report_format_id: v})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um formato" />
                  </SelectTrigger>
                  <SelectContent>
                    {formats.map(f => (
                      <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Switch 
                  checked={formData.is_active} 
                  onCheckedChange={v => setFormData({...formData, is_active: v})} 
                />
                <Label>Cliente Ativo</Label>
              </div>
              <Button type="submit" className="w-full" disabled={createClient.isPending}>
                {createClient.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Salvar
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </PageHeader>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar cliente..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={sortBy} onValueChange={(v: 'name' | 'recent') => setSortBy(v)}>
          <SelectTrigger className="w-full sm:w-[220px]">
            <SlidersHorizontal className="w-4 h-4 mr-2" />
            <SelectValue placeholder="Ordenar por" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="recent">Último relatório criado</SelectItem>
            <SelectItem value="name">Nome (A-Z)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Clients Grid */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : filteredClients.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center py-12">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <Users className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="font-semibold text-lg mb-2">
              {searchQuery ? 'Nenhum cliente encontrado' : 'Nenhum cliente cadastrado'}
            </h3>
            <p className="text-muted-foreground text-center mb-4 max-w-sm">
              {searchQuery 
                ? 'Tente buscar por outro termo ou crie um novo cliente.'
                : 'Adicione seu primeiro cliente para começar a gerar relatórios do Meta Ads.'}
            </p>
            {!searchQuery && (
              <Button onClick={() => setIsDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Adicionar Cliente
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredClients.map(client => (
            <ClientCard
              key={client.id}
              client={client}
              reportCount={clientStats[client.id]?.count || 0}
              lastReportAt={clientStats[client.id]?.lastAt || null}
              onClick={() => navigate(`/clients/${client.id}`)}
            />
          ))}
        </div>
      )}
    </Layout>
  );
}
