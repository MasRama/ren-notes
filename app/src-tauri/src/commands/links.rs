use renotes_core::features::attachments;
use serde::Serialize;
use tauri::State;
use url::Url;

use super::{AppState, CmdError, CmdResult};
use crate::link_preview;

/// What a link card shows. The picture is stored as an attachment, so the
/// card needs no network once made.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LinkPreview {
    url: String,
    title: Option<String>,
    site: String,
    image_id: Option<String>,
}

/// Fetches a web page's title, site and picture; `None` when the page
/// cannot be read.
#[tauri::command]
pub async fn link_preview(
    state: State<'_, AppState>,
    url: String,
) -> CmdResult<Option<LinkPreview>> {
    let page = Url::parse(&url)
        .ok()
        .filter(|u| matches!(u.scheme(), "http" | "https"))
        .ok_or_else(|| CmdError::invalid("not a web address"))?;
    let fetched = tauri::async_runtime::spawn_blocking({
        let page = page.clone();
        move || link_preview::preview(&page)
    })
    .await
    .ok()
    .flatten();
    let Some(fetched) = fetched else {
        return Ok(None);
    };
    let image_id = fetched.image.and_then(|(bytes, ext)| {
        let mut library = state.lock();
        let root = library.root().to_owned();
        let name = format!("link-preview.{ext}");
        attachments::add(&root, library.db_mut(), &bytes, &name)
            .ok()
            .map(|a| a.id)
    });
    Ok(Some(LinkPreview {
        url,
        title: fetched.meta.title,
        site: fetched.meta.site,
        image_id,
    }))
}
