const fs = require('fs');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;

// Configuration
const INVOKE_FILE = 'invoke.txt';
const INVERSE_CSV = 'airdrop_inverse.csv';

// Function to parse invoke.txt and generate inverse CSV
async function parseInvokeAndGenerateCSV() {
  try {
    // Read the invoke.txt file
    console.log('Reading invoke.txt file...');
    const invokeContent = fs.readFileSync(INVOKE_FILE, 'utf8');
    
    // Parse the invoke command to extract player addresses and amounts
    const invokeData = [];
    
    // Regular expression to match the pattern: reward 0x... NUMBER
    const regex = /reward\s+(0x[0-9a-f]+)\s+(\d+)/gi;
    let match;
    
    while ((match = regex.exec(invokeContent)) !== null) {
      invokeData.push({
        player: match[1],
        airdropAmount: match[2]
      });
    }
    
    console.log(`Extracted ${invokeData.length} player records from invoke.txt`);
    
    // Sort the data lexicographically by player address
    invokeData.sort((a, b) => a.player.localeCompare(b.player));
    
    // Write to inverse CSV
    const csvWriter = createCsvWriter({
      path: INVERSE_CSV,
      header: [
        { id: 'player', title: 'player' },
        { id: 'airdropAmount', title: 'airdropAmount' }
      ]
    });
    
    await csvWriter.writeRecords(invokeData);
    console.log(`Generated ${INVERSE_CSV} with ${invokeData.length} records`);
    
  } catch (error) {
    console.error('Error processing invoke file:', error);
  }
}

// Execute the function
parseInvokeAndGenerateCSV()
  .catch(error => {
    console.error('Script execution failed:', error);
  });