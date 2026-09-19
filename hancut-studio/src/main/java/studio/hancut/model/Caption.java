package studio.hancut.model;

import java.io.Serial;
import java.io.Serializable;

public record Caption(double start, double end, String text) implements Serializable {
    @Serial private static final long serialVersionUID = 1L;

    public Caption {
        if (start < 0 || end <= start) throw new IllegalArgumentException("자막 시간이 올바르지 않습니다.");
        text = text == null ? "" : text.strip();
    }
}
