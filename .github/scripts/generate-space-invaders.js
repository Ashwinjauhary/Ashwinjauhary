const https = require('https');
const fs = require('fs');

const USERNAME = process.env.GITHUB_USERNAME || 'Ashwinjauhary';
const TOKEN = process.env.GITHUB_TOKEN;

// Always fetch current year Jan 1 → Dec 31
const year = new Date().getFullYear();
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
      res.on('end', () => resolve(JSON.parse(data)));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function getColor(n) {
  if (n === 0) return '#161b22';
  if (n < 3)  return '#0e4429';
  if (n < 6)  return '#006d32';
  if (n < 9)  return '#26a641';
  return '#39d353';
}

function generateSVG(weeks) {
  const cs = 11, gap = 2, step = cs + gap;
  const cols = weeks.length, rows = 7;
  const pl = 20, pt = 70;          // pt = top padding (invader lives here)
  const W = cols * step + pl * 2;
  const H = rows * step + pt + 20;

  // Space invader pixel art (11×8)
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
  const ps = 2;
  const iw = 11 * ps;
  const ih = 8  * ps;

  const invaderShape = invPixels
    .map((row, ry) => row.map((px, rx) =>
      px ? `<rect x="${rx*ps}" y="${ry*ps}" width="${ps}" height="${ps}"/>` : ''
    ).join('')).join('');

  // All grid cells
  const cells = [];
  weeks.forEach((week, col) => {
    week.contributionDays.forEach((day, row) => {
      cells.push({ x: pl + col*step, y: pt + row*step, count: day.contributionCount, col, row });
    });
  });

  // Active (non-zero) cells sorted left→right, top→bottom
  const active = cells
    .filter(c => c.count > 0)
    .sort((a, b) => a.col - b.col || a.row - b.row);

  const N = active.length || 1;
  const totalDur = 40; // seconds for full loop

  // ── Grid cells ────────────────────────────────────────────────
  const gridSVG = cells.map(cell => {
    const idx = active.indexOf(cell);
    if (idx === -1)
      return `<rect x="${cell.x}" y="${cell.y}" width="${cs}" height="${cs}" rx="2" fill="${getColor(cell.count)}"/>`;

    const t0 = (idx / N).toFixed(5);
    const t1 = Math.min(idx / N + 0.018, 1).toFixed(5);
    return `<rect x="${cell.x}" y="${cell.y}" width="${cs}" height="${cs}" rx="2" fill="${getColor(cell.count)}">
      <animate attributeName="opacity" values="1;1;0;0" keyTimes="0;${t0};${t1};1" dur="${totalDur}s" repeatCount="indefinite"/>
    </rect>`;
  }).join('\n  ');

  // ── Invader stays at TOP, moves horizontally ──────────────────
  // Fixed Y = 4 (top of SVG, above grid)
  const invY = 4;
  const invTranslates = active
    .map(c => `${c.x + Math.floor(cs/2) - Math.floor(iw/2)},${invY}`)
    .join(';');
  const invKeyTimes = active
    .map((_, i) => (N > 1 ? i/(N-1) : 0).toFixed(5))
    .join(';');

  // ── Lasers ────────────────────────────────────────────────────
  const lasersSVG = active.map((cell, idx) => {
    const cx   = cell.x + Math.floor(cs/2);
    const yTop = invY + ih + 2;           // laser starts just below invader
    const yBot = cell.y + cs;             // laser ends at cell bottom
    const tStart = Math.max(0, idx/N - 0.004).toFixed(5);
    const tOn    = (idx/N).toFixed(5);
    const tOff   = Math.min(idx/N + 0.016, 1).toFixed(5);
    const tEnd   = Math.min(idx/N + 0.02,  1).toFixed(5);
    return `<line x1="${cx}" y1="${yTop}" x2="${cx}" y2="${yBot}" stroke="#ff3366" stroke-width="2" stroke-linecap="round">
      <animate attributeName="opacity" values="0;0;1;1;0;0" keyTimes="0;${tStart};${tOn};${tOff};${tEnd};1" dur="${totalDur}s" repeatCount="indefinite"/>
    </line>`;
  }).join('\n  ');

  // ── Explosion sparks ──────────────────────────────────────────
  const sparksSVG = active.map((cell, idx) => {
    const cx = cell.x + Math.floor(cs/2);
    const cy = cell.y + Math.floor(cs/2);
    const tOn  = (idx/N).toFixed(5);
    const tPeak= Math.min(idx/N + 0.012, 1).toFixed(5);
    const tOff = Math.min(idx/N + 0.025, 1).toFixed(5);
    return [[-4,-4],[4,-4],[0,-6],[-4,4],[4,4],[0,6],[-6,0],[6,0]]
      .map(([dx,dy]) =>
        `<circle cx="${cx+dx}" cy="${cy+dy}" r="1.5" fill="#9b5de5">
          <animate attributeName="opacity" values="0;0;1;0;0" keyTimes="0;${tOn};${tPeak};${tOff};1" dur="${totalDur}s" repeatCount="indefinite"/>
          <animate attributeName="r"       values="0;0;2;0;0" keyTimes="0;${tOn};${tPeak};${tOff};1" dur="${totalDur}s" repeatCount="indefinite"/>
        </circle>`
      ).join('');
  }).join('\n  ');

  // ── Year label ────────────────────────────────────────────────
  const yearLabel = `<text x="${W - pl}" y="${H - 6}" text-anchor="end" font-family="monospace" font-size="10" fill="#8899aa">${year} contributions</text>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="#060c14" rx="8"/>

  <!-- Starfield -->
  ${Array.from({length:40},(_,i)=>{
    const sx=Math.floor((i*137.5)%W);
    const sy=Math.floor((i*97.3)%(pt-14))+4;
    const delay=(i*0.3%3).toFixed(1);
    return `<circle cx="${sx}" cy="${sy}" r="1" fill="#ffffff" opacity="0.4">
      <animate attributeName="opacity" values="0.4;1;0.4" dur="2s" begin="${delay}s" repeatCount="indefinite"/>
    </circle>`;
  }).join('')}

  <!-- Space Invader (top, horizontal movement) -->
  <g fill="#9b5de5">
    <animateTransform attributeName="transform" type="translate"
      values="${invTranslates}"
      keyTimes="${invKeyTimes}"
      dur="${totalDur}s"
      repeatCount="indefinite"
      calcMode="discrete"/>
    ${invaderShape}
  </g>

  <!-- Lasers -->
  ${lasersSVG}

  <!-- Explosion Sparks -->
  ${sparksSVG}

  <!-- Contribution Grid -->
  ${gridSVG}

  <!-- Year Label -->
  ${yearLabel}
</svg>`;
}

async function main() {
  const result = await fetchContributions();
  const weeks = result.data.user.contributionsCollection.contributionCalendar.weeks;
  const svg = generateSVG(weeks);
  fs.mkdirSync('dist', { recursive: true });
  fs.writeFileSync('dist/space-invaders.svg', svg);
  console.log(`✅ Generated dist/space-invaders.svg (${year} contributions)`);
}

main().catch(e => { console.error(e); process.exit(1); });
