/// A new lowercase ULID: unique, and sorts by creation time.
pub fn new_id() -> String {
    ulid::Ulid::new().to_string().to_lowercase()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ids_are_lowercase_and_sortable() {
        let first = new_id();
        std::thread::sleep(std::time::Duration::from_millis(2));
        let second = new_id();
        assert_eq!(first.len(), 26);
        assert_eq!(first, first.to_lowercase());
        assert!(second > first);
    }
}
