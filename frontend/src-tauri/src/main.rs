#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::{
  collections::{HashSet, VecDeque},
  env,
  fs,
  path::{Path, PathBuf},
  process::Command,
};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct DesktopGame {
  id: String,
  name: String,
  platform: String,
  #[serde(skip_serializing_if = "Option::is_none")]
  app_id: Option<String>,
  #[serde(skip_serializing_if = "Option::is_none")]
  app_name: Option<String>,
  #[serde(skip_serializing_if = "Option::is_none")]
  game_name: Option<String>,
  #[serde(skip_serializing_if = "Option::is_none")]
  install_path: Option<String>,
  #[serde(skip_serializing_if = "Option::is_none")]
  executable_path: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct LaunchResult {
  success: bool,
  platform: String,
  id: String,
  message: String,
  #[serde(skip_serializing_if = "Option::is_none")]
  launch_uri: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "PascalCase")]
struct EpicManifest {
  #[serde(default)]
  app_name: String,
  #[serde(default)]
  display_name: String,
  #[serde(default, alias = "InstallPath")]
  install_location: String,
}

#[derive(Debug, Clone)]
struct GogInstallInfo {
  game_id: Option<String>,
  name: Option<String>,
}

#[tauri::command]
fn launch_game(platform: String, id: Value, app_name: Option<String>) -> Result<LaunchResult, String> {
  let normalized_platform = platform.trim().to_ascii_lowercase();
  let identifier = normalize_identifier(&id)?;

  if identifier.is_empty() {
    return Err("Missing game identifier".to_string());
  }

  match normalized_platform.as_str() {
    "steam" => launch_steam(&identifier),
    "epic" => launch_epic(&identifier, app_name.as_deref()),
    "gog" => launch_gog(&identifier, app_name.as_deref()),
    _ => Err(format!("Unsupported platform: {platform}")),
  }
}

#[tauri::command]
fn get_epic_library() -> Vec<DesktopGame> {
  read_epic_library()
}

#[tauri::command]
fn get_gog_library() -> Vec<DesktopGame> {
  read_gog_library()
}

fn normalize_identifier(id: &Value) -> Result<String, String> {
  match id {
    Value::String(value) => Ok(value.trim().to_string()),
    Value::Number(value) => Ok(value.to_string()),
    Value::Bool(value) => Ok(value.to_string()),
    Value::Null => Err("Missing game identifier".to_string()),
    _ => Err("Unsupported game identifier".to_string()),
  }
}

fn launch_steam(identifier: &str) -> Result<LaunchResult, String> {
  if !identifier.chars().all(|char| char.is_ascii_digit()) {
    return Err("Invalid Steam app id".to_string());
  }

  let launch_uri = format!("steam://rungameid/{identifier}");
  open_uri(&launch_uri)?;

  Ok(LaunchResult {
    success: true,
    platform: "steam".to_string(),
    id: identifier.to_string(),
    message: "Steam launch command sent".to_string(),
    launch_uri: Some(launch_uri),
  })
}

fn launch_epic(identifier: &str, app_name: Option<&str>) -> Result<LaunchResult, String> {
  let manifests = read_epic_manifests();
  let query_primary = identifier.trim().to_ascii_lowercase();
  let query_secondary = app_name.unwrap_or("").trim().to_ascii_lowercase();

  let app_id = manifests
    .iter()
    .find(|manifest| epic_manifest_matches(manifest, &query_primary, &query_secondary))
    .map(|manifest| manifest.app_name.trim().to_string())
    .filter(|value| !value.is_empty())
    .or_else(|| {
      if query_primary.is_empty() {
        None
      } else {
        Some(identifier.trim().to_string())
      }
    })
    .ok_or_else(|| "Epic game not found in local manifests".to_string())?;

  let launch_uri = format!("com.epicgames.launcher://apps/{app_id}?action=launch&silent=true");
  open_uri(&launch_uri)?;

  Ok(LaunchResult {
    success: true,
    platform: "epic".to_string(),
    id: app_id,
    message: "Epic launch command sent".to_string(),
    launch_uri: Some(launch_uri),
  })
}

fn launch_gog(identifier: &str, app_name: Option<&str>) -> Result<LaunchResult, String> {
  let query_primary = identifier.trim().to_ascii_lowercase();
  let query_secondary = app_name.unwrap_or("").trim().to_ascii_lowercase();
  let library = read_gog_library();

  if let Some(game) = library
    .iter()
    .find(|game| gog_game_matches(game, &query_primary, &query_secondary))
  {
    if let Some(executable_path) = game
      .executable_path
      .as_deref()
      .map(PathBuf::from)
      .filter(|path| path.exists())
    {
      let install_path = game.install_path.as_deref().map(PathBuf::from);
      if spawn_executable(&executable_path, install_path.as_deref()).is_ok() {
        return Ok(LaunchResult {
          success: true,
          platform: "gog".to_string(),
          id: game.id.clone(),
          message: format!("Launched {}", game.name),
          launch_uri: None,
        });
      }
    }

    if let Some(game_id) = game.app_id.as_deref().filter(|value| value.chars().all(|char| char.is_ascii_digit())) {
      let launch_uri = format!("goggalaxy://launch/{game_id}");
      open_uri(&launch_uri)?;

      return Ok(LaunchResult {
        success: true,
        platform: "gog".to_string(),
        id: game.id.clone(),
        message: "GOG Galaxy launch command sent".to_string(),
        launch_uri: Some(launch_uri),
      });
    }
  }

  let direct_path = PathBuf::from(identifier);
  if direct_path.exists() && direct_path.is_file() {
    spawn_executable(&direct_path, direct_path.parent())?;

    return Ok(LaunchResult {
      success: true,
      platform: "gog".to_string(),
      id: identifier.to_string(),
      message: "Executable started".to_string(),
      launch_uri: None,
    });
  }

  if identifier.chars().all(|char| char.is_ascii_digit()) {
    let launch_uri = format!("goggalaxy://launch/{identifier}");
    open_uri(&launch_uri)?;

    return Ok(LaunchResult {
      success: true,
      platform: "gog".to_string(),
      id: identifier.to_string(),
      message: "GOG Galaxy launch command sent".to_string(),
      launch_uri: Some(launch_uri),
    });
  }

  Err("GOG game not found in local installs".to_string())
}

fn read_epic_library() -> Vec<DesktopGame> {
  let mut games = read_epic_manifests()
    .into_iter()
    .map(|manifest| {
      let app_name = manifest.app_name.trim().to_string();
      let display_name = preferred_epic_name(&manifest);

      DesktopGame {
        id: app_name.clone(),
        name: display_name.clone(),
        platform: "epic".to_string(),
        app_id: Some(app_name.clone()),
        app_name: Some(app_name),
        game_name: Some(display_name),
        install_path: non_empty(manifest.install_location),
        executable_path: None,
      }
    })
    .collect::<Vec<_>>();

  sort_games(&mut games);
  games
}

fn read_epic_manifests() -> Vec<EpicManifest> {
  let Some(program_data) = env::var_os("PROGRAMDATA") else {
    return Vec::new();
  };

  let manifest_dir = PathBuf::from(program_data).join("Epic").join("EpicGamesLauncher").join("Data").join("Manifests");
  let Ok(entries) = fs::read_dir(manifest_dir) else {
    return Vec::new();
  };

  let mut manifests = Vec::new();

  for entry in entries.flatten() {
    let path = entry.path();
    if !path.is_file() {
      continue;
    }
    if !path
      .extension()
      .and_then(|value| value.to_str())
      .is_some_and(|value| value.eq_ignore_ascii_case("item"))
    {
      continue;
    }

    let Ok(raw_manifest) = fs::read_to_string(path) else {
      continue;
    };
    let Ok(manifest) = serde_json::from_str::<EpicManifest>(&raw_manifest) else {
      continue;
    };

    if manifest.app_name.trim().is_empty() && manifest.display_name.trim().is_empty() {
      continue;
    }

    manifests.push(manifest);
  }

  manifests
}

fn read_gog_library() -> Vec<DesktopGame> {
  let mut games = Vec::new();
  let mut seen = HashSet::new();

  for root in gog_root_candidates() {
    let Ok(entries) = fs::read_dir(&root) else {
      continue;
    };

    for entry in entries.flatten() {
      let install_path = entry.path();
      if !install_path.is_dir() {
        continue;
      }

      let folder_name = entry.file_name().to_string_lossy().trim().to_string();
      if folder_name.is_empty() {
        continue;
      }

      let info = read_gog_info(&install_path);
      let product_id = info.as_ref().and_then(|value| value.game_id.clone());
      let game_name = info
        .as_ref()
        .and_then(|value| value.name.clone())
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| folder_name.clone());
      let executable_path = find_best_executable(&install_path).map(|path| path.to_string_lossy().to_string());
      let id = product_id.clone().unwrap_or_else(|| folder_name.clone());
      let dedupe_key = format!(
        "{}::{}",
        id.trim().to_ascii_lowercase(),
        install_path.to_string_lossy().to_ascii_lowercase()
      );

      if !seen.insert(dedupe_key) {
        continue;
      }

      games.push(DesktopGame {
        id,
        name: game_name.clone(),
        platform: "gog".to_string(),
        app_id: product_id,
        app_name: Some(folder_name),
        game_name: Some(game_name),
        install_path: Some(install_path.to_string_lossy().to_string()),
        executable_path,
      });
    }
  }

  sort_games(&mut games);
  games
}

fn read_gog_info(install_path: &Path) -> Option<GogInstallInfo> {
  let entries = fs::read_dir(install_path).ok()?;

  for entry in entries.flatten() {
    let path = entry.path();
    if !path.is_file() {
      continue;
    }

    let filename = entry.file_name().to_string_lossy().to_ascii_lowercase();
    if !(filename.starts_with("goggame-") && filename.ends_with(".info")) {
      continue;
    }

    let raw_info = fs::read_to_string(path).ok()?;
    let value = serde_json::from_str::<Value>(&raw_info).ok()?;

    return Some(GogInstallInfo {
      game_id: extract_json_string(value.get("gameId"))
        .or_else(|| extract_json_string(value.get("gameID")))
        .or_else(|| extract_json_string(value.get("id")))
        .or_else(|| extract_json_string(value.get("rootGameID"))),
      name: extract_json_string(value.get("name"))
        .or_else(|| extract_json_string(value.get("title")))
        .or_else(|| extract_json_string(value.get("gameTitle"))),
    });
  }

  None
}

fn extract_json_string(value: Option<&Value>) -> Option<String> {
  match value {
    Some(Value::String(raw)) => {
      let trimmed = raw.trim();
      if trimmed.is_empty() {
        None
      } else {
        Some(trimmed.to_string())
      }
    }
    Some(Value::Number(raw)) => Some(raw.to_string()),
    Some(Value::Bool(raw)) => Some(raw.to_string()),
    _ => None,
  }
}

fn gog_root_candidates() -> Vec<PathBuf> {
  let mut candidates = Vec::new();

  if let Some(program_files) = env::var_os("PROGRAMFILES") {
    candidates.push(PathBuf::from(program_files).join("GOG Galaxy").join("Games"));
  }

  if let Some(program_files_x86) = env::var_os("PROGRAMFILES(X86)") {
    candidates.push(PathBuf::from(program_files_x86).join("GOG Galaxy").join("Games"));
  }

  candidates.push(PathBuf::from(r"C:\GOG Games"));

  if let Some(public_user) = env::var_os("PUBLIC") {
    candidates.push(PathBuf::from(public_user).join("Games"));
  }

  if let Some(user_profile) = env::var_os("USERPROFILE") {
    candidates.push(PathBuf::from(user_profile).join("Games"));
  }

  let mut seen = HashSet::new();

  candidates
    .into_iter()
    .filter(|path| seen.insert(path.to_string_lossy().to_ascii_lowercase()))
    .collect()
}

fn find_best_executable(install_path: &Path) -> Option<PathBuf> {
  let mut queue = VecDeque::new();
  let mut candidates = Vec::new();

  queue.push_back((install_path.to_path_buf(), 0usize));

  while let Some((directory, depth)) = queue.pop_front() {
    let Ok(entries) = fs::read_dir(directory) else {
      continue;
    };

    for entry in entries.flatten() {
      let path = entry.path();
      if path.is_dir() {
        if depth < 2 {
          queue.push_back((path, depth + 1));
        }
        continue;
      }

      if !path
        .extension()
        .and_then(|value| value.to_str())
        .is_some_and(|value| value.eq_ignore_ascii_case("exe"))
      {
        continue;
      }

      let score = executable_score(&path, depth);
      if score > -500 {
        candidates.push((score, path));
      }
    }
  }

  candidates.sort_by(|left, right| {
    right
      .0
      .cmp(&left.0)
      .then_with(|| left.1.to_string_lossy().len().cmp(&right.1.to_string_lossy().len()))
  });

  candidates.into_iter().next().map(|(_, path)| path)
}

fn executable_score(path: &Path, depth: usize) -> i32 {
  let filename = path.file_name().and_then(|value| value.to_str()).unwrap_or("").to_ascii_lowercase();

  if filename.contains("unins")
    || filename.contains("uninstall")
    || filename.contains("setup")
    || filename.contains("config")
    || filename.contains("repair")
    || filename.contains("crash")
    || filename.contains("benchmark")
  {
    return -1000;
  }

  let mut score = 100 - (depth as i32 * 15);

  if filename.contains("start") || filename.contains("launch") || filename.contains("run") || filename.contains("game") {
    score += 50;
  }

  if filename.contains("launcher") {
    score -= 20;
  }

  score
}

fn epic_manifest_matches(manifest: &EpicManifest, primary_query: &str, secondary_query: &str) -> bool {
  let normalized_app_name = manifest.app_name.trim().to_ascii_lowercase();
  let normalized_display_name = manifest.display_name.trim().to_ascii_lowercase();
  let queries = [primary_query, secondary_query];

  for query in queries {
    if query.is_empty() {
      continue;
    }

    if normalized_app_name == query
      || normalized_display_name == query
      || normalized_app_name.contains(query)
      || normalized_display_name.contains(query)
    {
      return true;
    }
  }

  false
}

fn gog_game_matches(game: &DesktopGame, primary_query: &str, secondary_query: &str) -> bool {
  game_matches_query(game, primary_query) || (!secondary_query.is_empty() && game_matches_query(game, secondary_query))
}

fn game_matches_query(game: &DesktopGame, query: &str) -> bool {
  if query.is_empty() {
    return false;
  }

  let candidates = [
    game.id.as_str(),
    game.name.as_str(),
    game.app_id.as_deref().unwrap_or(""),
    game.app_name.as_deref().unwrap_or(""),
    game.game_name.as_deref().unwrap_or(""),
  ];

  for value in candidates {
    let normalized = value.trim().to_ascii_lowercase();
    if normalized.is_empty() {
      continue;
    }
    if normalized == query || normalized.contains(query) {
      return true;
    }
  }

  false
}

fn preferred_epic_name(manifest: &EpicManifest) -> String {
  let display_name = manifest.display_name.trim();
  if !display_name.is_empty() {
    return display_name.to_string();
  }

  let app_name = manifest.app_name.trim();
  if !app_name.is_empty() {
    return app_name.to_string();
  }

  "Epic Game".to_string()
}

fn non_empty(value: String) -> Option<String> {
  let trimmed = value.trim().to_string();
  if trimmed.is_empty() {
    None
  } else {
    Some(trimmed)
  }
}

fn sort_games(games: &mut [DesktopGame]) {
  games.sort_by(|left, right| left.name.to_ascii_lowercase().cmp(&right.name.to_ascii_lowercase()));
}

fn spawn_executable(executable_path: &Path, working_dir: Option<&Path>) -> Result<(), String> {
  let mut command = Command::new(executable_path);

  if let Some(directory) = working_dir.filter(|directory| directory.exists()) {
    command.current_dir(directory);
  } else if let Some(parent) = executable_path.parent() {
    command.current_dir(parent);
  }

  command
    .spawn()
    .map(|_| ())
    .map_err(|error| format!("Failed to start executable {}: {error}", executable_path.display()))
}

#[cfg(target_os = "windows")]
fn open_uri(uri: &str) -> Result<(), String> {
  Command::new("cmd")
    .arg("/C")
    .arg("start")
    .arg("")
    .arg(uri)
    .spawn()
    .map(|_| ())
    .map_err(|error| format!("Failed to open uri {uri}: {error}"))
}

#[cfg(target_os = "macos")]
fn open_uri(uri: &str) -> Result<(), String> {
  Command::new("open")
    .arg(uri)
    .spawn()
    .map(|_| ())
    .map_err(|error| format!("Failed to open uri {uri}: {error}"))
}

#[cfg(all(unix, not(target_os = "macos")))]
fn open_uri(uri: &str) -> Result<(), String> {
  Command::new("xdg-open")
    .arg(uri)
    .spawn()
    .map(|_| ())
    .map_err(|error| format!("Failed to open uri {uri}: {error}"))
}

fn main() {
  tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![launch_game, get_epic_library, get_gog_library])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
