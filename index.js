const core = require('@actions/core');
const github = require('@actions/github');
const glob = require('@actions/glob');
const fs = require('fs');
const { run } = require('./src/main');

run({ core, github, glob, fs });
