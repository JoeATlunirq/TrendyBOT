const express = require('express');
const axios = require('axios'); // Using axios for the outgoing request from proxy

const app = express();
const PORT = process.env.PORT || 3001; // Render will set the PORT environment variable

// Environment variable for the ViewStats Bearer Token
const VIEWSTATS_BEARER_TOKEN = process.env.VIEWSTATS_BEARER_TOKEN_SECRET;

if (!VIEWSTATS_BEARER_TOKEN) {
    console.error("FATAL ERROR: VIEWSTATS_BEARER_TOKEN_SECRET environment variable is not set.");
    process.exit(1); // Exit if the token isn't configured
}

app.get('/viewstats-proxy', async (req, res) => {
    const { handle, range } = req.query;

    if (!handle || !range) {
        return res.status(400).send('Missing "handle" or "range" query parameters.');
    }

    // Construct the ViewStats API URL
    // Ensure vsRange (used in the original function) is what you intend to pass for range here.
    // The original code was: const vsRange = convertToViewStatsRange(range);
    // Assuming 'range' query param here matches the expected 'vsRange' values (e.g., "28", "alltime")
    const viewStatsUrl = `https://api.viewstats.com/channels/${encodeURIComponent(handle)}/stats?range=${range}&groupBy=daily&sortOrder=ASC&withRevenue=true&withEvents=true&withBreakdown=false&withToday=false`;

    console.log(`[PROXY] Requesting for handle: ${handle}, range: ${range}. URL: ${viewStatsUrl.replace(VIEWSTATS_BEARER_TOKEN, "[TOKEN_REDACTED]")}`);

    try {
        const apiRes = await axios.get(viewStatsUrl, {
            headers: {
                'Authorization': `Bearer ${VIEWSTATS_BEARER_TOKEN}`,
                'User-Agent': 'TrendyBotViewStatsProxy/1.0', // Identify your proxy
                'Accept-Encoding': 'identity' // Important: Request uncompressed data
            },
            responseType: 'arraybuffer' // Crucial: Get the response as a raw ArrayBuffer
        });

        if (apiRes.status !== 200) {
             console.warn(`[PROXY] ViewStats API returned status ${apiRes.status} for ${handle}`);
             let errorBody = apiRes.data;
             try {
                if (apiRes.data instanceof ArrayBuffer) {
                    errorBody = Buffer.from(apiRes.data).toString('utf-8');
                }
             } catch (e) { /* keep original arraybuffer if conversion fails */ }
             
             res.status(apiRes.status).send(errorBody);
             return;
        }
        
        console.log(`[PROXY] Successfully fetched data for ${handle}. Buffer length: ${apiRes.data.byteLength}`);
        
        res.setHeader('Content-Type', 'application/octet-stream');
        res.send(Buffer.from(apiRes.data)); // Send the raw binary data

    } catch (error) {
        console.error(`[PROXY] Error fetching from ViewStats API for ${handle}:`, error.response ? `${error.response.status} - ${error.response.statusText}` : error.message);
        if (error.response) {
            let errorBody = error.response.data;
             try {
                if (error.response.data instanceof ArrayBuffer) {
                    errorBody = Buffer.from(error.response.data).toString('utf-8');
                }
             } catch (e) { /* keep original arraybuffer if conversion fails */ }
            res.status(error.response.status).send(errorBody || 'Error fetching from upstream API.');
        } else {
            res.status(500).send('Internal proxy error.');
        }
    }
});

app.get('/health', (req, res) => {
    res.status(200).send('OK'); // Simple health check endpoint
});

app.listen(PORT, () => {
    console.log(`ViewStats Proxy server listening on port ${PORT}`);
}); 