#!/usr/bin/env node

// Use package entrypoints for imports
import { Command } from 'commander';
// Use package entrypoints for types only, import classes from built dist paths
import { HybridJobState } from '@hybrid-thinking/common-types';
import { WorkflowEngine, ClaudeAdapter, GeminiAdapter, ChatGPTBrowserAdapter } from '@hybrid-thinking/api-gateway';
import * as fs from 'fs/promises';

const program = new Command();

program
  .name('hybrid-thinking')
  .description('Intelligence orchestration CLI')
  .version('1.0.0');

program
  .command('run')
  .description('Run a hybrid prompt across multiple models')
  .requiredOption('-p, --prompt <prompt>', 'The prompt to execute')
  .option('-m, --models <models>', 'Comma-separated list of models', 'claude-sonnet,gemini-pro')
  .option('-o, --output <file>', 'Output file (markdown format)')
  .action(async (options) => {
    // Use a new Map for adapters
    const adapters = new Map();
    if (process.env.CLAUDE_API_KEY) {
      adapters.set('claude-sonnet', new ClaudeAdapter(process.env.CLAUDE_API_KEY));
    }
    if (process.env.GEMINI_API_KEY) {
      adapters.set('gemini-pro', new GeminiAdapter(process.env.GEMINI_API_KEY));
    }
    if (process.env.EXTENSION_ID) {
      adapters.set('chatgpt-browser', new ChatGPTBrowserAdapter(process.env.EXTENSION_ID));
    }
    const engine = new WorkflowEngine(adapters);

    const models = options.models.split(',').map((m: string) => m.trim());

    console.log(`Running hybrid prompt across: ${models.join(', ')}`);
    console.log(`Prompt: ${options.prompt}\n`);

    try {
      const job = await engine.runHybridPrompt('cli-user', options.prompt, models);

      // Output results
      console.log('=== RESULTS ===\n');
      for (const [modelId, result] of Object.entries(job.results)) {
        if (result) {
          console.log(`## ${modelId.toUpperCase()}`);
          console.log(result);
          console.log('\n---\n');
        }
      }
      if (job.synthesisResult) {
        console.log('## SYNTHESIS');
        console.log(job.synthesisResult);
      }
      // Save to file if requested
      if (options.output) {
        const markdown = generateMarkdownOutput(job);
        await fs.writeFile(options.output, markdown);
        console.log(`\nOutput saved to: ${options.output}`);
      }
    } catch (error: any) {
      console.error('Error:', error.message);
      process.exit(1);
    }
  });

program.parse();

function generateMarkdownOutput(job: HybridJobState): string {
  let output = `# Hybrid Thinking Results\n\n`;
  output += `**Prompt:** ${job.promptText}\n\n`;
  output += `**Models:** ${job.requestedModels.join(', ')}\n\n`;
  output += `**Generated:** ${job.createdAt}\n\n`;
  output += `## Individual Model Results\n\n`;
  for (const [modelId, result] of Object.entries(job.results)) {
    if (result) {
      output += `### ${modelId}\n\n${typeof result === 'string' ? result : JSON.stringify(result)}\n\n`;
    }
  }
  if (job.synthesisResult) {
    output += `## Synthesis\n\n${typeof job.synthesisResult === 'string' ? job.synthesisResult : JSON.stringify(job.synthesisResult)}\n\n`;
  }
  return output;
}
