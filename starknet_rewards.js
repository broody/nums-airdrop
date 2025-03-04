const axios = require('axios');
const fs = require('fs');
const { num } = require('starknet');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;

// Configure your GraphQL endpoint URL here
const GRAPHQL_ENDPOINT = 'https://api.cartridge.gg/x/nums-starknet/torii/graphql';

// GraphQL query
const query = `
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

async function fetchGraphQLData() {
  try {
    const response = await axios({
      url: GRAPHQL_ENDPOINT,
      method: 'post',
      data: {
        query
      },
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
    console.error('Error fetching data:', error.message);
    return null;
  }
}

function processData(data) {
  if (!data || !data.data || !data.data.numsClaimsModels || !data.data.numsClaimsModels.edges) {
    console.error('Invalid data structure');
    return [];
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

  // Convert map to array of objects for CSV
  return Array.from(playerRewardsMap, ([player, totalRewards]) => ({
    player: num.toHex64(player),
    totalRewards
  }));
}

async function generateCSV(records) {
  if (records.length === 0) {
    console.error('No records to write to CSV');
    return;
  }

  const csvWriter = createCsvWriter({
    path: 'starknet_rewards.csv',
    header: [
      { id: 'player', title: 'Player' },
      { id: 'totalRewards', title: 'Total Rewards' }
    ]
  });

  try {
    await csvWriter.writeRecords(records);
    console.log('CSV file has been written successfully');
    console.log(`Total players processed: ${records.length}`);
  } catch (error) {
    console.error('Error writing CSV:', error.message);
  }
}

async function main() {
  console.log('Fetching data from GraphQL endpoint...');
  const data = await fetchGraphQLData();
  
  if (data) {
    console.log('Processing data...');
    const records = processData(data);
    
    console.log('Generating CSV...');
    await generateCSV(records);
  }
}

main().catch(error => {
  console.error('Script execution failed:', error.message);
});