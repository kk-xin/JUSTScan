// 全局变量
let allFavorites = [];
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

document.addEventListener('DOMContentLoaded', function() {
    loadFavorites();
    document.getElementById('backBtn').addEventListener('click', () => {
        window.location.href = 'cards';
    });
    initializeEventListeners();
    initializeSpeech();
});

function initializeEventListeners() {
    // 返回按钮
    document.getElementById('backBtn').addEventListener('click', () => {
        window.location.href = 'cards';
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

// 加载所有数据
async function loadAllData() {
    await Promise.all([
        loadAllWordCards(),
        loadFavorites()
    ]);
    renderFavorites();
}

// 加载所有单词卡
async function loadAllWordCards() {
    try {
        const resp = await fetch(`${API_BASE_URL}/get_full_csv`);
        if (!resp.ok) throw new Error('无法获取words_full.csv');
        const csvText = await resp.text();
        const lines = csvText.split(/\r?\n/).map(l => l.trim()).filter(l => l);
        if (lines.length <= 1) {
            allCards = [];
            return;
        }
        
        allCards = [];
        for (let i = 1; i < lines.length; i++) {
            const arr = lines[i].split(',');
            if (arr.length < 3) continue;
            const [word, meaning, example, modify_time] = arr;
            allCards.push({ word, meaning, example, modify_time: modify_time || '' });
        }
    } catch (e) {
        console.error('加载单词卡失败:', e);
    }
}

// 加载收藏列表
async function loadFavorites() {
    try {
        const resp = await fetch('http://localhost:5050/get_words');
        const data = await resp.json();
        if (!data.success) throw new Error(data.error || '获取收藏失败');
        const favorites = (data.data || []).filter(card => card.is_favorite);
        renderFavorites(favorites);
    } catch (e) {
        document.getElementById('favoritesList').innerHTML = '<div style="color:#f87171;">加载收藏失败: ' + e.message + '</div>';
    }
}

// 渲染收藏的单词卡
function renderFavorites(cards) {
    const list = document.getElementById('favoritesList');
    list.innerHTML = '';
    if (!cards.length) {
        list.innerHTML = '<div style="color:#fff;opacity:0.7;text-align:center;margin-top:3em;">暂无收藏</div>';
        return;
    }
    // 网格排列：每行最多 3 个
    list.style.display = 'flex';
    list.style.flexWrap = 'wrap';
    list.style.gap = '2em';
    list.style.justifyContent = 'flex-start';
    cards.forEach(item => {
        const cardDiv = document.createElement('div');
        cardDiv.className = 'word-card';
        cardDiv.style = 'flex:0 0 calc((100% - 4em) / 3); max-width:420px; position:relative;';
        cardDiv.innerHTML = `
            <div class="card-favorite-btn" style="position:absolute;top:1em;right:1em;">
                <i class="fas fa-star favorite-active"></i>
            </div>
            <div style="font-size:1.5em;font-weight:600;margin-bottom:0.5em;color:#fff;">${item.word}</div>
            <div style="font-size:1.1em;color:#ffd700;margin-bottom:0.5em;">${item.meaning || ''}</div>
            <div style="font-size:1em;color:#fff;opacity:0.9;word-break:break-word;margin-bottom:0.5em;">${item.example || ''}</div>
            <div style="font-size:1em;color:#ffd700;opacity:0.95;margin-bottom:0.5em;">${item.example_meaning || ''}</div>
        `;
        list.appendChild(cardDiv);
    });
}

// 排序收藏列表
function sortFavorites(favorites, sortType) {
    const sorted = [...favorites];
    
    switch (sortType) {
        case 'word_asc':
            sorted.sort((a, b) => a.word.localeCompare(b.word));
            break;
        case 'word_desc':
            sorted.sort((a, b) => b.word.localeCompare(a.word));
            break;
        case 'favorite_time_desc':
            sorted.sort((a, b) => new Date(b.favorite_time) - new Date(a.favorite_time));
            break;
        case 'favorite_time_asc':
            sorted.sort((a, b) => new Date(a.favorite_time) - new Date(b.favorite_time));
            break;
        default:
            // 默认顺序，保持原有顺序
            break;
    }
    
    return sorted;
}

// 处理排序
function handleSort() {
    renderFavorites();
}

// 切换收藏状态
async function toggleFavorite(word) {
    try {
        const response = await fetch(`${API_BASE_URL}/toggle_favorite`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ word })
        });
        
        if (!response.ok) throw new Error('操作失败');
        
        const data = await response.json();
        if (data.success) {
            showNotification(data.message, 'success');
            // 重新加载收藏列表
            await loadFavorites();
            renderFavorites();
        } else {
            throw new Error(data.error || '操作失败');
        }
    } catch (error) {
        showNotification('操作失败: ' + error.message, 'error');
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

// 朗读单词
function speakWord(word, lang = 'en-US') {
    if (!speechEnabled) {
        showNotification('请先启用语音功能', 'warning');
        return;
    }
    
    if (currentUtterance) {
        speechSynthesis.cancel(); // 停止当前朗读
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
        
        currentUtterance.onerror = function() {
            button.classList.remove('speaking');
            button.innerHTML = '<i class="fas fa-volume-up"></i>';
            button.title = '朗读单词';
            showNotification('语音朗读失败', 'error');
        };
    }
    
    speechSynthesis.speak(currentUtterance);
}

// 朗读例句
function speakSentence(sentence, lang = 'en-US') {
    if (!speechEnabled) {
        showNotification('请先启用语音功能', 'warning');
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
        
        currentUtterance.onerror = function() {
            button.classList.remove('speaking');
            button.innerHTML = '<i class="fas fa-volume-up"></i>';
            button.title = '朗读例句';
            showNotification('语音朗读失败', 'error');
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