const fs = require('fs');
const csv = require('csv-parser');

// Configuration
const CONTRACT_ADDRESS = '0x00e5f10eddc01699dc899a30dbc3c9858148fa4aa0a47c0ffd85f887ffc4653e'; // Using the address from your invoke.txt
const OUTPUT_FILE = 'invoke.txt';

// Function to read CSV and generate invoke command
async function generateInvokeCommand() {
  const results = [];
  
  // Read the airdrop.csv file
  return new Promise((resolve, reject) => {
    // First, let's check what headers are actually in the CSV file
    const sampleData = fs.readFileSync('airdrop.csv', 'utf8').split('\n')[0];
    console.log('CSV headers:', sampleData);
    
    fs.createReadStream('airdrop.csv')
      .pipe(csv())
      .on('data', (data) => {
        // Log the first row to see what we're getting
        if (results.length === 0) {
          console.log('First row data:', data);
        }
        
        // Get the player and amount from the data object
        // The keys should match the header names in the CSV
        const playerKey = Object.keys(data).find(key => key.toLowerCase().includes('player'));
        const amountKey = Object.keys(data).find(key => 
          key.toLowerCase().includes('airdrop') || 
          key.toLowerCase().includes('amount')
        );
        
        if (playerKey && amountKey) {
          results.push({
            player: data[playerKey],
            amount: data[amountKey]
          });
        } else {
          console.error('Could not find player or amount columns in:', data);
        }
      })
      .on('end', () => {
        if (results.length === 0) {
          console.error('No data was read from the CSV file');
          return resolve();
        }
        
        // Generate the invoke command
        let invokeCommand = 'starkli invoke';
        
        results.forEach((record, index) => {
          // Add each call to the command
          invokeCommand += ` ${CONTRACT_ADDRESS} reward ${record.player} ${record.amount}`;
          
          // Add separator if not the last record
          if (index < results.length - 1) {
            invokeCommand += ' /';
          }
        });
        
        // Write to output file
        fs.writeFileSync(OUTPUT_FILE, invokeCommand);
        console.log(`Generated invoke command with ${results.length} calls and saved to ${OUTPUT_FILE}`);
        resolve();
      })
      .on('error', (error) => {
        reject(error);
      });
  });
}

// Execute the function
generateInvokeCommand()
  .catch(error => {
    console.error('Error generating invoke command:', error);
  });