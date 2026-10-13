//! WebAssembly interface: plain extern "C" functions, bytes in, bytes out.
use std::alloc::{alloc, dealloc, Layout};

#[no_mangle]
pub extern "C" fn clio_alloc(len: u32) -> *mut u8 {
    if len == 0 {
        return std::ptr::NonNull::dangling().as_ptr();
    }
    unsafe { alloc(Layout::from_size_align_unchecked(len as usize, 1)) }
}

/// # Safety
/// `ptr` must come from `clio_alloc(len)`.
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

/// # Safety
/// `ptr..ptr+len` must be valid UTF-8 written by the host.
#[no_mangle]
pub unsafe extern "C" fn clio_render(ptr: *const u8, len: u32) -> u64 {
    let input = std::str::from_utf8_unchecked(std::slice::from_raw_parts(ptr, len as usize));
    give(clio_core::render(input))
}
