# Cucumber Report Annotations Action

This GitHub Action is designed to publish action annotations from Cucumber reports.

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

- JSON: The deprecated Cucumber report format. Prefer using the message format. If you use this format, the file extension should be `.json`.
- Message: The new Cucumber report format using NDJSON (newline-delimited JSON) format. If you use this format, the file extension should be `.ndjson`.

## Parameters

- **access-token**: Mandatory parameter. It's the GitHub token to allow the action to add checks.
- **name** (optional, default: Cucumber report): The check name.
- **path** (optional, default: **/cucumber-report.json): The glob path to get the Cucumber report in JSON format.
- **check-status-on-error** (optional, default: failure): The check status to use on Cucumber error. Can be 'neutral' or 'failure'.
- **check-status-on-undefined** (optional, default: success): The check status to use on undefined steps. Can be 'success', 'neutral', or 'failure'.
- **check-status-on-pending** (optional, default: success): The check status to use on pending steps. Can be 'success', 'neutral', or 'failure'.
- **annotation-status-on-error** (optional, default: failure): The annotation status on error. Can be 'notice', 'warning', or 'failure'.
- **annotation-status-on-undefined** (optional): The annotation status on undefined steps. Can be 'notice', 'warning', or 'failure'. If this property is not set, no annotation will be generated for undefined steps.
- **annotation-status-on-pending** (optional): The annotation status on pending steps. Can be 'notice', 'warning', or 'failure'. If this property is not set, no annotation will be generated for pending steps.
- **number-of-test-error-to-fail-job** (optional): Indicates the number of tests in error to fail the build. If the value is -1, this action will never fail the build. By default, this action will not cause the build to fail.
- **show-global-summary-report** (optional): If set to true, a full summary report will be displayed for each feature file.

## Outputs

The following variables are available as output (where the output name is the JSON file name with spaces replaced by underscores and without the '.json' extension):

- `${output}_failed_scenarios`: Number of failed scenarios.
- `${output}_undefined_scenarios`: Number of undefined scenarios.
- `${output}_pending_scenarios`: Number of pending scenarios.
- `${output}_passed_scenarios`: Number of passed scenarios.
- `${output}_failed_steps`: Number of failed steps.
- `${output}_undefined_steps`: Number of undefined steps.
- `${output}_pending_steps`: Number of pending steps.
- `${output}_passed_steps`: Number of passed steps.
