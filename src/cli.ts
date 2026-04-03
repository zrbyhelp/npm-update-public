#!/usr/bin/env node
import { cwd, exit } from "node:process";

import { diffCommand } from "./commands/diff.js";
import { initCommand } from "./commands/init.js";
import { pullCommand } from "./commands/pull.js";
import { updateCommand } from "./commands/update.js";

interface InitCliOptions {
  baseurl?: string;
  templateId?: string;
}

interface DiffCliOptions {
  json?: boolean;
}

async function main(): Promise<void> {
  const command = process.argv[2];
  const currentDirectory = cwd();

  switch (command) {
    case "init":
      await initCommand(currentDirectory, parseInitOptions(process.argv.slice(3)));
      console.log("Initialized update-public config and filter.");
      return;
    case "pull":
      await pullCommand(currentDirectory);
      console.log("Pulled latest config and static assets.");
      return;
    case "diff":
      await diffCommand(currentDirectory, parseDiffOptions(process.argv.slice(3)));
      return;
    case "update":
      await updateCommand(currentDirectory, process.argv.slice(3));
      return;
    case "--help":
    case "-h":
    case undefined:
      printHelp();
      return;
    default:
      throw new Error(`Unknown command: ${command}`);
  }
}

function printHelp(): void {
  console.log(`zupublic-node

Usage:
  zupublic-node init [-b <baseurl>] [-t <templateId>]
  zupublic-node pull
  zupublic-node diff [--json]
  zupublic-node update <type/name> [type/name ...]
`);
}

function parseInitOptions(args: string[]): InitCliOptions {
  const options: InitCliOptions = {};

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    switch (arg) {
      case "-b":
      case "--baseurl": {
        const value = args[index + 1];
        if (!value) {
          throw new Error(`Missing value for ${arg}`);
        }
        options.baseurl = value;
        index += 1;
        break;
      }
      case "-t":
      case "--template": {
        const value = args[index + 1];
        if (!value) {
          throw new Error(`Missing value for ${arg}`);
        }
        options.templateId = value;
        index += 1;
        break;
      }
      default:
        throw new Error(`Unknown init option: ${arg}`);
    }
  }

  return options;
}

function parseDiffOptions(args: string[]): DiffCliOptions {
  const options: DiffCliOptions = {};

  for (const arg of args) {
    switch (arg) {
      case "--json":
        options.json = true;
        break;
      default:
        throw new Error(`Unknown diff option: ${arg}`);
    }
  }

  return options;
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Error: ${message}`);
  exit(1);
});
