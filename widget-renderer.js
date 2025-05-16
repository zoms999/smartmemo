// widget-renderer.js
document.addEventListener('DOMContentLoaded', async () => {
    const widgetContentDiv = document.getElementById('widget-content');
    const returnToPanelBtn = document.getElementById('return-to-panel-btn');
    const closeWidgetBtn = document.getElementById('close-widget-btn');
    const widgetTitle = document.getElementById('widget-title');
    const widgetDragHandle = document.getElementById('widget-drag-handle'); // 드래그 핸들

    let currentMemoId = window.electronWidgetAPI.getMemoId(); // 프리로드에서 ID 가져오기
    let currentMemoText = '';

    // 초기 메모 데이터 수신
    window.electronWidgetAPI.onInitializeWidget((memo) => {
        if (memo && memo.id === currentMemoId) {
            currentMemoText = memo.text;
            widgetContentDiv.textContent = currentMemoText;
            widgetTitle.textContent = memo.text.substring(0, 10) + (memo.text.length > 10 ? '...' : ''); // 간단한 제목
        }
    });

    // 내용 수정 시 메인 프로세스에 알림 (Debounce/Throttle 적용 권장)
    let updateTimeout;
    widgetContentDiv.addEventListener('input', (event) => {
        clearTimeout(updateTimeout);
        updateTimeout = setTimeout(async () => {
            const newText = widgetContentDiv.textContent;
            if (newText !== currentMemoText) {
                currentMemoText = newText;
                widgetTitle.textContent = newText.substring(0, 10) + (newText.length > 10 ? '...' : '');
                if (currentMemoId) {
                    await window.electronWidgetAPI.updateContent(currentMemoId, newText);
                }
            }
        }, 500); // 0.5초 디바운스
    });

    // "패널로 되돌리기" 버튼
    returnToPanelBtn.addEventListener('click', (event) => {
        if (currentMemoId) {
            window.electronWidgetAPI.returnToPanel(currentMemoId);
        }
    });

    // "위젯 닫기" 버튼 (패널로 되돌리기와 동일하게 동작)
    closeWidgetBtn.addEventListener('click', (event) => {
         if (currentMemoId) {
            window.electronWidgetAPI.closeWidget(currentMemoId);
        }
    });

    // CSS의 -webkit-app-region: drag;를 사용하므로
    // 여기서는 추가 JS 드래그 처리 코드가 필요 없습니다.
    // 필요한 경우 명시적인 드래그 이벤트 핸들러를 추가해야 합니다.
});
