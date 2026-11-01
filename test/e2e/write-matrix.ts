import * as fs from 'fs';
import { loadCases } from './cases';

// writes the end-to-end cases as the `cases` step output, used as the `action-test` job matrix
const { cases } = loadCases();
const outputFile = process.env.GITHUB_OUTPUT;
if (!outputFile) {
    throw new Error('GITHUB_OUTPUT is not set');
}
fs.appendFileSync(outputFile, `cases=${JSON.stringify(cases)}\n`);
console.log(`${cases.length} cases:\n${cases.map(c => `  - ${c.checkName}`).join('\n')}`);
