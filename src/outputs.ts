import * as path from 'path';
import type { Core, SummaryCounts } from './types';

function reportOutputName(reportFile: string): string {
    return path.basename(reportFile, path.extname(reportFile)).replaceAll(' ', '_');
}

export function setOutputs(core: Core, reportFile: string, counts: SummaryCounts): void {
    const outputName = reportOutputName(reportFile);
    for (const type in counts.scenarios) {
        core.debug(`publish output ${outputName}_${type}_scenarios=${counts.scenarios[type]}`);
        core.setOutput(`${outputName}_${type}_scenarios`, counts.scenarios[type]);
    }
    for (const type in counts.steps) {
        core.debug(`publish output ${outputName}_${type}_steps=${counts.steps[type]}`);
        core.setOutput(`${outputName}_${type}_steps`, counts.steps[type]);
    }
}
