#![deny(clippy::all)]

//! Native segment-trie router for js-kt (napi-rs).
//!
//! Mirrors the semantics of `SegmentTrieRouter` (server/utils/routersHelpers/
//! trieRouter.ts): static segment > param segment > wildcard priority, with
//! backtracking, percent-decoded params, and wildcards captured as arrays of
//! decoded segments. Exposed to JS as `NativeRouter` with `add()` / `matchRoute()`.

use napi::bindgen_prelude::*;
use napi_derive::napi;
use std::collections::HashMap;

/// A single node in the routing trie.
#[derive(Clone, Default)]
struct TrieNode {
    static_children: HashMap<String, TrieNode>,
    param_child: Option<Box<TrieNode>>,
    param_name: Option<String>,
    wildcard_child: Option<Box<TrieNode>>,
    wildcard_name: Option<String>,
    route_id: i32,
}

impl TrieNode {
    fn new() -> Self {
        TrieNode {
            route_id: -1,
            ..Default::default()
        }
    }
}

fn hex_val(b: u8) -> Option<u8> {
    match b {
        b'0'..=b'9' => Some(b - b'0'),
        b'a'..=b'f' => Some(b - b'a' + 10),
        b'A'..=b'F' => Some(b - b'A' + 10),
        _ => None,
    }
}

/// Percent-decodes a path segment (`%XX` bytes, `+` → space) like
/// `decodeURIComponent(s.replace(/\+/g, " "))`. Falls back to the raw segment
/// when the result is not valid UTF-8 (mirrors `decodeURIComponent` throwing).
fn decode_segment(input: &str) -> String {
    let bytes = input.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        match bytes[i] {
            b'+' => {
                out.push(b' ');
                i += 1;
            }
            b'%' => {
                if i + 2 < bytes.len() {
                    if let (Some(hi), Some(lo)) = (hex_val(bytes[i + 1]), hex_val(bytes[i + 2])) {
                        out.push(hi * 16 + lo);
                        i += 3;
                        continue;
                    }
                }
                out.push(b'%');
                i += 1;
            }
            b => {
                out.push(b);
                i += 1;
            }
        }
    }
    match String::from_utf8(out) {
        Ok(s) => s,
        Err(_) => input.to_string(),
    }
}

fn decode_vec(segments: &[&str]) -> Vec<String> {
    segments.iter().map(|s| decode_segment(s)).collect()
}

/// Recursive trie traversal with backtracking.
///
/// Priority: static child > param child > wildcard child. `params` holds scalar
/// captures (`:name`), `wildcards` holds `*name` captures (arrays of segments).
/// Returns the matched `route_id` or `-1`.
fn match_recursive(
    node: &TrieNode,
    segments: &[&str],
    index: usize,
    params: &mut HashMap<String, String>,
    wildcards: &mut HashMap<String, Vec<String>>,
) -> i32 {
    let segment = segments.get(index);

    if let Some(seg) = segment {
        // 1. static child takes priority over params
        if let Some(child) = node.static_children.get(*seg) {
            let id = match_recursive(child, segments, index + 1, params, wildcards);
            if id != -1 {
                return id;
            }
        }

        // 2. param child (single segment)
        if let Some(child) = node.param_child.as_ref() {
            let name = node.param_name.clone().unwrap_or_default();
            let old = params.insert(name.clone(), decode_segment(seg));
            let id = match_recursive(child, segments, index + 1, params, wildcards);
            if id != -1 {
                return id;
            }
            match old {
                Some(v) => {
                    params.insert(name, v);
                }
                None => {
                    params.remove(&name);
                }
            }
        }
    }

    // 3. wildcard child consumes the rest of the path (possibly empty)
    if let Some(child) = node.wildcard_child.as_ref() {
        let name = node.wildcard_name.clone().unwrap_or_default();
        let rest = if segment.is_some() {
            decode_vec(&segments[index..])
        } else {
            Vec::new()
        };
        wildcards.insert(name.clone(), rest);
        let id = match_recursive(child, segments, segments.len(), params, wildcards);
        if id != -1 {
            return id;
        }
        wildcards.remove(&name);
    }

    // 4. terminal route
    if segment.is_none() && node.route_id != -1 {
        return node.route_id;
    }

    -1
}

#[napi(object)]
pub struct NativeMatchResult {
    pub found: bool,
    pub route_id: i32,
    pub params: HashMap<String, String>,
    pub wildcards: HashMap<String, Vec<String>>,
}

#[napi]
pub struct NativeRouter {
    root: TrieNode,
    route_count: usize,
}

fn push_string(out: &mut Vec<u8>, s: &str) {
    out.extend_from_slice(&(s.len() as u16).to_le_bytes());
    out.extend_from_slice(s.as_bytes());
}

fn push_u32(out: &mut Vec<u8>, v: u32) {
    out.extend_from_slice(&v.to_le_bytes());
}

fn encode_result(out: &mut Vec<u8>, route_id: i32, params: &HashMap<String, String>, wildcards: &HashMap<String, Vec<String>>) {
    out.extend_from_slice(&route_id.to_le_bytes());
    push_u32(out, params.len() as u32);
    for (key, value) in params {
        push_string(out, key);
        push_string(out, value);
    }
    push_u32(out, wildcards.len() as u32);
    for (key, values) in wildcards {
        push_string(out, key);
        push_u32(out, values.len() as u32);
        for value in values {
            push_string(out, value);
        }
    }
}

fn encode_not_found(out: &mut Vec<u8>) {
    out.extend_from_slice(&(-1i32).to_le_bytes());
}

#[napi]
impl NativeRouter {
    #[napi(constructor)]
    pub fn new() -> Self {
        NativeRouter {
            root: TrieNode::new(),
            route_count: 0,
        }
    }

    #[napi]
    pub fn add(&mut self, pattern: String, route_id: i32) -> napi::Result<()> {
        let segments: Vec<&str> = pattern.split('/').collect();
        let mut node = &mut self.root;

        for (i, segment) in segments.iter().enumerate() {
            if segment.starts_with('*') {
                if i != segments.len() - 1 {
                    return Err(napi::Error::from_reason(
                        "wildcard segment must be the last segment of a pattern",
                    ));
                }
                if node.wildcard_child.is_none() {
                    node.wildcard_name = Some(if *segment == "*" {
                        "*".to_string()
                    } else {
                        segment[1..].to_string()
                    });
                    node.wildcard_child = Some(Box::new(TrieNode::new()));
                }
                node = node.wildcard_child.as_mut().unwrap();
                break;
            }

            if segment.starts_with(':') {
                if node.param_child.is_none() {
                    node.param_name = Some(segment[1..].to_string());
                    node.param_child = Some(Box::new(TrieNode::new()));
                }
                node = node.param_child.as_mut().unwrap();
            } else {
                let entry = node.static_children.entry((*segment).to_string());
                node = entry.or_insert_with(TrieNode::new);
            }
        }

        if node.route_id == -1 {
            self.route_count += 1;
        }
        node.route_id = route_id;
        Ok(())
    }

    #[napi]
    pub fn size(&self) -> usize {
        self.route_count
    }

    #[napi]
    pub fn match_route(&self, path: String) -> NativeMatchResult {
        let mut params: HashMap<String, String> = HashMap::new();
        let mut wildcards: HashMap<String, Vec<String>> = HashMap::new();

        let id = match_recursive(&self.root, &path_segments(&path), 0, &mut params, &mut wildcards);
        if id == -1 {
            return NativeMatchResult {
                found: false,
                route_id: -1,
                params: HashMap::new(),
                wildcards: HashMap::new(),
            };
        }

        NativeMatchResult {
            found: true,
            route_id: id,
            params,
            wildcards,
        }
    }

    /// Hot-path variant: returns a compact binary buffer instead of a JS object
    /// (single-copy marshalling, decoded on the JS side).
    ///
    /// Layout (all little-endian):
    ///   i32 route_id (-1 = not found)
    ///   u32 scalar param count, then per param: u16 klen, key, u16 vlen, value
    ///   u32 wildcard count, then per wildcard: u16 klen, key, u32 count,
    ///     then per value: u16 vlen, value
    #[napi]
    pub fn match_route_buf(&self, path: String) -> Buffer {
        let mut params: HashMap<String, String> = HashMap::new();
        let mut wildcards: HashMap<String, Vec<String>> = HashMap::new();

        let id = match_recursive(&self.root, &path_segments(&path), 0, &mut params, &mut wildcards);
        let mut out: Vec<u8> = Vec::with_capacity(48);
        if id == -1 {
            encode_not_found(&mut out);
        } else {
            encode_result(&mut out, id, &params, &wildcards);
        }
        out.into()
    }
}

fn path_segments(path: &str) -> Vec<&str> {
    path.split('/').collect()
}
