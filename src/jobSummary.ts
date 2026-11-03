import { emojiByStatus, listStepsToAnnotate } from './annotations';
import type { AnnotationInputs } from './annotations';
import type { FileReport, PathResolver, ReportResult, StepData } from './types';

// the job summary is limited to 1MiB per step: the number of detailed steps is capped
export const MAX_JOB_SUMMARY_STEPS = 100;

// builds the url of a file of the repository, at the commit of the check
export type FileUrlBuilder = (path: string, line?: number) => string;

interface ResolvedStep {
    step: StepData;
    errorType: string;
    path?: string;
}

interface ResolvedFileReport {
    fileReport: FileReport;
    path?: string;
}

export interface JobSummaryContent {
    steps: ResolvedStep[];
    notShownStepNumber: number;
    fileReports: ResolvedFileReport[];
}

function escapeHtml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function fileLink(file: string, path: string | undefined, fileUrl: FileUrlBuilder, line?: number): string {
    const label = escapeHtml((path ?? file) + (line ? `#L${line}` : ''));
    return path ? `<a href="${escapeHtml(fileUrl(path, line))}">${label}</a>` : `<code>${label}</code>`;
}

function buildStepDetail({ step, errorType, path }: ResolvedStep, fileUrl: FileUrlBuilder): string {
    const title = `<b>${escapeHtml(step.title)}</b> ${errorType.toLowerCase()} on ${fileLink(step.file, path, fileUrl, step.line)}`;
    const error = step.error ? `\n<pre>${escapeHtml(step.error)}</pre>` : '';
    return `<details><summary>${title}</summary>\n\n`
        + `Step: <code>${escapeHtml(step.step)}</code>${error}\n\n`
        + '</details>';
}

function buildStepsSection(content: JobSummaryContent, fileUrl: FileUrlBuilder): string {
    if (content.steps.length === 0) {
        return '';
    }
    const notShown = content.notShownStepNumber > 0
        ? `\n\n${content.notShownStepNumber} other step(s) not shown: only the first ${MAX_JOB_SUMMARY_STEPS} steps are detailed.`
        : '';
    return '\n\n##### Steps in error\n\n'
        + content.steps.map(step => buildStepDetail(step, fileUrl)).join('\n')
        + notShown;
}

function buildFileReportDetail({ fileReport, path }: ResolvedFileReport, fileUrl: FileUrlBuilder): string {
    const scenarios = fileReport.scenarios
        .map(scenario => `<li>${emojiByStatus(scenario.status)} Scenario: ${escapeHtml(scenario.name)}</li>`)
        .join('');
    return `<details><summary>Feature: <b>${escapeHtml(fileReport.name)}</b> (${fileLink(fileReport.file, path, fileUrl)})</summary>\n\n`
        + `<ul>${scenarios}</ul>\n\n`
        + '</details>';
}

function buildFileReportsSection(content: JobSummaryContent, fileUrl: FileUrlBuilder): string {
    if (content.fileReports.length === 0) {
        return '';
    }
    return '\n\n##### Features\n\n'
        + content.fileReports.map(fileReport => buildFileReportDetail(fileReport, fileUrl)).join('\n');
}

// lists the steps and features detailed in the job summary, with their path in the repository
export async function collectJobSummaryContent(reportResult: ReportResult, inputs: AnnotationInputs, resolvePath: PathResolver): Promise<JobSummaryContent> {
    const steps = listStepsToAnnotate(reportResult, inputs);
    const shownSteps = steps.slice(0, MAX_JOB_SUMMARY_STEPS);
    const fileReports = inputs.showGlobalSummaryReport ? reportResult.listAllScenarioByFile : [];
    return {
        steps: await Promise.all(shownSteps.map(async ({ step, errorType }) => ({ step, errorType, path: await resolvePath(step.file) }))),
        notShownStepNumber: steps.length - shownSteps.length,
        fileReports: await Promise.all(fileReports.map(async fileReport => ({ fileReport, path: await resolvePath(fileReport.file) })))
    };
}

// details of the failed, undefined and pending steps, and the report of each feature, for the job summary
export function buildJobSummaryDetails(content: JobSummaryContent, fileUrl: FileUrlBuilder): string {
    return buildStepsSection(content, fileUrl) + buildFileReportsSection(content, fileUrl);
}
