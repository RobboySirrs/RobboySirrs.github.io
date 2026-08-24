const fs = require('fs');

async function fetchTextSafely(url, headers) {
  try {
    const res = await fetch(url, { headers });
    if (!res.ok) {
      console.error(`Fel vid ${url}: Status ${res.status}`);
      return null;
    }
    return await res.text();
  } catch (err) {
    console.error(`Nätverksfel för ${url}:`, err.message);
    return null;
  }
}

async function run() {
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
  };

  console.log('Hämtar data...');

  // 1. Mecenat (JSON)
  let mecenatData = null;
  try {
    const mecenatRes = await fetch('DIN_MECENAT_URL_HÄR', { headers });
    if (mecenatRes.ok) mecenatData = await mecenatRes.json();
  } catch (e) {
    console.error('Mecenat fel:', e.message);
  }

  // 2. ICA (HTML-sida)
  const icaHtml = await fetchTextSafely('https://www.ica.se/ERBJUDANDE_URL_HÄR', headers);

  // 3. Hyresgästföreningen (HTML-sida)
  const hyresgastHtml = await fetchTextSafely('https://www.hyresgastforeningen.se/ERBJUDANDE_URL_HÄR', headers);

  // Här kan du antingen spara ned rå HTML eller köra din regex/skrapningslogik direkt!
  const finalData = {
    updatedAt: new Date().toISOString(),
    mecenat: mecenatData,
    icaHtml: icaHtml,
    hyresgastHtml: hyresgastHtml
  };

  fs.writeFileSync('data.json', JSON.stringify(finalData, null, 2));
  console.log('data.json sparad!');
}

run();
      
