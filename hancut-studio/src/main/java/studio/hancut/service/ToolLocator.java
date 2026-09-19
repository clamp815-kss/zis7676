package studio.hancut.service;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;

public final class ToolLocator {
    private ToolLocator() {}

    public static Path ffmpeg() { return find("HANCUT_FFMPEG", "ffmpeg"); }
    public static Path ffprobe() { return find("HANCUT_FFPROBE", "ffprobe"); }

    private static Path find(String envName, String baseName) {
        List<Path> candidates = new ArrayList<>();
        String configured = System.getenv(envName);
        if (configured != null && !configured.isBlank()) candidates.add(Path.of(configured));
        String exe = isWindows() ? baseName + ".exe" : baseName;
        String packagedApp = System.getProperty("jpackage.app-path");
        if (packagedApp != null && !packagedApp.isBlank()) {
            Path appDirectory = Path.of(packagedApp).toAbsolutePath().getParent();
            if (appDirectory != null) candidates.add(appDirectory.resolve("tools").resolve(exe));
        }
        candidates.add(Path.of("tools", exe).toAbsolutePath());
        candidates.add(Path.of(exe));

        for (Path candidate : candidates) {
            if (candidate.getNameCount() > 1 && Files.isRegularFile(candidate)) return candidate;
            if (candidate.getNameCount() == 1 && availableOnPath(candidate.toString())) return candidate;
        }
        return null;
    }

    private static boolean availableOnPath(String command) {
        try {
            Process process = new ProcessBuilder(command, "-version").redirectErrorStream(true).start();
            process.getInputStream().transferTo(java.io.OutputStream.nullOutputStream());
            return process.waitFor() == 0;
        } catch (Exception ignored) {
            return false;
        }
    }

    public static boolean isWindows() {
        return System.getProperty("os.name", "").toLowerCase().contains("win");
    }
}
