const fs = require('fs');

const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'sv-SE,sv;q=0.9,en-US;q=0.8,en;q=0.7',
  'Sec-Fetch-Dest': 'empty',
  'Sec-Fetch-Mode': 'cors',
  'Sec-Fetch-Site': 'same-origin'
};

async function run() {
  console.log('Startar hämtning av erbjudanden...');

  // URL:er direkt mot källorna (utan proxy)
  const mecenatUrl = 'https://www.mecenatalumni.com/service/falcon/v2/se/f/query?site=alumni';
  const hyresgastUrl = 'https://www.hyresgastforeningen.se/api/benefitlistingblock/?benefitListingBlockId=1ab9cc507df44e629eb3bf6584c5cc80&itemsLimit=6000&randomSortOrderSeed=825241421';
  const icaUrl = 'https://www.ica.se/stammis/partnererbjudanden/alla-erbjudanden/';

  let mecenatData = null;
  let hyresgastData = null;
  let icaHtml = null;

  // 1. Mecenat Alumni (API)
  try {
    console.log(`Anropar Mecenat: ${mecenatUrl}`);
    const mecenatRes = await fetch(mecenatUrl, {
      method: 'GET',
      headers: BROWSER_HEADERS
    });
    console.log(`Mecenat Status: ${mecenatRes.status}`);
    if (mecenatRes.ok) {
      mecenatData = await mecenatRes.json();
    }
  } catch (err) {
    console.error('Mecenat fel:', err.message);
  }

  // 2. Hyresgästföreningen (API / JSON)
  try {
    console.log(`Anropar Hyresgästföreningen: ${hyresgastUrl}`);
    const hyresgastRes = await fetch(hyresgastUrl, {
      headers: BROWSER_HEADERS
    });
    console.log(`Hyresgästföreningen Status: ${hyresgastRes.status}`);
    if (hyresgastRes.ok) {
      hyresgastData = await hyresgastRes.json();
    }
  } catch (err) {
    console.error('Hyresgästföreningen fel:', err.message);
  }

  // 3. ICA (HTML)
  try {
    console.log(`Anropar ICA: ${icaUrl}`);
    const icaRes = await fetch(icaUrl, {
      headers: {
        ...BROWSER_HEADERS,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate'
      }
    });
    console.log(`ICA Status: ${icaRes.status}`);
    if (icaRes.ok) {
      icaHtml = await icaRes.text();
    }
  } catch (err) {
    console.error('ICA fel:', err.message);
  }

  // Spara allt i data.json
  const finalData = {
    updatedAt: new Date().toISOString(),
    mecenat: mecenatData,
    hyresgast: hyresgastData,
    icaHtml: icaHtml
  };

  fs.writeFileSync('data.json', JSON.stringify(finalData, null, 2));
  console.log('data.json uppdaterad!');
}

run();
