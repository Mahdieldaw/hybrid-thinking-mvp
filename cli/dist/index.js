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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const socket_io_client_1 = __importDefault(require("socket.io-client"));
const fs = __importStar(require("fs/promises"));
const program = new commander_1.Command();
// TODO: Make this configurable, potentially via .env or command-line arg
const API_GATEWAY_URL = process.env.API_GATEWAY_URL || 'http://localhost:4000';
program
    .name('hybrid-thinking-cli')
    .description('CLI for interacting with the Hybrid Thinking API Gateway')
    .version('0.1.0');
program
    .command('run:prompt')
    .description('Run a prompt job via the API Gateway')
    .requiredOption('-p, --prompt <prompt>', 'The prompt text')
    .option('-m, --models <models>', 'Comma-separated list of model IDs (e.g., browser:chatgpt,claude-3-sonnet-20240229)', 'browser:chatgpt,claude-3-sonnet-20240229')
    .option('-u, --user <userId>', 'User ID for the job', 'cli-user')
    .option('-o, --output <file>', 'Output file for results (markdown format)')
    .action(async (options) => {
    const socket = (0, socket_io_client_1.default)(API_GATEWAY_URL, {
        reconnectionAttempts: 5,
        timeout: 10000,
    });
    console.log(`Connecting to API Gateway at ${API_GATEWAY_URL}...`);
    socket.on('connect', () => {
        console.log('Connected to API Gateway. Sending job:run:prompt event...');
        const jobPayload = {
            userId: options.user,
            promptText: options.prompt,
            requestedModels: options.models.split(',').map((m) => m.trim()),
        };
        socket.emit('job:run:prompt', jobPayload);
        console.log('Job submission sent:', jobPayload);
    });
    let results = {};
    let synthesisResult = null;
    let jobId = null;
    socket.on('job:status:update', (data) => {
        console.log('\n[JOB STATUS UPDATE]', data.status, data.message);
        if (data.jobId)
            jobId = data.jobId;
        if (data.payload && data.payload.results) {
            results = { ...results, ...data.payload.results };
        }
        if (data.payload && data.payload.synthesisResult) {
            synthesisResult = data.payload.synthesisResult;
        }
        // Display intermediate results
        if (data.payload && data.payload.modelId && data.payload.response) {
            console.log(`\n  [MODEL RESULT - ${data.payload.modelId}]`);
            console.log(`    ${data.payload.response.content}`);
        }
    });
    socket.on('job:completed', async (data) => {
        console.log('\n[JOB COMPLETED]');
        console.log('Job ID:', data.jobId);
        console.log('Final State:', JSON.stringify(data.finalState, null, 2));
        results = data.finalState.results;
        synthesisResult = data.finalState.synthesisResult;
        if (options.output && jobId) {
            const markdown = generateMarkdownOutput({
                jobId: data.jobId,
                promptText: options.prompt, // Assuming options.prompt is the original prompt
                requestedModels: options.models.split(',').map((m) => m.trim()),
                createdAt: new Date().toISOString(), // Or get from job data if available
                results: results,
                synthesisResult: synthesisResult,
            });
            try {
                await fs.writeFile(options.output, markdown);
                console.log(`\nOutput saved to: ${options.output}`);
            }
            catch (err) {
                console.error(`Error writing output file: ${err.message}`);
            }
        }
        socket.disconnect();
        process.exit(0);
    });
    socket.on('job:error', (data) => {
        console.error('\n[JOB ERROR]');
        console.error('Job ID:', data.jobId);
        console.error('Error Message:', data.message);
        console.error('Error Details:', JSON.stringify(data.error, null, 2));
        socket.disconnect();
        process.exit(1);
    });
    socket.on('connect_error', (err) => {
        console.error(`Connection Error: ${err.message}`);
        console.error('Is the API Gateway running and accessible?');
        process.exit(1);
    });
    socket.on('disconnect', (reason) => {
        console.log(`Disconnected from API Gateway: ${reason}`);
        if (reason === 'io server disconnect') {
            // the disconnection was initiated by the server, you need to reconnect manually
            socket.connect();
        }
        // else the socket will automatically try to reconnect
    });
    // Keep the process alive until the socket disconnects or job completes/errors
    // This might not be strictly necessary if process.exit is called in handlers
    // but can prevent premature exit if events are missed.
    // Handle Ctrl+C to gracefully disconnect
    process.on('SIGINT', () => {
        console.log('\nDisconnecting...');
        socket.disconnect();
        process.exit(0);
    });
});
program.parse(process.argv);
function generateMarkdownOutput(job) {
    let output = `# Hybrid Thinking CLI Job Results\n\n`;
    output += `**Job ID:** ${job.jobId}\n\n`;
    output += `**Prompt:** ${job.promptText}\n\n`;
    output += `**Models:** ${job.requestedModels.join(', ')}\n\n`;
    output += `**Generated:** ${job.createdAt}\n\n`;
    output += `## Individual Model Results\n\n`;
    if (job.results) {
        for (const [modelId, result] of Object.entries(job.results)) {
            if (result && typeof result === 'object' && result.content) {
                output += `### ${modelId}\n\n${result.content}\n\n`;
            }
            else if (result) {
                output += `### ${modelId}\n\n${typeof result === 'string' ? result : JSON.stringify(result)}\n\n`;
            }
        }
    }
    if (job.synthesisResult && job.synthesisResult.content) {
        output += `## Synthesis\n\n${job.synthesisResult.content}\n\n`;
    }
    else if (job.synthesisResult) {
        output += `## Synthesis\n\n${typeof job.synthesisResult === 'string' ? job.synthesisResult : JSON.stringify(job.synthesisResult)}\n\n`;
    }
    return output;
}
