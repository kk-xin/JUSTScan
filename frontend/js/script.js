// DOM 元素
const uploadArea = document.getElementById('uploadArea');
const fileInput = document.getElementById('fileInput');
const fileList = document.getElementById('fileList');
const cardsList = document.getElementById('cardsList');
const startUploadBtn = document.getElementById('startUploadBtn');
const exportBtn = document.getElementById('exportBtn');

// 文件和单词卡数据
let uploadedImages = [];
let wordCards = [];
let wordDetails = {};
let ocrWords = [];

// 后端API配置
const API_BASE_URL = 'http://localhost:5050';

// 初始化
document.addEventListener('DOMContentLoaded', function() {
    initializeEventListeners();
    initializeNavigation();
    addScrollAnimations();
    checkBackendHealth();
    renderMainCard(); // 页面加载时只渲染主卡片
    loadWordbooks();
});

function initializeEventListeners() {
    // 上传按钮
    startUploadBtn.addEventListener('click', () => fileInput.click());
    // 导出按钮
    exportBtn.addEventListener('click', exportWordCards);
    // 上传区域点击
    uploadArea.addEventListener('click', () => fileInput.click());
    // 文件选择
    fileInput.addEventListener('change', handleFileSelect);
    // 拖拽
    uploadArea.addEventListener('dragover', handleDragOver);
    uploadArea.addEventListener('dragleave', handleDragLeave);
    uploadArea.addEventListener('drop', handleDrop);
}

// 检查后端服务状态
async function checkBackendHealth() {
    try {
        const response = await fetch(`${API_BASE_URL}/health`);
        const data = await response.json();
        if (data.status === 'ok') {
            showNotification('后端服务连接正常', 'success');
        }
    } catch (error) {
        showNotification('后端服务连接失败，请确保后端已启动', 'error');
        console.error('后端连接错误:', error);
    }
}

function initializeNavigation() {
    const navLinks = document.querySelectorAll('.nav-link');
    const sections = document.querySelectorAll('section[id]');
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = link.getAttribute('href').substring(1);
            const targetSection = document.getElementById(targetId);
            if (targetSection) {
                targetSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
    });
    window.addEventListener('scroll', () => {
        let current = '';
        sections.forEach(section => {
            const sectionTop = section.offsetTop;
            if (pageYOffset >= sectionTop - 200) {
                current = section.getAttribute('id');
            }
        });
        navLinks.forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('href') === `#${current}`) {
                link.classList.add('active');
            }
        });
    });
}

// 拖拽交互
function handleDragOver(event) {
    event.preventDefault();
    uploadArea.style.borderColor = '#ffd700';
    uploadArea.style.background = 'rgba(255, 215, 0, 0.1)';
}
function handleDragLeave(event) {
    event.preventDefault();
    uploadArea.style.borderColor = 'rgba(255, 255, 255, 0.3)';
    uploadArea.style.background = 'transparent';
}
function handleDrop(event) {
    event.preventDefault();
    uploadArea.style.borderColor = 'rgba(255, 255, 255, 0.3)';
    uploadArea.style.background = 'transparent';
    const files = Array.from(event.dataTransfer.files);
    const imageFiles = files.filter(file => file.type.startsWith('image/'));
    if (imageFiles.length > 0) {
        addImages(imageFiles);
    } else {
        showNotification('请上传图片文件', 'error');
    }
}

// 文件选择
function handleFileSelect(event) {
    const files = Array.from(event.target.files);
    addImages(files);
}

// 添加图片
function addImages(files) {
    files.forEach(file => {
        if (file.type.startsWith('image/')) {
            if (!uploadedImages.some(img => img.name === file.name)) {
                uploadedImages.push(file);
                displayImage(file);
                showNotification(`图片 "${file.name}" 已添加`, 'success');
                // 调用后端API识别单词
                recognizeWordsFromImage(file);
            } else {
                showNotification(`图片 "${file.name}" 已存在`, 'warning');
            }
        }
    });
}

// 显示图片缩略图
function displayImage(file) {
    const reader = new FileReader();
    reader.onload = function(e) {
        const fileItem = document.createElement('div');
        fileItem.className = 'file-item';
        fileItem.innerHTML = `
            <img src="${e.target.result}" alt="图片预览">
            <span>${file.name}</span>
            <div class="file-status">
                <span class="status-text">处理中...</span>
                <div class="loading-spinner"></div>
            </div>
            <button class="btn-remove" title="移除" onclick="removeImage('${file.name}')">
                <i class="fas fa-times"></i>
            </button>
        `;
        fileList.appendChild(fileItem);
    };
    reader.readAsDataURL(file);
}

// 移除图片
window.removeImage = function(fileName) {
    uploadedImages = uploadedImages.filter(file => file.name !== fileName);
    updateImageList();
    showNotification(`图片 "${fileName}" 已移除`, 'info');
}
function updateImageList() {
    fileList.innerHTML = '';
    uploadedImages.forEach(file => displayImage(file));
}

// 调用后端API识别图片中的单词
async function recognizeWordsFromImage(file) {
    try {
        const formData = new FormData();
        formData.append('files', file);
        
        showNotification(`正在识别图片 "${file.name}" 中的单词...`, 'info');
        
        const response = await fetch(`${API_BASE_URL}/upload`, {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success) {
            // 更新文件状态
            updateFileStatus(file.name, 'success', `识别出 ${data.count} 个单词`);
            
            // 添加识别到的单词到单词卡
            data.words.forEach(word => addWordCard(word));
            
            showNotification(`图片 "${file.name}" 识别完成，生成 ${data.count} 个单词卡`, 'success');
        } else {
            updateFileStatus(file.name, 'error', '识别失败');
            showNotification(`图片 "${file.name}" 识别失败: ${data.error}`, 'error');
        }
        
    } catch (error) {
        console.error('识别错误:', error);
        updateFileStatus(file.name, 'error', '网络错误');
        showNotification(`图片 "${file.name}" 识别失败: ${error.message}`, 'error');
    }
}

// 更新文件状态显示
function updateFileStatus(fileName, status, message) {
    const fileItems = document.querySelectorAll('.file-item');
    fileItems.forEach(item => {
        const nameSpan = item.querySelector('span');
        if (nameSpan && nameSpan.textContent === fileName) {
            const statusDiv = item.querySelector('.file-status');
            if (statusDiv) {
                statusDiv.innerHTML = `
                    <span class="status-text ${status}">${message}</span>
                    ${status === 'success' ? '<i class="fas fa-check"></i>' : 
                      status === 'error' ? '<i class="fas fa-times"></i>' : ''}
                `;
            }
        }
    });
}

// 修改addWordCard，识别后自动批量查词义
function addWordCard(word) {
    if (!wordCards.includes(word)) {
        wordCards.push(word);
        // fetchWordDetails(wordCards); // 注释掉自动查词义
    }
    if (!ocrWords.includes(word)) {
        ocrWords.push(word);
    }
}

// 修改渲染，展示释义和例句
function renderWordCards() {
    cardsList.innerHTML = '';
    wordCards.forEach((word, idx) => {
        const info = wordDetails[word] || { meaning: '', example: '' };
        const card = document.createElement('div');
        card.className = 'word-card';
        card.innerHTML = `
            <span class="word-text" contenteditable="false">${word}</span>
            <div style="font-size:0.9em;margin:0.5em 0 0.2em 0;color:#ffd700;">${info.meaning || ''}</div>
            <div style="font-size:0.85em;color:#fff;opacity:0.8;">${info.example || ''}</div>
            <div>
                <button class="btn-edit" title="编辑" onclick="editWordCard(${idx})"><i class="fas fa-pen"></i></button>
                <button class="btn-delete" title="删除" onclick="deleteWordCard(${idx})"><i class="fas fa-trash"></i></button>
            </div>
        `;
        cardsList.appendChild(card);
    });
}
window.editWordCard = function(idx) {
    const card = cardsList.children[idx];
    const span = card.querySelector('.word-text');
    if (span.isContentEditable) {
        span.contentEditable = 'false';
        wordCards[idx] = span.innerText.trim();
        showNotification('单词已更新', 'success');
    } else {
        span.contentEditable = 'true';
        span.focus();
    }
};
window.deleteWordCard = function(idx) {
    wordCards.splice(idx, 1);
    renderWordCards();
    showNotification('单词卡已删除', 'info');
};

// 导出单词卡为CSV
async function exportWordCards() {
    if (wordCards.length === 0) {
        showNotification('没有单词卡可导出', 'warning');
        return;
    }
    
    try {
        showNotification('正在生成CSV文件...', 'info');
        
        const response = await fetch(`${API_BASE_URL}/download`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        // 创建下载链接
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'words.csv';
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        showNotification('CSV文件下载成功', 'success');
        
    } catch (error) {
        console.error('导出错误:', error);
        showNotification(`导出失败: ${error.message}`, 'error');
    }
}

// 通知
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <i class="fas fa-${getNotificationIcon(type)}"></i>
        <span>${message}</span>
    `;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${getNotificationColor(type)};
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 10px;
        box-shadow: 0 5px 15px rgba(0,0,0,0.2);
        z-index: 1000;
        display: flex;
        align-items: center;
        gap: 0.5rem;
        transform: translateX(100%);
        transition: transform 0.3s ease;
    `;
    document.body.appendChild(notification);
    setTimeout(() => {
        notification.style.transform = 'translateX(0)';
    }, 100);
    setTimeout(() => {
        notification.style.transform = 'translateX(100%)';
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 300);
    }, 3000);
}
function getNotificationIcon(type) {
    const icons = {
        success: 'check-circle',
        error: 'exclamation-circle',
        warning: 'exclamation-triangle',
        info: 'info-circle'
    };
    return icons[type] || 'info-circle';
}
function getNotificationColor(type) {
    const colors = {
        success: '#28a745',
        error: '#dc3545',
        warning: '#ffc107',
        info: '#17a2b8'
    };
    return colors[type] || '#17a2b8';
}

// 动画
function addScrollAnimations() {
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            }
        });
    }, observerOptions);
    const animatedElements = document.querySelectorAll('.cards-container, .upload-container');
    animatedElements.forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(30px)';
        el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(el);
    });
}

// 添加键盘快捷键
document.addEventListener('keydown', (event) => {
    // Ctrl/Cmd + U 打开文件选择
    if ((event.ctrlKey || event.metaKey) && event.key === 'u') {
        event.preventDefault();
        fileInput.click();
    }
    
    // Ctrl/Cmd + Enter 开始处理
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
        event.preventDefault();
        handleProcess();
    }
});

// 添加文件类型验证
function validateAudioFile(file) {
    const validTypes = [
        'audio/mpeg',
        'audio/wav',
        'audio/ogg',
        'audio/mp4',
        'audio/aac',
        'audio/flac'
    ];
    
    return validTypes.includes(file.type);
}

// 添加文件大小限制
function validateFileSize(file, maxSize = 100 * 1024 * 1024) { // 100MB
    return file.size <= maxSize;
}

// 修改 useOcrWordsForGemini 直接调用后端生成单词卡
function useOcrWordsForGemini() {
    if (ocrWords.length === 0) {
        showNotification('没有识别到单词', 'warning');
        return;
    }
    const uniqueWordsArray = ocrWords; // 已去重
    const wordbookId = getCurrentWordbookId();
    if (!wordbookId) {
        showNotification('请先选择单词本', 'warning');
        return;
    }
    showNotification('正在生成单词卡，请稍候...', 'info');
    fetch(`${API_BASE_URL}/generate_cards`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ unique_words: uniqueWordsArray, wordbook_id: wordbookId })
    })
    .then(resp => resp.json())
    .then(data => {
        if (data.success) {
            showNotification('单词卡生成成功', 'success');
        } else {
            throw new Error(data.error || '生成失败');
        }
    })
    .catch(err => {
        showNotification('生成单词卡失败: ' + err.message, 'error');
    });
}

function renderMainCard(wordbooks = []){
    cardsList.innerHTML='';
    if(wordbooks.length===0){
        cardsList.innerHTML='<div style="color:#fff;opacity:0.7;text-align:center;margin-top:3em;">暂无单词本</div>';return;}
    if(!manageMode){
        wordbooks.forEach(wb=>{
            const card=document.createElement('div');
            card.className='word-card word-main-card';
            card.style.cursor='pointer';
            card.innerHTML=`<div style="font-size:1.5em;font-weight:700;margin-bottom:0.5em;">${wb.name}</div>
            <div style="font-size:1.1em;color:#ffd700;">点击查看该单词本的单词卡</div>`;
            card.onclick=()=>{window.location.href=`cards?wordbook_id=${wb.id}`};
            cardsList.appendChild(card);
        });
    }else{
        wordbooks.forEach(wb=>{
            const card=document.createElement('div');
            card.className='word-card';
            card.style.position='relative';
            card.style.minHeight='180px';
            card.innerHTML=`<button class="manage-del-btn" onclick="deleteWordbook(${wb.id},event)" style="position:absolute;top:-10px;right:-10px;background:#ef4444;border:none;border-radius:50%;width:22px;height:22px;color:#fff;font-weight:700;font-size:0.7em;line-height:20px;">—</button>
                <div style="font-size:1.5em;font-weight:700;margin-bottom:0.5em;color:#fff;text-align:left;">${wb.name}</div>
                <div style="font-size:1.1em;color:#ffd700;text-align:left;">点击查看该单词本的单词卡</div>`;
            cardsList.appendChild(card);
        });
        // plus card
        const plus=document.createElement('div');
        plus.className='word-card';
        plus.style.cssText='display:flex;align-items:center;justify-content:center;border:2px dashed rgba(255,255,255,0.4);cursor:pointer;color:#fff;font-size:2em;';
        plus.innerHTML='<i class="fas fa-plus"></i>';
        plus.onclick=()=>addWordbookBtn.click();
        cardsList.appendChild(plus);
    }
}

async function loadFullWordCards() {
    try {
        const resp = await fetch('http://localhost:5050/get_full_csv');
        if (!resp.ok) throw new Error('无法获取words_full.csv');
        const csvText = await resp.text();
        const lines = csvText.split(/\r?\n/).map(l => l.trim()).filter(l => l);
        if (lines.length <= 1) return;
        const cards = [];
        for (let i = 1; i < lines.length; i++) {
            const arr = lines[i].split(',');
            if (arr.length < 3) continue;
            const [word, meaning, example] = arr;
            cards.push({ word, meaning, example });
        }
        renderFullWordCards(cards);
    } catch (e) {
        showNotification('读取words_full.csv失败: ' + e.message, 'error');
    }
}

function renderFullWordCards(cards) {
    cardsList.innerHTML = '';
    const backBtn = document.createElement('button');
    backBtn.className = 'btn-process';
    backBtn.innerText = '返回主卡片';
    backBtn.style.marginBottom = '1.5em';
    backBtn.onclick = () => renderMainCard();
    cardsList.appendChild(backBtn);
    cards.forEach((item, idx) => {
        const card = document.createElement('div');
        card.className = 'word-card';
        card.innerHTML = `
            <div style="font-size:1.5em;font-weight:600;margin-bottom:0.5em;">
                <span class="word-text" style="color:#fff;">${item.word}</span>
            </div>
            <div style="font-size:1.1em;color:#ffd700;margin-bottom:0.5em;">
                ${item.meaning || ''}
            </div>
            <div style="font-size:1em;color:#fff;opacity:0.9;word-break:break-word;">
                ${item.example || ''}
            </div>
        `;
        cardsList.appendChild(card);
    });
}

// 页面加载时获取单词本列表
async function loadWordbooks() {
    const resp = await fetch('/get_wordbooks');
    const data = await resp.json();
    renderWordbookSelect(data.wordbooks || []);
    renderMainCard(data.wordbooks || []);
}

function renderWordbookSelect(wordbooks) {
    const select = document.getElementById('wordbookSelect');
    select.innerHTML = '';
    if (wordbooks.length === 0) {
        const option = document.createElement('option');
        option.value = '';
        option.textContent = '暂无单词本，请新建';
        select.appendChild(option);
    } else {
        wordbooks.forEach(wb => {
            const option = document.createElement('option');
            option.value = wb.id;
            option.textContent = wb.name;
            select.appendChild(option);
        });
    }
}

// 新建单词本
const addWordbookBtn = document.getElementById('addWordbookBtn');
if (addWordbookBtn) {
    addWordbookBtn.addEventListener('click', async () => {
        const name = prompt('请输入新单词本名称：');
        if (!name) return;
        const resp = await fetch('/add_wordbook', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name })
        });
        const data = await resp.json();
        if (data.success) {
            showNotification('新建单词本成功', 'success');
            await loadWordbooks();
            document.getElementById('wordbookSelect').value = data.id;
        } else {
            showNotification('新建失败: ' + (data.error || '未知错误'), 'error');
        }
    });
}

// 获取当前选中的单词本ID
function getCurrentWordbookId() {
    return document.getElementById('wordbookSelect').value;
}

function getUniqueWords() {
    // ocrWords 已经是去重的识别结果
    return ocrWords;
} 

// (删除单词本功能已撤回)

// === 回收站（单词本） ===
async function updateWbTrashCount(){
    try{
        const resp = await fetch('/get_deleted_wordbooks');
        const data = await resp.json();
        const count = (data.wordbooks||[]).length;
        const span = document.getElementById('wbTrashCount');
        if(span) span.textContent = count;
    }catch(e){console.error('trash count err',e);}
}

function attachTrashBtn(){
    const btn=document.getElementById('wbTrashBtn');
    if(!btn) return;
    btn.addEventListener('click', showWbTrash);
}

document.addEventListener('DOMContentLoaded', ()=>{
    updateWbTrashCount();
    attachTrashBtn();
});

async function showWbTrash(){
    const resp = await fetch('/get_deleted_wordbooks');
    const data = await resp.json();
    const wbs = data.wordbooks||[];
    const modal=document.createElement('div');
    modal.className='trash-modal';
    modal.innerHTML=`<div class="trash-modal-content" style="max-width:420px;background:rgba(0,0,0,0.7);padding:1.5em;border-radius:1em;">
        <h3 style="color:#fff;margin-bottom:1em;">回收站</h3>
        ${wbs.length===0?'<div style="color:#fff;opacity:.7;">回收站为空</div>':wbs.map(w=>`<div style=\"display:flex;justify-content:space-between;align-items:center;margin:0.5em 0;color:#fff;\"><span>${w.name}</span><button onclick=\"restoreWb(${w.id})\" style=\"background:#4ade80;border:none;color:#fff;padding:0.2em 0.6em;border-radius:4px;\">恢复</button></div>`).join('')}
        <button style="margin-top:1em;background:#ef4444;border:none;color:#fff;padding:0.3em 1em;border-radius:6px;" onclick="this.closest('.trash-modal').remove()">关闭</button>
    </div>`;
    modal.style.cssText='position:fixed;top:0;left:0;width:100%;height:100%;display:flex;justify-content:center;align-items:center;z-index:1000;';
    document.body.appendChild(modal);
}

window.restoreWb = async function(id){
    await fetch('/restore_wordbook',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id})});
    await loadWordbooks();
    updateWbTrashCount();
    showNotification('已恢复单词本','success');
    document.querySelectorAll('.trash-modal').forEach(m=>m.remove());
    showWbTrash();
}

// 在 loadWordbooks 结束处追加计数刷新
const _origLoadWB = loadWordbooks;
loadWordbooks = async function(){
    await _origLoadWB.apply(this, arguments);
    updateWbTrashCount();
} 

// === Manage Mode ===
let manageMode = false;
function attachSettingsBtn(){
  const btn=document.getElementById('wbSettingsBtn');
  if(!btn) return;
  btn.addEventListener('click',()=>{
      manageMode=!manageMode;
      btn.style.background = manageMode? 'rgba(59,130,246,0.6)' : 'rgba(255,255,255,0.1)';
      loadWordbooks();
  });
}

document.addEventListener('DOMContentLoaded', attachSettingsBtn); 

// deleteWordbook handler (for manage mode)
window.deleteWordbook = async function(id,e){
  e.stopPropagation();
  if(!confirm('确定删除该单词本?')) return;
  try{
     await fetch('/soft_delete_wordbook',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id})});
     await loadWordbooks();
     updateWbTrashCount();
     showNotification('已删除到回收站','success');
  }catch(err){showNotification('删除失败','error');}
}; 