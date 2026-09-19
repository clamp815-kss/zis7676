package studio.hancut.model;

import java.io.Serial;
import java.io.Serializable;

public final class OutputSettings implements Serializable {
    @Serial private static final long serialVersionUID = 1L;

    private int width = 1920;
    private int height = 1080;
    private int fps = 30;

    public int width() { return width; }
    public int height() { return height; }
    public int fps() { return fps; }

    public void setSize(int width, int height) {
        this.width = Math.max(320, width);
        this.height = Math.max(240, height);
    }

    public void setFps(int fps) { this.fps = Math.max(15, Math.min(60, fps)); }

    @Override public String toString() { return width + "×" + height + " / " + fps + "fps"; }
}
