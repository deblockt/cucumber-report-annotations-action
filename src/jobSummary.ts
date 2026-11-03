import { emojiByStatus, listStepsToAnnotate } from './annotations';
import type { StepStatusInputs } from './annotations';
import type { FileReport, PathResolver, ReportResult, StepData } from './types';

// sections that can be written in the job summary
export const JOB_SUMMARY_SECTIONS = ['counts', 'steps', 'features'] as const;
export type JobSummarySection = typeof JOB_SUMMARY_SECTIONS[number];

// the job summary is limited to 1MiB per step: the number of detailed steps is capped
export const MAX_JOB_SUMMARY_STEPS = 100;

// builds the url of a file of the repository, at the commit of the check
export type FileUrlBuilder = (path: string) => string;

export interface JobSummaryParameters {
    reportResult: ReportResult;
    inputs: StepStatusInputs & { jobSummaryContent: JobSummarySection[] };
    counts: string;
    resolvePath: PathResolver;
    fileUrl: FileUrlBuilder;
}

function isJobSummarySection(section: string): section is JobSummarySection {
    return (JOB_SUMMARY_SECTIONS as readonly string[]).includes(section);
}

// reads the comma separated list of sections of the job-summary-content input
export function parseJobSummarySections(value: string): JobSummarySection[] {
    const sections = value.split(',').map(section => section.trim()).filter(section => section !== '');
    const unknownSections = sections.filter(section => !isJobSummarySection(section));
    if (unknownSections.length > 0) {
        throw new Error(`Unknown job-summary-content section(s): ${unknownSections.join(', ')}. The possible values are: ${JOB_SUMMARY_SECTIONS.join(', ')}.`);
    }
    return sections.filter(isJobSummarySection);
}

function escapeHtml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// link to the feature file in the repository, or its raw path when it is not found
async function fileLink(file: string, { resolvePath, fileUrl }: JobSummaryParameters, line?: number): Promise<string> {
    const path = await resolvePath(file);
    const anchor = line ? `#L${line}` : '';
    const label = escapeHtml((path ?? file) + anchor);
    return path ? `<a href="${escapeHtml(fileUrl(path) + anchor)}">${label}</a>` : `<code>${label}</code>`;
}

function details(summary: string, body: string): string {
    return `<details><summary>${summary}</summary>\n\n${body}\n\n</details>`;
}

function section(heading: string, items: string[], footer = ''): string {
    return items.length === 0 ? '' : `##### ${heading}\n\n${items.join('\n')}${footer}`;
}

// the link to the feature file is in the body: a link in the <summary> would be opened instead of expanding the details
async function buildStepDetail(step: StepData, errorType: string, parameters: JobSummaryParameters): Promise<string> {
    const title = `<b>${escapeHtml(step.title)}</b> ${errorType.toLowerCase()}`;
    const error = step.error ? `\n<pre>${escapeHtml(step.error)}</pre>` : '';
    return details(title, `File: ${await fileLink(step.file, parameters, step.line)}\nStep: <code>${escapeHtml(step.step)}</code>${error}`);
}

async function buildStepsSection(parameters: JobSummaryParameters): Promise<string> {
    const steps = listStepsToAnnotate(parameters.reportResult, parameters.inputs);
    const shownSteps = steps.slice(0, MAX_JOB_SUMMARY_STEPS);
    const notShown = steps.length > shownSteps.length
        ? `\n\n${steps.length - shownSteps.length} other step(s) not shown: only the first ${MAX_JOB_SUMMARY_STEPS} steps are detailed.`
        : '';
    const items = await Promise.all(shownSteps.map(({ step, errorType }) => buildStepDetail(step, errorType, parameters)));
    return section('Steps in error', items, notShown);
}

async function buildFileReportDetail(fileReport: FileReport, parameters: JobSummaryParameters): Promise<string> {
    const scenarios = fileReport.scenarios
        .map(scenario => `<li>${emojiByStatus(scenario.status)} Scenario: ${escapeHtml(scenario.name)}</li>`)
        .join('');
    return details(`Feature: <b>${escapeHtml(fileReport.name)}</b>`, `File: ${await fileLink(fileReport.file, parameters)}\n<ul>${scenarios}</ul>`);
}

async function buildFileReportsSection(parameters: JobSummaryParameters): Promise<string> {
    const items = await Promise.all(parameters.reportResult.listAllScenarioByFile.map(fileReport => buildFileReportDetail(fileReport, parameters)));
    return section('Features', items);
}

// the sections of job-summary-content for a report, or an empty string when there is nothing to write
export async function buildJobSummary(parameters: JobSummaryParameters): Promise<string> {
    const sections = parameters.inputs.jobSummaryContent;
    const content = [
        sections.includes('counts') ? parameters.counts : '',
        sections.includes('steps') ? await buildStepsSection(parameters) : '',
        sections.includes('features') ? await buildFileReportsSection(parameters) : ''
    ];
    return content.filter(part => part !== '').join('\n\n');
}
