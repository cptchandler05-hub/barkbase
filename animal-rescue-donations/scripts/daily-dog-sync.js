
// Daily dog database sync task
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

async function main() {
  console.log('🐕 Starting daily dog database sync...');
  
  try {
    // Run the dog sync script
    const { stdout, stderr } = await execAsync('node scripts/sync-dogs.js', {
      cwd: '/home/runner/animal-rescue-donations',
      env: { ...process.env }
    });
    
    console.log('📝 Sync output:', stdout);
    if (stderr) console.warn('⚠️ Sync warnings:', stderr);
    
    console.log('✅ Daily dog sync completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Daily dog sync failed:', error);
    process.exit(1);
  }
}

main();
