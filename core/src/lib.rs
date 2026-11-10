//! Storage and logic for Renotes. The app only draws; everything that touches
//! the disk lives here.

pub mod app;
pub mod features;
pub mod shared;

pub const VERSION: &str = env!("CARGO_PKG_VERSION");

#[cfg(test)]
mod tests {
    #[test]
    fn version_is_set() {
        assert!(!super::VERSION.is_empty());
    }
}
