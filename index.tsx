/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
// FIX: The 'LiveSession' type is not exported from the '@google/genai' module.
import { GoogleGenAI, LiveServerMessage, Modality, Blob } from "@google/genai";

// --- DOM Elements ---
const inputPrompt = document.getElementById('input-prompt') as HTMLTextAreaElement;
const negativePrompt = document.getElementById('negative-prompt') as HTMLTextAreaElement;
const outputPrompt = document.getElementById('output-prompt') as HTMLTextAreaElement;
const optimizeButton = document.getElementById('optimize-button') as HTMLButtonElement;
const stopButton = document.getElementById('stop-button') as HTMLButtonElement;
const copyButton = document.getElementById('copy-button') as HTMLButtonElement;
const copyButtonText = document.getElementById('copy-button-text') as HTMLSpanElement;
const outputLoader = document.getElementById('output-loader') as HTMLDivElement;
const micButton = document.getElementById('mic-button') as HTMLButtonElement;
const translatingLoader = document.getElementById('translating-loader') as HTMLDivElement;
// FIX: Cast to unknown first to resolve SVGElement conversion error.
const micIcon = document.getElementById('mic-icon') as unknown as SVGElement;
// FIX: Cast to unknown first to resolve SVGElement conversion error.
const stopMicIcon = document.getElementById('stop-mic-icon') as unknown as SVGElement;

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

// --- State ---
const HISTORY_KEY = 'promptOptimizerHistory';
const SESSION_STATE_KEY = 'promptOptimizerSession';
const MAX_HISTORY_ITEMS = 20;
let promptHistory: string[] = [];
let isGenerating = false;
let isCancelled = false;
let ai: GoogleGenAI | null = null;

// STT State
let isRecording = false;
let isTranslating = false;
// FIX: Replaced 'LiveSession' with 'any' since it is not an exported type.
let sessionPromise: Promise<any> | null = null;
let mediaStream: MediaStream | null = null;
let inputAudioContext: AudioContext | null = null;
let scriptProcessor: ScriptProcessorNode | null = null;
let currentTurnTranscription = '';
let fullSessionTranscription = '';
let previousPromptValue = '';


// --- UI Management ---
const showLoadingState = (loading: boolean) => {
  isGenerating = loading;
  optimizeButton.classList.toggle('hidden', loading);
  stopButton.classList.toggle('hidden', !loading);
  outputLoader.classList.toggle('hidden', !loading);
  inputPrompt.disabled = loading;
  negativePrompt.disabled = loading;
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

const setAppDisabled = (disabled: boolean) => {
    inputPrompt.disabled = disabled;
    negativePrompt.disabled = disabled;
    optimizeButton.disabled = disabled;
    historyButton.disabled = disabled;
    micButton.disabled = disabled;

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

// --- Session State Management ---
const saveStateToLocalStorage = () => {
    try {
        const selectedGoal = (document.querySelector('input[name="optimization-goal"]:checked') as HTMLInputElement)?.value;
        const state = {
            inputPrompt: inputPrompt.value,
            negativePrompt: negativePrompt.value,
            model: modelSelect.value,
            goal: selectedGoal,
            tone: toneSelect.value,
            useAdvanced: useAdvancedCheckbox.checked,
            advancedStrategy: advancedStrategySelect.value,
        };
        localStorage.setItem(SESSION_STATE_KEY, JSON.stringify(state));
    } catch (error) {
        console.warn("Could not save session state to local storage:", error);
    }
};

const loadStateFromLocalStorage = () => {
    const savedStateJSON = localStorage.getItem(SESSION_STATE_KEY);
    if (!savedStateJSON) return;

    try {
        const savedState = JSON.parse(savedStateJSON);
        
        if (savedState.inputPrompt) inputPrompt.value = savedState.inputPrompt;
        if (savedState.negativePrompt) negativePrompt.value = savedState.negativePrompt;
        
        if (savedState.model && Array.from(modelSelect.options).some(o => o.value === savedState.model)) {
             modelSelect.value = savedState.model;
        }

        if (savedState.goal) {
            const goalRadio = document.querySelector(`input[name="optimization-goal"][value="${savedState.goal}"]`) as HTMLInputElement;
            if (goalRadio) goalRadio.checked = true;
        }

        if (savedState.tone) toneSelect.value = savedState.tone;
        if (typeof savedState.useAdvanced === 'boolean') {
            useAdvancedCheckbox.checked = savedState.useAdvanced;
        }
        if (savedState.advancedStrategy) advancedStrategySelect.value = savedState.advancedStrategy;

        // Trigger change events to update UI state (e.g., disabled states)
        useAdvancedCheckbox.dispatchEvent(new Event('change'));
        const checkedGoal = document.querySelector('input[name="optimization-goal"]:checked') as HTMLInputElement;
        if (checkedGoal) {
            checkedGoal.dispatchEvent(new Event('change'));
        }

    } catch (e) {
        console.error("Error loading saved state from local storage:", e);
        localStorage.removeItem(SESSION_STATE_KEY);
    }
};

// --- API Call ---
const optimizePrompt = async () => {
  if (!ai) {
    outputPrompt.value = "AI client is not initialized. Please ensure the API Key is configured correctly.";
    setAppDisabled(true);
    return;
  }
  
  const userPrompt = inputPrompt.value.trim();
  const negativePromptText = negativePrompt.value.trim();
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

    if (negativePromptText) {
        systemInstruction += ` The user has provided a negative prompt. The optimized prompt must contain a section that explicitly tells the AI to avoid the following concepts, objects, or qualities: "${negativePromptText}". This is a hard constraint. For example, add a section like "---AVOID---" or "Negative Prompt:" to the final output.`;
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

// --- STT / Gemini Live ---
const updateMicButtonState = (isRecordingActive: boolean) => {
    isRecording = isRecordingActive;
    if (isRecordingActive) {
        micIcon.classList.add('hidden');
        stopMicIcon.classList.remove('hidden');
        micButton.classList.remove('bg-zinc-700', 'hover:bg-zinc-600');
        micButton.classList.add('bg-red-500/20');
        micButton.setAttribute('aria-label', 'Stop Recording');
        micButton.title = 'Stop Recording';
    } else {
        micIcon.classList.remove('hidden');
        stopMicIcon.classList.add('hidden');
        micButton.classList.add('bg-zinc-700', 'hover:bg-zinc-600');
        micButton.classList.remove('bg-red-500/20');
        micButton.setAttribute('aria-label', 'Start Recording');
        micButton.title = 'Start Recording';
    }
};

function encode(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function createBlob(data: Float32Array): Blob {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    int16[i] = data[i] * 32768;
  }
  return {
    data: encode(new Uint8Array(int16.buffer)),
    mimeType: 'audio/pcm;rate=16000',
  };
}

const cleanupRecordingResources = () => {
    mediaStream?.getTracks().forEach(track => track.stop());
    scriptProcessor?.disconnect();
    inputAudioContext?.close().catch(console.error);

    sessionPromise = null;
    mediaStream = null;
    scriptProcessor = null;
    inputAudioContext = null;

    currentTurnTranscription = '';
    previousPromptValue = '';
    fullSessionTranscription = '';
    
    inputPrompt.classList.remove('listening');
    inputPrompt.placeholder = 'e.g., a cat wearing a hat';
};

const startRecording = async () => {
    if (!ai || isRecording || isTranslating) return;
    updateMicButtonState(true);
    inputPrompt.classList.add('listening');
    inputPrompt.placeholder = 'Listening... Speak now.';
    
    previousPromptValue = inputPrompt.value;
    currentTurnTranscription = '';
    fullSessionTranscription = '';

    try {
        mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });

        sessionPromise = ai.live.connect({
            model: 'gemini-2.5-flash-native-audio-preview-09-2025',
            callbacks: {
                onopen: () => {
                    if (!isRecording || !mediaStream) {
                        console.warn("onopen called, but recording has already been stopped.");
                        sessionPromise?.then(session => session.close());
                        return;
                    }
                    inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
                    const source = inputAudioContext.createMediaStreamSource(mediaStream);
                    scriptProcessor = inputAudioContext.createScriptProcessor(4096, 1, 1);
                    scriptProcessor.onaudioprocess = (audioProcessingEvent) => {
                        const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
                        const pcmBlob = createBlob(inputData);
                        sessionPromise?.then((session) => {
                            session.sendRealtimeInput({ media: pcmBlob });
                        });
                    };
                    source.connect(scriptProcessor);
                    scriptProcessor.connect(inputAudioContext.destination);
                },
                onmessage: async (message: LiveServerMessage) => {
                    if (message.serverContent?.inputTranscription?.text) {
                        const transcribedChunk = message.serverContent.inputTranscription.text;
                        currentTurnTranscription += transcribedChunk;
                        fullSessionTranscription += transcribedChunk;
                        inputPrompt.value = previousPromptValue + fullSessionTranscription;
                    }

                    if (message.serverContent?.turnComplete && currentTurnTranscription.trim()) {
                        const textToTranslate = currentTurnTranscription;
                        currentTurnTranscription = ''; 
                
                        try {
                            const response = await ai!.models.generateContent({
                                model: 'gemini-2.5-flash',
                                contents: textToTranslate,
                                config: {
                                    systemInstruction: `You are an expert multilingual translator. Your task is to take the user's text, detect its language, and translate it into natural-sounding English. You must only output the translated English text, with no additional commentary, labels, or explanations.`,
                                }
                            });
                
                            const translatedText = response.text.trim();
                            
                            previousPromptValue += translatedText + ' ';
                            inputPrompt.value = previousPromptValue;
                            fullSessionTranscription = ''; // Clear original transcription after translation
                        } catch (error) {
                            console.error("Translation error:", error);
                            previousPromptValue += textToTranslate + ' ';
                            inputPrompt.value = previousPromptValue;
                        }
                    }
                },
                onerror: (e: ErrorEvent) => {
                    console.error('Session error:', e);
                    outputPrompt.value = "An error occurred with the microphone session. Please try again.";
                    if (isRecording) {
                        stopRecording(false);
                    }
                },
                onclose: (e: CloseEvent) => {
                    if (isRecording) {
                        stopRecording(false);
                    }
                },
            },
            config: {
                responseModalities: [Modality.AUDIO],
                inputAudioTranscription: {},
            },
        });
    } catch (error) {
        console.error('Error starting recording:', error);
        outputPrompt.value = "Could not access microphone. Please ensure permission is granted and try again.";
        updateMicButtonState(false);
        inputPrompt.classList.remove('listening');
        inputPrompt.placeholder = 'e.g., a cat wearing a hat';
    }
};

const stopRecording = async (isFromUserClick: boolean = true) => {
    if (!isRecording) return;
    updateMicButtonState(false);

    if (sessionPromise) {
        sessionPromise.then(session => session.close());
    }

    const textToTranslate = fullSessionTranscription.trim();

    if (isFromUserClick && textToTranslate) {
        isTranslating = true;
        translatingLoader.classList.remove('hidden');
        micButton.disabled = true;

        try {
            const systemInstruction = `You are an expert multilingual translator. Your task is to take the user's raw, potentially fragmented speech-to-text transcription, detect its language, correct any transcription errors, and translate it into natural-sounding English. The input may contain repetitions or pauses. Your output must be only the final, clean, translated English text, with no additional commentary, labels, or explanations.`;
            
            const response = await ai!.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: textToTranslate,
                config: { systemInstruction }
            });

            const finalTranslatedText = response.text.trim();
            inputPrompt.value = previousPromptValue + finalTranslatedText;
        } catch (error) {
            console.error("Final translation error:", error);
            outputPrompt.value = "An error occurred during the final translation step.";
        } finally {
            isTranslating = false;
            translatingLoader.classList.add('hidden');
            micButton.disabled = false;
            cleanupRecordingResources();
        }
    } else {
        cleanupRecordingResources();
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

micButton.addEventListener('click', () => {
    if (isTranslating) return;
    if (!isRecording) {
        startRecording();
    } else {
        stopRecording();
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

// --- Model Loading ---
const populateModels = () => {
  modelSelect.innerHTML = '';
  
  const models = [
      { value: 'gemini-2.5-flash', text: 'Gemini 2.5 Flash' },
      { value: 'gemini-2.5-flash-lite', text: 'Gemini 2.5 Flash Lite' },
      { value: 'gemini-2.5-pro', text: 'Gemini 2.5 Pro' },
  ];

  models.forEach(model => {
      const option = document.createElement('option');
      option.value = model.value;
      option.textContent = model.text;
      modelSelect.appendChild(option);
  });
  
  modelSelect.value = 'gemini-2.5-flash'; // Set a default
  modelSelect.disabled = false;
};


// --- AI Client & App Initialization ---
const initializeAiClient = async () => {
    try {
        ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        populateModels();
        setAppDisabled(false);
        outputPrompt.placeholder = "Optimized prompt will appear here...";
        outputPrompt.value = '';
    } catch (error) {
        console.error("Failed to initialize GoogleGenAI:", error);
        outputPrompt.value = "Failed to initialize AI Client. Please ensure the API Key is configured correctly in the environment.";
        setAppDisabled(true);
    }
};

const initializeApp = async () => {
    loadHistory();
    createParticles();
    
    if (!process.env.API_KEY) {
        outputPrompt.placeholder = "API Key is not configured. Please set the API_KEY environment variable.";
        outputPrompt.value = "API Key is not configured. Please set the API_KEY environment variable.";
        modelSelect.innerHTML = '<option>API Key required</option>';
        setAppDisabled(true);
    } else {
       await initializeAiClient();
       loadStateFromLocalStorage();
       setInterval(saveStateToLocalStorage, 2500); // Auto-save every 2.5 seconds
    }
};

initializeApp();
