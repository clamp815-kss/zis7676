package studio.hancut.service;

import studio.hancut.model.Caption;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public final class SrtService {
    private static final Pattern TIMING = Pattern.compile(
            "(\\d{1,2}):(\\d{2}):(\\d{2})[,.](\\d{3})\\s*-->\\s*(\\d{1,2}):(\\d{2}):(\\d{2})[,.](\\d{3})");

    public List<Caption> read(Path path) throws IOException {
        List<String> lines = Files.readAllLines(path, StandardCharsets.UTF_8);
        List<Caption> result = new ArrayList<>();
        for (int i = 0; i < lines.size(); i++) {
            Matcher matcher = TIMING.matcher(lines.get(i).strip());
            if (!matcher.matches()) continue;
            double start = seconds(matcher, 1);
            double end = seconds(matcher, 5);
            StringBuilder text = new StringBuilder();
            i++;
            while (i < lines.size() && !lines.get(i).isBlank()) {
                if (!text.isEmpty()) text.append('\n');
                text.append(lines.get(i).strip());
                i++;
            }
            if (end > start && !text.isEmpty()) result.add(new Caption(start, end, text.toString()));
        }
        result.sort(Comparator.comparingDouble(Caption::start));
        return result;
    }

    public void write(List<Caption> captions, Path path) throws IOException {
        StringBuilder output = new StringBuilder();
        List<Caption> sorted = captions.stream().sorted(Comparator.comparingDouble(Caption::start)).toList();
        for (int i = 0; i < sorted.size(); i++) {
            Caption caption = sorted.get(i);
            output.append(i + 1).append('\n')
                    .append(format(caption.start())).append(" --> ").append(format(caption.end())).append('\n')
                    .append(caption.text()).append("\n\n");
        }
        Files.writeString(path, output, StandardCharsets.UTF_8);
    }

    private double seconds(Matcher match, int offset) {
        return Integer.parseInt(match.group(offset)) * 3600d
                + Integer.parseInt(match.group(offset + 1)) * 60d
                + Integer.parseInt(match.group(offset + 2))
                + Integer.parseInt(match.group(offset + 3)) / 1000d;
    }

    private String format(double seconds) {
        long millis = Math.max(0, Math.round(seconds * 1000));
        return "%02d:%02d:%02d,%03d".formatted(
                millis / 3_600_000, (millis / 60_000) % 60, (millis / 1000) % 60, millis % 1000);
    }
}
