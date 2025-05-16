// about-renderer.js
document.addEventListener('DOMContentLoaded', async () => {
  // 앱 버전 표시
  const appVersion = await window.aboutAPI.getAppVersion();
  document.getElementById('app-version').textContent = `v${appVersion}`;
  
  // 링크 설정
  document.getElementById('website-link').addEventListener('click', () => {
    window.aboutAPI.openExternalLink('https://memowave.example.com');
  });
  
  document.getElementById('github-link').addEventListener('click', () => {
    window.aboutAPI.openExternalLink('https://github.com/memowave/memowave-app');
  });
  
  document.getElementById('support-link').addEventListener('click', () => {
    window.aboutAPI.openExternalLink('https://memowave.example.com/support');
  });
}); 