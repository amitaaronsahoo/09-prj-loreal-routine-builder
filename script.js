const WORKER_URL = "https://spring-heart-3a64.amitaaronsahoo.workers.dev"; 

// Let the array accept whatever structure the original JSON has
let products = [];
let selectedProducts = JSON.parse(localStorage.getItem('loreal_selected')) || [];
let chatHistory = [
    { role: "system", content: "You are an expert L'Oréal Beauty Advisor. Provide tailored routines based on the user's selected products. Only answer questions related to skincare, haircare, makeup, and fragrance. Use web search to pull the most up-to-date links or tips for L'Oréal products if needed." }
];

const elements = {};

// 1. Wait for HTML to load before grabbing elements to guarantee the UI works
document.addEventListener('DOMContentLoaded', () => {
    elements.grid = document.getElementById('product-grid');
    elements.search = document.getElementById('product-search');
    elements.category = document.getElementById('category-filter');
    elements.selectedList = document.getElementById('selected-list');
    elements.clearAll = document.getElementById('clear-all');
    elements.genRoutineBtn = document.getElementById('generate-routine');
    elements.chatWindow = document.getElementById('chat-window');
    elements.chatInput = document.getElementById('chat-input');
    elements.sendMsgBtn = document.getElementById('send-msg');
    elements.rtlToggle = document.getElementById('rtl-toggle');

    init();
});

async function init() {
    // 2. Wire up buttons IMMEDIATELY so the RTL toggle works even if data is still loading
    setupEventListeners();

    try {
        const response = await fetch('products.json');
        if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
        
        const rawData = await response.json();
        // 3. Handle cases where the JSON might be wrapped in an object instead of a direct array
        products = Array.isArray(rawData) ? rawData : (rawData.data || rawData.products || Object.values(rawData));
        
        renderGrid();
        renderSelected();
    } catch (error) {
        console.error("Error loading products:", error);
        elements.grid.innerHTML = `<p style="grid-column: 1 / -1; color: red;"><strong>Error loading products:</strong> Check the console for details.</p>`;
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

// 4. Ultra-flexible render function
function renderGrid() {
    if (!products || products.length === 0) return;

    const searchTerm = elements.search.value.toLowerCase();
    const category = elements.category.value.toLowerCase(); // Lowercase the dropdown value

    const filtered = products.filter(p => {
        // Fallbacks for various JSON key naming conventions
        const safeName = (p.name || p.title || "").toLowerCase();
        const safeDesc = (p.description || p.desc || "").toLowerCase();
        const safeCat = (p.category || "").toLowerCase(); // Normalizes "Skincare" to "skincare"
        
        const matchesSearch = safeName.includes(searchTerm) || safeDesc.includes(searchTerm);
        const matchesCategory = category === 'all' || safeCat === category;
        
        return matchesSearch && matchesCategory;
    });

    elements.grid.innerHTML = filtered.map((p, index) => {
        // Fallback to name or array index if the original JSON doesn't have an ID
        const identifier = p.id || p.name || p.title || `prod-${index}`;
        // Escape quotes to prevent HTML breaking
        const safeIdentifier = identifier.toString().replace(/'/g, "\\'"); 
        
        const isSelected = selectedProducts.some(sp => (sp.id || sp.name || sp.title || `prod-${index}`) === identifier);
        
        return `
            <div class="product-card ${isSelected ? 'selected' : ''}" onclick="toggleProduct('${safeIdentifier}')">
                <img src="${p.image || p.img_url || 'https://placehold.co/300x300?text=No+Image'}" alt="${p.name || p.title || 'Product'}">
                <p class="brand">${p.brand || "L'Oréal"}</p>
                <h3>${p.name || p.title || 'Unnamed Product'}</h3>
                <div class="description-overlay">${p.description || p.desc || 'No description available.'}</div>
            </div>
        `;
    }).join('');
}

// 5. Select / Deselect Logic matching the flexible identifiers
window.toggleProduct = function(identifier) {
    const product = products.find((p, index) => (p.id || p.name || p.title || `prod-${index}`).toString() === identifier.toString());
    const selectedIndex = selectedProducts.findIndex((p, index) => (p.id || p.name || p.title || `prod-${index}`).toString() === identifier.toString());
    
    if (selectedIndex > -1) {
        selectedProducts.splice(selectedIndex, 1);
    } else if (product) {
        selectedProducts.push(product);
    }
    updateStorageAndUI();
}

window.removeProduct = function(identifier) {
    selectedProducts = selectedProducts.filter((p, index) => (p.id || p.name || p.title || `prod-${index}`).toString() !== identifier.toString());
    updateStorageAndUI();
}

function updateStorageAndUI() {
    localStorage.setItem('loreal_selected', JSON.stringify(selectedProducts));
    renderGrid(); 
    renderSelected();
}

function renderSelected() {
    elements.selectedList.innerHTML = selectedProducts.map((p, index) => {
        const identifier = p.id || p.name || p.title || `prod-${index}`;
        const safeIdentifier = identifier.toString().replace(/'/g, "\\'");
        
        return `
            <li>
                <span>${p.name || p.title}</span>
                <button class="remove-btn" onclick="removeProduct('${safeIdentifier}')">X</button>
            </li>
        `;
    }).join('');

    const hasProducts = selectedProducts.length > 0;
    elements.clearAll.classList.toggle('hidden', !hasProducts);
    elements.genRoutineBtn.disabled = !hasProducts;
}

// AI Chat Logic
async function generateRoutine() {
    if (selectedProducts.length === 0) return;
    
    const productData = JSON.stringify(selectedProducts.map(p => ({
        name: p.name || p.title, brand: p.brand, category: p.category, desc: p.description || p.desc
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
        console.error("Worker Error:", error);
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
