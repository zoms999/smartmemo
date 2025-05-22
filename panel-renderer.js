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
    const prioritySelect = document.getElementById('priority-filter');
    const sortSelect = document.getElementById('sort-order');
    const toolbar = document.getElementById('markdown-toolbar');
    const exportBtn = document.getElementById('export-btn');
    const importBtn = document.getElementById('import-btn');
    const settingsBtn = document.getElementById('settings-btn');

    // 추가 UI 요소 참조
    const filterToggleBtn = document.getElementById('filter-toggle-btn');
    const filterContainer = document.getElementById('filter-container');
    const viewSettingsBtn = document.getElementById('view-settings-btn');
    const viewSettingsDropdown = document.getElementById('view-settings-dropdown');
    const widgetModeHelpBtn = document.getElementById('widget-mode-help');

    // 로그인 버튼 직접 획득 - DOM 로드 시점
    const authButton = document.getElementById('auth-button');
    console.log('초기 로그인 버튼 참조:', authButton ? '성공' : '실패');

    let memos = [];
    let categories = [];
    let tags = [];
    let settings = {};
    const activeFilters = {
        category: 'all',
        priority: 'all',
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

        console.log('카테고리 드롭다운 업데이트 시작', { 현재선택값: existingValue, 사용가능카테고리: categories });

        // 드롭다운 비우기
        categoryDropdown.innerHTML = '<option value="">카테고리 없음</option>';

        // 카테고리 옵션 추가
        for (const category of categories) {
            const option = document.createElement('option');
            option.value = category.id;
            option.textContent = category.name;
            categoryDropdown.appendChild(option);
        }

        // 이전 값 복원
        if (existingValue) {
            categoryDropdown.value = existingValue;
            console.log('이전 카테고리 값 복원:', existingValue, '현재 설정된 값:', categoryDropdown.value);
        }
    }

    // 초기화 함수 - 애플리케이션 시작 시 호출
    async function initialize() {
        try {
            console.log('애플리케이션 초기화 시작');

            // 변수 초기화 확인을 위한 디버깅 로그
            console.log('viewSettingsBtn 존재 여부:', !!viewSettingsBtn);
            console.log('viewSettingsDropdown 존재 여부:', !!viewSettingsDropdown);
            console.log('viewSettingsBtn 요소:', viewSettingsBtn);
            console.log('viewSettingsDropdown 요소:', viewSettingsDropdown);

            // 메모 입력 영역 토글 버튼 설정
            setupMemoEditorToggle();

            // 설정 로드
            settings = await window.electronAPI.getSettings();
            applySettings();

            // 드래그 앤 드롭을 위한 메모 컨테이너 설정
            setupDragAndDrop(memosContainer);

            // 필터 토글 기능 설정
            setupFilterToggle();

            // 보기 설정 드롭다운 설정
            setupViewSettingsDropdown();

            // 위젯 모드 설명 모달 설정
            setupWidgetModeHelp();

            // 단축키 도움말 모달 설정
            setupShortcutHelpModal();

            // 키보드 단축키 설정
            setupKeyboardShortcuts();

            // 로그인 상태 확인
            const auth = await window.electronAPI.getAuthStatus();
            const isLoggedIn = auth?.isLoggedIn;

            // 로그인 버튼 상태 업데이트
            updateAuthButtonState(isLoggedIn, auth?.user);

            // 로그인 버튼에 추가 이벤트 리스너 설정
            setupAuthButton();

            // 로그인 상태에 따른 UI 조정
            if (!isLoggedIn) {
                showLoginPrompt();
                // 로그인되지 않은 경우에는 기본 카테고리만 표시
                categories = [
                    { id: 1, name: '업무', color: '#4a6da7' },
                    { id: 2, name: '개인', color: '#8bc34a' },
                    { id: 3, name: '아이디어', color: '#ff9800' },
                    { id: 4, name: '할일', color: '#9c27b0' }
                ];
                tags = ['중요', '긴급', '후속조치', '참고'];
                console.log('로그인되지 않음: 기본 카테고리 사용');
            } else {
                try {
                    // 카테고리 로드
                    categories = await window.electronAPI.getCategories();
                    console.log('초기 카테고리 로드됨:', categories);

                    // 카테고리 ID가 숫자인지 확인
                    categories = categories.map(category => {
                        if (typeof category.id === 'string') {
                            category.id = Number.parseInt(category.id, 10);
                        }
                        return category;
                    });
                    console.log('처리된 카테고리:', categories);

                    // 태그 로드
                    tags = await window.electronAPI.getTags();
                    console.log('초기 태그 로드됨:', tags);

                    // 메모 로드
                    await loadMemosFromStorage();
                    console.log('초기화: 메모 로드 완료');
                                } catch (dataError) {
                    console.error('데이터 로드 오류:', dataError);
                    showErrorNotification('데이터 로드 중 오류가 발생했습니다. 다시 로그인해 보세요.');

                    // 오류 발생 시 기본값 사용
                    categories = [
                        { id: 1, name: '업무', color: '#4a6da7' },
                        { id: 2, name: '개인', color: '#8bc34a' },
                        { id: 3, name: '아이디어', color: '#ff9800' },
                        { id: 4, name: '할일', color: '#9c27b0' }
                    ];
                    tags = ['중요', '긴급', '후속조치', '참고'];
                }
            }

            // 필터 UI 업데이트
            updateFilterUI();
            console.log('초기화: 필터 UI 업데이트 완료');

            // 카테고리 드롭다운 업데이트
            updateCategoryDropdown();
            console.log('초기화: 카테고리 드롭다운 업데이트 완료');

            // 이벤트 리스너 등록
            setupEventListeners();

            // 로그인 오류 핸들러 설정
            setupLoginErrorHandler(loadMemosFromStorage, updateFilterUI);

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
            // 먼저 모든 관련 클래스 제거
            loginButton.classList.remove('login-button');
            // 로그인 상태 클래스 추가
            loginButton.classList.add('logged-in');
            loginButton.style.color = '#2ecc71'; // 직접 녹색 스타일 적용
            loginButton.dataset.action = 'logout';
            loginButton.title = `로그아웃 (${user.email})`;

            // SVG 아이콘 변경 - 로그인 상태용 아이콘(녹색)
            loginButton.innerHTML = `
                <svg viewBox="0 0 24 24" width="18" height="18">
                    <path fill="#2ecc71" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"></path>
                </svg>
                <span class="btn-tooltip">계정</span>
            `;

            // 사용자 정보 표시
            const existingAuthInfo = document.querySelector('.auth-info');
            if (existingAuthInfo) {
                existingAuthInfo.textContent = user.email.split('@')[0]; // 사용자 이름만 표시
                existingAuthInfo.title = user.email; // 전체 이메일은 툴팁에 표시
            } else {
                const authInfo = document.createElement('span');
                authInfo.classList.add('auth-info');
                authInfo.textContent = user.email.split('@')[0]; // 사용자 이름만 표시
                authInfo.title = user.email; // 전체 이메일은 툴팁에 표시

                const headerActions = document.querySelector('.header-actions');
                if (headerActions) {
                    headerActions.insertBefore(authInfo, loginButton);
                }
            }
        } else {
            // 로그아웃 상태로 변경
            loginButton.classList.remove('logged-in');
            loginButton.classList.add('login-button');
            loginButton.style.color = '#e74c3c'; // 빨간색 직접 적용
            loginButton.dataset.action = 'login';
            loginButton.title = '로그인';

            // SVG 아이콘 변경 - 로그아웃 상태용 아이콘(기본색)
            loginButton.innerHTML = `
                <svg viewBox="0 0 24 24" width="18" height="18">
                    <path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"></path>
                </svg>
                <span class="btn-tooltip">계정</span>
            `;

            // 사용자 정보 제거
            const authInfo = document.querySelector('.auth-info');
            if (authInfo) {
                authInfo.remove();
            }
        }

        console.log(`로그인 버튼 상태 업데이트: ${isLoggedIn ? '로그인됨' : '로그아웃됨'}`);
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
        console.log('필터 UI 업데이트 시작', {카테고리목록: categories, 태그목록: tags});

        // 카테고리 옵션 업데이트
        categorySelect.innerHTML = '<option value="all">모든 카테고리</option>';
        for (const category of categories) {
            const option = document.createElement('option');
            option.value = category.id;
            option.textContent = category.name;
            categorySelect.appendChild(option);
            console.log('카테고리 옵션 추가:', category.id, category.name);
        }

        // 우선순위 옵션 업데이트 - 아이콘 추가
        prioritySelect.innerHTML = '<option value="all">모든 우선순위</option>';

        // 일반 우선순위
        const option0 = document.createElement('option');
        option0.value = '0';
        option0.textContent = '일반';
        prioritySelect.appendChild(option0);

        // 중요 우선순위
        const option1 = document.createElement('option');
        option1.value = '1';
        option1.textContent = '⭐ 중요';
        option1.style.fontWeight = 'bold';
        option1.style.color = '#ff9800';
        prioritySelect.appendChild(option1);

        // 긴급 우선순위
        const option2 = document.createElement('option');
        option2.value = '2';
        option2.textContent = '🔥 긴급';
        option2.style.fontWeight = 'bold';
        option2.style.color = '#f44336';
        prioritySelect.appendChild(option2);

        console.log('필터 UI 업데이트 완료');
    }

    // 이벤트 리스너 설정
    function setupEventListeners() {
        console.log('이벤트 리스너 설정');

        // 패널 닫기 버튼
        closeBtn.addEventListener('click', closePanel);

        // 검색 및 필터 이벤트
        searchInput.addEventListener('input', handleSearchInput);
        categorySelect.addEventListener('change', handleFilterChange);
        prioritySelect.addEventListener('change', handleFilterChange);
        sortSelect.addEventListener('change', handleFilterChange);

        // 메모 추가 버튼
        addMemoBtn.addEventListener('click', addMemo);

        // 메모 입력 박스에서 Ctrl+Enter로 메모 추가
        memoInput.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'Enter') {
                e.preventDefault();
                addMemo();
            }
        });

        // 기타 이벤트 설정
        setupMarkdownModal();
        setupThemeToggle();
    }

    // 검색 입력 핸들러
    function handleSearchInput() {
        const searchTerm = searchInput.value.toLowerCase();
        const clearSearchBtn = document.getElementById('clear-search-btn');

        activeFilters.searchTerm = searchTerm;
        clearSearchBtn.style.display = searchTerm ? 'block' : 'none';

        renderMemos();

        // 검색어가 있을 때 '검색 결과 없음' 메시지 표시 로직
        if (searchTerm && document.querySelectorAll('.memo-item').length === 0) {
            const noResultsElem = document.createElement('div');
            noResultsElem.className = 'no-search-results';
            noResultsElem.textContent = `"${searchTerm}" 검색 결과가 없습니다.`;
            memosContainer.appendChild(noResultsElem);
        }
    }

    // 필터 변경 핸들러
    function handleFilterChange() {
        activeFilters.category = categorySelect.value;
        activeFilters.priority = prioritySelect.value;
        activeFilters.sortOrder = sortSelect.value;

        renderMemos();
    }

    // 필터 토글 기능 설정
    function setupFilterToggle() {
        if (!filterToggleBtn || !filterContainer) return;

        // 초기 상태 설정 (숨김)
        filterContainer.style.display = 'none';

        // 토글 버튼 클릭 이벤트
        filterToggleBtn.addEventListener('click', toggleFilter);
    }

    // 필터 토글 함수
    function toggleFilter() {
        if (filterContainer.style.display === 'none') {
            filterContainer.style.display = 'block';
            filterContainer.style.animation = 'fadeIn 0.3s ease';
        } else {
            filterContainer.style.display = 'none';
        }
    }

    // 보기 설정 드롭다운 기능 설정
    function setupViewSettingsDropdown() {
        // DOM 요소 직접 가져오기 (재확인)
        const viewSettingsBtn = document.getElementById('view-settings-btn');
        const viewSettingsDropdown = document.getElementById('view-settings-dropdown');

        console.log('setupViewSettingsDropdown 호출됨');
        console.log('viewSettingsBtn:', viewSettingsBtn);
        console.log('viewSettingsDropdown:', viewSettingsDropdown);

        if (!viewSettingsBtn || !viewSettingsDropdown) {
            console.error('보기 설정 드롭다운 요소를 찾을 수 없습니다.');
            return;
        }

        const toggleToolbarCheckbox = document.getElementById('toggle-toolbar-checkbox');
        const toggleCompactCheckbox = document.getElementById('toggle-compact-checkbox');
        const toggleInputAreaCheckbox = document.getElementById('toggle-input-area-checkbox');
        const shortcutHelpBtn = document.getElementById('shortcut-help-btn');

        // 초기 상태 설정
        if (toggleToolbarCheckbox) toggleToolbarCheckbox.checked = !toolbar.classList.contains('hidden');
        if (toggleCompactCheckbox) toggleCompactCheckbox.checked = memosContainer.classList.contains('compact-mode');
        if (toggleInputAreaCheckbox) toggleInputAreaCheckbox.checked = memoEditorContainer.classList.contains('collapsed');

        // 버튼 클릭시 드롭다운 토글
        viewSettingsBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            viewSettingsDropdown.classList.toggle('show');
            console.log('보기 설정 토글 클릭됨. 드롭다운 표시 상태:', viewSettingsDropdown.classList.contains('show'));

            // 토글 후 강제로 표시 설정
            if (viewSettingsDropdown.classList.contains('show')) {
                viewSettingsDropdown.style.display = 'block';
            } else {
                viewSettingsDropdown.style.display = 'none';
            }
        });

        // 체크박스 변경 이벤트 처리
        if (toggleToolbarCheckbox) {
            toggleToolbarCheckbox.addEventListener('change', (e) => {
                toggleMarkdownToolbar(e.target.checked);
            });
        }

        if (toggleCompactCheckbox) {
            toggleCompactCheckbox.addEventListener('change', (e) => {
                toggleCompactMode(e.target.checked);
            });
        }

        if (toggleInputAreaCheckbox) {
            toggleInputAreaCheckbox.addEventListener('change', (e) => {
                toggleMemoEditor(e.target.checked);
            });
        }

        // 단축키 도움말 버튼
        if (shortcutHelpBtn) {
            shortcutHelpBtn.addEventListener('click', (e) => {
                e.preventDefault();
                viewSettingsDropdown.classList.remove('show');
                viewSettingsDropdown.style.display = 'none';
                const shortcutModal = document.getElementById('shortcut-help-modal');
                if (shortcutModal) shortcutModal.classList.add('show');
            });
        }

        // 드롭다운 외부 클릭시 닫기
        document.addEventListener('click', (e) => {
            if (!viewSettingsBtn.contains(e.target) && !viewSettingsDropdown.contains(e.target)) {
                viewSettingsDropdown.classList.remove('show');
                viewSettingsDropdown.style.display = 'none';
            }
        });
    }

    // 툴바 토글 함수
    function toggleMarkdownToolbar(show) {
        if (show === undefined) {
            toolbar.classList.toggle('hidden');
        } else if (show) {
            toolbar.classList.remove('hidden');
        } else {
            toolbar.classList.add('hidden');
        }

        // 설정 저장
        saveSettings({ toolbarVisible: !toolbar.classList.contains('hidden') });
    }

    // 컴팩트 모드 토글 함수
    function toggleCompactMode(enable) {
        if (enable === undefined) {
            memosContainer.classList.toggle('compact-mode');
        } else if (enable) {
            memosContainer.classList.add('compact-mode');
        } else {
            memosContainer.classList.remove('compact-mode');
        }

        // 설정 저장
        saveSettings({ compactMode: memosContainer.classList.contains('compact-mode') });
    }

    // 메모 에디터 토글 함수
    function toggleMemoEditor(collapse) {
        if (collapse === undefined) {
            memoEditorContainer.classList.toggle('collapsed');
        } else if (collapse) {
            memoEditorContainer.classList.add('collapsed');
        } else {
            memoEditorContainer.classList.remove('collapsed');
            // 펼쳤을 때 입력 필드에 자동 포커스
            setTimeout(() => {
                memoInput.focus();
            }, 300);
        }

        // 설정 저장
        saveSettings({ editorCollapsed: memoEditorContainer.classList.contains('collapsed') });
    }

    // 위젯 모드 설명 모달 설정
    function setupWidgetModeHelp() {
        if (!widgetModeHelpBtn) return;

        widgetModeHelpBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const widgetModal = document.getElementById('widget-mode-modal');
            if (widgetModal) widgetModal.classList.add('show');
        });

        // 위젯 모드 모달 닫기 버튼
        const closeWidgetModalBtn = document.getElementById('close-widget-modal');
        if (closeWidgetModalBtn) {
            closeWidgetModalBtn.addEventListener('click', () => {
                const widgetModal = document.getElementById('widget-mode-modal');
                if (widgetModal) widgetModal.classList.remove('show');
            });
        }
    }

    // 단축키 도움말 모달 설정
    function setupShortcutHelpModal() {
        const shortcutModal = document.getElementById('shortcut-help-modal');
        if (!shortcutModal) return;

        const closeShortcutModalBtn = document.getElementById('close-shortcut-modal');
        if (closeShortcutModalBtn) {
            closeShortcutModalBtn.addEventListener('click', () => {
                shortcutModal.classList.remove('show');
            });
        }
    }

    // 키보드 단축키 설정
    function setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // 포커스가 입력 필드에 있는지 확인
            const isInputFocused = document.activeElement.tagName === 'INPUT' ||
                                  document.activeElement.tagName === 'TEXTAREA';

            // 메모 편집 중인지 확인
            const isEditingMemo = document.querySelector('.memo-content.edit-mode') !== null;

            // Ctrl+F: 필터 토글
            if (e.ctrlKey && e.key === 'f') {
                e.preventDefault();
                toggleFilter();
                // 필터가 보이는 상태라면 검색 필드에 포커스
                if (filterContainer.style.display !== 'none') {
                    searchInput.focus();
                }
            }

            // Ctrl+Shift+V: 보기 설정 토글
            if (e.ctrlKey && e.shiftKey && e.key === 'V') {
                e.preventDefault();
                viewSettingsDropdown.classList.toggle('show');
            }

            // Ctrl+H: 마크다운 도움말
            if (e.ctrlKey && e.key === 'h') {
                e.preventDefault();
                const markdownModal = document.getElementById('markdown-modal');
                if (markdownModal) markdownModal.classList.toggle('show');
            }

            // Ctrl+,: 앱 설정
            if (e.ctrlKey && e.key === ',') {
                e.preventDefault();
                window.electronAPI?.openSettings?.();
            }

            // Ctrl+E: 데이터 내보내기
            if (e.ctrlKey && e.key === 'e') {
                e.preventDefault();
                exportData();
            }

            // Ctrl+I: 데이터 가져오기
            if (e.ctrlKey && e.key === 'i') {
                e.preventDefault();
                importData();
            }

            // Ctrl+T: 테마 토글
            if (e.ctrlKey && e.key === 't') {
                e.preventDefault();
                toggleTheme();
            }

            // Ctrl+K: 단축키 도움말
            if (e.ctrlKey && e.key === 'k') {
                e.preventDefault();
                const shortcutModal = document.getElementById('shortcut-help-modal');
                if (shortcutModal) shortcutModal.classList.toggle('show');
            }

            // Alt+N: 새 메모 입력 영역으로 포커스 이동
            if (e.altKey && e.key === 'n' && !isEditingMemo) {
                e.preventDefault();
                memoInput.focus();
            }

            // Alt+F: 검색창으로 포커스 이동
            if (e.altKey && e.key === 'f' && !isEditingMemo) {
                e.preventDefault();
                searchInput.focus();
            }

            // Esc: 현재 작업 취소 (모달 닫기, 편집 취소 등)
            if (e.key === 'Escape') {
                // 열려있는 모든 모달 닫기
                const modals = document.querySelectorAll('.markdown-modal.show');
                for (const modal of modals) {
                    modal.classList.remove('show');
                }

                // 보기 설정 드롭다운 닫기
                if (viewSettingsDropdown.classList.contains('show')) {
                    viewSettingsDropdown.classList.remove('show');
                }

                // 필터 닫기
                if (filterContainer.style.display === 'block') {
                    filterContainer.style.display = 'none';
                }

                // 메모 편집 취소
                if (isEditingMemo && !isInputFocused) {
                    const editMode = document.querySelector('.memo-content.edit-mode');
                    const memoId = editMode.closest('.memo-item').dataset.id;
                    const memoDiv = document.querySelector(`.memo-item[data-id="${memoId}"]`);
                    toggleEditMode(false, memoDiv);
                }
            }
        });
    }

    // 메모 생성 시 위젯 모드 설정
    function createMemoContent(memo) {
        const contentDiv = document.createElement('div');
        contentDiv.className = 'memo-content view-mode';

        // 메모 내용 HTML 변환
        const htmlContent = convertMarkdownToHTML(memo.content);

        // 내용 길이 확인 (대략적인 줄 수 계산)
        const lines = memo.content.split('\n');
        const isLongContent = lines.length > 3 || memo.content.length > 300;

        if (isLongContent) {
            // 제한된 내용만 표시
            const shortContent = lines.slice(0, 3).join('\n');
            const shortHtml = convertMarkdownToHTML(`${shortContent}...`);
            contentDiv.innerHTML = shortHtml;

            // 더보기 링크 추가
            const readMoreLink = document.createElement('a');
            readMoreLink.className = 'read-more-link';
            readMoreLink.textContent = '더보기';
            readMoreLink.href = '#';
            readMoreLink.addEventListener('click', (e) => {
                e.preventDefault();
                // 전체 내용으로 교체
                contentDiv.innerHTML = htmlContent;
                readMoreLink.style.display = 'none';

                // 접기 링크 추가
                const collapseLink = document.createElement('a');
                collapseLink.className = 'read-more-link';
                collapseLink.textContent = '접기';
                collapseLink.href = '#';
                collapseLink.addEventListener('click', (e) => {
                    e.preventDefault();
                    // 짧은 내용으로 교체
                    contentDiv.innerHTML = shortHtml;
                    collapseLink.remove();
                    readMoreLink.style.display = 'block';
                    contentDiv.appendChild(readMoreLink);
                });

                contentDiv.appendChild(collapseLink);
            });

            contentDiv.appendChild(readMoreLink);
        } else {
            contentDiv.innerHTML = htmlContent;
        }

        return contentDiv;
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
        if (!settings) return;

        // 다크 모드 적용
        if (settings.darkMode) {
            document.documentElement.setAttribute('data-theme', 'dark');
        } else {
            document.documentElement.removeAttribute('data-theme');
        }

        // 컴팩트 모드 적용
        if (settings.compactMode) {
            memosContainer.classList.add('compact-mode');
        } else {
            memosContainer.classList.remove('compact-mode');
        }

        // 툴바 표시 설정
        if (settings.toolbarVisible === false) {
            toolbar.classList.add('hidden');
        } else {
            toolbar.classList.remove('hidden');
        }

        // 메모 에디터 접기 설정
        if (settings.editorCollapsed) {
            memoEditorContainer.classList.add('collapsed');
        } else {
            memoEditorContainer.classList.remove('collapsed');
        }

        console.log('설정 적용 완료:', settings);
    }

    // 설정 저장 함수
    async function saveSettings(newSettings) {
        settings = { ...settings, ...newSettings };
        try {
            await window.electronAPI.saveSettings(settings);
            console.log('설정 저장 완료:', settings);
        } catch (error) {
            console.error('설정 저장 오류:', error);
        }
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
        console.log('메모 렌더링 시작, 현재 필터 상태:', activeFilters);

        // 필터링
        let filteredMemos = memos;
        console.log('필터링 전 메모 수:', filteredMemos.length);

        // 검색어 필터링
        if (activeFilters.searchTerm) {
            filteredMemos = filteredMemos.filter(memo =>
                memo.text.toLowerCase().includes(activeFilters.searchTerm)
            );
            console.log('검색어 필터링 후 메모 수:', filteredMemos.length);
        }

        // 카테고리 필터링
        if (activeFilters.category !== 'all') {
            console.log('카테고리 필터링 적용: 선택된 카테고리 ID =', activeFilters.category, '타입:', typeof activeFilters.category);

            // 메모 카테고리 ID 타입 확인
            const memoCategories = filteredMemos.map(m => ({
                id: m.id,
                categoryId: m.categoryId,
                categoryType: typeof m.categoryId,
                text: m.text.substring(0, 10)
            }));
            console.log('필터링 전 메모 카테고리 정보:', memoCategories);

            // 카테고리 ID를 숫자로 변환
            const categoryId = Number.parseInt(activeFilters.category, 10);
            console.log('변환된 카테고리 ID(숫자):', categoryId);

            // 필터링 - 숫자 비교
            filteredMemos = filteredMemos.filter(memo => {
                // 카테고리 ID 타입 확인 및 변환
                let memoCatId = memo.categoryId;
                if (typeof memoCatId === 'string' && memoCatId !== '') {
                    memoCatId = Number.parseInt(memoCatId, 10);
                }

                const result = memoCatId === categoryId;
                console.log(`메모 ID ${memo.id}, 카테고리 ID ${memo.categoryId}(${typeof memo.categoryId}) vs ${categoryId}, 필터 결과: ${result}`);
                return result;
            });

            console.log('카테고리 필터링 후 메모 수:', filteredMemos.length);

            // 카테고리 필터링 결과가 없으면 사용자에게 더 명확한 피드백 제공
            if (filteredMemos.length === 0) {
                // 필터 중인 카테고리 이름 찾기
                const categoryName = categories.find(c => c.id === categoryId)?.name || '알 수 없음';
                console.log(`'${categoryName}' 카테고리에 해당하는 메모가 없습니다.`);
            }
        }

        // 우선순위 필터링
        if (activeFilters.priority !== 'all') {
            filteredMemos = filteredMemos.filter(memo =>
                memo.priority?.toString() === activeFilters.priority
            );
            console.log('우선순위 필터링 후 메모 수:', filteredMemos.length);
        }

        // 정렬 적용
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
            // 위젯 상태인 메모 처리 (제거하지 않고 시각적으로 표현)
            const memoDiv = document.createElement('div');
            memoDiv.classList.add('memo-item');
            memoDiv.dataset.id = memo.id;

            // 위젯인 경우 스타일 변경
            if (memo.isWidget) {
                // 투명도 낮추기
                memoDiv.style.opacity = '0.7';
                memoDiv.classList.add('widget-mode');
            }

            // 강제 표시 플래그가 있으면 특별 스타일 적용 (위젯에서 패널로 돌아온 경우)
            if (memo.forceVisible || memo.recentlyRestored) {
                memoDiv.classList.add('highlight-memo');
                memoDiv.style.border = '2px solid #4a90e2';
                memoDiv.style.boxShadow = '0 0 15px rgba(74, 144, 226, 0.5)';

                // 3초 후 강조 효과 제거
                setTimeout(() => {
                    memoDiv.classList.remove('highlight-memo');
                    memoDiv.style.border = '';
                    memoDiv.style.boxShadow = '';

                    // 플래그도 제거 (일회성)
                    memo.forceVisible = false;
                    memo.recentlyRestored = false;
                }, 3000);
            }

            // 우선순위에 따른 클래스 추가
            if (memo.priority) {
                const priorityClass = `priority-${memo.priority}`;
                memoDiv.classList.add(priorityClass);
            }

            // 메모 내용을 담을 컨테이너
            const contentContainer = document.createElement('div');
            contentContainer.classList.add('memo-content-container');

            // 우선순위 뱃지 추가
            if (memo.priority > 0) {
                const priorityBadge = document.createElement('div');
                priorityBadge.classList.add('priority-badge');

                if (memo.priority === 1) {
                    priorityBadge.textContent = '중요';
                    priorityBadge.classList.add('priority-important');
                } else if (memo.priority === 2) {
                    priorityBadge.textContent = '긴급';
                    priorityBadge.classList.add('priority-urgent');
                }

                contentContainer.appendChild(priorityBadge);
            }

            // 위젯 모드 뱃지 추가
            if (memo.isWidget) {
                const widgetBadge = document.createElement('div');
                widgetBadge.classList.add('widget-badge');
                widgetBadge.textContent = '위젯 모드';
                contentContainer.appendChild(widgetBadge);
            }

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

            // 내용 변경 시 저장
            editModeDiv.addEventListener('blur', async (event) => {
                const newText = event.target.textContent;
                const memoId = Number.parseInt(memoDiv.dataset.id, 10);
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

            // 클릭 이벤트 추가 - 드래그 가능하게 설정
            viewModeDiv.addEventListener('click', (event) => {
                // 이미 선택된 텍스트가 있으면 드래그 이벤트 무시 (텍스트 선택 가능하도록)
                if (window.getSelection().toString()) {
                    return;
                }

                // 부모 memoDiv를 드래그 가능하게 만들기
                memoDiv.draggable = true;
                memoDiv.style.cursor = 'grab';
            });

            // 드래그 관련 이벤트 추가
            memoDiv.addEventListener('dragstart', (event) => {
                event.dataTransfer.setData('text/plain', memoDiv.dataset.id);
                event.dataTransfer.effectAllowed = 'move';
                memoDiv.classList.add('dragging');

                // forEach 대신 for...of 사용
                for (const item of document.querySelectorAll('.memo-item')) {
                    if (item !== memoDiv) {
                        item.classList.add('potential-drop-target');
                    }
                }
            });

            memoDiv.addEventListener('dragend', () => {
                memoDiv.classList.remove('dragging');

                // forEach 대신 for...of 사용
                for (const item of document.querySelectorAll('.potential-drop-target')) {
                    item.classList.remove('potential-drop-target');
                }
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
        const memoId = Number.parseInt(memoDiv.dataset.id, 10);
        const memoToEdit = memos.find(m => m.id === memoId);

        if (isEdit) {
            // 편집 모드로 전환
            viewMode.style.display = 'none';
            editMode.style.display = 'block';
            editMode.focus();

            // 편집 컨트롤 추가
            const editControls = document.createElement('div');
            editControls.classList.add('edit-controls');

            // 우선순위 변경 드롭다운
            const prioritySelect = document.createElement('select');
            prioritySelect.classList.add('edit-priority-select');

            const option0 = document.createElement('option');
            option0.value = '0';
            option0.textContent = '일반';
            option0.selected = memoToEdit.priority === 0;
            prioritySelect.appendChild(option0);

            const option1 = document.createElement('option');
            option1.value = '1';
            option1.textContent = '⭐ 중요';
            option1.selected = memoToEdit.priority === 1;
            prioritySelect.appendChild(option1);

            const option2 = document.createElement('option');
            option2.value = '2';
            option2.textContent = '🔥 긴급';
            option2.selected = memoToEdit.priority === 2;
            prioritySelect.appendChild(option2);

            // 우선순위 변경 이벤트
            prioritySelect.addEventListener('change', () => {
                memoToEdit.priority = Number.parseInt(prioritySelect.value, 10);
                saveMemosToStorage();
            });

            const priorityLabel = document.createElement('label');
            priorityLabel.textContent = '우선순위: ';
            priorityLabel.appendChild(prioritySelect);

            editControls.appendChild(priorityLabel);

            // 카테고리 변경 드롭다운
            if (categories.length > 0) {
                const categorySelect = document.createElement('select');
                categorySelect.classList.add('edit-category-select');

                const noCategoryOption = document.createElement('option');
                noCategoryOption.value = '';
                noCategoryOption.textContent = '카테고리 없음';
                noCategoryOption.selected = !memoToEdit.categoryId;
                categorySelect.appendChild(noCategoryOption);

                for (const category of categories) {
                    const option = document.createElement('option');
                    option.value = category.id;
                    option.textContent = category.name;
                    option.selected = memoToEdit.categoryId === category.id;
                    categorySelect.appendChild(option);
                }

                // 카테고리 변경 이벤트
                categorySelect.addEventListener('change', () => {
                    const value = categorySelect.value;
                    memoToEdit.categoryId = value ? Number.parseInt(value, 10) : null;
                    saveMemosToStorage();
                });

                const categoryLabel = document.createElement('label');
                categoryLabel.textContent = '카테고리: ';
                categoryLabel.appendChild(categorySelect);

                editControls.appendChild(categoryLabel);
            }

            // 저장 버튼
            const saveButton = document.createElement('button');
            saveButton.textContent = '저장';
            saveButton.classList.add('save-edit-btn');
            saveButton.addEventListener('click', () => {
                editMode.blur();
            });

            editControls.appendChild(saveButton);

            // 컨트롤 추가
            if (!memoDiv.querySelector('.edit-controls')) {
                memoDiv.appendChild(editControls);
            }
        } else {
            // 보기 모드로 전환
            viewMode.style.display = 'block';
            editMode.style.display = 'none';

            // 편집 컨트롤 제거
            const editControls = memoDiv.querySelector('.edit-controls');
            if (editControls) {
                memoDiv.removeChild(editControls);
            }

            // 우선순위 클래스 업데이트
            memoDiv.className = 'memo-item';
            if (memoToEdit.priority) {
                memoDiv.classList.add(`priority-${memoToEdit.priority}`);
            }

            // 우선순위 뱃지 업데이트
            const existingBadge = memoDiv.querySelector('.priority-badge');
            if (existingBadge) {
                existingBadge.remove();
            }

            if (memoToEdit.priority > 0) {
                const contentContainer = memoDiv.querySelector('.memo-content-container');
                const priorityBadge = document.createElement('div');
                priorityBadge.classList.add('priority-badge');

                if (memoToEdit.priority === 1) {
                    priorityBadge.textContent = '중요';
                    priorityBadge.classList.add('priority-important');
                } else if (memoToEdit.priority === 2) {
                    priorityBadge.textContent = '긴급';
                    priorityBadge.classList.add('priority-urgent');
                }

                contentContainer.insertBefore(priorityBadge, contentContainer.firstChild);
            }
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

        // 추가 디버깅 정보 출력
        console.log('카테고리 선택 요소:', categorySelect);
        console.log('카테고리 선택값(raw):', categorySelect.value);
        console.log('카테고리 선택된 옵션:', categorySelect.options[categorySelect.selectedIndex]);

        // 선택된 카테고리 값 가져오기 - 문자열이 아닌 숫자로 변환
        let categoryId = null;
        if (categorySelect.value && categorySelect.value !== "") {
            // 직접 숫자로 변환 (Number.parseInt + Number.isNaN으로 안전하게 검증)
            const parsedId = Number.parseInt(categorySelect.value, 10);
            categoryId = Number.isNaN(parsedId) ? null : parsedId;
            console.log('선택된 카테고리 ID(숫자형):', categoryId, typeof categoryId);
        }

        console.log('새 메모 추가 - 선택된 카테고리 값(원본):', categorySelect.value, typeof categorySelect.value);
        console.log('새 메모 추가 - 선택된 우선순위:', prioritySelect.value);

        // 선택된 카테고리 이름 가져오기 (디버깅용)
        let categoryName = '없음';
        if (categoryId) {
            const selectedCategory = categories.find(cat => cat.id === categoryId);
            categoryName = selectedCategory ? selectedCategory.name : '없음';
            console.log('카테고리 찾기 결과:', selectedCategory);
        }
        console.log('새 메모 추가 - 카테고리 이름:', categoryName);

        // 타임스탬프 기반 ID 생성 (고유 값 보장)
        const memo_id = Date.now();

        // 카테고리 ID를 최종 확인 (진짜 null 또는 진짜 숫자만)
        console.log('최종 카테고리 ID 타입 확인:', typeof categoryId);
        console.log('최종 카테고리 ID 값 확인:', categoryId);

        const newMemo = {
            id: memo_id,
            text: text,
            isWidget: false,
            categoryId: categoryId, // 정확한 숫자 또는 null
            priority: Number.parseInt(prioritySelect.value, 10),
            tags: [],
            color: null,
            reminder: null,
            images: [],
            createdAt: new Date().toISOString()
        };

        console.log('새 메모 객체 (저장 전):', JSON.stringify(newMemo));

        memos.unshift(newMemo); // 배열 맨 앞에 추가
        saveMemosToStorage();

        // 메모 렌더링 후 새 메모로 스크롤
        renderMemos().then(() => {
            // 새 메모 요소 찾기
            const newMemoElement = document.querySelector(`.memo-item[data-id="${memo_id}"]`);
            if (newMemoElement) {
                // 부드럽게 스크롤
                newMemoElement.scrollIntoView({ behavior: 'smooth', block: 'center' });

                // 새 메모 강조 효과
                newMemoElement.classList.add('new-memo');
                setTimeout(() => {
                    newMemoElement.classList.remove('new-memo');
                }, 2000);
            }

            // 성공 메시지 표시
            const priorityText = newMemo.priority === 1 ? '중요' : (newMemo.priority === 2 ? '긴급' : '일반');
            const categoryText = categoryName !== '없음' ? `${categoryName} 카테고리에 ` : '';
            showToast(`${priorityText} 메모가 ${categoryText}추가되었습니다.`);
        });

        // 입력 필드 초기화
        memoInput.value = '';

        // 입력 필드에 포커스
        memoInput.focus();
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
            console.log('저장 전 메모 확인:', memos.map(m => ({
                id: m.id,
                text: m.text.substring(0, 15),
                categoryId: m.categoryId,
                categoryType: typeof m.categoryId
            })));

            // 저장 전에 메모 객체의 카테고리 ID가 제대로 숫자 형태인지 확인
            const sanitizedMemos = memos.map(memo => {
                // 깊은 복사를 통해 새 객체 생성
                const newMemo = {...memo};

                // categoryId가 문자열이면 숫자로 변환
                if (typeof newMemo.categoryId === 'string' && newMemo.categoryId !== '') {
                    const parsedId = Number.parseInt(newMemo.categoryId, 10);
                    newMemo.categoryId = Number.isNaN(parsedId) ? null : parsedId;
                    console.log(`메모 ID ${newMemo.id}의 카테고리ID를 문자열에서 숫자로 변환: ${memo.categoryId} -> ${newMemo.categoryId}`);
                }

                // 카테고리 ID가 null이고 categoryId가 '[NULL]'과 같은 문자열이면 null로 확실히 설정
                if (newMemo.categoryId === '[NULL]' || newMemo.categoryId === 'null' || newMemo.categoryId === '') {
                    console.log(`메모 ID ${newMemo.id}의 카테고리ID를 null로 설정: ${memo.categoryId} -> null`);
                    newMemo.categoryId = null;
                }

                return newMemo;
            });

            console.log('sanitizedMemos 최종 확인:', sanitizedMemos.map(m => ({
                id: m.id,
                text: m.text.substring(0, 15),
                categoryId: m.categoryId,
                categoryType: typeof m.categoryId
            })));

            // 직접 백엔드 요청 데이터 확인
            console.log('백엔드로 전송되는 JSON 데이터:', JSON.stringify(sanitizedMemos));

            // 저장 전에 데이터 직접 출력해서 확인
            console.log('✅ 카테고리 ID 체크:',
                sanitizedMemos.map(m => `메모 ID: ${m.id}, 카테고리 ID: ${m.categoryId}, 타입: ${typeof m.categoryId}`).join('\n'));

            const result = await window.electronAPI.saveMemos(sanitizedMemos);
            console.log('메모 저장 결과:', result);
        } catch (error) {
            console.error('메모 저장 오류:', error);
            showErrorNotification('메모 저장 중 오류가 발생했습니다.');
        }
    }

    // 메모 로드
    async function loadMemosFromStorage() {
        try {
            // 로그인 상태 확인
            const auth = await window.electronAPI.getAuthStatus();
            const isLoggedIn = auth?.isLoggedIn;

            if (!isLoggedIn) {
                console.log('로그인되지 않음: 빈 메모 목록 사용');
                memos = [];
                return await renderMemos();
            }

            // 메모 로드 시도
            const loadResult = await window.electronAPI.getMemos();

            // 로드 결과가 없거나 오류인 경우 빈 배열 처리
            if (!loadResult || !Array.isArray(loadResult)) {
                console.error('잘못된 메모 데이터 형식:', loadResult);
                memos = [];
                return await renderMemos();
            }

            memos = loadResult;
            console.log('메모 로드 완료, 로드된 메모 수:', memos.length);

            // 로드된 메모의 카테고리 ID가 제대로 숫자 형태인지 확인
            memos = memos.map(memo => {
                try {
                    // null 체크 먼저 수행
                    if (memo.categoryId === null || memo.categoryId === undefined) {
                        return memo;
                    }

                    // 카테고리 ID가 문자열이면 숫자로 변환
                    if (typeof memo.categoryId === 'string' && memo.categoryId !== '') {
                        const numericId = Number.parseInt(memo.categoryId, 10);
                        console.log(`메모 ID ${memo.id}의 카테고리ID를 문자열에서 숫자로 변환: ${memo.categoryId} -> ${numericId}`);
                        memo.categoryId = numericId;
                    }

                    // 카테고리 ID가 특수 문자열이면 null로 확실히 설정
                    if (memo.categoryId === '[NULL]' || memo.categoryId === 'null' || memo.categoryId === '') {
                        console.log(`메모 ID ${memo.id}의 카테고리ID를 null로 설정: ${memo.categoryId} -> null`);
                        memo.categoryId = null;
                    }
                } catch (memoErr) {
                    console.error(`메모 처리 중 오류(ID: ${memo?.id || '알 수 없음'}):`, memoErr);
                    // 오류 발생해도 메모 유지 (최소한의 손상만)
                }
                return memo;
            });

            console.log('메모 처리 후 상태 확인:', memos.slice(0, 3).map(m => ({
                id: m.id,
                text: m.text && typeof m.text === 'string' ? m.text.substring(0, 15) : '텍스트 없음',
                categoryId: m.categoryId,
                categoryType: typeof m.categoryId
            })));
        } catch (error) {
            console.error('메모 로드 오류:', error);
            showErrorNotification('메모 로드 중 오류가 발생했습니다.');
            memos = [];
        }

        try {
            await renderMemos();
        } catch (renderError) {
            console.error('메모 렌더링 오류:', renderError);
            showErrorNotification('메모 표시 중 오류가 발생했습니다.');
            // 최후의 수단: 메모 컨테이너 비우기
            memosContainer.innerHTML = '<div class="error-message">메모를 표시할 수 없습니다. 페이지를 새로고침하세요.</div>';
        }
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
    addMemoBtn.addEventListener('click', () => {
        console.log('메모 추가 버튼 클릭됨');
        addMemo();
    });
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
        return (...args) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => {
                func(...args);
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

    // 마크다운 도움말 모달 관련 함수
    function setupMarkdownModal() {
        const markdownHintBtn = document.getElementById('markdown-hint-btn');
        const markdownModal = document.getElementById('markdown-modal');
        const closeModalBtn = document.getElementById('close-markdown-modal');

        if (markdownHintBtn && markdownModal && closeModalBtn) {
            // 마크다운 도움말 버튼 클릭 이벤트
            markdownHintBtn.addEventListener('click', () => {
                markdownModal.classList.add('show');
            });

            // 모달 닫기 버튼 이벤트
            closeModalBtn.addEventListener('click', () => {
                markdownModal.classList.remove('show');
            });

            // 모달 바깥 클릭 시 닫기
            markdownModal.addEventListener('click', (e) => {
                if (e.target === markdownModal) {
                    markdownModal.classList.remove('show');
                }
            });

            // ESC 키로 모달 닫기
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && markdownModal.classList.contains('show')) {
                    markdownModal.classList.remove('show');
                }
            });
        }
    }

    // 테마 토글 기능
    function setupThemeToggle() {
        const themeToggleBtn = document.getElementById('theme-toggle-btn');
        if (themeToggleBtn) {
            const lightIcon = themeToggleBtn.querySelector('.theme-light-icon');
            const darkIcon = themeToggleBtn.querySelector('.theme-dark-icon');

            // 현재 테마에 맞게 아이콘 초기 상태 설정
            updateThemeIcons();

            // 버튼 클릭 이벤트
            themeToggleBtn.addEventListener('click', async () => {
                const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
                const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

                // DOM에 새 테마 적용
                document.documentElement.setAttribute('data-theme', newTheme);

                // 설정 저장
                const currentSettings = await window.electronAPI.getSettings();
                const updatedSettings = { ...currentSettings, theme: newTheme };
                await window.electronAPI.updateSettings(updatedSettings);

                // 아이콘 업데이트
                updateThemeIcons();
            });
        }
    }

    // 현재 테마에 맞게 아이콘 상태 업데이트
    function updateThemeIcons() {
        const themeToggleBtn = document.getElementById('theme-toggle-btn');
        if (themeToggleBtn) {
            const lightIcon = themeToggleBtn.querySelector('.theme-light-icon');
            const darkIcon = themeToggleBtn.querySelector('.theme-dark-icon');
            const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';

            if (currentTheme === 'dark') {
                lightIcon.style.display = 'none';
                darkIcon.style.display = 'block';
                themeToggleBtn.title = '라이트 모드로 전환';
            } else {
                lightIcon.style.display = 'block';
                darkIcon.style.display = 'none';
                themeToggleBtn.title = '다크 모드로 전환';
            }
        }
    }

    // 메모 입력 영역 토글 버튼 설정
    function setupMemoEditorToggle() {
        console.log('메모 입력 영역 토글 버튼 설정');
        const toggleBtn = document.getElementById('toggle-editor-btn');

        if (toggleBtn) {
            // 기존 이벤트 리스너 제거 (이중 바인딩 방지)
            toggleBtn.removeEventListener('click', handleMemoEditorToggle);

            // 새 이벤트 리스너 추가
            toggleBtn.addEventListener('click', handleMemoEditorToggle);
            console.log('메모 에디터 토글 버튼에 이벤트 리스너 추가 완료');
        } else {
            console.warn('메모 에디터 토글 버튼을 찾을 수 없습니다.');
        }
    }

    // 메모 입력 영역 표시/숨김 토글 함수
    function handleMemoEditorToggle() {
        const editorContainer = document.getElementById('memo-editor-container');
        const toggleBtn = document.getElementById('toggle-editor-btn');

        if (editorContainer.classList.contains('collapsed')) {
            // 확장
            editorContainer.classList.remove('collapsed');
            editorContainer.style.height = 'auto';
            toggleBtn.innerHTML = `
                <svg viewBox="0 0 24 24" width="16" height="16">
                    <path fill="currentColor" d="M12 8l-6 6 1.41 1.41L12 10.83l4.59 4.58L18 14l-6-6z"></path>
                </svg>
                <span>접기</span>
            `;
            toggleBtn.title = "입력 영역 접기";
        } else {
            // 접기
            editorContainer.classList.add('collapsed');
            editorContainer.style.height = '42px';
            toggleBtn.innerHTML = `
                <svg viewBox="0 0 24 24" width="16" height="16">
                    <path fill="currentColor" d="M16.59 8.59L12 13.17 7.41 8.59 6 10l6 6 6-6-1.41-1.41z"></path>
                </svg>
                <span>펼치기</span>
            `;
            toggleBtn.title = "입력 영역 펼치기";
        }
    }

    // 마크다운 툴바 토글 함수
    function handleMarkdownToolbarToggle() {
        const toolbar = document.getElementById('markdown-toolbar');
        const toolbarToggleBtn = document.getElementById('toggle-toolbar-btn');

        if (toolbar.style.display === 'none') {
            toolbar.style.display = 'flex';
            toolbarToggleBtn.textContent = '툴바 숨기기';
        } else {
            toolbar.style.display = 'none';
            toolbarToggleBtn.textContent = '툴바 보기';
        }
    }

    // 설정 저장 함수
    async function updateSettings(newSettings) {
        settings = { ...settings, ...newSettings };
        try {
            await window.electronAPI.saveSettings(settings);
            console.log('설정 저장 완료:', settings);
        } catch (error) {
            console.error('설정 저장 오류:', error);
        }
    }

    // 초기화 함수 호출
    initialize();
});

// 메모 추가 버튼 이벤트 연결
function setupAddMemoButton() {
    const memoInput = document.getElementById('memo-input');
    const addMemoBtn = document.getElementById('add-memo-btn');
    const newMemoCategory = document.getElementById('new-memo-category');
    const newMemoPriority = document.getElementById('new-memo-priority');

    console.log('setupAddMemoButton: 메모 추가 버튼 설정 시작');

    // 카테고리 선택 변경 이벤트 추가
    newMemoCategory.addEventListener('change', function() {
        console.log('새 메모 카테고리 선택됨:', this.value, typeof this.value);
        if (this.selectedIndex >= 0) {
            console.log('선택된 옵션 텍스트:', this.options[this.selectedIndex].text);
        }
    });

    // 기존 카테고리로 드롭다운 채우기
    updateCategoryDropdown();
    console.log('카테고리 드롭다운 업데이트됨');

    // 메모 추가 이벤트
    addMemoBtn.addEventListener('click', () => {
        console.log('메모 추가 버튼 클릭됨');
        addMemo();
    });

    // 엔터 키로 메모 추가 (Shift+Enter는 줄바꿈)
    memoInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' && !event.shiftKey && event.target.value.trim()) {
            event.preventDefault();
            console.log('Enter 키 눌림 - 메모 추가');
            addMemo();
        }
    });

    // 카테고리 드롭다운 재점검
    setTimeout(() => {
        const dropdown = document.getElementById('new-memo-category');
        console.log('카테고리 드롭다운 지연 점검:',
            dropdown ? '찾음' : '못찾음',
            dropdown ? `옵션 ${dropdown.options.length}개` : '');

        if (dropdown && dropdown.options.length <= 1 && categories.length > 0) {
            console.log('카테고리 드롭다운 재구성');
            updateCategoryDropdown();
        }
    }, 1000);

    // 마크다운 툴바 이벤트 연결
    setupMarkdownToolbar();

    console.log('setupAddMemoButton: 메모 추가 버튼 설정 완료');
}

// 마크다운 툴바 설정
function setupMarkdownToolbar() {
    const toolbarButtons = document.querySelectorAll('.toolbar-btn');
    const memoInput = document.getElementById('memo-input');

    for (const button of toolbarButtons) {
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
                        formattedText = '[링크 텍스트](url)';
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
    }
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

// 로그아웃 드롭다운 메뉴 표시
function showAuthDropdown() {
    let dropdown = document.getElementById('auth-dropdown');

    // 이미 드롭다운이 있으면 반환
    if (dropdown) return;

    // 드롭다운 메뉴 생성
    dropdown = document.createElement('div');
    dropdown.id = 'auth-dropdown';
    dropdown.className = 'auth-dropdown';

    // 로그아웃 옵션 추가
    const logoutOption = document.createElement('div');
    logoutOption.className = 'dropdown-option';
    logoutOption.id = 'logout-option';
    logoutOption.innerHTML = `
        <svg viewBox="0 0 24 24" width="16" height="16">
            <path fill="currentColor" d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"></path>
        </svg>
        <span>로그아웃</span>
    `;

    logoutOption.addEventListener('click', handleLogout);
    dropdown.appendChild(logoutOption);

    // 드롭다운 메뉴 위치 조정 및 추가
    const authButton = document.getElementById('auth-button');
    if (authButton) {
        const rect = authButton.getBoundingClientRect();
        dropdown.style.top = `${rect.bottom + 5}px`;
        dropdown.style.right = '20px';

        document.body.appendChild(dropdown);

        // 명시적으로 보이게 설정
        dropdown.style.display = 'block';

        console.log('로그아웃 드롭다운 메뉴가 생성되었습니다.');

        // 드롭다운과 버튼에 마우스 이벤트 추가
        dropdown.addEventListener('mouseleave', hideAuthDropdown);

        // 드롭다운 메뉴에 마우스가 들어왔을 때 이벤트 처리
        dropdown.addEventListener('mouseenter', () => {
            const existingDropdown = document.getElementById('auth-dropdown');
            if (existingDropdown) {
                clearTimeout(window.dropdownTimeout);
            }
        });
    }
}

// 로그아웃 드롭다운 메뉴 숨기기
function hideAuthDropdown() {
    // 타임아웃 설정하여 즉시 제거하지 않고 약간의 지연 후 제거
    window.dropdownTimeout = setTimeout(() => {
        const dropdown = document.getElementById('auth-dropdown');
        if (dropdown) {
            dropdown.remove();
        }
    }, 300); // 300ms 지연
}

// 로그인 버튼을 위한 이벤트 추가
function setupAuthButton() {
    const authButton = document.getElementById('auth-button');
    console.log('setupAuthButton 함수 실행, 버튼 요소:', authButton ? '있음' : '없음');

    if (authButton) {
        // 기존 이벤트 리스너 제거 (이중 바인딩 방지)
        authButton.removeEventListener('click', handleLoginClick);

        // 새 이벤트 리스너 추가
        authButton.addEventListener('click', handleLoginClick);
        console.log('로그인 버튼에 이벤트 리스너 추가 완료');

        // 마우스가 로그인 버튼을 떠날 때 이벤트 처리
        authButton.addEventListener('mouseleave', () => {
            window.dropdownTimeout = setTimeout(() => {
                const dropdown = document.getElementById('auth-dropdown');
                if (dropdown && !dropdown.matches(':hover')) {
                    dropdown.remove();
                }
            }, 300); // 300ms 지연
        });

        // 마우스 오버 시 로그인 상태에 따라 동작 변경
        authButton.addEventListener('mouseenter', async () => {
            // 로그인 상태 확인
            try {
                const auth = await window.electronAPI.getAuthStatus();
                const isLoggedIn = auth?.isLoggedIn;

                // 로그인된 상태에서만 드롭다운 메뉴 표시
                if (isLoggedIn) {
                    showAuthDropdown();
                }
            } catch (error) {
                console.error('로그인 상태 확인 오류:', error);
            }
        });
    } else {
        console.error('로그인 버튼 요소를 찾을 수 없습니다.');
    }
}

// 로그인/로그아웃 처리
async function handleAuthAction(event) {
    try {
        // 이벤트가 있으면 기본 동작 방지
        event?.preventDefault?.();
        event?.stopPropagation?.();

        // 현재 로그인 상태 확인
        const auth = await window.electronAPI.getAuthStatus();
        const isLoggedIn = auth?.isLoggedIn;

        if (isLoggedIn) {
            // 로그인 상태라면 아무 작업 안함 (마우스 오버가 처리)
            return;
        }

        // 로그인 상태가 아니라면 로그인 페이지 열기
        console.log('로그인 페이지 열기 시도');
        window.electronAPI.openLoginWindow();
        console.log('openLoginWindow 호출 완료');
    } catch (error) {
        console.error('인증 처리 오류:', error);
    }
}

// 로그아웃 처리
async function handleLogout() {
    try {
        const result = await window.electronAPI.signOut();

        if (result.success) {
            console.log('로그아웃 성공');
            // 로그아웃 성공 시 UI 업데이트
            updateAuthButtonState(false, null);

            // 메모 목록 초기화
            memos = [];
            renderMemos();

            // 로그인 프롬프트 표시
            showLoginPrompt();

            // 드롭다운 메뉴 제거
            const dropdown = document.getElementById('auth-dropdown');
            if (dropdown) {
                dropdown.remove();
            }
        } else {
            console.error('로그아웃 실패:', result.error);
            showErrorNotification('로그아웃 중 오류가 발생했습니다.');
        }
    } catch (error) {
        console.error('로그아웃 처리 오류:', error);
        showErrorNotification('로그아웃 중 오류가 발생했습니다.');
    }
}

// 로그인 버튼 클릭 처리
function handleLoginClick(e) {
    console.log('handleLoginClick 함수 실행');
    if (e) {
        e.preventDefault();
        e.stopPropagation();
    }

    // 기존 에러 알림 제거
    const existingErrors = document.querySelectorAll('.error-notification');
    for (const el of existingErrors) {
        if (el.parentNode) {
            el.parentNode.removeChild(el);
        }
    }

    // 현재 로그인 상태 확인
    window.electronAPI.getAuthStatus().then(auth => {
        const isLoggedIn = auth?.isLoggedIn;
        console.log('현재 로그인 상태:', isLoggedIn ? '로그인됨' : '로그아웃됨');

        if (isLoggedIn) {
            // 로그인된 상태면 드롭다운 표시 (로그아웃 옵션 포함)
            showAuthDropdown();
        } else {
            // 로그인 창 열기
            console.log('로그인 창 열기 시도');
            try {
                window.electronAPI.openLoginWindow();
                console.log('로그인 창 요청 완료');
            } catch (error) {
                console.error('로그인 창 열기 오류:', error);
                showErrorNotification('로그인 창을 열 수 없습니다. 개발자 도구를 확인하세요.');
            }
        }
    }).catch(error => {
        console.error('로그인 상태 확인 오류:', error);
        showErrorNotification(`로그인 상태를 확인할 수 없습니다: ${error.message}`);
    });
}

// 컴팩트 모드 토글 함수
function toggleCompactMode() {
    const memosContainer = document.getElementById('memos-container');
    const compactBtn = document.getElementById('compact-mode-btn');

    // 컴팩트 모드 상태 토글
    const isCompact = memosContainer.classList.toggle('compact-mode');

    // 버튼 텍스트 업데이트
    if (isCompact) {
        compactBtn.textContent = '확장 모드';
        compactBtn.title = '메모를 더 크게 표시';
        localStorage.setItem('memo-compact-mode', 'true');
    } else {
        compactBtn.textContent = '컴팩트 모드';
        compactBtn.title = '메모를 더 작게 표시';
        localStorage.setItem('memo-compact-mode', 'false');
    }
}

// 드래그 앤 드롭을 위한 메모 컨테이너 설정
function setupDragAndDrop(containerElement) {
    console.log('드래그 앤 드롭 설정');

    if (!containerElement) {
        console.error('메모 컨테이너를 찾을 수 없습니다.');
        return;
    }

    // 메모 컨테이너에 드롭 영역 이벤트 추가
    containerElement.addEventListener('dragover', (e) => {
        e.preventDefault();
        const draggedItem = document.querySelector('.dragging');
        if (draggedItem) {
            // 드래그 중인 아이템이 있을 때만 처리
            e.dataTransfer.dropEffect = 'move';

            // 드롭 위치 하이라이트 효과
            const afterElement = getDragAfterElement(containerElement, e.clientY);
            if (afterElement == null) {
                containerElement.appendChild(draggedItem);
            } else {
                containerElement.insertBefore(draggedItem, afterElement);
            }
        }
    });

    // 드롭 이벤트 처리
    containerElement.addEventListener('drop', (e) => {
        e.preventDefault();

        // 드래그 클래스 제거
        const draggedItem = document.querySelector('.dragging');
        if (draggedItem) {
            draggedItem.classList.remove('dragging');

            // 메모 순서 저장
            saveMemoOrder();
        }

        // 드롭 타겟 스타일 제거
        const potentialDropTargets = document.querySelectorAll('.potential-drop-target');
        for (const item of potentialDropTargets) {
            item.classList.remove('potential-drop-target');
        }
    });

    console.log('드래그 앤 드롭 설정 완료');
}

// 드래그 위치 계산 헬퍼 함수
function getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('.memo-item:not(.dragging)')];

    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;

        if (offset < 0 && offset > closest.offset) {
            return { offset: offset, element: child };
        }
        return closest;
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

// 메모 순서 저장
function saveMemoOrder() {
    // 현재 DOM에 표시된 순서대로 메모 ID 수집
    const memoIds = [...document.querySelectorAll('.memo-item')].map(item =>
        Number.parseInt(item.dataset.id, 10)
    );

    // 목록 재정렬
    if (memoIds.length > 0) {
        // 새 배열에 재정렬된 메모 추가
        const newOrder = [];
        for (const id of memoIds) {
            const memo = memos.find(m => m.id === id);
            if (memo) {
                newOrder.push(memo);
            }
        }

        // 기존 배열 업데이트
        if (newOrder.length === memos.length) {
            memos = newOrder;
            saveMemosToStorage();
            console.log('메모 순서 저장 완료');
        } else {
            console.warn('메모 순서 저장 실패: 길이 불일치',
                {새순서길이: newOrder.length, 원래길이: memos.length});
        }
    }
}

// 로그인 오류 핸들러 설정
function setupLoginErrorHandler(loadMemosFunc, updateFilterUIFunc) {
    console.log('로그인 오류 핸들러 설정');

    if (!loadMemosFunc || !updateFilterUIFunc) {
        console.error('로그인 핸들러에 필요한 함수가 제공되지 않았습니다.');
        return;
    }

    // 로그인 이벤트 리스너 추가
    window.electronAPI.onLoginSuccess((event, user) => {
        console.log('로그인 성공 이벤트 수신:', user);
        updateAuthButtonState(true, user);

        // 데이터 로드
        loadMemosFunc();
        updateFilterUIFunc();

        // 로그인 프롬프트 제거
        const loginPrompt = document.querySelector('.login-prompt');
        if (loginPrompt) {
            loginPrompt.remove();
        }

        // 성공 메시지 표시
        showToast('로그인 되었습니다. 환영합니다!');
    });

    window.electronAPI.onLoginError((event, error) => {
        console.error('로그인 오류 이벤트 수신:', error);
        updateAuthButtonState(false, null);
        showErrorNotification(`로그인 실패: ${error?.message || '알 수 없는 오류'}`);
    });

    console.log('로그인 오류 핸들러 설정 완료');
}
