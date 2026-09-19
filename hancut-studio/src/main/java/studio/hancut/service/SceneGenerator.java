package studio.hancut.service;

import studio.hancut.model.Clip;

import java.text.BreakIterator;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

public final class SceneGenerator {
    private static final int[] PALETTE = {
            0x17213A, 0x3B245F, 0x0F4C5C, 0x5C2B29, 0x274C3A, 0x4A3B16
    };

    public List<Clip> generate(String script, double secondsPerScene) {
        List<String> sentences = split(script == null ? "" : script.strip());
        List<Clip> result = new ArrayList<>();
        for (int i = 0; i < sentences.size(); i++) {
            result.add(Clip.generated(sentences.get(i), secondsPerScene, PALETTE[i % PALETTE.length]));
        }
        return result;
    }

    private List<String> split(String text) {
        List<String> result = new ArrayList<>();
        BreakIterator iterator = BreakIterator.getSentenceInstance(Locale.KOREAN);
        iterator.setText(text);
        int start = iterator.first();
        for (int end = iterator.next(); end != BreakIterator.DONE; start = end, end = iterator.next()) {
            String sentence = text.substring(start, end).strip();
            if (!sentence.isBlank()) result.add(sentence);
        }
        if (result.size() <= 1 && text.contains("\n")) {
            result.clear();
            for (String line : text.split("\\R+")) if (!line.isBlank()) result.add(line.strip());
        }
        if (result.isEmpty() && !text.isBlank()) result.add(text);
        return result;
    }
}
