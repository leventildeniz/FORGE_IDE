use html2md::parse_html;
use reqwest;
use scraper::{Html, Selector};
use std::path::Path;

pub async fn search_web(query: &str) -> Result<String, String> {
    let client = reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
        .build()
        .map_err(|e| e.to_string())?;

    let encoded_query = urlencoding::encode(query);
    let url = format!("https://html.duckduckgo.com/html/?q={}", encoded_query);

    let response = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("Failed to search: {}", e))?;

    let html = response
        .text()
        .await
        .map_err(|e| format!("Failed to read response body: {}", e))?;

    let document = Html::parse_document(&html);
    let result_selector = Selector::parse(".result").unwrap();
    let title_selector = Selector::parse(".result__title").unwrap();
    let snippet_selector = Selector::parse(".result__snippet").unwrap();
    let url_selector = Selector::parse(".result__url").unwrap();

    let mut results = String::new();
    results.push_str(&format!("### Web Search Results for '{}':\n\n", query));

    let mut found = false;
    for (i, element) in document.select(&result_selector).take(10).enumerate() {
        let title = element
            .select(&title_selector)
            .next()
            .map(|el| el.text().collect::<Vec<_>>().join(" ").trim().to_string())
            .unwrap_or_else(|| "No Title".to_string());

        let snippet = element
            .select(&snippet_selector)
            .next()
            .map(|el| el.text().collect::<Vec<_>>().join(" ").trim().to_string())
            .unwrap_or_else(|| "No snippet available".to_string());

        let url = element
            .select(&url_selector)
            .next()
            .map(|el| el.text().collect::<Vec<_>>().join("").trim().to_string())
            .unwrap_or_else(|| "No URL".to_string());

        let display_url = if url.starts_with("http") {
            url
        } else {
            format!("https://{}", url)
        };

        results.push_str(&format!(
            "{}. **{}**\n   - URL: {}\n   - Snippet: {}\n\n",
            i + 1,
            title,
            display_url,
            snippet
        ));
        found = true;
    }

    if found {
        Ok(results)
    } else {
        Ok(format!("No results found on the web for '{}'.", query))
    }
}

pub async fn scrape_url(url: &str) -> Result<String, String> {
    // 1. Fetch the HTML
    let client = reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
        .build()
        .map_err(|e| e.to_string())?;

    let response = client
        .get(url)
        .send()
        .await
        .map_err(|e| format!("Failed to fetch URL: {}", e))?;

    let html = response
        .text()
        .await
        .map_err(|e| format!("Failed to read response body: {}", e))?;

    // 2. Parse HTML and clean up noise (DOM Purify)
    let document = Html::parse_document(&html);

    // Create a new string to hold the cleaned HTML
    let mut cleaned_html = String::new();

    // Try to find the main content area first. Fallback to body.
    let content_selectors = ["article", "main", ".content", "#content", ".post", "body"];

    let mut target_element = None;
    for selector_str in content_selectors {
        if let Ok(selector) = Selector::parse(selector_str) {
            if let Some(el) = document.select(&selector).next() {
                target_element = Some(el);
                break;
            }
        }
    }

    if let Some(element) = target_element {
        // We will do a basic string manipulation to remove common noisy tags
        // since `scraper` crate is read-only and doesn't support DOM mutation easily.
        let raw_inner = element.html();

        // Simple regex-like removals (Rust standard library doesn't have regex built-in,
        // so we'll do naive block removals for scripts and styles to prevent them from showing up in markdown)
        let no_scripts = remove_html_tags_with_content(&raw_inner, "script");
        let no_styles = remove_html_tags_with_content(&no_scripts, "style");
        let no_navs = remove_html_tags_with_content(&no_styles, "nav");
        let no_footers = remove_html_tags_with_content(&no_navs, "footer");
        let no_headers = remove_html_tags_with_content(&no_footers, "header");
        let no_asides = remove_html_tags_with_content(&no_headers, "aside");

        cleaned_html = no_asides;
    } else {
        cleaned_html = html; // Fallback to raw if nothing matches
    }

    // 3. Convert to Markdown
    let markdown = parse_html(&cleaned_html);

    // 4. Add a small header indicating the source
    let final_content = format!("Source URL: {}\n\n{}", url, markdown);

    Ok(final_content)
}

// Helper function to naively remove tags and their inner content
fn remove_html_tags_with_content(html: &str, tag: &str) -> String {
    let mut result = String::with_capacity(html.len());
    let open_tag_prefix = format!("<{}", tag);
    let close_tag = format!("</{}>", tag);

    let mut current_idx = 0;
    while let Some(start_idx) = html[current_idx..].find(&open_tag_prefix) {
        let absolute_start = current_idx + start_idx;
        result.push_str(&html[current_idx..absolute_start]);

        // Find where this tag ends
        if let Some(end_idx) = html[absolute_start..].find(&close_tag) {
            current_idx = absolute_start + end_idx + close_tag.len();
        } else {
            // Malformed HTML, just skip the open tag prefix and continue
            current_idx = absolute_start + 1;
        }
    }

    result.push_str(&html[current_idx..]);
    result
}

pub fn get_knowledge_base_path(project_root: &str, topic: Option<&str>) -> String {
    let base = project_root.trim_end_matches(&['/', '\\'][..]);

    if let Some(t) = topic {
        let safe_topic = t.replace(|c: char| !c.is_alphanumeric() && c != '_' && c != '-', "_");
        format!("{}/.forge/knowledge/{}.md", base, safe_topic)
    } else {
        format!("{}/.forge/knowledge", base)
    }
}

pub async fn run_code_agent(action: &str, project_root: &str) -> Result<String, String> {
    let base = project_root.trim_end_matches(&['/', '\\'][..]);

    if action.starts_with("tree") {
        // Build a recursive directory tree
        // For simplicity right now, we can use `walkdir` or standard fs traversal
        // Since we don't want to add a new crate if we can avoid it, we'll implement a basic walk.

        let path_to_walk = if action.len() > 5 {
            let relative_path = action[4..].trim();
            format!("{}/{}", base, relative_path)
        } else {
            base.to_string()
        };

        let tree_str = build_dir_tree(&path_to_walk, 0, 3)?; // max depth 3 to avoid overflow
        Ok(format!(
            "Directory Tree for {}:\n```\n{}\n```",
            path_to_walk, tree_str
        ))
    } else if action.starts_with("read") {
        let path_part = action[4..].trim();
        let target_path = format!("{}/{}", base, path_part);

        match std::fs::read_to_string(&target_path) {
            Ok(content) => {
                // Truncate to 1000 lines max to protect context
                let lines: Vec<&str> = content.lines().collect();
                if lines.len() > 1000 {
                    let truncated = lines[..1000].join("\n");
                    Ok(format!(
                        "File: {}\n```\n{}\n\n... [TRUNCATED - >1000 lines] ...\n```",
                        path_part, truncated
                    ))
                } else {
                    Ok(format!("File: {}\n```\n{}\n```", path_part, content))
                }
            }
            Err(e) => Err(format!("Failed to read {}: {}", path_part, e)),
        }
    } else {
        Err(format!("Unknown Code Agent action: {}", action))
    }
}

// Simple recursive directory tree builder for the Code Agent
fn build_dir_tree(dir: &str, depth: usize, max_depth: usize) -> Result<String, String> {
    if depth > max_depth {
        return Ok("... [Max Depth Reached]\n".to_string());
    }

    let mut result = String::new();
    let prefix = "  ".repeat(depth);

    if let Ok(entries) = std::fs::read_dir(dir) {
        let mut paths: Vec<_> = entries.filter_map(|e| e.ok()).collect();
        paths.sort_by_key(|e| e.file_name());

        for entry in paths {
            let file_name = entry
                .file_name()
                .into_string()
                .unwrap_or_else(|_| "Unknown".to_string());

            // Ignore common noise
            if file_name == "node_modules"
                || file_name == "target"
                || file_name == ".git"
                || file_name == ".forge"
            {
                continue;
            }

            if let Ok(file_type) = entry.file_type() {
                if file_type.is_dir() {
                    result.push_str(&format!("{}📁 {}/\n", prefix, file_name));
                    if let Ok(sub_tree) =
                        build_dir_tree(entry.path().to_str().unwrap_or(""), depth + 1, max_depth)
                    {
                        result.push_str(&sub_tree);
                    }
                } else {
                    result.push_str(&format!("{}📄 {}\n", prefix, file_name));
                }
            }
        }
    }

    Ok(result)
}
