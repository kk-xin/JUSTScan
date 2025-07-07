// 全局变量
let allCards = [];
const API_BASE_URL = 'http://localhost:5050';
let speechSynthesis = window.speechSynthesis;
let currentUtterance = null;

// 语音控制功能
let speechEnabled = true;
let speechSettings = {
    rate: 0.8,
    pitch: 1.0,
    volume: 1.0,
    voice: 'auto'
};

// 新增：全局变量记录当前选中单词索引
let currentDetailIndex = 0;

document.addEventListener('DOMContentLoaded', function() {
    loadAllWordCards();
    initializeEventListeners();
    initializeSpeech();
});

function initializeEventListeners() {
    // 新增单词卡按钮点击
    document.getElementById('addCardBtn').addEventListener('click', showAddCardModal);
    // 回收站按钮点击
    document.getElementById('trashBtn').addEventListener('click', showTrashModal);
    // 收藏夹按钮点击
    document.getElementById('favoritesBtn').addEventListener('click', () => {
        window.location.href = 'favorites';
    });
    // 排序选择
    document.getElementById('sortSelect').addEventListener('change', handleSort);
    
    // 语音控制按钮
    document.getElementById('speechControlBtn').addEventListener('click', toggleSpeechControl);
}

function initializeSpeech() {
    // 检查浏览器是否支持语音合成
    if (!speechSynthesis) {
        console.warn('浏览器不支持语音合成功能');
        return;
    }
    
    // 设置语音参数
    speechSynthesis.cancel(); // 清除之前的语音队列
}

// 处理排序
function handleSort() {
    // 获取排序方式
    const sortType = document.getElementById('sortSelect').value;
    const sorted = sortCards(allCards, sortType);
    renderWordListAndDetail(sorted);
}

// 排序单词卡
function sortCards(cards, sortType) {
    const sorted = [...cards];
    
    switch (sortType) {
        case 'word_asc':
            sorted.sort((a, b) => a.word.localeCompare(b.word));
            break;
        case 'word_desc':
            sorted.sort((a, b) => b.word.localeCompare(a.word));
            break;
        case 'modify_time_desc':
            sorted.sort((a, b) => new Date(b.modify_time || 0) - new Date(a.modify_time || 0));
            break;
        case 'modify_time_asc':
            sorted.sort((a, b) => new Date(a.modify_time || 0) - new Date(b.modify_time || 0));
            break;
        default:
            // 默认顺序，保持原有顺序
            break;
    }
    
    return sorted;
}

// 加载所有单词卡
async function loadAllWordCards() {
    try {
        const resp = await fetch(`${API_BASE_URL}/get_words`);
        if (!resp.ok) throw new Error('无法获取单词卡');
        const data = await resp.json();
        if (!data.success) throw new Error(data.error || '获取单词失败');
        allCards = data.data || [];
        renderWordListAndDetail(allCards);
        updateTrashCount();
        updateFavoritesCount();
    } catch (e) {
        document.getElementById('wordList').innerHTML = '<div style="color:#f87171;">加载单词卡失败: ' + e.message + '</div>';
    }
}

// 更新回收站数量
async function updateTrashCount() {
    try {
        const response = await fetch(`${API_BASE_URL}/get_deleted_cards`);
        if (response.ok) {
            const data = await response.json();
            const count = data.cards ? data.cards.length : 0;
            document.getElementById('trashCount').textContent = count;
        }
    } catch (e) {
        console.error('获取回收站数量失败:', e);
    }
}

// 更新收藏数量
async function updateFavoritesCount() {
    try {
        const response = await fetch(`${API_BASE_URL}/get_words`);
        if (response.ok) {
            const data = await response.json();
            // 统计所有 is_favorite 为 true 的单词卡数量
            const count = (data.data || []).filter(card => card.is_favorite).length;
            document.getElementById('favoritesCount').textContent = count;
        }
    } catch (e) {
        console.error('获取收藏数量失败:', e);
    }
}

// 显示回收站模态框
async function showTrashModal() {
    try {
        const response = await fetch(`${API_BASE_URL}/get_deleted_cards`);
        if (!response.ok) throw new Error('获取回收站失败');
        
        const data = await response.json();
        const deletedCards = data.cards || [];
        
        // 创建模态框
        const modal = document.createElement('div');
        modal.className = 'trash-modal';
        modal.innerHTML = `
            <div class="trash-modal-content">
                <div class="trash-modal-header">
                    <h3>回收站</h3>
                    <button class="btn-close" onclick="closeTrashModal()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="trash-modal-body">
                    ${deletedCards.length === 0 ? 
                        '<div style="text-align:center;color:#fff;opacity:0.7;padding:2em;">回收站为空</div>' :
                        deletedCards.map(card => `
                            <div class="trash-card">
                                <div class="trash-card-content">
                                    <div style="font-size:1.2em;font-weight:600;color:#fff;margin-bottom:0.5em;">
                                        ${card.word}
                                    </div>
                                    <div style="font-size:1em;color:#ffd700;margin-bottom:0.5em;">
                                        ${card.meaning || ''}
                                    </div>
                                    <div style="font-size:0.9em;color:#fff;opacity:0.8;margin-bottom:0.5em;">
                                        ${card.example || ''}
                                    </div>
                                    <div style="font-size:0.8em;color:#fff;opacity:0.6;">
                                        删除时间: ${card.deleted_time}
                                    </div>
                                </div>
                                <div class="trash-card-actions">
                                    <button class="btn-restore" onclick="restoreCard('${card.word}')" title="恢复">
                                        <i class="fas fa-undo"></i>
                                    </button>
                                    <button class="btn-permanent-delete" onclick="permanentDeleteCard('${card.word}')" title="永久删除">
                                        <i class="fas fa-trash"></i>
                                    </button>
                                </div>
                            </div>
                        `).join('')
                    }
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
    } catch (error) {
        showNotification('打开回收站失败: ' + error.message, 'error');
    }
}

// 关闭回收站模态框
function closeTrashModal() {
    const modal = document.querySelector('.trash-modal');
    if (modal) {
        modal.remove();
    }
}

// 恢复单词卡
async function restoreCard(word) {
    if (!confirm(`确定要恢复单词 "${word}" 吗？`)) {
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/restore_card`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ word })
        });
        
        if (!response.ok) throw new Error('恢复失败');
        
        const data = await response.json();
        if (data.success) {
            showNotification('单词卡恢复成功', 'success');
            // 重新加载单词卡和回收站
            await loadAllWordCards();
            closeTrashModal();
            await showTrashModal();
        } else {
            throw new Error(data.error || '恢复失败');
        }
    } catch (error) {
        showNotification('恢复失败: ' + error.message, 'error');
    }
}

// 永久删除单词卡
async function permanentDeleteCard(word) {
    if (!confirm(`确定要永久删除单词 "${word}" 吗？此操作不可撤销！`)) {
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/permanent_delete_card`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ word })
        });
        
        if (!response.ok) throw new Error('删除失败');
        
        const data = await response.json();
        if (data.success) {
            showNotification('单词卡永久删除成功', 'success');
            // 重新加载回收站
            closeTrashModal();
            await showTrashModal();
            updateTrashCount();
        } else {
            throw new Error(data.error || '删除失败');
        }
    } catch (error) {
        showNotification('删除失败: ' + error.message, 'error');
    }
}

// 渲染所有单词卡
function renderWordListAndDetail(cards) {
    const listPanel = document.getElementById('wordList');
    const detailPanel = document.getElementById('cardDetailContainer');
    listPanel.innerHTML = '';
    if (!cards.length) {
        detailPanel.innerHTML = '<div style="color:#fff;opacity:0.7;text-align:center;margin-top:3em;">暂无单词</div>';
        return;
    }
    cards.forEach((item, idx) => {
        const li = document.createElement('li');
        li.textContent = item.word;
        li.onclick = () => {
            document.querySelectorAll('#wordList li').forEach(e => e.classList.remove('selected'));
            li.classList.add('selected');
            currentDetailIndex = idx;
            renderCardDetail(cards[idx]);
        };
        if (idx === 0) li.classList.add('selected');
        listPanel.appendChild(li);
    });
    currentDetailIndex = 0;
    renderCardDetail(cards[0]);
}

// 新增：渲染单词列表和详情
function renderCardDetail(item) {
    const detailPanel = document.getElementById('cardDetailContainer');
    detailPanel.innerHTML = `
        <div class="word-card" style="margin:0 auto;position:relative;min-width:420px;max-width:600px;">
            <div class="card-favorite-btn" onclick="toggleFavorite('${item.word}')" title="收藏">
                <i class="fas fa-star ${item.is_favorite ? 'favorite-active' : 'favorite-inactive'}"></i>
            </div>
            <div style="font-size:1.5em;font-weight:600;margin-bottom:0.5em;display:flex;align-items:center;gap:0.5rem;">
                <span class="word-text" style="color:#fff;">${item.word}</span>
                <button class="btn-speak-word" onclick="speakWord('${item.word}')" title="朗读单词">
                    <i class="fas fa-volume-up"></i>
                </button>
            </div>
            <div style="font-size:1.1em;color:#ffd700;margin-bottom:0.5em;">
                <span class="meaning-text">${item.meaning || ''}</span>
            </div>
            <div style="font-size:1em;color:#fff;opacity:0.9;word-break:break-word;display:flex;align-items:flex-start;gap:0.5rem;">
                <span class="example-text" style="flex:1;">${item.example || ''}</span>
                ${item.example ? `<button class="btn-speak-sentence" onclick="speakSentence('${item.example.replace(/'/g, "\\'")}')" title="朗读例句">
                    <i class="fas fa-volume-up"></i>
                </button>` : ''}
            </div>
            <div style="font-size:1em;color:#ffd700;opacity:0.95;margin-bottom:0.5em;">
                <span class="example-meaning-text">${item.example_meaning || ''}</span>
            </div>
            <div class="card-actions" style="margin-top:1em;display:flex;gap:0.5em;">
                <button class="btn-edit" onclick="editCard('${item.word}')" title="编辑">
                    <i class="fas fa-pen"></i>
                </button>
                <button class="btn-delete" onclick="deleteCard('${item.word}')" title="删除">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
    `;
}

// 更新收藏状态
async function updateFavoriteStatus() {
    try {
        const response = await fetch(`${API_BASE_URL}/get_favorites`);
        if (response.ok) {
            const data = await response.json();
            const favorites = data.favorites || [];
            const favoriteWords = new Set(favorites.map(f => f.word));
            
            // 更新每个单词卡的收藏状态
            document.querySelectorAll('.card-favorite-btn').forEach((btn, index) => {
                const word = allCards[index]?.word;
                if (word && favoriteWords.has(word)) {
                    btn.innerHTML = '<i class="fas fa-star favorite-active"></i>';
                    btn.title = '取消收藏';
                } else {
                    btn.innerHTML = '<i class="fas fa-star favorite-inactive"></i>';
                    btn.title = '收藏';
                }
            });
        }
    } catch (e) {
        console.error('更新收藏状态失败:', e);
    }
}

// 切换收藏状态
async function toggleFavorite(word) {
    const card = allCards.find(c => c.word === word);
    if (!card) return;
    const oldStatus = card.is_favorite;
    card.is_favorite = !oldStatus;
    renderCardDetail(card);
    try {
        const response = await fetch(`${API_BASE_URL}/toggle_favorite`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ word, wordbook_id: card.wordbook_id })
        });
        if (!response.ok) throw new Error('操作失败');
        const data = await response.json();
        if (!data.success) {
            card.is_favorite = oldStatus;
            renderCardDetail(card);
            showNotification(data.error || '操作失败', 'error');
        } else {
            card.is_favorite = data.is_favorite;
            renderCardDetail(card);
            updateFavoritesCount();
        }
    } catch (error) {
        card.is_favorite = oldStatus;
        renderCardDetail(card);
        showNotification('操作失败: ' + error.message, 'error');
    }
}

// 显示新增单词卡模态框
function showAddCardModal() {
    const modal = document.createElement('div');
    modal.className = 'add-modal';
    modal.innerHTML = `
        <div class="add-modal-content">
            <div class="add-modal-header">
                <h3>新增单词卡</h3>
                <button class="btn-close" onclick="closeAddModal()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="add-modal-body">
                <form id="addCardForm">
                    <div class="form-group">
                        <label for="newWord">单词</label>
                        <input type="text" id="newWord" placeholder="输入单词" required>
                    </div>
                    <div class="form-group">
                        <label for="newMeaning">释义</label>
                        <input type="text" id="newMeaning" placeholder="输入释义" required>
                    </div>
                    <div class="form-group">
                        <label for="newExample">例句</label>
                        <input type="text" id="newExample" placeholder="输入例句" required>
                    </div>
                    <div class="form-actions">
                        <button type="button" class="btn-cancel" onclick="closeAddModal()">取消</button>
                        <button type="submit" class="btn-submit">新增</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // 绑定表单提交事件
    document.getElementById('addCardForm').addEventListener('submit', handleAddCard);
}

// 关闭新增模态框
function closeAddModal() {
    const modal = document.querySelector('.add-modal');
    if (modal) {
        modal.remove();
    }
}

// 新增单词卡
async function handleAddCard(e) {
    e.preventDefault();
    
    const word = document.getElementById('newWord').value.trim();
    const meaning = document.getElementById('newMeaning').value.trim();
    const example = document.getElementById('newExample').value.trim();
    
    if (!word || !meaning || !example) {
        showNotification('请填写完整的单词、释义和例句', 'error');
        return;
    }
    
    // 检查单词是否已存在
    if (allCards.some(card => card.word.toLowerCase() === word.toLowerCase())) {
        showNotification('该单词已存在', 'warning');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/add_card`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ word, meaning, example })
        });
        
        if (!response.ok) throw new Error('添加失败');
        
        const data = await response.json();
        if (data.success) {
            // 关闭模态框
            closeAddModal();
            // 重新加载单词卡
            await loadAllWordCards();
            showNotification('单词卡添加成功', 'success');
        } else {
            throw new Error(data.error || '添加失败');
        }
    } catch (error) {
        showNotification('添加失败: ' + error.message, 'error');
    }
}

// 编辑单词卡
function editCard(word) {
    // 在 allCards 里查找该单词
    const card = allCards.find(c => c.word === word);
    if (!card) return;
    // 获取详情面板
    const detailPanel = document.getElementById('cardDetailContainer');
    // 切换到编辑模式
    detailPanel.innerHTML = `
        <div class="word-card" style="margin:0 auto;">
            <div class="card-favorite-btn" onclick="toggleFavorite('${card.word}')" title="收藏">
                <i class="fas fa-star favorite-inactive"></i>
            </div>
            <div style="font-size:1.5em;font-weight:600;margin-bottom:0.5em;display:flex;align-items:center;gap:0.5rem;">
                <input type="text" class="edit-input" id="editWord" value="${card.word}" style="background:rgba(255,255,255,0.2);border:none;color:#fff;padding:0.2em;border-radius:4px;width:100%;">
            </div>
            <div style="font-size:1.1em;color:#ffd700;margin-bottom:0.5em;">
                <input type="text" class="edit-input" id="editMeaning" value="${card.meaning}" style="background:rgba(255,255,255,0.2);border:none;color:#ffd700;padding:0.2em;border-radius:4px;width:100%;">
            </div>
            <div style="font-size:1em;color:#fff;opacity:0.9;word-break:break-word;display:flex;align-items:flex-start;gap:0.5rem;">
                <input type="text" class="edit-input" id="editExample" value="${card.example}" style="background:rgba(255,255,255,0.2);border:none;color:#fff;padding:0.2em;border-radius:4px;width:100%;">
            </div>
            <div class="card-actions" style="margin-top:1em;display:flex;gap:0.5em;">
                <button class="btn-save" onclick="saveCard('${card.word}')" title="保存">
                    <i class="fas fa-save"></i>
                </button>
                <button class="btn-cancel" onclick="cancelEdit('${card.word}')" title="取消">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        </div>
    `;
}

// 保存编辑
async function saveCard(oldWord) {
    const newWord = document.getElementById('editWord').value.trim();
    const newMeaning = document.getElementById('editMeaning').value.trim();
    const newExample = document.getElementById('editExample').value.trim();
    if (!newWord || !newMeaning || !newExample) {
        showNotification('请填写完整的单词、释义和例句', 'error');
        return;
    }
    // 检查单词是否重复（排除自己）
    if (allCards.some(card => card.word.toLowerCase() === newWord.toLowerCase() && card.word !== oldWord)) {
        showNotification('该单词已存在', 'warning');
        return;
    }
    // 找到原始索引
    const index = allCards.findIndex(card => card.word === oldWord);
    if (index === -1) {
        showNotification('未找到原始单词', 'error');
        return;
    }
    try {
        const response = await fetch(`${API_BASE_URL}/update_card`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                index,
                word: newWord,
                meaning: newMeaning,
                example: newExample
            })
        });
        if (!response.ok) throw new Error('更新失败');
        const data = await response.json();
        if (data.success) {
            await loadAllWordCards();
            showNotification('单词卡更新成功', 'success');
        } else {
            throw new Error(data.error || '更新失败');
        }
    } catch (error) {
        showNotification('更新失败: ' + error.message, 'error');
    }
}

// 取消编辑
function cancelEdit(word) {
    // 重新渲染该单词详情
    const card = allCards.find(c => c.word === word);
    if (card) renderCardDetail(card);
}

// 删除单词卡
async function deleteCard(word) {
    if (!confirm('确定要删除这个单词卡吗？删除后可在回收站中恢复。')) {
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/soft_delete_card`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ word })
        });
        
        if (!response.ok) throw new Error('删除失败');
        
        const data = await response.json();
        if (data.success) {
            await loadAllWordCards();
            showNotification('单词卡已移至回收站', 'success');
        } else {
            throw new Error(data.error || '删除失败');
        }
    } catch (error) {
        showNotification('删除失败: ' + error.message, 'error');
    }
}

// 显示通知
function showNotification(message, type = 'info') {
    // 创建通知元素
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 1rem 1.5rem;
        border-radius: 8px;
        color: white;
        font-weight: 500;
        z-index: 1000;
        animation: slideIn 0.3s ease;
        max-width: 300px;
    `;
    
    // 根据类型设置背景色
    switch (type) {
        case 'success':
            notification.style.background = '#4ade80';
            break;
        case 'error':
            notification.style.background = '#f87171';
            break;
        case 'warning':
            notification.style.background = '#fbbf24';
            break;
        default:
            notification.style.background = '#3b82f6';
    }
    
    document.body.appendChild(notification);
    
    // 3秒后自动移除
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 3000);
}

// 添加CSS动画
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
`;
document.head.appendChild(style);

// 语音控制功能
function toggleSpeechControl() {
    const btn = document.getElementById('speechControlBtn');
    if (speechEnabled) {
        stopSpeaking();
        speechEnabled = false;
        btn.innerHTML = '<i class="fas fa-microphone-slash"></i>';
        btn.title = '启用语音';
        btn.style.background = 'rgba(239, 68, 68, 0.3)';
        btn.style.borderColor = '#ef4444';
        showNotification('语音功能已关闭', 'info');
    } else {
        speechEnabled = true;
        btn.innerHTML = '<i class="fas fa-microphone"></i>';
        btn.title = '语音控制';
        btn.style.background = 'rgba(255, 255, 255, 0.1)';
        btn.style.borderColor = 'rgba(255, 255, 255, 0.3)';
        showNotification('语音功能已启用', 'success');
    }
}

// 修改朗读函数，添加语音开关检查
function speakWord(word, lang = 'en-US') {
    if (!speechEnabled) {
        showNotification('请先启用语音功能', 'warning');
        return;
    }
    const btnEl = event?.target?.closest('.btn-speak-word');
    // 如果当前按钮正在朗读，则点击时停止并还原图标
    if(btnEl && btnEl.classList.contains('speaking')){
        stopSpeaking();
        btnEl.classList.remove('speaking');
        btnEl.innerHTML = '<i class="fas fa-volume-up"></i>';
        btnEl.title = '朗读单词';
        return;
    }
    if (currentUtterance) {
        speechSynthesis.cancel(); // 停止其他朗读
    }
    
    currentUtterance = new SpeechSynthesisUtterance(word);
    currentUtterance.lang = lang;
    currentUtterance.rate = speechSettings.rate;
    currentUtterance.pitch = speechSettings.pitch;
    currentUtterance.volume = speechSettings.volume;
    
    // 选择英语女声（如果可用）
    const voices = speechSynthesis.getVoices();
    const englishVoice = voices.find(voice => 
        voice.lang.includes('en') && voice.name.includes('Female')
    ) || voices.find(voice => voice.lang.includes('en')) || voices[0];
    
    if (englishVoice) {
        currentUtterance.voice = englishVoice;
    }
    
    // 添加朗读状态指示
    const button = event.target.closest('.btn-speak-word');
    if (button) {
        button.classList.add('speaking');
        button.innerHTML = '<i class="fas fa-volume-mute"></i>';
        button.title = '停止朗读';
        
        // 朗读结束后的回调
        currentUtterance.onend = function() {
            button.classList.remove('speaking');
            button.innerHTML = '<i class="fas fa-volume-up"></i>';
            button.title = '朗读单词';
        };
        
        currentUtterance.onerror = function(e) {
            button.classList.remove('speaking');
            button.innerHTML = '<i class="fas fa-volume-up"></i>';
            button.title = '朗读单词';
            // 如果错误是用户取消/打断，不提示
            if(e.error!=='canceled' && e.error!=='interrupted'){
                showNotification('语音朗读失败', 'error');
            }
        };
    }
    
    speechSynthesis.speak(currentUtterance);
}

// 修改朗读例句函数，添加语音开关检查
function speakSentence(sentence, lang = 'en-US') {
    if (!speechEnabled) {
        showNotification('请先启用语音功能', 'warning');
        return;
    }
    const btnEl = event?.target?.closest('.btn-speak-sentence');
    if(btnEl && btnEl.classList.contains('speaking')){
        stopSpeaking();
        btnEl.classList.remove('speaking');
        btnEl.innerHTML = '<i class="fas fa-volume-up"></i>';
        btnEl.title = '朗读例句';
        return;
    }
    if (currentUtterance) {
        speechSynthesis.cancel(); // 停止当前朗读
    }
    
    currentUtterance = new SpeechSynthesisUtterance(sentence);
    currentUtterance.lang = lang;
    currentUtterance.rate = speechSettings.rate + 0.1; // 例句语速稍快
    currentUtterance.pitch = speechSettings.pitch;
    currentUtterance.volume = speechSettings.volume;
    
    // 选择英语女声（如果可用）
    const voices = speechSynthesis.getVoices();
    const englishVoice = voices.find(voice => 
        voice.lang.includes('en') && voice.name.includes('Female')
    ) || voices.find(voice => voice.lang.includes('en')) || voices[0];
    
    if (englishVoice) {
        currentUtterance.voice = englishVoice;
    }
    
    // 添加朗读状态指示
    const button = event.target.closest('.btn-speak-sentence');
    if (button) {
        button.classList.add('speaking');
        button.innerHTML = '<i class="fas fa-volume-mute"></i>';
        button.title = '停止朗读';
        
        // 朗读结束后的回调
        currentUtterance.onend = function() {
            button.classList.remove('speaking');
            button.innerHTML = '<i class="fas fa-volume-up"></i>';
            button.title = '朗读例句';
        };
        
        currentUtterance.onerror = function(e) {
            button.classList.remove('speaking');
            button.innerHTML = '<i class="fas fa-volume-up"></i>';
            button.title = '朗读例句';
            if(e.error!=='canceled' && e.error!=='interrupted'){
                showNotification('语音朗读失败', 'error');
            }
        };
    }
    
    speechSynthesis.speak(currentUtterance);
}

// 停止朗读
function stopSpeaking() {
    if (speechSynthesis) {
        speechSynthesis.cancel();
        currentUtterance = null;
    }
} 

// === 循环朗读功能（支持暂停/继续，自动高亮跳转） ===
let isLoopSpeaking = false;
let loopSpeakPaused = false;
let loopSpeakIndex = 0;
let loopSpeakStage = 'word'; // 'word' 或 'example'
let loopSpeakCards = [];

const loopSpeakBtn = document.getElementById('loopSpeakBtn');
if(loopSpeakBtn){
    loopSpeakBtn.addEventListener('click', async ()=>{
        if(isLoopSpeaking){
            // 暂停/继续
            if(!loopSpeakPaused){
                loopSpeakPaused = true;
                if(speechSynthesis.speaking){
                    speechSynthesis.cancel();
                }
                loopSpeakBtn.textContent = '继续朗读';
            }else{
                loopSpeakPaused = false;
                loopSpeakBtn.textContent = '暂停朗读';
                await continueLoopSpeak();
            }
            return;
        }
        if(!speechEnabled){
            showNotification('请先启用语音功能', 'warning');
            return;
        }
        loopSpeakCards = allCards;
        if(!loopSpeakCards || !loopSpeakCards.length){
            showNotification('没有可朗读的单词', 'error');
            return;
        }
        isLoopSpeaking = true;
        loopSpeakPaused = false;
        loopSpeakIndex = 0;
        loopSpeakStage = 'word';
        loopSpeakBtn.textContent = '暂停朗读';
        for(; loopSpeakIndex<loopSpeakCards.length; ){
            if(loopSpeakPaused) break;
            selectWordCard(loopSpeakIndex);
            if(loopSpeakStage==='word'){
                await speakWordPromise(loopSpeakCards[loopSpeakIndex].word);
                if(loopSpeakPaused) break;
                loopSpeakStage = 'example';
            }
            if(loopSpeakStage==='example' && loopSpeakCards[loopSpeakIndex].example){
                await speakSentencePromise(loopSpeakCards[loopSpeakIndex].example);
                if(loopSpeakPaused) break;
            }
            loopSpeakIndex++;
            loopSpeakStage = 'word';
        }
        isLoopSpeaking = false;
        loopSpeakPaused = false;
        loopSpeakBtn.textContent = '循环朗读';
    });
}

async function continueLoopSpeak(){
    for(; loopSpeakIndex<loopSpeakCards.length; ){
        if(loopSpeakPaused) break;
        selectWordCard(loopSpeakIndex);
        if(loopSpeakStage==='word'){
            await speakWordPromise(loopSpeakCards[loopSpeakIndex].word);
            if(loopSpeakPaused) break;
            loopSpeakStage = 'example';
        }
        if(loopSpeakStage==='example' && loopSpeakCards[loopSpeakIndex].example){
            await speakSentencePromise(loopSpeakCards[loopSpeakIndex].example);
            if(loopSpeakPaused) break;
        }
        loopSpeakIndex++;
        loopSpeakStage = 'word';
    }
    isLoopSpeaking = false;
    loopSpeakPaused = false;
    loopSpeakBtn.textContent = '循环朗读';
}

function selectWordCard(idx){
    // 高亮左侧列表并渲染详情
    const listPanel = document.getElementById('wordList');
    if(listPanel){
        const lis = listPanel.querySelectorAll('li');
        lis.forEach(e=>e.classList.remove('selected'));
        if(lis[idx]){
            lis[idx].classList.add('selected');
            currentDetailIndex = idx;
        }
    }
    renderCardDetail(allCards[idx]);
}

function speakWordPromise(word){
    return new Promise((resolve)=>{
        if(currentUtterance) speechSynthesis.cancel();
        currentUtterance = new SpeechSynthesisUtterance(word);
        currentUtterance.lang = 'en-US';
        currentUtterance.rate = speechSettings.rate;
        currentUtterance.pitch = speechSettings.pitch;
        currentUtterance.volume = speechSettings.volume;
        const voices = speechSynthesis.getVoices();
        const englishVoice = voices.find(voice => voice.lang.includes('en') && voice.name.includes('Female')) || voices.find(voice => voice.lang.includes('en')) || voices[0];
        if(englishVoice) currentUtterance.voice = englishVoice;
        currentUtterance.onend = ()=>resolve();
        currentUtterance.onerror = ()=>resolve();
        speechSynthesis.speak(currentUtterance);
    });
}
function speakSentencePromise(sentence){
    return new Promise((resolve)=>{
        if(currentUtterance) speechSynthesis.cancel();
        currentUtterance = new SpeechSynthesisUtterance(sentence);
        currentUtterance.lang = 'en-US';
        currentUtterance.rate = speechSettings.rate+0.1;
        currentUtterance.pitch = speechSettings.pitch;
        currentUtterance.volume = speechSettings.volume;
        const voices = speechSynthesis.getVoices();
        const englishVoice = voices.find(voice => voice.lang.includes('en') && voice.name.includes('Female')) || voices.find(voice => voice.lang.includes('en')) || voices[0];
        if(englishVoice) currentUtterance.voice = englishVoice;
        currentUtterance.onend = ()=>resolve();
        currentUtterance.onerror = ()=>resolve();
        speechSynthesis.speak(currentUtterance);
    });
} 