const fs = require('fs');

async function run() {
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  };

  try {
    console.log('Hämtar data...');
    
    // Anrop utan proxy!
    const mecenatRes = await fetch('https://api.mecenat.com/...', { headers });
    const mecenatData = await mecenatRes.json();

    const icaRes = await fetch('https://www.ica.se/api/...', { headers });
    const icaData = await icaRes.json();

    const hyresgastRes = await fetch('https://www.hyresgastforeningen.se/api/...', { headers });
    const hyresgastData = await hyresgastRes.json();

    const finalData = {
      updatedAt: new Date().toISOString(),
      mecenat: mecenatData,
      ica: icaData,
      hyresgast: hyresgastData
    };

    // Spara till data.json i rotmappen
    fs.writeFileSync('data.json', JSON.stringify(finalData, null, 2));
    console.log('data.json skapad framgångsrikt!');
  } catch (err) {
    console.error('Ett fel uppstod:', err);
    process.exit(1);
  }
}

run();
