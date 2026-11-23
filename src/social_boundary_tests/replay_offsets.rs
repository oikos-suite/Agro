//! Every Replay resolver reads the listener's clock the same way (#43).
//!
//! A client sending its UTC offset in seconds (3600 for UTC+1) got "That is not a year Agro can
//! read" from the standing and circle cards, while the recap itself quietly bucketed hours and days
//! in UTC. All three now refuse it, with a message naming the unit, and accept real offsets.

use super::*;

fn replay_queries(offset: i32) -> [(&'static str, String); 3] {
    [
        (
            "agroWrapped",
            format!(
                r#"{{ agroWrapped(userId: "alpha", year: 2026, utcOffsetMinutes: {offset}) {{ totalPlays }} }}"#
            ),
        ),
        (
            "replayChartStanding",
            format!(
                r#"{{ replayChartStanding(year: 2026, utcOffsetMinutes: {offset}) {{ suppressed }} }}"#
            ),
        ),
        (
            "circleRecap",
            format!(r#"{{ circleRecap(year: 2026, utcOffsetMinutes: {offset}) {{ members }} }}"#),
        ),
    ]
}

#[tokio::test]
pub(super) async fn every_replay_card_refuses_an_offset_in_seconds_and_says_why() {
    let h = harness();
    h.seed_plays("alpha", "Xtal", "Aphex Twin", 3, 3600);
    for (name, query) in replay_queries(3600) {
        let response = h.run_as(&h.alpha, &query).await;
        let message = response
            .errors
            .first()
            .unwrap_or_else(|| panic!("{name} accepted an offset of 3600 minutes"))
            .message
            .clone();
        assert!(message.contains("minutes east of UTC"), "{name}: {message}");
    }
}

#[tokio::test]
pub(super) async fn every_replay_card_answers_for_a_real_offset() {
    let h = harness();
    h.seed_plays("alpha", "Xtal", "Aphex Twin", 3, 3600);
    for offset in [0, 60, -300, 345, 840] {
        for (name, query) in replay_queries(offset) {
            assert_allowed(
                &h.run_as(&h.alpha, &query).await,
                &format!("{name} at {offset}"),
            );
        }
    }
}

#[tokio::test]
pub(super) async fn an_absurd_offset_is_refused_rather_than_panicking() {
    let h = harness();
    for (name, query) in replay_queries(i32::MAX) {
        let response = h.run_as(&h.alpha, &query).await;
        assert!(!response.errors.is_empty(), "{name} accepted i32::MAX");
    }
}
