## PHILOSOPHY 
This codebase will outlive you. Every shortcut becomes someone else's burden. Patterns you establish will be copied.
Corners you cut will be cut again.
Fight entropy. Leave the codebase better than you found it.

## Problem 
I want to make an easy , generalized library that allows a person to interact with llms in their current browser. this will be a client side solution that just works in any codebase. 

I want you to use  web-llm ,  onnx runtime solution and if that does not work then transformers.js. 

## Web llm textbook 
How to use LLM in Browser using WebLLM
The rise of large language models (LLMs) like GPT-4 and Llama has transformed the AI landscape, but most of these models run on powerful cloud servers. What if you could run an LLM directly in your browser without relying on external APIs? This is where WebLLM comes in.

What is WebLLM?
WebLLM is an open-source project that enables running large language models entirely in the browser using WebGPU. This means you can execute LLMs like Llama 3, Mistral, and Gemma locally on your machine without requiring API calls to external servers.
Jump to notebook

Why Use WebLLM?
🔒 Privacy

Since WebLLM runs on your device, no data is sent to external servers, making it ideal for privacy-conscious applications.

⚡ Low Latency

Because there’s no network request to an API, WebLLM provides near-instant responses compared to cloud-based models.

🌍 Offline Capability

WebLLM allows running AI-powered apps without an internet connection once the model is downloaded.

💰 Cost Savings

Since there’s no need for expensive API calls (like OpenAI or Hugging Face’s hosted models), WebLLM can significantly reduce costs for AI applications.

How Does WebLLM Work?
WebLLM leverages WebGPU, the next-gen browser graphics API, to run models efficiently on your GPU. It builds on MLC LLM, which compiles and optimizes models to run in the browser.

Supported Models

WebLLM currently supports:
✅ Llama 3 (Meta AI)
✅ Mistral (Open-weight LLM)
✅ Gemma (Google’s lightweight LLM)
✅ StableLM (Stability AI)

Getting Started with WebLLM
Jump to notebook

1️⃣ Add WebLLM to Your JavaScript Project

You can integrate WebLLM via a CDN or npm package:
```ts
<script type="module">
  import { init, chat } from 'https://cdn.jsdelivr.net/npm/webllm@latest';

  async function main() {
    const model = await init('Llama-3-8B');
    const response = await chat(model, 'What is WebLLM?');
    console.log(response);
  }

  main();
</script>
```
2️⃣ Running WebLLM in Scribbler (JavaScript Notebook)

If you prefer notebooks (like Jupyter but for JavaScript), you can try this in Scribbler:

window.default = await import('https://cdn.jsdelivr.net/npm/webllm@latest');
const model = await init('Mistral-7B');
const response = await chat(model, 'Explain quantum computing');
response;
3️⃣ Deploying a Chatbot with WebLLM

Want to build a chatbot with WebLLM? Here’s a minimal setup:
```tsx
<input id="prompt" placeholder="Ask me anything...">
<button onclick="runChat()">Send</button>
<p id="output"></p>

<script type="module">
  import { init, chat } from 'https://cdn.jsdelivr.net/npm/webllm@latest';
  let model;

  async function setup() {
    model = await init('Gemma-2B');
  }

  async function runChat() {
    const input = document.getElementById('prompt').value;
    const response = await chat(model, input);
    document.getElementById('output').innerText = response;
  }

  setup();
</script>
```
Performance Considerations

WebLLM requires a modern GPU and browser to run efficiently. It works best on:

Google Chrome (latest)
Edge (WebGPU enabled)
Firefox Nightly (WebGPU experimental)
For best performance, enable WebGPU in Chrome by visiting:

chrome://flags/#enable-webgpu


I have no information about the onnx runtime solution but i believe you can choose any huggingface. 


this solution should be easy to attach to inputs and  use streamdown to get an output to the webpage. 
