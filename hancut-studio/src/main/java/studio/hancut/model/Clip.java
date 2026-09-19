package studio.hancut.model;

import java.io.Serial;
import java.io.Serializable;
import java.util.UUID;

public final class Clip implements Serializable {
    @Serial private static final long serialVersionUID = 1L;

    private final String id;
    private String mediaId;
    private boolean generated;
    private double sourceStart;
    private double duration;
    private String overlayText;
    private int backgroundRgb;
    private boolean fade;

    public Clip(String mediaId, double duration) {
        this(UUID.randomUUID().toString(), mediaId, false, 0, duration, "", 0x24314D, true);
    }

    public static Clip generated(String text, double duration, int backgroundRgb) {
        return new Clip(UUID.randomUUID().toString(), null, true, 0, duration, text, backgroundRgb, true);
    }

    public Clip(String id, String mediaId, boolean generated, double sourceStart, double duration,
                String overlayText, int backgroundRgb, boolean fade) {
        this.id = id;
        this.mediaId = mediaId;
        this.generated = generated;
        this.sourceStart = Math.max(0, sourceStart);
        this.duration = Math.max(0.2, duration);
        this.overlayText = overlayText == null ? "" : overlayText;
        this.backgroundRgb = backgroundRgb;
        this.fade = fade;
    }

    public Clip copy() {
        return new Clip(UUID.randomUUID().toString(), mediaId, generated, sourceStart, duration,
                overlayText, backgroundRgb, fade);
    }

    public String id() { return id; }
    public String mediaId() { return mediaId; }
    public boolean generated() { return generated; }
    public double sourceStart() { return sourceStart; }
    public double duration() { return duration; }
    public String overlayText() { return overlayText; }
    public int backgroundRgb() { return backgroundRgb; }
    public boolean fade() { return fade; }

    public void setSourceStart(double value) { sourceStart = Math.max(0, value); }
    public void setDuration(double value) { duration = Math.max(0.2, value); }
    public void setOverlayText(String value) { overlayText = value == null ? "" : value; }
    public void setBackgroundRgb(int value) { backgroundRgb = value; }
    public void setFade(boolean value) { fade = value; }

    @Override public String toString() {
        String name = generated ? "생성 장면" : "미디어 클립";
        if (!overlayText.isBlank()) name += " · " + overlayText.replace('\n', ' ');
        return "%s  %.1f초".formatted(name, duration);
    }
}
