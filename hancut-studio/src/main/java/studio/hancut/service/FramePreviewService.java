package studio.hancut.service;

import studio.hancut.model.Clip;
import studio.hancut.model.MediaItem;
import studio.hancut.model.MediaType;
import studio.hancut.model.ProjectData;
import studio.hancut.ui.TitleRenderer;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.IOException;
import java.nio.file.Path;
import java.util.List;
import java.util.concurrent.TimeUnit;

public final class FramePreviewService {
    public BufferedImage frame(ProjectData project, Clip clip, double withinClipSeconds) throws IOException, InterruptedException {
        int width = Math.min(1280, project.output().width());
        int height = Math.min(720, project.output().height());
        if (clip.generated()) return TitleRenderer.titleCard(width, height, clip.backgroundRgb(), clip.overlayText());

        MediaItem item = project.mediaById(clip.mediaId()).orElseThrow(() -> new IOException("원본 미디어가 없습니다."));
        if (item.type() == MediaType.IMAGE) {
            BufferedImage image = ImageIO.read(Path.of(item.path()).toFile());
            if (image == null) throw new IOException("이미지를 읽을 수 없습니다.");
            return image;
        }
        if (item.type() == MediaType.AUDIO) return TitleRenderer.titleCard(width, height, 0x17213A, "오디오\n" + item.name());

        Path ffmpeg = ToolLocator.ffmpeg();
        if (ffmpeg == null) throw new IOException("ffmpeg를 찾지 못했습니다.");
        double at = clip.sourceStart() + Math.max(0, Math.min(withinClipSeconds, clip.duration() - 0.05));
        List<String> command = List.of(ffmpeg.toString(), "-loglevel", "error", "-ss", format(at),
                "-i", item.path(), "-frames:v", "1", "-vf",
                "scale=960:540:force_original_aspect_ratio=decrease", "-f", "image2pipe", "-vcodec", "png", "pipe:1");
        Process process = new ProcessBuilder(command).start();
        BufferedImage image = ImageIO.read(process.getInputStream());
        process.getErrorStream().readAllBytes();
        if (!process.waitFor(15, TimeUnit.SECONDS)) {
            process.destroyForcibly();
            throw new IOException("미리보기 생성 시간이 초과되었습니다.");
        }
        if (image == null || process.exitValue() != 0) throw new IOException("프레임 미리보기를 생성하지 못했습니다.");
        return image;
    }

    private String format(double value) { return String.format(java.util.Locale.ROOT, "%.3f", value); }
}
