const SPREADSHEET_ID = '1qiRF16JhUlDBV9ZvoO6YhA5JnCbjqFcs';

const SPORT_SHEETS = [
  { id:'bola-sepak', sheet:'BOLA SEPAK' },
  { id:'bola-jaring', sheet:'BOLA JARING' },
  { id:'bola-tampar-lelaki', sheet:'BOLA TAMPAR LELAKI' },
  { id:'bola-tampar-wanita', sheet:'BOLA TAMPAR WANITA' },
  { id:'futsal-lelaki', sheet:'FUTSAL LELAKI' },
  { id:'futsal-wanita', sheet:'FUTSAL WANITA' },
  { id:'badminton-berpasukan', sheet:'BADMINTON BERPASUKAN' },
  { id:'karom-berpasukan', sheet:'KAROM BERPASUKAN' },
  { id:'dart-berpasukan', sheet:'DART BERPASUKAN' },
  { id:'sepak-takraw-regu', sheet:'SEPAK TAKRAW REGU' },
  { id:'ping-pong-berpasukan', sheet:'PING PONG BERPASUKAN' },
  { id:'tarik-tali-680kg', sheet:'TARIK TALI (680KG)' },
  { id:'tarik-tali-freeweight', sheet:'TARIK TALI (FREEWEIGHT)' }
];

function doGet(e) {
  const callback = safeCallback_(e && e.parameter && e.parameter.callback);
  try {
    const payload = buildPayload_();
    return ContentService
      .createTextOutput(callback + '(' + JSON.stringify(payload) + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  } catch (err) {
    const payload = { ok:false, error:String(err && err.message ? err.message : err) };
    return ContentService
      .createTextOutput(callback + '(' + JSON.stringify(payload) + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
}

function safeCallback_(value) {
  const v = String(value || 'suknaCallback');
  return /^[A-Za-z_$][0-9A-Za-z_$\.]*$/.test(v) ? v : 'suknaCallback';
}

function clean_(v) {
  return String(v == null ? '' : v).replace(/\s+/g,' ').trim();
}

function norm_(v) {
  return clean_(v).toLowerCase()
    .replace(/[^a-z0-9]+/g,' ')
    .replace(/\s+/g,' ')
    .trim();
}

function findSheet_(ss, wanted) {
  const target = norm_(wanted);
  const sheets = ss.getSheets();
  for (let i=0;i<sheets.length;i++) {
    if (norm_(sheets[i].getName()) === target) return sheets[i];
  }
  return null;
}

function findMeta_(grid, label) {
  const target = norm_(label);
  for (let r=0;r<grid.length;r++) {
    for (let c=0;c<grid[r].length;c++) {
      if (norm_(grid[r][c]) === target) {
        for (let j=c+1;j<grid[r].length;j++) {
          const v = clean_(grid[r][j]);
          if (v) return v;
        }
      }
    }
  }
  return '';
}

function headerIndices_(row, predicate) {
  const out=[];
  for (let i=0;i<row.length;i++) if (predicate(norm_(row[i]))) out.push(i);
  return out;
}

function headerIndex_(row, predicate) {
  const found=headerIndices_(row,predicate);
  return found.length ? found[0] : -1;
}

function findMatchHeader_(grid) {
  for (let r=0;r<grid.length;r++) {
    const noIdx=headerIndex_(grid[r], v => v.indexOf('no per')===0 || v==='bil' || v==='bilangan perlawanan');
    const teams=headerIndices_(grid[r], v => v==='pasukan');
    if (noIdx>=0 && teams.length>=2) return r;
  }
  return -1;
}

function isoDate_(display) {
  const s=clean_(display);
  if (!s) return '';
  let m=s.match(/\b(\d{1,2})\s*[\/.\-]\s*(\d{1,2})(?:\s*[\/.\-]\s*(\d{2,4}))?/);
  if (m) {
    let y=Number(m[3] || 2026); if (y<100) y+=2000;
    return y + '-' + String(Number(m[2])).padStart(2,'0') + '-' + String(Number(m[1])).padStart(2,'0');
  }
  m=s.match(/\b(\d{1,2})\s*(?:sep|sept|september)\w*\s*(\d{4})?/i);
  if (m) return String(m[2] || 2026) + '-09-' + String(Number(m[1])).padStart(2,'0');
  return '';
}

function time24_(display) {
  const s=clean_(display).toLowerCase();
  if (!s) return '';
  const m=s.match(/\b(\d{1,2})[:.](\d{2})(?::\d{2})?\s*(am|pm)?\b/i);
  if (!m) return '';
  let h=Number(m[1]), min=Number(m[2]);
  const ap=String(m[3]||'').toLowerCase();
  if (ap==='pm' && h<12) h+=12;
  if (ap==='am' && h===12) h=0;
  return String(h).padStart(2,'0') + ':' + String(min).padStart(2,'0');
}

function roundFromRow_(row,current) {
  const blob=norm_(row.join(' '));
  if (blob.indexOf('separuh akhir')>=0) return 'Separuh Akhir';
  if (blob.indexOf('grand final')>=0) return 'Grand Final';
  if (/(^| )akhir( |$)|(^| )final( |$)/.test(blob)) return 'Akhir';
  return current;
}

function resultAfterTeamB_(row, teamBCol, resultHeaderCol) {
  // Official layout:
  // Team B | score kiri | : | score kanan
  const start = teamBCol>=0 ? teamBCol+1 : Math.max(0,resultHeaderCol);
  const end = Math.min(row.length-1,start+8);

  for (let c=start;c<=end;c++) {
    if (/^\s*:\s*$/.test(clean_(row[c]))) {
      const left=clean_(row[c-1]);
      const right=clean_(row[c+1]);
      if (left && right && left!==':' && right!==':') return left + ' : ' + right;
    }
  }

  for (let c=start;c<=end;c++) {
    const v=clean_(row[c]);
    const m=v.match(/^\s*(\d+)\s*[:\-–—]\s*(\d+)\s*$/);
    if (m) return m[1] + ' : ' + m[2];
  }

  if (resultHeaderCol>=0) {
    const vals=[];
    for (let c=resultHeaderCol;c<=Math.min(row.length-1,resultHeaderCol+5);c++) {
      const v=clean_(row[c]);
      if (!v || v===':' || v==='-' || v==='–' || v==='—') continue;
      vals.push(v);
    }
    const nums=vals.filter(v => /^-?\d+(?:\.\d+)?$/.test(v));
    if (nums.length>=2) return nums[0] + ' : ' + nums[1];
    if (vals.length===1 && !/^\d+(?:\.\d+)?$/.test(vals[0])) return vals[0];
  }
  return '';
}

function parseSport_(sheet, id) {
  const range=sheet.getDataRange();
  const grid=range.getDisplayValues();

  const name=findMeta_(grid,'ACARA') || clean_(sheet.getName());
  const dateLabel=findMeta_(grid,'TARIKH');
  const venue=findMeta_(grid,'TEMPAT');
  const headerRow=findMatchHeader_(grid);

  if (headerRow<0) {
    return { id:id, name:name, dateLabel:dateLabel, venue:venue, matches:[] };
  }

  const h=grid[headerRow];
  const idxNo=headerIndex_(h,v=>v.indexOf('no per')===0 || v==='bil' || v==='bilangan perlawanan');
  const idxDate=headerIndex_(h,v=>v==='tarikh');
  const idxTime=headerIndex_(h,v=>v==='masa' || v==='waktu' || v==='jam');
  const idxCourt=headerIndex_(h,v=>v==='glg' || v==='gelanggang' || v==='court');
  const idxRef=headerIndex_(h,v=>v==='kump' || v==='kumpulan' || v==='rujukan');
  const teamCols=headerIndices_(h,v=>v==='pasukan');
  const idxTeamA=teamCols.length ? teamCols[0] : -1;
  const idxTeamB=teamCols.length>1 ? teamCols[1] : -1;
  const idxResult=headerIndex_(h,v=>v==='keputusan' || v==='result');

  let currentDate='',currentTime='',currentRound='Liga Kumpulan';
  const matches=[];

  for (let r=headerRow+1;r<grid.length;r++) {
    const row=grid[r];
    currentRound=roundFromRow_(row,currentRound);

    const noRaw=idxNo>=0 ? clean_(row[idxNo]) : '';
    if (!/^\d+(?:\.0+)?$/.test(noRaw)) continue;

    const rowDate=idxDate>=0 ? isoDate_(row[idxDate]) : '';
    const rowTime=idxTime>=0 ? time24_(row[idxTime]) : '';
    if (rowDate) currentDate=rowDate;
    if (rowTime) currentTime=rowTime;

    matches.push({
      no:Number(noRaw),
      date:currentDate,
      time:currentTime,
      court:idxCourt>=0 ? clean_(row[idxCourt]).replace(/\.0$/,'') : '',
      round:currentRound,
      reference:idxRef>=0 ? clean_(row[idxRef]) : '',
      teamA:idxTeamA>=0 ? clean_(row[idxTeamA]) : '',
      teamB:idxTeamB>=0 ? clean_(row[idxTeamB]) : '',
      result:resultAfterTeamB_(row,idxTeamB,idxResult),
      sourceRow:r+1
    });
  }

  return { id:id, name:name, dateLabel:dateLabel, venue:venue, matches:matches };
}

function parseMedals_(sheet) {
  if (!sheet) return [];
  const grid=sheet.getDataRange().getDisplayValues();
  let header=-1, ic=-1,ig=-1,is=-1,ib=-1;

  for (let r=0;r<grid.length;r++) {
    const row=grid[r].map(norm_);
    ic=row.findIndex(v=>v==='kontinjen' || v==='zon' || v==='pasukan');
    ig=row.findIndex(v=>v==='emas' || v==='gold');
    is=row.findIndex(v=>v==='perak' || v==='silver');
    ib=row.findIndex(v=>v==='gangsa' || v==='bronze');
    if (ic>=0 && ig>=0 && is>=0 && ib>=0) { header=r; break; }
  }
  if (header<0) return [];

  const out=[];
  for (let r=header+1;r<grid.length;r++) {
    const contingent=clean_(grid[r][ic]);
    if (!contingent) continue;
    const num=v => clean_(v)==='' ? null : Number(clean_(v));
    out.push({
      contingent:contingent,
      gold:num(grid[r][ig]),
      silver:num(grid[r][is]),
      bronze:num(grid[r][ib])
    });
  }
  return out;
}

function buildPayload_() {
  const ss=SpreadsheetApp.openById(SPREADSHEET_ID);
  const sports=[];

  SPORT_SHEETS.forEach(cfg => {
    const sheet=findSheet_(ss,cfg.sheet);
    if (sheet) sports.push(parseSport_(sheet,cfg.id));
  });

  const medalSheet=findSheet_(ss,'PINGAT');
  const medals=parseMedals_(medalSheet);

  return {
    ok:true,
    build:'apps-script-v7',
    spreadsheetId:SPREADSHEET_ID,
    spreadsheetName:ss.getName(),
    updated:new Date().toISOString(),
    sports:sports,
    medals:medals
  };
}

// Run this manually in Apps Script editor to test.
// View > Logs should show score values already entered in the sheet.
function testPayload() {
  Logger.log(JSON.stringify(buildPayload_(),null,2));
}
