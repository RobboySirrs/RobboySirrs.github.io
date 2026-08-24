const fs = require('fs');

const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'sv-SE,sv;q=0.9,en-US;q=0.8,en;q=0.7',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Sec-Fetch-User': '?1',
  'Upgrade-Insecure-Requests': '1'
};

async function fetchSafely(url, isJson = false) {
  try {
    const res = await fetch(url, { headers: BROWSER_HEADERS });
    
    // Logga statusen i GitHub Actions så du ser vad som händer
    console.log(`Anropar: ${url} -> Status: ${res.status}`);
    
    if (!res.ok) {
      console.error(`Misslyckades med status ${res.status} för ${url}`);
      return null;
    }
    
    return isJson ? await res.json() : await res.text();
  } catch (err) {
    console.error(`Fel vid hmtning av ${url}:`, err.message);
    return null;
  }
}

async function run() {
  console.log('Startar hmtning...');

  // Byt ut dessa mot dina faktiska URL:er
  const mecenatUrl = 'DIN_MECENAT_API_URL';
  const icaUrl = 'DIN_ICA_URL';
  const hyresgastUrl = 'DIN_HYRESGAST_URL';

  const mecenatData = await fetchSafely(mecenatUrl, true);
  const icaHtml = await fetchSafely(icaUrl, false);
  const hyresgastHtml = await fetchSafely(hyresgastUrl, false);

  const finalData = {
    updatedAt: new Date().toISOString(),
    mecenat: mecenatData,
    icaHtml: icaHtml,
    hyresgastHtml: hyresgastHtml
  };

  fs.writeFileSync('data.json', JSON.stringify(finalData, null, 2));
  console.log('data.json uppdaterad!');
}

run();
