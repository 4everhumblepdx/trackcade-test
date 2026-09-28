#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

SCHEMA = "trackcade-semantic-external-osf-inventory-v1"
API_BASE = "https://api.osf.io/v2"
DEFAULT_NODE_ID = "eydxk"
USER_AGENT = "trackcade-semantic-external-holdout-v1/1.0"


def canonical_url(value):
    if not isinstance(value, str) or not value:
        return None
    parts = urllib.parse.urlsplit(value)
    return urllib.parse.urlunsplit((parts.scheme, parts.netloc, parts.path, "", ""))


def get_json(url: str):
    req = urllib.request.Request(
        url,
        headers={"Accept": "application/vnd.api+json", "User-Agent": USER_AGENT},
        method="GET",
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            if resp.status != 200:
                raise RuntimeError(f"unexpected HTTP status {resp.status} for {url}")
            raw = resp.read()
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")[:500]
        raise RuntimeError(f"OSF HTTP {exc.code} for {url}: {body}") from exc
    except urllib.error.URLError as exc:
        raise RuntimeError(f"OSF transport failure for {url}: {exc.reason}") from exc
    try:
        parsed = json.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise RuntimeError(f"OSF returned non-JSON for {url}") from exc
    if not isinstance(parsed, dict):
        raise RuntimeError(f"OSF response is not an object for {url}")
    return parsed


def iter_pages(url: str):
    next_url = url
    seen = set()
    while next_url:
        if next_url in seen:
            raise RuntimeError(f"pagination cycle at {next_url}")
        seen.add(next_url)
        payload = get_json(next_url)
        data = payload.get("data")
        if not isinstance(data, list):
            raise RuntimeError(f"expected data array from {next_url}")
        for item in data:
            if not isinstance(item, dict):
                raise RuntimeError(f"non-object item from {next_url}")
            yield item
        links = payload.get("links") or {}
        nxt = links.get("next") if isinstance(links, dict) else None
        if isinstance(nxt, dict):
            nxt = nxt.get("href")
        next_url = nxt if isinstance(nxt, str) and nxt else None


def related_href(item: dict, relationship_name: str):
    relationships = item.get("relationships") or {}
    rel = relationships.get(relationship_name) if isinstance(relationships, dict) else None
    if not isinstance(rel, dict):
        return None
    links = rel.get("links") or {}
    related = links.get("related") if isinstance(links, dict) else None
    if isinstance(related, str):
        return related
    if isinstance(related, dict):
        href = related.get("href")
        return href if isinstance(href, str) else None
    return None


def normalize_extra(extra):
    if not isinstance(extra, dict):
        return {}
    keep = {}
    for key in ("hashes", "downloads"):
        value = extra.get(key)
        if value is not None:
            keep[key] = value
    return keep


def normalize_file(item: dict, provider: str, parent_path: str):
    attrs = item.get("attributes") or {}
    links = item.get("links") or {}
    if not isinstance(attrs, dict) or not isinstance(links, dict):
        raise RuntimeError("malformed OSF file object")

    name = attrs.get("name")
    kind = attrs.get("kind")
    if not isinstance(name, str) or not name:
        raise RuntimeError("OSF file object missing name")
    if kind not in {"file", "folder"}:
        raise RuntimeError(f"unsupported OSF file kind {kind!r} for {name!r}")

    rel_path = f"{parent_path}/{name}" if parent_path else name
    entry = {
        "provider": provider,
        "id": item.get("id"),
        "path": rel_path,
        "name": name,
        "kind": kind,
        "size": attrs.get("size"),
        "modified": attrs.get("modified"),
        "contentType": attrs.get("contentType") or attrs.get("content_type"),
        "extra": normalize_extra(attrs.get("extra")),
        "links": {
            "info": canonical_url(links.get("info") or links.get("self")),
            "download": canonical_url(links.get("download")),
            "html": canonical_url(links.get("html")),
        },
    }
    return entry


def provider_roots(node_id: str):
    payload = get_json(f"{API_BASE}/nodes/{node_id}/files/")
    data = payload.get("data")
    if not isinstance(data, list) or not data:
        raise RuntimeError("OSF node has no storage providers")
    roots = []
    for provider in data:
        pid = provider.get("id")
        if not isinstance(pid, str) or not pid:
            continue
        attrs = provider.get("attributes") or {}
        provider_name = attrs.get("name") if isinstance(attrs, dict) else None
        if not isinstance(provider_name, str) or not provider_name:
            provider_name = pid.rsplit(":", 1)[-1]
        links = provider.get("links") or {}
        files_url = links.get("files") if isinstance(links, dict) else None
        if not isinstance(files_url, str) or not files_url:
            files_url = f"{API_BASE}/nodes/{node_id}/files/{provider_name}/"
        roots.append((provider_name, files_url))
    if not roots:
        raise RuntimeError("OSF node exposes no usable provider roots")
    return roots


def walk_folder(provider: str, list_url: str, parent_path: str, out: list, visited: set):
    canonical_list = canonical_url(list_url) or list_url
    visit_key = (provider, canonical_list, parent_path)
    if visit_key in visited:
        raise RuntimeError(f"folder traversal cycle at {canonical_list}")
    visited.add(visit_key)

    for item in iter_pages(list_url):
        entry = normalize_file(item, provider, parent_path)
        out.append(entry)
        if entry["kind"] == "folder":
            child_url = related_href(item, "files")
            if not child_url:
                raise RuntimeError(f"folder has no child-files relationship: {entry['path']}")
            walk_folder(provider, child_url, entry["path"], out, visited)


def build_inventory(node_id: str):
    entries = []
    visited = set()
    providers = provider_roots(node_id)
    for provider, root_url in providers:
        walk_folder(provider, root_url, "", entries, visited)

    entries.sort(key=lambda e: (e["provider"], e["path"], str(e.get("id") or "")))
    paths = [(e["provider"], e["path"]) for e in entries]
    if len(paths) != len(set(paths)):
        raise RuntimeError("duplicate provider/path identities in OSF inventory")

    files = [e for e in entries if e["kind"] == "file"]
    folders = [e for e in entries if e["kind"] == "folder"]
    audio_exts = {".mp3", ".wav", ".flac", ".m4a", ".ogg", ".aac"}
    annotation_exts = {".csv", ".tsv", ".txt", ".json", ".xml", ".mat", ".arff"}
    audio = [e for e in files if Path(e["name"]).suffix.lower() in audio_exts]
    annotations = [e for e in files if Path(e["name"]).suffix.lower() in annotation_exts]

    return {
        "schema": SCHEMA,
        "nodeId": node_id,
        "nodeUrl": f"https://osf.io/{node_id}/",
        "apiNodeUrl": f"{API_BASE}/nodes/{node_id}/",
        "providers": sorted(p for p, _ in providers),
        "summary": {
            "entryCount": len(entries),
            "fileCount": len(files),
            "folderCount": len(folders),
            "audioFileCountByExtension": len(audio),
            "annotationCandidateCountByExtension": len(annotations),
        },
        "entries": entries,
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--node-id", default=DEFAULT_NODE_ID)
    ap.add_argument("--output", type=Path, required=True)
    args = ap.parse_args()

    inventory = build_inventory(args.node_id)
    if inventory["summary"]["fileCount"] == 0:
        raise SystemExit("OSF inventory contains zero files")

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(inventory, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(json.dumps(inventory["summary"], indent=2, sort_keys=True))


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"inventory_osf_v1 failed: {exc}", file=sys.stderr)
        raise
