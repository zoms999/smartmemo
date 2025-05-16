// widget.js - 위젯 창의 UI 및 상호작용 로직
document.addEventListener('DOMContentLoaded', () => {
  const dragHandle = document.getElementById('drag-handle');
  const resizeHandle = document.getElementById('resize-handle');
  const closeBtn = document.getElementById('close-btn');
  const widgetContent = document.getElementById('widget-content');

  let memo = {}; // 메모 데이터 객체

  // 메인 프로세스로부터 메모 데이터 수신
  window.electronAPI.onMemoData((receivedMemo) => {
    memo = receivedMemo;
    widgetContent.textContent = memo.text;
  });

  // 메모 내용 수정 시 저장
  widgetContent.addEventListener('blur', () => {
    const updatedText = widgetContent.textContent;
    if (memo.text !== updatedText) {
      memo.text = updatedText;
      window.electronAPI.updateMemo(memo);
    }
  });

  // Enter 키 방지 (blur로 처리하기 위함)
  widgetContent.addEventListener('keypress', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      event.target.blur();
    }
  });

  // 위젯 닫기 버튼
  closeBtn.addEventListener('click', () => {
    memo.showAsWidget = false;
    window.electronAPI.updateMemo(memo);
    window.electronAPI.closeWidget(memo.id);
  });

  // 드래그 기능 구현 (dragHandle이 존재하는 경우에만)
  if (dragHandle) {
    let isDragging = false;
    let currentX;
    let currentY;
    let initialX;
    let initialY;
    let xOffset = 0;
    let yOffset = 0;

    // 드래그 시작
    dragHandle.addEventListener('mousedown', (event) => {
      initialX = event.clientX - xOffset;
      initialY = event.clientY - yOffset;

      isDragging = true;
    });

    // 드래그 중
    window.addEventListener('mousemove', (event) => {
      if (isDragging) {
        event.preventDefault();

        currentX = event.clientX - initialX;
        currentY = event.clientY - initialY;

        xOffset = currentX;
        yOffset = currentY;

        // 위젯 위치 업데이트
        window.electronAPI.saveWidgetPosition(memo.id, { x: window.screenX + currentX, y: window.screenY + currentY });
      }
    });

    // 드래그 종료
    window.addEventListener('mouseup', () => {
      initialX = currentX;
      initialY = currentY;

      isDragging = false;
    });
  }

  // 크기 조절 기능 구현 (resizeHandle이 존재하는 경우에만)
  if (resizeHandle) {
    let isResizing = false;
    let startWidth;
    let startHeight;
    let startX;
    let startY;

    resizeHandle.addEventListener('mousedown', (event) => {
      isResizing = true;
      startX = event.clientX;
      startY = event.clientY;
      startWidth = parseInt(document.defaultView.getComputedStyle(document.body).width, 10);
      startHeight = parseInt(document.defaultView.getComputedStyle(document.body).height, 10);

      event.preventDefault();
      event.stopPropagation();
    });

    window.addEventListener('mousemove', (event) => {
      if (isResizing) {
        const width = startWidth + (event.clientX - startX);
        const height = startHeight + (event.clientY - startY);

        // 최소 크기 제한
        if (width > 150 && height > 100) {
          window.resizeTo(width, height);
        }
      }
    });

    window.addEventListener('mouseup', () => {
      isResizing = false;
    });
  }
});
