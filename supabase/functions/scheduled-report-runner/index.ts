import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const API_VERSION = 'v23.0';
const URL_BASE = `https://graph.facebook.com/${API_VERSION}`;

// Get the previous week's Monday and Sunday
function getPreviousWeekRange(timezone: string): { startDate: string; endDate: string } {
  const now = new Date();
  
  // Get current day of week (0 = Sunday, 1 = Monday, etc.)
  const currentDay = now.getDay();
  
  // Calculate days to go back to reach last Monday
  // If today is Sunday (0), go back 6 days. If Monday (1), go back 7 days, etc.
  const daysToLastMonday = currentDay === 0 ? 6 : currentDay + 6;
  
  const lastMonday = new Date(now);
  lastMonday.setDate(now.getDate() - daysToLastMonday);
  lastMonday.setHours(0, 0, 0, 0);
  
  const lastSunday = new Date(lastMonday);
  lastSunday.setDate(lastMonday.getDate() + 6);
  lastSunday.setHours(23, 59, 59, 999);
  
  const formatDate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  
  return {
    startDate: formatDate(lastMonday),
    endDate: formatDate(lastSunday),
  };
}

// Check if current time matches the scheduled time
function shouldRunNow(scheduledTime: string, dayOfWeek: number, timezone: string): boolean {
  const now = new Date();
  
  // Get current day of week (0 = Sunday, 6 = Saturday)
  const currentDay = now.getDay();
  if (currentDay !== dayOfWeek) return false;
  
  // Parse scheduled time (HH:MM)
  const [scheduledHour, scheduledMinute] = scheduledTime.split(':').map(Number);
  const currentHour = now.getUTCHours();
  const currentMinute = now.getUTCMinutes();
  
  // Allow a 5-minute window for execution
  const scheduledTotalMinutes = scheduledHour * 60 + scheduledMinute;
  const currentTotalMinutes = currentHour * 60 + currentMinute;
  
  return Math.abs(currentTotalMinutes - scheduledTotalMinutes) <= 5;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log('Scheduled report runner started');

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch all active scheduled reports
    const { data: scheduledReports, error: scheduledError } = await supabase
      .from('scheduled_reports')
      .select(`
        *,
        client:clients(*)
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
        const shouldRun = shouldRunNow(runTimeStr, schedule.day_of_week, schedule.timezone);

        if (!shouldRun) {
          console.log(`Skipping schedule ${schedule.id} - not time yet (day: ${schedule.day_of_week}, time: ${runTimeStr})`);
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

        // Fetch Meta Ads data
        const insightsFields = [
          'campaign_name', 'reach', 'impressions', 'spend', 'actions', 
          'cost_per_action_type', 'clicks', 'ctr'
        ].join(',');

        const insightsUrl = `${URL_BASE}/${formattedAccountId}/insights?level=campaign&fields=${insightsFields}&time_range=${timeRangeEncoded}&access_token=${accessToken}`;
        
        console.log('Fetching campaign insights...');
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
        const accountReachUrl = `${URL_BASE}/${formattedAccountId}/insights?level=account&fields=reach&time_range=${timeRangeEncoded}&access_token=${accessToken}`;
        const accountReachResponse = await fetch(accountReachUrl);
        const accountReachData = await accountReachResponse.json();

        // Get best ad
        const adsFields = ['ad_name', 'campaign_name', 'spend', 'impressions', 'actions', 'reach'].join(',');
        const adsUrl = `${URL_BASE}/${formattedAccountId}/insights?level=ad&fields=${adsFields}&time_range=${timeRangeEncoded}&limit=100&access_token=${accessToken}`;
        const adsResponse = await fetch(adsUrl);
        const adsData = await adsResponse.json();

        // Process data
        let totalReach = 0;
        let totalImpressions = 0;
        let totalSpend = 0;
        let totalLinkClicks = 0;
        let totalMessagesStarted = 0;
        let totalInstagramVisits = 0;

        if (insightsData.data && insightsData.data.length > 0) {
          insightsData.data.forEach((campaign: any) => {
            totalImpressions += parseInt(campaign.impressions || '0');
            totalSpend += parseFloat(campaign.spend || '0');

            if (campaign.actions) {
              campaign.actions.forEach((action: any) => {
                const actionType = action.action_type;
                const actionValue = parseInt(action.value || '0');

                if (actionType === 'link_click') {
                  totalLinkClicks += actionValue;
                }
                if (actionType.includes('messaging_conversation_started')) {
                  totalMessagesStarted += actionValue;
                }
                if (actionType === 'instagram_profile_visit') {
                  totalInstagramVisits += actionValue;
                }
              });
            }
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

        // Build payload
        const payload = {
          cliente: client.name,
          account_id: client.account_id,
          periodo: {
            inicio: startDate,
            fim: endDate,
          },
          metricas: {
            alcance: totalReach || null,
            cliques_no_link: totalLinkClicks || null,
            mensagens_iniciadas: totalMessagesStarted || null,
            custo_por_mensagem: costPerMessage ? parseFloat(costPerMessage.toFixed(2)) : null,
            visitas_instagram: totalInstagramVisits || null,
            investimento_total: totalSpend ? parseFloat(totalSpend.toFixed(2)) : null,
          },
          melhor_anuncio: bestAd,
          gerado_em: new Date().toISOString(),
        };

        // Generate WhatsApp text
        const formatDate = (dateStr: string) => {
          const date = new Date(dateStr);
          return date.toLocaleDateString('pt-BR');
        };

        let whatsappText = `📊 *RELATÓRIO SEMANAL - ${client.name.toUpperCase()}*\n`;
        whatsappText += `📅 Período: ${formatDate(startDate)} a ${formatDate(endDate)}\n\n`;
        whatsappText += `━━━━━━━━━━━━━━━━━━━━\n\n`;
        
        if (totalReach) whatsappText += `👥 Alcance: ${totalReach.toLocaleString('pt-BR')}\n`;
        if (totalLinkClicks) whatsappText += `🔗 Cliques no Link: ${totalLinkClicks.toLocaleString('pt-BR')}\n`;
        if (totalMessagesStarted) whatsappText += `💬 Mensagens Iniciadas: ${totalMessagesStarted}\n`;
        if (costPerMessage) whatsappText += `💰 Custo por Mensagem: R$ ${costPerMessage.toFixed(2)}\n`;
        if (totalInstagramVisits) whatsappText += `📱 Visitas ao Instagram: ${totalInstagramVisits}\n`;
        if (totalSpend) whatsappText += `💲 Investimento Total: R$ ${totalSpend.toFixed(2)}\n`;
        if (bestAd) whatsappText += `\n⭐ *Melhor Anúncio:* ${bestAd}\n`;

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
