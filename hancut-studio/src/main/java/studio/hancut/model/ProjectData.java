package studio.hancut.model;

import java.io.Serial;
import java.io.Serializable;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

public final class ProjectData implements Serializable {
    @Serial private static final long serialVersionUID = 1L;

    private String name = "제목 없는 프로젝트";
    private final List<MediaItem> media = new ArrayList<>();
    private final List<Clip> clips = new ArrayList<>();
    private final List<Caption> captions = new ArrayList<>();
    private final OutputSettings output = new OutputSettings();

    public String name() { return name; }
    public void setName(String value) { name = value == null || value.isBlank() ? "제목 없는 프로젝트" : value.strip(); }
    public List<MediaItem> media() { return media; }
    public List<Clip> clips() { return clips; }
    public List<Caption> captions() { return captions; }
    public OutputSettings output() { return output; }

    public Optional<MediaItem> mediaById(String id) {
        return media.stream().filter(item -> item.id().equals(id)).findFirst();
    }

    public double totalDuration() { return clips.stream().mapToDouble(Clip::duration).sum(); }

    public double clipStart(int clipIndex) {
        double result = 0;
        for (int i = 0; i < Math.min(clipIndex, clips.size()); i++) result += clips.get(i).duration();
        return result;
    }

    public int clipIndexAt(double timelineSeconds) {
        double cursor = 0;
        for (int i = 0; i < clips.size(); i++) {
            cursor += clips.get(i).duration();
            if (timelineSeconds < cursor || i == clips.size() - 1) return i;
        }
        return -1;
    }
}
