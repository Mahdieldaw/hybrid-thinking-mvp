#!/usr/bin/env node
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
// Use package entrypoints for imports
const commander_1 = require("commander");
const engine_1 = require("@hybrid-thinking/engine");
const fs = __importStar(require("fs/promises"));
const program = new commander_1.Command();
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
        adapters.set('claude-sonnet', new engine_1.ClaudeAdapter(process.env.CLAUDE_API_KEY));
    }
    if (process.env.GEMINI_API_KEY) {
        adapters.set('gemini-pro', new engine_1.GeminiAdapter(process.env.GEMINI_API_KEY));
    }
    if (process.env.EXTENSION_ID) {
        adapters.set('chatgpt-browser', new engine_1.ChatGPTBrowserAdapter(process.env.EXTENSION_ID));
    }
    const engine = new engine_1.WorkflowEngine(adapters);
    const models = options.models.split(',').map((m) => m.trim());
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
    }
    catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
});
program.parse();
function generateMarkdownOutput(job) {
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
