// panel-renderer.js
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM이 로드되었습니다. 초기화 시작...');

    const memoInput = document.getElementById('memo-input');
    const memoEditorContainer = document.getElementById('memo-editor-container');
    const addMemoBtn = document.getElementById('add-memo-btn');
    const memosContainer = document.getElementById('memos-container');
    const closeBtn = document.getElementById('close-btn');
    const panelContainer = document.querySelector('.panel-container');
    const searchInput = document.getElementById('search-memo');
    const categorySelect = document.getElementById('category-filter');
    const tagSelect = document.getElementById('tag-filter');
    const sortSelect = document.getElementById('sort-order');
    const toolbar = document.getElementById('markdown-toolbar');
    const exportBtn = document.getElementById('export-btn');
    const importBtn = document.getElementById('import-btn');
    const settingsBtn = document.getElementById('settings-btn');

    // 로그인 버튼 직접 획득 - DOM 로드 시점
    const authButton = document.getElementById('auth-button');
    console.log('초기 로그인 버튼 참조:', authButton ? '성공' : '실패');

    let memos = [];
    let categories = [];
    let tags = [];
    let settings = {};
    let activeFilters = {
        category: 'all',
        tag: 'all',
        searchTerm: '',
        sortOrder: 'newest'
    };

    // 패널 슬라이드 인/아웃 애니메이션 클래스 제어
    const handlePanelSlideIn = () => panelContainer.classList.add('visible');
    const handlePanelSlideOut = () => panelContainer.classList.remove('visible');

    window.electronAPI.onPanelSlideIn(handlePanelSlideIn);
    window.electronAPI.onPanelSlideOut(handlePanelSlideOut);

    // 카테고리 드롭다운 업데이트
    function updateCategoryDropdown() {
        const categoryDropdown = document.getElementById('new-memo-category');
        const existingValue = categoryDropdown.value;

        // 드롭다운 비우기
        categoryDropdown.innerHTML = '<option value="">카테고리 없음</option>';

        // 카테고리 옵션 추가
        categories.forEach(category => {
            const option = document.createElement('option');
            option.value = category.id;
            option.textContent = category.name;
            categoryDropdown.appendChild(option);
        });

        // 이전 값 복원
        if (existingValue) {
            categoryDropdown.value = existingValue;
        }
    }

    // 초기화 함수 - 애플리케이션 시작 시 호출
    async function initialize() {
        try {
            // 설정 로드
            settings = await window.electronAPI.getSettings();
            applySettings();

            // 로그인 상태 확인
            const auth = await window.electronAPI.getAuthStatus();
            const isLoggedIn = auth && auth.isLoggedIn;

            // 로그인 버튼 상태 업데이트
            updateAuthButtonState(isLoggedIn, auth?.user);

            // 카테고리 로드
            categories = await window.electronAPI.getCategories();

            // 태그 로드
            tags = await window.electronAPI.getTags();

            // 메모 로드
            await loadMemosFromStorage();

            // 로그인 상태에 따른 UI 조정
            if (!isLoggedIn) {
                showLoginPrompt();
            }

            // 필터 UI 업데이트
            updateFilterUI();

            // 이벤트 리스너 등록
            setupEventListeners();

            console.log('애플리케이션 초기화 완료');
        } catch (error) {
            console.error('초기화 오류:', error);
            showErrorNotification('데이터 로드 중 오류가 발생했습니다.');
        }
    }

    // 로그인 버튼 상태 업데이트
    function updateAuthButtonState(isLoggedIn, user) {
        const loginButton = document.getElementById('auth-button');
        if (!loginButton) return;

        // 아이콘 변경 및 클래스 추가
        if (isLoggedIn && user) {
            loginButton.classList.add('logged-in');
            loginButton.title = `로그아웃 (${user.email})`;

            // 사용자 정보 표시
            const authInfo = document.createElement('span');
            authInfo.classList.add('auth-info');
            authInfo.textContent = user.email;

            const headerActions = document.querySelector('.header-actions');
            if (headerActions && !document.querySelector('.auth-info')) {
                headerActions.insertBefore(authInfo, loginButton);
            }
        } else {
            loginButton.classList.remove('logged-in');
            loginButton.title = '로그인';

            // 사용자 정보 제거
            const authInfo = document.querySelector('.auth-info');
            if (authInfo) {
                authInfo.remove();
            }
        }
    }

    // 로그인 필요 메시지 표시
    function showLoginPrompt() {
        memosContainer.innerHTML = '';

        const loginPrompt = document.createElement('div');
        loginPrompt.classList.add('login-prompt');
        loginPrompt.innerHTML = `
            <div class="login-prompt-content">
                <svg viewBox="0 0 24 24" width="48" height="48">
                    <path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"></path>
                </svg>
                <h3>로그인이 필요합니다</h3>
                <p>메모를 저장하고 여러 기기에서 동기화하려면 로그인하세요.</p>
                <button id="prompt-login-btn" class="primary-btn">로그인</button>
            </div>
        `;

        memosContainer.appendChild(loginPrompt);

        // 로그인 버튼 이벤트 연결
        const promptLoginBtn = document.getElementById('prompt-login-btn');
        if (promptLoginBtn) {
            promptLoginBtn.addEventListener('click', handleLoginClick);
        }
    }

    // 필터 UI 업데이트
    function updateFilterUI() {
        // 카테고리 옵션 업데이트
        categorySelect.innerHTML = '<option value="all">모든 카테고리</option>';
        categories.forEach(category => {
            const option = document.createElement('option');
            option.value = category.id;
            option.textContent = category.name;
            categorySelect.appendChild(option);
        });

        // 태그 옵션 업데이트
        tagSelect.innerHTML = '<option value="all">모든 태그</option>';
        tags.forEach(tag => {
            const option = document.createElement('option');
            option.value = tag;
            option.textContent = tag;
            tagSelect.appendChild(option);
        });
    }

    // 로그인/로그아웃 처리
    async function handleAuthAction(event) {
        console.log('handleAuthAction 함수 호출됨', event);

        try {
            // 이벤트가 있으면 기본 동작 방지
            if (event && event.preventDefault) {
                event.preventDefault();
                event.stopPropagation();
            }

            // 로그인 버튼 클릭 시 로그인 페이지 열기
            console.log('로그인 페이지 열기 시도');
            window.electronAPI.openLoginWindow();
            console.log('openLoginWindow 호출 완료');

        } catch (error) {
            console.error('인증 처리 오류:', error);
            showErrorNotification('인증 처리 중 오류가 발생했습니다: ' + error.message);
        }
    }

    // 로그인 버튼 핸들러 - 직접 함수 정의
    function handleLoginClick(e) {
        console.log('로그인 버튼 클릭됨! 이벤트 객체:', e);
        e.preventDefault();
        e.stopPropagation();

        try {
            console.log('로그인 창 열기 시도 - window.electronAPI 존재여부:', !!window.electronAPI);
            console.log('window.electronAPI 메서드들:', Object.keys(window.electronAPI).join(', '));

            // 실제 IPC 호출
            window.electronAPI.openLoginWindow();
            console.log('openLoginWindow 메서드 호출 완료');
        } catch (error) {
            console.error('로그인 버튼 클릭 처리 중 오류 발생:', error);
            alert('로그인 처리 중 오류가 발생했습니다: ' + error.message);
        }
    }

    // 별도 초기화 함수를 통해 로그인 버튼 설정
    function setupAuthButton() {
        console.log('로그인 버튼 설정 함수 실행');

        // 최신 참조 획득
        const loginButton = document.getElementById('auth-button');
        console.log('setupAuthButton에서 버튼 찾기:', loginButton ? '성공' : '실패');

        if (!loginButton) {
            console.error('로그인 버튼을 찾을 수 없습니다!');
            // DOM에 직접 추가 시도
            const headerActions = document.querySelector('.header-actions');
            if (headerActions) {
                console.log('헤더 액션 영역 발견, 버튼 직접 추가 시도');
                const newButton = document.createElement('button');
                newButton.id = 'auth-button';
                newButton.className = 'icon-btn login-button';
                newButton.title = '로그인/로그아웃';
                newButton.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18">
                    <path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"></path>
                </svg>`;

                // 이벤트 리스너 추가
                newButton.addEventListener('click', handleLoginClick);

                // DOM에 추가
                headerActions.insertBefore(newButton, headerActions.firstChild);
                console.log('로그인 버튼 동적 생성 완료');
            }
            return;
        }

        // 이벤트 리스너 제거 후 다시 추가
        loginButton.removeEventListener('click', handleLoginClick);

        // 여러 방법으로 이벤트 리스너 등록
        loginButton.addEventListener('click', handleLoginClick);

        // 스타일 변경으로 버튼 강조
        loginButton.style.cursor = 'pointer';
        loginButton.style.position = 'relative';
        loginButton.style.zIndex = '1000';

        console.log('로그인 버튼 이벤트 리스너 설정 완료');

        // 테스트용 딜레이 후 클릭 강제 실행
        setTimeout(() => {
            console.log('5초 후 로그인 버튼 상태 확인:', document.getElementById('auth-button') ? '존재함' : '없음');
        }, 5000);
    }

    // 이벤트 리스너 설정
    function setupEventListeners() {
        console.log('setupEventListeners 함수 시작');

        // 패널 관련 이벤트
        const closeBtn = document.getElementById('close-btn');
        closeBtn.addEventListener('click', closePanel);

        // 필터 변경 이벤트
        const categorySelect = document.getElementById('category-filter');
        const tagSelect = document.getElementById('tag-filter');
        const sortSelect = document.getElementById('sort-order');
        const searchInput = document.getElementById('search-memo');
        const clearSearchBtn = document.getElementById('clear-search-btn');

        categorySelect.addEventListener('change', () => {
            activeFilters.category = categorySelect.value;
            renderMemos();
        });

        tagSelect.addEventListener('change', () => {
            activeFilters.tag = tagSelect.value;
            renderMemos();
        });

        sortSelect.addEventListener('change', () => {
            activeFilters.sortOrder = sortSelect.value;
            renderMemos();
        });

        // 검색 이벤트 - 입력 지연 처리
        searchInput.addEventListener('input', debounce(() => {
            activeFilters.searchTerm = searchInput.value.toLowerCase();
            clearSearchBtn.style.display = activeFilters.searchTerm ? 'block' : 'none';
            renderMemos();
        }, 300));

        // 검색 지우기 버튼
        clearSearchBtn.addEventListener('click', () => {
            searchInput.value = '';
            activeFilters.searchTerm = '';
            clearSearchBtn.style.display = 'none';
            renderMemos();
        });

        // 메모 추가 관련 설정
        setupAddMemoButton();

        // 내보내기/가져오기 버튼
        const exportBtn = document.getElementById('export-btn');
        const importBtn = document.getElementById('import-btn');

        exportBtn.addEventListener('click', exportData);
        importBtn.addEventListener('click', importData);

        // 설정 버튼
        settingsBtn.addEventListener('click', () => {
            window.electronAPI.openSettingsWindow();
        });

        // 로그인 버튼 설정 별도 함수 호출
        setupAuthButton();

        // 위젯에서 메모 업데이트 이벤트
        window.electronAPI.onMemoUpdateFromWidget(async (data) => {
            const { memoId, newContent } = data;
            const memoToUpdate = memos.find(memo => memo.id === memoId);
            if (memoToUpdate) {
                memoToUpdate.text = newContent;
                await saveMemosToStorage();
                await renderMemos();
            }
        });

        // 위젯 닫힘 이벤트
        window.electronAPI.onWidgetClosed((memoId) => {
            const memoToUpdate = memos.find(memo => memo.id === parseInt(memoId, 10));
            if (memoToUpdate) {
                memoToUpdate.isWidget = false;
                saveMemosToStorage();
                renderMemos();
            }
        });

        // 위젯 상태 업데이트 이벤트
        window.electronAPI.onUpdateMemoWidgetState((data) => {
            const { id, position, size } = data;
            const memoToUpdate = memos.find(memo => memo.id === id);
            if (memoToUpdate) {
                memoToUpdate.widgetPosition = position;
                memoToUpdate.widgetSize = size;
                saveMemosToStorage();
            }
        });

        // 메모 포커스 요청 이벤트
        window.electronAPI.onShowPanelAndFocusMemo((memoId) => {
            const memoElement = document.querySelector(`.memo-item[data-id="${memoId}"]`);
            if (memoElement) {
                memoElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                memoElement.classList.add('highlight-memo');
                setTimeout(() => {
                    memoElement.classList.remove('highlight-memo');
                }, 2000);
            }
        });

        // 앱 버전 표시
        window.electronAPI.getAppVersion().then(version => {
            const versionElement = document.getElementById('app-version');
            if (versionElement) {
                versionElement.textContent = `MemoWave v${version}`;
            }
        }).catch(error => console.error('앱 버전 가져오기 오류:', error));

        // 앱 업데이트 관련 이벤트
        window.electronAPI.onUpdateAvailable((info) => {
            showUpdateNotification(`새 버전 ${info.version}이 사용 가능합니다. 다운로드 중..`);
        });

        window.electronAPI.onUpdateDownloaded((info) => {
            showUpdateNotification(`새 버전 ${info.version}이 설치 준비되었습니다. 앱을 재시작하면 업데이트가 적용됩니다.`);
        });
    }

    // 설정 로드
    async function loadSettings() {
        try {
            settings = await window.electronAPI.getSettings();
            applySettings();
        } catch (error) {
            console.error('설정 로드 오류:', error);
        }
    }

    // 설정 적용
    function applySettings() {
        // 글꼴 크기 적용
        document.documentElement.style.setProperty('--memo-font-size', `${settings.fontSize}px`);

        // 다크/라이트 모드 적용
        if (settings.theme === 'dark') {
            document.documentElement.setAttribute('data-theme', 'dark');
        } else if (settings.theme === 'light') {
            document.documentElement.setAttribute('data-theme', 'light');
        } else {
            document.documentElement.removeAttribute('data-theme');
        }

        // 마크다운 툴바 표시 여부
        toolbar.style.display = settings.markdownToolbar ? 'flex' : 'none';
    }

    // 마크다운을 HTML로 변환하는 함수
    async function convertMarkdownToHTML(markdown) {
        if (!markdown) return '';

        try {
            // marked 라이브러리를 사용하여 변환
            return await window.electronAPI.convertMarkdown(markdown);
        } catch (error) {
            console.error('마크다운 변환 오류:', error);
            return markdown;
        }
    }

    // 메모 정렬 함수
    function sortMemos(memos, sortOrder) {
        // 복사본을 만들어 정렬 (원본 배열 변경 방지)
        const sortedMemos = [...memos];

        switch (sortOrder) {
            case 'newest':
                return sortedMemos.sort((a, b) =>
                    new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
                );
            case 'oldest':
                return sortedMemos.sort((a, b) =>
                    new Date(a.createdAt || 0) - new Date(b.createdAt || 0)
                );
            case 'priority':
                return sortedMemos.sort((a, b) =>
                    (b.priority || 0) - (a.priority || 0)
                );
            case 'upcoming':
                return sortedMemos.sort((a, b) => {
                    // 알림이 없는 메모는 마지막으로
                    if (!a.reminder) return 1;
                    if (!b.reminder) return -1;

                    // 알림 시간으로 정렬
                    return new Date(a.reminder) - new Date(b.reminder);
                });
            default:
                return sortedMemos;
        }
    }

    // 메모 렌더링
    async function renderMemos() {
        memosContainer.innerHTML = '';

        // 필터링
        let filteredMemos = memos;

        // 검색어 필터링
        if (activeFilters.searchTerm) {
            filteredMemos = filteredMemos.filter(memo =>
                memo.text.toLowerCase().includes(activeFilters.searchTerm)
            );
        }

        // 카테고리 필터링
        if (activeFilters.category !== 'all') {
            filteredMemos = filteredMemos.filter(memo =>
                memo.categoryId === parseInt(activeFilters.category, 10)
            );
        }

        // 태그 필터링
        if (activeFilters.tag !== 'all') {
            filteredMemos = filteredMemos.filter(memo =>
                memo.tags && memo.tags.includes(activeFilters.tag)
            );
        }

        // 위젯 필터링 (위젯으로 나와있는 메모는 기본적으로 표시하지 않음, 검색 시에만 표시)
        if (!activeFilters.searchTerm && !activeFilters.category !== 'all' && !activeFilters.tag !== 'all') {
            filteredMemos = filteredMemos.filter(memo => !memo.isWidget);
        }

        // 정렬
        filteredMemos = sortMemos(filteredMemos, activeFilters.sortOrder);

        // 결과 없음 메시지
        if (filteredMemos.length === 0) {
            const noResults = document.createElement('div');
            noResults.classList.add('no-search-results');
            if (activeFilters.searchTerm) {
                noResults.textContent = `'${activeFilters.searchTerm}'에 대한 검색 결과가 없습니다.`;
            } else {
                noResults.textContent = '조건에 맞는 메모가 없습니다.';
            }
            memosContainer.appendChild(noResults);
            return;
        }

        for (const memo of filteredMemos) {
            // 위젯으로 나와있는 메모는 패널 목록에 그리지 않음
            if (memo.isWidget && !activeFilters.searchTerm) continue;

            const memoDiv = document.createElement('div');
            memoDiv.classList.add('memo-item');
            memoDiv.dataset.id = memo.id;

            // 메모 내용을 담을 컨테이너
            const contentContainer = document.createElement('div');
            contentContainer.classList.add('memo-content-container');

            // 미리보기 모드와 편집 모드를 위한 요소들
            const viewModeDiv = document.createElement('div');
            viewModeDiv.classList.add('memo-content', 'view-mode');
            // await로 Promise 해결
            viewModeDiv.innerHTML = await convertMarkdownToHTML(memo.text);

            const editModeDiv = document.createElement('div');
            editModeDiv.classList.add('memo-content', 'edit-mode');
            editModeDiv.setAttribute('contenteditable', 'true');
            editModeDiv.textContent = memo.text;
            editModeDiv.style.display = 'none';

            // 위젯 상태 표시 (위젯으로 떠 있을 경우)
            if (memo.isWidget) {
                const widgetBadge = document.createElement('span');
                widgetBadge.classList.add('widget-badge');
                widgetBadge.textContent = '위젯 모드';
                memoDiv.appendChild(widgetBadge);
            }

            // 내용 변경 시 저장
            editModeDiv.addEventListener('blur', async (event) => {
                const newText = event.target.textContent;
                const memoId = parseInt(memoDiv.dataset.id, 10);
                const memoToUpdate = memos.find(m => m.id === memoId);

                if (memoToUpdate && memoToUpdate.text !== newText) {
                    memoToUpdate.text = newText;
                    viewModeDiv.innerHTML = await convertMarkdownToHTML(newText);
                    await saveMemosToStorage();
                }

                // 편집 모드에서 나가기
                toggleEditMode(false, memoDiv);
            });

            // Enter 키 및 특수 키 처리
            editModeDiv.addEventListener('keydown', (event) => {
                if (event.key === 'Escape') {
                    event.preventDefault();
                    event.target.blur();
                }

                if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    event.target.blur();
                }
            });

            // 더블 클릭 시 편집 모드로 전환
            viewModeDiv.addEventListener('dblclick', () => {
                toggleEditMode(true, memoDiv);
            });

            // 메모 버튼 컨테이너
            const actionsDiv = document.createElement('div');
            actionsDiv.classList.add('memo-actions');

            // 편집 버튼
            const editBtn = document.createElement('button');
            editBtn.classList.add('edit-btn');
            editBtn.title = '편집';
            editBtn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"></path></svg>';
            editBtn.onclick = () => {
                toggleEditMode(true, memoDiv);
            };

            // "위젯으로 보기" 버튼 추가
            const widgetBtn = document.createElement('button');
            widgetBtn.classList.add('widget-btn');
            widgetBtn.title = '위젯으로 꺼내기';
            widgetBtn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14z"></path></svg>';
            widgetBtn.onclick = () => {
                memo.isWidget = true;
                memo.widgetPosition = memo.widgetPosition || { x: undefined, y: undefined };
                memo.widgetSize = memo.widgetSize || { width: 250, height: 150 };
                window.electronAPI.createWidget(memo);
                renderMemos(); // 패널 목록에서 해당 메모 숨김
                saveMemosToStorage(); // isWidget 상태 저장
            };

            // 삭제 버튼
            const deleteBtn = document.createElement('button');
            deleteBtn.classList.add('delete-btn');
            deleteBtn.title = '삭제';
            deleteBtn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"></path></svg>';
            deleteBtn.onclick = () => {
                // 삭제 확인 대화상자
                showConfirmDialog(
                    '메모 삭제',
                    '이 메모를 삭제하시겠습니까?',
                    () => { deleteMemo(memo.id); }
                );
            };

            // 요소 추가
            contentContainer.appendChild(viewModeDiv);
            contentContainer.appendChild(editModeDiv);
            memoDiv.appendChild(contentContainer);

            actionsDiv.appendChild(editBtn);
            actionsDiv.appendChild(widgetBtn);
            actionsDiv.appendChild(deleteBtn);
            memoDiv.appendChild(actionsDiv);
            memosContainer.appendChild(memoDiv);
        }
    }

    // 메모 편집 모드 토글
    function toggleEditMode(isEdit, memoDiv) {
        const viewMode = memoDiv.querySelector('.view-mode');
        const editMode = memoDiv.querySelector('.edit-mode');

        if (isEdit) {
            viewMode.style.display = 'none';
            editMode.style.display = 'block';
            editMode.focus();

            // 커서를 끝으로 이동
            const range = document.createRange();
            const sel = window.getSelection();
            range.selectNodeContents(editMode);
            range.collapse(false);
            sel.removeAllRanges();
            sel.addRange(range);
        } else {
            viewMode.style.display = 'block';
            editMode.style.display = 'none';
        }
    }

    // 확인 대화상자 표시
    function showConfirmDialog(title, message, confirmCallback) {
        // 기존 대화상자 제거
        const existingDialog = document.querySelector('.confirm-dialog');
        if (existingDialog) {
            existingDialog.remove();
        }

        const dialogOverlay = document.createElement('div');
        dialogOverlay.classList.add('confirm-dialog');

        const dialogContent = document.createElement('div');
        dialogContent.classList.add('confirm-dialog-content');

        dialogContent.innerHTML = `
            <h3>${title}</h3>
            <p>${message}</p>
            <div class="confirm-dialog-buttons">
                <button class="cancel-btn">취소</button>
                <button class="confirm-btn">확인</button>
            </div>
        `;

        dialogOverlay.appendChild(dialogContent);
        document.body.appendChild(dialogOverlay);

        // 취소 버튼
        const cancelBtn = dialogContent.querySelector('.cancel-btn');
        cancelBtn.addEventListener('click', () => {
            dialogOverlay.remove();
        });

        // 확인 버튼
        const confirmBtn = dialogContent.querySelector('.confirm-btn');
        confirmBtn.addEventListener('click', () => {
            if (typeof confirmCallback === 'function') {
                confirmCallback();
            }
            dialogOverlay.remove();
        });

        // 배경 클릭 시 닫기
        dialogOverlay.addEventListener('click', (event) => {
            if (event.target === dialogOverlay) {
                dialogOverlay.remove();
            }
        });
    }

    // 메모 추가
    function addMemo() {
        const memoInput = document.getElementById('memo-input');
        const text = memoInput.value.trim();
        const categorySelect = document.getElementById('new-memo-category');
        const prioritySelect = document.getElementById('new-memo-priority');

        if (!text) {
            // 빈 메모는 추가하지 않음
            showToast('메모 내용을 입력해주세요.');
            return;
        }

        const newMemo = {
            id: Date.now(), // 현재 시간을 ID로 사용 (고유한 값)
            text: text,
            isWidget: false,
            categoryId: categorySelect.value ? parseInt(categorySelect.value, 10) : null,
            priority: parseInt(prioritySelect.value, 10),
            tags: [],
            color: null,
            reminder: null,
            images: [],
            createdAt: new Date().toISOString()
        };

        memos.unshift(newMemo); // 배열 맨 앞에 추가
        saveMemosToStorage();
        renderMemos();

        // 입력 필드 초기화
        memoInput.value = '';

        // 성공 메시지 표시
        showToast('메모가 추가되었습니다.');
    }

    // 메모 삭제
    async function deleteMemo(id) {
        const index = memos.findIndex(memo => memo.id === id);
        if (index !== -1) {
            // 위젯으로 표시 중이었다면 창 닫기 메시지 전송
            if (memos[index].isWidget) {
                window.electronAPI.closeWidget(id);
            }

            // 로컬 메모 목록에서 삭제
            memos.splice(index, 1);

            // 저장 (save-memos 호출 시 DB에도 저장됨)
            saveMemosToStorage();

            // DB에서도 삭제 시도
            try {
                await window.electronAPI.deleteMemoFromDb(id);
            } catch (error) {
                console.error('DB에서 메모 삭제 오류:', error);
                // DB 삭제 실패해도 UI는 업데이트
            }

            renderMemos();

            // 삭제 메시지 표시
            showToast('메모가 삭제되었습니다.');
        }
    }

    // 메모 저장
    async function saveMemosToStorage() {
        try {
            await window.electronAPI.saveMemos(memos);
        } catch (error) {
            console.error('메모 저장 오류:', error);
            showErrorNotification('메모 저장 중 오류가 발생했습니다.');
        }
    }

    // 메모 로드
    async function loadMemosFromStorage() {
        try {
            memos = await window.electronAPI.getMemos();
        } catch (error) {
            console.error('메모 로드 오류:', error);
            showErrorNotification('메모 로드 중 오류가 발생했습니다.');
            memos = [];
        }

        await renderMemos();
    }

    // 패널 닫기
    function closePanel() {
        window.electronAPI.closePanel();
    }

    // 업데이트 알림 표시
    function showUpdateNotification(message) {
        const notification = document.createElement('div');
        notification.className = 'update-notification';
        notification.textContent = message;

        // 스타일링
        notification.style.position = 'fixed';
        notification.style.bottom = '20px';
        notification.style.right = '20px';
        notification.style.padding = '10px 15px';
        notification.style.backgroundColor = '#2ecc71';
        notification.style.color = 'white';
        notification.style.borderRadius = '4px';
        notification.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.2)';
        notification.style.zIndex = '1000';

        document.body.appendChild(notification);

        // 5초 후 제거
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 5000);
    }

    // 이벤트 리스너
    addMemoBtn.addEventListener('click', addMemo);
    memoInput.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
            addMemo();
        }
    });

    // 검색 기능 구현
    if (searchInput) {
        searchInput.addEventListener('input', debounce(() => {
            renderMemos();
        }, 300));
    }

    // debounce 유틸리티 함수
    function debounce(func, wait) {
        let timeout;
        return function() {
            const context = this, args = arguments;
            clearTimeout(timeout);
            timeout = setTimeout(() => {
                func.apply(context, args);
            }, wait);
        };
    }

    // 애니메이션 이벤트 처리
    window.electronAPI.onPanelSlideIn(() => {
        panelContainer.classList.remove('slide-out');
    });

    window.electronAPI.onPanelSlideOut(() => {
        panelContainer.classList.add('slide-out');
    });

    // 초기화 직접 호출
    console.log('initialize 함수 호출 전');
    initialize().then(() => {
        console.log('초기화 완료');

        // 초기화 후 버튼 다시 확인
        setTimeout(() => {
            console.log('초기화 완료 후 로그인 버튼 재설정');
            setupAuthButton();

            // 디버깅을 위해 창에 전역 변수로 노출
            window.debugAuth = {
                openLoginWindow: function() {
                    console.log('디버그 메서드로 로그인 창 열기 시도');
                    window.electronAPI.openLoginWindow();
                },
                checkButton: function() {
                    const btn = document.getElementById('auth-button');
                    console.log('현재 auth-button 상태:', btn ? '존재' : '없음');
                    return btn;
                }
            };
            console.log('디버그 도구 설정 완료: window.debugAuth 사용 가능');
        }, 1000);
    }).catch(err => {
        console.error('초기화 오류:', err);
    });
});

// 메모 추가 버튼 이벤트 연결
function setupAddMemoButton() {
    const memoInput = document.getElementById('memo-input');
    const addMemoBtn = document.getElementById('add-memo-btn');
    const newMemoCategory = document.getElementById('new-memo-category');
    const newMemoPriority = document.getElementById('new-memo-priority');

    // 기존 카테고리로 드롭다운 채우기
    updateCategoryDropdown();

    // 메모 추가 이벤트
    addMemoBtn.addEventListener('click', addMemo);

    // 엔터 키로 메모 추가 (Shift+Enter는 줄바꿈)
    memoInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' && !event.shiftKey && event.target.value.trim()) {
            event.preventDefault();
            addMemo();
        }
    });

    // 마크다운 툴바 이벤트 연결
    setupMarkdownToolbar();
}

// 마크다운 툴바 설정
function setupMarkdownToolbar() {
    const toolbarButtons = document.querySelectorAll('.toolbar-btn');
    const memoInput = document.getElementById('memo-input');

    toolbarButtons.forEach(button => {
        button.addEventListener('click', () => {
            // 현재 선택된 텍스트 정보 가져오기
            const start = memoInput.selectionStart;
            const end = memoInput.selectionEnd;
            const selectedText = memoInput.value.substring(start, end);
            const format = button.getAttribute('data-format');

            let formattedText = '';
            let cursorOffset = 0;

            // 포맷에 따라 처리
            switch (format) {
                case 'bold':
                    formattedText = `**${selectedText}**`;
                    cursorOffset = 2;
                    break;
                case 'italic':
                    formattedText = `*${selectedText}*`;
                    cursorOffset = 1;
                    break;
                case 'strike':
                    formattedText = `~~${selectedText}~~`;
                    cursorOffset = 2;
                    break;
                case 'code':
                    formattedText = `\`${selectedText}\``;
                    cursorOffset = 1;
                    break;
                case 'link':
                    if (selectedText) {
                        formattedText = `[${selectedText}](url)`;
                        // 커서를 url에 위치시키기 위해 오프셋 계산
                        cursorOffset = 3;
                    } else {
                        formattedText = `[링크 텍스트](url)`;
                        // 커서를 링크 텍스트 시작 부분에 위치
                        cursorOffset = 1;
                    }
                    break;
                case 'list':
                    // 여러 줄을 목록으로 변환
                    if (selectedText) {
                        const lines = selectedText.split('\n');
                        formattedText = lines.map(line => `- ${line}`).join('\n');
                    } else {
                        formattedText = '- ';
                    }
                    cursorOffset = 2;
                    break;
                case 'image':
                    // 이미지 첨부 다이얼로그 호출
                    addImageToInput();
                    return;
            }

            // 텍스트 삽입 및 커서 위치 조정
            if (formattedText) {
                const newValue =
                    memoInput.value.substring(0, start) +
                    formattedText +
                    memoInput.value.substring(end);

                memoInput.value = newValue;

                // 텍스트가 선택되었던 경우
                if (selectedText) {
                    memoInput.selectionStart = start + formattedText.length;
                    memoInput.selectionEnd = start + formattedText.length;
                } else {
                    // 선택된 텍스트가 없을 때는 마크업 사이에 커서 위치
                    memoInput.selectionStart = start + cursorOffset;
                    memoInput.selectionEnd = start + cursorOffset;
                }

                memoInput.focus();
            }
        });
    });
}

// 이미지 첨부 다이얼로그
async function addImageToInput() {
    const memoInput = document.getElementById('memo-input');
    const imageData = await window.electronAPI.selectImage();

    if (imageData) {
        const start = memoInput.selectionStart;
        const imageMarkdown = `![이미지](${imageData.url})`;

        const newValue =
            memoInput.value.substring(0, start) +
            imageMarkdown +
            memoInput.value.substring(start);

        memoInput.value = newValue;
        memoInput.selectionStart = start + imageMarkdown.length;
        memoInput.selectionEnd = start + imageMarkdown.length;
        memoInput.focus();
    }
}

// 데이터 내보내기
async function exportData() {
    const result = await window.electronAPI.exportData();
    if (result.success) {
        showToast(result.message);
    } else {
        showErrorNotification(result.message);
    }
}

// 데이터 가져오기
async function importData() {
    const result = await window.electronAPI.importData();
    if (result.success) {
        // 데이터 다시 불러오기
        await loadMemosFromStorage();
        categories = await window.electronAPI.getCategories();
        tags = await window.electronAPI.getTags();

        // UI 업데이트
        updateFilterUI();
        updateCategoryDropdown();
        renderMemos();

        showToast(result.message);
    } else {
        showErrorNotification(result.message);
    }
}

// 간단한 토스트 메시지 표시
function showToast(message) {
    // 기존 토스트 제거
    const existingToast = document.querySelector('.toast-message');
    if (existingToast) {
        existingToast.remove();
    }

    const toast = document.createElement('div');
    toast.classList.add('toast-message');
    toast.textContent = message;

    document.body.appendChild(toast);

    // 애니메이션 효과
    setTimeout(() => {
        toast.classList.add('show');
    }, 10);

    // 3초 후 제거
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    }, 3000);
}

// 오류 알림 표시
function showErrorNotification(message) {
    // 기존 알림 제거
    const existingNotification = document.querySelector('.error-notification');
    if (existingNotification) {
        existingNotification.remove();
    }

    const notification = document.createElement('div');
    notification.classList.add('error-notification');

    const icon = document.createElement('span');
    icon.classList.add('error-icon');
    icon.innerHTML = '⚠️';

    const text = document.createElement('span');
    text.textContent = message;

    const closeBtn = document.createElement('button');
    closeBtn.classList.add('notification-close');
    closeBtn.innerHTML = '&times;';
    closeBtn.onclick = () => {
        notification.classList.remove('show');
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    };

    notification.appendChild(icon);
    notification.appendChild(text);
    notification.appendChild(closeBtn);

    document.body.appendChild(notification);

    // 애니메이션 효과
    setTimeout(() => {
        notification.classList.add('show');
    }, 10);

    // 10초 후 자동 제거
    setTimeout(() => {
        if (notification.classList.contains('show')) {
            notification.classList.remove('show');
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }
    }, 10000);
}
