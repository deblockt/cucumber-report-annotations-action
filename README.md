# cucumber-report-annotations-action

This action should be used to publish action annotations from cucumber json report.

## Exemple

``` yml
- uses: deblockt/cucumber-report-annotations-action@1.0
  with:
    access-token: ${{ secrets.GITHUB_TOKEN }}
    path: "**/cucumber-report.json"
```

![demo](doc/demo.png)

## parameters

- **access-token**: mandatory parameter. It's the github token to allow action to add check
- **path**: the glob path to get cucumber report on json format