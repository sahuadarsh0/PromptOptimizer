/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { GoogleGenAI } from "@google/genai";

// --- DOM Elements ---
const inputPrompt = document.getElementById('input-prompt') as HTMLTextAreaElement;
const outputPrompt = document.getElementById('output-prompt') as HTMLTextAreaElement;
const optimizeButton = document.getElementById('optimize-button') as HTMLButtonElement;
const stopButton = document.getElementById('stop-button') as HTMLButtonElement;
const copyButton = document.getElementById('copy-button') as HTMLButtonElement;
const copyButtonText = document.getElementById('copy-button-text') as HTMLSpanElement;
const outputLoader = document.getElementById('output-loader') as HTMLDivElement;

// Config Elements
const modelSelect = document.getElementById('model-select') as HTMLSelectElement;
const toneSelect = document.getElementById('tone-select') as HTMLSelectElement;
const goalRadiosContainer = document.getElementById('optimization-goal-container') as HTMLDivElement;
const goalRadios = document.querySelectorAll('input[name="optimization-goal"]');

const useAdvancedCheckbox = document.getElementById('use-advanced-checkbox') as HTMLInputElement;
const advancedStrategyContainer = document.getElementById('advanced-strategy-container') as HTMLDivElement;
const advancedStrategySelect = document.getElementById('advanced-strategy-select') as HTMLSelectElement;

// History Modal Elements
const historyButton = document.getElementById('history-button') as HTMLButtonElement;
const historyModal = document.getElementById('history-modal') as HTMLDivElement;
const closeModalButton = document.getElementById('close-modal-button') as HTMLButtonElement;
const historyModalContent = document.getElementById('history-modal-content') as HTMLDivElement;
const clearHistoryButton = document.getElementById('clear-history-button') as HTMLButtonElement;

// API Key Modal Elements
const apiKeyModal = document.getElementById('api-key-modal') as HTMLDivElement;
const apiKeyModalTitle = document.getElementById('api-key-modal-title') as HTMLHeadingElement;
const apiKeyInput = document.getElementById('api-key-input') as HTMLInputElement;
const saveApiKeyButton = document.getElementById('save-api-key-button') as HTMLButtonElement;
const apiKeySettingsButton = document.getElementById('api-key-settings-button') as HTMLButtonElement;

// --- State ---
const HISTORY_KEY = 'promptOptimizerHistory';
const API_KEY_SESSION_KEY = 'geminiApiKey';
const MAX_HISTORY_ITEMS = 20;
let promptHistory: string[] = [];
let isGenerating = false;
let isCancelled = false;
let ai: GoogleGenAI | null = null;


// --- UI Management ---
const showLoadingState = (loading: boolean) => {
  isGenerating = loading;
  optimizeButton.classList.toggle('hidden', loading);
  stopButton.classList.toggle('hidden', !loading);
  outputLoader.classList.toggle('hidden', !loading);
  inputPrompt.disabled = loading;
  optimizeButton.disabled = loading;
};

const resetUI = () => {
  showLoadingState(false);
  isCancelled = false;
}

const openHistoryModal = () => {
  renderHistory();
  historyModal.classList.remove('hidden');
};

const closeHistoryModal = () => {
  historyModal.classList.add('hidden');
};

const openApiKeyModal = () => {
    const currentKey = sessionStorage.getItem(API_KEY_SESSION_KEY);
    if (currentKey) {
        apiKeyModalTitle.textContent = 'Update Gemini API Key';
        apiKeyInput.value = currentKey;
        saveApiKeyButton.textContent = 'Update Key';
    } else {
        apiKeyModalTitle.textContent = 'Enter Gemini API Key';
        apiKeyInput.value = '';
        saveApiKeyButton.textContent = 'Save Key';
    }
    apiKeyModal.classList.remove('hidden');
};

const setAppDisabled = (disabled: boolean) => {
    inputPrompt.disabled = disabled;
    optimizeButton.disabled = disabled;
    historyButton.disabled = disabled;

    const configSection = document.getElementById('config-section') as HTMLElement;
    const configInputs = configSection.querySelectorAll('input, select');
    
    if (disabled) {
        configSection.classList.add('opacity-50', 'pointer-events-none');
    } else {
        configSection.classList.remove('opacity-50', 'pointer-events-none');
    }

    configInputs.forEach(input => {
        (input as HTMLInputElement | HTMLSelectElement).disabled = disabled;
    });

    // Re-evaluate dependent disabled states when enabling
    if (!disabled) {
         useAdvancedCheckbox.dispatchEvent(new Event('change'));
        const checkedGoal = document.querySelector('input[name="optimization-goal"]:checked') as HTMLInputElement;
        if(checkedGoal) {
            checkedGoal.dispatchEvent(new Event('change'));
        }
    }
};


// --- History Management ---
const renderHistory = () => {
  historyModalContent.innerHTML = '';
  if (promptHistory.length === 0) {
    historyModalContent.innerHTML = `<p class="text-sm text-zinc-500 text-center py-4">Your recent prompts will appear here.</p>`;
    clearHistoryButton.disabled = true;
    return;
  }

  clearHistoryButton.disabled = false;
  promptHistory.forEach((prompt, index) => {
    const item = document.createElement('div');
    item.className = 'bg-zinc-700/50 p-3 rounded-lg flex justify-between items-center gap-2 group';
    
    const promptText = document.createElement('p');
    promptText.className = 'text-zinc-300 text-sm truncate flex-1';
    promptText.textContent = prompt;
    promptText.title = prompt;

    const actions = document.createElement('div');
    actions.className = 'flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity';

    const useButton = document.createElement('button');
    useButton.className = 'text-xs bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/40 px-2 py-1 rounded-md';
    useButton.textContent = 'Use';
    useButton.onclick = () => {
      inputPrompt.value = prompt;
      closeHistoryModal();
    };

    const deleteButton = document.createElement('button');
    deleteButton.className = 'text-xs text-red-400 hover:text-red-300';
    deleteButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>`;
    deleteButton.onclick = (e) => {
      e.stopPropagation();
      deleteHistoryItem(index);
    };

    actions.append(useButton, deleteButton);
    item.append(promptText, actions);
    historyModalContent.appendChild(item);
  });
};


const saveHistory = (prompt: string) => {
  promptHistory = promptHistory.filter(p => p !== prompt);
  promptHistory.unshift(prompt);
  if (promptHistory.length > MAX_HISTORY_ITEMS) {
    promptHistory = promptHistory.slice(0, MAX_HISTORY_ITEMS);
  }
  localStorage.setItem(HISTORY_KEY, JSON.stringify(promptHistory));
};

const loadHistory = () => {
  const storedHistory = localStorage.getItem(HISTORY_KEY);
  if (storedHistory) {
    promptHistory = JSON.parse(storedHistory);
  }
};

const deleteHistoryItem = (index: number) => {
  promptHistory.splice(index, 1);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(promptHistory));
  renderHistory();
};

const clearHistory = () => {
  promptHistory = [];
  localStorage.removeItem(HISTORY_KEY);
  renderHistory();
};

// --- API Call ---
const optimizePrompt = async () => {
  if (!ai) {
    outputPrompt.value = "API client is not initialized. Please provide an API key.";
    openApiKeyModal();
    setAppDisabled(true);
    return;
  }
  
  const userPrompt = inputPrompt.value.trim();
  if (!userPrompt) {
    outputPrompt.value = "Please enter a prompt to optimize.";
    return;
  }
  
  saveHistory(userPrompt);
  showLoadingState(true);
  outputPrompt.value = '';
  copyButton.disabled = true;
  copyButtonText.textContent = 'Copy';

  const selectedModel = modelSelect.value;
  
  try {
    let systemInstruction = `You are a prompt optimization expert for large language models. Your task is to rewrite the user's prompt to be more effective, detailed, and clear. Retain the original intent but enhance it. The optimized prompt should be a direct, ready-to-use instruction for an AI. Do not add any conversational text or explanations around the optimized prompt itself.`;

    if (useAdvancedCheckbox.checked) {
        const selectedStrategy = advancedStrategySelect.value;
        switch (selectedStrategy) {
            case 'race':
                systemInstruction += ` Rewrite the prompt using the RACE framework. The final prompt should clearly define the AI's [R]ole, the [A]ction it needs to take, the [C]ontext for the task, and an [E]xplanation of the expected output format or quality.`;
                break;
            case 'care':
                systemInstruction += ` Rewrite the prompt using the CARE framework. It should provide [C]ontext, define the [A]ction, describe the desired [R]esult, and give an [E]xample of the output.`;
                break;
            case 'ape':
                systemInstruction += ` Rewrite the prompt using the APE framework. It should clearly state the [A]ction, explain the [P]urpose of the action, and detail the [E]xecution steps.`;
                break;
            case 'create':
                systemInstruction += ` Rewrite the prompt using the CREATE framework. Define a [C]haracter/persona, state the [R]equest, provide [E]xamples, specify [A]djustments or constraints, define the output [T]ype, and add any [E]xtras.`;
                break;
            case 'tag':
                systemInstruction += ` Rewrite the prompt using the TAG framework. It should define the overall [T]ask, specify the primary [A]ction, and state the ultimate [G]oal.`;
                break;
            case 'creo':
                systemInstruction += ` Rewrite the prompt using the CREO framework. It should set the [C]ontext, make a clear [R]equest, [E]xplain why it's needed, and describe the desired [O]utcome.`;
                break;
            case 'rise':
                systemInstruction += ` Rewrite the prompt using the RISE framework. It should assign a [R]ole, provide the necessary [I]nput data/context, outline the [S]teps to follow, and describe the final [E]xecution or output.`;
                break;
            case 'pain':
                systemInstruction += ` Rewrite the prompt using the PAIN framework. It should clearly state the [P]roblem, define the [A]ction needed, provide essential [I]nformation, and specify the [N]ext Steps.`;
                break;
            case 'coast':
                systemInstruction += ` Rewrite the prompt using the COAST framework. It should provide [C]ontext, state the main [O]bjective, list the required [A]ctions, describe a relevant [S]cenario, and define the specific [T]ask.`;
                break;
            case 'roses':
                systemInstruction += ` Rewrite the prompt using the ROSES framework. It should assign a [R]ole, define the [O]bjective, set up a [S]cenario, describe the [E]xpected [S]olution, and list the [S]teps to get there.`;
                break;
        }
    } else {
        const selectedGoal = (document.querySelector('input[name="optimization-goal"]:checked') as HTMLInputElement)?.value;
        switch(selectedGoal) {
            case 'reasoning':
                systemInstruction += ` The user wants a reasoning prompt. Rewrite the prompt to guide the AI in complex problem-solving by asking it to break down the problem, show step-by-step thinking, and arrive at a logical conclusion.`;
                break;
            case 'coding':
                systemInstruction += ` The user's goal is "Efficient Coding". Transform their plain language request into a high-quality prompt for a programmer AI. The prompt should ask for code that is not only functional but also readable, maintainable, and efficient. If a programming language isn't specified, infer the most likely one or add a placeholder for the user to fill in.`;
                break;
            case 'writing':
                const selectedTone = toneSelect.value;
                systemInstruction += ` The user's goal is "Creative Writing". Enhance the prompt to be more evocative, detailed, and engaging for a writing AI.`;
                if (selectedTone !== 'default') {
                    if (selectedTone === 'with-emojis') {
                        systemInstruction += ` The final prompt should explicitly ask the AI to adopt a friendly, informal tone and to incorporate relevant emojis in its response.`;
                    } else {
                        systemInstruction += ` The final prompt should explicitly ask the AI to adopt a ${selectedTone} tone in its response.`;
                    }
                }
                break;
            case 'general':
            default:
                // No additional instructions for general/standard prompts.
                break;
        }
    }
    
    const response = await ai.models.generateContent({
      model: selectedModel,
      contents: userPrompt,
      config: {
        systemInstruction: systemInstruction,
      }
    });

    if (isCancelled) {
      outputPrompt.value = "Optimization stopped by user.";
      return;
    }

    const optimizedText = response.text;
    outputPrompt.value = optimizedText;
    copyButton.disabled = false;
  } catch (error) {
    console.error("Error optimizing prompt:", error);
    if (!isCancelled) {
        outputPrompt.value = "An error occurred while optimizing the prompt. Please check the console for details.";
    }
  } finally {
    resetUI();
  }
};


// --- Event Listeners ---
optimizeButton.addEventListener('click', optimizePrompt);

stopButton.addEventListener('click', () => {
  if (isGenerating) {
    isCancelled = true;
    resetUI();
    outputPrompt.value = "Optimization stopped by user.";
  }
});

copyButton.addEventListener('click', () => {
  if (outputPrompt.value) {
    navigator.clipboard.writeText(outputPrompt.value);
    copyButtonText.textContent = 'Copied!';
    setTimeout(() => {
      copyButtonText.textContent = 'Copy';
    }, 2000);
  }
});

historyButton.addEventListener('click', openHistoryModal);
closeModalButton.addEventListener('click', closeHistoryModal);
historyModal.addEventListener('click', (e) => {
  if (e.target === historyModal) {
    closeHistoryModal();
  }
});
clearHistoryButton.addEventListener('click', clearHistory);

apiKeySettingsButton.addEventListener('click', openApiKeyModal);

saveApiKeyButton.addEventListener('click', () => {
    const apiKey = apiKeyInput.value.trim();
    if (apiKey) {
        sessionStorage.setItem(API_KEY_SESSION_KEY, apiKey);
        initializeAiClient(apiKey);
    } else {
        apiKeyInput.classList.add('border-red-500');
        apiKeyInput.placeholder = 'API Key cannot be empty.';
        setTimeout(() => {
            apiKeyInput.classList.remove('border-red-500');
        }, 2000);
    }
});


goalRadios.forEach(radio => {
    radio.addEventListener('change', () => {
        const selectedGoal = (document.querySelector('input[name="optimization-goal"]:checked') as HTMLInputElement)?.value;
        const isWriting = selectedGoal === 'writing';
        toneSelect.disabled = !isWriting;
        if (!isWriting) {
            toneSelect.value = 'default';
        }
    });
});

useAdvancedCheckbox.addEventListener('change', (e) => {
    const isChecked = (e.target as HTMLInputElement).checked;
    advancedStrategySelect.disabled = !isChecked;
    advancedStrategyContainer.classList.toggle('opacity-50', !isChecked);
    
    goalRadios.forEach(radio => {
        (radio as HTMLInputElement).disabled = isChecked;
    });
    goalRadiosContainer.classList.toggle('opacity-50', isChecked);
    
    // Also disable tone select if advanced is checked
    if (isChecked) {
        toneSelect.disabled = true;
    } else {
        // Re-enable tone select only if 'writing' is checked
        const selectedGoal = (document.querySelector('input[name="optimization-goal"]:checked') as HTMLInputElement)?.value;
        if(selectedGoal === 'writing') {
            toneSelect.disabled = false;
        }
    }
});

// --- Background Animation ---
const createParticles = () => {
    const particleContainer = document.getElementById('particle-container');
    if (!particleContainer) return;

    const particleCount = 75;
    for (let i = 0; i < particleCount; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';

        // Randomize starting position, size, and animation properties
        const x = Math.random() * 150 - 25; // Start across a wider horizontal range
        const y = Math.random() * 150 - 25; // Start across a wider vertical range
        particle.style.left = `${x}vw`;
        particle.style.top = `${y}vh`;
        
        const size = Math.random() * 2 + 1; // 1px to 3px
        particle.style.width = `${size}px`;
        particle.style.height = `${size}px`;

        const duration = Math.random() * 10 + 8; // 8s to 18s
        particle.style.animationDuration = `${duration}s`;
        
        const delay = Math.random() * 15; // 0s to 15s
        particle.style.animationDelay = `${delay}s`;

        particleContainer.appendChild(particle);
    }
};

// --- AI Client & App Initialization ---
const initializeAiClient = (apiKey: string) => {
    try {
        ai = new GoogleGenAI({ apiKey });
        apiKeyModal.classList.add('hidden');
        setAppDisabled(false);
        if (outputPrompt.placeholder === "Please enter your Gemini API key to begin.") {
            outputPrompt.placeholder = "Optimized prompt will appear here...";
            outputPrompt.value = '';
        }
    } catch (error) {
        console.error("Failed to initialize GoogleGenAI:", error);
        outputPrompt.value = "Failed to initialize AI Client. The API Key might be invalid.";
        sessionStorage.removeItem(API_KEY_SESSION_KEY);
        openApiKeyModal();
        setAppDisabled(true);
    }
};

const initializeApp = () => {
    loadHistory();
    createParticles();
    const savedApiKey = sessionStorage.getItem(API_KEY_SESSION_KEY);
    if (savedApiKey) {
        initializeAiClient(savedApiKey);
    } else {
        openApiKeyModal();
        setAppDisabled(true);
        outputPrompt.placeholder = "Please enter your Gemini API key to begin.";
    }
};

initializeApp();