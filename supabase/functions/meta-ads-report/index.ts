import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const API_VERSION = 'v23.0';
const URL_BASE = `https://graph.facebook.com/${API_VERSION}`;

interface MetaAdsRequest {
  accountId: string;
  startDate: string;
  endDate: string;
  userId: string;
  bestAdScope?: 'all' | 'by_campaign' | 'by_objective';
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { accountId, startDate, endDate, userId, bestAdScope = 'all' } = await req.json() as MetaAdsRequest;
    
    console.log('Meta Ads API request:', { accountId, startDate, endDate, userId, bestAdScope });

    // Get access token from settings
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: settings, error: settingsError } = await supabase
      .from('settings')
      .select('access_token, api_version')
      .eq('user_id', userId)
      .single();

    if (settingsError || !settings?.access_token) {
      console.error('Settings error:', settingsError);
      return new Response(JSON.stringify({ 
        error: 'Access Token não configurado. Configure em Configurações.' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const accessToken = settings.access_token;
    const formattedAccountId = accountId.startsWith('act_') ? accountId : `act_${accountId}`;

    // Build time range
    const timeRange = JSON.stringify({ since: startDate, until: endDate });
    const timeRangeEncoded = encodeURIComponent(timeRange);

    // Get campaign insights
    const insightsFields = [
      'campaign_name',
      'reach',
      'impressions',
      'spend',
      'actions',
      'cost_per_action_type',
      'clicks',
      'ctr'
    ].join(',');

    const insightsUrl = `${URL_BASE}/${formattedAccountId}/insights?level=campaign&fields=${insightsFields}&time_range=${timeRangeEncoded}&access_token=${accessToken}`;
    
    console.log('Fetching campaign insights...');
    const insightsResponse = await fetch(insightsUrl);
    const insightsData = await insightsResponse.json();

    if (insightsData.error) {
      console.error('Meta API error:', insightsData.error);
      return new Response(JSON.stringify({ 
        error: insightsData.error.message || 'Erro na API do Meta Ads' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get account-level reach (deduplicated)
    const accountReachUrl = `${URL_BASE}/${formattedAccountId}/insights?level=account&fields=reach&time_range=${timeRangeEncoded}&access_token=${accessToken}`;
    
    console.log('Fetching account reach...');
    const accountReachResponse = await fetch(accountReachUrl);
    const accountReachData = await accountReachResponse.json();

    // Get campaigns data with objectives
    const campaignsUrl = `${URL_BASE}/${formattedAccountId}/campaigns?fields=id,name,objective&access_token=${accessToken}`;
    console.log('Fetching campaigns objectives...');
    const campaignsResponse = await fetch(campaignsUrl);
    const campaignsData = await campaignsResponse.json();
    
    // Map campaign names to objectives
    const campaignObjectives: Record<string, string> = {};
    if (campaignsData.data) {
      campaignsData.data.forEach((c: any) => {
        campaignObjectives[c.name] = c.objective || 'UNKNOWN';
      });
    }

    // Get top performing ad
    const adsFields = ['ad_name', 'campaign_name', 'spend', 'impressions', 'actions', 'reach'].join(',');
    const adsUrl = `${URL_BASE}/${formattedAccountId}/insights?level=ad&fields=${adsFields}&time_range=${timeRangeEncoded}&limit=100&access_token=${accessToken}`;
    
    console.log('Fetching ads data...');
    const adsResponse = await fetch(adsUrl);
    const adsData = await adsResponse.json();

    // Process the data
    let totalReach = 0;
    let totalImpressions = 0;
    let totalSpend = 0;
    let totalLinkClicks = 0;
    let totalMessagesStarted = 0;
    let totalConversions = 0;
    let totalPurchases = 0;
    let totalCartAdditions = 0;
    let totalCheckoutsInitiated = 0;
    let totalInstagramVisits = 0;

    const campaigns: any[] = [];

    if (insightsData.data && insightsData.data.length > 0) {
      insightsData.data.forEach((campaign: any) => {
        const campaignReach = parseInt(campaign.reach || '0');
        const campaignImpressions = parseInt(campaign.impressions || '0');
        const campaignSpend = parseFloat(campaign.spend || '0');

        totalImpressions += campaignImpressions;
        totalSpend += campaignSpend;

        let campaignLinkClicks = 0;
        let campaignMessagesStarted = 0;
        let campaignConversions = 0;
        let campaignPurchases = 0;
        let campaignCartAdditions = 0;
        let campaignCheckoutsInitiated = 0;
        let campaignInstagramVisits = 0;

        if (campaign.actions) {
          campaign.actions.forEach((action: any) => {
            const actionType = action.action_type;
            const actionValue = parseInt(action.value || '0');

            if (actionType === 'link_click') {
              campaignLinkClicks += actionValue;
              totalLinkClicks += actionValue;
            }
            if (actionType.includes('messaging_conversation_started') || actionType === 'onsite_conversion.messaging_conversation_started_7d') {
              campaignMessagesStarted += actionValue;
              totalMessagesStarted += actionValue;
            }
            if (actionType === 'purchase' || actionType.includes('fb_pixel_purchase')) {
              campaignPurchases += actionValue;
              totalPurchases += actionValue;
            }
            if (actionType === 'add_to_cart' || actionType.includes('fb_pixel_add_to_cart')) {
              campaignCartAdditions += actionValue;
              totalCartAdditions += actionValue;
            }
            if (actionType === 'initiate_checkout' || actionType.includes('fb_pixel_initiate_checkout')) {
              campaignCheckoutsInitiated += actionValue;
              totalCheckoutsInitiated += actionValue;
            }
            if (actionType === 'instagram_profile_visit') {
              campaignInstagramVisits += actionValue;
              totalInstagramVisits += actionValue;
            }
            if (actionType === 'lead' || actionType.includes('fb_pixel_lead') || actionType === 'complete_registration') {
              campaignConversions += actionValue;
              totalConversions += actionValue;
            }
          });
        }

        const campaignName = campaign.campaign_name || 'Campanha sem nome';
        campaigns.push({
          name: campaignName,
          objective: campaignObjectives[campaignName] || 'UNKNOWN',
          reach: campaignReach,
          impressions: campaignImpressions,
          spend: campaignSpend,
          link_clicks: campaignLinkClicks,
          ctr: campaignImpressions > 0 ? (campaignLinkClicks / campaignImpressions) * 100 : 0,
          messages_started: campaignMessagesStarted,
          cost_per_message: campaignMessagesStarted > 0 ? campaignSpend / campaignMessagesStarted : 0,
          conversions: campaignConversions,
          purchases: campaignPurchases,
          cost_per_purchase: campaignPurchases > 0 ? campaignSpend / campaignPurchases : 0,
        });
      });
    }

    // Use account-level reach (deduplicated)
    if (accountReachData.data && accountReachData.data.length > 0) {
      totalReach = parseInt(accountReachData.data[0].reach || '0');
    }

    // Calculate ad performance value
    const calculateAdValue = (ad: any) => {
      let value = 0;
      if (ad.actions) {
        ad.actions.forEach((action: any) => {
          if (action.action_type === 'link_click') {
            value += parseInt(action.value || '0');
          }
          if (action.action_type.includes('messaging_conversation_started')) {
            value += parseInt(action.value || '0') * 2;
          }
          if (action.action_type === 'purchase' || action.action_type.includes('fb_pixel_purchase')) {
            value += parseInt(action.value || '0') * 5;
          }
        });
      }
      return value;
    };

    // Find best performing ads based on scope
    let bestAd = 'N/A';
    let bestAdsByCampaign: Record<string, string> = {};
    let bestAdsByObjective: Record<string, string> = {};

    if (adsData.data && adsData.data.length > 0) {
      // Best ad overall
      let highestValue = -1;
      const campaignBests: Record<string, { name: string; value: number }> = {};
      const objectiveBests: Record<string, { name: string; value: number }> = {};

      adsData.data.forEach((ad: any) => {
        const adValue = calculateAdValue(ad);
        const adName = ad.ad_name || 'Anúncio sem nome';
        const campaignName = ad.campaign_name || 'Campanha desconhecida';
        const objective = campaignObjectives[campaignName] || 'UNKNOWN';

        // Overall best
        if (adValue > highestValue) {
          highestValue = adValue;
          bestAd = adName;
        }

        // Best by campaign
        if (!campaignBests[campaignName] || adValue > campaignBests[campaignName].value) {
          campaignBests[campaignName] = { name: adName, value: adValue };
        }

        // Best by objective
        if (!objectiveBests[objective] || adValue > objectiveBests[objective].value) {
          objectiveBests[objective] = { name: adName, value: adValue };
        }
      });

      // Convert to final format
      Object.entries(campaignBests).forEach(([campaign, data]) => {
        bestAdsByCampaign[campaign] = data.name;
      });
      Object.entries(objectiveBests).forEach(([objective, data]) => {
        bestAdsByObjective[objective] = data.name;
      });
    }

    // Calculate derived metrics
    const ctrLinkClick = totalImpressions > 0 ? (totalLinkClicks / totalImpressions) * 100 : 0;
    const costPerMessage = totalMessagesStarted > 0 ? totalSpend / totalMessagesStarted : 0;
    const costPerConversion = totalConversions > 0 ? totalSpend / totalConversions : 0;

    // Choose which best ad format to return based on scope
    let bestAdResult: any = bestAd;
    if (bestAdScope === 'by_campaign') {
      bestAdResult = bestAdsByCampaign;
    } else if (bestAdScope === 'by_objective') {
      bestAdResult = bestAdsByObjective;
    }

    const reportData = {
      reach: totalReach,
      impressions: totalImpressions,
      link_clicks: totalLinkClicks,
      ctr_link_click: parseFloat(ctrLinkClick.toFixed(2)),
      messages_started: totalMessagesStarted,
      cost_per_message: parseFloat(costPerMessage.toFixed(2)),
      conversions: totalConversions,
      cost_per_conversion: parseFloat(costPerConversion.toFixed(2)),
      purchases: totalPurchases,
      cart_additions: totalCartAdditions,
      checkouts_initiated: totalCheckoutsInitiated,
      instagram_visits: totalInstagramVisits,
      total_spend: parseFloat(totalSpend.toFixed(2)),
      best_ad: bestAdResult,
      best_ad_scope: bestAdScope,
      campaigns: campaigns,
    };

    console.log('Report data generated successfully');

    // Helper functions for formatting
    const isMessageCampaign = (objective?: string) => {
      if (!objective) return false;
      return ['OUTCOME_ENGAGEMENT', 'MESSAGES'].some(o => objective.toUpperCase().includes(o));
    };

    const isEcommerceCampaign = (objective?: string) => {
      if (!objective) return false;
      return ['OUTCOME_SALES', 'CONVERSIONS', 'PRODUCT_CATALOG_SALES'].some(o => objective.toUpperCase().includes(o));
    };

    const formatObjectiveLabel = (objective: string): string => {
      const labels: Record<string, string> = {
        'OUTCOME_ENGAGEMENT': 'Engajamento',
        'OUTCOME_SALES': 'Vendas',
        'OUTCOME_LEADS': 'Leads',
        'OUTCOME_AWARENESS': 'Reconhecimento',
        'OUTCOME_TRAFFIC': 'Tráfego',
        'MESSAGES': 'Mensagens',
        'CONVERSIONS': 'Conversões',
        'LINK_CLICKS': 'Cliques no Link',
      };
      return labels[objective] || objective;
    };

    // Generate formatted WhatsApp text
    const formatDate = (dateStr: string) => {
      const date = new Date(dateStr);
      return date.toLocaleDateString('pt-BR');
    };

    let whatsappText = `📊 *RELATÓRIO SEMANAL META ADS*\n`;
    whatsappText += `📅 Período: ${formatDate(startDate)} a ${formatDate(endDate)}\n\n`;
    whatsappText += `━━━━━━━━━━━━━━━━━━━━\n\n`;
    
    // Main metrics
    whatsappText += `👥 Alcance: ${totalReach.toLocaleString('pt-BR')}\n`;
    whatsappText += `👁️ Impressões: ${totalImpressions.toLocaleString('pt-BR')}\n`;
    whatsappText += `💲 Investimento Total: R$ ${totalSpend.toFixed(2)}\n`;
    if (totalLinkClicks > 0) whatsappText += `🔗 Cliques no Link: ${totalLinkClicks.toLocaleString('pt-BR')}\n`;
    if (ctrLinkClick > 0) whatsappText += `📈 CTR: ${ctrLinkClick.toFixed(2)}%\n`;
    if (totalMessagesStarted > 0) whatsappText += `💬 Mensagens Iniciadas: ${totalMessagesStarted}\n`;
    if (costPerMessage > 0) whatsappText += `💰 Custo por Mensagem: R$ ${costPerMessage.toFixed(2)}\n`;
    if (totalConversions > 0) whatsappText += `🎯 Conversões: ${totalConversions}\n`;
    if (costPerConversion > 0) whatsappText += `💰 Custo por Conversão: R$ ${costPerConversion.toFixed(2)}\n`;
    if (totalPurchases > 0) whatsappText += `🛒 Compras: ${totalPurchases}\n`;
    if (totalCartAdditions > 0) whatsappText += `🛍️ Adições ao Carrinho: ${totalCartAdditions}\n`;
    if (totalCheckoutsInitiated > 0) whatsappText += `📦 Checkouts Iniciados: ${totalCheckoutsInitiated}\n`;
    if (totalInstagramVisits > 0) whatsappText += `📱 Visitas ao Instagram: ${totalInstagramVisits}\n`;

    // Best ads
    if (bestAdResult) {
      if (typeof bestAdResult === 'string') {
        whatsappText += `\n⭐ *Melhor Anúncio:* ${bestAdResult}\n`;
      } else {
        whatsappText += `\n⭐ *Melhores Anúncios:*\n`;
        Object.entries(bestAdResult as Record<string, string>).forEach(([key, value]) => {
          whatsappText += `• ${formatObjectiveLabel(key)}: ${value}\n`;
        });
      }
    }

    // Campaigns
    if (campaigns.length > 0) {
      whatsappText += `\n━━━━━━━━━━━━━━━━━━━━\n`;
      whatsappText += `📈 *CAMPANHAS*\n\n`;
      campaigns.forEach((campaign: any, idx: number) => {
        const isMsgCamp = isMessageCampaign(campaign.objective);
        const isEcomCamp = isEcommerceCampaign(campaign.objective);

        whatsappText += `*${idx + 1}. ${campaign.name}*\n`;
        if (campaign.reach) whatsappText += `   Alcance: ${campaign.reach.toLocaleString('pt-BR')}\n`;
        if (campaign.impressions) whatsappText += `   Impressões: ${campaign.impressions.toLocaleString('pt-BR')}\n`;
        if (campaign.spend) whatsappText += `   Investimento: R$ ${campaign.spend.toFixed(2)}\n`;
        if (campaign.link_clicks) whatsappText += `   Cliques: ${campaign.link_clicks.toLocaleString('pt-BR')}\n`;
        if (campaign.ctr !== undefined && campaign.ctr > 0) whatsappText += `   CTR: ${campaign.ctr.toFixed(2)}%\n`;
        
        // Message metrics
        if (isMsgCamp || (campaign.messages_started && campaign.messages_started > 0)) {
          if (campaign.messages_started) whatsappText += `   Mensagens: ${campaign.messages_started}\n`;
          if (campaign.cost_per_message && campaign.messages_started > 0) {
            whatsappText += `   Custo/Mensagem: R$ ${campaign.cost_per_message.toFixed(2)}\n`;
          }
        }

        // E-commerce metrics
        if (isEcomCamp || (campaign.purchases && campaign.purchases > 0)) {
          if (campaign.conversions) whatsappText += `   Conversões: ${campaign.conversions}\n`;
          if (campaign.purchases) whatsappText += `   Compras: ${campaign.purchases}\n`;
          if (campaign.cost_per_purchase && campaign.purchases > 0) {
            whatsappText += `   Custo/Compra: R$ ${campaign.cost_per_purchase.toFixed(2)}\n`;
          }
        }

        whatsappText += '\n';
      });
    }

    // Send formatted text to Make webhook
    const webhookUrl = 'https://hook.us2.make.com/ubpb53m819d72abao2kcd3bluqj6ffal';
    try {
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          whatsapp_text: whatsappText,
          generated_at: new Date().toISOString(),
        }),
      });
      console.log('Report data sent to webhook successfully');
    } catch (webhookError) {
      console.error('Error sending to webhook:', webhookError);
    }

    return new Response(JSON.stringify(reportData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Error in meta-ads-report function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
