
// Multi-purpose cron script for scheduled tasks
const https = require('https');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

// Configuration
const TASKS = {
  SYNC_DOGS: process.env.TASK_TYPE === 'sync-dogs' || process.env.TASK_TYPE === 'all',
  TRIGGER_RAFFLE: process.env.TASK_TYPE === 'raffle' || process.env.TASK_TYPE === 'all'
};

const API_BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://animal-rescue-donations.replit.dev'; // Update this

async function makeHttpRequest(url, method = 'GET', data = null) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'BarkBase-Cron/1.0'
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

async function syncDogs() {
  console.log('🐕 Starting dog data sync task...');
  
  try {
    // Run the dog sync script
    const { stdout, stderr } = await execAsync('node scripts/sync-dogs.js', {
      cwd: '/home/runner/animal-rescue-donations',
      env: { ...process.env }
    });
    
    console.log('📝 Sync output:', stdout);
    if (stderr) console.warn('⚠️ Sync warnings:', stderr);
    
    console.log('✅ Dog sync completed successfully');
    return true;
  } catch (error) {
    console.error('❌ Dog sync failed:', error);
    return false;
  }
}

async function triggerRaffle() {
  console.log('🎲 Triggering raffle draw...');
  
  try {
    // Ping your raffle endpoint
    const response = await makeHttpRequest(`${API_BASE_URL}/api/raffle/draw`, 'POST', {
      source: 'scheduled-cron',
      timestamp: new Date().toISOString()
    });
    
    if (response.status === 200) {
      console.log('✅ Raffle triggered successfully:', response.data);
      return true;
    } else {
      console.error('❌ Raffle trigger failed:', response.status, response.data);
      return false;
    }
  } catch (error) {
    console.error('❌ Raffle trigger error:', error);
    return false;
  }
}

async function main() {
  console.log('🚀 Starting scheduled tasks...');
  console.log('📋 Tasks to run:', TASKS);
  
  const results = {
    dogSync: null,
    raffle: null
  };
  
  // Run dog sync if enabled
  if (TASKS.SYNC_DOGS) {
    results.dogSync = await syncDogs();
  }
  
  // Run raffle trigger if enabled  
  if (TASKS.TRIGGER_RAFFLE) {
    results.raffle = await triggerRaffle();
  }
  
  // Report results
  console.log('📊 Task Results:', results);
  
  const hasFailures = Object.values(results).some(result => result === false);
  if (hasFailures) {
    console.error('❌ Some tasks failed');
    process.exit(1);
  } else {
    console.log('✅ All tasks completed successfully');
    process.exit(0);
  }
}

// Run the tasks
main();
