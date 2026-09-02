# Native Windows pilot

Windows live validation: passed

Use this how-to on a native Windows PC with `contextrail@0.3.0` or newer. Run every command in PowerShell, not WSL. WSL is a separate Linux environment and must not configure a mounted Windows-native Codex home.

## Preconditions

- Node.js 22.13 or newer is installed and `node --version` succeeds.
- npm is available.
- Codex Desktop is installed.
- The test repository is backed up or disposable.
- PowerShell starts in the selected repository directory.

## Install and inspect

```powershell
npm install --global contextrail
contextrail --version
contextrail setup --dry-run --json
```

Confirm the version is `0.3.0` or newer. Review the target, native LocalAppData managed root, Throughline artifact URL and SHA-256, project classification, Hook paths, and ordered components. The dry run must not download or change the repository or user Codex files.

When continuing a pilot in an already configured repository, update the global CLI in place and rerun setup from that same repository. Do not remove the existing ContextRail metadata, managed Throughline release, or adoption mapping:

```powershell
npm install --global contextrail
contextrail --version
Set-Location C:\Projects\RathonSales
contextrail setup --dry-run --json
contextrail setup --apply --json
```

Because the managed release path is part of each Codex Hook definition, an
in-place Throughline update intentionally invalidates the previous approval.
After setup, open `Settings -> Hooks` and review any entries marked as changed.
ContextRail never writes approval hashes on the user's behalf.

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
6. Run `contextrail doctor`. If it reports that changed Codex Hooks require
   review, approve the three changed Throughline handlers in the Codex Hooks
   menu, send one normal prompt, then run `contextrail doctor` again. Use
   `contextrail doctor --debug` only when the concise result still needs
   investigation.
7. Run `contextrail throughline verify --doctor` and confirm the Throughline Hook trust summary is `trusted`, all three managed entries say `trusted: yes`, and capture contains non-empty body and detail evidence; Hook declarations alone do not pass capture.
8. Start a fresh Codex task and exercise Throughline restore.
9. Run `contextrail handoff` without `--open-host`. Confirm that it creates a different task, injects Throughline memory, and opens Codex Desktop. If task creation succeeds but opening fails, open the reported task instead of rerunning the command.
10. Confirm injected ContextRail guidance is excluded from captured memory according to the compatibility contract.

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

The stable npm `latest` gate was satisfied by the recorded native Windows acceptance evidence.

The rc.12 native Windows existing-project pilot passed installation, guarded
adoption, Hook trust, automatic capture, fresh-task creation, memory injection,
and semantic restoration. It selected `manual` only because the flagless
handoff still delegated host selection to `auto`. Rc.13 changes only that
ContextRail default to Codex Desktop. The rc.13 retest then opened the new Codex
Desktop task without `--open-host`, completing the live check.
