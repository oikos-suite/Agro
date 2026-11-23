//! A username names one account in any letter case, all the way down.
//!
//! The gate (`authorize`, `require_visible`) has always matched names case-insensitively, but the
//! listening history underneath was keyed on whatever spelling a client sent. So `ALPHA` passed the
//! gate and then read an empty year, plays sent as `Alpha` were invisible to every read of `alpha`,
//! and a purge or an account deletion under one spelling left the other's rows behind.

use super::*;

fn current_year() -> i32 {
    chrono::Utc::now().format("%Y").to_string().parse().unwrap()
}

fn number(response: async_graphql::Response, path: &[&str]) -> i64 {
    let mut value = response.data.into_json().unwrap();
    for key in path {
        value = value[*key].clone();
    }
    value
        .as_i64()
        .unwrap_or_else(|| panic!("{path:?} is not a number: {value}"))
}

#[tokio::test]
pub(super) async fn another_spelling_of_the_name_reads_the_same_history() {
    let h = harness();
    h.seed_plays("alpha", "Xtal", "Aphex Twin", 3, 3600);
    let year = current_year();

    let wrapped = h
        .run_as(
            &h.alpha,
            &format!(r#"{{ agroWrapped(userId: "ALPHA", year: {year}) {{ totalPlays }} }}"#),
        )
        .await;
    assert_allowed(&wrapped, "agroWrapped under another spelling");
    assert_eq!(number(wrapped, &["agroWrapped", "totalPlays"]), 3);

    let stats = h
        .run_as(
            &h.alpha,
            r#"{ listeningStats(userId: "Alpha") { playsTotal } }"#,
        )
        .await;
    assert_allowed(&stats, "listeningStats under another spelling");
    assert_eq!(number(stats, &["listeningStats", "playsTotal"]), 3);

    // A friend reading an open history gets it whatever spelling they use, too.
    h.befriend("alpha", "beta");
    h.db.set_visibility("alpha", true, true).unwrap();
    let friend = h
        .run_as(
            &h.beta,
            &format!(r#"{{ agroWrapped(userId: "aLpHa", year: {year}) {{ totalPlays }} }}"#),
        )
        .await;
    assert_allowed(&friend, "a friend's agroWrapped under another spelling");
    assert_eq!(number(friend, &["agroWrapped", "totalPlays"]), 3);
}

#[tokio::test]
pub(super) async fn plays_sent_under_another_spelling_are_filed_under_the_account() {
    let h = harness();
    let recorded = h
        .run_as(
            &h.alpha,
            r#"mutation { recordScrobbles(userId: "Alpha", deviceName: "phone", entries: [
                { trackTitle: "Xtal", artistName: "Aphex Twin", durationSecs: 180,
                  playedAt: "2026-03-01T12:00:00Z", playUid: "one" }
            ]) }"#,
        )
        .await;
    assert_allowed(&recorded, "recordScrobbles under another spelling");
    assert_eq!(h.db.scrobble_rows("alpha", None, None).unwrap().len(), 1);
}

#[tokio::test]
pub(super) async fn a_purge_under_another_spelling_removes_the_history() {
    let h = harness();
    h.seed_plays("alpha", "Xtal", "Aphex Twin", 3, 3600);
    let purged = h
        .run_as(
            &h.alpha,
            r#"mutation { purgeScrobbles(userId: "ALPHA") { purgedCount } }"#,
        )
        .await;
    assert_allowed(&purged, "purgeScrobbles under another spelling");
    assert_eq!(number(purged, &["purgeScrobbles", "purgedCount"]), 3);
    assert!(h.db.scrobble_rows("alpha", None, None).unwrap().is_empty());
}

/// Rows filed under another spelling before ingest was fixed are still this account's.
#[tokio::test]
pub(super) async fn deleting_an_account_removes_plays_filed_under_another_spelling() {
    let h = harness();
    h.seed_plays("Alpha", "Xtal", "Aphex Twin", 2, 3600);
    assert!(h.db.delete_user("alpha").unwrap());
    let left: i64 =
        h.db.conn
            .lock()
            .unwrap()
            .query_row("SELECT COUNT(*) FROM scrobbles", [], |row| row.get(0))
            .unwrap();
    assert_eq!(left, 0, "plays filed as `Alpha` outlived the account");
}
