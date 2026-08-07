use serde_json::{Value, json};
use std::process::Command;
use tokio;

pub async fn get_git_status(
    project_root: &str,
) -> Result<(String, Vec<Value>, Option<String>), String> {
    // Check if it's a git repo by checking branch (fails gracefully on new empty repos without commits via show-current)
    let is_repo_cmd = tokio::process::Command::new("git")
        .arg("rev-parse")
        .arg("--is-inside-work-tree")
        .current_dir(project_root)
        .output()
        .await
        .map_err(|e| format!("Failed to check git status: {}", e))?;

    if !is_repo_cmd.status.success() {
        return Err("Not a git repository".to_string());
    }

    // Get branch
    let branch_cmd = tokio::process::Command::new("git")
        .arg("branch")
        .arg("--show-current")
        .current_dir(project_root)
        .output()
        .await
        .unwrap(); // We know it's a repo now

    let branch = if branch_cmd.status.success() {
        let b = String::from_utf8_lossy(&branch_cmd.stdout)
            .trim()
            .to_string();
        if b.is_empty() {
            "main (No commits yet)".to_string()
        } else {
            b
        }
    } else {
        "Unknown".to_string()
    };

    // Get remote
    let remote_cmd = tokio::process::Command::new("git")
        .arg("remote")
        .arg("get-url")
        .arg("origin")
        .current_dir(project_root)
        .output()
        .await
        .unwrap();

    let remote_url = if remote_cmd.status.success() {
        let raw_url = String::from_utf8_lossy(&remote_cmd.stdout)
            .trim()
            .to_string();

        // Mask credentials in URL if present (e.g. https://user:token@github.com -> https://github.com)
        let masked_url = if raw_url.starts_with("http") && raw_url.contains('@') {
            if let Some(at_idx) = raw_url.rfind('@') {
                if let Some(slash_slash_idx) = raw_url.find("://") {
                    format!(
                        "{}://{}",
                        &raw_url[..slash_slash_idx],
                        &raw_url[at_idx + 1..]
                    )
                } else {
                    raw_url
                }
            } else {
                raw_url
            }
        } else {
            raw_url
        };

        Some(masked_url)
    } else {
        None
    };

    // Get status
    let status_cmd = tokio::process::Command::new("git")
        .arg("status")
        .arg("--porcelain")
        .current_dir(project_root)
        .output()
        .await
        .unwrap();

    let mut files = Vec::new();
    if status_cmd.status.success() {
        let status_str = String::from_utf8_lossy(&status_cmd.stdout);
        for line in status_str.lines() {
            if line.len() > 3 {
                let status = &line[0..2];
                let file = line[3..].trim();
                files.push(json!({
                    "status": status, // Preserve spaces for porcelain format
                    "file": file
                }));
            }
        }
    }

    Ok((branch, files, remote_url))
}

pub async fn get_git_diff(project_root: &str) -> Result<String, String> {
    // Unstaged changes
    let mut diff_cmd = tokio::process::Command::new("git")
        .arg("diff")
        .current_dir(project_root)
        .output()
        .await
        .map_err(|e| format!("Failed to get git diff: {}", e))?;

    let mut diff = String::from_utf8_lossy(&diff_cmd.stdout).to_string();

    // Staged changes
    let diff_staged_cmd = tokio::process::Command::new("git")
        .arg("diff")
        .arg("--staged")
        .current_dir(project_root)
        .output()
        .await
        .map_err(|e| format!("Failed to get git diff --staged: {}", e))?;

    diff.push_str(&String::from_utf8_lossy(&diff_staged_cmd.stdout));

    // Untracked files? Maybe just  is enough for generating a commit message if we plan to  anyway.
    // If the user adds untracked files, we should show them. For a quick commit message, this is usually enough.

    // Limit diff size to prevent OOM
    let char_limit = 15000;
    if diff.len() > char_limit {
        diff = format!("{}... [TRUNCATED]", &diff[..char_limit]);
    }

    Ok(diff)
}

pub async fn commit_and_push(project_root: &str, message: &str) -> Result<String, String> {
    // 0. Set local git config if not set, to prevent "Author identity unknown" errors
    // We try to configure a fallback identity specifically for this local repo if one doesn't exist.
    let check_email = tokio::process::Command::new("git")
        .arg("config")
        .arg("user.email")
        .current_dir(project_root)
        .output()
        .await;

    let needs_fallback = match check_email {
        Ok(out) => out.stdout.is_empty(),
        Err(_) => true,
    };

    if needs_fallback {
        // Set dummy fallback identity
        let _ = tokio::process::Command::new("git")
            .arg("config")
            .arg("user.email")
            .arg("forge@local.ai")
            .current_dir(project_root)
            .output()
            .await;

        let _ = tokio::process::Command::new("git")
            .arg("config")
            .arg("user.name")
            .arg("Forge IDE")
            .current_dir(project_root)
            .output()
            .await;
    }

    // 1. git add .
    let add = tokio::process::Command::new("git")
        .arg("add")
        .arg(".")
        .current_dir(project_root)
        .output()
        .await
        .map_err(|e| format!("Failed to git add: {}", e))?;

    if !add.status.success() {
        return Err(String::from_utf8_lossy(&add.stderr).to_string());
    }

    // 2. git commit -m
    let commit = tokio::process::Command::new("git")
        .arg("commit")
        .arg("-m")
        .arg(message)
        .current_dir(project_root)
        .output()
        .await
        .map_err(|e| format!("Failed to git commit: {}", e))?;

    let commit_out = String::from_utf8_lossy(&commit.stdout).to_string();
    let commit_err = String::from_utf8_lossy(&commit.stderr).to_string();

    if !commit.status.success() {
        if commit_out.contains("Author identity unknown")
            || commit_err.contains("Author identity unknown")
        {
            return Err("Git identity not configured.\nPlease open the terminal and run:\ngit config user.email \"you@example.com\"\ngit config user.name \"Your Name\"".to_string());
        }
        if !commit_out.contains("nothing to commit") && !commit_err.contains("nothing to commit") {
            return Err(format!("Commit failed:\n{}\n{}", commit_out, commit_err));
        }
    }

    // 3. Check if origin exists before pushing
    let check_remote = tokio::process::Command::new("git")
        .arg("remote")
        .current_dir(project_root)
        .output()
        .await
        .map_err(|e| format!("Failed to check remotes: {}", e))?;

    let remotes = String::from_utf8_lossy(&check_remote.stdout);
    if !remotes.contains("origin") {
        // Just return the commit success if there's no remote configured
        return Ok(format!("Local commit successful:\n{}", commit_out));
    }

    // 4. git push
    let push = tokio::process::Command::new("git")
        .env("GIT_TERMINAL_PROMPT", "0") // Disable terminal prompts for password
        .env("GIT_ASKPASS", "echo") // Disable askpass helper
        .env("GIT_SSH_COMMAND", "ssh -o BatchMode=yes") // Prevent SSH from hanging asking for yes/no or passphrases
        .arg("push")
        .arg("-u")
        .arg("origin")
        .arg("HEAD")
        .current_dir(project_root)
        .output()
        .await
        .map_err(|e| format!("Failed to git push: {}", e))?;

    if !push.status.success() {
        let push_err = String::from_utf8_lossy(&push.stderr);
        if push_err.contains("src refspec HEAD does not match any") {
            return Err("Cannot push an empty repository. Make sure you have at least one file committed before pushing.".to_string());
        }
        if push_err.contains("could not read Username")
            || push_err.contains("Authentication failed")
            || push_err.to_lowercase().contains("401")
            || push_err.to_lowercase().contains("403")
        {
            return Err("Authentication failed: Your GitHub Token is invalid, expired, or doesn't have the required permissions (needs 'repo' scope). Please remove the remote and try again with a valid token.".to_string());
        }
        return Err(format!("Commit successful, but Push failed:\n{}", push_err));
    }

    Ok(format!(
        "{}\n{}",
        commit_out,
        String::from_utf8_lossy(&push.stdout)
    ))
}

pub async fn init_repo(project_root: &str) -> Result<(), String> {
    let cmd = tokio::process::Command::new("git")
        .arg("init")
        .current_dir(project_root)
        .output()
        .await
        .map_err(|e| format!("Failed to init git: {}", e))?;

    if cmd.status.success() {
        Ok(())
    } else {
        Err(String::from_utf8_lossy(&cmd.stderr).to_string())
    }
}

pub async fn add_remote(project_root: &str, remote_url: &str) -> Result<(), String> {
    let check = tokio::process::Command::new("git")
        .arg("remote")
        .current_dir(project_root)
        .output()
        .await
        .map_err(|e| format!("Failed to check remotes: {}", e))?;

    let remotes = String::from_utf8_lossy(&check.stdout);

    let mut cmd = tokio::process::Command::new("git");
    cmd.current_dir(project_root);

    if remotes.contains("origin") {
        cmd.arg("remote")
            .arg("set-url")
            .arg("origin")
            .arg(remote_url);
    } else {
        cmd.arg("remote").arg("add").arg("origin").arg(remote_url);
    }

    let out = cmd
        .output()
        .await
        .map_err(|e| format!("Failed to set remote: {}", e))?;

    if out.status.success() {
        Ok(())
    } else {
        Err(String::from_utf8_lossy(&out.stderr).to_string())
    }
}

pub async fn remove_remote(project_root: &str) -> Result<(), String> {
    let _out = tokio::process::Command::new("git")
        .arg("remote")
        .arg("remove")
        .arg("origin")
        .current_dir(project_root)
        .output()
        .await
        .map_err(|e| format!("Failed to execute git remote remove: {}", e))?;

    // We ignore success/failure because if it fails, it usually means "origin" doesn't exist, which is fine
    Ok(())
}

pub async fn pull(project_root: &str) -> Result<String, String> {
    // 1. Check if origin exists before pulling
    let check_remote = tokio::process::Command::new("git")
        .arg("remote")
        .current_dir(project_root)
        .output()
        .await
        .map_err(|e| format!("Failed to check remotes: {}", e))?;

    let remotes = String::from_utf8_lossy(&check_remote.stdout);
    if !remotes.contains("origin") {
        return Err("No remote 'origin' configured. Cannot pull.".to_string());
    }

    // Set local git config if not set, to prevent "Author identity unknown" errors during rebase/commit
    let check_email = tokio::process::Command::new("git")
        .arg("config")
        .arg("user.email")
        .current_dir(project_root)
        .output()
        .await;

    let needs_fallback = match check_email {
        Ok(out) => out.stdout.is_empty(),
        Err(_) => true,
    };

    if needs_fallback {
        let _ = tokio::process::Command::new("git")
            .args(["config", "user.email", "forge@local.ai"])
            .current_dir(project_root)
            .output()
            .await;
        let _ = tokio::process::Command::new("git")
            .args(["config", "user.name", "Forge IDE"])
            .current_dir(project_root)
            .output()
            .await;
    }

    // Unstage everything just in case to fix "fatal: Updating an unborn branch with changes added to the index."
    let _ = tokio::process::Command::new("git")
        .arg("reset")
        .current_dir(project_root)
        .output()
        .await;

    // Check if the repo has any commits yet. If not (unborn branch), stash will fail.
    // If it's an unborn branch and we have untracked files, pull will fail.
    // Best workaround: make an initial commit.
    let head_check = tokio::process::Command::new("git")
        .args(["rev-parse", "HEAD"])
        .current_dir(project_root)
        .output()
        .await;
    let has_commits = head_check.map_or(false, |out| out.status.success());

    if !has_commits {
        // Create an initial commit to allow pulling (rebase) over untracked files safely
        let _ = tokio::process::Command::new("git")
            .args(["add", "."])
            .current_dir(project_root)
            .output()
            .await;
        let _ = tokio::process::Command::new("git")
            .args(["commit", "-m", "forge-auto-initial-commit"])
            .current_dir(project_root)
            .output()
            .await;
    }

    // Automatically stash changes including untracked files to prevent overwrite aborts
    // (e.g. .forge/knowledge/context.md auto-generated locally conflicting with remote)
    let stash_cmd = tokio::process::Command::new("git")
        .args([
            "stash",
            "push",
            "--include-untracked",
            "-m",
            "forge-auto-stash",
        ])
        .current_dir(project_root)
        .output()
        .await;

    let stashed = match stash_cmd {
        Ok(out) => {
            let stdout = String::from_utf8_lossy(&out.stdout);
            !stdout.contains("No local changes to save")
        }
        Err(_) => false,
    };

    // 2. git pull
    let pull = tokio::process::Command::new("git")
        .env("GIT_TERMINAL_PROMPT", "0") // Disable terminal prompts
        .env("GIT_ASKPASS", "echo")
        .env("GIT_SSH_COMMAND", "ssh -o BatchMode=yes")
        .arg("pull")
        .arg("--rebase") // Pull with rebase to avoid unnecessary merge commits
        .arg("origin")
        .arg("HEAD")
        .current_dir(project_root)
        .output()
        .await
        .map_err(|e| format!("Failed to git pull: {}", e))?;

    let pull_out = String::from_utf8_lossy(&pull.stdout).to_string();
    let pull_err = String::from_utf8_lossy(&pull.stderr).to_string();

    let mut final_out = pull_out.clone();

    // Restore stashed changes
    if stashed {
        let pop = tokio::process::Command::new("git")
            .args(["stash", "pop"])
            .current_dir(project_root)
            .output()
            .await;

        if let Ok(out) = pop {
            if out.status.success() {
                final_out.push_str("\n\nRestored local changes successfully.");
            } else {
                final_out.push_str("\n\nNote: Local changes were stashed but couldn't be automatically popped due to conflicts. Please resolve them via 'git stash pop'.");
            }
        }
    }

    if !pull.status.success() {
        if pull_err.contains("could not read Username")
            || pull_err.contains("Authentication failed")
            || pull_err.to_lowercase().contains("401")
            || pull_err.to_lowercase().contains("403")
        {
            return Err("Authentication failed: Your GitHub Token is invalid, expired, or doesn't have the required permissions.".to_string());
        }
        // If no changes or other errors, return error
        return Err(format!("Pull failed:\n{}", pull_err));
    }

    Ok(final_out)
}
