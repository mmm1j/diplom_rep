import { NextRequest, NextResponse } from 'next/server';
import { generateStreamToken } from '@/lib/stream';

export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json();
    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    const token = await generateStreamToken(userId);
    return NextResponse.json({ token });
  } catch (error) {
    console.error('Error generating Stream token:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}