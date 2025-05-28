
import { NextResponse } from 'next/server';
import { logWinner } from '@/lib/logWinner';

export async function GET() {
  try {
    // Log your actual historical win
    await logWinner('0x06d0c4FDab1088B4D72f65CE9Fd2d374A007FBc9', 0.0025);
    
    return NextResponse.json({ 
      success: true, 
      message: 'Historical winner logged successfully' 
    });
  } catch (error) {
    return NextResponse.json({ 
      error: (error as Error).message 
    }, { status: 500 });
  }
}

export async function POST() {
  try {
    // Log your actual historical win
    await logWinner('0x06d0c4FDab1088B4D72f65CE9Fd2d374A007FBc9', 0.0025);
    
    return NextResponse.json({ 
      success: true, 
      message: 'Historical winner logged successfully' 
    });
  } catch (error) {
    return NextResponse.json({ 
      error: (error as Error).message 
    }, { status: 500 });
  }
}
