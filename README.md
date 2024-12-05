# Cucumber Report Annotations Action

This GitHub Action publishes action annotations from Cucumber reports.

## Example

```yaml
- uses: deblockt/cucumber-report-annotations-action@v1.7
  with:
    access-token: ${{ secrets.GITHUB_TOKEN }}
    path: "**/cucumber-report.json"
```

![demo](doc/demo.png)

## Supported Formats

This GitHub Action supports two formats:

- **JSON**: The deprecated Cucumber report format. Prefer using the message format. If you use this format, the file extension should be `.json`.
- **Message**: The new Cucumber report format using NDJSON (newline-delimited JSON). If you use this format, the file extension should be `.ndjson`.

## Parameters

- **access-token** (optional, default: "${{ github.token }}"): The GitHub token to allow the action to add checks.
- **name** (optional, default: "Cucumber report"): The check name.
- **path** (optional, default: "**/cucumber-report.json"): The glob pattern to locate the Cucumber report file in JSON format.
- **check-status-on-error** (optional, default: "failure"): The check status to use for Cucumber errors. Options: `neutral`, `failure`.
- **check-status-on-undefined** (optional, default: "success"): The check status to use for undefined steps. Options: `success`, `neutral`, `failure`.
- **check-status-on-pending** (optional, default: "success"): The check status to use for pending steps. Options: `success`, `neutral`, `failure`.
- **annotation-status-on-error** (optional, default: "failure"): The annotation status for errors. Options: `notice`, `warning`, `failure`.
- **annotation-status-on-undefined** (optional): The annotation status for undefined steps. Options: `notice`, `warning`, `failure`. If not set, no annotation will be generated for undefined steps.
- **annotation-status-on-pending** (optional): The annotation status for pending steps. Options: `notice`, `warning`, `failure`. If not set, no annotation will be generated for pending steps.
- **number-of-test-error-to-fail-job** (optional, default: -1): The threshold of failed tests to fail the build. If set to `-1`, the action will never fail the build.
- **show-global-summary-report** (optional): If `true`, a full summary report will be displayed for each feature file.

## Outputs

The following variables are available as output (with the JSON file name used as a base, spaces replaced by underscores, and without the `.json` extension):

- `${output}_failed_scenarios`: Number of failed scenarios.
- `${output}_undefined_scenarios`: Number of undefined scenarios.
- `${output}_pending_scenarios`: Number of pending scenarios.
- `${output}_passed_scenarios`: Number of passed scenarios.
- `${output}_failed_steps`: Number of failed steps.
- `${output}_undefined_steps`: Number of undefined steps.
- `${output}_pending_steps`: Number of pending steps.
- `${output}_passed_steps`: Number of passed steps.
