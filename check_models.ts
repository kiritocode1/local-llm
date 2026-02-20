import { WEBLLM_MODELS } from './src/models.ts';
import { prebuiltAppConfig } from '@mlc-ai/web-llm';

const mlc_list = prebuiltAppConfig.model_list.map(m => m.model_id);
for (const [key, id] of Object.entries(WEBLLM_MODELS)) {
  if (!mlc_list.includes(id)) {
    console.log("WEBLLM MISSING:", key, id);
  }
}
