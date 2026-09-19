package studio.hancut.service;

import studio.hancut.model.MediaItem;
import studio.hancut.model.MediaType;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.util.List;
import java.util.Locale;
import java.util.Set;

public final class MediaProbeService {
    private static final Set<String> IMAGES = Set.of("jpg", "jpeg", "png", "webp", "bmp", "gif");
    private static final Set<String> AUDIO = Set.of("mp3", "wav", "m4a", "aac", "flac", "ogg", "opus");

    public MediaItem probe(Path path) throws IOException, InterruptedException {
        String extension = extension(path).toLowerCase(Locale.ROOT);
        if (IMAGES.contains(extension)) {
            BufferedImage image = ImageIO.read(path.toFile());
            if (image == null) throw new IOException("지원하지 않는 이미지입니다: " + path.getFileName());
            return new MediaItem(path, MediaType.IMAGE, 5, image.getWidth(), image.getHeight(), false);
        }
        MediaType type = AUDIO.contains(extension) ? MediaType.AUDIO : MediaType.VIDEO;
        Path ffprobe = ToolLocator.ffprobe();
        if (ffprobe == null) throw new IOException("ffprobe를 찾지 못했습니다. tools 폴더에 ffprobe.exe를 넣어 주세요.");

        List<String> command = List.of(ffprobe.toString(), "-v", "error", "-show_entries",
                "stream=codec_type,width,height:format=duration", "-of", "default=noprint_wrappers=1", path.toString());
        Process process = new ProcessBuilder(command).redirectErrorStream(true).start();
        String output = new String(process.getInputStream().readAllBytes(), StandardCharsets.UTF_8);
        int exit = process.waitFor();
        if (exit != 0) throw new IOException("미디어 분석 실패: " + output.strip());

        double duration = value(output, "duration", 5);
        int width = (int) value(output, "width", 0);
        int height = (int) value(output, "height", 0);
        boolean hasAudio = output.contains("codec_type=audio");
        return new MediaItem(path, type, duration, width, height, hasAudio || type == MediaType.AUDIO);
    }

    private double value(String output, String key, double fallback) {
        for (String line : output.split("\\R")) {
            if (!line.startsWith(key + "=")) continue;
            try { return Double.parseDouble(line.substring(key.length() + 1)); }
            catch (NumberFormatException ignored) { return fallback; }
        }
        return fallback;
    }

    private String extension(Path path) {
        String name = path.getFileName().toString();
        int dot = name.lastIndexOf('.');
        return dot < 0 ? "" : name.substring(dot + 1);
    }
}
