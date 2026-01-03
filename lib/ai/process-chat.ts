
/**
 * Shared AI Chat Processing Logic
 * Used by both /api/ai/chat and /api/ai/chat-stream
 */

import { getManagerStats, getTopManagers, getNetworkStats, getNetworkTrend, getEraStats, getCurrentEra, getNodeStats, getRecentActivity } from './queries';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function processChatRequest(params: {
  message: string;
  conversationHistory: Array<{ role: string; content: string }>;
  clientIp?: string;
  baseUrl: string;
  onStatusUpdate?: (status: string) => void;
}): Promise<{ message: string; executedFunctions: string[]; iterations: number }> {

  const msg = params.message.toLowerCase();
  const executedFunctions: string[] = [];
  let responseMessage = "I'm not sure how to help with that.";

  try {
    // ---------------------------------------------------------
    // BASIC INTENT DISPATCHER (DEMO/V1)
    // ---------------------------------------------------------

    // 1. Manager Stats
    if (msg.includes('stats for manager') || msg.includes('manager stats')) {
      // Extract wallet - very basic extraction for demo
      const walletMatch = msg.match(/[1-9A-HJ-NP-Za-km-z]{32,44}/);
      if (walletMatch) {
        const wallet = walletMatch[0];
        params.onStatusUpdate?.(`Fetching stats for manager ${wallet.slice(0, 8)}...`);
        const stats = await getManagerStats(wallet);
        executedFunctions.push('getManagerStats');
        responseMessage = `### Manager Stats for \`${wallet.slice(0, 8)}...\`\n\n` +
          `- **Total Nodes**: ${stats.totalNodes}\n` +
          `- **Online**: ${stats.onlineNodes}\n` +
          `- **Total Credits**: ${stats.totalCredits.toLocaleString()}\n` +
          `- **DAO Stake**: ${stats.totalXandStake.toLocaleString()} XAND`;
      } else {
        responseMessage = "Please provide a valid manager wallet address.";
      }
    }

    // 2. Top Managers
    else if (msg.includes('top managers')) {
      params.onStatusUpdate?.('Fetching top managers...');
      const top = await getTopManagers(5);
      executedFunctions.push('getTopManagers');
      responseMessage = `### Top 5 Managers by Stake\n\n` +
        top.map((m, i) => `${i + 1}. **${m.wallet.slice(0, 8)}...**: ${m.nodes} nodes, ${m.stake.toLocaleString()} XAND`).join('\n');
    }

    // 3. Network Stats (Mainnet/Devnet)
    else if (msg.includes('mainnet stats') || msg.includes('mainnet status')) {
      params.onStatusUpdate?.('Fetching Mainnet stats...');
      const stats = await getNetworkStats('mainnet');
      executedFunctions.push('getNetworkStats(mainnet)');
      responseMessage = `### Mainnet Stats\n\n` +
        `- **Nodes**: ${stats.totalNodes} (${stats.onlineNodes} online)\n` +
        `- **Credits**: ${stats.totalCredits.toLocaleString()}\n` +
        `- **Avg Uptime**: ${(stats.avgUptime / 3600).toFixed(1)} hrs`;
    }
    else if (msg.includes('devnet stats') || msg.includes('devnet status')) {
      params.onStatusUpdate?.('Fetching Devnet stats...');
      const stats = await getNetworkStats('devnet');
      executedFunctions.push('getNetworkStats(devnet)');
      responseMessage = `### Devnet Stats\n\n` +
        `- **Nodes**: ${stats.totalNodes} (${stats.onlineNodes} online)\n` +
        `- **Credits**: ${stats.totalCredits.toLocaleString()}\n` +
        `- **Avg Uptime**: ${(stats.avgUptime / 3600).toFixed(1)} hrs`;
    }

    // 4. Trends
    else if (msg.includes('trend')) {
      const days = 7;
      params.onStatusUpdate?.(`Fetching ${days}-day trend...`);
      const trend = await getNetworkTrend(7);
      executedFunctions.push('getNetworkTrend');
      responseMessage = `### Network Trend (${days} Days)\n\n` +
        `| Date | Avg Nodes | Avg Online |\n|---|---|---|\n` +
        trend.map(d => `| ${d.date} | ${d.nodes} | ${d.online} |`).join('\n');
    }

    // 5. Eras
    else if (msg.includes('era')) {
      // "What is the current era?"
      if (msg.includes('current') || msg.includes('now')) {
        params.onStatusUpdate?.('Identifying current era...');
        const era = await getCurrentEra();
        executedFunctions.push('getCurrentEra');
        responseMessage = `### Current Era: ${era.name}\n\n` +
          `**${era.description}**\n\n` +
          `- **Boost Multiplier**: ${era.boost}x\n` +
          `- **Active Nodes**: ${era.totalNodes} (${era.onlineNodes} online)`;
      }
      // "Tell me about [Name] era" or "Stats for [Name] era"
      else {
        params.onStatusUpdate?.('Fetching era stats...');
        const eras = await getEraStats();
        executedFunctions.push('getEraStats');

        // Check for specific era name in message
        const targetEra = eras.find(e => msg.includes(e.name.toLowerCase().replace(' era', '')));

        if (targetEra) {
          responseMessage = `### ${targetEra.name}\n\n` +
            `**${targetEra.description}**\n\n` +
            `- **Boost**: ${targetEra.boost}x\n` +
            `- **Nodes**: ${targetEra.totalNodes} (${targetEra.onlineNodes} online)`;
        } else {
          // List all eras if no specific one found
          responseMessage = `### Xandeum Eras\n\n` +
            eras.map(e => `- **${e.name}** (${e.totalNodes} nodes): ${e.description}`).join('\n');
        }
      }
    }

    // 6. Specific Node Stats
    else if (msg.includes('node') && (msg.includes('status') || msg.includes('stats') || msg.includes('info'))) {
      const idMatch = msg.match(/[1-9A-HJ-NP-Za-km-z]{32,44}/) || msg.match(/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/);
      if (idMatch) {
        const id = idMatch[0];
        params.onStatusUpdate?.(`Fetching info for node ${id.slice(0, 8)}...`);
        const node = await getNodeStats(id);
        executedFunctions.push('getNodeStats');

        if (node) {
          responseMessage = `### Node ${node.pubkey?.slice(0, 8)}...\n\n` +
            `- **Status**: ${node.status}\n` +
            `- **Version**: ${node.version}\n` +
            `- **Network**: ${node.network}\n` +
            `- **Location**: ${node.location || 'Unknown'}\n` +
            `- **Credits**: ${(node.credits || 0).toLocaleString()}\n` +
            `- **Manager**: ${node.managerWallet ? node.managerWallet.slice(0, 8) + '...' : 'None'}`;
        } else {
          responseMessage = `Could not find a node with ID or IP matching "${id}".`;
        }
      } else {
        responseMessage = "Please provide a valid Node Pubkey or IP address.";
      }
    }

    // 7. Recent Activity
    else if (msg.includes('activity') || msg.includes('happened') || msg.includes('events')) {
      params.onStatusUpdate?.('Fetching recent activity...');
      const logs = await getRecentActivity(5);
      executedFunctions.push('getRecentActivity');

      if (logs.length > 0) {
        responseMessage = `### Recent Network Activity\n\n` +
          logs.map(log => `- **${new Date(log.timestamp).toLocaleTimeString()}**: ${log.message}`).join('\n');
      } else {
        responseMessage = "No recent activity found.";
      }
    }

    // Default / Help
    else {
      responseMessage = "I can help you with:\n" +
        "- **Manager Stats**: \"Get stats for manager [wallet]\"\n" +
        "- **Top Managers**: \"Show top managers\"\n" +
        "- **Network Stats**: \"Mainnet stats\" or \"Devnet stats\"\n" +
        "- **Trends**: \"Show network trend\"\n" +
        "- **Eras**: \"Current era\" or \"Tell me about Coal Era\"\n" +
        "- **Nodes**: \"Status of node [pubkey]\"\n" +
        "- **Activity**: \"What happened recently?\"";
    }

  } catch (err: any) {
    console.error("Error processing AI request:", err);
    responseMessage = `An error occurred while fetching data: ${err.message}`;
  }

  return {
    message: responseMessage,
    executedFunctions,
    iterations: 1
  };
}
