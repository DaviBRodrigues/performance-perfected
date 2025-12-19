import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Layout, PageHeader } from '@/components/layout/Layout';
import { useAuth } from '@/contexts/AuthContext';
import { useSettings } from '@/hooks/useSettings';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, Key, CheckCircle, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function Settings() {
  const { user, loading: authLoading } = useAuth();
  const { settings, isLoading, saveSettings, hasAccessToken } = useSettings();
  const [accessToken, setAccessToken] = useState('');
  const [apiVersion, setApiVersion] = useState('v23.0');
  const [showToken, setShowToken] = useState(false);

  if (authLoading || isLoading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  if (!user) return <Navigate to="/auth" replace />;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await saveSettings.mutateAsync({ access_token: accessToken || settings?.access_token, api_version: apiVersion });
    setAccessToken('');
  };

  return (
    <Layout>
      <PageHeader title="Configurações" description="Configure suas credenciais Meta Ads" />

      <div className="max-w-2xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Key className="w-5 h-5" />Credenciais Meta Ads</CardTitle>
            <CardDescription>Configure seu Access Token para conectar com a API do Meta Ads</CardDescription>
          </CardHeader>
          <CardContent>
            {hasAccessToken ? (
              <Alert className="mb-4 bg-success/10 border-success/20"><CheckCircle className="w-4 h-4 text-success" /><AlertDescription className="text-success">Access Token configurado com sucesso!</AlertDescription></Alert>
            ) : (
              <Alert className="mb-4"><AlertCircle className="w-4 h-4" /><AlertDescription>Você precisa configurar seu Access Token para usar o sistema.</AlertDescription></Alert>
            )}

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <Label>Access Token {hasAccessToken && '(deixe vazio para manter o atual)'}</Label>
                <Input type={showToken ? 'text' : 'password'} value={accessToken} onChange={e => setAccessToken(e.target.value)} placeholder={hasAccessToken ? '••••••••••••••••' : 'Cole seu Access Token aqui'} />
                <button type="button" className="text-sm text-primary mt-1" onClick={() => setShowToken(!showToken)}>{showToken ? 'Ocultar' : 'Mostrar'} token</button>
              </div>
              <div>
                <Label>Versão da API</Label>
                <Input value={apiVersion} onChange={e => setApiVersion(e.target.value)} placeholder="v23.0" />
              </div>
              <Button type="submit" disabled={saveSettings.isPending}>{saveSettings.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Salvar Configurações</Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Como obter o Access Token</CardTitle></CardHeader>
          <CardContent className="prose prose-sm max-w-none text-muted-foreground">
            <ol className="list-decimal pl-4 space-y-2">
              <li>Acesse o <a href="https://developers.facebook.com/tools/explorer/" target="_blank" rel="noopener" className="text-primary">Graph API Explorer</a></li>
              <li>Selecione seu aplicativo Meta</li>
              <li>Adicione as permissões: <code className="bg-muted px-1 rounded">ads_read</code>, <code className="bg-muted px-1 rounded">ads_management</code></li>
              <li>Clique em "Generate Access Token"</li>
              <li>Copie o token gerado e cole acima</li>
            </ol>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
