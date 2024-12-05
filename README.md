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

All parameters in this action are optional, allowing flexibility in configuration based on your needs.

| **Input Name**                          | **Description**                                                                         | **Default**               | **Options**                     |
|-----------------------------------------|-----------------------------------------------------------------------------------------|---------------------------|---------------------------------|
| **access-token**                        | GitHub token.                                                                           | `${{ github.token }}`     |                                 |
| **path**                                | Glob pattern to locate Cucumber JSON files.                                             | `**/cucumber-report.json` |                                 |
| **name**                                | The name of the check.                                                                  | `Cucumber report`         |                                 |
| **check-status-on-error**               | Check status for Cucumber errors.                                                       | `failure`                 | `success`, `neutral`, `failure` |
| **check-status-on-undefined**           | Check status for undefined steps.                                                       | `success`                 | `success`, `neutral`, `failure` |
| **check-status-on-pending**             | Check status for pending steps.                                                         | `success`                 | `success`, `neutral`, `failure` |
| **annotation-status-on-error**          | Annotation status for errors.                                                           | `failure`                 | `notice`, `warning`, `failure`  |
| **annotation-status-on-undefined**      | Annotation status for undefined steps. No annotation if not set.                        |                           | `notice`, `warning`, `failure`  |
| **annotation-status-on-pending**        | Annotation status for pending steps. No annotation if not set.                          |                           | `notice`, `warning`, `failure`  |
| **show-number-of-error-on-check-title** | Show the number of errors in the check title (visible in PR checks).                    | `true`                    | `true`, `false`                 |
| **show-global-summary-report**          | Display a full summary report for each feature file.                                    | `false`                   | `true`, `false`                 |
| **number-of-test-error-to-fail-job**    | Number of test errors required to fail the build. <br> `-1` prevents the build from failing. | `-1`                      |                                 |

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
