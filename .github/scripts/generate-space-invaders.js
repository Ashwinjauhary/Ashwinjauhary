const https = require('https');
const fs = require('fs');

const USERNAME = process.env.GITHUB_USERNAME || 'Ashwinjauhary';
const TOKEN = process.env.GITHUB_TOKEN;

const year = 2025;
const FROM = `${year}-01-01T00:00:00Z`;
const TO   = `${year}-12-31T23:59:59Z`;

const query = `query($username: String!, $from: DateTime!, $to: DateTime!) {
  user(login: $username) {
    contributionsCollection(from: $from, to: $to) {
      contributionCalendar {
        weeks {
          contributionDays {
            contributionCount
          }
        }
      }
    }
  }
}`;

function fetchContributions() {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ query, variables: { username: USERNAME, from: FROM, to: TO } });
    const req = https.request({
      hostname: 'api.github.com',
      path: '/graphql',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Content-Type': 'application/json',
        'User-Agent': 'space-invaders-gen'
      }
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        const parsed = JSON.parse(data);
        if (parsed.errors) { console.error('GraphQL errors:', JSON.stringify(parsed.errors)); process.exit(1); }
        resolve(parsed);
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// Richer color palette — zero cells get a visible dim color
function getColor(n) {
  if (n === 0) return '#1a2332';   // dim blue-gray (visible, not plain black)
  if (n < 2)   return '#0d4a2a';
  if (n < 5)   return '#1a7a3a';
  if (n < 10)  return '#26c050';
  if (n < 20)  return '#39e85a';
  return '#57ff7a';                // bright lime for heavy days
}

function getBorder(n) {
  if (n === 0) return '#243040';
  if (n < 5)   return '#1e6b33';
  return '#2dba4e';
}

function generateSVG(weeksRaw) {
  const weeks = [...weeksRaw];
  console.log(`📅 Year: ${year} | Total weeks: ${weeks.length}`);

  // Bigger cells for a bolder look
  const cs = 13, gap = 3, step = cs + gap;
  const cols = weeks.length, rows = 7;
  const pl = 24, pt = 80;
  const W = cols * step + pl * 2;
  const H = rows * step + pt + 28;

  // Invader pixel art 11×8 (scaled up)
  const invPixels = [
    [0,0,1,0,0,0,0,0,1,0,0],
    [0,0,0,1,0,0,0,1,0,0,0],
    [0,0,1,1,1,1,1,1,1,0,0],
    [0,1,1,0,1,1,1,0,1,1,0],
    [1,1,1,1,1,1,1,1,1,1,1],
    [1,0,1,1,1,1,1,1,1,0,1],
    [1,0,1,0,0,0,0,0,1,0,1],
    [0,0,0,1,1,0,1,1,0,0,0],
  ];
  const ps = 3; // bigger pixels for invader
  const iw = 11 * ps;
  const ih = 8  * ps;
  const invY = 5;

  const invaderShape = invPixels
    .map((row, ry) => row.map((px, rx) =>
      px ? `<rect x="${rx*ps}" y="${ry*ps}" width="${ps}" height="${ps}"/>` : ''
    ).join('')).join('');

  // All cells
  const cells = [];
  weeks.forEach((week, col) => {
    week.contributionDays.forEach((day, row) => {
      cells.push({ x: pl + col*step, y: pt + row*step, count: day.contributionCount });
    });
  });

  const active = cells
    .filter(c => c.count > 0)
    .sort((a, b) => a.x - b.x || a.y - b.y);

  const N = active.length || 1;
  const totalDur = 45;
  console.log(`✅ Active cells: ${N}`);

  // Grid — zero cells get visible dim style + subtle border
  const gridSVG = cells.map(cell => {
    const idx = active.indexOf(cell);
    const fill   = getColor(cell.count);
    const stroke = getBorder(cell.count);
    const sw     = cell.count > 0 ? '0.5' : '0.3';

    if (idx === -1) {
      // non-active: static dim cell
      return `<rect x="${cell.x}" y="${cell.y}" width="${cs}" height="${cs}" rx="3" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;
    }

    const t0 = (idx / N).toFixed(5);
    const t1 = Math.min(idx / N + 0.015, 1).toFixed(5);

    // Flash white on hit, then disappear
    return `<rect x="${cell.x}" y="${cell.y}" width="${cs}" height="${cs}" rx="3" fill="${fill}" stroke="${stroke}" stroke-width="${sw}">
      <animate attributeName="fill"    values="${fill};#ffffff;#1a2332;#1a2332" keyTimes="0;${t0};${t1};1" dur="${totalDur}s" repeatCount="indefinite"/>
      <animate attributeName="opacity" values="1;1;1;0.25"                     keyTimes="0;${t0};${t1};1" dur="${totalDur}s" repeatCount="indefinite"/>
    </rect>`;
  }).join('\n  ');

  // Invader horizontal movement
  const invTranslates = active
    .map(c => `${c.x + Math.floor(cs/2) - Math.floor(iw/2)},${invY}`)
    .join(';');
  const invKeyTimes = active
    .map((_, i) => (N > 1 ? i/(N-1) : 0).toFixed(5))
    .join(';');

  // Laser — longer, glowing
  const lasersSVG = active.map((cell, idx) => {
    const cx     = cell.x + Math.floor(cs/2);
    const yTop   = invY + ih + 2;
    const yBot   = cell.y + cs;
    const tStart = Math.max(0, idx/N - 0.003).toFixed(5);
    const tOn    = (idx/N).toFixed(5);
    const tOff   = Math.min(idx/N + 0.014, 1).toFixed(5);
    const tEnd   = Math.min(idx/N + 0.018, 1).toFixed(5);
    return `
    <line x1="${cx}" y1="${yTop}" x2="${cx}" y2="${yBot}" stroke="#ff2255" stroke-width="2.5" stroke-linecap="round" opacity="0">
      <animate attributeName="opacity" values="0;0;1;1;0;0" keyTimes="0;${tStart};${tOn};${tOff};${tEnd};1" dur="${totalDur}s" repeatCount="indefinite"/>
    </line>
    <line x1="${cx}" y1="${yTop}" x2="${cx}" y2="${yBot}" stroke="#ff88aa" stroke-width="1" stroke-linecap="round" opacity="0">
      <animate attributeName="opacity" values="0;0;0.6;0.6;0;0" keyTimes="0;${tStart};${tOn};${tOff};${tEnd};1" dur="${totalDur}s" repeatCount="indefinite"/>
    </line>`;
  }).join('\n  ');

  // Explosion sparks — bigger burst
  const sparksSVG = active.map((cell, idx) => {
    const cx   = cell.x + Math.floor(cs/2);
    const cy   = cell.y + Math.floor(cs/2);
    const tOn  = (idx/N).toFixed(5);
    const tPk  = Math.min(idx/N + 0.010, 1).toFixed(5);
    const tOff = Math.min(idx/N + 0.022, 1).toFixed(5);
    const sparks = [
      [-6,-6,'#ff3366'],[ 6,-6,'#ff3366'],[ 0,-8,'#ffaa00'],
      [-6, 6,'#9b5de5'],[ 6, 6,'#9b5de5'],[ 0, 8,'#ffaa00'],
      [-8, 0,'#ffffff'],[ 8, 0,'#ffffff'],
      [-4,-4,'#ff88cc'],[ 4,-4,'#ff88cc'],[-4, 4,'#cc88ff'],[ 4, 4,'#cc88ff'],
    ];
    return sparks.map(([dx,dy,color]) =>
      `<circle cx="${cx+dx}" cy="${cy+dy}" r="2" fill="${color}" opacity="0">
        <animate attributeName="opacity" values="0;0;1;0;0" keyTimes="0;${tOn};${tPk};${tOff};1" dur="${totalDur}s" repeatCount="indefinite"/>
        <animate attributeName="r"       values="0;0;2.5;0;0" keyTimes="0;${tOn};${tPk};${tOff};1" dur="${totalDur}s" repeatCount="indefinite"/>
      </circle>`
    ).join('');
  }).join('\n');

  // Scanline overlay for retro feel
  const scanlines = Array.from({length: Math.floor(H/4)}, (_, i) =>
    `<line x1="0" y1="${i*4}" x2="${W}" y2="${i*4}" stroke="#000000" stroke-width="0.4" opacity="0.15"/>`
  ).join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <!-- Background gradient -->
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%"   stop-color="#060c18"/>
      <stop offset="100%" stop-color="#020608"/>
    </linearGradient>
    <filter id="glow">
      <feGaussianBlur stdDeviation="2" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)" rx="10"/>

  <!-- Starfield -->
  ${Array.from({length:60},(_,i)=>{
    const sx=Math.floor((i*137.5+23)%W);
    const sy=Math.floor((i*79.3+11)%(pt-16))+4;
    const r =(i%3===0)?1.5:(i%3===1?1:0.6);
    const dl=(i*0.25%4).toFixed(1);
    const dur=(1.5+i%3).toFixed(1);
    return `<circle cx="${sx}" cy="${sy}" r="${r}" fill="#ffffff" opacity="${0.3+i%3*0.15}">
      <animate attributeName="opacity" values="${0.2+i%3*0.1};${0.7+i%3*0.1};${0.2+i%3*0.1}" dur="${dur}s" begin="${dl}s" repeatCount="indefinite"/>
    </circle>`;
  }).join('')}

  <!-- Contribution Grid -->
  ${gridSVG}

  <!-- Space Invader (with glow) -->
  <g fill="#b06aff" filter="url(#glow)">
    <animateTransform attributeName="transform" type="translate"
      values="${invTranslates}" keyTimes="${invKeyTimes}"
      dur="${totalDur}s" repeatCount="indefinite" calcMode="discrete"/>
    ${invaderShape}
  </g>

  <!-- Lasers -->
  ${lasersSVG}

  <!-- Sparks -->
  ${sparksSVG}

  <!-- Scanlines -->
  ${scanlines}

  <!-- Year label -->
  <text x="${W-pl}" y="${H-8}" text-anchor="end" font-family="'Courier New',monospace" font-size="11" fill="#9b5de5" opacity="0.8">${year} contributions</text>
</svg>`;
}

async function main() {
  console.log(`🚀 Fetching ${year} contributions for ${USERNAME}`);
  const result = await fetchContributions();
  const weeks = result.data.user.contributionsCollection.contributionCalendar.weeks;
  const svg = generateSVG(weeks);
  fs.mkdirSync('dist', { recursive: true });
  fs.writeFileSync('dist/space-invaders.svg', svg);
  console.log(`✅ Done → dist/space-invaders.svg`);
}

main().catch(e => { console.error(e); process.exit(1); });
