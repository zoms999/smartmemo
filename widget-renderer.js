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
    window.electronWidgetAPI.onInitializeWidget(async (memo) => {
        if (memo && memo.id === currentMemoId) {
            currentMemoText = memo.text;
            widgetContentDiv.textContent = currentMemoText;

            // 메모 제목 설정 (첫 줄만 사용하여 [object Promise] 방지)
            const firstLine = memo.text.split('\n')[0] || memo.text;
            const truncatedText = firstLine.substring(0, 10) + (firstLine.length > 10 ? '...' : '');
            widgetTitle.textContent = truncatedText;
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

                // 메모 제목 설정 (첫 줄만 사용하여 [object Promise] 방지)
                const firstLine = newText.split('\n')[0] || newText;
                const truncatedText = firstLine.substring(0, 10) + (firstLine.length > 10 ? '...' : '');
                widgetTitle.textContent = truncatedText;

                if (currentMemoId) {
                    await window.electronWidgetAPI.updateContent(currentMemoId, newText);
                }
            }
        }, 500); // 0.5초 디바운스
    });

    // "패널로 되돌리기" 버튼
    returnToPanelBtn.addEventListener('click', async (event) => {
        if (currentMemoId) {
            try {
                console.log('패널로 되돌리기 버튼 클릭, 메모 ID:', currentMemoId);

                // 먼저 위젯 상태를 false로 업데이트
                await window.electronWidgetAPI.updateWidgetStatus(currentMemoId, false);

                // 패널에 메모가 표시되도록 알림
                window.electronWidgetAPI.notifyPanelToShowMemo(currentMemoId);

                // 패널로 되돌리기 이벤트 발생
                window.electronWidgetAPI.returnToPanel(currentMemoId);

                // 패널 새로고침 요청
                setTimeout(() => {
                    window.electronWidgetAPI.refreshPanel();
                }, 200);
            } catch (error) {
                console.error('패널로 되돌리기 처리 중 오류:', error);
            }
        }
    });

    // "위젯 닫기" 버튼 (패널로 되돌리기와 동일하게 동작)
    closeWidgetBtn.addEventListener('click', async (event) => {
        if (currentMemoId) {
            try {
                console.log('위젯 닫기 버튼 클릭, 메모 ID:', currentMemoId);

                // 먼저 위젯 상태를 false로 업데이트
                await window.electronWidgetAPI.updateWidgetStatus(currentMemoId, false);

                // 패널에 메모가 표시되도록 알림
                window.electronWidgetAPI.notifyPanelToShowMemo(currentMemoId);

                // 패널로 되돌리기 이벤트 발생
                window.electronWidgetAPI.closeWidget(currentMemoId);

                // 패널 새로고침 요청
                setTimeout(() => {
                    window.electronWidgetAPI.refreshPanel();
                }, 200);
            } catch (error) {
                console.error('위젯 닫기 처리 중 오류:', error);
            }
        }
    });

    // CSS의 -webkit-app-region: drag;를 사용하므로
    // 여기서는 추가 JS 드래그 처리 코드가 필요 없습니다.
    // 필요한 경우 명시적인 드래그 이벤트 핸들러를 추가해야 합니다.
});
