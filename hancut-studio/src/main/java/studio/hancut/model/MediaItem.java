package studio.hancut.model;

import java.io.Serial;
import java.io.Serializable;
import java.nio.file.Path;
import java.util.UUID;

public final class MediaItem implements Serializable {
    @Serial private static final long serialVersionUID = 1L;

    private final String id;
    private final String path;
    private final String name;
    private final MediaType type;
    private final double duration;
    private final int width;
    private final int height;
    private final boolean hasAudio;

    public MediaItem(Path path, MediaType type, double duration, int width, int height, boolean hasAudio) {
        this(UUID.randomUUID().toString(), path.toAbsolutePath().toString(), path.getFileName().toString(),
                type, duration, width, height, hasAudio);
    }

    public MediaItem(String id, String path, String name, MediaType type, double duration,
                     int width, int height, boolean hasAudio) {
        this.id = id;
        this.path = path;
        this.name = name;
        this.type = type;
        this.duration = Math.max(0.1, duration);
        this.width = width;
        this.height = height;
        this.hasAudio = hasAudio;
    }

    public String id() { return id; }
    public String path() { return path; }
    public String name() { return name; }
    public MediaType type() { return type; }
    public double duration() { return duration; }
    public int width() { return width; }
    public int height() { return height; }
    public boolean hasAudio() { return hasAudio; }

    @Override public String toString() {
        return "%s  ·  %s  ·  %.1f초".formatted(name, type.label(), duration);
    }
}
