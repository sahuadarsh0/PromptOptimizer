
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { GoogleGenAI, LiveServerMessage, Modality, Blob } from "@google/genai";

// --- DOM Elements ---
const inputPrompt = document.getElementById('input-prompt') as HTMLTextAreaElement;
const negativePrompt = document.getElementById('negative-prompt') as HTMLTextAreaElement;
const outputPrompt = document.getElementById('output-prompt') as HTMLTextAreaElement;
const optimizeButton = document.getElementById('optimize-button') as HTMLButtonElement;
const stopButton = document.getElementById('stop-button') as HTMLButtonElement;
const copyButton = document.getElementById('copy-button') as HTMLButtonElement;
const copyText = document.getElementById('copy-text') as HTMLSpanElement;
const loaderOverlay = document.getElementById('loader-overlay') as HTMLDivElement;
const loaderText = document.getElementById('loader-text') as HTMLParagraphElement;

// Negative Prompt Toggle
const toggleNegBtn = document.getElementById('toggle-negative-prompt') as HTMLButtonElement;
const negContainer = document.getElementById('negative-prompt-container') as HTMLDivElement;
const chevronRight = document.getElementById('icon-chevron-right') as HTMLElement;
const chevronDown = document.getElementById('icon-chevron-down') as HTMLElement;

// Theme Toggle
const themeToggleBtn = document.getElementById('theme-toggle') as HTMLButtonElement;
const iconSun = document.getElementById('icon-sun') as unknown as SVGElement;
const iconMoon = document.getElementById('icon-moon') as unknown as SVGElement;

// Mic Elements
const micButton = document.getElementById('mic-button') as HTMLButtonElement;
const micIcon = document.getElementById('mic-icon') as unknown as SVGElement;
const stopMicIcon = document.getElementById('stop-mic-icon') as unknown as SVGElement;
const transcriptionBadge = document.getElementById('transcription-badge') as HTMLDivElement;

// Config Elements
const modelSelect = document.getElementById('model-select') as HTMLSelectElement;
const modelHint = document.getElementById('model-hint') as HTMLDivElement;
const toneSelect = document.getElementById('tone-select') as HTMLSelectElement;
const toneSection = document.getElementById('tone-section') as HTMLDivElement;
const strategyDesc = document.getElementById('strategy-desc') as HTMLSpanElement;

// New careful-revamp elements (added without touching Live voice code)
const quickActionsContainer = document.getElementById('quick-actions') as HTMLDivElement;
const quickActionStatus = document.getElementById('quick-action-status') as HTMLDivElement;
const useAsInputBtn = document.getElementById('use-as-input-btn') as HTMLButtonElement;

// Live metrics
const inputChars = document.getElementById('input-chars') as HTMLSpanElement;
const inputWords = document.getElementById('input-words') as HTMLSpanElement;
const inputTokens = document.getElementById('input-tokens') as HTMLSpanElement;
const outputCharsEl = document.getElementById('output-chars') as HTMLSpanElement;
const outputTokensEl = document.getElementById('output-tokens') as HTMLSpanElement;

// History Elements
const historyButton = document.getElementById('history-button') as HTMLButtonElement;
const historyModal = document.getElementById('history-modal') as HTMLDivElement;
const closeHistoryBtn = document.getElementById('close-history') as HTMLButtonElement;
const historyContent = document.getElementById('history-content') as HTMLDivElement;
const clearHistoryBtn = document.getElementById('clear-history') as HTMLButtonElement;

// API Key Modal Elements
const apikeyModal = document.getElementById('apikey-modal') as HTMLDivElement;
const apikeyInput = document.getElementById('api-key-input') as HTMLInputElement;
const saveApikeyBtn = document.getElementById('save-apikey-btn') as HTMLButtonElement;
const apikeyError = document.getElementById('apikey-error') as HTMLDivElement;
const saveBtnText = document.getElementById('save-btn-text') as HTMLSpanElement;
const saveBtnSpinner = document.getElementById('save-btn-spinner') as HTMLDivElement;
const apikeyBtn = document.getElementById('apikey-btn') as HTMLButtonElement;
const cancelApikeyBtn = document.getElementById('cancel-apikey-btn') as HTMLButtonElement;

// --- State ---
const HISTORY_KEY = 'promptOptimizerHistory';
const THEME_KEY = 'promptOptimizerTheme';
const API_KEY_STORAGE = 'gemini_api_key_custom'; // LocalStorage Key for BYOK

let promptHistory: string[] = [];
let isGenerating = false;
let isCancelled = false;
let ai: GoogleGenAI | null = null;
let currentStrategy = 'general'; // Default

// STT / Audio State
let isRecording = false;
let sessionPromise: Promise<any> | null = null;
let mediaStream: MediaStream | null = null;
let inputAudioContext: AudioContext | null = null;
let scriptProcessor: ScriptProcessorNode | null = null;
let analyser: AnalyserNode | null = null;
let visualizerFrame: number | null = null;
let accumulatedTranscript = '';
let lastPolishedTranscript = ''; // Track what we've already polished
let loaderInterval: number | null = null;
let polishTimeout: number | null = null;

// --- Initialization ---
const initializeApp = async () => {
    loadHistory();
    setupTheme();
    setupStrategySelection();
    initBackgroundEffects();
    
    // Check for saved API Key in LocalStorage
    const savedKey = localStorage.getItem(API_KEY_STORAGE);
    if (savedKey) {
        // If key exists, initialize AI
        initAIClient(savedKey);
    } else {
        // If no key, show modal
        apikeyModal.classList.remove('hidden');
        cancelApikeyBtn.classList.add('hidden'); // Cannot cancel if no key
    }
};

const initAIClient = (key: string) => {
    try {
        ai = new GoogleGenAI({ apiKey: key });
        populateModels();
        apikeyModal.classList.add('hidden');
        optimizeButton.disabled = false;

        // Now that we have a working client, enable the Quick Actions (malleable prompt widgets)
        // and let "Use as input" be controlled by whether there's currently an output.
        if (quickActionsContainer) {
            quickActionsContainer.querySelectorAll('button').forEach((b: any) => b.disabled = false);
        }
        if (useAsInputBtn) {
            useAsInputBtn.disabled = !outputPrompt || !outputPrompt.value.trim();
        }
    } catch (e) {
        console.error(e);
        localStorage.removeItem(API_KEY_STORAGE);
        apikeyModal.classList.remove('hidden');
        cancelApikeyBtn.classList.add('hidden');
        apikeyError.textContent = "Stored key was invalid. Please enter a new one.";
        apikeyError.classList.remove('hidden');

        // Keep the prompt tools disabled while we don't have a valid client
        if (quickActionsContainer) {
            quickActionsContainer.querySelectorAll('button').forEach((b: any) => b.disabled = true);
        }
        if (useAsInputBtn) useAsInputBtn.disabled = true;
    }
};

const validateAndSaveKey = async () => {
    const key = apikeyInput.value.trim();
    if (!key) {
        apikeyError.textContent = "Please enter an API Key.";
        apikeyError.classList.remove('hidden');
        return;
    }

    // REGEX Check: Google API Keys usually start with AIza and are 39 chars long
    const keyRegex = /^AIza[0-9A-Za-z-_]{35}$/;
    if (!keyRegex.test(key)) {
         apikeyError.textContent = "Invalid Format. Keys typically start with 'AIza'.";
         apikeyError.classList.remove('hidden');
         return;
    }

    // UI Loading State
    apikeyError.classList.add('hidden');
    saveBtnText.textContent = "Verifying...";
    saveBtnSpinner.classList.remove('hidden');
    saveApikeyBtn.disabled = true;

    try {
        // Create a temp client to test the key
        const tempAI = new GoogleGenAI({ apiKey: key });
        
        console.log("Validating API Key...");
        
        // Use a strict, structured request to validate.
        // We look for any valid response text.
        const response = await tempAI.models.generateContent({
            model: 'gemini-3.5-flash',
            contents: { parts: [{ text: 'Reply with "ok"' }] }
        });

        // Double check we actually got a response structure
        if (!response || !response.text) {
             throw new Error("API returned no content. Key might be invalid.");
        }

        // If successful, save and init
        console.log("API Key validated successfully.");
        localStorage.setItem(API_KEY_STORAGE, key);
        initAIClient(key);
        
    } catch (e: any) {
        console.error("Validation Failed", e);
        apikeyError.classList.remove('hidden');
        
        // Better Error Messages
        let msg = "Validation failed. Please check your key.";
        if (e.message) {
            if (e.message.includes('403') || e.message.includes('400') || e.message.includes('API key not valid')) {
                msg = "Invalid API Key. Please verify permissions in Google AI Studio.";
            } else if (e.message.includes('NetworkError') || e.message.includes('Failed to fetch')) {
                msg = "Network Error. Please check your connection.";
            } else {
                msg = `Error: ${e.message}`;
            }
        }
        apikeyError.textContent = msg;
    } finally {
        saveBtnText.textContent = "Verify & Save Key";
        saveBtnSpinner.classList.add('hidden');
        saveApikeyBtn.disabled = false;
    }
};

const populateModels = () => {
    modelSelect.innerHTML = '';
    // Updated to current recommended Gemini models (June 2026).
    // Voice / Live transcription continues to use its own proven working model string below.
    const models = [
        { value: 'gemini-3.5-flash', text: 'Gemini 3.5 Flash', hint: 'Fast • Excellent quality' },
        { value: 'gemini-2.5-pro', text: 'Gemini 2.5 Pro', hint: 'Best reasoning & depth' },
        { value: 'gemini-2.5-flash', text: 'Gemini 2.5 Flash', hint: 'Balanced speed & power' },
        { value: 'gemini-3.1-flash-lite', text: 'Gemini 3.1 Flash Lite', hint: 'Ultra fast & efficient' },
    ];
    models.forEach(m => {
        const opt = document.createElement('option');
        opt.value = m.value;
        opt.textContent = m.text;
        if (m.hint) opt.dataset.hint = m.hint;
        modelSelect.appendChild(opt);
    });
    syncModelHint();
    modelSelect.addEventListener('change', syncModelHint);
};

const syncModelHint = () => {
    if (!modelHint || !modelSelect) return;
    const selected = modelSelect.selectedOptions[0];
    modelHint.textContent = selected?.dataset.hint || '';
    modelHint.style.opacity = selected?.dataset.hint ? '0.85' : '0.4';
};

// --- Theme Logic ---
const setupTheme = () => {
    const savedTheme = localStorage.getItem(THEME_KEY);
    // Default to dark (null) or 'dark'. Check if 'light' is saved.
    if (savedTheme === 'light') {
        enableLightMode();
    } else {
        enableDarkMode();
    }
};

const enableLightMode = () => {
    document.body.classList.add('light-theme');
    iconSun.classList.add('hidden');
    iconMoon.classList.remove('hidden');
    localStorage.setItem(THEME_KEY, 'light');
};

const enableDarkMode = () => {
    document.body.classList.remove('light-theme');
    iconSun.classList.remove('hidden');
    iconMoon.classList.add('hidden');
    localStorage.setItem(THEME_KEY, 'dark');
};

themeToggleBtn.addEventListener('click', () => {
    if (document.body.classList.contains('light-theme')) {
        enableDarkMode();
    } else {
        enableLightMode();
    }
});


// --- Background Effects (Stars & Comets) ---
const initBackgroundEffects = () => {
    initStars();
    initComets();
};

const initStars = () => {
    const starContainer = document.getElementById('star-container');
    if (!starContainer) return;

    // Generate static twinkling stars
    const starCount = 100;
    
    for (let i = 0; i < starCount; i++) {
        const star = document.createElement('div');
        star.classList.add('star');
        
        // Random Position
        const x = Math.random() * 100;
        const y = Math.random() * 100;
        
        // Random Size (Tiny)
        const size = Math.random() * 2 + 1; // 1px to 3px
        
        // Random Animation Params
        const duration = Math.random() * 3 + 2; // 2s to 5s
        const delay = Math.random() * 5; 
        const opacity = Math.random() * 0.7 + 0.3;

        star.style.left = `${x}%`;
        star.style.top = `${y}%`;
        star.style.width = `${size}px`;
        star.style.height = `${size}px`;
        star.style.setProperty('--duration', `${duration}s`);
        star.style.setProperty('--delay', `${delay}s`);
        star.style.setProperty('--opacity', `${opacity}`);
        
        starContainer.appendChild(star);
    }
};

const initComets = () => {
    const cometContainer = document.getElementById('comet-container');
    if (!cometContainer) return;

    const spawnComet = () => {
        const comet = document.createElement('div');
        comet.classList.add('comet');
        
        // --- Minimalist / Galactic Spawn Logic ---
        // Spawn Area: Top-Right Quadrant to Center
        // Start X: Between 40% and 120% width (offscreen right)
        const startX = 40 + Math.random() * 80;
        // Start Y: Between -20% and 40% height
        const startY = -20 - Math.random() * 60;
        
        // Random Properties - SUBTLE
        const size = 1 + Math.random() * 2; // Smaller size (1-3px)
        const tailLength = 80 + Math.random() * 150; // Shorter tails
        const duration = 3 + Math.random() * 4; // Slower: 3s to 7s
        const opacity = 0.3 + Math.random() * 0.5; // Max 0.8 opacity

        comet.style.setProperty('--x-start', `${startX}vw`);
        comet.style.setProperty('--y-start', `${startY}vh`);
        comet.style.setProperty('--size', `${size}px`);
        comet.style.setProperty('--tail-length', `${tailLength}px`);
        comet.style.setProperty('--duration', `${duration}s`);
        comet.style.setProperty('--opacity', `${opacity}`);

        cometContainer.appendChild(comet);

        // Remove after animation completes
        setTimeout(() => {
            if (comet.parentNode === cometContainer) {
                cometContainer.removeChild(comet);
            }
        }, duration * 1000 + 100);

        // Spawn Interval - Minimal/Rare
        const nextDelay = Math.random() * 5000 + 3000; // 3 to 8 seconds delay
        setTimeout(spawnComet, nextDelay);
    };

    // Initial single start
    setTimeout(spawnComet, 1000);
};

// --- Strategy Selection UI ---
const setupStrategySelection = () => {
    const cards = document.querySelectorAll('.strategy-card');
    cards.forEach(card => {
        card.addEventListener('click', () => {
            // Remove active from all
            cards.forEach(c => c.classList.remove('active'));
            // Add active to clicked
            card.classList.add('active');
            
            currentStrategy = (card as HTMLElement).dataset.value || 'general';
            const desc = (card as HTMLElement).dataset.desc || '';
            
            // Update UI Desc
            strategyDesc.textContent = desc;
            strategyDesc.classList.remove('opacity-0');

            // Show tone select only if writing
            if (currentStrategy === 'writing') {
                toneSection.classList.remove('hidden');
            } else {
                toneSection.classList.add('hidden');
            }
        });
    });
};

// --- Negative Prompt Toggle ---
toggleNegBtn.addEventListener('click', () => {
    const isHidden = negContainer.classList.contains('hidden');
    if(isHidden) {
        negContainer.classList.remove('hidden');
        chevronRight.classList.add('hidden');
        chevronDown.classList.remove('hidden');
    } else {
        negContainer.classList.add('hidden');
        chevronRight.classList.remove('hidden');
        chevronDown.classList.add('hidden');
    }
});

// --- Loading Text Animation ---
const cycleLoaderText = () => {
    const steps = [
        "Analyzing prompt intent...",
        "Identifying key constraints...",
        "Applying optimization framework...",
        "Refining structure and tone...",
        "Polishing final output..."
    ];
    let stepIndex = 0;
    
    loaderText.textContent = steps[0];
    
    if (loaderInterval) clearInterval(loaderInterval);
    
    loaderInterval = window.setInterval(() => {
        stepIndex = (stepIndex + 1) % steps.length;
        loaderText.textContent = steps[stepIndex];
    }, 2000);
};

// --- Core Optimization Logic ---
const optimizePrompt = async () => {
    if (!ai) return;

    const userPrompt = inputPrompt.value.trim();
    // Only check negative prompt if visible
    let negPrompt = '';
    if(!negContainer.classList.contains('hidden')) {
        negPrompt = negativePrompt.value.trim();
    }

    if (!userPrompt) {
        outputPrompt.value = "Please enter a prompt first.";
        return;
    }

    saveHistory(userPrompt);
    setLoading(true);
    cycleLoaderText();
    outputPrompt.value = '';

    const modelName = modelSelect.value;
    const isReasoning = currentStrategy === 'reasoning';

    // Construct System Instruction based on Strategy
    let systemInstruction = `You are a world-class prompt engineer. Your goal is to rewrite the user's input into a highly effective, structured, and clear prompt for a Large Language Model. Retain the core intent but maximize clarity and adherence to the chosen structure. Output ONLY the optimized prompt.`;

    // Strategy Switching
    switch(currentStrategy) {
        case 'reasoning':
            systemInstruction += ` USE THE "CHAIN OF THOUGHT" TECHNIQUE. Explicitly ask the model to "think step-by-step", break down the problem, and explain its reasoning before giving the final answer.`;
            break;
        case 'coding':
            systemInstruction += ` OPTIMIZE FOR CODING. The prompt should ask for clean, efficient, modern code, including comments and error handling. Specify the language if implied.`;
            break;
        case 'writing':
            const tone = toneSelect.value;
            systemInstruction += ` OPTIMIZE FOR CREATIVE WRITING. Focus on evocative language, sensory details, and narrative flow. Tone: ${tone}.`;
            break;
        case 'race':
            systemInstruction += ` USE THE 'RACE' FRAMEWORK: Role (Who is the AI?), Action (What to do?), Context (Background info), Explanation (Why/How?).`;
            break;
        case 'care':
            systemInstruction += ` USE THE 'CARE' FRAMEWORK: Context, Action, Result, Example.`;
            break;
        case 'ape':
             systemInstruction += ` USE THE 'APE' FRAMEWORK: Action, Purpose, Execution.`;
             break;
        case 'coast':
             systemInstruction += ` USE THE 'COAST' FRAMEWORK: Context, Objective, Actions, Scenario, Task.`;
             break;
        case 'rise':
             systemInstruction += ` USE THE 'RISE' FRAMEWORK: Role, Input, Steps, Execution.`;
             break;
        case 'pain':
             systemInstruction += ` USE THE 'PAIN' FRAMEWORK: Problem, Action, Information, Next Steps.`;
             break;
        default: // General
            systemInstruction += ` Make the prompt direct, remove ambiguity, and structure it logically.`;
            break;
    }

    if (negPrompt) {
        systemInstruction += `\n\nCONSTRAINT: The prompt MUST include a negative constraint section forbidding: "${negPrompt}".`;
    }

    try {
        // Dynamic Config
        const config: any = {
            systemInstruction: systemInstruction,
        };

        // Inject Thinking Config if Reasoning is selected.
        if (isReasoning) {
            // Adjust budget based on model capability
            const budget = modelName.includes('pro') ? 16384 : 8192;
            config.thinkingConfig = { thinkingBudget: budget }; 
            // Override loader text for Thinking mode
            if(loaderInterval) clearInterval(loaderInterval);
            loaderText.textContent = `Thinking Deeply (Budget: ${budget})...`;
        }

        const response = await ai.models.generateContent({
            model: modelName,
            contents: userPrompt, // Use simple string payload
            config: config
        });

        if (!isCancelled) {
            outputPrompt.value = response.text || "No response generated.";
            updateOutputMetrics();
            if (useAsInputBtn) useAsInputBtn.disabled = false;
        } else {
            outputPrompt.value = "Stopped.";
        }

    } catch (e: any) {
        console.error(e);
        let errorMsg = "Error during optimization.";
        if (e.message?.includes("NetworkError") || e.message?.includes("fetch")) {
            errorMsg = "Network Error: Please check your internet connection or API Key.";
        } else if (e.message) {
            errorMsg = `Error: ${e.message}`;
        }
        outputPrompt.value = errorMsg;
    } finally {
        setLoading(false);
        isCancelled = false;
        if(loaderInterval) clearInterval(loaderInterval);
    }
};

const setLoading = (loading: boolean) => {
    isGenerating = loading;
    if (loading) {
        loaderOverlay.classList.remove('hidden');
        optimizeButton.classList.add('hidden');
        stopButton.classList.remove('hidden');
        inputPrompt.disabled = true;
        if (useAsInputBtn) useAsInputBtn.disabled = true;
    } else {
        loaderOverlay.classList.add('hidden');
        optimizeButton.classList.remove('hidden');
        stopButton.classList.add('hidden');
        inputPrompt.disabled = false;
        copyButton.disabled = false;
        if (useAsInputBtn) useAsInputBtn.disabled = !outputPrompt || !outputPrompt.value.trim();
        updateOutputMetrics();
    }
};

// --- Audio / Visualizer Logic ---

function setupAudioVisualizer(stream: MediaStream) {
    if (!inputAudioContext) return;
    analyser = inputAudioContext.createAnalyser();
    analyser.fftSize = 32; // Small size for performance
    const source = inputAudioContext.createMediaStreamSource(stream);
    source.connect(analyser); // Only connect to analyser, not destination
    
    updateMicVisualizer();
}

function updateMicVisualizer() {
    if (!analyser || !isRecording) {
        if(visualizerFrame) cancelAnimationFrame(visualizerFrame);
        // Reset mic style
        micButton.style.removeProperty('--audio-level');
        return;
    }

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyser.getByteFrequencyData(dataArray);

    // Calculate average volume
    let sum = 0;
    for(let i = 0; i < bufferLength; i++) {
        sum += dataArray[i];
    }
    const average = sum / bufferLength;
    
    // Normalize to 0-1 range (approximate max 255)
    // Add a slight multiplier to make it more reactive
    const normalizedLevel = Math.min(1, (average / 255) * 2.5);

    // Set CSS variable on the button
    micButton.style.setProperty('--audio-level', normalizedLevel.toString());

    visualizerFrame = requestAnimationFrame(updateMicVisualizer);
}

// --- Live API STT ---

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

const toggleRecording = async () => {
    if (isRecording) {
        stopRecording();
    } else {
        startRecording();
    }
}

// Shared Polish Function (Used for Intermediate and Final)
const performPolish = async (isIntermediate = false) => {
    if (!ai || accumulatedTranscript.length < 5) return;

    // Redundancy Check: capture the transcript we are about to polish
    const currentTranscript = accumulatedTranscript;
    
    // UI Feedback
    transcriptionBadge.textContent = isIntermediate ? "Refining..." : "Polishing...";
    transcriptionBadge.classList.remove('hidden');
    
    try {
        const polishResponse = await ai.models.generateContent({
            model: 'gemini-3.5-flash',
            contents: currentTranscript,
            config: {
                systemInstruction: `You are a translator and grammar expert. The user has just dictated a prompt via voice. 
                1. Detect the language. 
                2. If not English, translate to English.
                3. Fix any transcription errors, stuttering, or grammar mistakes.
                4. **FORMATTING RULE**: If the input contains a numbered sequence, multiple steps, or list-like items, format the output as a bulleted list. Otherwise, output a clean, standard paragraph.
                5. Output ONLY the clean, final English text.`
            }
        });
        
        // Update input only if we have a valid response
        if(polishResponse.text) {
             inputPrompt.value = polishResponse.text.trim();
             updateInputMetrics();
             // Mark this content as polished so we don't redo it immediately
             lastPolishedTranscript = currentTranscript;
        }
    } catch(e) {
        console.warn("Polish failed", e);
    } finally {
        // Reset UI if intermediate, logic handles final cleanup separately
        if (isIntermediate) {
            transcriptionBadge.textContent = "Live Translation Active";
        }
    }
};

const startRecording = async () => {
    if (!ai) return;
    isRecording = true;
    updateMicUI(true);
    accumulatedTranscript = '';
    lastPolishedTranscript = ''; // Reset on new session
    inputPrompt.placeholder = "Listening...";
    // Disable enhance button while recording
    optimizeButton.disabled = true;
    
    try {
        mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
        
        // Setup Button Visualizer
        setupAudioVisualizer(mediaStream);

        // Connect Live API
        sessionPromise = ai.live.connect({
            model: 'gemini-2.5-flash-native-audio-preview-12-2025',
            callbacks: {
                onopen: () => {
                    // CRITICAL FIX: Check if context and stream still exist.
                    if (!inputAudioContext || !mediaStream || !isRecording) return;

                    const source = inputAudioContext.createMediaStreamSource(mediaStream);
                    scriptProcessor = inputAudioContext.createScriptProcessor(4096, 1, 1);
                    scriptProcessor.onaudioprocess = (e) => {
                        if(!isRecording) return;
                        const inputData = e.inputBuffer.getChannelData(0);
                        const pcmBlob = createBlob(inputData);
                        sessionPromise?.then(session => session.sendRealtimeInput({ media: pcmBlob }));
                    };
                    source.connect(scriptProcessor);
                    scriptProcessor.connect(inputAudioContext.destination);
                },
                onmessage: (msg: LiveServerMessage) => {
                    // Real-time transcription display
                    if(msg.serverContent?.inputTranscription?.text) {
                        const chunk = msg.serverContent.inputTranscription.text;
                        accumulatedTranscript += chunk;
                        inputPrompt.value = accumulatedTranscript;
                        // Auto scroll
                        inputPrompt.scrollTop = inputPrompt.scrollHeight;

                        // Intermediate Polish Logic
                        if (polishTimeout) window.clearTimeout(polishTimeout);
                        polishTimeout = window.setTimeout(() => performPolish(true), 1500); // 1.5s silence triggers polish
                    }
                },
                onerror: (e) => console.error(e),
                onclose: () => console.log('Session closed')
            },
            config: {
                // We only want transcription, no audio response needed really, 
                // but we must set modality.
                responseModalities: [Modality.AUDIO], 
                inputAudioTranscription: {}, // Enable STT with default settings
            }
        });

    } catch (e) {
        console.error("Mic error", e);
        stopRecording();
    }
};

const stopRecording = async () => {
    isRecording = false;
    updateMicUI(false);
    
    // Clear any pending intermediate polish
    if (polishTimeout) {
        window.clearTimeout(polishTimeout);
        polishTimeout = null;
    }
    
    // Cleanup Audio
    if(scriptProcessor) {
        scriptProcessor.disconnect();
        scriptProcessor = null;
    }
    if(mediaStream) {
        mediaStream.getTracks().forEach(t => t.stop());
        mediaStream = null;
    }
    if(sessionPromise) {
        sessionPromise.then(s => s.close());
        sessionPromise = null;
    }
    if(inputAudioContext) {
        inputAudioContext.close();
        inputAudioContext = null;
    }

    // Final Polish Step
    // CHECK: Only polish if the current transcript is different from the last one we polished
    if (accumulatedTranscript.length > 0 && accumulatedTranscript !== lastPolishedTranscript) {
        await performPolish(false);
    } 
    
    transcriptionBadge.classList.add('hidden');
    transcriptionBadge.textContent = "Live Translation Active";
    optimizeButton.disabled = false;
};

const updateMicUI = (active: boolean) => {
    if (active) {
        micIcon.classList.add('hidden');
        stopMicIcon.classList.remove('hidden');
        micButton.classList.add('mic-visualizer-active');
        transcriptionBadge.classList.remove('hidden');
        // Disable new prompt-editing controls while recording (safe addition)
        if (quickActionsContainer) quickActionsContainer.querySelectorAll('button').forEach((b: any) => b.disabled = true);
        if (useAsInputBtn) useAsInputBtn.disabled = true;
    } else {
        micIcon.classList.remove('hidden');
        stopMicIcon.classList.add('hidden');
        micButton.classList.remove('mic-visualizer-active');
        // Do not hide badge immediately if polishing is about to start, handled in stopRecording
        if(!isRecording && accumulatedTranscript.length < 5) {
             transcriptionBadge.classList.add('hidden');
        }
        // Re-enable new controls when not recording
        if (quickActionsContainer) quickActionsContainer.querySelectorAll('button').forEach((b: any) => b.disabled = false);
        if (useAsInputBtn) useAsInputBtn.disabled = !outputPrompt || !outputPrompt.value.trim();
    }
};

// --- Careful 2026 Revamp: Prompt metrics + Malleable Quick Actions ---
// These features were added on top of the proven voice code without modifying startRecording / stopRecording / live callbacks.

const QUICK_TWEAKS: Record<string, { label: string; instruction: string }> = {
    concise: { label: 'More concise', instruction: 'Rewrite the prompt to be significantly more concise while preserving every critical detail and intent. Remove fluff.' },
    specific: { label: 'Add specificity', instruction: 'Make the prompt dramatically more specific: add concrete constraints, success criteria, edge cases, and desired output characteristics.' },
    cot: { label: 'Add chain-of-thought', instruction: 'Augment the prompt so the target model must think step-by-step, show explicit reasoning, and only then give the final answer. Keep the original goal intact.' },
    schema: { label: 'Add output schema', instruction: 'Add a clear, structured output format requirement (JSON, markdown table, or numbered steps) that matches the apparent goal of the prompt.' },
    expert: { label: 'Expert persona', instruction: 'Inject a world-class expert persona and domain authority into the prompt. The model should act as the leading specialist in the relevant field.' },
    examples: { label: 'Add examples', instruction: 'Enhance the prompt with 1-3 high-quality, relevant few-shot examples that illustrate exactly the desired behavior and output style.' },
};

function updateInputMetrics() {
    if (!inputChars || !inputPrompt) return;
    const val = inputPrompt.value || '';
    const chars = val.length;
    const words = val.trim() ? val.trim().split(/\s+/).length : 0;
    const tokens = Math.max(1, Math.round(chars / 3.8));
    inputChars.textContent = chars.toLocaleString();
    if (inputWords) inputWords.textContent = words.toLocaleString();
    if (inputTokens) inputTokens.textContent = tokens.toLocaleString();
}

function updateOutputMetrics() {
    if (!outputCharsEl || !outputPrompt) return;
    const val = outputPrompt.value || '';
    const chars = val.length;
    const tokens = Math.max(1, Math.round(chars / 3.8));
    outputCharsEl.textContent = chars.toLocaleString();
    if (outputTokensEl) outputTokensEl.textContent = tokens.toLocaleString();
}

async function applyQuickTweak(tweakKey: string) {
    // Give clear visible feedback instead of silent return — this was the main cause of "click does nothing".
    if (!ai) {
        if (quickActionStatus) {
            quickActionStatus.textContent = 'Enter your API key first';
            setTimeout(() => { if (quickActionStatus) quickActionStatus.textContent = ''; }, 1600);
        }
        return;
    }
    if (!inputPrompt || !inputPrompt.value.trim()) {
        if (quickActionStatus) {
            quickActionStatus.textContent = 'Type a prompt in the box first';
            setTimeout(() => { if (quickActionStatus) quickActionStatus.textContent = ''; }, 1600);
        }
        return;
    }
    if (isRecording) return;

    const tweak = QUICK_TWEAKS[tweakKey];
    if (!tweak || !quickActionStatus) return;

    const original = inputPrompt.value;
    quickActionStatus.textContent = `Applying: ${tweak.label.toLowerCase()}…`;

    // Temporarily disable chips
    if (quickActionsContainer) {
        quickActionsContainer.querySelectorAll('button').forEach((b: any) => b.disabled = true);
    }

    try {
        const chosenModel = modelSelect?.value || 'gemini-3.5-flash';
        const res = await ai.models.generateContent({
            model: chosenModel,
            contents: original,
            config: {
                systemInstruction: `You are an expert prompt engineer. ${tweak.instruction}\n\nReturn ONLY the rewritten prompt text. Do not add commentary, quotes, or explanations.`,
            }
        });

        if (res.text) {
            inputPrompt.value = res.text.trim();
            updateInputMetrics();
            if (quickActionStatus) {
                quickActionStatus.textContent = 'Done — prompt updated';
                setTimeout(() => {
                    if (quickActionStatus && quickActionStatus.textContent.includes('Done')) {
                        quickActionStatus.textContent = '';
                    }
                }, 1400);
            }
        } else {
            // Rare: model returned no text
            if (quickActionStatus) quickActionStatus.textContent = 'No change from model';
            setTimeout(() => { if (quickActionStatus) quickActionStatus.textContent = ''; }, 1400);
        }
    } catch (e) {
        console.warn('Quick tweak failed', e);
        if (quickActionStatus) {
            quickActionStatus.textContent = 'Tweak failed — check console or try a different model';
            setTimeout(() => { if (quickActionStatus) quickActionStatus.textContent = ''; }, 2200);
        }
    } finally {
        if (quickActionsContainer) {
            quickActionsContainer.querySelectorAll('button').forEach((b: any) => b.disabled = false);
        }
    }
}

// Wire quick actions (delegated, safe)
if (quickActionsContainer) {
    quickActionsContainer.addEventListener('click', (e) => {
        const btn = (e.target as HTMLElement).closest('button[data-tweak]') as HTMLButtonElement | null;
        if (btn && btn.dataset.tweak) {
            applyQuickTweak(btn.dataset.tweak);
        }
    });

    // Start with the prompt tools disabled. They only become usable once we have a valid AI client.
    // This prevents mysterious "click does nothing" before the user has entered/saved their key.
    quickActionsContainer.querySelectorAll('button').forEach((b: any) => b.disabled = true);
}

// Use optimized result back into input for iteration (core prompt-craft loop)
if (useAsInputBtn) {
    useAsInputBtn.addEventListener('click', () => {
        if (!outputPrompt || !outputPrompt.value.trim() || isRecording) return;
        inputPrompt.value = outputPrompt.value;
        updateInputMetrics();
        inputPrompt.scrollIntoView({ behavior: 'smooth', block: 'center' });
        inputPrompt.focus();
        // subtle flash
        inputPrompt.classList.add('!border-cyan-400/60');
        setTimeout(() => inputPrompt.classList.remove('!border-cyan-400/60'), 900);
    });
}

// Live metrics while typing
if (inputPrompt) {
    inputPrompt.addEventListener('input', updateInputMetrics);
}
if (outputPrompt) {
    outputPrompt.addEventListener('input', updateOutputMetrics);
}

// Initialize metrics shortly after boot
setTimeout(() => {
    updateInputMetrics();
    updateOutputMetrics();
}, 80);

// --- History Logic ---
const loadHistory = () => {
    const stored = localStorage.getItem(HISTORY_KEY);
    if(stored) promptHistory = JSON.parse(stored);
};

const saveHistory = (txt: string) => {
    promptHistory = promptHistory.filter(t => t !== txt);
    promptHistory.unshift(txt);
    if(promptHistory.length > 20) promptHistory.pop();
    localStorage.setItem(HISTORY_KEY, JSON.stringify(promptHistory));
};

const renderHistory = () => {
    historyContent.innerHTML = '';
    promptHistory.forEach(item => {
        const div = document.createElement('div');
        // Use custom class for theming instead of hardcoded tailwind colors
        div.className = 'history-item p-4 rounded-xl cursor-pointer mb-2 flex flex-col group';
        
        const text = document.createElement('p');
        text.className = 'line-clamp-2 text-sm pointer-events-none';
        text.textContent = item;
        
        div.appendChild(text);
        
        div.onclick = () => {
            inputPrompt.value = item;
            updateInputMetrics();
            historyModal.classList.add('hidden');
        };
        historyContent.appendChild(div);
    });
};

// --- Listeners ---
optimizeButton.addEventListener('click', optimizePrompt);
stopButton.addEventListener('click', () => isCancelled = true);
micButton.addEventListener('click', toggleRecording);

copyButton.addEventListener('click', () => {
    if(!outputPrompt.value) return;
    navigator.clipboard.writeText(outputPrompt.value);
    copyText.textContent = "Copied!";
    setTimeout(() => copyText.textContent = "Copy", 2000);
});

historyButton.addEventListener('click', () => {
    renderHistory();
    historyModal.classList.remove('hidden');
});
closeHistoryBtn.addEventListener('click', () => historyModal.classList.add('hidden'));
clearHistoryBtn.addEventListener('click', () => {
    promptHistory = [];
    localStorage.removeItem(HISTORY_KEY);
    renderHistory();
});

// API Key Listeners
saveApikeyBtn.addEventListener('click', validateAndSaveKey);
apikeyInput.addEventListener('keydown', (e) => {
    if(e.key === 'Enter') validateAndSaveKey();
});
apikeyBtn.addEventListener('click', () => {
    // Open Modal for editing
    apikeyModal.classList.remove('hidden');
    apikeyInput.value = ''; // Clear for security/new entry
    apikeyError.classList.add('hidden');
    cancelApikeyBtn.classList.remove('hidden'); // Allow cancelling since key exists
});
cancelApikeyBtn.addEventListener('click', () => {
    apikeyModal.classList.add('hidden');
});

// Start
initializeApp();
