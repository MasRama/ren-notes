//! Code every feature may use. It holds no feature knowledge.

pub mod clock;
pub mod db;
pub mod error;
pub mod ids;
mod migrations;
pub mod paths;
#[cfg(test)]
pub mod testing;
