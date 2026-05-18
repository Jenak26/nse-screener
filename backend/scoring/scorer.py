def compute_confidence(pattern_quality: int, vol_ratio: float) -> int:
    """
    Phase 1 basic scoring: pattern quality (0-60 base) + volume factor (0-40).
    Phase 2 will expand to 5 factors with full weighting.
    """
    vol_score = 0
    if vol_ratio >= 3.0:
        vol_score = 40
    elif vol_ratio >= 2.0:
        vol_score = 30
    elif vol_ratio >= 1.5:
        vol_score = 20
    elif vol_ratio >= 1.0:
        vol_score = 10
    else:
        vol_score = max(0, int(vol_ratio * 10))

    raw = pattern_quality + vol_score
    return max(0, min(100, raw))
