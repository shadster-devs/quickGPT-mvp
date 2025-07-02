const { ipcRenderer } = require('electron');
const { LLM_CONFIG } = require('./llm-config.cjs');

// DOM elements
let tabs, webviews;
const browserBtn = document.getElementById('browser-btn');
const settingsBtn = document.getElementById('settings-btn');
const preferencesScreen = document.getElementById('preferences-screen');
const backBtn = document.getElementById('back-btn');
const savePreferencesBtn = document.getElementById('save-preferences');
const cancelPreferencesBtn = document.getElementById('cancel-preferences');
const loading = document.getElementById('loading');

// Preference controls
const defaultLLMSelect = document.getElementById('default-llm');
const themeSelect = document.getElementById('theme');
const autoLaunchCheckbox = document.getElementById('auto-launch');
const globalHotkeyInput = document.getElementById('global-hotkey');
const llmSelectionContainer = document.getElementById('llm-selection');

// State variables
let currentTabIndex = 0;
let webviewsLoaded = {};
let isRecordingHotkey = false;
let originalSettings = {};

// Initialize webviewsLoaded based on config
LLM_CONFIG.forEach((_, index) => {
    webviewsLoaded[index] = false;
});

// Initialize the app
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});

function generateDynamicContent() {
    // Get selected LLMs and custom order from settings
    const selectedLLMs = ipcRenderer.sendSync('get-setting', 'selectedLLMs', LLM_CONFIG.map((_, i) => i));
    const llmOrder = ipcRenderer.sendSync('get-setting', 'llmOrder', LLM_CONFIG.map((_, i) => i));
    
    // Create filtered config respecting both selection and custom order
    const filteredConfig = llmOrder
        .filter(index => selectedLLMs.includes(index))
        .map(index => LLM_CONFIG[index]);
    
    // Generate tabs
    const tabsContainer = document.getElementById('tabs');
    tabsContainer.innerHTML = '';
    
    filteredConfig.forEach((llm, index) => {
        const tab = document.createElement('div');
        tab.className = `tab ${index === 0 ? 'active' : ''}`;
        tab.setAttribute('data-tab', index);
        tab.innerHTML = `
            <img src="${llm.icon}" alt="${llm.name}" class="tab-icon">
            <span>${llm.name}</span>
        `;
        tabsContainer.appendChild(tab);
    });
    
    // Generate webviews
    const contentContainer = document.getElementById('content');
    const existingWebviews = contentContainer.querySelectorAll('.webview');
    existingWebviews.forEach(webview => webview.remove());
    
    filteredConfig.forEach((llm, index) => {
        const webview = document.createElement('webview');
        webview.id = `${llm.id}-webview`;
        webview.className = `webview ${index === 0 ? 'active' : ''}`;
        webview.src = llm.url;
        webview.setAttribute('partition', `persist:${llm.id}`);
        webview.setAttribute('useragent', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        webview.setAttribute('allowpopups', '');
        
        // Insert before loading div
        contentContainer.insertBefore(webview, loading);
    });
    
    // Generate preferences dropdown
    defaultLLMSelect.innerHTML = '';
    filteredConfig.forEach((llm, index) => {
        const option = document.createElement('option');
        option.value = index;
        option.textContent = llm.name;
        defaultLLMSelect.appendChild(option);
    });
    

    
    // Generate LLM selection checkboxes in preferences
    generateLLMSelection();
    
    // Update DOM element references
    tabs = document.querySelectorAll('.tab');
    webviews = document.querySelectorAll('.webview');
    
    // Setup event listeners for new tabs and webviews
    setupTabSwitching();
    setupWebViews();
    
    // Update webviewsLoaded object
    webviewsLoaded = {};
    filteredConfig.forEach((_, index) => {
        webviewsLoaded[index] = false;
    });
}

function initializeApp() {
    // Generate UI based on saved settings first (no flash of default content)
    generateDynamicContent();
    
    // Then setup preferences
    setupPreferences();
    
    // Set initial tab based on default LLM setting
    const selectedLLMs = ipcRenderer.sendSync('get-setting', 'selectedLLMs', LLM_CONFIG.map((_, i) => i));
    const llmOrder = ipcRenderer.sendSync('get-setting', 'llmOrder', LLM_CONFIG.map((_, i) => i));
    const defaultLLM = ipcRenderer.sendSync('get-setting', 'defaultLLM', 0);
    
    // Get the ordered and filtered LLM list (this is what the tabs actually show)
    const orderedAndFiltered = llmOrder.filter(llmIndex => selectedLLMs.includes(llmIndex));
    
    // Find the default LLM's position in the filtered and ordered list
    const defaultLLMIndex = orderedAndFiltered.indexOf(defaultLLM);
    
    // Switch to the correct tab (fallback to 0 if default LLM not in filtered list)
    switchToTab(defaultLLMIndex >= 0 ? defaultLLMIndex : 0);
}

// Tab switching functionality
function setupTabSwitching() {
    tabs.forEach((tab, index) => {
        tab.addEventListener('click', () => {
            switchToTab(index);
        });
    });
}

function switchToTab(index) {
    if (index < 0 || index >= tabs.length) return;
    
    // Update visual state
    tabs.forEach((tab, i) => {
        tab.classList.toggle('active', i === index);
    });
    
    webviews.forEach((webview, i) => {
        webview.classList.toggle('active', i === index);
    });
    
    currentTabIndex = index;
    
    // Save last used tab
    ipcRenderer.send('set-setting', 'lastTab', index);
    
    // Show loading if webview not loaded yet
    if (!webviewsLoaded[index]) {
        showLoading();
    } else {
        hideLoading();
    }
    
    // Focus the active webview
    setTimeout(() => {
        const activeWebview = document.querySelector('.webview.active');
        if (activeWebview) {
            activeWebview.focus();
        }
    }, 100);
}

// WebView management
function setupWebViews() {
    webviews.forEach((webview, index) => {
        // Handle loading states
        webview.addEventListener('dom-ready', () => {
            webviewsLoaded[index] = true;
            if (currentTabIndex === index) {
                hideLoading();
            }
            console.log(`WebView ${index} loaded`);
            
            // Inject custom CSS for better integration
            setTimeout(() => injectCustomStyles(webview, index), 500);
        });
        
        webview.addEventListener('did-start-loading', () => {
            if (currentTabIndex === index) {
                showLoading();
            }
            console.log(`WebView ${index} started loading`);
        });
        
        webview.addEventListener('did-stop-loading', () => {
            if (currentTabIndex === index) {
                hideLoading();
            }
            console.log(`WebView ${index} stopped loading`);
        });
        
        webview.addEventListener('did-fail-load', (event) => {
            console.error(`WebView ${index} failed to load:`, event);
            if (currentTabIndex === index) {
                hideLoading();
                showError(`Failed to load ${getWebViewName(index)}`);
            }
        });
        
        // Handle navigation
        webview.addEventListener('did-navigate', (event) => {
            console.log(`WebView ${index} navigated to: ${event.url}`);
        });
        
        // Handle crashes - use new event name
        webview.addEventListener('render-process-gone', (event) => {
            console.error(`WebView ${index} render process gone:`, event.details);
            if (currentTabIndex === index) {
                showError(`${getWebViewName(index)} crashed. Click to reload.`);
            }
        });
        
        // Handle external links
        webview.addEventListener('new-window', (event) => {
            event.preventDefault();
            require('electron').shell.openExternal(event.url);
        });
        
        // Add click handler to reload on error
        webview.addEventListener('click', (event) => {
            if (webview.classList.contains('error')) {
                webview.reload();
                webview.classList.remove('error');
                if (currentTabIndex === index) {
                    showLoading();
                }
            }
        });
    });
}

function getWebViewName(index) {
    const selectedLLMs = ipcRenderer.sendSync('get-setting', 'selectedLLMs', LLM_CONFIG.map((_, i) => i));
    const llmOrder = ipcRenderer.sendSync('get-setting', 'llmOrder', LLM_CONFIG.map((_, i) => i));
    const orderedAndFiltered = llmOrder.filter(llmIndex => selectedLLMs.includes(llmIndex));
    const llmConfigIndex = orderedAndFiltered[index];
    return LLM_CONFIG[llmConfigIndex]?.name || 'Unknown';
}

function generateLLMSelection() {
    llmSelectionContainer.innerHTML = '';
    const selectedLLMs = ipcRenderer.sendSync('get-setting', 'selectedLLMs', LLM_CONFIG.map((_, i) => i));
    const llmOrder = ipcRenderer.sendSync('get-setting', 'llmOrder', LLM_CONFIG.map((_, i) => i));
    
    // Create buttons in the custom order
    llmOrder.forEach((llmIndex, position) => {
        const llm = LLM_CONFIG[llmIndex];
        const button = document.createElement('div');
        button.className = `llm-button ${selectedLLMs.includes(llmIndex) ? 'selected' : 'unselected'}`;
        button.setAttribute('data-llm-index', llmIndex);
        button.setAttribute('data-position', position);
        
        // Add drag handle
        const dragHandle = document.createElement('div');
        dragHandle.className = 'drag-handle';
        dragHandle.addEventListener('mousedown', initDrag);
        
        const content = document.createElement('div');
        content.className = 'button-content';
        content.addEventListener('click', toggleLLMSelection);
        
        const icon = document.createElement('img');
        icon.src = llm.icon;
        icon.alt = llm.name;
        
        const label = document.createElement('span');
        label.textContent = llm.name;
        
        content.appendChild(icon);
        content.appendChild(label);
        
        button.appendChild(dragHandle);
        button.appendChild(content);
        
        llmSelectionContainer.appendChild(button);
    });
    
    console.log('Generated LLM selection with simple drag/drop');
}

function toggleLLMSelection(event) {
    // Don't toggle if we're in a drag operation
    if (isDragging) {
        return;
    }
    
    // Get the button from the content area
    const button = event.currentTarget.closest('.llm-button');
    const isSelected = button.classList.contains('selected');
    
    // Toggle the selection state
    if (isSelected) {
        button.classList.remove('selected');
        button.classList.add('unselected');
    } else {
        button.classList.remove('unselected');
        button.classList.add('selected');
    }
    
    // Validate that at least one LLM remains selected
    validateLLMSelection();
}

function validateLLMSelection() {
    const buttons = llmSelectionContainer.querySelectorAll('.llm-button');
    const selectedCount = Array.from(buttons).filter(btn => btn.classList.contains('selected')).length;
    
    // Ensure at least one LLM is selected
    if (selectedCount === 0) {
        // Auto-select the first button
        buttons[0].classList.remove('unselected');
        buttons[0].classList.add('selected');
        showNotification('At least one LLM must be selected');
    }
}

// Mouse-based drag and drop variables
let draggedElement = null;
let isDragging = false;
let startY = 0;
let startX = 0;
let placeholder = null;
let originalElementRect = null;

function initDrag(e) {
    e.preventDefault();
    e.stopPropagation();
    
    console.log('Init drag on handle');
    
    const button = e.target.closest('.llm-button');
    if (!button) return;
    
    draggedElement = button;
    isDragging = true;
    startY = e.clientY;
    startX = e.clientX;
    originalElementRect = button.getBoundingClientRect();
    
    // Add dragging class
    button.classList.add('dragging');
    
    // Create placeholder
    placeholder = document.createElement('div');
    placeholder.className = 'drag-placeholder';
    placeholder.style.height = button.offsetHeight + 'px';
    placeholder.style.width = button.offsetWidth + 'px';
    placeholder.innerHTML = '<div style="text-align: center; color: var(--accent-color); padding: 10px;">Drop here</div>';
    
    // Add event listeners
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
    console.log('Dragging:', button.querySelector('span').textContent);
}

function handleMouseMove(e) {
    if (!isDragging || !draggedElement || !originalElementRect) return;
    
    // Position element exactly at cursor with small offset
    const offset = 10;
    const targetLeft = e.clientX + offset;
    const targetTop = e.clientY + offset;
    
    // Calculate deltas from original position to target position
    const deltaX = targetLeft - originalElementRect.left;
    const deltaY = targetTop - originalElementRect.top;
    
    // Apply the movement - element follows cursor exactly
    draggedElement.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
    draggedElement.style.zIndex = '1000';
    
    // Find the element we're hovering over
    const elementBelow = document.elementFromPoint(e.clientX, e.clientY);
    const targetButton = elementBelow?.closest('.llm-button');
    
    if (targetButton && targetButton !== draggedElement && targetButton.classList.contains('llm-button')) {
        // Remove existing placeholder
        if (placeholder.parentNode) {
            placeholder.remove();
        }
        
        // Determine if we should insert before or after
        const rect = targetButton.getBoundingClientRect();
        const midpoint = rect.top + rect.height / 2;
        const insertBefore = e.clientY < midpoint;
        
        if (insertBefore) {
            targetButton.parentNode.insertBefore(placeholder, targetButton);
        } else {
            targetButton.parentNode.insertBefore(placeholder, targetButton.nextSibling);
        }
        
        console.log('Hovering over:', targetButton.querySelector('span').textContent, insertBefore ? 'before' : 'after');
    }
}

function handleMouseUp(e) {
    if (!isDragging || !draggedElement) return;
    
    console.log('Mouse up - finishing drag');
    
    // Remove event listeners
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
    
    // Reset dragged element styling
    draggedElement.style.transform = '';
    draggedElement.style.zIndex = '';
    draggedElement.classList.remove('dragging');
    
    // If placeholder is in the DOM, replace it with the dragged element
    if (placeholder.parentNode) {
        placeholder.parentNode.insertBefore(draggedElement, placeholder);
        placeholder.remove();
        
        // Update the order
        updateLLMOrder();
        console.log('Order updated!');
    }
    
    // Reset variables
    draggedElement = null;
    isDragging = false;
    placeholder = null;
    originalElementRect = null;
    
    // Reset click prevention after a delay
    setTimeout(() => {
        isDragging = false;
    }, 100);
}

function updateLLMOrder() {
    const buttons = llmSelectionContainer.querySelectorAll('.llm-button');
    const newOrder = Array.from(buttons).map(btn => parseInt(btn.getAttribute('data-llm-index')));
    
    // Save the new order
    ipcRenderer.send('set-setting', 'llmOrder', newOrder);
    
    // Regenerate dynamic content with new order
    generateDynamicContent();
    
    showNotification('LLM order updated');
}

function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.innerHTML = `
        <div class="error-content">
            <h3>⚠️ ${message}</h3>
            <p>Click here to retry</p>
        </div>
    `;
    errorDiv.style.cssText = `
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: var(--bg-secondary);
        border: 1px solid var(--border-color);
        border-radius: 8px;
        padding: 20px;
        text-align: center;
        cursor: pointer;
        z-index: 100;
    `;
    
    const content = document.getElementById('content');
    const existingError = content.querySelector('.error-message');
    if (existingError) {
        existingError.remove();
    }
    content.appendChild(errorDiv);
    
    errorDiv.addEventListener('click', () => {
        const activeWebview = document.querySelector('.webview.active');
        if (activeWebview) {
            activeWebview.reload();
            errorDiv.remove();
            showLoading();
        }
    });
}

// Inject custom styles into webviews for better integration
function injectCustomStyles(webview, index) {
    const css = `
        /* Smooth scrolling */
        * {
            scroll-behavior: smooth;
        }
        
        /* Ensure good readability */
        body {
            font-size: 14px !important;
        }
    `;
    
    webview.executeJavaScript(`
        const style = document.createElement('style');
        style.textContent = \`${css}\`;
        document.head.appendChild(style);
    `).catch(console.error);
}

// Loading indicator
function showLoading() {
    loading.style.display = 'block';
}

function hideLoading() {
    loading.style.display = 'none';
}

// Preferences management
function setupPreferences() {
    // Header buttons
    browserBtn.addEventListener('click', () => {
        const activeWebview = document.querySelector('.webview.active');
        if (activeWebview) {
            const url = activeWebview.getURL();
            ipcRenderer.send('open-url-in-browser', url);
            showNotification('Opened in browser');
        }
    });
    settingsBtn.addEventListener('click', showPreferences);
    
    // Screen controls  
    backBtn.addEventListener('click', hidePreferences);
    cancelPreferencesBtn.addEventListener('click', hidePreferences);
    savePreferencesBtn.addEventListener('click', savePreferences);
    
    // Global hotkey recording
    globalHotkeyInput.addEventListener('click', startHotkeyRecording);
    globalHotkeyInput.addEventListener('focus', startHotkeyRecording);
    
    // Keyboard shortcuts for preferences screen
    document.addEventListener('keydown', (e) => {
        if (isRecordingHotkey) {
            recordHotkey(e);
        } else if (preferencesScreen.classList.contains('show')) {
            if (e.key === 'Escape') {
                hidePreferences();
            } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                savePreferences();
            }
        }
    });
}

function showPreferences() {
    // Store original settings for cancel functionality
    originalSettings = {
        defaultLLM: ipcRenderer.sendSync('get-setting', 'defaultLLM', 0),
        theme: ipcRenderer.sendSync('get-setting', 'theme', 'system'),
        autoLaunch: ipcRenderer.sendSync('get-setting', 'autoLaunch', false),
        globalHotkey: ipcRenderer.sendSync('get-setting', 'globalHotkey', 'CommandOrControl+Shift+G')
    };
    
    // Load current settings into form controls
    loadSettings();
    preferencesScreen.classList.add('show');
    defaultLLMSelect.focus();
}

function hidePreferences() {
    preferencesScreen.classList.remove('show');
    
    // If we were recording hotkey, stop it
    if (isRecordingHotkey) {
        isRecordingHotkey = false;
        globalHotkeyInput.classList.remove('recording');
        ipcRenderer.send('set-hotkey-recording', false);
    }
}

function loadSettings() {
    const theme = ipcRenderer.sendSync('get-setting', 'theme', 'system');
    const autoLaunch = ipcRenderer.sendSync('get-setting', 'autoLaunch', false);
    const globalHotkey = ipcRenderer.sendSync('get-setting', 'globalHotkey', 'CommandOrControl+Shift+G');
    const selectedLLMs = ipcRenderer.sendSync('get-setting', 'selectedLLMs', LLM_CONFIG.map((_, i) => i));
    const defaultLLM = ipcRenderer.sendSync('get-setting', 'defaultLLM', 0);
    
    // Find the default LLM in the filtered and ordered list
    const llmOrder = ipcRenderer.sendSync('get-setting', 'llmOrder', LLM_CONFIG.map((_, i) => i));
    const orderedAndFiltered = llmOrder.filter(llmIndex => selectedLLMs.includes(llmIndex));
    const defaultLLMIndex = orderedAndFiltered.indexOf(defaultLLM);
    
    defaultLLMSelect.value = defaultLLMIndex >= 0 ? defaultLLMIndex : 0;
    themeSelect.value = theme;
    autoLaunchCheckbox.checked = autoLaunch;
    globalHotkeyInput.value = formatHotkey(globalHotkey);
    globalHotkeyInput.setAttribute('data-accelerator', globalHotkey);
    
    // Update LLM selection buttons to match saved settings
    const buttons = llmSelectionContainer.querySelectorAll('.llm-button');
    buttons.forEach((button) => {
        const llmIndex = parseInt(button.getAttribute('data-llm-index'));
        if (selectedLLMs.includes(llmIndex)) {
            button.classList.remove('unselected');
            button.classList.add('selected');
        } else {
            button.classList.remove('selected');
            button.classList.add('unselected');
        }
    });
}

function savePreferences() {
    // Get selected LLMs and current order
    const buttons = llmSelectionContainer.querySelectorAll('.llm-button');
    const selectedLLMs = Array.from(buttons)
        .filter(btn => btn.classList.contains('selected'))
        .map(btn => parseInt(btn.getAttribute('data-llm-index')));
    
    // Get current order from the DOM
    const currentOrder = Array.from(buttons).map(btn => parseInt(btn.getAttribute('data-llm-index')));
    
    // Validate default LLM is in selected list
    const currentDefaultLLM = parseInt(defaultLLMSelect.value);
    const llmOrder = ipcRenderer.sendSync('get-setting', 'llmOrder', LLM_CONFIG.map((_, i) => i));
    const orderedAndFiltered = llmOrder.filter(llmIndex => selectedLLMs.includes(llmIndex));
    
    // Map the current default LLM from filtered and ordered list back to the original config
    let actualDefaultLLM = 0;
    if (currentDefaultLLM < orderedAndFiltered.length) {
        actualDefaultLLM = orderedAndFiltered[currentDefaultLLM];
    } else {
        // If current default is invalid, set to first selected LLM in order
        actualDefaultLLM = orderedAndFiltered[0];
    }
    
    const settings = {
        defaultLLM: actualDefaultLLM,
        theme: themeSelect.value,
        autoLaunch: autoLaunchCheckbox.checked,
        globalHotkey: globalHotkeyInput.getAttribute('data-accelerator'),
        selectedLLMs: selectedLLMs,
        llmOrder: currentOrder
    };
    
    // Save all settings
    Object.entries(settings).forEach(([key, value]) => {
        ipcRenderer.send('set-setting', key, value);
    });
    
    // Regenerate dynamic content with new settings
    generateDynamicContent();
    
    // Validate and set default tab using the ordered and filtered list
    const newOrderedAndFiltered = settings.llmOrder.filter(llmIndex => settings.selectedLLMs.includes(llmIndex));
    const defaultLLMIndex = newOrderedAndFiltered.indexOf(settings.defaultLLM);
    if (defaultLLMIndex !== -1) {
        // Switch to the correct tab in the filtered and ordered list
        setTimeout(() => switchToTab(defaultLLMIndex), 100);
    } else {
        // Fallback to first tab
        setTimeout(() => switchToTab(0), 100);
    }
    
    hidePreferences();
    
    // Show confirmation
    showNotification('Preferences saved successfully');
}

// Hotkey recording
function startHotkeyRecording() {
    if (isRecordingHotkey) return;
    
    isRecordingHotkey = true;
    globalHotkeyInput.value = 'Press keys...';
    globalHotkeyInput.classList.add('recording');
    
    // Tell main process we're recording hotkey so it can disable shortcuts
    ipcRenderer.send('set-hotkey-recording', true);
}

function recordHotkey(event) {
    if (!isRecordingHotkey) return;
    
    event.preventDefault();
    event.stopPropagation();
    
    const keys = [];
    
    if (event.metaKey) keys.push('Command');
    if (event.ctrlKey) keys.push('Control');
    if (event.altKey) keys.push('Alt');
    if (event.shiftKey) keys.push('Shift');
    
    if (event.key && !['Meta', 'Control', 'Alt', 'Shift'].includes(event.key)) {
        let key = event.key.toUpperCase();
        if (key === ' ') key = 'Space';
        if (key.length === 1) {
            keys.push(key);
        } else {
            keys.push(key);
        }
        
        const accelerator = keys.join('+');
        const displayHotkey = formatHotkey(accelerator);
        
        globalHotkeyInput.value = displayHotkey;
        globalHotkeyInput.setAttribute('data-accelerator', accelerator);
        
        isRecordingHotkey = false;
        globalHotkeyInput.classList.remove('recording');
        globalHotkeyInput.blur();
        
        // Tell main process we're done recording
        ipcRenderer.send('set-hotkey-recording', false);
    }
}

function formatHotkey(accelerator) {
    return accelerator
        .replace('CommandOrControl', navigator.platform.includes('Mac') ? 'Cmd' : 'Ctrl')
        .replace('Command', 'Cmd')
        .replace('Control', 'Ctrl')
        .replace('Alt', 'Option')
        .replace('+', ' + ');
}

// Notification system
function showNotification(message, duration = 3000) {
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: var(--accent-color);
        color: white;
        padding: 12px 16px;
        border-radius: 6px;
        box-shadow: var(--shadow);
        z-index: 10000;
        font-size: 13px;
        opacity: 0;
        transform: translateX(100%);
        transition: all 0.3s ease;
    `;
    
    document.body.appendChild(notification);
    
    // Animate in
    setTimeout(() => {
        notification.style.opacity = '1';
        notification.style.transform = 'translateX(0)';
    }, 10);
    
    // Animate out and remove
    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transform = 'translateX(100%)';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, duration);
}

// IPC event listeners

ipcRenderer.on('restore-last-tab', (event, lastTab) => {
    // Restore last tab if it's still valid in current filtered and ordered list
    const selectedLLMs = ipcRenderer.sendSync('get-setting', 'selectedLLMs', LLM_CONFIG.map((_, i) => i));
    const llmOrder = ipcRenderer.sendSync('get-setting', 'llmOrder', LLM_CONFIG.map((_, i) => i));
    const orderedAndFiltered = llmOrder.filter(llmIndex => selectedLLMs.includes(llmIndex));
    
    // lastTab is an index in the filtered and ordered list, check if it's still valid
    if (lastTab >= 0 && lastTab < orderedAndFiltered.length) {
        switchToTab(lastTab);
    }
    // If last tab is not valid, keep the default tab (already set in initializeApp)
});

ipcRenderer.on('show-preferences', () => {
    // Don't execute shortcuts when recording hotkey
    if (isRecordingHotkey) {
        return;
    }
    
    showPreferences();
});

ipcRenderer.on('open-current-tab-in-browser', () => {
    // Don't execute shortcuts when recording hotkey
    if (isRecordingHotkey) {
        return;
    }
    
    const activeWebview = document.querySelector('.webview.active');
    if (activeWebview) {
        const url = activeWebview.getURL();
        ipcRenderer.send('open-url-in-browser', url);
        showNotification('Opened in browser');
    }
});

// Handle webview reload on theme change
ipcRenderer.on('theme-changed', () => {
    // Optionally reload webviews or inject new styles
    webviews.forEach((webview, index) => {
        injectCustomStyles(webview, index);
    });
});

// Keyboard navigation
document.addEventListener('keydown', (e) => {
    // Don't handle shortcuts when recording hotkey
    if (isRecordingHotkey) {
        return;
    }
    
    // Don't handle shortcuts when preferences screen is open (unless recording hotkey)
    if (preferencesScreen.classList.contains('show')) {
        return;
    }
    
    // Handle preferences
    if ((e.metaKey || e.ctrlKey) && e.key === ',') {
        e.preventDefault();
        showPreferences();
    }
});

// Focus management
document.addEventListener('focusin', (e) => {
    // Ensure proper focus management
    if (e.target.tagName === 'WEBVIEW') {
        const index = Array.from(webviews).indexOf(e.target);
        if (index !== -1 && index !== currentTabIndex) {
            switchToTab(index);
        }
    }
});

// Cleanup on unload
window.addEventListener('beforeunload', () => {
    // Save current state
    ipcRenderer.send('set-setting', 'lastTab', currentTabIndex);
});

// Add CSS for recording state
const style = document.createElement('style');
style.textContent = `
    .recording {
        border-color: var(--accent-color) !important;
        box-shadow: 0 0 0 3px rgba(0, 122, 255, 0.2) !important;
        animation: pulse 1s infinite !important;
    }
    
    @keyframes pulse {
        0% { box-shadow: 0 0 0 3px rgba(0, 122, 255, 0.2); }
        50% { box-shadow: 0 0 0 3px rgba(0, 122, 255, 0.4); }
        100% { box-shadow: 0 0 0 3px rgba(0, 122, 255, 0.2); }
    }
    
    .notification {
        pointer-events: none;
    }
`;
document.head.appendChild(style);

console.log('QuickGPT renderer initialized'); 