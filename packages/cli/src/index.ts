#!/usr/bin/env node
import { Command } from 'commander';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import chalk from 'chalk';
import ora from 'ora';
import { runPixelCheck, PixelCheckConfig, Credentials, ProgressEvent } from '@pixelcheck/core';

dotenv.config();

const program = new Command();

program
  .name('pixelcheck')
  .description('Visual regression testing — compare Figma/Zeplin designs against your implementation')
  .version('1.0.0');

// ── Run command ───────────────────────────────────────────────

program
  .command('run')
  .description('Run visual regression check from a config file')
  .requiredOption('-c, --config <path>', 'Path to pixelcheck.config.json')
  .option('-o, --output <dir>', 'Output directory for report', './pixelcheck-reports')
  .option('--open', 'Open report in browser when done')
  .option('--no-ai', 'Skip AI analysis (faster, pixel-diff only)')
  .action(async (opts) => {
    const configPath = path.resolve(opts.config);
    if (!fs.existsSync(configPath)) {
      console.error(chalk.red(`✗ Config file not found: ${configPath}`));
      process.exit(1);
    }

    const config: PixelCheckConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    config.output = { dir: opts.output, formats: ['html', 'json'], openOnComplete: opts.open };

    await runCheck(config, opts);
  });

// ── Quick run command ─────────────────────────────────────────

program
  .command('check')
  .description('Quick single-screen check without a config file')
  .requiredOption('--story <id>', 'Story/ticket ID')
  .requiredOption('--name <name>', 'Screen name')
  .requiredOption('--platform <platform>', 'Platform: web | android | ios')
  .option('--url <url>', 'Local dev URL (for web)')
  .option('--figma-file <fileId>', 'Figma file key')
  .option('--figma-node <nodeId>', 'Figma node/frame ID')
  .option('--zeplin-project <projectId>', 'Zeplin project ID')
  .option('--zeplin-screen <screenId>', 'Zeplin screen ID')
  .option('--selector <css>', 'CSS selector to capture specific element (web only)')
  .option('--viewport <WxH>', 'Viewport size e.g. 1440x900', '1440x900')
  .option('-o, --output <dir>', 'Output directory', './pixelcheck-reports')
  .option('--open', 'Open report in browser when done')
  .action(async (opts) => {
    const [width, height] = (opts.viewport as string).split('x').map(Number);
    const source = opts.figmaFile ? 'figma' : 'zeplin';

    const config: PixelCheckConfig = {
      storyId: opts.story,
      screens: [{
        name: opts.name,
        platform: opts.platform as 'web' | 'android' | 'ios',
        designSource: source,
        url: opts.url,
        selector: opts.selector,
        figmaFileId: opts.figmaFile,
        figmaNodeId: opts.figmaNode,
        zeplinProjectId: opts.zeplinProject,
        zeplinScreenId: opts.zeplinScreen,
        viewport: { width, height },
      }],
      output: { dir: opts.output, formats: ['html', 'json'], openOnComplete: opts.open },
    };

    await runCheck(config, opts);
  });

// ── List command ──────────────────────────────────────────────

program
  .command('list-figma')
  .description('List screens/frames in a Figma file')
  .requiredOption('--file <fileId>', 'Figma file key')
  .action(async (opts) => {
    const token = process.env.FIGMA_TOKEN;
    if (!token) { console.error(chalk.red('✗ FIGMA_TOKEN env var is required')); process.exit(1); }

    const spinner = ora('Fetching Figma screens…').start();
    try {
      const { listFigmaScreens } = await import('@pixelcheck/core');
      const screens = await listFigmaScreens(opts.file, token);
      spinner.succeed(chalk.green(`Found ${screens.length} screens in Figma file`));
      console.log('');
      screens.forEach(s => {
        console.log(`  ${chalk.cyan(s.id.padEnd(20))} ${chalk.white(s.name)} ${chalk.gray(s.type)}`);
      });
    } catch (err) {
      spinner.fail(chalk.red(`Failed: ${err}`));
      process.exit(1);
    }
  });

program
  .command('list-zeplin')
  .description('List screens in a Zeplin project')
  .requiredOption('--project <projectId>', 'Zeplin project ID')
  .action(async (opts) => {
    const token = process.env.ZEPLIN_TOKEN;
    if (!token) { console.error(chalk.red('✗ ZEPLIN_TOKEN env var is required')); process.exit(1); }

    const spinner = ora('Fetching Zeplin screens…').start();
    try {
      const { listZeplinScreens } = await import('@pixelcheck/core');
      const screens = await listZeplinScreens(opts.project, token);
      spinner.succeed(chalk.green(`Found ${screens.length} screens in Zeplin project`));
      console.log('');
      screens.forEach(s => {
        const section = s.section ? chalk.gray(` [${s.section}]`) : '';
        console.log(`  ${chalk.cyan(s.id.padEnd(26))} ${chalk.white(s.name)}${section}`);
      });
    } catch (err) {
      spinner.fail(chalk.red(`Failed: ${err}`));
      process.exit(1);
    }
  });

// ── Init command ──────────────────────────────────────────────

program
  .command('init')
  .description('Generate a sample pixelcheck.config.json')
  .action(() => {
    const sample: PixelCheckConfig = {
      storyId: 'STORY-123',
      screens: [
        {
          name: 'Home Screen',
          designSource: 'figma',
          figmaFileId: 'your-figma-file-id',
          figmaNodeId: '123:456',
          platform: 'web',
          url: 'http://localhost:3000/',
          viewport: { width: 1440, height: 900 },
        },
        {
          name: 'Login Screen',
          designSource: 'zeplin',
          zeplinProjectId: 'your-zeplin-project-id',
          zeplinScreenId: 'your-zeplin-screen-id',
          platform: 'ios',
          deviceName: 'iPhone 14',
          viewport: { width: 390, height: 844 },
        },
        {
          name: 'Dashboard Mobile',
          designSource: 'figma',
          figmaFileId: 'your-figma-file-id',
          figmaNodeId: '789:012',
          platform: 'android',
          deviceName: 'Pixel 7',
          viewport: { width: 1080, height: 2400 },
        },
      ],
      output: { dir: './pixelcheck-reports', formats: ['html', 'json'] },
      thresholds: {
        pixelMismatchPercent: 5,
        aiConfidenceMin: 0.6,
        overallScoreMin: 80,
      },
    };

    fs.writeFileSync('pixelcheck.config.json', JSON.stringify(sample, null, 2));
    console.log(chalk.green('✓ Created pixelcheck.config.json'));
    console.log(chalk.gray('  Set FIGMA_TOKEN, ZEPLIN_TOKEN, ANTHROPIC_API_KEY in your .env file'));
  });

// ── Core runner ───────────────────────────────────────────────

async function runCheck(config: PixelCheckConfig, opts: Record<string, unknown>): Promise<void> {
  const credentials: Credentials = {
    figmaToken: process.env.FIGMA_TOKEN,
    zeplinToken: process.env.ZEPLIN_TOKEN,
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
  };

  printHeader(config);

  let spinner = ora('').start();
  const startTime = Date.now();

  try {
    const report = await runPixelCheck({
      config,
      credentials,
      onProgress: (event: ProgressEvent) => {
        if (event.type === 'screen_start') {
          spinner.text = chalk.blue(`[${event.current}/${event.total}] ${event.screenName}`);
        } else if (event.type === 'step') {
          spinner.text = chalk.gray(`  ${event.step}`);
        } else if (event.type === 'screen_done' && event.result) {
          const r = event.result;
          const icon = r.status === 'pass' ? chalk.green('✓') : r.status === 'warning' ? chalk.yellow('⚠') : chalk.red('✗');
          const score = getScoreChalk(r.accuracyScore)(`${r.accuracyScore}/100`);
          spinner.succeed(`${icon} ${r.screenName} ${score} — ${r.aiAnalysis.issues.length} issues, ${r.pixelDiff.mismatchPercent.toFixed(1)}% pixel mismatch`);
          spinner = ora('').start();
        }
      },
    });

    spinner.stop();

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    printSummary(report.summary, elapsed);

    const reportPath = path.join(config.output?.dir ?? './pixelcheck-reports', 'report.html');
    console.log(chalk.gray(`\n  Report: ${chalk.cyan(reportPath)}`));

    if (opts.open || config.output?.openOnComplete) {
      const { default: open } = await import('open');
      await open(reportPath);
    }

    // Exit code based on results
    if (report.summary.failed > 0) process.exit(1);
  } catch (err) {
    spinner.fail(chalk.red(`Fatal error: ${err}`));
    process.exit(1);
  }
}

function printHeader(config: PixelCheckConfig): void {
  console.log('');
  console.log(chalk.bold.blue('⬡  PixelCheck') + chalk.gray(' — Visual Regression Suite'));
  console.log(chalk.gray(`   Story: ${config.storyId} · ${config.screens.length} screen(s)`));
  console.log('');
}

function printSummary(summary: { totalScreens: number; passed: number; warned: number; failed: number; overallAccuracyScore: number; criticalIssues: number; majorIssues: number; minorIssues: number }, elapsed: string): void {
  console.log('');
  console.log(chalk.bold('  Results'));
  console.log(chalk.gray('  ─────────────────────────────'));
  console.log(`  Overall Score:   ${getScoreChalk(summary.overallAccuracyScore)(summary.overallAccuracyScore + '/100')}`);
  console.log(`  Screens:         ${chalk.green(summary.passed + ' passed')}  ${chalk.yellow(summary.warned + ' warned')}  ${chalk.red(summary.failed + ' failed')}`);
  console.log(`  Issues:          ${chalk.red(summary.criticalIssues + ' critical')}  ${chalk.yellow(summary.majorIssues + ' major')}  ${chalk.gray(summary.minorIssues + ' minor')}`);
  console.log(`  Duration:        ${elapsed}s`);
  console.log('');
}

function getScoreChalk(score: number) {
  if (score >= 85) return chalk.green;
  if (score >= 70) return chalk.yellow;
  return chalk.red;
}

program.parse();
