use super::server_capabilities;

/// Clients branch on these names, so one that disappears breaks a fallback somewhere.
#[test]
fn every_advertised_capability_is_still_advertised() {
    let advertised = server_capabilities();
    for name in [
        "catalog.lyrics",
        "catalog.lyricsSource",
        "catalog.batchPublish",
        "playlists.blends",
        "vault.backups",
        "vault.keyEnvelope",
        "replay.wrapped",
    ] {
        assert!(
            advertised.iter().any(|c| c == name),
            "{name} is no longer advertised"
        );
    }
}
