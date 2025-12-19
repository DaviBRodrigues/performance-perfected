import { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { Layout, PageHeader, StatCard } from '@/components/layout/Layout';
import { useAuth } from '@/contexts/AuthContext';
import { useClients } from '@/hooks/useClients';
import { useReports } from '@/hooks/useReports';
import { useReportFormats } from '@/hooks/useReportFormats';
import { Users, FileText, BarChart3, TrendingUp, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

export default function Dashboard() {
  const { user, loading: authLoading } = useAuth();
  const { clients, isLoading: clientsLoading } = useClients();
  const { reports, isLoading: reportsLoading } = useReports();
  const { formats, initializeDefaultFormats } = useReportFormats();

  useEffect(() => {
    if (user && formats.length === 0) {
      initializeDefaultFormats.mutate();
    }
  }, [user, formats.length]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  const activeClients = clients.filter(c => c.is_active).length;
  const totalReports = reports.length;
  const recentReports = reports.slice(0, 5);

  return (
    <Layout>
      <PageHeader 
        title="Dashboard" 
        description="Visão geral do seu sistema de relatórios Meta Ads"
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          title="Clientes Ativos"
          value={activeClients}
          icon={<Users className="w-6 h-6" />}
        />
        <StatCard
          title="Total de Clientes"
          value={clients.length}
          icon={<Users className="w-6 h-6" />}
        />
        <StatCard
          title="Relatórios Gerados"
          value={totalReports}
          icon={<BarChart3 className="w-6 h-6" />}
        />
        <StatCard
          title="Formatos Disponíveis"
          value={formats.length}
          icon={<FileText className="w-6 h-6" />}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="animate-slide-up">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="font-display">Clientes Recentes</CardTitle>
            <Link to="/clients">
              <Button variant="outline" size="sm">Ver Todos</Button>
            </Link>
          </CardHeader>
          <CardContent>
            {clientsLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : clients.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Nenhum cliente cadastrado</p>
                <Link to="/clients">
                  <Button className="mt-4" size="sm">Adicionar Cliente</Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {clients.slice(0, 5).map(client => (
                  <div key={client.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div>
                      <p className="font-medium">{client.name}</p>
                      <p className="text-sm text-muted-foreground">ID: {client.account_id}</p>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${client.is_active ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}`}>
                      {client.is_active ? 'Ativo' : 'Inativo'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="animate-slide-up" style={{ animationDelay: '0.1s' }}>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="font-display">Relatórios Recentes</CardTitle>
            <Link to="/reports">
              <Button variant="outline" size="sm">Ver Todos</Button>
            </Link>
          </CardHeader>
          <CardContent>
            {reportsLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : recentReports.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <BarChart3 className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Nenhum relatório gerado</p>
                <Link to="/reports">
                  <Button className="mt-4" size="sm">Gerar Relatório</Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {recentReports.map(report => (
                  <div key={report.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div>
                      <p className="font-medium">{report.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(report.created_at).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      report.status === 'completed' ? 'bg-success/10 text-success' : 
                      report.status === 'error' ? 'bg-destructive/10 text-destructive' : 
                      'bg-warning/10 text-warning'
                    }`}>
                      {report.status === 'completed' ? 'Concluído' : report.status === 'error' ? 'Erro' : 'Pendente'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
