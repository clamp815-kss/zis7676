package studio.hancut.service;

import studio.hancut.model.Clip;
import studio.hancut.model.MediaItem;
import studio.hancut.model.MediaType;
import studio.hancut.model.ProjectData;
import studio.hancut.ui.TitleRenderer;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;

public final class FfmpegExportService {
    @FunctionalInterface public interface ProgressListener { void update(int percent, String message); }

    private final SrtService srtService = new SrtService();

    public void export(ProjectData project, Path destination, ProgressListener listener) throws IOException, InterruptedException {
        if (project.clips().isEmpty()) throw new IOException("타임라인이 비어 있습니다.");
        Path ffmpeg = ToolLocator.ffmpeg();
        if (ffmpeg == null) throw new IOException("ffmpeg를 찾지 못했습니다. tools 폴더에 ffmpeg.exe를 넣어 주세요.");
        Path temp = Files.createTempDirectory("hancut-export-");
        try {
            List<Path> segments = new ArrayList<>();
            for (int i = 0; i < project.clips().size(); i++) {
                listener.update((int) (75d * i / project.clips().size()), "장면 %d/%d 렌더링".formatted(i + 1, project.clips().size()));
                Path segment = temp.resolve("segment-%04d.mp4".formatted(i));
                renderSegment(ffmpeg, project, project.clips().get(i), segment, temp, i);
                segments.add(segment);
            }

            listener.update(80, "장면 결합 중");
            Path concatList = temp.resolve("segments.txt");
            StringBuilder listText = new StringBuilder();
            for (Path segment : segments) listText.append("file '").append(segment.toString().replace("'", "'\\''")).append("'\n");
            Files.writeString(concatList, listText, StandardCharsets.UTF_8);
            Path joined = temp.resolve("joined.mp4");
            run(List.of(ffmpeg.toString(), "-y", "-f", "concat", "-safe", "0", "-i", concatList.toString(),
                    "-c", "copy", joined.toString()));

            if (project.captions().isEmpty()) {
                Files.move(joined, destination, StandardCopyOption.REPLACE_EXISTING);
            } else {
                listener.update(88, "자막 입히는 중");
                Path srt = temp.resolve("captions.srt");
                srtService.write(project.captions(), srt);
                String filter = "subtitles=filename='" + filterPath(srt) + "':force_style='FontName=Arial,FontSize=18,Outline=2,Shadow=1,Alignment=2,MarginV=36'";
                run(List.of(ffmpeg.toString(), "-y", "-i", joined.toString(), "-vf", filter,
                        "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-c:a", "copy", destination.toString()));
            }
            listener.update(100, "내보내기 완료");
        } finally {
            deleteTree(temp);
        }
    }

    private void renderSegment(Path ffmpeg, ProjectData project, Clip clip, Path output, Path temp, int index)
            throws IOException, InterruptedException {
        int width = project.output().width();
        int height = project.output().height();
        int fps = project.output().fps();
        double duration = clip.duration();
        List<String> command = new ArrayList<>(List.of(ffmpeg.toString(), "-y", "-loglevel", "warning"));
        MediaItem source = null;
        int sourceAudioInput = -1;
        int nextInput = 1;

        if (clip.generated()) {
            Path card = temp.resolve("card-%04d.png".formatted(index));
            TitleRenderer.writePng(TitleRenderer.titleCard(width, height, clip.backgroundRgb(), clip.overlayText()), card);
            command.addAll(List.of("-loop", "1", "-framerate", Integer.toString(fps), "-t", num(duration), "-i", card.toString()));
        } else {
            source = project.mediaById(clip.mediaId()).orElseThrow(() -> new IOException("클립의 원본 미디어가 없습니다."));
            if (source.type() == MediaType.VIDEO) {
                command.addAll(List.of("-ss", num(clip.sourceStart()), "-t", num(duration), "-i", source.path()));
                if (source.hasAudio()) sourceAudioInput = 0;
            } else if (source.type() == MediaType.IMAGE) {
                command.addAll(List.of("-loop", "1", "-framerate", Integer.toString(fps), "-t", num(duration), "-i", source.path()));
            } else {
                command.addAll(List.of("-f", "lavfi", "-t", num(duration), "-i", "color=c=0x17213A:s=" + width + "x" + height + ":r=" + fps));
                command.addAll(List.of("-ss", num(clip.sourceStart()), "-t", num(duration), "-i", source.path()));
                sourceAudioInput = 1;
                nextInput = 2;
            }
        }

        int overlayInput = -1;
        if (!clip.generated() && !clip.overlayText().isBlank()) {
            Path overlay = temp.resolve("overlay-%04d.png".formatted(index));
            TitleRenderer.writePng(TitleRenderer.overlay(width, height, clip.overlayText()), overlay);
            overlayInput = nextInput++;
            command.addAll(List.of("-loop", "1", "-framerate", Integer.toString(fps), "-t", num(duration), "-i", overlay.toString()));
        }
        int silenceInput = -1;
        if (sourceAudioInput < 0) {
            silenceInput = nextInput;
            command.addAll(List.of("-f", "lavfi", "-t", num(duration), "-i", "anullsrc=channel_layout=stereo:sample_rate=48000"));
        }

        double fadeDuration = clip.fade() ? Math.min(0.22, duration / 4) : 0;
        StringBuilder filter = new StringBuilder("[0:v]scale=").append(width).append(':').append(height)
                .append(":force_original_aspect_ratio=decrease,pad=").append(width).append(':').append(height)
                .append(":(ow-iw)/2:(oh-ih)/2:black,fps=").append(fps).append(",setsar=1,format=yuv420p");
        if (fadeDuration > 0) filter.append(",fade=t=in:st=0:d=").append(num(fadeDuration))
                .append(",fade=t=out:st=").append(num(duration - fadeDuration)).append(":d=").append(num(fadeDuration));
        filter.append("[base];");
        if (overlayInput >= 0) filter.append("[base][").append(overlayInput).append(":v]overlay=0:0:format=auto[v];");
        else filter.append("[base]null[v];");

        int audioInput = sourceAudioInput >= 0 ? sourceAudioInput : silenceInput;
        filter.append('[').append(audioInput).append(":a]atrim=duration=").append(num(duration))
                .append(",asetpts=PTS-STARTPTS,aresample=48000[a]");
        command.addAll(List.of("-filter_complex", filter.toString(), "-map", "[v]", "-map", "[a]", "-t", num(duration),
                "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p",
                "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2", output.toString()));
        run(command);
    }

    private void run(List<String> command) throws IOException, InterruptedException {
        Process process = new ProcessBuilder(command).redirectErrorStream(true).start();
        StringBuilder output = new StringBuilder();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream(), StandardCharsets.UTF_8))) {
            String line;
            while ((line = reader.readLine()) != null) {
                if (output.length() < 12_000) output.append(line).append('\n');
            }
        }
        int exit = process.waitFor();
        if (exit != 0) throw new IOException("FFmpeg 처리 실패 (코드 " + exit + ")\n" + output.toString().strip());
    }

    private String num(double value) { return String.format(Locale.ROOT, "%.3f", value); }

    private String filterPath(Path path) {
        return path.toAbsolutePath().toString().replace("\\", "/").replace(":", "\\:").replace("'", "\\'");
    }

    private void deleteTree(Path root) {
        if (root == null || !Files.exists(root)) return;
        try (var paths = Files.walk(root)) {
            paths.sorted(Comparator.reverseOrder()).forEach(path -> {
                try { Files.deleteIfExists(path); } catch (IOException ignored) { }
            });
        } catch (IOException ignored) { }
    }
}
