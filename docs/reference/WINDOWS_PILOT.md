# Native Windows pilot

Windows live validation: pending

Use this how-to on a native Windows PC after `contextrail@0.3.0-rc.3` and the matching GitHub prerelease are public. Run every command in PowerShell, not WSL. WSL is a separate Linux environment and must not configure a mounted Windows-native Codex home.

## Preconditions

- Node.js 22.13 or newer is installed and `node --version` succeeds.
- npm is available.
- Codex Desktop is installed.
- The test repository is backed up or disposable.
- PowerShell starts in the selected repository directory.

## Install and inspect

```powershell
npm install --global contextrail@next
contextrail --version
contextrail setup --dry-run --json
```

Confirm the version is `0.3.0-rc.3`. Review the target, native LocalAppData managed root, Throughline artifact URL and SHA-256, project classification, Hook paths, and ordered components. The dry run must not download or change the repository or user Codex files.

When continuing a pilot in an already configured repository, update the global CLI in place and rerun setup from that same repository. Do not remove the existing ContextRail metadata, managed Throughline release, or adoption mapping:

```powershell
npm install --global contextrail@next
contextrail --version
Set-Location C:\Projects\RathonSales
contextrail setup --dry-run --json
contextrail setup --apply --json
```

For a mature existing repository, follow the README Codex prompt to create a temporary adoption mapping, repeat the dry run with `--project existing --adoption-config <temporary-file>`, and stop if any semantic mapping is uncertain.

## Apply and verify structure

```powershell
contextrail setup --apply --json
contextrail check --json
contextrail hooks verify --host codex --json
contextrail throughline verify --json
```

The setup result may be `installed_live_verification_required`. That means package, receipts, Hook registration, project automation, and synthetic checks passed; it does not prove a real Codex conversation consumed Hooks or that Throughline captured content.

Confirm that existing user Hooks remain present, ContextRail handlers contain `commandWindows`, and no POSIX `.bin/throughline` shim is selected. Preserve the JSON reports without prompts, secrets, personal paths, or raw transcripts.

## Exercise live Codex behavior

1. In Codex Desktop, open `Settings -> Hooks` and review the entries sourced from the user `hooks.json`.
2. Trust the three Throughline handlers (`UserPromptSubmit`, `PostToolUse`, and `Stop`) and the two ContextRail handlers (`UserPromptSubmit` and `Stop`) after verifying their absolute commands.
3. Close and restart Codex Desktop so it reloads Hook configuration, then open the selected repository.
4. Send a bounded prompt that refers to a project file and confirm ContextRail route context is available.
5. Complete a small turn that produces capturable content.
6. Run `contextrail throughline verify --doctor` and confirm the Throughline Hook trust summary is `3/3 trusted` and capture contains non-empty body and detail evidence; Hook declarations alone do not pass capture.
7. Start a fresh Codex task and exercise Throughline restore.
8. Prepare a fresh-task handoff and exercise Throughline handoff.
9. Confirm injected ContextRail guidance is excluded from captured memory according to the compatibility contract.

Record capture, restore, and handoff as separate pass or fail results. Do not record conversation text.

## Repeat and recovery

Run `contextrail setup --apply --json` again. It must verify completed components, avoid a second artifact download, avoid duplicate Hooks, and finish without replacing unmanaged configuration.

If a component fails, retain the reported completed, failed, and pending step states. Correct only the stated cause and rerun setup. Do not delete receipts or overwrite Hook files to force progress.

## Acceptance record

Record only:

- Windows edition and architecture;
- Node.js, npm, ContextRail, Codex Desktop, and Throughline versions;
- automated setup status;
- ContextRail live context consumption: pass or fail;
- Throughline capture: pass or fail;
- Throughline restore: pass or fail;
- Throughline handoff: pass or fail; and
- any stable issue codes.

The stable npm `latest` tag remains blocked until all live items pass and the evidence is added to repository history.
