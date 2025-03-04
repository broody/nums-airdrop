const axios = require('axios');
const { num } = require('starknet');
const fs = require('fs');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;

// Configure GraphQL endpoint URLs
const STARKNET_GRAPHQL_ENDPOINT = 'https://api.cartridge.gg/x/nums-starknet/torii/graphql';
const APPCHAIN_GRAPHQL_ENDPOINT = 'http://localhost:8080/graphql';

// GraphQL queries
const starknetQuery = `
{
  numsClaimsModels(limit: 200) {
    totalCount
    edges {
      node {
        player
        ty {
          TOKEN {
            amount
          }
        }
      }
    }
  }
}
`;

const appchainQuery = `
{
  numsTotalsModels (limit: 200) {
    totalCount
    edges {
      node {
        player
        rewards_earned
      }
    }
  }
}
`;

async function fetchGraphQLData(endpoint, query) {
  try {
    const response = await axios({
      url: endpoint,
      method: 'post',
      data: { query },
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (response.data.errors) {
      console.error('GraphQL Errors:', response.data.errors);
      return null;
    }

    return response.data;
  } catch (error) {
    console.error(`Error fetching data from ${endpoint}:`, error.message);
    return null;
  }
}

function processStarknetData(data) {
  if (!data || !data.data || !data.data.numsClaimsModels || !data.data.numsClaimsModels.edges) {
    console.error('Invalid Starknet data structure');
    return new Map();
  }

  // Create a map to aggregate rewards by player
  const playerRewardsMap = new Map();

  data.data.numsClaimsModels.edges.forEach(edge => {
    const player = edge.node.player;
    let amount = 0;
    
    // Check if token data exists and extract amount
    if (edge.node.ty && edge.node.ty.TOKEN && edge.node.ty.TOKEN.amount) {
      // Convert hex amount to decimal if it's a hex string
      const amountStr = edge.node.ty.TOKEN.amount;
      if (typeof amountStr === 'string' && amountStr.startsWith('0x')) {
        amount = parseInt(amountStr, 16);
      } else {
        amount = parseFloat(amountStr);
      }
    }

    // Add amount to player's total rewards
    if (playerRewardsMap.has(player)) {
      playerRewardsMap.set(player, playerRewardsMap.get(player) + amount);
    } else {
      playerRewardsMap.set(player, amount);
    }
  });

  return playerRewardsMap;
}

function processAppchainData(data) {
  if (!data || !data.data || !data.data.numsTotalsModels || !data.data.numsTotalsModels.edges) {
    console.error('Invalid Appchain data structure');
    return new Map();
  }

  // Create a map to store player rewards
  const playerRewardsMap = new Map();

  data.data.numsTotalsModels.edges.forEach(edge => {
    const player = edge.node.player;
    let rewards = edge.node.rewards_earned;
    
    // Convert hex amount to decimal if it's a hex string
    if (typeof rewards === 'string' && rewards.startsWith('0x')) {
      rewards = parseInt(rewards, 16);
    } else if (rewards !== undefined) {
      rewards = parseFloat(rewards);
    } else {
      rewards = 0;
    }

    playerRewardsMap.set(player, rewards);
  });

  return playerRewardsMap;
}

function combineRewardsData(starknetMap, appchainMap) {
  const combinedMap = new Map();
  
  // Add all players from Starknet data
  for (const [player, rewards] of starknetMap.entries()) {
    combinedMap.set(player, {
      starknetRewards: rewards,
      appchainRewards: 0,
      totalRewards: rewards,
      airdropAmount: -rewards // Initially negative starknet rewards
    });
  }
  
  // Add or update with Appchain data
  for (const [player, rewards] of appchainMap.entries()) {
    if (combinedMap.has(player)) {
      const existing = combinedMap.get(player);
      existing.appchainRewards = rewards;
      existing.totalRewards += rewards;
      existing.airdropAmount += rewards; // Add appchain rewards to get the difference
      combinedMap.set(player, existing);
    } else {
      combinedMap.set(player, {
        starknetRewards: 0,
        appchainRewards: rewards,
        totalRewards: rewards,
        airdropAmount: rewards // Just appchain rewards if no starknet rewards
      });
    }
  }
  
  // Convert map to array of objects for CSV
  return Array.from(combinedMap, ([player, rewards]) => ({
    player: num.toHex64(player),
    starknetRewards: rewards.starknetRewards,
    appchainRewards: rewards.appchainRewards,
    totalRewards: rewards.totalRewards,
    airdropAmount: rewards.airdropAmount
  }));
}

async function generateCSVs(records) {
  if (records.length === 0) {
    console.error('No records to write to CSV');
    return;
  }

  // Generate combined rewards CSV
  const combinedCsvWriter = createCsvWriter({
    path: 'combined_rewards.csv',
    header: [
      { id: 'player', title: 'Player' },
      { id: 'starknetRewards', title: 'Starknet Rewards' },
      { id: 'appchainRewards', title: 'Appchain Rewards' },
      { id: 'totalRewards', title: 'Total Combined Rewards' }
    ]
  });

  // Generate airdrop CSV (only for players with positive airdrop amount)
  const airdropRecords = records
    .filter(record => record.airdropAmount > 0)
    .sort((a, b) => a.player.localeCompare(b.player)); // Sort lexicographically by player address
    
  const airdropCsvWriter = createCsvWriter({
    path: 'airdrop.csv',
    header: [
      { id: 'player', title: 'Player' },
      { id: 'airdropAmount', title: 'Airdrop Amount' }
    ]
  });

  try {
    await combinedCsvWriter.writeRecords(records);
    console.log('Combined rewards CSV file has been written successfully');
    
    await airdropCsvWriter.writeRecords(airdropRecords);
    console.log('Airdrop CSV file has been written successfully');
    console.log(`Total players processed: ${records.length}`);
    console.log(`Players eligible for airdrop: ${airdropRecords.length}`);
  } catch (error) {
    console.error('Error writing CSV:', error.message);
  }
}

async function main() {
  console.log('Fetching data from Starknet GraphQL endpoint...');
  const starknetData = await fetchGraphQLData(STARKNET_GRAPHQL_ENDPOINT, starknetQuery);
  
  console.log('Fetching data from Appchain GraphQL endpoint...');
  const appchainData = await fetchGraphQLData(APPCHAIN_GRAPHQL_ENDPOINT, appchainQuery);
  
  if (starknetData || appchainData) {
    console.log('Processing data...');
    
    // Process both data sources
    const starknetRewardsMap = starknetData ? processStarknetData(starknetData) : new Map();
    const appchainRewardsMap = appchainData ? processAppchainData(appchainData) : new Map();
    
    // Combine the data
    const combinedRecords = combineRewardsData(starknetRewardsMap, appchainRewardsMap);
    
    console.log('Generating CSV files...');
    await generateCSVs(combinedRecords);
    
    // Count airdrop eligible players
    const airdropEligible = combinedRecords.filter(record => record.airdropAmount > 0).length;
    
    console.log('Summary:');
    console.log(`- Starknet players: ${starknetRewardsMap.size}`);
    console.log(`- Appchain players: ${appchainRewardsMap.size}`);
    console.log(`- Total unique players: ${combinedRecords.length}`);
    console.log(`- Players eligible for airdrop: ${airdropEligible}`);
  } else {
    console.error('Failed to fetch data from both sources');
  }
}

main().catch(error => {
  console.error('Script execution failed:', error.message);
}); 