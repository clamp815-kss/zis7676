package studio.hancut;

import studio.hancut.model.Caption;
import studio.hancut.model.ProjectData;
import studio.hancut.service.ProjectService;
import studio.hancut.service.SceneGenerator;
import studio.hancut.service.SrtService;
import studio.hancut.ui.TitleRenderer;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

public final class Diagnostics {
    private Diagnostics() {}

    public static void run() throws Exception {
        ProjectData project = new ProjectData();
        project.setName("진단 프로젝트");
        project.clips().addAll(new SceneGenerator().generate("첫 장면입니다. 두 번째 장면입니다.", 2.5));
        project.captions().add(new Caption(0, 2, "진단 자막"));
        if (project.clips().size() != 2 || Math.abs(project.totalDuration() - 5) > 0.001) {
            throw new IllegalStateException("장면 생성 모델 진단 실패");
        }

        Path directory = Files.createTempDirectory("hancut-check-");
        try {
            Path projectPath = directory.resolve("check.hancut");
            ProjectService projects = new ProjectService();
            projects.save(project, projectPath);
            ProjectData loaded = projects.load(projectPath);
            if (!loaded.name().equals(project.name()) || loaded.clips().size() != 2) {
                throw new IllegalStateException("프로젝트 저장/열기 진단 실패");
            }

            Path srt = directory.resolve("check.srt");
            SrtService subtitles = new SrtService();
            subtitles.write(project.captions(), srt);
            List<Caption> loadedCaptions = subtitles.read(srt);
            if (loadedCaptions.size() != 1 || !loadedCaptions.get(0).text().equals("진단 자막")) {
                throw new IllegalStateException("SRT 진단 실패");
            }
            if (TitleRenderer.titleCard(640, 360, 0x24314D, "HanCut").getWidth() != 640) {
                throw new IllegalStateException("제목 렌더링 진단 실패");
            }
            System.out.println("HanCut self-check OK: scenes=2, project=round-trip, srt=round-trip, title=640x360");
        } finally {
            try (var paths = Files.walk(directory)) {
                paths.sorted(java.util.Comparator.reverseOrder()).forEach(path -> {
                    try { Files.deleteIfExists(path); } catch (Exception ignored) { }
                });
            }
        }
    }
}
