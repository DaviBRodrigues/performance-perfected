export interface Client {
  id: string;
  user_id: string;
  name: string;
  account_id: string;
  report_format_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  report_format?: ReportFormat;
}

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

export interface Metric {
  key: string;
  label: string;
}

export interface ReportFormat {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  api_fields: string[];
  metrics: Metric[];
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface Settings {
  id: string;
  user_id: string;
  access_token: string | null;
  api_version: string;
  created_at: string;
  updated_at: string;
}

export interface Report {
  id: string;
  user_id: string;
  client_id: string;
  report_format_id: string | null;
  title: string;
  start_date: string;
  end_date: string;
  data: ReportData;
  status: 'pending' | 'processing' | 'completed' | 'error';
  platform?: Platform;
  created_at: string;
  client?: Client;
  report_format?: ReportFormat;
}

export interface ReportData {
  reach?: number;
  impressions?: number;
  link_clicks?: number;
  ctr_link_click?: number;
  messages_started?: number;
  cost_per_message?: number;
  conversions?: number;
  cost_per_conversion?: number;
  purchases?: number;
  cart_additions?: number;
  checkouts_initiated?: number;
  instagram_visits?: number;
  total_spend?: number;
  best_ad?: string | Record<string, string>;
  best_ad_scope?: 'all' | 'by_campaign' | 'by_objective';
  campaigns?: CampaignData[];
}

export interface CampaignData {
  name: string;
  objective?: string;
  reach?: number;
  impressions?: number;
  spend?: number;
  link_clicks?: number;
  ctr?: number;
  messages_started?: number;
  cost_per_message?: number;
  conversions?: number;
  purchases?: number;
  cost_per_purchase?: number;
  best_ad?: string;
}

export const PLATFORMS = {
  meta_ads: {
    id: 'meta_ads' as Platform,
    name: 'Meta Ads',
    icon: 'meta',
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
  },
  google_ads: {
    id: 'google_ads' as Platform,
    name: 'Google Ads',
    icon: 'google',
    color: 'text-red-500',
    bgColor: 'bg-red-100',
  },
} as const;

export const AVAILABLE_METRICS: Metric[] = [
  { key: 'reach', label: '👥 Alcance' },
  { key: 'impressions', label: '👁️ Impressões' },
  { key: 'link_clicks', label: '🖱️ Cliques no Link' },
  { key: 'ctr_link_click', label: '🤩 CTR (Taxa de Cliques)' },
  { key: 'messages_started', label: '💬 Mensagens Iniciadas' },
  { key: 'cost_per_message', label: '💰 Custo por Mensagem' },
  { key: 'conversions', label: '🎯 Conversões' },
  { key: 'cost_per_conversion', label: '💵 Custo por Conversão' },
  { key: 'purchases', label: '🛍️ Compras' },
  { key: 'cart_additions', label: '🛒 Adição ao Carrinho' },
  { key: 'checkouts_initiated', label: '👤 Finalização de Compra' },
  { key: 'instagram_visits', label: '📱 Visitas ao Instagram' },
  { key: 'total_spend', label: '💲 Investimento Total' },
];

export const DEFAULT_REPORT_FORMATS: Omit<ReportFormat, 'id' | 'user_id' | 'created_at' | 'updated_at'>[] = [
  {
    name: 'Mensagens',
    description: 'Formato focado em campanhas de mensagens com métricas de engajamento',
    api_fields: ['campaign_name', 'impressions', 'spend', 'actions'],
    metrics: [
      { key: 'reach', label: '👥 Alcance:' },
      { key: 'impressions', label: '👁️ Impressões:' },
      { key: 'ctr_link_click', label: '🤩 CTR (Taxa de Cliques no Link):' },
      { key: 'messages_started', label: '💬 Mensagens por Conversa Iniciada:' },
      { key: 'cost_per_message', label: '💰 Custo por Mensagem:' },
      { key: 'total_spend', label: '💲 Investimento Total:' },
    ],
    is_default: true,
  },
  {
    name: 'Conversões',
    description: 'Formato de conversões com métricas de mensagens e custo por conversão',
    api_fields: ['campaign_name', 'impressions', 'spend', 'actions'],
    metrics: [
      { key: 'reach', label: '👥 Alcance:' },
      { key: 'impressions', label: '👁️ Impressões:' },
      { key: 'ctr_link_click', label: '🤩 CTR (Taxa de Cliques no Link):' },
      { key: 'messages_started', label: '💬 Mensagens por Conversa Iniciada:' },
      { key: 'cost_per_message', label: '💰 Custo por Mensagem:' },
      { key: 'conversions', label: '🎯 Conversões:' },
      { key: 'cost_per_conversion', label: '💰 Custo por Conversão:' },
      { key: 'total_spend', label: '💲 Investimento Total:' },
    ],
    is_default: false,
  },
  {
    name: 'E-commerce',
    description: 'Formato para comércio eletrônico com métricas de compras e carrinho',
    api_fields: ['campaign_name', 'impressions', 'spend', 'actions'],
    metrics: [
      { key: 'reach', label: '👥 Alcance:' },
      { key: 'purchases', label: '🛍️ Compras:' },
      { key: 'cart_additions', label: '🛒 Adição ao Carrinho:' },
      { key: 'checkouts_initiated', label: '👤 Finalização de compra:' },
      { key: 'link_clicks', label: '🖱️ Cliques no link:' },
      { key: 'ctr_link_click', label: '🤩 CTR (Taxa de Atratividade):' },
      { key: 'instagram_visits', label: '📱 Visitas ao Instagram:' },
      { key: 'total_spend', label: '💵 Investimento:' },
    ],
    is_default: false,
  },
  {
    name: 'Alcance',
    description: 'Formato focado em alcance, impressões e engajamento',
    api_fields: ['campaign_name', 'impressions', 'spend', 'actions'],
    metrics: [
      { key: 'reach', label: '👥 Alcance:' },
      { key: 'impressions', label: '👁️ Impressões:' },
      { key: 'ctr_link_click', label: '🤩 CTR (Taxa de Cliques no Link):' },
      { key: 'link_clicks', label: '🖱️ Cliques no link:' },
      { key: 'instagram_visits', label: '📱 Visitas ao Instagram:' },
      { key: 'total_spend', label: '💲 Investimento Total:' },
    ],
    is_default: false,
  },
];
