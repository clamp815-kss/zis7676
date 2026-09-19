package studio.hancut.ui;

import javax.imageio.ImageIO;
import java.awt.Color;
import java.awt.Font;
import java.awt.FontMetrics;
import java.awt.GradientPaint;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.IOException;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;

public final class TitleRenderer {
    private TitleRenderer() {}

    public static BufferedImage titleCard(int width, int height, int rgb, String text) {
        BufferedImage image = new BufferedImage(width, height, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = image.createGraphics();
        quality(g);
        Color base = new Color(rgb);
        g.setPaint(new GradientPaint(0, 0, base.brighter(), width, height, base.darker()));
        g.fillRect(0, 0, width, height);
        g.setColor(new Color(255, 255, 255, 24));
        g.fillOval(-width / 5, -height / 3, width, width);
        drawCenteredText(g, text, width, height, Math.max(28, width / 24));
        g.dispose();
        return image;
    }

    public static BufferedImage overlay(int width, int height, String text) {
        BufferedImage image = new BufferedImage(width, height, BufferedImage.TYPE_INT_ARGB);
        Graphics2D g = image.createGraphics();
        quality(g);
        Font font = new Font(Font.SANS_SERIF, Font.BOLD, Math.max(24, width / 32));
        g.setFont(font);
        List<String> lines = wrap(g.getFontMetrics(), text, (int) (width * 0.82));
        int lineHeight = g.getFontMetrics().getHeight();
        int boxHeight = lineHeight * lines.size() + 30;
        int boxY = height - boxHeight - Math.max(24, height / 14);
        g.setColor(new Color(0, 0, 0, 165));
        g.fillRoundRect(width / 12, boxY, width * 5 / 6, boxHeight, 24, 24);
        g.setColor(Color.WHITE);
        int y = boxY + 20 + g.getFontMetrics().getAscent();
        for (String line : lines) {
            int x = (width - g.getFontMetrics().stringWidth(line)) / 2;
            g.drawString(line, x, y);
            y += lineHeight;
        }
        g.dispose();
        return image;
    }

    public static Path writePng(BufferedImage image, Path path) throws IOException {
        ImageIO.write(image, "png", path.toFile());
        return path;
    }

    private static void drawCenteredText(Graphics2D g, String text, int width, int height, int size) {
        Font font = new Font(Font.SANS_SERIF, Font.BOLD, size);
        g.setFont(font);
        FontMetrics metrics = g.getFontMetrics();
        List<String> lines = wrap(metrics, text, (int) (width * 0.72));
        int lineHeight = metrics.getHeight();
        int y = (height - lineHeight * lines.size()) / 2 + metrics.getAscent();
        g.setColor(Color.WHITE);
        for (String line : lines) {
            g.drawString(line, (width - metrics.stringWidth(line)) / 2, y);
            y += lineHeight;
        }
    }

    private static List<String> wrap(FontMetrics metrics, String text, int maxWidth) {
        List<String> lines = new ArrayList<>();
        for (String paragraph : text.strip().split("\\R", -1)) {
            StringBuilder line = new StringBuilder();
            for (String word : paragraph.split("\\s+")) {
                String candidate = line.isEmpty() ? word : line + " " + word;
                if (!line.isEmpty() && metrics.stringWidth(candidate) > maxWidth) {
                    lines.add(line.toString());
                    line.setLength(0);
                }
                if (!line.isEmpty()) line.append(' ');
                line.append(word);
            }
            if (!line.isEmpty()) lines.add(line.toString());
        }
        if (lines.isEmpty()) lines.add("");
        return lines;
    }

    private static void quality(Graphics2D g) {
        g.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
        g.setRenderingHint(RenderingHints.KEY_TEXT_ANTIALIASING, RenderingHints.VALUE_TEXT_ANTIALIAS_ON);
        g.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
    }
}
