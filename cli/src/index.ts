#!/usr/bin/env node

import { Command } from 'commander';
import { HybridJobState } from '@hybrid-thinking/common-types';
import * as fs from 'fs/promises';
import { io } from 'socket.io-client';

const program = new Command();

program
  .name('hybrid-thinking')
  .description('Intelligence orchestration CLI')
  .version('1.0.0');

program
  .command('run')
  .description('Run a hybrid prompt across multiple models via the API Gateway')
  .requiredOption('-p, --prompt <prompt>', 'The prompt to execute')
  .option('-m, --models <models>', 'Comma-separated list of models', 'claude-sonnet,gemini-pro')
  .option('-o, --output <file>', 'Output file (markdown format)')
  .action(async (options) => {
    const models = options.models.split(',').map((m: string) => m.trim());
    const socket = io('ws://localhost:4000');

    let finalJobState: HybridJobState | null = null;

    socket.on('connect', () => {
      console.log('Connected to API Gateway...');
      console.log(`Running hybrid prompt across: ${models.join(', ')}`);
      console.log(`Prompt: ${options.prompt}\n`);
      
      socket.emit('job:run:prompt', {
        userId: 'cli-user',
        promptText: options.prompt,
        requestedModels: models,
      });
    });

    socket.on('job:model:result', (payload) => {
      console.log(`\n--- RESULT FROM: ${payload.modelId} ---`);
      console.log(payload.response.content);
      console.log('--------------------------------------\n');
    });

    socket.on('job:completed', async (payload) => {
      console.log('\n=== JOB COMPLETED ===');
      finalJobState = payload.finalState;
      
      if (finalJobState?.synthesisResult && 'content' in finalJobState.synthesisResult) {
        console.log('\n## SYNTHESIS');
        console.log(finalJobState.synthesisResult.content);
      }

      if (options.output && finalJobState) {
        const markdown = generateMarkdownOutput(finalJobState);
        await fs.writeFile(options.output, markdown);
        console.log(`\nOutput saved to: ${options.output}`);
      }
      
      socket.disconnect();
    });

    socket.on('job:synthesis_error', (err) => {
      console.error('\n[ERROR] Synthesis failed:', err);
      socket.disconnect();
      process.exit(1);
    });

    socket.on('disconnect', () => {
      console.log('Disconnected from API Gateway.');
    });
  });

program.parse();

function generateMarkdownOutput(job: HybridJobState): string {
  let output = `# Hybrid Thinking Results\n\n`;
  output += `**Prompt:** ${job.promptText}\n\n`;
  output += `**Models:** ${job.requestedModels.join(', ')}\n\n`;
  output += `**Generated:** ${job.createdAt}\n\n`;
  output += `## Individual Model Results\n\n`;

  for (const [modelId, result] of Object.entries(job.results)) {
    if (result && 'content' in result) {
      output += `### ${modelId}\n\n${result.content}\n\n`;
    } else if (result && 'error' in result) {
      output += `### ${modelId}\n\n**Error:** ${result.error}\n\n`;
    }
  }

  if (job.synthesisResult && 'content' in job.synthesisResult) {
    output += `## Synthesis\n\n${job.synthesisResult.content}\n\n`;
  } else if (job.synthesisResult && 'error' in job.synthesisResult) {
    output += `## Synthesis\n\n**Error:** ${job.synthesisResult.error}\n\n`;
  }
  
  return output;
}
