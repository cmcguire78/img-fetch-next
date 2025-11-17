import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders });
}

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();
    if (!url) return NextResponse.json({ success: false, error: 'Missing url' }, { status: 400, headers: corsHeaders });

    // Direct fetch with spoofed headers (works for 80% of boats.com images)
    const res = await fetch(url, { 
      headers: { 
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://www.boats.com/',
      } 
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const buffer = Buffer.from(await res.arrayBuffer());
    const contentType = res.headers.get('content-type') || 'image/jpeg';
    const base64 = `data:${contentType};base64,${buffer.toString('base64')}`;

    return NextResponse.json(
      { success: true, image: base64, contentType, size: buffer.length },
      { headers: corsHeaders }
    );
  } catch (e: any) {
    console.error('API Error:', e.message);
    return NextResponse.json(
      { success: false, error: e.message || 'Failed to fetch image' },
      { status: 500, headers: corsHeaders }
    );
  }
}
