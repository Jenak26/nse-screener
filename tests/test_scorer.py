from backend.scoring.scorer import compute_confidence

def test_score_with_high_volume_boosts_confidence():
    score = compute_confidence(pattern_quality=60, vol_ratio=3.0)
    assert score > 60
    assert score <= 100

def test_score_clamps_to_100():
    score = compute_confidence(pattern_quality=100, vol_ratio=10.0)
    assert score == 100

def test_score_with_low_volume():
    score = compute_confidence(pattern_quality=60, vol_ratio=0.5)
    assert score <= 65  # Low volume should not boost much

def test_score_zero_quality():
    score = compute_confidence(pattern_quality=0, vol_ratio=5.0)
    assert 0 <= score <= 100
