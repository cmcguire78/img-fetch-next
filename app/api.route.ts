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

    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0', Referer: 'https://www.boats.com/' } });
    if (!res.ok) throw new Error('Fetch failed');

    const buffer = Buffer.from(await res.arrayBuffer());
    const base64 = `data:${res.headers.get('content-type') || 'image/jpeg'};base64,${buffer.toString('base64')}`;

    return NextResponse.json(
      { success: true, image: base64, size: buffer.length },
      { headers: corsHeaders }
    );
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500, headers: corsHeaders });
  }
}
