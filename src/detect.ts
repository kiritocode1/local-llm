/**
 * Browser capability detection utilities
 */

import type { BrowserCapabilities, Backend, Device } from './types';

/**
 * Check if WebGPU is available in the current browser
 */
export async function checkWebGPU(): Promise<boolean> {
  if (typeof navigator === 'undefined') return false;
  if (!('gpu' in navigator)) return false;

  try {
    const gpu = (navigator as unknown as { gpu: { requestAdapter(): Promise<unknown> } }).gpu;
    if (!gpu) return false;

    const adapter = await gpu.requestAdapter();
    return adapter !== null;
  } catch {
    return false;
  }
}

/**
 * Check if WebAssembly is available
 */
export function checkWasm(): boolean {
  if (typeof WebAssembly === 'undefined') return false;

  try {
    // Check for streaming compilation support
    return (
      typeof WebAssembly.instantiateStreaming === 'function' ||
      typeof WebAssembly.instantiate === 'function'
    );
  } catch {
    return false;
  }
}

/**
 * Detect browser capabilities and recommend backend/device
 */
export async function detectCapabilities(): Promise<BrowserCapabilities> {
  const webgpu = await checkWebGPU();
  const wasm = checkWasm();

  let recommendedBackend: Backend = 'webllm';
  let recommendedDevice: Device = 'webgpu';

  return {
    webgpu,
    wasm,
    recommendedBackend,
    recommendedDevice,
  };
}

/**
 * Log capability detection results to console
 */
export async function logCapabilities(): Promise<BrowserCapabilities> {
  const caps = await detectCapabilities();

  console.log('[LocalLLM] Browser Capabilities:');
  console.log(`  WebGPU: ${caps.webgpu ? '✓ supported' : '✗ not available'}`);
  console.log(`  WASM: ${caps.wasm ? '✓ supported' : '✗ not available'}`);
  console.log(`  Recommended backend: ${caps.recommendedBackend}`);
  console.log(`  Recommended device: ${caps.recommendedDevice}`);

  return caps;
}
