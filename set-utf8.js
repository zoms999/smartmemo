// set-utf8.js
// 콘솔 출력 인코딩을 UTF-8로 설정하기 위한 스크립트

const { spawn } = require('child_process');
const path = require('path');

// Windows에서만 실행
if (process.platform === 'win32') {
  // PowerShell 명령어로 콘솔 코드 페이지를 UTF-8(65001)로 설정
  console.log('콘솔 코드 페이지를 UTF-8로 설정합니다...');

  const ps = spawn('powershell', [
    '-command',
    '[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; ' +
    '$OutputEncoding = [System.Text.Encoding]::UTF8; ' +
    'chcp 65001 | Out-Null; ' +
    'Write-Host "콘솔 인코딩이 UTF-8로 설정되었습니다." -ForegroundColor Green;'
  ]);

  ps.stdout.on('data', (data) => {
    console.log(data.toString());
  });

  ps.stderr.on('data', (data) => {
    console.error(`PowerShell 오류: ${data}`);
  });

  ps.on('close', (code) => {
    if (code !== 0) {
      console.log(`PowerShell 프로세스가 종료 코드 ${code}로 종료되었습니다.`);
    }
  });
}

// process.env 환경 변수에 UTF-8 설정 추가
process.env.LANG = 'ko_KR.UTF-8';
process.env.LC_ALL = 'ko_KR.UTF-8';

// Node.js stdout/stderr에 UTF-8 설정
if (process.stdout.isTTY) {
  process.stdout.setEncoding('utf8');
}
if (process.stderr.isTTY) {
  process.stderr.setEncoding('utf8');
}

module.exports = {
  ensureUtf8Console: () => {
    // 이미 설정됨
    return true;
  }
};
