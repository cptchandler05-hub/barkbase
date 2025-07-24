
// Every-2-minutes raffle trigger task
const https = require('https');

const API_BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://animal-rescue-donations.replit.dev'; // Will be updated to Vercel URL when deployed

async function makeHttpRequest(url, method = 'POST', data = null) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'BarkBase-RaffleCron/1.0'
      }
    };

    const req = https.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(responseData);
          resolve({ status: res.statusCode, data: jsonData });
        } catch (e) {
          resolve({ status: res.statusCode, data: responseData });
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

async function main() {
  console.log('🎲 Triggering raffle check...');
  
  try {
    // Ping your raffle endpoint
    const response = await makeHttpRequest(`${API_BASE_URL}/api/raffle/draw`, 'POST', {
      source: 'scheduled-cron-minute',
      timestamp: new Date().toISOString()
    });
    
    if (response.status === 200) {
      console.log('✅ Raffle check completed:', response.data);
      process.exit(0);
    } else {
      console.log('ℹ️ Raffle response:', response.status, response.data);
      process.exit(0); // Don't fail on expected responses
    }
  } catch (error) {
    console.error('❌ Raffle trigger error:', error);
    process.exit(1);
  }
}

main();
