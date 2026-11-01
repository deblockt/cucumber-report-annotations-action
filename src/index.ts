import * as core from '@actions/core';
import * as github from '@actions/github';
import * as glob from '@actions/glob';
import * as fs from 'fs';
import { run } from './main';

run({ core, github, glob, fs, workspace: process.env.GITHUB_WORKSPACE });
