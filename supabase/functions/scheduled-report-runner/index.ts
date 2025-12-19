import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const API_VERSION = 'v23.0';
const URL_BASE = `https://graph.facebook.com/${API_VERSION}`;

// Timezone helpers (use schedule.timezone, e.g. America/Sao_Paulo)
const WEEKDAY_MAP: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

function getNowPartsInTimeZone(timezone: string) {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now);

  const get = (type: string) => parts.find((p) => p.type === type)?.value;

  const weekdayLabel = get('weekday') || 'Sun';
  const weekday = WEEKDAY_MAP[weekdayLabel] ?? 0;

  return {
    weekday,
    year: Number(get('year')),
    month: Number(get('month')),
    day: Number(get('day')),
    hour: Number(get('hour')),
    minute: Number(get('minute')),
  };
}

// Get the previous week's Monday and Sunday (based on the provided timezone)
function getPreviousWeekRange(timezone: string): { startDate: string; endDate: string } {
  const nowParts = getNowPartsInTimeZone(timezone);

  // Anchor at 12:00 UTC of the timezone's "today" date to avoid DST edge cases.
  const anchor = new Date(Date.UTC(nowParts.year, nowParts.month - 1, nowParts.day, 12, 0, 0));

  // nowParts.weekday uses 0=Sun..6=Sat (same as JS Date.getDay)
  const daysToLastMonday = nowParts.weekday === 0 ? 6 : nowParts.weekday + 6;

  const lastMonday = new Date(anchor);
  lastMonday.setUTCDate(anchor.getUTCDate() - daysToLastMonday);

  const lastSunday = new Date(lastMonday);
  lastSunday.setUTCDate(lastMonday.getUTCDate() + 6);

  const formatUtcDate = (date: Date) => {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  return {
    startDate: formatUtcDate(lastMonday),
    endDate: formatUtcDate(lastSunday),
  };
}

function wasRecentlyRun(lastRunAt: string | null, minutes: number): boolean {
  if (!lastRunAt) return false;
  const diffMinutes = (Date.now() - new Date(lastRunAt).getTime()) / 1000 / 60;
  return diffMinutes >= 0 && diffMinutes < minutes;
}

// Check if current time matches the scheduled time (in the provided timezone)
function shouldRunNow(scheduledTime: string, dayOfWeek: number, timezone: string): boolean {
  const nowParts = getNowPartsInTimeZone(timezone);

  // Day-of-week check in the schedule timezone
  if (nowParts.weekday !== dayOfWeek) return false;

  // Parse scheduled time (HH:MM or HH:MM:SS)
  const [scheduledHourStr, scheduledMinuteStr] = String(scheduledTime).split(':');
  const scheduledHour = Number(scheduledHourStr || 0);
  const scheduledMinute = Number(scheduledMinuteStr || 0);

  // Allow a 5-minute window for execution
  const scheduledTotalMinutes = scheduledHour * 60 + scheduledMinute;
  const currentTotalMinutes = nowParts.hour * 60 + nowParts.minute;

  return Math.abs(currentTotalMinutes - scheduledTotalMinutes) <= 5;
}

// Format metric value for display
function formatMetricValue(key: string, value: number | string | undefined): string {
  if (value === undefined || value === null) return '-';
  if (typeof value === 'string') return value;
  
  switch (key) {
    case 'total_spend':
    case 'cost_per_message':
    case 'cost_per_conversion':
      return `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
    case 'ctr_link_click':
      return `${value.toFixed(2)}%`;
    case 'reach':
    case 'impressions':
    case 'link_clicks':
    case 'messages_started':
    case 'conversions':
    case 'purchases':
    case 'cart_additions':
    case 'checkouts_initiated':
    case 'instagram_visits':
      return value.toLocaleString('pt-BR');
    default:
      return String(value);
  }
}

// Default metrics to show if no format is selected
const DEFAULT_METRICS = [
  { key: 'reach', label: '👥 Alcance' },
  { key: 'impressions', label: '👁️ Impressões' },
  { key: 'link_clicks', label: '🔗 Cliques no Link' },
  { key: 'messages_started', label: '💬 Mensagens Iniciadas' },
  { key: 'cost_per_message', label: '💰 Custo por Mensagem' },
  { key: 'instagram_visits', label: '📱 Visitas ao Instagram' },
  { key: 'total_spend', label: '💲 Investimento Total' },
];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log('Scheduled report runner started');

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch all active scheduled reports with client and report_format
    const { data: scheduledReports, error: scheduledError } = await supabase
      .from('scheduled_reports')
      .select(`
        *,
        client:clients(*),
        report_format:report_formats(*)
      `)
      .eq('is_active', true);

    if (scheduledError) {
      console.error('Error fetching scheduled reports:', scheduledError);
      return new Response(JSON.stringify({ error: scheduledError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Found ${scheduledReports?.length || 0} active scheduled reports`);

    const results: any[] = [];

    for (const schedule of scheduledReports || []) {
      try {
        const runTimeStr = schedule.run_time as string;

        if (wasRecentlyRun(schedule.last_run_at, 30)) {
          console.log(`Skipping schedule ${schedule.id} - already ran recently (${schedule.last_run_at})`);
          continue;
        }

        const shouldRun = shouldRunNow(runTimeStr, schedule.day_of_week, schedule.timezone);

        if (!shouldRun) {
          console.log(
            `Skipping schedule ${schedule.id} - not time yet (tz: ${schedule.timezone}, day: ${schedule.day_of_week}, time: ${runTimeStr})`
          );
          continue;
        }

        console.log(`Running scheduled report for client: ${schedule.client?.name}`);

        const client = schedule.client;
        if (!client) {
          console.error(`Client not found for schedule ${schedule.id}`);
          continue;
        }

        // Get user's access token
        const { data: settings, error: settingsError } = await supabase
          .from('settings')
          .select('access_token')
          .eq('user_id', schedule.user_id)
          .single();

        if (settingsError || !settings?.access_token) {
          console.error(`No access token for user ${schedule.user_id}`);
          results.push({ 
            schedule_id: schedule.id, 
            client_name: client.name, 
            status: 'error', 
            error: 'Access token not configured' 
          });
          continue;
        }

        const accessToken = settings.access_token;
        const { startDate, endDate } = getPreviousWeekRange(schedule.timezone);
        const formattedAccountId = client.account_id.startsWith('act_') 
          ? client.account_id 
          : `act_${client.account_id}`;

        console.log(`Fetching data for account ${formattedAccountId} from ${startDate} to ${endDate}`);

        // Build time range
        const timeRange = JSON.stringify({ since: startDate, until: endDate });
        const timeRangeEncoded = encodeURIComponent(timeRange);

        // Fetch Meta Ads data - same fields as meta-ads-report
        console.log('Fetching campaign insights...');
        const insightsFields = [
          'campaign_name', 'reach', 'impressions', 'spend', 'actions', 
          'cost_per_action_type', 'clicks', 'ctr'
        ].join(',');

        const insightsUrl = `${URL_BASE}/${formattedAccountId}/insights?level=campaign&fields=${insightsFields}&time_range=${timeRangeEncoded}&access_token=${accessToken}`;
        const insightsResponse = await fetch(insightsUrl);
        const insightsData = await insightsResponse.json();

        if (insightsData.error) {
          console.error('Meta API error:', insightsData.error);
          results.push({ 
            schedule_id: schedule.id, 
            client_name: client.name, 
            status: 'error', 
            error: insightsData.error.message 
          });
          continue;
        }

        // Get account-level reach
        console.log('Fetching account reach...');
        const accountReachUrl = `${URL_BASE}/${formattedAccountId}/insights?level=account&fields=reach&time_range=${timeRangeEncoded}&access_token=${accessToken}`;
        const accountReachResponse = await fetch(accountReachUrl);
        const accountReachData = await accountReachResponse.json();

        // Get campaigns objectives
        console.log('Fetching campaigns objectives...');
        const campaignsUrl = `${URL_BASE}/${formattedAccountId}/campaigns?fields=id,name,objective&limit=100&access_token=${accessToken}`;
        const campaignsResponse = await fetch(campaignsUrl);
        const campaignsData = await campaignsResponse.json();

        // Build campaign objectives map
        const campaignObjectives: Record<string, string> = {};
        if (campaignsData.data) {
          campaignsData.data.forEach((campaign: any) => {
            campaignObjectives[campaign.name] = campaign.objective;
          });
        }

        // Get best ad
        console.log('Fetching ads data...');
        const adsFields = ['ad_name', 'campaign_name', 'spend', 'impressions', 'actions', 'reach'].join(',');
        const adsUrl = `${URL_BASE}/${formattedAccountId}/insights?level=ad&fields=${adsFields}&time_range=${timeRangeEncoded}&limit=100&access_token=${accessToken}`;
        const adsResponse = await fetch(adsUrl);
        const adsData = await adsResponse.json();

        // Process data - same logic as meta-ads-report
        let totalReach = 0;
        let totalImpressions = 0;
        let totalSpend = 0;
        let totalLinkClicks = 0;
        let totalMessagesStarted = 0;
        let totalInstagramVisits = 0;
        let totalConversions = 0;
        let totalPurchases = 0;
        let totalCartAdditions = 0;
        let totalCheckoutsInitiated = 0;

        const campaigns: any[] = [];

        if (insightsData.data && insightsData.data.length > 0) {
          insightsData.data.forEach((campaign: any) => {
            const campaignData: any = {
              name: campaign.campaign_name,
              objective: campaignObjectives[campaign.campaign_name] || 'UNKNOWN',
              reach: parseInt(campaign.reach || '0'),
              impressions: parseInt(campaign.impressions || '0'),
              spend: parseFloat(campaign.spend || '0'),
              link_clicks: 0,
              ctr: parseFloat(campaign.ctr || '0'),
              messages_started: 0,
              cost_per_message: null,
              conversions: 0,
              purchases: 0,
              cost_per_purchase: null,
            };

            totalImpressions += campaignData.impressions;
            totalSpend += campaignData.spend;

            if (campaign.actions) {
              campaign.actions.forEach((action: any) => {
                const actionType = action.action_type;
                const actionValue = parseInt(action.value || '0');

                if (actionType === 'link_click') {
                  campaignData.link_clicks += actionValue;
                  totalLinkClicks += actionValue;
                }
                if (actionType.includes('messaging_conversation_started') || actionType === 'onsite_conversion.messaging_conversation_started_7d') {
                  campaignData.messages_started += actionValue;
                  totalMessagesStarted += actionValue;
                }
                if (actionType === 'instagram_profile_visit') {
                  totalInstagramVisits += actionValue;
                }
                if (actionType === 'purchase' || actionType === 'omni_purchase') {
                  campaignData.purchases += actionValue;
                  totalPurchases += actionValue;
                }
                if (actionType === 'add_to_cart' || actionType === 'omni_add_to_cart') {
                  totalCartAdditions += actionValue;
                }
                if (actionType === 'initiate_checkout' || actionType === 'omni_initiated_checkout') {
                  totalCheckoutsInitiated += actionValue;
                }
                if (actionType === 'lead' || actionType === 'onsite_conversion.lead_grouped') {
                  campaignData.conversions += actionValue;
                  totalConversions += actionValue;
                }
              });
            }

            // Calculate cost per action
            if (campaignData.messages_started > 0) {
              campaignData.cost_per_message = campaignData.spend / campaignData.messages_started;
            }
            if (campaignData.purchases > 0) {
              campaignData.cost_per_purchase = campaignData.spend / campaignData.purchases;
            }

            campaigns.push(campaignData);
          });
        }

        if (accountReachData.data && accountReachData.data.length > 0) {
          totalReach = parseInt(accountReachData.data[0].reach || '0');
        }

        // Find best ad
        let bestAd: string | null = null;
        if (adsData.data && adsData.data.length > 0) {
          let highestValue = -1;
          adsData.data.forEach((ad: any) => {
            let value = 0;
            if (ad.actions) {
              ad.actions.forEach((action: any) => {
                if (action.action_type === 'link_click') {
                  value += parseInt(action.value || '0');
                }
                if (action.action_type.includes('messaging_conversation_started')) {
                  value += parseInt(action.value || '0') * 2;
                }
              });
            }
            if (value > highestValue) {
              highestValue = value;
              bestAd = ad.ad_name;
            }
          });
        }

        const costPerMessage = totalMessagesStarted > 0 ? totalSpend / totalMessagesStarted : null;
        const costPerConversion = totalConversions > 0 ? totalSpend / totalConversions : null;
        const ctrLinkClick = totalImpressions > 0 ? (totalLinkClicks / totalImpressions) * 100 : 0;

        // Build report data (same structure as meta-ads-report)
        const reportData: Record<string, any> = {
          reach: totalReach || null,
          impressions: totalImpressions || null,
          link_clicks: totalLinkClicks || null,
          ctr_link_click: ctrLinkClick || null,
          messages_started: totalMessagesStarted || null,
          cost_per_message: costPerMessage ? parseFloat(costPerMessage.toFixed(2)) : null,
          conversions: totalConversions || null,
          cost_per_conversion: costPerConversion ? parseFloat(costPerConversion.toFixed(2)) : null,
          purchases: totalPurchases || null,
          cart_additions: totalCartAdditions || null,
          checkouts_initiated: totalCheckoutsInitiated || null,
          instagram_visits: totalInstagramVisits || null,
          total_spend: totalSpend ? parseFloat(totalSpend.toFixed(2)) : null,
          best_ad: bestAd,
          campaigns: campaigns,
        };

        console.log('Report data generated successfully');

        // Get metrics from report format or use defaults
        const metricsToShow = schedule.report_format?.metrics || DEFAULT_METRICS;

        // Generate WhatsApp text using format metrics (like copyReportText does)
        const formatDatePt = (dateStr: string) => {
          const [year, month, day] = dateStr.split('-');
          return `${day}/${month}/${year}`;
        };

        let whatsappText = `📊 *RELATÓRIO SEMANAL - ${client.name.toUpperCase()}*\n`;
        whatsappText += `📅 Período: ${formatDatePt(startDate)} a ${formatDatePt(endDate)}\n`;
        whatsappText += `👤 Cliente: ${client.name}\n\n`;
        whatsappText += `━━━━━━━━━━━━━━━━━━━━\n\n`;

        // Add metrics based on format
        metricsToShow.forEach((metric: any) => {
          const value = reportData[metric.key];
          if (value !== undefined && value !== null) {
            whatsappText += `${metric.label} ${formatMetricValue(metric.key, value)}\n`;
          }
        });

        // Add best ad
        if (reportData.best_ad) {
          whatsappText += `\n⭐ *Melhor Anúncio:* ${reportData.best_ad}\n`;
        }

        // Add campaigns section
        if (campaigns.length > 0) {
          whatsappText += `\n━━━━━━━━━━━━━━━━━━━━\n`;
          whatsappText += `📈 *CAMPANHAS*\n\n`;

          campaigns.forEach((campaign, idx) => {
            whatsappText += `*${idx + 1}. ${campaign.name}*\n`;
            if (campaign.reach) whatsappText += `   Alcance: ${campaign.reach.toLocaleString('pt-BR')}\n`;
            if (campaign.impressions) whatsappText += `   Impressões: ${campaign.impressions.toLocaleString('pt-BR')}\n`;
            if (campaign.spend) whatsappText += `   Investimento: R$ ${campaign.spend.toFixed(2)}\n`;
            if (campaign.link_clicks) whatsappText += `   Cliques: ${campaign.link_clicks.toLocaleString('pt-BR')}\n`;
            if (campaign.ctr && campaign.ctr > 0) whatsappText += `   CTR: ${campaign.ctr.toFixed(2)}%\n`;
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
          cliente: client.name,
          account_id: client.account_id,
          periodo: {
            inicio: startDate,
            fim: endDate,
          },
          metricas: reportData,
          format_name: schedule.report_format?.name || 'Padrão',
          gerado_em: new Date().toISOString(),
        };

        // Send to webhook
        console.log(`Sending report to webhook: ${schedule.webhook_url}`);
        try {
          await fetch(schedule.webhook_url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              payload,
              whatsapp_text: whatsappText,
            }),
          });
          console.log('Webhook sent successfully');
        } catch (webhookError) {
          console.error('Webhook error:', webhookError);
        }

        // Update last_run_at
        await supabase
          .from('scheduled_reports')
          .update({ last_run_at: new Date().toISOString() })
          .eq('id', schedule.id);

        results.push({ 
          schedule_id: schedule.id, 
          client_name: client.name, 
          status: 'success' 
        });

      } catch (scheduleError: any) {
        console.error(`Error processing schedule ${schedule.id}:`, scheduleError);
        results.push({ 
          schedule_id: schedule.id, 
          client_name: schedule.client?.name, 
          status: 'error', 
          error: scheduleError.message 
        });
      }
    }

    console.log('Scheduled report runner completed', results);

    return new Response(JSON.stringify({ 
      message: 'Scheduled report runner completed',
      results 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Error in scheduled-report-runner:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
