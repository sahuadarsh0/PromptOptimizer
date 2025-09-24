<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Prompt Optimizer

A web-based application that helps you optimize prompts for AI language models using Google's Gemini AI. Refine your prompts to get better, more accurate, and more effective responses from AI systems across various domains.

## Features

- **Model Selection**: Choose from multiple Gemini models including Gemini 2.5 Flash, 2.5 Flash Lite, 2.0 Flash, and more
- **Optimization Goals**: Tailor prompts for different purposes:
  - Standard Prompt: General-purpose optimization
  - Reasoning Prompt: Enhanced for complex problem-solving and logical thinking
  - Efficient Coding: Optimized for programming tasks with focus on readability and performance
  - Creative Writing: Enhanced for engaging, evocative content with tone selection
- **Advanced Frameworks**: Use structured prompt engineering frameworks like RACE, CARE, APE, CREATE, TAG, CREO, RISE, PAIN, COAST, and ROSES
- **Prompt History**: Local storage of recent prompts with easy reuse and management
- **API Key Management**: Secure session-based storage of your Gemini API key
- **Responsive Design**: Modern UI built with Tailwind CSS and animated particle background

## Technologies

- **Frontend**: TypeScript, HTML5
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **AI Integration**: Google Generative AI (@google/genai)
- **Deployment**: Static web app, deployable to any web server

## Prerequisites

- Node.js (version 16 or higher)
- A Google Gemini API key (get one for free from [Google AI Studio](https://aistudio.google.com/app/apikey))

## Installation and Setup

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd prompt-optimizer
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Set up your API key**:
   - Create a `.env.local` file in the root directory
   - Add your Gemini API key:
     ```
     GEMINI_API_KEY=your_api_key_here
     ```
   - Alternatively, you can enter the API key directly in the app's settings modal when prompted

4. **Run the development server**:
   ```bash
   npm run dev
   ```

5. **Open your browser** and navigate to `http://localhost:5173`

## Build for Production

```bash
npm run build
```

The built files will be in the `dist` directory, ready for deployment to any static hosting service.

## Preview Production Build

```bash
npm run preview
```

## Usage

1. Enter your prompt in the input field
2. Select your preferred Gemini model
3. Choose an optimization goal or enable advanced framework mode
4. Click "Optimize" to generate an enhanced prompt
5. Copy the optimized prompt using the copy button
6. Access your prompt history to reuse previous prompts

## API Key Setup

Your Gemini API key is stored locally in your browser's session storage and is never sent to external servers. To get your API key:

1. Visit [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Sign in with your Google account
3. Create a new API key
4. Copy the key and paste it into the app when prompted

## License

This project is licensed under the Apache License 2.0 - see the [LICENSE](LICENSE) file for details.
