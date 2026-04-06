#!/usr/bin/env node

/**
 * career-ops-kr PDF 생성기
 * HTML 파일을 Playwright Chromium으로 A4 PDF로 변환합니다.
 *
 * 사용법:
 *   node generate-pdf.mjs --input /tmp/cv.html --output output/이력서_카카오_PM.pdf
 */

import { chromium } from 'playwright';
import { readFileSync, existsSync, mkdirSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Parse arguments
const args = process.argv.slice(2);
const inputIdx = args.indexOf('--input');
const outputIdx = args.indexOf('--output');

if (inputIdx === -1 || outputIdx === -1) {
  console.error('사용법: node generate-pdf.mjs --input <html파일> --output <pdf파일>');
  process.exit(1);
}

const inputPath = resolve(args[inputIdx + 1]);
const outputPath = resolve(args[outputIdx + 1]);

// Path validation: output must be within project's output/ directory or /tmp/
const allowedOutputDirs = [resolve(__dirname, 'output'), '/tmp', '/private/tmp'];
const isAllowedOutput = allowedOutputDirs.some(dir => outputPath.startsWith(dir));
if (!isAllowedOutput) {
  console.error(`출력 경로가 허용된 디렉토리 외부입니다: ${outputPath}`);
  console.error(`허용: output/, /tmp/`);
  process.exit(1);
}

// Ensure output directory exists
const outputDir = dirname(outputPath);
if (!existsSync(outputDir)) {
  mkdirSync(outputDir, { recursive: true });
}

// Check input file exists
if (!existsSync(inputPath)) {
  console.error(`입력 파일이 존재하지 않습니다: ${inputPath}`);
  process.exit(1);
}

async function generatePDF() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Load HTML file
  const htmlContent = readFileSync(inputPath, 'utf-8');

  // Resolve font paths relative to project root
  const fontsDir = resolve(__dirname, 'fonts');
  const processedHtml = htmlContent.replace(
    /url\(['"]?\.\.\/fonts\//g,
    `url('file://${fontsDir}/`
  );

  await page.setContent(processedHtml, {
    waitUntil: 'networkidle'
  });

  // Generate A4 PDF
  await page.pdf({
    path: outputPath,
    format: 'A4',
    printBackground: true,
    margin: {
      top: '0mm',
      right: '0mm',
      bottom: '0mm',
      left: '0mm'
    }
  });

  await browser.close();

  console.log(`PDF 생성 완료: ${outputPath}`);
}

generatePDF().catch(err => {
  console.error('PDF 생성 실패:', err.message);
  process.exit(1);
});
