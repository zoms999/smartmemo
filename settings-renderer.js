// settings-renderer.js
document.addEventListener('DOMContentLoaded', async () => {
  // DOM 요소
  const themeSelect = document.getElementById('theme-select');
  const fontSizeSelect = document.getElementById('font-size-select');
  const autoStartCheckbox = document.getElementById('auto-start-checkbox');
  const showNotificationsCheckbox = document.getElementById('show-notifications-checkbox');
  const appVersionElement = document.getElementById('app-version');
  const saveBtn = document.getElementById('save-btn');
  const resetBtn = document.getElementById('reset-btn');
  const checkUpdateBtn = document.getElementById('check-update-btn');
  
  // 앱 버전 표시
  const appVersion = await window.settingsAPI.getAppVersion();
  appVersionElement.textContent = `v${appVersion}`;
  
  // 설정 불러오기
  const settings = await window.settingsAPI.getSettings();
  
  // UI에 현재 설정 표시
  themeSelect.value = settings.theme;
  fontSizeSelect.value = settings.fontSize.toString();
  autoStartCheckbox.checked = settings.autoStart;
  showNotificationsCheckbox.checked = settings.showNotifications;
  
  // 설정 저장
  saveBtn.addEventListener('click', async () => {
    const updatedSettings = {
      theme: themeSelect.value,
      fontSize: parseInt(fontSizeSelect.value, 10),
      autoStart: autoStartCheckbox.checked,
      showNotifications: showNotificationsCheckbox.checked
    };
    
    const result = await window.settingsAPI.updateSettings(updatedSettings);
    
    if (result.success) {
      showToast('설정이 저장되었습니다.');
      
      // 적용된 설정이 있다면 필요에 따라 UI 업데이트
      if (updatedSettings.theme !== settings.theme) {
        // 테마 변경 적용
        document.documentElement.setAttribute('data-theme', updatedSettings.theme);
      }
    } else {
      showToast('설정 저장 중 오류가 발생했습니다.', 'error');
    }
  });
  
  // 기본 설정으로 초기화
  resetBtn.addEventListener('click', async () => {
    const defaultSettings = {
      theme: 'system',
      fontSize: 14,
      autoStart: false,
      showNotifications: true
    };
    
    // UI 업데이트
    themeSelect.value = defaultSettings.theme;
    fontSizeSelect.value = defaultSettings.fontSize.toString();
    autoStartCheckbox.checked = defaultSettings.autoStart;
    showNotificationsCheckbox.checked = defaultSettings.showNotifications;
    
    // 설정 저장
    const result = await window.settingsAPI.updateSettings(defaultSettings);
    
    if (result.success) {
      showToast('설정이 초기화되었습니다.');
    } else {
      showToast('설정 초기화 중 오류가 발생했습니다.', 'error');
    }
  });
  
  // 업데이트 확인
  checkUpdateBtn.addEventListener('click', () => {
    checkUpdateBtn.textContent = '확인 중...';
    checkUpdateBtn.disabled = true;
    
    window.settingsAPI.checkForUpdates();
    
    // 10초 후 버튼 복원 (실제로는 업데이트 결과에 따라 처리해야 함)
    setTimeout(() => {
      checkUpdateBtn.textContent = '업데이트 확인';
      checkUpdateBtn.disabled = false;
      showToast('업데이트를 확인했습니다. 최신 버전이 있으면 알림이 표시됩니다.');
    }, 3000);
  });
  
  // 업데이트 이벤트 수신
  window.settingsAPI.onUpdateAvailable((info) => {
    showUpdateDialog(info, '새 버전이 사용 가능합니다', '지금 다운로드하시겠습니까?');
  });
  
  window.settingsAPI.onUpdateDownloaded((info) => {
    showUpdateDialog(info, '업데이트가 다운로드되었습니다', '지금 설치하시겠습니까?');
  });
  
  // 알림 토스트 표시
  function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    
    // 스타일
    toast.style.position = 'fixed';
    toast.style.bottom = '20px';
    toast.style.left = '50%';
    toast.style.transform = 'translateX(-50%)';
    toast.style.backgroundColor = type === 'error' ? '#e74c3c' : '#3498db';
    toast.style.color = 'white';
    toast.style.padding = '10px 20px';
    toast.style.borderRadius = '4px';
    toast.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.2)';
    toast.style.zIndex = '1000';
    toast.style.transition = 'opacity 0.3s ease-in-out';
    
    document.body.appendChild(toast);
    
    // 3초 후 제거
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => {
        document.body.removeChild(toast);
      }, 300);
    }, 3000);
  }
  
  // 업데이트 다이얼로그 표시
  function showUpdateDialog(info, title, message) {
    const dialog = document.createElement('div');
    dialog.className = 'update-dialog';
    
    // 스타일
    dialog.style.position = 'fixed';
    dialog.style.top = '50%';
    dialog.style.left = '50%';
    dialog.style.transform = 'translate(-50%, -50%)';
    dialog.style.backgroundColor = '#fff';
    dialog.style.padding = '20px';
    dialog.style.borderRadius = '8px';
    dialog.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.3)';
    dialog.style.zIndex = '1001';
    dialog.style.width = '300px';
    
    // 다크 모드 대응
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      dialog.style.backgroundColor = '#333';
      dialog.style.color = '#f0f0f0';
    }
    
    // 내용
    dialog.innerHTML = `
      <h3 style="margin-top: 0;">${title}</h3>
      <p>버전: ${info.version}</p>
      <p>${message}</p>
      <div style="display: flex; justify-content: flex-end; gap: 10px;">
        <button id="dialog-cancel-btn" style="padding: 8px 16px; border: none; border-radius: 4px; cursor: pointer; background-color: #e6e6e6; color: #333;">나중에</button>
        <button id="dialog-confirm-btn" style="padding: 8px 16px; border: none; border-radius: 4px; cursor: pointer; background-color: #3498db; color: white;">확인</button>
      </div>
    `;
    
    document.body.appendChild(dialog);
    
    // 오버레이 추가
    const overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.right = '0';
    overlay.style.bottom = '0';
    overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
    overlay.style.zIndex = '1000';
    document.body.appendChild(overlay);
    
    // 이벤트 리스너
    document.getElementById('dialog-cancel-btn').addEventListener('click', () => {
      document.body.removeChild(dialog);
      document.body.removeChild(overlay);
    });
    
    document.getElementById('dialog-confirm-btn').addEventListener('click', () => {
      if (title.includes('다운로드되었습니다')) {
        window.settingsAPI.quitAndInstall();
      } else {
        window.settingsAPI.downloadUpdate();
      }
      document.body.removeChild(dialog);
      document.body.removeChild(overlay);
    });
  }
}); 