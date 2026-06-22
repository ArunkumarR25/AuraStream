import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { image, prompt } = await request.json();
    if (!image) {
      return NextResponse.json({ error: 'No image provided' }, { status: 400 });
    }

    const hfToken = process.env.HF_TOKEN || process.env.NEXT_PUBLIC_HF_TOKEN;

    // Fallback if no token is configured
    if (!hfToken) {
      console.warn("[filter-selfie] HF_TOKEN is not defined in environment. Falling back to local simulation.");
      return NextResponse.json({ 
        image, 
        info: 'Fallback applied: original returned due to missing HF_TOKEN' 
      });
    }

    // Extract base64 binary
    const base64Data = image.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64Data, 'base64');

    // Default model and fallback chain
    const models = [
      'stabilityai/stable-diffusion-xl-refiner-1.0',
      'runwayml/stable-diffusion-v1-5',
      'nitrosocke/Ghibli-Diffusion'
    ];

    let success = false;
    let resultBuffer = null;
    let lastError = null;

    for (const model of models) {
      try {
        console.log(`[filter-selfie] Sending request to HF Model: ${model}`);
        const response = await fetch(
          `https://api-inference.huggingface.co/models/${model}`,
          {
            headers: {
              Authorization: `Bearer ${hfToken}`,
              'Content-Type': 'image/jpeg'
            },
            method: 'POST',
            body: buffer,
          }
        );

        if (response.ok) {
          const resBuffer = await response.arrayBuffer();
          // Verify it returned actual image bytes and not an error JSON
          const contentType = response.headers.get('content-type') || '';
          if (contentType.includes('image') || resBuffer.byteLength > 1000) {
            resultBuffer = Buffer.from(resBuffer);
            success = true;
            console.log(`[filter-selfie] Successfully styled using model: ${model}`);
            break;
          }
        }
        
        const errText = await response.text();
        console.warn(`[filter-selfie] Model ${model} returned status ${response.status}: ${errText}`);
        lastError = `HF error ${response.status}: ${errText}`;
      } catch (err) {
        console.warn(`[filter-selfie] Model ${model} failed:`, err.message);
        lastError = err.message;
      }
    }

    if (success && resultBuffer) {
      const outputBase64 = `data:image/jpeg;base64,${resultBuffer.toString('base64')}`;
      return NextResponse.json({ image: outputBase64 });
    }

    console.warn(`[filter-selfie] All Hugging Face models failed. Last error: ${lastError}. Falling back to original.`);
    return NextResponse.json({ 
      image, 
      warning: `HF models failed. Fallback to original. Error: ${lastError}` 
    });

  } catch (error) {
    console.error('[filter-selfie] Route error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

export const maxDuration = 30;
export const dynamic = 'force-dynamic';
