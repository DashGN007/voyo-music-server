/**
 * VOYO Music - Cloudflare Worker v2
 * Multi-client YouTube extraction from the edge
 * Tries different client types for maximum compatibility
 */

// Client configurations ranked by success rate
const CLIENTS = [
  {
    name: 'ANDROID_TESTSUITE',
    context: {
      client: {
        clientName: 'ANDROID_TESTSUITE',
        clientVersion: '1.9',
        androidSdkVersion: 30,
        hl: 'en',
        gl: 'US',
      }
    },
    userAgent: 'com.google.android.youtube/1.9 (Linux; U; Android 11) gzip'
  },
  {
    name: 'ANDROID_MUSIC',
    context: {
      client: {
        clientName: 'ANDROID_MUSIC',
        clientVersion: '6.42.52',
        androidSdkVersion: 30,
        hl: 'en',
        gl: 'US',
      }
    },
    userAgent: 'com.google.android.apps.youtube.music/6.42.52 (Linux; U; Android 11) gzip'
  },
  {
    name: 'ANDROID',
    context: {
      client: {
        clientName: 'ANDROID',
        clientVersion: '19.09.37',
        androidSdkVersion: 30,
        hl: 'en',
        gl: 'US',
      }
    },
    userAgent: 'com.google.android.youtube/19.09.37 (Linux; U; Android 11) gzip'
  },
  {
    name: 'IOS',
    context: {
      client: {
        clientName: 'IOS',
        clientVersion: '19.09.3',
        deviceModel: 'iPhone14,3',
        hl: 'en',
        gl: 'US',
      }
    },
    userAgent: 'com.google.ios.youtube/19.09.3 (iPhone14,3; U; CPU iOS 15_6 like Mac OS X)'
  },
  {
    name: 'TV_EMBEDDED',
    context: {
      client: {
        clientName: 'TVHTML5_SIMPLY_EMBEDDED_PLAYER',
        clientVersion: '2.0',
        hl: 'en',
        gl: 'US',
      },
      thirdParty: {
        embedUrl: 'https://www.youtube.com/'
      }
    },
    userAgent: 'Mozilla/5.0 (SMART-TV; Linux; Tizen 6.0) AppleWebKit/538.1 (KHTML, like Gecko) SamsungBrowser/5.0 TV Safari/538.1'
  }
];

async function tryClient(videoId, clientConfig) {
  const response = await fetch('https://www.youtube.com/youtubei/v1/player?key=AIzaSyA8eiZmM1FaDVjRy-df2KTyQ_vz_yYM39w', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': clientConfig.userAgent,
      'X-YouTube-Client-Name': clientConfig.context.client.clientName,
      'X-YouTube-Client-Version': clientConfig.context.client.clientVersion,
      'Origin': 'https://www.youtube.com',
      'Referer': 'https://www.youtube.com/',
    },
    body: JSON.stringify({
      videoId: videoId,
      context: clientConfig.context,
      playbackContext: {
        contentPlaybackContext: {
          signatureTimestamp: 19950 // Recent signature timestamp
        }
      },
      contentCheckOk: true,
      racyCheckOk: true
    })
  });

  return response.json();
}

function extractBestAudio(data) {
  if (data.playabilityStatus?.status !== 'OK') {
    return { error: data.playabilityStatus?.reason || 'Not playable' };
  }

  const formats = data.streamingData?.adaptiveFormats || [];
  const audioFormats = formats.filter(f => f.mimeType?.startsWith('audio/'));

  if (audioFormats.length === 0) {
    return { error: 'No audio formats' };
  }

  // Prefer mp4, highest bitrate
  const mp4Audio = audioFormats.filter(f => f.mimeType?.includes('mp4'));
  const bestAudio = (mp4Audio.length > 0 ? mp4Audio : audioFormats)
    .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))[0];

  if (!bestAudio.url) {
    return { error: 'URL requires deciphering', cipher: !!bestAudio.signatureCipher };
  }

  return {
    url: bestAudio.url,
    mimeType: bestAudio.mimeType,
    bitrate: bestAudio.bitrate,
    contentLength: bestAudio.contentLength,
    title: data.videoDetails?.title,
  };
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Health check
    if (url.pathname === '/health') {
      return new Response(JSON.stringify({ status: 'ok', edge: true, clients: CLIENTS.length }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Extract audio stream with multi-client fallback
    if (url.pathname === '/stream') {
      const videoId = url.searchParams.get('v');
      if (!videoId || !/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
        return new Response(JSON.stringify({ error: 'Invalid video ID' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const errors = [];

      // Try each client until one works
      for (const client of CLIENTS) {
        try {
          const data = await tryClient(videoId, client);
          const result = extractBestAudio(data);

          if (result.url) {
            return new Response(JSON.stringify({
              ...result,
              client: client.name // Tell us which client worked
            }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

          errors.push({ client: client.name, error: result.error });
        } catch (err) {
          errors.push({ client: client.name, error: err.message });
        }
      }

      // All clients failed
      return new Response(JSON.stringify({
        error: 'All clients failed',
        attempts: errors
      }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // CORS Proxy - Forward requests to YouTube with CORS headers
    // This allows client-side youtubei.js to use Cloudflare's trusted IPs
    if (url.pathname === '/proxy') {
      const targetUrl = url.searchParams.get('url');
      if (!targetUrl) {
        return new Response(JSON.stringify({ error: 'Missing url parameter' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      try {
        // Forward the request to YouTube
        const proxyResponse = await fetch(targetUrl, {
          method: request.method,
          headers: {
            'User-Agent': 'com.google.android.youtube/19.09.37 (Linux; U; Android 11) gzip',
            'Accept': '*/*',
            'Accept-Language': 'en-US,en;q=0.9',
            'Origin': 'https://www.youtube.com',
            'Referer': 'https://www.youtube.com/',
          },
          body: request.method === 'POST' ? await request.text() : undefined,
        });

        // Clone response and add CORS headers
        const responseBody = await proxyResponse.arrayBuffer();
        const responseHeaders = new Headers(proxyResponse.headers);

        // Add CORS headers
        Object.entries(corsHeaders).forEach(([key, value]) => {
          responseHeaders.set(key, value);
        });

        return new Response(responseBody, {
          status: proxyResponse.status,
          headers: responseHeaders
        });

      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // Debug endpoint - test specific client
    if (url.pathname === '/debug') {
      const videoId = url.searchParams.get('v');
      const clientName = url.searchParams.get('client') || 'ANDROID_TESTSUITE';

      if (!videoId || !/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
        return new Response(JSON.stringify({ error: 'Invalid video ID' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const client = CLIENTS.find(c => c.name === clientName) || CLIENTS[0];

      try {
        const data = await tryClient(videoId, client);
        return new Response(JSON.stringify({
          client: client.name,
          playabilityStatus: data.playabilityStatus,
          hasStreamingData: !!data.streamingData,
          formatCount: data.streamingData?.adaptiveFormats?.length || 0,
          videoDetails: data.videoDetails ? {
            title: data.videoDetails.title,
            author: data.videoDetails.author,
            lengthSeconds: data.videoDetails.lengthSeconds,
          } : null
        }, null, 2), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    return new Response('VOYO Edge Worker v2 - Multi-client extraction', { headers: corsHeaders });
  }
};
