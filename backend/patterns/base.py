from dataclasses import dataclass, field

@dataclass
class PatternResult:
    detected: bool
    confidence: int        # 0–100
    direction: str         # "bullish", "bearish", "neutral"
    metadata: dict = field(default_factory=dict)

    def __post_init__(self):
        self.confidence = max(0, min(100, self.confidence))
