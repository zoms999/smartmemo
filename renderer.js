// renderer.js - 메인 창의 UI 제어 로직
document.addEventListener('DOMContentLoaded', () => {
  const memoInput = document.getElementById('memo-input');
  const addMemoBtn = document.getElementById('add-memo-btn');
  const memosContainer = document.getElementById('memos-container');

  let memos = []; // 메모들을 저장할 배열

  // 메모 렌더링 함수
  function renderMemos() {
    memosContainer.innerHTML = ''; // 기존 메모 지우기
    
    memos.forEach((memo) => {
      const memoDiv = document.createElement('div');
      memoDiv.classList.add('memo-item');
      memoDiv.dataset.id = memo.id;

      const contentSpan = document.createElement('span');
      contentSpan.classList.add('memo-content');
      contentSpan.textContent = memo.text;
      contentSpan.setAttribute('contenteditable', 'true');

      // 내용 변경 시 memos 배열 업데이트 및 저장
      contentSpan.addEventListener('blur', (event) => {
        const newText = event.target.textContent;
        const memoId = parseInt(memoDiv.dataset.id, 10);
        const memoToUpdate = memos.find(m => m.id === memoId);
        
        if (memoToUpdate && memoToUpdate.text !== newText) {
          memoToUpdate.text = newText;
          saveMemosToStorage();
          
          // 만약 위젯으로 표시 중이면 위젯도 업데이트
          if (memoToUpdate.showAsWidget) {
            window.electronAPI.updateMemo(memoToUpdate);
          }
        }
      });
      
      // Enter 키 방지 (blur로 처리하기 위함)
      contentSpan.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          event.target.blur();
        }
      });

      // 메모 액션 버튼 컨테이너
      const actionsDiv = document.createElement('div');
      actionsDiv.classList.add('memo-actions');

      // 위젯 토글 버튼
      const widgetBtn = document.createElement('button');
      widgetBtn.classList.add('widget-btn');
      widgetBtn.textContent = memo.showAsWidget ? '위젯 닫기' : '위젯으로 보기';
      widgetBtn.onclick = () => {
        toggleWidget(memo);
      };

      // 삭제 버튼
      const deleteBtn = document.createElement('button');
      deleteBtn.classList.add('delete-btn');
      deleteBtn.textContent = '삭제';
      deleteBtn.onclick = () => {
        deleteMemo(memo.id);
      };

      actionsDiv.appendChild(widgetBtn);
      actionsDiv.appendChild(deleteBtn);
      
      memoDiv.appendChild(contentSpan);
      memoDiv.appendChild(actionsDiv);
      memosContainer.appendChild(memoDiv);
    });
  }

  // 메모 추가 함수
  function addMemo() {
    const memoText = memoInput.value.trim();
    if (memoText) {
      const newMemo = {
        id: Date.now(),
        text: memoText,
        showAsWidget: false,
        x: undefined,
        y: undefined
      };
      
      memos.push(newMemo);
      memoInput.value = '';
      renderMemos();
      saveMemosToStorage();
    }
  }

  // 메모 삭제 함수
  function deleteMemo(id) {
    const memo = memos.find(m => m.id === id);
    
    // 위젯으로 표시 중이면 먼저 닫기
    if (memo && memo.showAsWidget) {
      window.electronAPI.closeWidget(id);
    }
    
    memos = memos.filter(memo => memo.id !== id);
    renderMemos();
    saveMemosToStorage();
  }

  // 위젯 토글 함수
  function toggleWidget(memo) {
    const index = memos.findIndex(m => m.id === memo.id);
    if (index !== -1) {
      // 위젯 상태 토글
      memos[index].showAsWidget = !memos[index].showAsWidget;
      
      if (memos[index].showAsWidget) {
        // 위젯 표시
        window.electronAPI.showWidget(memos[index]);
      } else {
        // 위젯 닫기
        window.electronAPI.closeWidget(memo.id);
      }
      
      renderMemos();
      saveMemosToStorage();
    }
  }

  // 메모 저장 함수
  async function saveMemosToStorage() {
    try {
      const result = await window.electronAPI.saveMemos(memos);
      if (!result.success) {
        console.error('메모 저장 실패:', result.error);
      }
    } catch (error) {
      console.error('메모 저장 중 오류 발생:', error);
    }
  }

  // 메모 로드 함수
  async function loadMemosFromStorage() {
    try {
      const loadedMemos = await window.electronAPI.loadMemos();
      if (loadedMemos && Array.isArray(loadedMemos)) {
        memos = loadedMemos;
        renderMemos();
      }
    } catch (error) {
      console.error('메모 로드 중 오류 발생:', error);
      memos = [];
      renderMemos();
    }
  }

  // 메인 프로세스에서 메모 업데이트 이벤트 수신
  window.electronAPI.onMemosUpdated((updatedMemos) => {
    memos = updatedMemos;
    renderMemos();
  });

  // 이벤트 리스너
  addMemoBtn.addEventListener('click', addMemo);
  memoInput.addEventListener('keypress', (event) => {
    if (event.key === 'Enter') {
      addMemo();
    }
  });

  // 초기 메모 로드
  loadMemosFromStorage();
}); 