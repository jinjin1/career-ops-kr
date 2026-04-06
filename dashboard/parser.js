// career-ops-kr: applications.md 파서
// 브라우저: <script src="parser.js"> 로 글로벌 함수 등록
// Node.js: dashboard.test.mjs에서 동적 임포트

const STATUS_MAP = {
  '평가완료': 'evaluated',
  '지원완료': 'applied',
  '회신': 'responded',
  '면접': 'interview',
  '오퍼': 'offer',
  '불합격': 'rejected',
  '포기': 'discarded',
  '패스': 'skip'
};

function parseApplications(text) {
  const lines = text.split('\n');
  const data = [];

  for (const line of lines) {
    if (!line.startsWith('|') || line.includes('---') || line.includes('# ')) continue;
    const cols = line.split('|').map(c => c.trim()).filter(c => c);
    if (cols.length < 8) continue;
    if (cols[0] === '#' || cols[0] === '번호') continue;
    const score = parseFloat(cols[3]);
    if (isNaN(score)) continue;

    const statusKey = STATUS_MAP[cols[4]];
    if (!statusKey) {
      console.warn('Unknown status:', cols[4]);
    }

    data.push({
      id: cols[0],
      company: cols[1],
      role: cols[2],
      score: score,
      status: cols[4],
      statusKey: statusKey || 'evaluated',
      date: cols[5],
      report: cols[6],
      url: cols[7],
      note: cols[8] || ''
    });
  }

  return data;
}
