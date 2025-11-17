import { NextRequest, NextResponse } from 'next/server';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB

// Magic byte validation
const IMAGE_SIGNATURES = {
  png: Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
  jpeg: Buffer.from([0xFF, 0xD8, 0xFF]),
  gif: Buffer.from([0x47, 0x49, 0x46]),
  webp: Buffer.from([0x52, 0x49, 0x46, 0x46]),
};

function isValidImageBuffer(buffer: Buffer): boolean {
  if (buffer.length < 8) return false;
  return (
    buffer.subarray(0, 8).equals(IMAGE_SIGNATURES.png) ||
    buffer.subarray(0, 3).equals(IMAGE_SIGNATURES.jpeg) ||
    buffer.subarray(0, 3).equals(IMAGE_SIGNATURES.gif) ||
    buffer.subarray(0, 4).equals(IMAGE_SIGNATURES.webp)
  );
}

async function fetchWithPuppeteer(url: string): Promise<{ buffer: Buffer; contentType: string; size: number }> {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  try {
    const page = await browser.newPage();
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
    });

    const match = url.match(/\/(\d+)\/[^/]+$/);
    if (!match) throw new Error('Invalid boats.com URL format');
    const listingId = match[1];
    const listingUrl = `https://www.boats.com/boats-for-sale/?boat=${listingId}`;

    await page.goto(listingUrl, { waitUntil: 'networkidle2', timeout: 30000 });

    const finalImageUrl = await page.evaluate(() => {
      const imgs = Array.from(document.querySelectorAll('img'))
        .filter((img: any) => img.complete && img.naturalWidth > 300 && img.src.includes('boats.com'));
      const sorted = imgs.sort((a: any, b: any) =>
        (b.naturalWidth * b.naturalHeight) - (a.naturalWidth * a.naturalHeight)
      );
      return sorted[0]?.src || null;
    });

    if (!finalImageUrl) throw new Error('No valid image found on listing');

    const response = await page.goto(finalImageUrl, { waitUntil: 'networkidle0', timeout: 30000 });
    if (!response?.ok()) throw new Error(`HTTP ${response?.status()}`);

    const buffer = await response.buffer();
    if (buffer.length > MAX_IMAGE_SIZE) throw new Error('Image too large');
    if (!isValidImageBuffer(buffer)) throw new Error('Invalid image format');

    const contentType = response.headers()['content-type'] || 'image/jpeg';

    return { buffer, contentType, size: buffer.length };
  } finally {
    await browser.close();
  }
}

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();
    if (!url || typeof url !== 'string' || !url.includes('boats.com')) {
      return NextResponse.json({ success: false, error: 'Missing or invalid "url" (must be boats.com)' }, { status: 400 });
    }

    // Quick direct fetch first
    const directRes = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://www.boats.com/',
      },
    });
    if (directRes.ok) {
      const buffer = Buffer.from(await directRes.arrayBuffer());
      if (isValidImageBuffer(buffer)) {
        return NextResponse.json({
          success: true,
          image: `data:image/jpeg;base64,${buffer.toString('base64')}`,
          contentType: 'image/jpeg',
          size: buffer.length,
        });
      }
    }

    // Fallback to Puppeteer
    const result = await fetchWithPuppeteer(url);
    const dataUrl = `data:${result.contentType};base64,${result.buffer.toString('base64')}`;

    return NextResponse.json({
      success: true,
      image: dataUrl,
      contentType: result.contentType,
      size: result.size,
    });
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
