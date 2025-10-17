import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function POST(req: Request) {
  try {
    console.log('🐕 [Cron] Starting dog database sync via API endpoint...');
    
    // Optional: Add authentication to prevent unauthorized access
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      console.warn('🚫 [Cron] Unauthorized sync attempt');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Execute the dog sync script
    const { stdout, stderr } = await execAsync('node scripts/sync-dogs.js', {
      cwd: process.cwd(),
      env: { ...process.env }
    });

    console.log('📝 [Cron] Sync output:', stdout);
    if (stderr) console.warn('⚠️ [Cron] Sync warnings:', stderr);

    console.log('✅ [Cron] Dog sync completed successfully');
    
    return NextResponse.json({
      status: 'success',
      message: 'Dog database sync completed',
      timestamp: new Date().toISOString(),
      output: stdout
    });

  } catch (error) {
    console.error('❌ [Cron] Dog sync failed:', error);
    
    return NextResponse.json({
      status: 'error',
      message: 'Dog sync failed',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

// Also support GET for simple health checks
export async function GET() {
  return NextResponse.json({
    endpoint: '/api/cron/sync-dogs',
    method: 'POST',
    description: 'Triggers daily dog database sync',
    requiresAuth: !!process.env.CRON_SECRET
  });
}
