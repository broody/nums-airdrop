const axios = require('axios');
const { num } = require('starknet');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;

// Configure your GraphQL endpoint URL here
const GRAPHQL_ENDPOINT = 'http://localhost:8080/graphql';

// GraphQL query
const query = `
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
  if (!data || !data.data || !data.data.numsTotalsModels || !data.data.numsTotalsModels.edges) {
    console.error('Invalid data structure');
    return [];
  }

  // Create array of player rewards
  return data.data.numsTotalsModels.edges.map(edge => {
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

    return {
      player: num.toHex64(player),
      totalRewards: rewards
    };
  });
}

async function generateCSV(records) {
  if (records.length === 0) {
    console.error('No records to write to CSV');
    return;
  }

  const csvWriter = createCsvWriter({
    path: 'appchain_rewards.csv',
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
  console.log('Fetching data from local GraphQL endpoint...');
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