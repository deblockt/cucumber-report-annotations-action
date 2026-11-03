import type { Annotation, FileReport, Inputs, PathResolver, ReportResult, ScenarioStatus, StepData } from './types';

export type StepStatusInputs = Pick<Inputs, 'annotationStatusOnError' | 'annotationStatusOnUndefined' | 'annotationStatusOnPending'>;
type AnnotationInputs = StepStatusInputs & Pick<Inputs, 'showGlobalSummaryReport'>;

interface StepToAnnotate {
    step: StepData;
    status: string;
    errorType: string;
}

interface BuiltAnnotations {
    annotations: Annotation[];
    errorNumber: number;
    notSentNumber: number;
}

export function emojiByStatus(status: ScenarioStatus): string {
    switch (status) {
        case 'success':
            return '✅';
        case 'failed':
            return '❌'
        case 'pending':
            return '⌛';
        case 'undefined':
            return '❓';
        case 'skipped':
            return '⏭️';
    }
}

async function buildStepAnnotation(cucumberError: StepData, status: string, errorType: string, resolvePath: PathResolver): Promise<Annotation> {
    return {
        path: (await resolvePath(cucumberError.file)) || cucumberError.file,
        start_line: cucumberError.line || 0,
        end_line: cucumberError.line || 0,
        start_column: 0,
        end_column: 0,
        annotation_level: status,
        title: cucumberError.title + ' ' + errorType + '.',
        message: 'Scenario: ' + cucumberError.title + '\nStep: ' + cucumberError.step + '\nError: \n' + cucumberError.error
    }
}

async function buildReportDetailAnnotation(fileReport: FileReport, resolvePath: PathResolver): Promise<Annotation> {
    const message = fileReport.scenarios
        .map(scenario => `${emojiByStatus(scenario.status)} Scenario: ${scenario.name}`)
        .join('\n');

    return {
        path: (await resolvePath(fileReport.file)) || fileReport.file,
        start_line: 0,
        end_line: 0,
        start_column: 0,
        end_column: 0,
        annotation_level: 'notice',
        title: `Feature: ${fileReport.name} Report`,
        message
    };
}

export function listStepsToAnnotate(reportResult: ReportResult, { annotationStatusOnError, annotationStatusOnUndefined, annotationStatusOnPending }: StepStatusInputs): StepToAnnotate[] {
    const stepsWithType = (steps: StepData[], status: string, errorType: string) => steps.map(step => ({ step, status, errorType }));
    return [
        ...stepsWithType(reportResult.failedSteps, annotationStatusOnError, 'Failed'),
        ...(annotationStatusOnUndefined ? stepsWithType(reportResult.undefinedSteps, annotationStatusOnUndefined, 'Undefined') : []),
        ...(annotationStatusOnPending ? stepsWithType(reportResult.pendingSteps, annotationStatusOnPending, 'Pending') : [])
    ];
}

// annotations over the maximum are not built, as resolving their path is costly
export async function buildAnnotations(reportResult: ReportResult, inputs: AnnotationInputs, maxNumberOfAnnotations: number, resolvePath: PathResolver): Promise<BuiltAnnotations> {
    const steps = listStepsToAnnotate(reportResult, inputs);
    const fileReports = inputs.showGlobalSummaryReport ? reportResult.listAllScenarioByFile : [];
    const sentSteps = steps.slice(0, maxNumberOfAnnotations);
    const sentFileReports = fileReports.slice(0, maxNumberOfAnnotations - sentSteps.length);

    const annotations = await Promise.all([
        ...sentSteps.map(({ step, status, errorType }) => buildStepAnnotation(step, status, errorType, resolvePath)),
        ...sentFileReports.map(fileReport => buildReportDetailAnnotation(fileReport, resolvePath))
    ]);
    return {
        annotations,
        errorNumber: steps.length,
        notSentNumber: steps.length + fileReports.length - annotations.length
    };
}
