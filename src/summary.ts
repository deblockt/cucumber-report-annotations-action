import type { GlobalInformation, SummaryCounts } from './types';

export function buildSummaryCounts(globalInformation: GlobalInformation): SummaryCounts {
    return {
        scenarios: {
            'failed': globalInformation.failedScenarioNumber,
            'undefined': globalInformation.undefinedScenarioNumber,
            'pending': globalInformation.pendingScenarioNumber,
            'passed': globalInformation.succeedScenarioNumber
        },
        steps: {
            'failed': globalInformation.failedStepsNumber,
            'undefined': globalInformation.undefinedStepsNumber,
            'skipped': globalInformation.skippedStepsNumber,
            'pending': globalInformation.pendingStepNumber,
            'passed': globalInformation.succeedStepsNumber
        }
    };
}

function buildSummaryLine(itemNumber: number, itemType: string, itemCounts: Record<string, number>): string {
    const header = itemNumber + ' ' + itemType;
    const counts = Object.keys(itemCounts)
        .filter(key => itemCounts[key] > 0)
        .map(key => itemCounts[key] + ' ' + key)
        .join(', ');
    return `    ${header} (${counts})`;
}

function buildNotSentAnnotationsMessage(notSentNumber: number, maxNumberOfAnnotations?: number): string {
    return notSentNumber > 0
        ? `\n\n${notSentNumber} annotation(s) not sent: the maximum number of annotations (${maxNumberOfAnnotations}) is reached.`
        : '';
}

export function buildSummary(globalInformation: GlobalInformation, counts: SummaryCounts, notSentAnnotationNumber = 0, maxNumberOfAnnotations?: number): string {
    return buildSummaryLine(globalInformation.scenarioNumber, 'Scenarios', counts.scenarios)
        + '\n'
        + buildSummaryLine(globalInformation.stepsNumber, 'Steps', counts.steps)
        + buildNotSentAnnotationsMessage(notSentAnnotationNumber, maxNumberOfAnnotations);
}
