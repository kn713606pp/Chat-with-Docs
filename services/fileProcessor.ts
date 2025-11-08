/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import mammoth from 'mammoth';
import * as pdfjsLib from 'pdfjs-dist';

// Set up the PDF.js worker.
// This is crucial for it to work in the browser from a different origin.
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://esm.sh/pdfjs-dist@4.5.136/build/pdf.worker.mjs';

export const MAX_CONTEXT_CHARS = 1_000_000; // 1 million character limit for local context

/**
 * Reads a .docx file and converts it to raw text.
 */
export async function readDocxFile(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value;
}

/**
 * Reads a .pdf file and extracts its text content.
 */
export async function readPdfFile(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
  const numPages = pdf.numPages;
  let fullText = '';

  for (let i = 1; i <= numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map(item => ('str' in item ? item.str : '')).join(' ');
    fullText += pageText + '\n';
  }

  return fullText;
}

/**
 * Reads a standard text file.
 */
export async function readTextFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.onerror = (e) => reject(e);
    reader.readAsText(file);
  });
}

export const ALLOWED_EXTENSIONS = ['.js', '.jsx', '.ts', '.tsx', '.py', '.html', '.css', '.scss', '.md', '.json', '.txt', '.csv', '.yaml', '.yml', '.docx', '.pdf'];

export async function processFolder(files: FileList): Promise<{ 
    fullContent: string; 
    processedCount: number;
    totalValidFileCount: number; 
}> {
    const filePromises: Promise<{name: string, content: string} | null>[] = [];
    
    const validFiles = Array.from(files).filter(file => {
      const extension = `.${file.name.split('.').pop()?.toLowerCase()}`;
      return ALLOWED_EXTENSIONS.includes(extension) && file.size > 0;
    });

    for (const file of validFiles) {
        let filePromise: Promise<string>;
        const extension = `.${file.name.split('.').pop()?.toLowerCase()}`;
        if (extension === '.docx') {
          filePromise = readDocxFile(file);
        } else if (extension === '.pdf') {
          filePromise = readPdfFile(file);
        } else {
          filePromise = readTextFile(file);
        }
        
        filePromises.push(
          filePromise.then(content => ({
            name: file.webkitRelativePath,
            content,
          })).catch(error => {
            console.warn(`Could not process file ${file.name}:`, error);
            return null; // Don't break Promise.all, filter out nulls later
          })
        );
    }

    const allResults = (await Promise.all(filePromises)).filter(Boolean) as {name: string, content: string}[];
    
    let totalChars = 0;
    const finalProcessedFiles: { name: string; content: string }[] = [];

    // Prioritize files with content before checking size limit
    for (const fileResult of allResults) {
        if (fileResult.content && fileResult.content.trim()) {
            if (totalChars + fileResult.content.length > MAX_CONTEXT_CHARS) {
                break; // Stop adding files if limit is exceeded
            }
            finalProcessedFiles.push(fileResult);
            totalChars += fileResult.content.length;
        }
    }
    
    const fullContent = finalProcessedFiles
        .map(file => `--- File: ${file.name} ---\n${file.content}`)
        .join('\n\n');
        
    return { 
        fullContent, 
        processedCount: finalProcessedFiles.length, 
        totalValidFileCount: validFiles.length 
    };
}
