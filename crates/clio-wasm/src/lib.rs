//! WebAssembly interface. Plain `extern "C"` functions; strings cross as
//! (pointer, length) pairs of UTF-8 in linear memory and come back packed as
//! `pointer << 32 | length`. The host frees returned buffers with `clio_free`.

use clio_core::Engine;
use std::alloc::{alloc, dealloc, Layout};
use std::cell::RefCell;

thread_local! {
    static ENGINE: RefCell<Engine> = RefCell::new(Engine::default());
}

#[no_mangle]
pub extern "C" fn clio_alloc(len: u32) -> *mut u8 {
    if len == 0 {
        return std::ptr::NonNull::dangling().as_ptr();
    }
    unsafe { alloc(Layout::from_size_align_unchecked(len as usize, 1)) }
}

/// # Safety
/// `ptr` must come from `clio_alloc(len)` or be a buffer this module returned.
#[no_mangle]
pub unsafe extern "C" fn clio_free(ptr: *mut u8, len: u32) {
    if len != 0 {
        dealloc(ptr, Layout::from_size_align_unchecked(len as usize, 1));
    }
}

fn give(out: String) -> u64 {
    let bytes = out.into_bytes().into_boxed_slice();
    let len = bytes.len() as u64;
    let ptr = Box::into_raw(bytes) as *mut u8 as u32 as u64;
    (ptr << 32) | len
}

unsafe fn arg<'a>(ptr: *const u8, len: u32) -> &'a str {
    std::str::from_utf8(std::slice::from_raw_parts(ptr, len as usize)).unwrap_or("")
}

/// Run one JSON command (see `clio_core::api`).
///
/// # Safety
/// The arguments must describe a UTF-8 buffer written by the host.
#[no_mangle]
pub unsafe extern "C" fn clio_command(ptr: *const u8, len: u32) -> u64 {
    let input = arg(ptr, len);
    give(ENGINE.with(|e| e.borrow_mut().command(input)))
}

/// Add or replace one note without JSON-escaping its text.
///
/// # Safety
/// Both arguments must describe UTF-8 buffers written by the host.
#[no_mangle]
pub unsafe extern "C" fn clio_upsert(
    path_ptr: *const u8,
    path_len: u32,
    text_ptr: *const u8,
    text_len: u32,
) -> u64 {
    let path = arg(path_ptr, path_len);
    let text = arg(text_ptr, text_len);
    ENGINE.with(|e| e.borrow_mut().upsert(path, text));
    give(String::new())
}
