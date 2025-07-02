// LLM Configuration
// Add or remove LLMs here - changes will automatically apply to the UI
// Shortcuts are auto-generated based on position (Cmd+1, Cmd+2, etc.)
const LLM_CONFIG = [
    {
        id: 'chatgpt',
        name: 'ChatGPT',
        url: 'https://chat.openai.com',
        icon: 'assets/chatgpt-icon.png'
    },
    {
        id: 'claude',
        name: 'Claude',
        url: 'https://claude.ai',
        icon: 'assets/claude-icon.png'
    },
    {
        id: 'gemini',
        name: 'Gemini',
        url: 'https://gemini.google.com',
        icon: 'assets/gemini-icon.png'
    },
    {
        id: 'perplexity',
        name: 'Perplexity',
        url: 'https://www.perplexity.ai',
        icon: 'assets/perplexity-icon.png'
    },
    {
        id: 'deepseek',
        name: 'DeepSeek',
        url: 'https://chat.deepseek.com',
        icon: 'assets/deepseek-icon.png'
    }
];

// CommonJS export (works for both main and renderer)
module.exports = { LLM_CONFIG }; 