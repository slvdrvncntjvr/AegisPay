# About this copy

A copy of FMD (Foundational Matrix Documents) for reference. What to keep, add and drop for hackathons is in `hackathon-playbook/fmd-review.md`.

- **Upstream:** https://github.com/1-N-2-Dis/GuidHer/tree/main/fmd
- **Commit:** 454169728420ed8d359b1c880f8ccd202f61a247, dated 2026-08-08
- **Version:** 4.6.0 in `VERSION`. `manifest.json` still says 4.5.0.
- **Copied on:** 2026-09-29. The 74 files match that commit byte for byte, checked against git's blob hashes. One file has a new name:
  - `examples/sample-recon-ai/AGENTS.md` is now `AGENTS.example.md`. Kiro loads every `AGENTS.md` in a workspace as steering, so under its original name the example project's rules would be added to every Kiro session here. Keep the new name if you copy this folder into a project.
- **This file** is not part of FMD.
- **License:** the repository has no license file, so the author keeps all rights. FMD's README tells teams to copy it into their own projects. Use it that way, and don't publish or share a modified version without asking the author.
- **To update:** download the `fmd` folder again from the upstream link and repeat the rename.
