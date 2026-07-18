const WORKER_URL = "https://spring-heart-3a64.amitaaronsahoo.workers.dev"; 

let products = [];
let selectedProducts = JSON.parse(localStorage.getItem('loreal_selected')) || [];
let chatHistory = [
    { role: "system", content: "You are an expert L'Oréal Beauty Advisor. Provide tailored routines based on the user's selected products. Only answer questions related to skincare, haircare, makeup, and fragrance. Use web search to pull the most up-to-date links or tips for L'Oréal products if needed." }
];

const elements = {
    grid: document.getElementById('product-grid'),
    search: document.getElementById('product-search'),
    category: document.getElementById('category-filter'),
    selectedList: document.getElementById('selected-list'),
    clearAll: document.getElementById('clear-all'),
    genRoutineBtn: document.getElementById('generate-routine'),
    chatWindow: document.getElementById('chat-window'),
    chatInput: document.getElementById('chat-input'),
    sendMsgBtn: document.getElementById('send-msg'),
    rtlToggle: document.getElementById('rtl-toggle')
};

// Initialize
async function init() {
    try {
        const response = await fetch('products.json');
        products = await response.json();
        
        // Move this UP so listeners attach before any rendering errors can occur
        setupEventListeners(); 
        
        renderGrid();
        renderSelected();
    } catch (error) {
        console.error("Error loading products:", error);
    }
}
function setupEventListeners() {
    elements.search.addEventListener('input', renderGrid);
    elements.category.addEventListener('change', renderGrid);
    elements.clearAll.addEventListener('click', () => { selectedProducts = []; updateStorageAndUI(); });
    elements.genRoutineBtn.addEventListener('click', generateRoutine);
    elements.sendMsgBtn.addEventListener('click', sendFollowUp);
    elements.chatInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendFollowUp(); });
    elements.rtlToggle.addEventListener('click', toggleRTL);
}

// Render Products (Safely handles missing data)
function renderGrid() {
    const searchTerm = elements.search.value.toLowerCase();
    const category = elements.category.value;

    const filtered = products.filter(p => {
        // Fallback to empty strings if name or description is missing from the JSON
        const safeName = p.name ? p.name.toLowerCase() : "";
        const safeDesc = p.description ? p.description.toLowerCase() : "";
        
        const matchesSearch = safeName.includes(searchTerm) || safeDesc.includes(searchTerm);
        const matchesCategory = category === 'all' || p.category === category;
        
        return matchesSearch && matchesCategory;
    });

    elements.grid.innerHTML = filtered.map(p => `
        <div class="product-card ${selectedProducts.some(sp => sp.id === p.id) ? 'selected' : ''}" onclick="toggleProduct('${p.id}')">
            <img src="${p.image || 'https://placehold.co/300x300?text=No+Image'}" alt="${p.name || 'Product'}">
            <p class="brand">${p.brand || 'Unknown Brand'}</p>
            <h3>${p.name || 'Unnamed Product'}</h3>
            <div class="description-overlay">${p.description || 'No description available.'}</div>
        </div>
    `).join('');
}

// Select / Deselect Logic
window.toggleProduct = function(id) {
    const product = products.find(p => p.id === id);
    const index = selectedProducts.findIndex(p => p.id === id);
    
    if (index > -1) {
        selectedProducts.splice(index, 1);
    } else {
        selectedProducts.push(product);
    }
    updateStorageAndUI();
}

window.removeProduct = function(id) {
    selectedProducts = selectedProducts.filter(p => p.id !== id);
    updateStorageAndUI();
}

function updateStorageAndUI() {
    localStorage.setItem('loreal_selected', JSON.stringify(selectedProducts));
    renderGrid(); 
    renderSelected();
}

function renderSelected() {
    elements.selectedList.innerHTML = selectedProducts.map(p => `
        <li>
            <span>${p.name}</span>
            <button class="remove-btn" onclick="removeProduct('${p.id}')">X</button>
        </li>
    `).join('');

    const hasProducts = selectedProducts.length > 0;
    elements.clearAll.classList.toggle('hidden', !hasProducts);
    elements.genRoutineBtn.disabled = !hasProducts;
}

// AI Chat Logic
async function generateRoutine() {
    if (selectedProducts.length === 0) return;
    
    const productData = JSON.stringify(selectedProducts.map(p => ({
        name: p.name, brand: p.brand, category: p.category, desc: p.description
    })));

    const prompt = `I have selected these products: ${productData}. Please create a step-by-step personalized routine for me. Use current web search information to give specific real-world tips about using these specific products.`;
    
    addMessage("Generating routine based on your selections...", 'user');
    elements.genRoutineBtn.disabled = true;

    await fetchAIResponse(prompt);
    
    elements.genRoutineBtn.disabled = false;
    elements.chatInput.disabled = false;
    elements.sendMsgBtn.disabled = false;
}

async function sendFollowUp() {
    const text = elements.chatInput.value.trim();
    if (!text) return;
    
    addMessage(text, 'user');
    elements.chatInput.value = '';
    await fetchAIResponse(text);
}

async function fetchAIResponse(userMessage) {
    chatHistory.push({ role: "user", content: userMessage });
    const loadingId = addMessage("Thinking...", 'ai');

    try {
        const response = await fetch(WORKER_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messages: chatHistory })
        });
        const data = await response.json();
        
        document.getElementById(loadingId).remove();
        
        const aiText = data.reply || "Sorry, I couldn't process that request.";
        chatHistory.push({ role: "assistant", content: aiText });
        addMessage(aiText, 'ai');

    } catch (error) {
        document.getElementById(loadingId).innerText = "Error connecting to AI. Please try again.";
        console.error(error);
    }
}

function addMessage(text, sender) {
    const id = 'msg-' + Math.random().toString(36).substr(2, 9);
    const div = document.createElement('div');
    div.id = id;
    div.className = `message ${sender}`;
    div.innerHTML = text.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br>');
    elements.chatWindow.appendChild(div);
    elements.chatWindow.scrollTop = elements.chatWindow.scrollHeight;
    return id;
}

// RTL LevelUp
function toggleRTL() {
    const isRTL = document.documentElement.dir === 'rtl';
    document.documentElement.dir = isRTL ? 'ltr' : 'rtl';
}

init();
